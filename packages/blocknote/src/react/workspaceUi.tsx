/**
 * Workspace interaction React surfaces (Phase 4F-2C / R1).
 * Host-neutral pickers, search, and backlinks presentation.
 */
import type {
  BacklinkItem,
  BacklinkProvider,
  EditorPageLink,
  PageId,
  PageProvider,
  RelationKind
} from "@hello-ai-company/editor-core";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement
} from "react";
import type { RelationIndex } from "../workspace/relationIndex.js";
import { createPageSearchEngine } from "../workspace/pageSearch.js";

export type WorkspacePagePickerMode = "mention" | "card" | "generic";

export type WorkspacePagePickerProps = {
  open: boolean;
  provider?: Pick<PageProvider, "searchPages" | "listLinks">;
  /** Optional static pages (sync filter) when provider is absent. */
  pages?: readonly EditorPageLink[];
  excludeIds?: readonly string[];
  onPick: (page: EditorPageLink | null) => void;
  title?: string;
  mode?: WorkspacePagePickerMode;
  debounceMs?: number;
  /** Initial query (e.g. from @ trigger). */
  initialQuery?: string;
};

type PickerStatus = "idle" | "loading" | "ready" | "empty" | "error";

/**
 * Pure keyboard handler for WorkspacePagePicker (unit-testable).
 * ArrowDown/Up move highlight; Enter selects; Escape cancels.
 */
export function applyWorkspacePickerKey(
  key: string,
  state: { highlight: number; resultsLength: number }
): { highlight: number; action: "none" | "select" | "cancel" } {
  if (key === "Escape") {
    return { highlight: state.highlight, action: "cancel" };
  }
  if (key === "ArrowDown") {
    if (state.resultsLength === 0) {
      return { highlight: 0, action: "none" };
    }
    return {
      highlight: Math.min(state.highlight + 1, state.resultsLength - 1),
      action: "none"
    };
  }
  if (key === "ArrowUp") {
    return { highlight: Math.max(state.highlight - 1, 0), action: "none" };
  }
  if (key === "Enter") {
    return { highlight: state.highlight, action: "select" };
  }
  return { highlight: state.highlight, action: "none" };
}

/**
 * Production-grade workspace page picker.
 * Prefer provider.searchPages; fall back to listLinks / static pages.
 *
 * Lifecycle (R1): one stable engine per provider/debounce; one query effect.
 * Initial open must not double-search.
 */
