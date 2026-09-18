/**
 * Board renderer — status/select grouping over DatabaseRuntimeStore rows (4F-4A).
 */
import type { DatabaseRowItem } from "@hello-ai-company/editor-core";
import {
  useEffect,
  useId,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactElement
} from "react";
import {
  BOARD_UNASSIGNED_VALUE,
  buildBoardColumns,
  buildBoardGroupUpdateRow,
  canMutateBoardGroup,
  listBoardGroupingProperties,
  resolveBoardGroupingProperty,
  type BoardGroupColumn
} from "./databaseBoardModel.js";
import { isEditableResolvedProperty } from "./databaseProperty.js";
import {
  formatDatabaseCardFieldValue,
  resolveDatabaseCardPreviewFields,
  resolveDatabaseRowTitle
} from "./databaseRowPresentation.js";
import { catchStoreMutation } from "./databaseMutationUtils.js";
import type { DatabaseViewRendererContext } from "./databaseViewRenderers.js";

function openRow(
  ctx: DatabaseViewRendererContext,
  rowKey: string
): void {
  const onOpen = ctx.runtime.onOpenRow;
  if (!onOpen) return;
  onOpen({
    databaseId: ctx.snapshot.databaseId,
    rowKey,
    viewId: ctx.viewId,
    viewType: "board"
  });
}

