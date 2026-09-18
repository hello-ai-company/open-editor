/**
 * Instance-scoped database interaction runtime (Phase 4F-3A / 4F-3B).
 *
 * EditorDocument stores databaseId/viewId/viewType only.
 * This store holds ephemeral query/rows/mutation/filter state — never persistence.
 *
 * Phase 4F-3B filters and propertySort are ephemeral interaction state,
 * not saved database view configuration.
 *
 * Invariants:
 * - Editor/preset instance scoped (no module globals)
 * - Query-key identity for reads (not databaseId alone)
 * - Concurrent identical listRows share one in-flight request
 * - Stale responses cannot overwrite newer generations
 * - Mutations refresh from host (provider is SoT); no opaque result parsing
 * - Reorder only when semantically safe (full position list, no query/filters/propertySort/trash)
 * - Structured filters / propertySort only when host advertises capabilities (fail-closed)
 * - propertySort XOR legacy sortBy — never both in listRows options
 */

import type {
  DatabaseFilter,
  DatabaseListOptions,
  DatabasePropertySort,
  DatabaseProvider,
  DatabaseRowItem,
  DatabaseRowsPage,
  EditorDatabase,
  JsonValue
} from "@hello-ai-company/editor-core";
import {
  cloneFilters,
  clonePropertySort,
  filtersEqual,
  propertySortEqual,
  resolveDatabasePropertyDefinitions,
  sanitizeFiltersAgainstMetadata,
  sanitizePropertySortAgainstMetadata,
  validateDatabaseFilters,
  validatePropertySort
} from "./databaseProperty.js";

export type DatabaseViewStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "error";

export type DatabaseMetaStatus =
  | "idle"
  | "loading"
  | "ready"
  | "missing"
  | "error"
  | "unavailable";

export type DatabaseTrashMode = "active" | "trash";

export type DatabaseSortBy = "position" | "title";
export type DatabaseSortDirection = "asc" | "desc";

export type DatabaseViewQueryState = {
  query: string;
  sortBy: DatabaseSortBy;
  direction: DatabaseSortDirection;
  trashMode: DatabaseTrashMode;
  pageSize: number;
  /** AND structured filters — ephemeral; default []. */
  filters: readonly DatabaseFilter[];
  /** Active property sort — mutually exclusive with legacy sort when set. */
  propertySort: DatabasePropertySort | null;
};

export type DatabaseMutationState = {
  kind:
    | "creating"
    | "updating"
    | "deleting"
    | "restoring"
    | "reordering"
    | "refreshing"
    | "loadingMore";
  rowKey?: string;
} | null;

export type DatabaseCapabilities = {
  list: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  restore: boolean;
  reorder: boolean;
  getDatabase: boolean;
};

export type DatabaseViewSnapshot = {
  viewKey: string;
  databaseId: string;
  status: DatabaseViewStatus;
  metaStatus: DatabaseMetaStatus;
  meta: EditorDatabase | null;
  items: DatabaseRowItem[];
  schema: Record<string, string>;
  queryState: DatabaseViewQueryState;
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
    total: number;
  };
  errorMessage?: string;
  loadMoreError?: string;
  mutationError?: string;
  /** Non-destructive notice when metadata invalidates active filters. */
  filterNotice?: string;
  mutating: DatabaseMutationState;
  capabilities: DatabaseCapabilities;
  canReorder: boolean;
  reorderDisabledReason?: string;
  generation: number;
  emptyReason?:
    | "no-rows"
    | "no-search-matches"
    | "no-filter-matches"
    | "trash-empty"
    | "provider-unavailable";
};

export type DatabaseRuntimeStoreOptions = {
  provider?: DatabaseProvider;
  defaultPageSize?: number;
};

