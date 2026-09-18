/**
 * Instance-scoped page metadata runtime (Phase 4F-2C).
 *
 * OpenEditor stores stable pageId references. Hosts own entities.
 * This store caches ephemeral display metadata only — never persistence.
 *
 * Invariants:
 * - Editor/preset instance scoped (no module globals)
 * - Concurrent getPage for the same id shares one in-flight request
 * - Stale responses cannot overwrite newer generations
 * - idle ≠ loading ≠ missing ≠ error
 */

import type { EditorPageLink, PageId } from "@hello-ai-company/editor-core";

export type PageSnapshotStatus =
  | "idle"
  | "loading"
  | "ready"
  | "missing"
  | "error";

export type PageSnapshot = {
  pageId: PageId;
  status: PageSnapshotStatus;
  title: string;
  preview?: string;
  imageUrl?: string;
  imageAlt?: string;
  errorMessage?: string;
  /** Monotonic generation for race detection / debugging. */
  generation: number;
};

export type PageRuntimeStoreOptions = {
  /**
   * Host async page fetch. When absent, load() resolves to missing
   * (unless primed via prime/seed).
   */
  getPage?: (pageId: PageId) => Promise<EditorPageLink | null>;
  untitledLabel?: string;
  missingLabel?: string;
};

export type PageRuntimeStore = {
  get: (pageId: PageId) => PageSnapshot;
  load: (pageId: PageId) => Promise<PageSnapshot>;
  preload: (pageIds: readonly PageId[]) => Promise<void>;
  /** Sync seed / host push (e.g. after rename). Marks ready or missing. */
  prime: (link: EditorPageLink | null, pageId?: PageId) => void;
  invalidate: (pageId?: PageId) => void;
  subscribe: (listener: () => void) => () => void;
  /** Test/inspection: count of getPage calls. */
  getFetchCount: (pageId?: PageId) => number;
};

function emptySnapshot(
  pageId: PageId,
  status: PageSnapshotStatus,
  generation: number,
  labels: { untitled: string; missing: string },
  extra?: Partial<PageSnapshot>
): PageSnapshot {
  return {
    pageId,
    status,
    title:
      status === "missing"
        ? labels.missing
        : status === "loading" || status === "idle"
          ? labels.untitled
          : labels.untitled,
    generation,
    ...extra
  };
}

function fromLink(
  pageId: PageId,
  link: EditorPageLink,
  generation: number,
  untitled: string
): PageSnapshot {
  return {
    pageId,
    status: "ready",
    title: link.title.trim() || untitled,
    preview: link.preview,
    imageUrl: link.imageUrl,
    imageAlt: link.imageAlt,
    generation
  };
}

/**
 * Create an ephemeral, instance-scoped page metadata store.
 */
