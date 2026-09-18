/**
 * Database view block — interactive table / board / calendar / list / gallery (Phase 4F-3A–4F-4B).
 * Document stores identity/view config only; rows come from DatabaseRuntimeStore.
 * 4F-3B: typed property editors, structured filters, and property sort UX.
 * 4F-4A: Board + Calendar renderers via shared shell + renderer dispatch.
 * 4F-4B: List + Gallery renderers (read-only presentation).
 */
import { createReactBlockSpec } from "@blocknote/react";
import type {
  DatabaseFilter,
  DatabasePropertyType,
  DatabaseRowItem,
  JsonValue
} from "@hello-ai-company/editor-core";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement
} from "react";
import { renderBoardView } from "./databaseBoardRenderer.js";
import { renderCalendarView } from "./databaseCalendarRenderer.js";
import { renderGalleryView } from "./databaseGalleryRenderer.js";
import { renderListView } from "./databaseListRenderer.js";
import { renderGanttView } from "./databaseGanttRenderer.js";
import { renderTimelineView } from "./databaseTimelineRenderer.js";
import { catchStoreMutation } from "./databaseMutationUtils.js";
import {
  databaseViewInstanceKey,
  type DatabaseRuntimeStore,
  type DatabaseSortBy,
  type DatabaseSortDirection,
  type DatabaseViewSnapshot
} from "./databaseRuntimeStore.js";
import {
  buildCreateRowPayload,
  buildTypedCreateRowPayload,
  creatablePropertyIds,
  filtersEqual,
  formatDatabaseCellDisplay,
  formatSelectDisplay,
  hasExplicitPropertyDefinitions,
  hostSupportsPropertyFilters,
  hostSupportsPropertySort,
  isCreatableResolvedProperty,
  isEditableResolvedProperty,
  isFilterablePropertyType,
  isIsoDateString,
  metadataAllowsRowMutations,
  parseEditedCellValue,
  parseNumberDraft,
  propertyDefinitionMap,
  resolveDatabasePropertyDefinitions,
  valuesEqualForEdit,
  type ResolvedPropertyDefinition
} from "./databaseProperty.js";
import {
  isDeferredDatabaseViewType,
  resolveDatabaseViewRenderer,
  type DatabaseViewRendererContext,
  type DatabaseViewRendererMap
} from "./databaseViewRenderers.js";
import type { DatabaseViewRuntime } from "./databaseViewRuntime.js";
import {
  DATABASE_VIEW_TYPE,
  DATABASE_VIEW_TYPES,
  isDatabaseViewType,
  type DatabaseViewType
} from "./types.js";

export type { DatabaseViewRuntime } from "./databaseViewRuntime.js";
export type {
  DatabaseRowOpenRequest,
  DatabaseViewRenderer,
  DatabaseViewRendererContext,
  DatabaseViewRendererMap
} from "./databaseViewRenderers.js";
export { catchStoreMutation } from "./databaseMutationUtils.js";

function DeferredRenderer(ctx: DatabaseViewRendererContext): ReactElement {
  return (
    <p className="oe-database-view__empty" role="status">
      Interactive {ctx.viewType} renderer is deferred. Table, Board, Calendar,
      List, Gallery, Timeline, and Gantt engines are available for those
      viewType values.
    </p>
  );
}

const DEFAULT_RENDERERS: DatabaseViewRendererMap = {
  board: renderBoardView,
  calendar: renderCalendarView,
  list: renderListView,
  gallery: renderGalleryView,
  timeline: renderTimelineView,
  gantt: renderGanttView
};

function emptyMessage(snap: DatabaseViewSnapshot): string {
  switch (snap.emptyReason) {
    case "provider-unavailable":
      return "Database provider unavailable";
    case "no-search-matches":
      return "No rows match this search";
    case "no-filter-matches":
      return "No rows match these filters";
    case "trash-empty":
      return "Trash is empty";
    case "no-rows":
    default:
      return "No rows yet";
  }
}

type FilterDraft = {
  id: string;
  propertyId: string;
  operator: string;
  value: string;
};

type DatabaseViewBlock = {
  id?: string;
  props: {
    databaseId: string;
    viewId: string;
    viewType: string;
    titleHint: string;
  };
};

let filterDraftSeq = 0;

function nextFilterDraftId(): string {
  filterDraftSeq += 1;
  return `fd-${filterDraftSeq}`;
}

/**
 * Collision-safe select value for property sorts (4F-3B R1).
 * Property IDs are host-owned opaque strings and may contain ":".
 */
export function encodePropertySortSelectValue(
  propertyId: string,
  direction: "asc" | "desc"
): string {
  return JSON.stringify({
    kind: "property",
    propertyId,
    direction
  });
}

export type ParsedSortSelectValue =
  | {
      kind: "property";
      propertyId: string;
      direction: "asc" | "desc";
    }
  | {
      kind: "legacy";
      sortBy: DatabaseSortBy;
      direction: DatabaseSortDirection;
    };

/**
 * Parse toolbar sort &lt;select&gt; values.
 * Property sorts use JSON; legacy position/title keep `sortBy:direction`.
 */