export type DatabaseRuntimeStore = {
  /** Sync snapshot for a view instance. */
  getView: (viewKey: string) => DatabaseViewSnapshot;
  /** Ensure view state exists and kick initial load. */
  ensureView: (viewKey: string, databaseId: string) => void;
  load: (viewKey: string) => Promise<void>;
  refresh: (viewKey: string) => Promise<void>;
  loadMore: (viewKey: string) => Promise<void>;
  setQuery: (viewKey: string, query: string) => void;
  setSort: (
    viewKey: string,
    sortBy: DatabaseSortBy,
    direction: DatabaseSortDirection
  ) => void;
  /**
   * Apply validated AND filters. Clones input — caller-owned arrays are not retained.
   * Triggers the same first-page reload path as setQuery (generation bump, pagination clear).
   * @throws Error when filters fail validation against current metadata/capabilities
   */
  setFilters: (viewKey: string, filters: readonly DatabaseFilter[]) => void;
  /**
   * Apply property sort (or null to clear). Clears conflicting legacy-only claim in list options.
   * @throws Error when sort fails validation
   */
  setPropertySort: (
    viewKey: string,
    sort: DatabasePropertySort | null
  ) => void;
  setTrashMode: (viewKey: string, mode: DatabaseTrashMode) => void;
  createRow: (
    viewKey: string,
    row: Record<string, JsonValue>
  ) => Promise<void>;
  updateRow: (
    viewKey: string,
    rowKey: string,
    row: Record<string, JsonValue>,
    sortOrder?: number
  ) => Promise<void>;
  deleteRow: (viewKey: string, rowKey: string) => Promise<void>;
  restoreRow: (viewKey: string, rowKey: string) => Promise<void>;
  reorderRows: (viewKey: string, orderedRowKeys: string[]) => Promise<void>;
  moveRow: (
    viewKey: string,
    rowKey: string,
    direction: "up" | "down"
  ) => Promise<void>;
  subscribe: (listener: () => void) => () => void;
  getFetchCount: (queryKey?: string) => number;
  /** Test helper: build the deterministic query key. */
  buildQueryKey: (
    databaseId: string,
    state: DatabaseViewQueryState,
    cursor?: string | null
  ) => string;
};

type ViewInternal = {
  viewKey: string;
  databaseId: string;
  queryState: DatabaseViewQueryState;
  status: DatabaseViewStatus;
  metaStatus: DatabaseMetaStatus;
  meta: EditorDatabase | null;
  items: DatabaseRowItem[];
  schema: Record<string, string>;
  pagination: DatabaseViewSnapshot["pagination"];
  errorMessage?: string;
  loadMoreError?: string;
  mutationError?: string;
  filterNotice?: string;
  mutating: DatabaseMutationState;
  generation: number;
  /** Cursors already used for loadMore — prevent loops. */
  seenCursors: Set<string>;
  loadMoreInFlight: boolean;
  /** Cached snapshot reference for useSyncExternalStore. */
  cachedSnapshot: DatabaseViewSnapshot | null;
};

function defaultQueryState(pageSize: number): DatabaseViewQueryState {
  return {
    query: "",
    sortBy: "position",
    direction: "asc",
    trashMode: "active",
    pageSize,
    filters: [],
    propertySort: null
  };
}

function snapshotQueryState(
  state: DatabaseViewQueryState
): DatabaseViewQueryState {
  return {
    ...state,
    filters: cloneFilters(state.filters),
    propertySort: clonePropertySort(state.propertySort)
  };
}

function emptyPagination(
  limit: number
): DatabaseViewSnapshot["pagination"] {
  return { limit, nextCursor: null, hasMore: false, total: 0 };
}

/** Collision-safe opaque key from ordered parts (4F-3A R2). */
export function encodeDatabaseKeyParts(
  parts: readonly unknown[]
): string {
  return JSON.stringify(parts);
}

export function buildDatabaseQueryKey(
  databaseId: string,
  state: DatabaseViewQueryState,
  cursor?: string | null
): string {
  return encodeDatabaseKeyParts([
    databaseId,
    state.query.trim(),
    state.filters,
    state.propertySort,
    state.sortBy,
    state.direction,
    state.trashMode,
    state.pageSize,
    cursor ?? null
  ]);
}