export function WorkspacePagePicker(
  props: WorkspacePagePickerProps
): ReactElement | null {
  const listboxId = useId();
  const [query, setQuery] = useState(props.initialQuery ?? "");
  const [results, setResults] = useState<EditorPageLink[]>([]);
  const [status, setStatus] = useState<PickerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const debounceMs = props.debounceMs ?? 150;
  const excludeKey = (props.excludeIds ?? []).join("\0");
  const primaryExclude = props.excludeIds?.[0];

  const engine = useMemo(
    () =>
      props.provider
        ? createPageSearchEngine({
            provider: props.provider,
            debounceMs
          })
        : null,
    [props.provider, debounceMs]
  );

  useEffect(() => {
    if (!props.open) return;
    setQuery(props.initialQuery ?? "");
    setHighlight(0);
    setErrorMessage(null);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [props.open, props.initialQuery]);

  useEffect(() => {
    if (!props.open) {
      engine?.cancel();
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    if (engine) {
      engine.search(
        {
          query,
          excludePageId: primaryExclude,
          limit: 40
        },
        (pages) => {
          const exclude = new Set(excludeKey ? excludeKey.split("\0") : []);
          const filtered = pages.filter((p) => !exclude.has(p.id));
          setResults(filtered);
          setStatus(filtered.length === 0 ? "empty" : "ready");
          setHighlight(0);
        },
        (err) => {
          setResults([]);
          setStatus("error");
          setErrorMessage(err.message);
        }
      );
      return () => engine.cancel();
    }

    // Sync static pages fallback
    const exclude = new Set(excludeKey ? excludeKey.split("\0") : []);
    const qLower = query.trim().toLowerCase();
    const filtered = (props.pages ?? [])
      .filter((page) => !exclude.has(page.id))
      .filter(
        (page) =>
          !qLower ||
          page.title.toLowerCase().includes(qLower) ||
          page.id.toLowerCase().includes(qLower)
      );
    setResults(filtered);
    setStatus(filtered.length === 0 ? "empty" : "ready");
    setHighlight(0);
    return undefined;
  }, [
    engine,
    props.open,
    query,
    primaryExclude,
    excludeKey,
    props.pages
  ]);

  const pick = useCallback(
    (page: EditorPageLink | null) => {
      props.onPick(page);
    },
    [props]
  );

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const next = applyWorkspacePickerKey(event.key, {
      highlight,
      resultsLength: results.length
    });
    if (next.action === "cancel") {
      event.preventDefault();
      pick(null);
      return;
    }
    if (next.action === "select") {
      event.preventDefault();
      const hit = results[next.highlight];
      if (hit) pick(hit);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight(next.highlight);
    }
  };

  if (!props.open) return null;

  const heading =
    props.title ??
    (props.mode === "mention"
      ? "Mention a page"
      : props.mode === "card"
        ? "Link a page card"
        : "Pick a page");

  return (
    <div
      className="oe-page-picker"
      role="dialog"
      aria-modal="true"
      aria-label={heading}
    >
      <p className="oe-page-picker__heading">{heading}</p>
      <input
        ref={inputRef}
        className="oe-page-picker__input"
        value={query}
        placeholder="Search pages…"
        aria-label="Search pages"
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          results[highlight] ? `${listboxId}-${results[highlight]!.id}` : undefined
        }
        role="combobox"
        aria-expanded="true"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {status === "loading" ? (
        <p className="oe-page-picker__status" role="status">
          Searching…
        </p>
      ) : null}
      {status === "error" ? (
        <p className="oe-page-picker__status oe-page-picker__status--error" role="alert">
          {errorMessage ?? "Search failed"}
        </p>
      ) : null}
      {status === "empty" ? (
        <p className="oe-page-picker__status" role="status">
          No pages found
        </p>
      ) : null}
      <ul className="oe-page-picker__list" role="listbox" id={listboxId}>
        {results.map((page, index) => (
          <li key={page.id} role="presentation">
            <button
              type="button"
              id={`${listboxId}-${page.id}`}
              role="option"
              aria-selected={index === highlight}
              className={
                index === highlight
                  ? "oe-page-picker__option oe-page-picker__option--active"
                  : "oe-page-picker__option"
              }
              onMouseEnter={() => setHighlight(index)}
              onClick={() => pick(page)}
            >
              <span className="oe-page-picker__title">{page.title}</span>
              {page.preview ? (
                <span className="oe-page-picker__preview">{page.preview}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="oe-page-picker__cancel" onClick={() => pick(null)}>
        Cancel
      </button>
    </div>
  );
}

/** @deprecated Use WorkspacePagePicker — kept as a thin alias for hosts. */
export type PageMentionPickerProps = {
  pages: readonly EditorPageLink[];
  open: boolean;
  excludeIds?: readonly string[];
  onPick: (page: EditorPageLink | null) => void;
  onQueryChange?: (query: string) => void;
  title?: string;
};

export function PageMentionPicker(
  props: PageMentionPickerProps
): ReactElement | null {
  return (
    <WorkspacePagePicker
      open={props.open}
      pages={props.pages}
      excludeIds={props.excludeIds}
      onPick={(page) => {
        if (page) props.onQueryChange?.(page.title);
        props.onPick(page);
      }}
      title={props.title}
      mode="mention"
    />
  );
}

export type OutgoingPageLink = {
  pageId: string;
  kind: RelationKind;
};

const PAGE_RELATION_KINDS = new Set<RelationKind>([
  "page-reference",
  "child-page"
]);

const OUTGOING_KIND_LABELS: Record<string, string> = {
  "page-reference": "Page link",
  "child-page": "Child page"
};

const INCOMING_KIND_LABELS: Record<string, string> = {
  "page-reference": "Mentioned in",
  "child-page": "Child of",
  "block-reference": "Block link",
  "database-view-reference": "Database view",
  "database-row-relation": "Row relation"
};

/**
 * All page relationships originating from this open document (RelationIndex).
 * Dedupes by target pageId (first kind wins). Excludes database relations.
 */
export function listOutgoingPageLinks(
  relationIndex: RelationIndex
): OutgoingPageLink[] {
  const seen = new Map<string, OutgoingPageLink>();
  for (const edge of relationIndex.list()) {
    if (edge.targetType !== "page") continue;
    if (!PAGE_RELATION_KINDS.has(edge.kind)) continue;
    if (seen.has(edge.targetId)) continue;
    seen.set(edge.targetId, { pageId: edge.targetId, kind: edge.kind });
  }
  return [...seen.values()];
}

export type BacklinksPanelProps = {
  targetPageId: PageId;
  provider?: BacklinkProvider;
  relationIndex?: RelationIndex;
  title?: string;
  /** Host-neutral navigation for an incoming backlink. */
  onOpenBacklink?: (item: BacklinkItem) => void;
  /** Host-neutral navigation for an outgoing page target. */
  onOpenOutgoingPage?: (pageId: PageId) => void;
  /** Optional label for outgoing page targets. */
  resolveOutgoingTitle?: (pageId: string) => string | undefined;
};

type BacklinkLoadState = "idle" | "loading" | "ready" | "empty" | "error";

export function BacklinksPanel(props: BacklinksPanelProps): ReactElement {
  const [incoming, setIncoming] = useState<BacklinkItem[]>([]);
  const [incomingState, setIncomingState] = useState<BacklinkLoadState>("idle");
  const [incomingError, setIncomingError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [refreshToken, setRefreshToken] = useState(0);
  const requestGen = useRef(0);

  useEffect(() => {
    if (!props.relationIndex) return;
    return props.relationIndex.subscribe(() => {
      setRevision(props.relationIndex!.getRevision());
    });
  }, [props.relationIndex]);

  useEffect(() => {
    const gen = ++requestGen.current;
    let cancelled = false;
    setIncomingState("loading");
    setIncomingError(null);
    void (async () => {
      try {
        const list = await props.provider?.listBacklinks?.({
          targetType: "page",
          targetId: props.targetPageId
        });
        if (cancelled || gen !== requestGen.current) return;
        const next = list ?? [];
        setIncoming(next);
        setIncomingState(next.length === 0 ? "empty" : "ready");
      } catch (err) {
        if (cancelled || gen !== requestGen.current) return;
        setIncoming([]);
        setIncomingState("error");
        setIncomingError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.provider, props.targetPageId, refreshToken]);

  // Outgoing = ALL page relations from THIS document — independent of targetPageId
  const outgoing = useMemo(() => {
    void revision;
    if (!props.relationIndex) return [];
    return listOutgoingPageLinks(props.relationIndex);
  }, [props.relationIndex, revision]);

  return (
    <aside className="oe-backlinks" aria-label={props.title ?? "Relations"}>
      <div className="oe-backlinks__header">
        <h3 className="oe-backlinks__title">{props.title ?? "Relations"}</h3>
        <button
          type="button"
          className="oe-backlinks__refresh"
          onClick={() => setRefreshToken((n) => n + 1)}
        >
          Refresh
        </button>
      </div>
      <section>
        <h4>Outgoing</h4>
        <p className="oe-backlinks__hint">From this document</p>
        {outgoing.length === 0 ? (
          <p className="oe-backlinks__empty">No linked pages in this document</p>
        ) : (
          <ul>
            {outgoing.map((link) => {
              const label =
                props.resolveOutgoingTitle?.(link.pageId) ?? link.pageId;
              return (
                <li key={link.pageId}>
                  {props.onOpenOutgoingPage ? (
                    <button
                      type="button"
                      className="oe-backlinks__link"
                      onClick={() => props.onOpenOutgoingPage?.(link.pageId)}
                    >
                      <span className="oe-backlinks__name">{label}</span>
                      <span className="oe-backlinks__kind">
                        {OUTGOING_KIND_LABELS[link.kind] ?? link.kind}
                      </span>
                    </button>
                  ) : (
                    <>
                      <span className="oe-backlinks__kind">
                        {OUTGOING_KIND_LABELS[link.kind] ?? link.kind}
                      </span>
                      <span className="oe-backlinks__name">{label}</span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section>
        <h4>Linked from</h4>
        <p className="oe-backlinks__hint">Host backlinks to this page</p>
        {incomingState === "loading" ? (
          <p className="oe-backlinks__empty" role="status">
            Loading…
          </p>
        ) : null}
        {incomingState === "error" ? (
          <p className="oe-backlinks__empty" role="alert">
            {incomingError ?? "Failed to load backlinks"}
          </p>
        ) : null}
        {incomingState === "empty" ? (
          <p className="oe-backlinks__empty">No backlinks from host</p>
        ) : null}
        {incomingState === "ready" ? (
          <ul>
            {incoming.map((edge, index) => (
              <li key={`${edge.sourceDocumentId}:${index}`}>
                <button
                  type="button"
                  className="oe-backlinks__link"
                  onClick={() => props.onOpenBacklink?.(edge)}
                >
                  <span className="oe-backlinks__name">
                    {edge.sourceTitle ?? edge.sourceDocumentId}
                  </span>
                  <span className="oe-backlinks__kind">
                    {INCOMING_KIND_LABELS[edge.kind] ?? edge.kind}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <p className="oe-backlinks__footnote">
        Outgoing = page relationships from this document&apos;s RelationIndex.
        Incoming = host BacklinkProvider for the selected page.
      </p>
    </aside>
  );
}

export type UsePageLinksOptions = {
  listLinks: () => Promise<EditorPageLink[]>;
  refreshToken?: number;
};

export function usePageLinks(options: UsePageLinksOptions): {
  pages: EditorPageLink[];
  reload: () => Promise<void>;
} {
  const { listLinks, refreshToken } = options;
  const [pages, setPages] = useState<EditorPageLink[]>([]);
  const reload = useCallback(async () => {
    const next = await listLinks();
    setPages(next);
  }, [listLinks]);

  useEffect(() => {
    void reload();
  }, [reload, refreshToken]);

  return { pages, reload };
}

export type UseWorkspacePageSearchOptions = {
  provider?: Pick<PageProvider, "searchPages" | "listLinks">;
  excludePageId?: PageId;
  debounceMs?: number;
};

/**
 * Hook for async page search with stale-query protection.
 * Does not subscribe to editor document changes.
 */
export function useWorkspacePageSearch(
  options: UseWorkspacePageSearchOptions
): {
  query: string;
  setQuery: (query: string) => void;
  results: EditorPageLink[];
  status: PickerStatus;
  errorMessage: string | null;
} {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EditorPageLink[]>([]);
  const [status, setStatus] = useState<PickerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const engine = useMemo(
    () =>
      createPageSearchEngine({
        provider: options.provider,
        debounceMs: options.debounceMs ?? 150
      }),
    [options.provider, options.debounceMs]
  );

  useEffect(() => {
    setStatus("loading");
    engine.search(
      { query, excludePageId: options.excludePageId },
      (pages) => {
        setResults(pages);
        setStatus(pages.length === 0 ? "empty" : "ready");
        setErrorMessage(null);
      },
      (err) => {
        setResults([]);
        setStatus("error");
        setErrorMessage(err.message);
      }
    );
    return () => engine.cancel();
  }, [engine, query, options.excludePageId]);

  return { query, setQuery, results, status, errorMessage };
}