export function parseSortSelectValue(
  raw: string
): ParsedSortSelectValue | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        "kind" in parsed &&
        (parsed as { kind: unknown }).kind === "property" &&
        "propertyId" in parsed &&
        typeof (parsed as { propertyId: unknown }).propertyId === "string" &&
        "direction" in parsed &&
        ((parsed as { direction: unknown }).direction === "asc" ||
          (parsed as { direction: unknown }).direction === "desc")
      ) {
        return {
          kind: "property",
          propertyId: (parsed as { propertyId: string }).propertyId,
          direction: (parsed as { direction: "asc" | "desc" }).direction
        };
      }
    } catch {
      return null;
    }
    return null;
  }
  const [sortBy, direction] = trimmed.split(":");
  if (
    (sortBy === "position" || sortBy === "title") &&
    (direction === "asc" || direction === "desc")
  ) {
    return { kind: "legacy", sortBy, direction };
  }
  return null;
}

/**
 * Choose createRow payload (4F-3B R1 / R2).
 * When explicit typed metadata is present (`propertyDefinitions != null`, including `[]`),
 * never fall back to the legacy schema builder — even if the typed payload is empty.
 */
export function resolveCreateRowPayload(input: {
  hasTypedDefinitions: boolean;
  typedResult:
    | Record<string, string | number | boolean>
    | { error: string };
  legacySchema: Record<string, string>;
  draft: Record<string, string>;
}): Record<string, string | number | boolean> | { error: string } {
  if ("error" in input.typedResult && typeof input.typedResult.error === "string") {
    return { error: input.typedResult.error };
  }
  const typedPayload = input.typedResult as Record<
    string,
    string | number | boolean
  >;
  if (input.hasTypedDefinitions) {
    return typedPayload;
  }
  if (Object.keys(typedPayload).length > 0) {
    return typedPayload;
  }
  return buildCreateRowPayload(input.legacySchema, input.draft);
}

function operatorsForType(type: DatabasePropertyType): string[] {
  switch (type) {
    case "text":
    case "url":
      return ["contains", "equals", "notEquals", "isEmpty", "isNotEmpty"];
    case "number":
      return ["equals", "gt", "gte", "lt", "lte", "isEmpty", "isNotEmpty"];
    case "boolean":
      return ["is", "isEmpty", "isNotEmpty"];
    case "date":
      return ["on", "before", "after", "isEmpty", "isNotEmpty"];
    case "select":
    case "status":
      return ["equals", "notEquals", "isEmpty", "isNotEmpty"];
    default:
      return ["isEmpty", "isNotEmpty"];
  }
}

function operatorHidesValue(operator: string): boolean {
  return operator === "isEmpty" || operator === "isNotEmpty";
}

function filterToDraft(filter: DatabaseFilter): FilterDraft {
  const value =
    "value" in filter
      ? typeof filter.value === "boolean"
        ? filter.value
          ? "true"
          : "false"
        : String(filter.value)
      : "";
  return {
    id: nextFilterDraftId(),
    propertyId: filter.propertyId,
    operator: filter.operator,
    value
  };
}

function filtersToDrafts(filters: readonly DatabaseFilter[]): FilterDraft[] {
  return filters.map(filterToDraft);
}

function buildFilterFromDraft(
  draft: FilterDraft,
  def: ResolvedPropertyDefinition
): { ok: true; filter: DatabaseFilter } | { ok: false; error: string } {
  if (!isFilterablePropertyType(def.type)) {
    return {
      ok: false,
      error: `Property type ${def.type} is not filterable`
    };
  }

  const propertyType = def.type;
  const operator = draft.operator;
  const allowed = operatorsForType(propertyType);
  if (!allowed.includes(operator)) {
    return {
      ok: false,
      error: `Invalid operator "${operator}" for ${def.name}`
    };
  }

  if (operator === "isEmpty" || operator === "isNotEmpty") {
    if (propertyType === "unknown") {
      return { ok: false, error: `Property type unknown is not filterable` };
    }
    return {
      ok: true,
      filter: {
        propertyId: def.id,
        propertyType,
        operator
      }
    };
  }

  if (propertyType === "text" || propertyType === "url") {
    return {
      ok: true,
      filter: {
        propertyId: def.id,
        propertyType,
        operator: operator as "contains" | "equals" | "notEquals",
        value: draft.value
      }
    };
  }

  if (propertyType === "number") {
    const n = parseNumberDraft(draft.value);
    if (n === null) {
      return { ok: false, error: `Invalid number for ${def.name}` };
    }
    return {
      ok: true,
      filter: {
        propertyId: def.id,
        propertyType: "number",
        operator: operator as "equals" | "gt" | "gte" | "lt" | "lte",
        value: n
      }
    };
  }

  if (propertyType === "boolean") {
    const lower = draft.value.trim().toLowerCase();
    const value = lower === "true" || lower === "1" || lower === "yes";
    return {
      ok: true,
      filter: {
        propertyId: def.id,
        propertyType: "boolean",
        operator: "is",
        value
      }
    };
  }

  if (propertyType === "date") {
    if (!isIsoDateString(draft.value)) {
      return { ok: false, error: `Invalid date for ${def.name}` };
    }
    return {
      ok: true,
      filter: {
        propertyId: def.id,
        propertyType: "date",
        operator: operator as "on" | "before" | "after",
        value: draft.value
      }
    };
  }

  if (propertyType === "select" || propertyType === "status") {
    if (!draft.value) {
      return { ok: false, error: `Select a value for ${def.name}` };
    }
    if (
      def.options.length > 0 &&
      !def.options.some((o) => o.value === draft.value)
    ) {
      return {
        ok: false,
        error: `Option "${draft.value}" is not allowed for ${def.name}`
      };
    }
    return {
      ok: true,
      filter: {
        propertyId: def.id,
        propertyType,
        operator: operator as "equals" | "notEquals",
        value: draft.value
      }
    };
  }

  return { ok: false, error: `Unsupported filter for ${def.name}` };
}