export function BoardRenderer(
  ctx: DatabaseViewRendererContext
): ReactElement {
  const {
    snapshot: snap,
    store,
    viewKey,
    definitions,
    mutationsAllowed,
    busy,
    title
  } = ctx;
  const baseId = useId();
  const eligible = listBoardGroupingProperties(definitions);
  const [groupPropertyId, setGroupPropertyId] = useState<string | null>(
    () => resolveBoardGroupingProperty(definitions, null)?.id ?? null
  );

  useEffect(() => {
    const resolved = resolveBoardGroupingProperty(definitions, groupPropertyId);
    const nextId = resolved?.id ?? null;
    if (nextId !== groupPropertyId) {
      setGroupPropertyId(nextId);
    }
  }, [definitions, groupPropertyId]);

  const groupProperty = resolveBoardGroupingProperty(
    definitions,
    groupPropertyId
  );
  const columns = buildBoardColumns({
    items: snap.items,
    groupProperty
  });

  const previewDefs = resolveDatabaseCardPreviewFields(definitions, {
    excludePropertyIds: new Set(
      groupProperty ? [groupProperty.id] : []
    ),
    maxFields: 3
  });

  const trashMode = snap.queryState.trashMode;
  const updateCapable = snap.capabilities.update;

  const mutateGroup = (
    item: DatabaseRowItem,
    targetValue: string
  ): void => {
    if (
      !canMutateBoardGroup({
        mutationsAllowed,
        updateCapability: updateCapable,
        trashMode,
        groupProperty,
        targetValue
      }) ||
      !groupProperty
    ) {
      return;
    }
    const current = item.row[groupProperty.id];
    const currentStr =
      current === null || current === undefined || current === ""
        ? BOARD_UNASSIGNED_VALUE
        : String(current);
    if (currentStr === targetValue) return;

    const completeRow = buildBoardGroupUpdateRow(
      item,
      groupProperty.id,
      targetValue
    );
    if (!completeRow) return;
    catchStoreMutation(
      store.updateRow(viewKey, item.rowKey, completeRow, item.sortOrder)
    );
  };

  const onDragStart = (
    event: DragEvent<HTMLElement>,
    item: DatabaseRowItem
  ) => {
    if (!groupProperty || trashMode !== "active") {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData(
      "application/x-oe-board-row",
      JSON.stringify({
        databaseId: snap.databaseId,
        rowKey: item.rowKey
      })
    );
    event.dataTransfer.effectAllowed = "move";
  };

  const onDropColumn = (
    event: DragEvent<HTMLElement>,
    column: BoardGroupColumn
  ) => {
    event.preventDefault();
    if (
      !canMutateBoardGroup({
        mutationsAllowed,
        updateCapability: updateCapable,
        trashMode,
        groupProperty,
        targetValue: column.value
      })
    ) {
      return;
    }
    const raw = event.dataTransfer.getData("application/x-oe-board-row");
    if (!raw) return;
    let payload: { databaseId?: string; rowKey?: string };
    try {
      payload = JSON.parse(raw) as { databaseId?: string; rowKey?: string };
    } catch {
      return;
    }
    if (
      payload.databaseId !== snap.databaseId ||
      typeof payload.rowKey !== "string"
    ) {
      return;
    }
    const item = snap.items.find((r) => r.rowKey === payload.rowKey);
    if (!item) return;
    mutateGroup(item, column.value);
  };

  const configuredOptions = groupProperty?.options ?? [];

  return (
    <div
      className="oe-database-board"
      role="region"
      aria-label={`${title} board`}
      data-oe-board=""
      data-busy={busy ? "true" : "false"}
      aria-busy={busy || undefined}
    >
      <div className="oe-database-board__controls">
        {eligible.length > 0 ? (
          <label className="oe-database-board__group-select">
            <span>Group by</span>
            <select
              aria-label="Board grouping property"
              value={groupProperty?.id ?? ""}
              onChange={(event) => setGroupPropertyId(event.target.value)}
            >
              {eligible.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="oe-database-view__hint" role="status">
            No status/select property — showing all loaded items in one column.
          </p>
        )}
      </div>

      {snap.pagination.hasMore ? (
        <p className="oe-database-view__notice" role="status">
          Showing loaded rows only — column counts are not full-database totals.
        </p>
      ) : null}

      <div className="oe-database-board__columns">
        {columns.map((column) => {
          const droppable = canMutateBoardGroup({
            mutationsAllowed,
            updateCapability: updateCapable,
            trashMode,
            groupProperty,
            targetValue: column.value
          });
          return (
            <section
              key={column.value}
              className="oe-database-board__column"
              data-column-value={column.value}
              data-droppable={droppable ? "true" : "false"}
              aria-label={`${column.label} (${column.items.length} loaded)`}
              onDragOver={
                droppable
                  ? (event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }
                  : undefined
              }
              onDrop={
                droppable
                  ? (event) => onDropColumn(event, column)
                  : undefined
              }
            >
              <header className="oe-database-board__column-header">
                <h4 className="oe-database-board__column-title">
                  {column.label}
                </h4>
                <span className="oe-database-board__column-count">
                  {column.items.length}
                  {snap.pagination.hasMore ? "+" : ""}
                </span>
              </header>
              <ul className="oe-database-board__cards">
                {column.items.map((item) => {
                  const cardTitle = resolveDatabaseRowTitle(item, definitions);
                  const canEditGroup =
                    groupProperty != null &&
                    mutationsAllowed &&
                    updateCapable &&
                    trashMode === "active" &&
                    !groupProperty.readOnly &&
                    groupProperty.source === "typed" &&
                    isEditableResolvedProperty(groupProperty) &&
                    configuredOptions.length > 0;
                  const currentValue =
                    groupProperty == null
                      ? ""
                      : item.row[groupProperty.id] == null ||
                          item.row[groupProperty.id] === ""
                        ? ""
                        : String(item.row[groupProperty.id]);
                  const openable = Boolean(ctx.runtime.onOpenRow);
                  return (
                    <li
                      key={item.rowKey}
                      className="oe-database-board__card"
                      data-row-key={item.rowKey}
                      draggable={Boolean(droppable && groupProperty)}
                      onDragStart={(event) => onDragStart(event, item)}
                      aria-busy={
                        snap.mutating?.rowKey === item.rowKey ? true : undefined
                      }
                    >
                      {openable ? (
                        <button
                          type="button"
                          className="oe-database-board__card-title"
                          aria-label={`Open row ${cardTitle}`}
                          onClick={() => openRow(ctx, item.rowKey)}
                          onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              openRow(ctx, item.rowKey);
                            }
                          }}
                        >
                          {cardTitle}
                        </button>
                      ) : (
                        <span className="oe-database-board__card-title">
                          {cardTitle}
                        </span>
                      )}
                      {groupProperty && canEditGroup ? (
                        <label className="oe-database-board__status">
                          <span className="oe-sr-only">
                            {groupProperty.name} for {item.rowKey}
                          </span>
                          <select
                            aria-label={`${groupProperty.name} for ${item.rowKey}`}
                            value={currentValue}
                            disabled={busy}
                            onChange={(event) =>
                              mutateGroup(item, event.target.value)
                            }
                          >
                            {currentValue &&
                            !configuredOptions.some(
                              (o) => o.value === currentValue
                            ) ? (
                              <option value={currentValue}>
                                {`Current: ${currentValue}`}
                              </option>
                            ) : null}
                            {currentValue === "" ? (
                              <option value="" disabled>
                                Unassigned
                              </option>
                            ) : null}
                            {configuredOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : groupProperty ? (
                        <span className="oe-database-board__status-label">
                          {column.label}
                        </span>
                      ) : null}
                      {previewDefs.length > 0 ? (
                        <dl className="oe-database-board__preview" id={`${baseId}-${item.rowKey}`}>
                          {previewDefs.map((def) => {
                            const text = formatDatabaseCardFieldValue(
                              def,
                              item.row[def.id]
                            );
                            if (!text) return null;
                            return (
                              <div key={def.id}>
                                <dt>{def.name}</dt>
                                <dd>{text}</dd>
                              </div>
                            );
                          })}
                        </dl>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Adapter matching DatabaseViewRenderer signature. */
export function renderBoardView(
  context: DatabaseViewRendererContext
): ReactElement {
  return <BoardRenderer {...context} />;
}