export function createPageRuntimeStore(
  options: PageRuntimeStoreOptions = {}
): PageRuntimeStore {
  const untitled = options.untitledLabel ?? "Untitled";
  const missing = options.missingLabel ?? "Missing page";
  const labels = { untitled, missing };

  const cache = new Map<string, PageSnapshot>();
  const inflight = new Map<string, Promise<PageSnapshot>>();
  /** Per-id generation; bumped on invalidate / prime / successful commit. */
  const generationById = new Map<string, number>();
  const fetchCountById = new Map<string, number>();
  let totalFetches = 0;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function nextGeneration(pageId: string): number {
    const next = (generationById.get(pageId) ?? 0) + 1;
    generationById.set(pageId, next);
    return next;
  }

  function currentGeneration(pageId: string): number {
    return generationById.get(pageId) ?? 0;
  }

  function setCache(snapshot: PageSnapshot): void {
    cache.set(snapshot.pageId, snapshot);
    notify();
  }

  function get(pageId: PageId): PageSnapshot {
    if (!pageId) {
      return emptySnapshot("", "missing", 0, labels);
    }
    const hit = cache.get(pageId);
    if (hit) return hit;
    return emptySnapshot(pageId, "idle", currentGeneration(pageId), labels);
  }

  async function load(pageId: PageId): Promise<PageSnapshot> {
    if (!pageId) {
      return emptySnapshot("", "missing", 0, labels);
    }

    const existing = cache.get(pageId);
    if (existing?.status === "ready" || existing?.status === "missing") {
      return existing;
    }

    const pending = inflight.get(pageId);
    if (pending) return pending;

    const getPage = options.getPage;
    if (!getPage) {
      const gen = nextGeneration(pageId);
      const snap = emptySnapshot(pageId, "missing", gen, labels);
      setCache(snap);
      return snap;
    }

    const requestGen = nextGeneration(pageId);
    setCache(emptySnapshot(pageId, "loading", requestGen, labels));

    let work!: Promise<PageSnapshot>;
    work = (async (): Promise<PageSnapshot> => {
      totalFetches += 1;
      fetchCountById.set(pageId, (fetchCountById.get(pageId) ?? 0) + 1);
      try {
        const link = await getPage(pageId);
        // Stale if invalidated/primed while in flight
        if (currentGeneration(pageId) !== requestGen) {
          return get(pageId);
        }
        const gen = nextGeneration(pageId);
        const snap = link
          ? fromLink(pageId, link, gen, untitled)
          : emptySnapshot(pageId, "missing", gen, labels);
        setCache(snap);
        return snap;
      } catch (err) {
        if (currentGeneration(pageId) !== requestGen) {
          return get(pageId);
        }
        const gen = nextGeneration(pageId);
        const snap = emptySnapshot(pageId, "error", gen, labels, {
          title: missing,
          errorMessage: err instanceof Error ? err.message : "Failed to load page"
        });
        setCache(snap);
        return snap;
      } finally {
        if (inflight.get(pageId) === work) {
          inflight.delete(pageId);
        }
      }
    })();

    inflight.set(pageId, work);
    return work;
  }

  async function preload(pageIds: readonly PageId[]): Promise<void> {
    const unique = [...new Set(pageIds.filter(Boolean))];
    await Promise.all(unique.map((id) => load(id)));
  }

  function prime(link: EditorPageLink | null, pageId?: PageId): void {
    const id = pageId ?? link?.id;
    if (!id) return;
    // Drop in-flight so late responses cannot overwrite the prime
    inflight.delete(id);
    const gen = nextGeneration(id);
    if (!link) {
      setCache(emptySnapshot(id, "missing", gen, labels));
      return;
    }
    setCache(fromLink(id, link, gen, untitled));
  }

  function invalidate(pageId?: PageId): void {
    if (pageId) {
      inflight.delete(pageId);
      cache.delete(pageId);
      nextGeneration(pageId);
      notify();
      return;
    }
    inflight.clear();
    cache.clear();
    for (const id of generationById.keys()) {
      nextGeneration(id);
    }
    notify();
  }

  return {
    get,
    load,
    preload,
    prime,
    invalidate,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getFetchCount(pageId) {
      if (pageId) return fetchCountById.get(pageId) ?? 0;
      return totalFetches;
    }
  };
}

/** Map a store snapshot to the sync resolve shape used by page runtimes. */
export function snapshotToResolveResult(snapshot: PageSnapshot): {
  title: string;
  preview?: string;
  imageUrl?: string;
  imageAlt?: string;
  missing?: boolean;
  loading?: boolean;
  error?: boolean;
} {
  if (snapshot.status === "loading" || snapshot.status === "idle") {
    return { title: snapshot.title, loading: true };
  }
  if (snapshot.status === "missing") {
    return { title: snapshot.title, missing: true };
  }
  if (snapshot.status === "error") {
    return {
      title: snapshot.title,
      error: true,
      missing: true
    };
  }
  return {
    title: snapshot.title,
    preview: snapshot.preview,
    imageUrl: snapshot.imageUrl,
    imageAlt: snapshot.imageAlt
  };
}

/**
 * Wire PageMention / PageCard / ChildPage runtimes to a shared store.
 * Specs capture these objects by closure (instance-scoped).
 */
export function createPageRuntimesFromStore(
  store: PageRuntimeStore,
  options?: {
    onOpen?: (pageId: PageId) => void;
    missingLabel?: string;
    untitledLabel?: string;
  }
) {
  const subscribe = (listener: () => void) => store.subscribe(listener);
  const resolve = (pageId: PageId) => {
    void store.load(pageId);
    return snapshotToResolveResult(store.get(pageId));
  };

  return {
    pageMentionRuntime: {
      resolve,
      onNavigate: options?.onOpen,
      missingLabel: options?.missingLabel,
      untitledLabel: options?.untitledLabel,
      subscribe
    },
    pageCardRuntime: {
      resolve,
      onOpen: options?.onOpen,
      missingLabel: options?.missingLabel,
      untitledLabel: options?.untitledLabel,
      subscribe,
      store
    },
    childPageRuntime: {
      resolve,
      onOpen: options?.onOpen,
      missingLabel: options?.missingLabel,
      untitledLabel: options?.untitledLabel,
      subscribe,
      store
    }
  };
}