function cellDisplayText(
  def: ResolvedPropertyDefinition,
  value: unknown
): string {
  if (def.type === "select" || def.type === "status") {
    return formatSelectDisplay(value, def.options);
  }
  return formatDatabaseCellDisplay(value, def.type);
}

function defaultOperatorForType(type: DatabasePropertyType): string {
  return operatorsForType(type)[0] ?? "isEmpty";
}

function newEmptyFilterDraft(
  filterable: readonly ResolvedPropertyDefinition[]
): FilterDraft {
  const first = filterable[0];
  return {
    id: nextFilterDraftId(),
    propertyId: first?.id ?? "",
    operator: first ? defaultOperatorForType(first.type) : "contains",
    value: ""
  };
}

/**
 * Router — no hooks here so store presence can change without Rules-of-Hooks issues.
 */
function DatabaseTableView(props: {
  runtime: DatabaseViewRuntime;
  block: DatabaseViewBlock;
}): ReactElement {
  const { runtime, block } = props;
  if (runtime.store) {
    return <StoreBackedDatabaseView runtime={runtime} block={block} />;
  }
  return (
    <LegacyDatabaseView
      runtime={runtime}
      databaseId={block.props.databaseId}
      viewId={block.props.viewId}
      viewType={block.props.viewType}
      titleHint={block.props.titleHint}
    />
  );
}

function StoreBackedDatabaseView(props: {
  runtime: DatabaseViewRuntime;
  block: DatabaseViewBlock;
}): ReactElement {
  const { runtime, block } = props;
  const { databaseId, viewId, viewType, titleHint } = block.props;
  const store = runtime.store!;
  const viewKey = databaseViewInstanceKey(
    block.id ?? "",
    databaseId,
    viewId
  );

  useEffect(() => {
    if (databaseId) store.ensureView(viewKey, databaseId);
  }, [store, viewKey, databaseId]);

  const snap = useSyncExternalStore(
    store.subscribe,
    () => store.getView(viewKey),
    () => store.getView(viewKey)
  );

  return (
    <SharedDatabaseViewShell
      snap={snap}
      store={store}
      viewKey={viewKey}
      viewId={viewId}
      viewType={viewType}
      titleHint={titleHint}
      runtime={runtime}
    />
  );
}