/**
 * Map store query state → DatabaseListOptions.
 *
 * Precedence: when `propertySort != null`, send propertySort and omit legacy
 * sortBy/direction so the host never receives an ambiguous dual sort claim.
 * Structured filters are only attached when present (caller validates capability).
 */
export function listOptionsFromState(
  state: DatabaseViewQueryState,
  cursor?: string | null
): DatabaseListOptions {
  const opts: DatabaseListOptions = {
    limit: state.pageSize,
    query: state.query.trim() || undefined
  };
  if (state.propertySort) {
    opts.propertySort = { ...state.propertySort };
  } else {
    opts.sortBy = state.sortBy;
    opts.direction = state.direction;
  }
  if (state.filters.length > 0) {
    opts.filters = cloneFilters(state.filters);
  }
  if (cursor) opts.cursor = cursor;
  if (state.trashMode === "trash") {
    opts.trashedOnly = true;
  }
  return opts;
}

function capabilitiesFrom(provider?: DatabaseProvider): DatabaseCapabilities {
  return {
    list: typeof provider?.listRows === "function",
    create: typeof provider?.createRow === "function",
    update: typeof provider?.updateRow === "function",
    delete: typeof provider?.deleteRow === "function",
    restore: typeof provider?.restoreRow === "function",
    reorder: typeof provider?.reorderRows === "function",
    getDatabase: typeof provider?.getDatabase === "function"
  };
}

function reorderEligibility(
  view: ViewInternal,
  caps: DatabaseCapabilities
): { canReorder: boolean; reason?: string } {
  if (!caps.reorder) {
    return { canReorder: false, reason: "Host does not support reorder" };
  }
  if (view.queryState.query.trim()) {
    return { canReorder: false, reason: "Clear search to reorder" };
  }
  if (view.queryState.filters.length > 0) {
    return { canReorder: false, reason: "Clear filters to reorder" };
  }
  if (view.queryState.propertySort != null) {
    return { canReorder: false, reason: "Clear property sort to reorder" };
  }
  if (view.queryState.trashMode !== "active") {
    return { canReorder: false, reason: "Reorder unavailable in trash" };
  }
  if (view.queryState.sortBy !== "position") {
    return { canReorder: false, reason: "Sort by position to reorder" };
  }
  // 4F-3A R1: Move ↑↓ is only intuitive under position asc.
  if (view.queryState.direction !== "asc") {
    return {
      canReorder: false,
      reason: "Sort position ascending to reorder"
    };
  }
  if (view.pagination.hasMore) {
    return { canReorder: false, reason: "Load all rows before reordering" };
  }
  if (view.pagination.nextCursor != null) {
    return {
      canReorder: false,
      reason: "Load all rows before reordering"
    };
  }
  // Reject incomplete lists (host total vs loaded items mismatch / dedupe loss).
  // Fail-closed even when total === 0 but items are present (4F-3A R2).
  if (view.items.length !== view.pagination.total) {
    return {
      canReorder: false,
      reason: "Incomplete row set — cannot reorder partial data"
    };
  }
  return { canReorder: true };
}

function emptyReasonFor(
  view: ViewInternal,
  caps: DatabaseCapabilities
): DatabaseViewSnapshot["emptyReason"] {
  if (!caps.list) return "provider-unavailable";
  if (view.queryState.trashMode === "trash") return "trash-empty";
  if (view.queryState.filters.length > 0) return "no-filter-matches";
  if (view.queryState.query.trim()) return "no-search-matches";
  return "no-rows";
}

function toSnapshot(
  view: ViewInternal,
  caps: DatabaseCapabilities
): DatabaseViewSnapshot {
  const { canReorder, reason } = reorderEligibility(view, caps);
  return {
    viewKey: view.viewKey,
    databaseId: view.databaseId,
    status: view.status,
    metaStatus: view.metaStatus,
    meta: view.meta,
    items: view.items,
    schema: view.schema,
    queryState: snapshotQueryState(view.queryState),
    pagination: { ...view.pagination },
    errorMessage: view.errorMessage,
    loadMoreError: view.loadMoreError,
    mutationError: view.mutationError,
    filterNotice: view.filterNotice,
    mutating: view.mutating,
    capabilities: caps,
    canReorder,
    reorderDisabledReason: reason,
    generation: view.generation,
    emptyReason:
      view.status === "empty" ? emptyReasonFor(view, caps) : undefined
  };
}

