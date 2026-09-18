/**
 * Database view block — interactive table engine (Phase 4F-3A / R1).
 * Document stores identity/view config only; rows come from DatabaseRuntimeStore.
 */
import { createReactBlockSpec } from "@blocknote/react";
import type {
  DatabaseProvider,
  DatabaseRowItem,
  JsonValue
} from "@hello-ai-company/editor-core";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactElement
} from "react";
import {
  databaseViewInstanceKey,
  type DatabaseRuntimeStore,
  type DatabaseSortBy,
  type DatabaseSortDirection,
  type DatabaseViewSnapshot
} from "./databaseRuntimeStore.js";
import {
  buildCreateRowPayload,
  creatableSchemaKeys,
  formatDatabaseCellDisplay,
  isCreatablePropertyKind,
  isEditablePropertyKind,
  normalizeDatabasePropertyType,
  parseEditedCellValue,
  valuesEqualForEdit
} from "./databaseProperty.js";
import {
  DATABASE_VIEW_TYPE,
  DATABASE_VIEW_TYPES,
  type DatabaseViewType
} from "./types.js";

export type DatabaseViewRuntime = {
  database?: DatabaseProvider;
  /** Preferred: instance-scoped interaction store. */
  store?: DatabaseRuntimeStore;
  getTitle?: (databaseId: string) => string | undefined;
};

/**
 * Swallow provider rejection after the store has recorded mutationError.
 * Prevents unhandled Promise rejections from fire-and-forget UI handlers (4F-3A R1).
 */
export function catchStoreMutation(promise: Promise<unknown>): void {
  void promise.catch(() => undefined);
}

function emptyMessage(snap: DatabaseViewSnapshot): string {
  switch (snap.emptyReason) {
    case "provider-unavailable":
      return "Database provider unavailable";
    case "no-search-matches":
      return "No rows match this search";
    case "trash-empty":
      return "Trash is empty";
    case "no-rows":
    default:
      return "No rows yet";
  }
}

type DatabaseViewBlock = {
  id?: string;
  props: {
    databaseId: string;
    viewId: string;
    viewType: string;
    titleHint: string;
  };
};

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
    <InteractiveDatabaseTable
      snap={snap}
      store={store}
      viewKey={viewKey}
      viewType={viewType}
      titleHint={titleHint}
      getTitle={runtime.getTitle}
    />
  );
}