function SharedDatabaseViewShell(props: {
  snap: DatabaseViewSnapshot;
  store: DatabaseRuntimeStore;
  viewKey: string;
  viewId: string;
  viewType: string;
  titleHint: string;
  runtime: DatabaseViewRuntime;
}): ReactElement {
  const { snap, store, viewKey, viewId, viewType, titleHint, runtime } = props;
  const getTitle = runtime.getTitle;
  const [searchInput, setSearchInput] = useState(snap.queryState.query);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    rowKey: string;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [filterDrafts, setFilterDrafts] = useState<FilterDraft[]>(() =>
    filtersToDrafts(snap.queryState.filters)
  );
  const [filterError, setFilterError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appliedFiltersRef = useRef(snap.queryState.filters);
  const baseId = useId();

  const resolved = resolveDatabasePropertyDefinitions({
    legacySchema: snap.schema,
    definitions: snap.meta?.propertyDefinitions
  });
  const defMap = propertyDefinitionMap(resolved);
  const createIds = creatablePropertyIds(resolved);
  const mutationsAllowed = metadataAllowsRowMutations({
    getDatabase: snap.capabilities.getDatabase,
    metaStatus: snap.metaStatus
  });
  const filterableDefs = resolved.filter((d) =>
    isFilterablePropertyType(d.type)
  );
  const supportsFilters = hostSupportsPropertyFilters(
    snap.meta?.queryCapabilities
  );
  const supportsPropertySort = hostSupportsPropertySort(
    snap.meta?.queryCapabilities
  );
  const sortablePropertyDefs = resolved.filter((d) => d.type !== "unknown");

  useEffect(() => {
    setSearchInput(snap.queryState.query);
  }, [snap.queryState.query]);

  useEffect(() => {
    if (filtersEqual(appliedFiltersRef.current, snap.queryState.filters)) {
      return;
    }
    appliedFiltersRef.current = snap.queryState.filters;
    setFilterDrafts(filtersToDrafts(snap.queryState.filters));
    setFilterError(null);
  }, [snap.queryState.filters]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!mutationsAllowed) {
      setCreating(false);
      setEditing(null);
      setEditValue("");
    }
  }, [mutationsAllowed]);

  const title =
    snap.meta?.title ||
    getTitle?.(snap.databaseId) ||
    titleHint ||
    snap.databaseId ||
    "Database";

  // First-page reload keeps prior rows visible, but must block Load more / writes.
  const busy = Boolean(snap.mutating) || snap.status === "loading";

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      store.setQuery(viewKey, value);
    }, 200);
  };

  const startEdit = (item: DatabaseRowItem, def: ResolvedPropertyDefinition) => {
    if (!mutationsAllowed) return;
    if (!snap.capabilities.update) return;
    if (!isEditableResolvedProperty(def)) return;
    if (def.type === "boolean" || def.type === "select" || def.type === "status") {
      return;
    }
    setEditing({ rowKey: item.rowKey, field: def.id });
    setEditValue(String(item.row[def.id] ?? ""));
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue("");
  };

  const commitEdit = async () => {
    if (!editing || !mutationsAllowed) return;
    const item = snap.items.find((row) => row.rowKey === editing.rowKey);
    const def = defMap.get(editing.field);
    if (!item || !def || !isEditableResolvedProperty(def)) {
      cancelEdit();
      return;
    }

    let nextValue: string | number | boolean | undefined;
    if (def.type === "number") {
      const n = parseNumberDraft(editValue);
      if (n === null) return;
      nextValue = n;
    } else if (def.type === "date") {
      if (editValue !== "" && !isIsoDateString(editValue)) return;
      nextValue = editValue;
    } else {
      nextValue = parseEditedCellValue(editValue, def.type);
      if (nextValue === undefined) return;
    }

    if (valuesEqualForEdit(item.row[editing.field], nextValue)) {
      cancelEdit();
      return;
    }
    const completeRow: Record<string, JsonValue> = {
      ...item.row,
      [editing.field]: nextValue
    };
    const rowKey = editing.rowKey;
    cancelEdit();
    try {
      await store.updateRow(viewKey, rowKey, completeRow, item.sortOrder);
    } catch {
      // mutationError on snapshot
    }
  };

  const onEditKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitEdit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  };

  const updateBooleanCell = (
    item: DatabaseRowItem,
    def: ResolvedPropertyDefinition,
    checked: boolean
  ) => {
    if (!mutationsAllowed || !isEditableResolvedProperty(def)) return;
    const completeRow: Record<string, JsonValue> = {
      ...item.row,
      [def.id]: checked
    };
    catchStoreMutation(
      store.updateRow(viewKey, item.rowKey, completeRow, item.sortOrder)
    );
  };

  const updateSelectCell = (
    item: DatabaseRowItem,
    def: ResolvedPropertyDefinition,
    optionValue: string
  ) => {
    if (!mutationsAllowed || !isEditableResolvedProperty(def)) return;
    if (!def.options.some((o) => o.value === optionValue)) return;
    if (valuesEqualForEdit(item.row[def.id], optionValue)) return;
    const completeRow: Record<string, JsonValue> = {
      ...item.row,
      [def.id]: optionValue
    };
    catchStoreMutation(
      store.updateRow(viewKey, item.rowKey, completeRow, item.sortOrder)
    );
  };

  const beginCreate = () => {
    if (!mutationsAllowed) return;
    const next: Record<string, string> = {};
    for (const id of createIds) next[id] = "";
    setDraft(next);
    setCreateError(null);
    setCreating(true);
  };

  const submitCreate = async () => {
    if (!mutationsAllowed) {
      setCreateError("Database metadata is not ready");
      return;
    }
    setCreateError(null);
    const hasTypedDefinitions = hasExplicitPropertyDefinitions(
      snap.meta?.propertyDefinitions
    );
    const typed = buildTypedCreateRowPayload(resolved, draft);
    const row = resolveCreateRowPayload({
      hasTypedDefinitions,
      typedResult: typed,
      legacySchema: snap.schema,
      draft
    });
    if ("error" in row && typeof row.error === "string") {
      setCreateError(row.error);
      return;
    }
    try {
      await store.createRow(
        viewKey,
        row as Record<string, string | number | boolean>
      );
      setCreating(false);
      setDraft({});
      setCreateError(null);
    } catch {
      // surfaced via snap.mutationError
    }
  };

  const sortSelectValue = snap.queryState.propertySort
    ? encodePropertySortSelectValue(
        snap.queryState.propertySort.propertyId,
        snap.queryState.propertySort.direction
      )
    : `${snap.queryState.sortBy}:${snap.queryState.direction}`;

  const onSortChange = (raw: string) => {
    const parsed = parseSortSelectValue(raw);
    if (!parsed) {
      setFilterError("Invalid sort selection");
      return;
    }
    if (parsed.kind === "property") {
      try {
        store.setPropertySort(viewKey, {
          propertyId: parsed.propertyId,
          direction: parsed.direction
        });
      } catch (err) {
        setFilterError(
          err instanceof Error ? err.message : "Invalid property sort"
        );
      }
      return;
    }
    store.setSort(viewKey, parsed.sortBy, parsed.direction);
  };

  const applyFilters = () => {
    setFilterError(null);
    const built: DatabaseFilter[] = [];
    for (const draftRow of filterDrafts) {
      const def = defMap.get(draftRow.propertyId);
      if (!def) {
        setFilterError(`Unknown property: ${draftRow.propertyId}`);
        return;
      }
      const result = buildFilterFromDraft(draftRow, def);
      if (!result.ok) {
        setFilterError(result.error);
        return;
      }
      built.push(result.filter);
    }
    try {
      store.setFilters(viewKey, built);
    } catch (err) {
      setFilterError(
        err instanceof Error ? err.message : "Invalid filters"
      );
    }
  };

  const clearFilters = () => {
    setFilterError(null);
    setFilterDrafts([]);
    try {
      store.setFilters(viewKey, []);
    } catch (err) {
      setFilterError(
        err instanceof Error ? err.message : "Failed to clear filters"
      );
    }
  };

  const updateFilterDraft = (
    id: string,
    patch: Partial<Omit<FilterDraft, "id">>
  ) => {
    setFilterDrafts((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if (patch.propertyId && patch.propertyId !== row.propertyId) {
          const def = defMap.get(patch.propertyId);
          if (def) {
            next.operator = defaultOperatorForType(def.type);
            next.value = "";
          }
        }
        if (patch.operator && operatorHidesValue(patch.operator)) {
          next.value = "";
        }
        return next;
      })
    );
  };

  const renderFilterValueEditor = (
    draftRow: FilterDraft,
    def: ResolvedPropertyDefinition | undefined
  ): ReactElement | null => {
    if (!def || operatorHidesValue(draftRow.operator)) return null;
    const label = `Filter value for ${def.name}`;
    if (def.type === "boolean") {
      return (
        <select
          aria-label={label}
          value={draftRow.value || "true"}
          onChange={(event) =>
            updateFilterDraft(draftRow.id, { value: event.target.value })
          }
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }
    if (def.type === "number") {
      return (
        <input
          type="number"
          aria-label={label}
          value={draftRow.value}
          onChange={(event) =>
            updateFilterDraft(draftRow.id, { value: event.target.value })
          }
        />
      );
    }
    if (def.type === "date") {
      return (
        <input
          type="date"
          aria-label={label}
          value={draftRow.value}
          onChange={(event) =>
            updateFilterDraft(draftRow.id, { value: event.target.value })
          }
        />
      );
    }
    if (def.type === "select" || def.type === "status") {
      return (
        <select
          aria-label={label}
          value={draftRow.value}
          onChange={(event) =>
            updateFilterDraft(draftRow.id, { value: event.target.value })
          }
        >
          <option value="">Select…</option>
          {def.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type="text"
        aria-label={label}
        value={draftRow.value}
        onChange={(event) =>
          updateFilterDraft(draftRow.id, { value: event.target.value })
        }
      />
    );
  };

  const renderCreateInput = (def: ResolvedPropertyDefinition): ReactElement => {
    const value = draft[def.id] ?? "";
    const label = `New row ${def.name}`;
    const setValue = (next: string) =>
      setDraft((prev) => ({ ...prev, [def.id]: next }));

    if (def.type === "boolean") {
      return (
        <input
          type="checkbox"
          aria-label={label}
          checked={value === "true" || value === "1"}
          onChange={(event) =>
            setValue(event.target.checked ? "true" : "false")
          }
        />
      );
    }
    if (def.type === "number") {
      return (
        <input
          type="number"
          aria-label={label}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      );
    }
    if (def.type === "date") {
      return (
        <input
          type="date"
          aria-label={label}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      );
    }
    if (def.type === "select" || def.type === "status") {
      return (
        <select
          aria-label={label}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        >
          <option value="">Select…</option>
          {def.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type="text"
        aria-label={label}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    );
  };

  const renderCellEditor = (
    item: DatabaseRowItem,
    def: ResolvedPropertyDefinition
  ): ReactElement => {
    const isEditing =
      editing?.rowKey === item.rowKey && editing.field === def.id;
    const editable =
      mutationsAllowed &&
      snap.capabilities.update &&
      isEditableResolvedProperty(def);

    if (def.type === "boolean" && editable) {
      const checked =
        item.row[def.id] === true ||
        item.row[def.id] === "true" ||
        item.row[def.id] === 1;
      return (
        <input
          type="checkbox"
          aria-label={`${def.name} for ${item.rowKey}`}
          checked={Boolean(checked)}
          disabled={busy}
          onChange={(event) =>
            updateBooleanCell(item, def, event.target.checked)
          }
        />
      );
    }

    if (
      (def.type === "select" || def.type === "status") &&
      editable &&
      def.options.length > 0
    ) {
      const current = item.row[def.id] == null ? "" : String(item.row[def.id]);
      const inOptions =
        current === "" || def.options.some((o) => o.value === current);
      return (
        <select
          aria-label={`${def.name} for ${item.rowKey}`}
          value={current}
          disabled={busy}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            updateSelectCell(item, def, event.target.value);
          }}
        >
          {!inOptions && current ? (
            <option value={current}>{`Current: ${current}`}</option>
          ) : null}
          {current === "" ? <option value="">—</option> : null}
          {def.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (isEditing) {
      const inputType =
        def.type === "number"
          ? "number"
          : def.type === "date"
            ? "date"
            : "text";
      return (
        <input
          autoFocus
          type={inputType}
          aria-label={`Edit ${def.name} for ${item.rowKey}`}
          value={editValue}
          onChange={(event) => setEditValue(event.target.value)}
          onBlur={() => void commitEdit()}
          onKeyDown={onEditKeyDown}
        />
      );
    }

    if (editable) {
      return (
        <button
          type="button"
          className="oe-database-view__cell-btn"
          aria-label={`Edit ${def.name} for ${item.rowKey}`}
          onClick={() => startEdit(item, def)}
        >
          {cellDisplayText(def, item.row[def.id]) || "—"}
        </button>
      );
    }

    return <>{cellDisplayText(def, item.row[def.id])}</>;
  };

  const normalizedViewType: DatabaseViewType = isDatabaseViewType(viewType)
    ? viewType
    : "table";

  const rendererContext: DatabaseViewRendererContext = {
    snapshot: snap,
    store,
    viewKey,
    viewId,
    viewType: normalizedViewType,
    title,
    definitions: resolved,
    mutationsAllowed,
    busy,
    runtime
  };

  const ResolvedRenderer = resolveDatabaseViewRenderer({
    viewType: normalizedViewType,
    runtime,
    defaults: DEFAULT_RENDERERS
  });

  const renderBody = (): ReactElement => {
    if (normalizedViewType === "table" && !runtime.renderers?.table) {
      return renderTableBody();
    }
    // R1: always mount as a React component so host renderers may use hooks.
    if (ResolvedRenderer) {
      return <ResolvedRenderer {...rendererContext} />;
    }
    if (isDeferredDatabaseViewType(normalizedViewType)) {
      return <DeferredRenderer {...rendererContext} />;
    }
    return <DeferredRenderer {...rendererContext} />;
  };

  const renderTableBody = (): ReactElement => {
    if (!snap.capabilities.list) {
      return (
        <p className="oe-database-view__empty" role="status">
          Database provider unavailable
        </p>
      );
    }
    if (snap.status === "loading" && snap.items.length === 0) {
      return (
        <p className="oe-database-view__empty" role="status">
          Loading…
        </p>
      );
    }
    if (snap.status === "error") {
      return (
        <p className="oe-database-view__error" role="alert">
          {snap.errorMessage ?? "Failed to load rows"}
        </p>
      );
    }
    if (snap.status === "empty" && !creating) {
      return (
        <p className="oe-database-view__empty" role="status">
          {emptyMessage(snap)}
        </p>
      );
    }
    return (
      <div className="oe-database-view__table-wrap" role="region">
        <table className="oe-database-view__table">
          <thead>
            <tr>
              <th scope="col">Key</th>
              {resolved.map((def) => (
                <th key={def.id} scope="col">
                  {def.name}
                </th>
              ))}
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {creating ? (
              <tr className="oe-database-view__draft">
                <td>
                  <em>new</em>
                </td>
                {resolved.map((def) => {
                  if (!isCreatableResolvedProperty(def)) {
                    return (
                      <td key={def.id}>
                        <span className="oe-database-view__readonly-hint">
                          —
                        </span>
                      </td>
                    );
                  }
                  return <td key={def.id}>{renderCreateInput(def)}</td>;
                })}
                <td>
                  <button
                    type="button"
                    onClick={() => void submitCreate()}
                    disabled={busy}
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setDraft({});
                      setCreateError(null);
                    }}
                  >
                    Cancel
                  </button>
                </td>
              </tr>
            ) : null}
            {snap.items.map((item, index) => (
              <tr
                key={item.rowKey}
                data-row-key={item.rowKey}
                aria-busy={
                  snap.mutating?.rowKey === item.rowKey ? true : undefined
                }
              >
                <td>{item.rowKey}</td>
                {resolved.map((def) => (
                  <td key={def.id}>{renderCellEditor(item, def)}</td>
                ))}
                <td className="oe-database-view__actions">
                  {snap.canReorder ? (
                    <>
                      <button
                        type="button"
                        aria-label={`Move ${item.rowKey} up`}
                        disabled={busy || index === 0}
                        onClick={() =>
                          catchStoreMutation(
                            store.moveRow(viewKey, item.rowKey, "up")
                          )
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${item.rowKey} down`}
                        disabled={busy || index === snap.items.length - 1}
                        onClick={() =>
                          catchStoreMutation(
                            store.moveRow(viewKey, item.rowKey, "down")
                          )
                        }
                      >
                        ↓
                      </button>
                    </>
                  ) : null}
                  {snap.queryState.trashMode === "active" &&
                  snap.capabilities.delete ? (
                    <button
                      type="button"
                      aria-label={`Delete ${item.rowKey}`}
                      disabled={busy}
                      onClick={() =>
                        catchStoreMutation(
                          store.deleteRow(viewKey, item.rowKey)
                        )
                      }
                    >
                      Delete
                    </button>
                  ) : null}
                  {snap.queryState.trashMode === "trash" &&
                  snap.capabilities.restore ? (
                    <button
                      type="button"
                      aria-label={`Restore ${item.rowKey}`}
                      disabled={busy}
                      onClick={() =>
                        catchStoreMutation(
                          store.restoreRow(viewKey, item.rowKey)
                        )
                      }
                    >
                      Restore
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const showSharedCreate =
    creating &&
    normalizedViewType !== "table" &&
    snap.capabilities.create &&
    snap.queryState.trashMode === "active" &&
    mutationsAllowed;

  return (
    <section
      className="oe-database-view"
      data-oe-database-view={snap.databaseId}
      data-view-key={viewKey}
      data-view-type={normalizedViewType}
      data-busy={busy ? "true" : "false"}
      aria-busy={busy || undefined}
      aria-label={`${title} (${normalizedViewType})`}
    >
      <header className="oe-database-view__header">
        <h3 className="oe-database-view__title">{title}</h3>
        <span className="oe-database-view__meta">
          {normalizedViewType}
          {snap.pagination.total
            ? ` · ${snap.items.length}/${snap.pagination.total}`
            : snap.pagination.hasMore
              ? ` · ${snap.items.length}+ loaded`
              : snap.items.length
                ? ` · ${snap.items.length} loaded`
                : ""}
        </span>
      </header>

      <div
        className="oe-database-view__toolbar"
        role="toolbar"
        aria-label="Database tools"
      >
        <label className="oe-database-view__search">
          <span className="oe-sr-only">Search rows</span>
          <input
            type="search"
            value={searchInput}
            placeholder="Search…"
            aria-label="Search rows"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <label>
          <span className="oe-sr-only">Sort</span>
          <select
            aria-label="Sort rows"
            value={sortSelectValue}
            onChange={(event) => onSortChange(event.target.value)}
          >
            <option value="position:asc">Position ↑</option>
            <option value="position:desc">Position ↓</option>
            <option value="title:asc">Title ↑</option>
            <option value="title:desc">Title ↓</option>
            {supportsPropertySort
              ? sortablePropertyDefs.flatMap((def) => {
                  const asc = encodePropertySortSelectValue(def.id, "asc");
                  const desc = encodePropertySortSelectValue(def.id, "desc");
                  return [
                    <option key={asc} value={asc}>
                      {def.name} ↑
                    </option>,
                    <option key={desc} value={desc}>
                      {def.name} ↓
                    </option>
                  ];
                })
              : null}
          </select>
        </label>
        {snap.capabilities.restore ? (
          <div
            className="oe-database-view__tabs"
            role="group"
            aria-label="Row mode"
          >
            <button
              type="button"
              className={
                snap.queryState.trashMode === "active"
                  ? "oe-database-view__chip oe-database-view__chip--on"
                  : "oe-database-view__chip"
              }
              onClick={() => store.setTrashMode(viewKey, "active")}
            >
              Active
            </button>
            <button
              type="button"
              className={
                snap.queryState.trashMode === "trash"
                  ? "oe-database-view__chip oe-database-view__chip--on"
                  : "oe-database-view__chip"
              }
              onClick={() => store.setTrashMode(viewKey, "trash")}
            >
              Trash
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className="oe-database-view__chip"
          onClick={() => catchStoreMutation(store.refresh(viewKey))}
          disabled={busy}
        >
          Refresh
        </button>
        {snap.capabilities.create &&
        snap.queryState.trashMode === "active" &&
        mutationsAllowed ? (
          <button
            type="button"
            className="oe-database-view__chip oe-database-view__chip--on"
            onClick={beginCreate}
            disabled={busy || creating || createIds.length === 0}
          >
            New row
          </button>
        ) : null}
      </div>

      {supportsFilters ? (
        <div
          className="oe-database-view__filters"
          role="group"
          aria-label="Property filters"
        >
          {filterDrafts.map((draftRow, index) => {
            const def = defMap.get(draftRow.propertyId);
            const ops = def
              ? operatorsForType(def.type)
              : operatorsForType("text");
            return (
              <div key={draftRow.id}>
                {index > 0 ? (
                  <span className="oe-database-view__filter-and">AND</span>
                ) : null}
                <div className="oe-database-view__filter-row">
                  <select
                    aria-label={`Filter ${index + 1} property`}
                    value={draftRow.propertyId}
                    onChange={(event) =>
                      updateFilterDraft(draftRow.id, {
                        propertyId: event.target.value
                      })
                    }
                  >
                    {filterableDefs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Filter ${index + 1} operator`}
                    value={draftRow.operator}
                    onChange={(event) =>
                      updateFilterDraft(draftRow.id, {
                        operator: event.target.value
                      })
                    }
                  >
                    {ops.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  {renderFilterValueEditor(draftRow, def)}
                  <button
                    type="button"
                    className="oe-database-view__chip"
                    aria-label={`Remove filter ${index + 1}`}
                    onClick={() =>
                      setFilterDrafts((prev) =>
                        prev.filter((row) => row.id !== draftRow.id)
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
          <div className="oe-database-view__filter-row">
            <button
              type="button"
              className="oe-database-view__chip"
              disabled={filterableDefs.length === 0}
              onClick={() =>
                setFilterDrafts((prev) => [
                  ...prev,
                  newEmptyFilterDraft(filterableDefs)
                ])
              }
            >
              + Filter
            </button>
            <button
              type="button"
              className="oe-database-view__chip oe-database-view__chip--on"
              onClick={applyFilters}
              disabled={busy}
            >
              Apply
            </button>
            <button
              type="button"
              className="oe-database-view__chip"
              onClick={clearFilters}
              disabled={busy && filterDrafts.length === 0}
            >
              Clear filters
            </button>
          </div>
          {filterError ? (
            <p className="oe-database-view__error" role="alert">
              {filterError}
            </p>
          ) : null}
          {snap.filterNotice ? (
            <p className="oe-database-view__notice" role="status">
              {snap.filterNotice}
            </p>
          ) : null}
        </div>
      ) : null}

      {snap.mutationError ? (
        <p className="oe-database-view__error" role="alert">
          {snap.mutationError}
        </p>
      ) : null}
      {createError ? (
        <p className="oe-database-view__error" role="alert" id={`${baseId}-create-error`}>
          {createError}
        </p>
      ) : null}
      {snap.loadMoreError ? (
        <p className="oe-database-view__error" role="alert">
          {snap.loadMoreError}
        </p>
      ) : null}

      {showSharedCreate ? (
        <div className="oe-database-view__shared-create" role="form" aria-label="New row">
          {resolved.map((def) => {
            if (!isCreatableResolvedProperty(def)) return null;
            return (
              <div key={def.id} className="oe-database-view__shared-create-field">
                <label>
                  <span>{def.name}</span>
                  {renderCreateInput(def)}
                </label>
              </div>
            );
          })}
          <div className="oe-database-view__actions">
            <button type="button" onClick={() => void submitCreate()} disabled={busy}>
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setDraft({});
                setCreateError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {normalizedViewType === "table" && !runtime.renderers?.table
        ? renderTableBody()
        : !snap.capabilities.list
          ? (
            <p className="oe-database-view__empty" role="status">
              Database provider unavailable
            </p>
          )
          : snap.status === "loading" && snap.items.length === 0
            ? (
              <p className="oe-database-view__empty" role="status">
                Loading…
              </p>
            )
            : snap.status === "error"
              ? (
                <p className="oe-database-view__error" role="alert">
                  {snap.errorMessage ?? "Failed to load rows"}
                </p>
              )
              : snap.status === "empty" && !creating
                ? (
                  <p className="oe-database-view__empty" role="status">
                    {emptyMessage(snap)}
                  </p>
                )
                : renderBody()}

      <div className="oe-database-view__footer">
        {snap.pagination.hasMore ? (
          <button
            type="button"
            className="oe-database-view__chip"
            disabled={busy || snap.mutating?.kind === "loadingMore"}
            onClick={() => catchStoreMutation(store.loadMore(viewKey))}
          >
            Load more
          </button>
        ) : null}
        {!snap.canReorder && snap.capabilities.reorder ? (
          <span className="oe-database-view__hint">
            Reorder disabled: {snap.reorderDisabledReason}
          </span>
        ) : null}
      </div>

      <p className="oe-database-view__footnote">
        Document stores databaseId/viewId/viewType only — rows come from the
        host provider via DatabaseRuntimeStore.
      </p>
    </section>
  );
}

/** Pre-store read-only path for hosts that only pass DatabaseProvider. */
function LegacyDatabaseView(props: {
  runtime: DatabaseViewRuntime;
  databaseId: string;
  viewId: string;
  viewType: string;
  titleHint: string;
}): ReactElement {
  const { runtime, databaseId, viewId, viewType, titleHint } = props;
  const [items, setItems] = useState<DatabaseRowItem[]>([]);
  const [schema, setSchema] = useState<Record<string, string>>({});
  const [title, setTitle] = useState(titleHint || databaseId || "Database");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const listRows = runtime.database?.listRows;
    if (!databaseId || !listRows) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [page, meta] = await Promise.all([
          listRows(databaseId, { limit: 50 }),
          runtime.database?.getDatabase?.(databaseId) ?? Promise.resolve(null)
        ]);
        if (cancelled) return;
        setItems(page.items);
        setSchema(page.schema);
        setTitle(
          meta?.title ||
            runtime.getTitle?.(databaseId) ||
            titleHint ||
            databaseId
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load rows");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [databaseId, runtime, viewId, viewType, titleHint]);

  const schemaKeys = Object.keys(schema);

  return (
    <section
      className="oe-database-view"
      data-oe-database-view={databaseId}
      data-view-id={viewId}
      data-view-type={viewType}
      aria-label={`${title} (${viewType})`}
    >
      <header className="oe-database-view__header">
        <h3 className="oe-database-view__title">{title}</h3>
        <span className="oe-database-view__meta">{viewType}</span>
      </header>
      {!runtime.database?.listRows ? (
        <p className="oe-database-view__empty">Database provider unavailable</p>
      ) : loading ? (
        <p className="oe-database-view__empty">Loading…</p>
      ) : error ? (
        <p className="oe-database-view__error" role="alert">
          {error}
        </p>
      ) : items.length === 0 ? (
        <p className="oe-database-view__empty">No rows</p>
      ) : (
        <div className="oe-database-view__table-wrap" role="region">
          <table className="oe-database-view__table">
            <thead>
              <tr>
                <th scope="col">Key</th>
                {schemaKeys.map((key) => (
                  <th key={key} scope="col">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.rowKey}>
                  <td>{item.rowKey}</td>
                  {schemaKeys.map((key) => (
                    <td key={key}>{String(item.row[key] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="oe-database-view__footnote">
        Document stores databaseId/viewId/viewType only — rows come from the
        host provider.
      </p>
    </section>
  );
}

/**
 * Database view block — identity + view config only.
 * Runtime (provider/store) is captured by closure — never module-global.
 */
export function createDatabaseViewBlockSpec(
  runtime: DatabaseViewRuntime = {}
) {
  return createReactBlockSpec(
    {
      type: DATABASE_VIEW_TYPE,
      propSchema: {
        databaseId: { default: "" as const },
        viewId: { default: "main" as const },
        viewType: {
          default: "table" as const,
          values: [...DATABASE_VIEW_TYPES]
        },
        titleHint: { default: "" as const }
      },
      content: "none" as const
    },
    {
      render: (props): ReactElement => (
        <DatabaseTableView runtime={runtime} block={props.block} />
      )
    }
  )();
}

export type { DatabaseViewType };