function dedupeItems(items: DatabaseRowItem[]): DatabaseRowItem[] {
  const seen = new Set<string>();
  const out: DatabaseRowItem[] = [];
  for (const item of items) {
    if (seen.has(item.rowKey)) continue;
    seen.add(item.rowKey);
    out.push(item);
  }
  return out;
}

/**
 * Create an ephemeral, instance-scoped database interaction store.
 */
export function createDatabaseRuntimeStore(
  options: DatabaseRuntimeStoreOptions = {}
): DatabaseRuntimeStore {
  const pageSize = options.defaultPageSize ?? 20;
  const provider = options.provider;
  const views = new Map<string, ViewInternal>();
  const listeners = new Set<() => void>();
  /** In-flight listRows by full query key (includes cursor). */
  const inflight = new Map<string, Promise<DatabaseRowsPage>>();
  const fetchCountByKey = new Map<string, number>();
  /** Idle snapshots are store-instance scoped — never module-global (4F-3A R2). */
  const idleSnapshots = new Map<string, DatabaseViewSnapshot>();
  let totalFetches = 0;

  function caps(): DatabaseCapabilities {
    return capabilitiesFrom(provider);
  }

  function idleSnapshot(
    viewKey: string
  ): DatabaseViewSnapshot {
    const currentCaps = caps();
    const cacheKey = encodeDatabaseKeyParts([
      viewKey,
      pageSize,
      currentCaps.list,
      currentCaps.create,
      currentCaps.update,
      currentCaps.delete,
      currentCaps.restore,
      currentCaps.reorder,
      currentCaps.getDatabase
    ]);
    const hit = idleSnapshots.get(cacheKey);
    if (hit) return hit;
    const snap: DatabaseViewSnapshot = {
      viewKey,
      databaseId: "",
      status: "idle",
      metaStatus: "idle",
      meta: null,
      items: [],
      schema: {},
      queryState: defaultQueryState(pageSize),
      pagination: emptyPagination(pageSize),
      mutating: null,
      capabilities: currentCaps,
      canReorder: false,
      reorderDisabledReason: "View not loaded",
      generation: 0
    };
    idleSnapshots.set(cacheKey, snap);
    return snap;
  }

  function notify(): void {
    // Invalidate cached snapshots before notifying subscribers
    for (const view of views.values()) {
      view.cachedSnapshot = null;
    }
    for (const listener of listeners) listener();
  }

  function getOrCreate(viewKey: string, databaseId: string): ViewInternal {
    let view = views.get(viewKey);
    if (!view) {
      view = {
        viewKey,
        databaseId,
        queryState: defaultQueryState(pageSize),
        status: "idle",
        metaStatus: "idle",
        meta: null,
        items: [],
        schema: {},
        pagination: emptyPagination(pageSize),
        mutating: null,
        generation: 0,
        seenCursors: new Set(),
        loadMoreInFlight: false,
        cachedSnapshot: null
      };
      views.set(viewKey, view);
    } else if (view.databaseId !== databaseId) {
      view.databaseId = databaseId;
      view.items = [];
      view.schema = {};
      view.pagination = emptyPagination(pageSize);
      view.status = "idle";
      view.meta = null;
      view.metaStatus = "idle";
      view.generation += 1;
      view.seenCursors.clear();
      view.cachedSnapshot = null;
    }
    return view;
  }

  function requireView(viewKey: string): ViewInternal {
    const view = views.get(viewKey);
    if (!view) {
      throw new Error(`Unknown database view: ${viewKey}`);
    }
    return view;
  }

  async function fetchPage(
    databaseId: string,
    state: DatabaseViewQueryState,
    cursor?: string | null
  ): Promise<DatabaseRowsPage> {
    const listRows = provider?.listRows;
    if (!listRows) {
      throw new Error("Database provider unavailable");
    }
    const key = buildDatabaseQueryKey(databaseId, state, cursor);
    const pending = inflight.get(key);
    if (pending) return pending;

    const work = (async () => {
      totalFetches += 1;
      fetchCountByKey.set(key, (fetchCountByKey.get(key) ?? 0) + 1);
      return listRows(databaseId, listOptionsFromState(state, cursor));
    })();

    inflight.set(key, work);
    try {
      return await work;
    } finally {
      if (inflight.get(key) === work) inflight.delete(key);
    }
  }

  async function loadMeta(view: ViewInternal, gen: number): Promise<void> {
    if (!provider?.getDatabase) {
      view.metaStatus = "unavailable";
      notify();
      return;
    }
    view.metaStatus = "loading";
    notify();
    try {
      const meta = await provider.getDatabase(view.databaseId);
      if (view.generation !== gen) return;
      if (!meta) {
        view.meta = null;
        view.metaStatus = "missing";
      } else {
        view.meta = meta;
        view.metaStatus = "ready";
        // Metadata refresh may invalidate active filters / propertySort.
        const defs = resolveDatabasePropertyDefinitions({
          legacySchema: view.schema,
          definitions: meta.propertyDefinitions
        });
        const caps = meta.queryCapabilities;
        const sanitized = sanitizeFiltersAgainstMetadata(
          view.queryState.filters,
          defs,
          caps
        );
        const nextSort = sanitizePropertySortAgainstMetadata(
          view.queryState.propertySort,
          defs,
          caps
        );
        const filtersChanged = !filtersEqual(
          view.queryState.filters,
          sanitized.filters
        );
        const sortChanged = !propertySortEqual(
          view.queryState.propertySort,
          nextSort
        );
        if (filtersChanged || sortChanged) {
          view.queryState = {
            ...view.queryState,
            filters: cloneFilters(sanitized.filters),
            propertySort: clonePropertySort(nextSort)
          };
          if (sanitized.removed.length > 0) {
            view.filterNotice =
              "Some filters were cleared because property metadata changed";
          } else if (sortChanged && view.queryState.propertySort === null) {
            view.filterNotice =
              "Property sort cleared because property metadata changed";
          }
          // Reload authoritative rows with sanitized query (same safe path).
          void loadFirstPage(view);
          return;
        }
      }
      notify();
    } catch {
      if (view.generation !== gen) return;
      view.metaStatus = "error";
      notify();
    }
  }

  async function loadFirstPage(view: ViewInternal): Promise<void> {
    const gen = ++view.generation;
    view.status = "loading";
    view.errorMessage = undefined;
    view.loadMoreError = undefined;
    view.mutationError = undefined;
    view.seenCursors.clear();
    view.loadMoreInFlight = false;
    // Invalidate prior pagination so Load more cannot use a stale cursor (R3).
    view.pagination = emptyPagination(view.queryState.pageSize);
    // Only supersede read/refresh busy — never clear in-flight writes (R3).
    const kind = view.mutating?.kind;
    if (kind === "loadingMore" || kind === "refreshing") {
      view.mutating = null;
    }
    notify();

    void loadMeta(view, gen);

    if (!provider?.listRows) {
      view.status = "empty";
      notify();
      return;
    }

    try {
      const page = await fetchPage(view.databaseId, view.queryState, null);
      if (view.generation !== gen) return;
      view.items = dedupeItems(page.items);
      view.schema = page.schema ?? {};
      view.pagination = {
        limit: page.pagination.limit,
        nextCursor: page.pagination.nextCursor,
        hasMore: page.pagination.hasMore,
        total: page.pagination.total
      };
      view.status = view.items.length === 0 ? "empty" : "ready";
      notify();
    } catch (err) {
      if (view.generation !== gen) return;
      view.status = "error";
      view.errorMessage =
        err instanceof Error ? err.message : "Failed to load rows";
      notify();
    }
  }

  async function refreshAfterMutation(view: ViewInternal): Promise<void> {
    const gen = ++view.generation;
    view.mutating = { kind: "refreshing" };
    view.seenCursors.clear();
    notify();
    try {
      const page = await fetchPage(view.databaseId, view.queryState, null);
      if (view.generation !== gen) return;
      view.items = dedupeItems(page.items);
      view.schema = page.schema ?? {};
      view.pagination = {
        limit: page.pagination.limit,
        nextCursor: page.pagination.nextCursor,
        hasMore: page.pagination.hasMore,
        total: page.pagination.total
      };
      view.status = view.items.length === 0 ? "empty" : "ready";
      view.mutating = null;
      notify();
    } catch (err) {
      if (view.generation !== gen) return;
      view.mutating = null;
      view.mutationError =
        err instanceof Error ? err.message : "Failed to refresh";
      notify();
    }
  }

  function assertCanStartWrite(view: ViewInternal): void {
    if (view.status === "loading") {
      throw new Error("View is loading");
    }
    const kind = view.mutating?.kind;
    if (
      kind === "creating" ||
      kind === "updating" ||
      kind === "deleting" ||
      kind === "restoring" ||
      kind === "reordering"
    ) {
      throw new Error("Another mutation is in progress");
    }
  }

  return {
    buildQueryKey: buildDatabaseQueryKey,

    getView(viewKey) {
      const view = views.get(viewKey);
      if (!view) {
        return idleSnapshot(viewKey);
      }
      if (!view.cachedSnapshot) {
        view.cachedSnapshot = toSnapshot(view, caps());
      }
      return view.cachedSnapshot;
    },

    ensureView(viewKey, databaseId) {
      const view = getOrCreate(viewKey, databaseId);
      if (view.status === "idle") {
        void loadFirstPage(view);
      }
    },

    async load(viewKey) {
      const view = requireView(viewKey);
      await loadFirstPage(view);
    },

    async refresh(viewKey) {
      const view = requireView(viewKey);
      await loadFirstPage(view);
    },

    async loadMore(viewKey) {
      const view = requireView(viewKey);
      // Fail-closed while first-page reload is in flight (stale cursor risk).
      if (view.status === "loading") return;
      if (!view.pagination.hasMore || !view.pagination.nextCursor) return;
      if (view.loadMoreInFlight) return;
      if (view.mutating && view.mutating.kind !== "loadingMore") return;

      const cursor = view.pagination.nextCursor;
      if (view.seenCursors.has(cursor)) {
        // Faulty host repeating the same cursor — stop looping
        view.pagination = { ...view.pagination, hasMore: false };
        view.loadMoreError = "Pagination cursor did not advance";
        notify();
        return;
      }

      const gen = view.generation;
      view.loadMoreInFlight = true;
      view.mutating = { kind: "loadingMore" };
      view.loadMoreError = undefined;
      view.seenCursors.add(cursor);
      notify();

      try {
        const page = await fetchPage(
          view.databaseId,
          view.queryState,
          cursor
        );
        if (view.generation !== gen) return;
        view.items = dedupeItems([...view.items, ...page.items]);
        view.schema = page.schema ?? view.schema;
        const nextCursor = page.pagination.nextCursor;
        // If host returns the same cursor again with hasMore, disable further loads
        const stuck =
          page.pagination.hasMore &&
          nextCursor !== null &&
          nextCursor === cursor;
        view.pagination = {
          limit: page.pagination.limit,
          nextCursor: stuck ? null : nextCursor,
          hasMore: stuck ? false : page.pagination.hasMore,
          total: page.pagination.total
        };
        if (stuck) {
          view.loadMoreError = "Pagination cursor did not advance";
        }
        view.status = view.items.length === 0 ? "empty" : "ready";
      } catch (err) {
        if (view.generation !== gen) return;
        view.loadMoreError =
          err instanceof Error ? err.message : "Failed to load more";
      } finally {
        if (view.generation === gen) {
          view.loadMoreInFlight = false;
          view.mutating = null;
          notify();
        }
      }
    },

    setQuery(viewKey, query) {
      const view = requireView(viewKey);
      if (view.queryState.query === query) return;
      view.queryState = { ...view.queryState, query };
      void loadFirstPage(view);
    },

    setSort(viewKey, sortBy, direction) {
      const view = requireView(viewKey);
      if (
        view.queryState.sortBy === sortBy &&
        view.queryState.direction === direction &&
        view.queryState.propertySort === null
      ) {
        return;
      }
      // Legacy sort clears propertySort so options stay unambiguous.
      view.queryState = {
        ...view.queryState,
        sortBy,
        direction,
        propertySort: null
      };
      void loadFirstPage(view);
    },

    setFilters(viewKey, filters) {
      const view = requireView(viewKey);
      const defs = resolveDatabasePropertyDefinitions({
        legacySchema: view.schema,
        definitions: view.meta?.propertyDefinitions
      });
      const validated = validateDatabaseFilters(
        filters,
        defs,
        view.meta?.queryCapabilities
      );
      if (!validated.ok) {
        throw new Error(validated.error);
      }
      const next = cloneFilters(validated.filters);
      if (filtersEqual(view.queryState.filters, next)) return;
      view.queryState = { ...view.queryState, filters: next };
      view.filterNotice = undefined;
      void loadFirstPage(view);
    },

    setPropertySort(viewKey, sort) {
      const view = requireView(viewKey);
      if (sort === null) {
        if (view.queryState.propertySort === null) return;
        view.queryState = { ...view.queryState, propertySort: null };
        view.filterNotice = undefined;
        void loadFirstPage(view);
        return;
      }
      const defs = resolveDatabasePropertyDefinitions({
        legacySchema: view.schema,
        definitions: view.meta?.propertyDefinitions
      });
      const validated = validatePropertySort(
        sort,
        defs,
        view.meta?.queryCapabilities
      );
      if (!validated.ok) {
        throw new Error(validated.error);
      }
      const next = clonePropertySort(validated.sort);
      if (propertySortEqual(view.queryState.propertySort, next)) return;
      view.queryState = { ...view.queryState, propertySort: next };
      view.filterNotice = undefined;
      void loadFirstPage(view);
    },

    setTrashMode(viewKey, mode) {
      const view = requireView(viewKey);
      if (view.queryState.trashMode === mode) return;
      view.queryState = { ...view.queryState, trashMode: mode };
      void loadFirstPage(view);
    },

    async createRow(viewKey, row) {
      const view = requireView(viewKey);
      if (!provider?.createRow) {
        throw new Error("Create not supported");
      }
      assertCanStartWrite(view);
      view.mutating = { kind: "creating" };
      view.mutationError = undefined;
      notify();
      try {
        await provider.createRow(view.databaseId, row);
        await refreshAfterMutation(view);
      } catch (err) {
        view.mutating = null;
        view.mutationError =
          err instanceof Error ? err.message : "Failed to create row";
        notify();
        throw err;
      }
    },

    async updateRow(viewKey, rowKey, row, sortOrder) {
      const view = requireView(viewKey);
      if (!provider?.updateRow) {
        throw new Error("Update not supported");
      }
      assertCanStartWrite(view);
      view.mutating = { kind: "updating", rowKey };
      view.mutationError = undefined;
      notify();
      try {
        await provider.updateRow(view.databaseId, rowKey, row, sortOrder);
        await refreshAfterMutation(view);
      } catch (err) {
        view.mutating = null;
        view.mutationError =
          err instanceof Error ? err.message : "Failed to update row";
        notify();
        throw err;
      }
    },

    async deleteRow(viewKey, rowKey) {
      const view = requireView(viewKey);
      if (!provider?.deleteRow) {
        throw new Error("Delete not supported");
      }
      assertCanStartWrite(view);
      view.mutating = { kind: "deleting", rowKey };
      view.mutationError = undefined;
      notify();
      try {
        await provider.deleteRow(view.databaseId, rowKey);
        await refreshAfterMutation(view);
      } catch (err) {
        view.mutating = null;
        view.mutationError =
          err instanceof Error ? err.message : "Failed to delete row";
        notify();
        throw err;
      }
    },

    async restoreRow(viewKey, rowKey) {
      const view = requireView(viewKey);
      if (!provider?.restoreRow) {
        throw new Error("Restore not supported");
      }
      assertCanStartWrite(view);
      view.mutating = { kind: "restoring", rowKey };
      view.mutationError = undefined;
      notify();
      try {
        await provider.restoreRow(view.databaseId, rowKey);
        await refreshAfterMutation(view);
      } catch (err) {
        view.mutating = null;
        view.mutationError =
          err instanceof Error ? err.message : "Failed to restore row";
        notify();
        throw err;
      }
    },

    async reorderRows(viewKey, orderedRowKeys) {
      const view = requireView(viewKey);
      const eligibility = reorderEligibility(view, caps());
      if (!eligibility.canReorder || !provider?.reorderRows) {
        throw new Error(eligibility.reason ?? "Reorder not available");
      }
      assertCanStartWrite(view);
      view.mutating = { kind: "reordering" };
      view.mutationError = undefined;
      notify();
      try {
        await provider.reorderRows(view.databaseId, orderedRowKeys);
        await refreshAfterMutation(view);
      } catch (err) {
        view.mutating = null;
        view.mutationError =
          err instanceof Error ? err.message : "Failed to reorder";
        notify();
        throw err;
      }
    },

    async moveRow(viewKey, rowKey, direction) {
      const view = requireView(viewKey);
      const index = view.items.findIndex((item) => item.rowKey === rowKey);
      if (index < 0) return;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= view.items.length) return;
      const keys = view.items.map((item) => item.rowKey);
      const tmp = keys[index]!;
      keys[index] = keys[target]!;
      keys[target] = tmp;

      const eligibility = reorderEligibility(view, caps());
      if (!eligibility.canReorder || !provider?.reorderRows) {
        throw new Error(eligibility.reason ?? "Reorder not available");
      }
      assertCanStartWrite(view);
      view.mutating = { kind: "reordering" };
      view.mutationError = undefined;
      notify();
      try {
        await provider.reorderRows(view.databaseId, keys);
        await refreshAfterMutation(view);
      } catch (err) {
        view.mutating = null;
        view.mutationError =
          err instanceof Error ? err.message : "Failed to reorder";
        notify();
        throw err;
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getFetchCount(queryKey) {
      if (queryKey) return fetchCountByKey.get(queryKey) ?? 0;
      return totalFetches;
    }
  };
}

/**
 * Database + view identity (not a block instance key).
 * Prefer {@link databaseViewInstanceKey} for ephemeral UI state.
 * Encoded collision-safe for opaque host IDs (4F-3A R2).
 */
export function databaseViewKey(
  databaseId: string,
  viewId: string
): string {
  return encodeDatabaseKeyParts([databaseId, viewId || "main"]);
}

/**
 * Ephemeral interaction identity for one databaseView block instance.
 * Same databaseId+viewId in two blocks must not share query/sort/trash/pagination UI state.
 * Network read dedupe remains query-scoped via {@link buildDatabaseQueryKey}.
 */
export function databaseViewInstanceKey(
  blockId: string,
  databaseId: string,
  viewId: string
): string {
  const safeBlock = blockId.trim() || "anonymous";
  return encodeDatabaseKeyParts([safeBlock, databaseId, viewId || "main"]);
}

export function createDatabaseViewRuntimeFromStore(
  store: DatabaseRuntimeStore,
  provider?: DatabaseProvider
): {
  database?: DatabaseProvider;
  store: DatabaseRuntimeStore;
} {
  return {
    database: provider,
    store
  };
}