function InteractiveDatabaseTable(props: {
  snap: DatabaseViewSnapshot;
  store: DatabaseRuntimeStore;
  viewKey: string;
  viewType: string;
  titleHint: string;
  getTitle?: (databaseId: string) => string | undefined;
}): ReactElement {
  const { snap, store, viewKey, viewType, titleHint, getTitle } = props;
  const [searchInput, setSearchInput] = useState(snap.queryState.query);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{
    rowKey: string;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInput(snap.queryState.query);
  }, [snap.queryState.query]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const title =
    snap.meta?.title ||
    getTitle?.(snap.databaseId) ||
    titleHint ||
    snap.databaseId ||
    "Database";

  const schemaKeys = Object.keys(snap.schema);
  const createKeys = creatableSchemaKeys(snap.schema);
  // First-page reload keeps prior rows visible, but must block Load more / writes.
  const busy = Boolean(snap.mutating) || snap.status === "loading";

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      store.setQuery(viewKey, value);
    }, 200);
  };

  const startEdit = (item: DatabaseRowItem, field: string) => {
    if (!snap.capabilities.update) return;
    const kind = normalizeDatabasePropertyType(snap.schema[field]);
    if (!isEditablePropertyKind(kind)) return;
    setEditing({ rowKey: item.rowKey, field });
    setEditValue(String(item.row[field] ?? ""));
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue("");
  };

  const commitEdit = async () => {
    if (!editing) return;
    const item = snap.items.find((row) => row.rowKey === editing.rowKey);
    if (!item) {
      cancelEdit();
      return;
    }
    const kind = normalizeDatabasePropertyType(snap.schema[editing.field]);
    const nextValue = parseEditedCellValue(editValue, kind);
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

  const onEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitEdit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  };

  const beginCreate = () => {
    const next: Record<string, string> = {};
    for (const key of createKeys) next[key] = "";
    setDraft(next);
    setCreating(true);
  };

  const submitCreate = async () => {
    const row = buildCreateRowPayload(snap.schema, draft);
    try {
      await store.createRow(viewKey, row);
      setCreating(false);
      setDraft({});
    } catch {
      // surfaced via snap.mutationError
    }
  };

  const sortLabel = (sortBy: DatabaseSortBy, direction: DatabaseSortDirection) =>
    `${sortBy === "position" ? "Position" : "Title"} ${direction === "asc" ? "↑" : "↓"}`;

  if (viewType !== "table") {
    return (
      <section
        className="oe-database-view"
        data-oe-database-view={snap.databaseId}
        data-view-id={viewKey}
        data-view-type={viewType}
        aria-label={`${title} (${viewType})`}
      >
        <header className="oe-database-view__header">
          <h3 className="oe-database-view__title">{title}</h3>
          <span className="oe-database-view__meta">{viewType}</span>
        </header>
        <p className="oe-database-view__empty" role="status">
          Interactive {viewType} renderer is deferred. Table engine is available
          when viewType is &quot;table&quot;.
        </p>
      </section>
    );
  }

  return (
    <section
      className="oe-database-view"
      data-oe-database-view={snap.databaseId}
      data-view-key={viewKey}
      data-view-type="table"
      data-busy={busy ? "true" : "false"}
      aria-busy={busy || undefined}
      aria-label={`${title} (table)`}
    >
      <header className="oe-database-view__header">
        <h3 className="oe-database-view__title">{title}</h3>
        <span className="oe-database-view__meta">
          table
          {snap.pagination.total
            ? ` · ${snap.items.length}/${snap.pagination.total}`
            : ""}
        </span>
      </header>

      <div className="oe-database-view__toolbar" role="toolbar" aria-label="Database tools">
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
            value={`${snap.queryState.sortBy}:${snap.queryState.direction}`}
            onChange={(event) => {
              const [sortBy, direction] = event.target.value.split(":") as [
                DatabaseSortBy,
                DatabaseSortDirection
              ];
              store.setSort(viewKey, sortBy, direction);
            }}
          >
            {(
              [
                ["position", "asc"],
                ["position", "desc"],
                ["title", "asc"],
                ["title", "desc"]
              ] as const
            ).map(([sortBy, direction]) => (
              <option
                key={`${sortBy}:${direction}`}
                value={`${sortBy}:${direction}`}
              >
                {sortLabel(sortBy, direction)}
              </option>
            ))}
          </select>
        </label>
        {snap.capabilities.restore ? (
          <div className="oe-database-view__tabs" role="group" aria-label="Row mode">
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
        {snap.capabilities.create && snap.queryState.trashMode === "active" ? (
          <button
            type="button"
            className="oe-database-view__chip oe-database-view__chip--on"
            onClick={beginCreate}
            disabled={busy || creating || createKeys.length === 0}
          >
            New row
          </button>
        ) : null}
      </div>

      {snap.mutationError ? (
        <p className="oe-database-view__error" role="alert">
          {snap.mutationError}
        </p>
      ) : null}
      {snap.loadMoreError ? (
        <p className="oe-database-view__error" role="alert">
          {snap.loadMoreError}
        </p>
      ) : null}

      {!snap.capabilities.list ? (
        <p className="oe-database-view__empty" role="status">
          Database provider unavailable
        </p>
      ) : snap.status === "loading" && snap.items.length === 0 ? (
        <p className="oe-database-view__empty" role="status">
          Loading…
        </p>
      ) : snap.status === "error" ? (
        <p className="oe-database-view__error" role="alert">
          {snap.errorMessage ?? "Failed to load rows"}
        </p>
      ) : snap.status === "empty" && !creating ? (
        <p className="oe-database-view__empty" role="status">
          {emptyMessage(snap)}
        </p>
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
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {creating ? (
                <tr className="oe-database-view__draft">
                  <td>
                    <em>new</em>
                  </td>
                  {schemaKeys.map((key) => {
                    const kind = normalizeDatabasePropertyType(snap.schema[key]);
                    if (!isCreatablePropertyKind(kind)) {
                      return (
                        <td key={key}>
                          <span className="oe-database-view__readonly-hint">
                            —
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={key}>
                        <input
                          aria-label={`New row ${key}`}
                          value={draft[key] ?? ""}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              [key]: event.target.value
                            }))
                          }
                        />
                      </td>
                    );
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
                  {schemaKeys.map((key) => {
                    const kind = normalizeDatabasePropertyType(snap.schema[key]);
                    const isEditing =
                      editing?.rowKey === item.rowKey &&
                      editing.field === key;
                    if (isEditing) {
                      return (
                        <td key={key}>
                          <input
                            autoFocus
                            aria-label={`Edit ${key} for ${item.rowKey}`}
                            value={editValue}
                            onChange={(event) =>
                              setEditValue(event.target.value)
                            }
                            onBlur={() => void commitEdit()}
                            onKeyDown={onEditKeyDown}
                          />
                        </td>
                      );
                    }
                    if (kind === "boolean" && snap.capabilities.update) {
                      const checked =
                        item.row[key] === true ||
                        item.row[key] === "true" ||
                        item.row[key] === 1;
                      return (
                        <td key={key}>
                          <input
                            type="checkbox"
                            aria-label={`${key} for ${item.rowKey}`}
                            checked={Boolean(checked)}
                            disabled={busy}
                            onChange={(event) => {
                              const completeRow: Record<string, JsonValue> = {
                                ...item.row,
                                [key]: event.target.checked
                              };
                              catchStoreMutation(
                                store.updateRow(
                                  viewKey,
                                  item.rowKey,
                                  completeRow,
                                  item.sortOrder
                                )
                              );
                            }}
                          />
                        </td>
                      );
                    }
                    const editable =
                      snap.capabilities.update &&
                      isEditablePropertyKind(kind);
                    return (
                      <td key={key}>
                        {editable ? (
                          <button
                            type="button"
                            className="oe-database-view__cell-btn"
                            aria-label={`Edit ${key} for ${item.rowKey}`}
                            onClick={() => startEdit(item, key)}
                          >
                            {formatDatabaseCellDisplay(item.row[key], kind) ||
                              "—"}
                          </button>
                        ) : (
                          formatDatabaseCellDisplay(item.row[key], kind)
                        )}
                      </td>
                    );
                  })}
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
      )}

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
