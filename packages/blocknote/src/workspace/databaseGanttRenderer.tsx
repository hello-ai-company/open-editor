/**
 * Gantt renderer — date-range bars over DatabaseRuntimeStore rows (4F-4C).
 */
import type { DatabaseRowItem, JsonValue } from "@hello-ai-company/editor-core";
import {
  useEffect,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactElement
} from "react";
import {
  buildCalendarDateUpdateRow,
  canMutateCalendarDate,
  listCalendarDateProperties
} from "./databaseCalendarModel.js";
import {
  compareCanonicalDateKeys,
  shiftInclusiveRange
} from "./databaseDateAxisModel.js";
import {
  buildGanttLayout,
  resolveGanttEndpoints
} from "./databaseGanttModel.js";
import {
  isEditableResolvedProperty,
  type ResolvedPropertyDefinition
} from "./databaseProperty.js";
import { catchStoreMutation } from "./databaseMutationUtils.js";
import { resolveDatabaseRowTitle } from "./databaseRowPresentation.js";
import {
  dateKeyFromAxisPercent,
  percentFromTrackClientX
} from "./databaseTimelineModel.js";
import type { DatabaseViewRendererContext } from "./databaseViewRenderers.js";
import type { DatabaseViewType } from "./types.js";

const GANTT_DRAG_MIME = "application/x-oe-gantt-row";

function openRow(ctx: DatabaseViewRendererContext, rowKey: string): void {
  const onOpen = ctx.runtime.onOpenRow;
  if (!onOpen) return;
  onOpen({
    databaseId: ctx.snapshot.databaseId,
    rowKey,
    viewId: ctx.viewId,
    viewType: "gantt" as DatabaseViewType
  });
}

function canEditGanttEndpoint(
  prop: ResolvedPropertyDefinition | null,
  input: {
    mutationsAllowed: boolean;
    updateCapability: boolean;
    trashMode: "active" | "trash";
  }
): boolean {
  if (!prop) return false;
  return (
    canMutateCalendarDate({
      mutationsAllowed: input.mutationsAllowed,
      updateCapability: input.updateCapability,
      trashMode: input.trashMode,
      dateProperty: prop,
      targetDateKey: "2026-01-01"
    }) && isEditableResolvedProperty(prop)
  );
}

function buildGanttRangeUpdateRow(
  item: DatabaseRowItem,
  startProp: ResolvedPropertyDefinition,
  endProp: ResolvedPropertyDefinition,
  startKey: string,
  endKey: string
): Record<string, JsonValue> | null {
  if (compareCanonicalDateKeys(startKey, endKey) > 0) return null;

  if (startProp.id === endProp.id) {
    return buildCalendarDateUpdateRow(item, startProp.id, startKey);
  }

  const startUpdate = buildCalendarDateUpdateRow(item, startProp.id, startKey);
  const endUpdate = buildCalendarDateUpdateRow(item, endProp.id, endKey);
  if (!startUpdate || !endUpdate) return null;

  return {
    ...item.row,
    [startProp.id]: startKey,
    [endProp.id]: endKey
  };
}

export function GanttRenderer(
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

  const eligible = listCalendarDateProperties(definitions);
  const [startPropertyId, setStartPropertyId] = useState<string | null>(
    () => resolveGanttEndpoints(definitions, null, null).startProp?.id ?? null
  );
  const [endPropertyId, setEndPropertyId] = useState<string | null>(
    () => resolveGanttEndpoints(definitions, null, null).endProp?.id ?? null
  );

  useEffect(() => {
    const resolved = resolveGanttEndpoints(
      definitions,
      startPropertyId,
      endPropertyId
    );
    const nextStartId = resolved.startProp?.id ?? null;
    const nextEndId = resolved.endProp?.id ?? null;
    if (nextStartId !== startPropertyId) {
      setStartPropertyId(nextStartId);
    }
    if (nextEndId !== endPropertyId) {
      setEndPropertyId(nextEndId);
    }
  }, [definitions, startPropertyId, endPropertyId]);

  const { startProp, endProp } = resolveGanttEndpoints(
    definitions,
    startPropertyId,
    endPropertyId
  );
  const sameProperty =
    startProp != null && endProp != null && startProp.id === endProp.id;

  const layout = buildGanttLayout({
    items: snap.items,
    startProp,
    endProp
  });

  const trashMode = snap.queryState.trashMode;
  const updateCapable = snap.capabilities.update;

  const mutateCtx = {
    mutationsAllowed,
    updateCapability: updateCapable,
    trashMode
  };

  const canMoveRange =
    startProp != null &&
    endProp != null &&
    canEditGanttEndpoint(startProp, mutateCtx) &&
    canEditGanttEndpoint(endProp, mutateCtx);

  const applyRangeUpdate = (
    item: DatabaseRowItem,
    startKey: string,
    endKey: string
  ): void => {
    if (!startProp || !endProp) return;
    const completeRow = buildGanttRangeUpdateRow(
      item,
      startProp,
      endProp,
      startKey,
      endKey
    );
    if (!completeRow) return;
    catchStoreMutation(
      store.updateRow(viewKey, item.rowKey, completeRow, item.sortOrder)
    );
  };

  const mutateStart = (item: DatabaseRowItem, nextStartKey: string): void => {
    if (!startProp || !endProp || !canEditGanttEndpoint(startProp, mutateCtx)) {
      return;
    }
    const currentEnd = String(item.row[endProp.id] ?? "");
    const endKey = sameProperty ? nextStartKey : currentEnd;
    if (!sameProperty && endKey && compareCanonicalDateKeys(nextStartKey, endKey) > 0) {
      return;
    }
    applyRangeUpdate(item, nextStartKey, endKey || nextStartKey);
  };

  const mutateEnd = (item: DatabaseRowItem, nextEndKey: string): void => {
    if (!startProp || !endProp || !canEditGanttEndpoint(endProp, mutateCtx)) {
      return;
    }
    const currentStart = String(item.row[startProp.id] ?? "");
    const startKey = sameProperty ? nextEndKey : currentStart;
    if (!sameProperty && startKey && compareCanonicalDateKeys(startKey, nextEndKey) > 0) {
      return;
    }
    applyRangeUpdate(item, startKey || nextEndKey, nextEndKey);
  };

  const moveWholeRange = (
    item: DatabaseRowItem,
    startKey: string,
    endKey: string,
    newStartKey: string
  ): void => {
    if (!canMoveRange) return;
    const shifted = shiftInclusiveRange(startKey, endKey, newStartKey);
    if (!shifted) return;
    if (shifted.start === startKey && shifted.end === endKey) return;
    applyRangeUpdate(item, shifted.start, shifted.end);
  };

  const onDragStart = (
    event: DragEvent<HTMLElement>,
    item: DatabaseRowItem
  ): void => {
    if (!canMoveRange) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData(
      GANTT_DRAG_MIME,
      JSON.stringify({
        databaseId: snap.databaseId,
        rowKey: item.rowKey
      })
    );
    event.dataTransfer.effectAllowed = "move";
  };

  const onDropTrack = (
    event: DragEvent<HTMLElement>,
    placed: (typeof layout.placedRows)[number]
  ): void => {
    event.preventDefault();
    const raw = event.dataTransfer.getData(GANTT_DRAG_MIME);
    if (!raw) return;
    let payload: { databaseId?: string; rowKey?: string };
    try {
      payload = JSON.parse(raw) as { databaseId?: string; rowKey?: string };
    } catch {
      return;
    }
    if (
      payload.databaseId !== snap.databaseId ||
      typeof payload.rowKey !== "string" ||
      payload.rowKey !== placed.item.rowKey
    ) {
      return;
    }
    const percent = percentFromTrackClientX(
      event.currentTarget,
      event.clientX
    );
    const targetStartKey = dateKeyFromAxisPercent(layout.axis, percent);
    moveWholeRange(
      placed.item,
      placed.startKey,
      placed.endKey,
      targetStartKey
    );
  };

  const renderTrayItem = (item: DatabaseRowItem): ReactElement => {
    const rowTitle = resolveDatabaseRowTitle(item, definitions);
    const openable = Boolean(ctx.runtime.onOpenRow);
    const startEditable = canEditGanttEndpoint(startProp, mutateCtx);
    const endEditable =
      !sameProperty && canEditGanttEndpoint(endProp, mutateCtx);
    const milestoneEditable = sameProperty && startEditable;

    return (
      <li
        key={item.rowKey}
        className="oe-database-gantt__row"
        data-row-key={item.rowKey}
        aria-busy={
          snap.mutating?.rowKey === item.rowKey ? true : undefined
        }
      >
        {openable ? (
          <button
            type="button"
            className="oe-database-gantt__label"
            aria-label={`Open row ${rowTitle}`}
            onClick={() => openRow(ctx, item.rowKey)}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
              if (event.key === "Enter") {
                event.preventDefault();
                openRow(ctx, item.rowKey);
              }
            }}
          >
            {rowTitle}
          </button>
        ) : (
          <span className="oe-database-gantt__label">{rowTitle}</span>
        )}
        <span className="oe-database-gantt__track-spacer" aria-hidden="true" />
        {milestoneEditable && startProp ? (
          <label className="oe-database-gantt__date-input">
            <span className="oe-sr-only">Set date for {rowTitle}</span>
            <input
              type="date"
              aria-label={`Set date for ${rowTitle}`}
              value=""
              disabled={busy}
              onChange={(event) => {
                const next = event.target.value;
                if (!next) return;
                mutateStart(item, next);
              }}
            />
          </label>
        ) : (
          <>
            {startEditable && startProp ? (
              <label className="oe-database-gantt__date-input">
                <span className="oe-sr-only">Set start date for {rowTitle}</span>
                <input
                  type="date"
                  aria-label={`Set start date for ${rowTitle}`}
                  value=""
                  disabled={busy}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (!next) return;
                    mutateStart(item, next);
                  }}
                />
              </label>
            ) : (
              <span className="oe-database-gantt__date-spacer" aria-hidden="true" />
            )}
            {endEditable && endProp ? (
              <label className="oe-database-gantt__date-input">
                <span className="oe-sr-only">Set end date for {rowTitle}</span>
                <input
                  type="date"
                  aria-label={`Set end date for ${rowTitle}`}
                  value=""
                  disabled={busy}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (!next) return;
                    mutateEnd(item, next);
                  }}
                />
              </label>
            ) : (
              <span className="oe-database-gantt__date-spacer" aria-hidden="true" />
            )}
          </>
        )}
      </li>
    );
  };

  const renderPlacedRow = (
    placed: (typeof layout.placedRows)[number]
  ): ReactElement => {
    const { item, startKey, endKey, barStyle, milestone } = placed;
    const rowTitle = resolveDatabaseRowTitle(item, definitions);
    const openable = Boolean(ctx.runtime.onOpenRow);
    const startEditable = canEditGanttEndpoint(startProp, mutateCtx);
    const endEditable =
      !sameProperty && canEditGanttEndpoint(endProp, mutateCtx);
    const milestoneEditable = sameProperty && startEditable;

    return (
      <div
        key={item.rowKey}
        className="oe-database-gantt__row"
        data-row-key={item.rowKey}
        aria-busy={
          snap.mutating?.rowKey === item.rowKey ? true : undefined
        }
      >
        {openable ? (
          <button
            type="button"
            className="oe-database-gantt__label"
            aria-label={`Open row ${rowTitle}`}
            onClick={() => openRow(ctx, item.rowKey)}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
              if (event.key === "Enter") {
                event.preventDefault();
                openRow(ctx, item.rowKey);
              }
            }}
          >
            {rowTitle}
          </button>
        ) : (
          <span className="oe-database-gantt__label">{rowTitle}</span>
        )}
        <div
          className="oe-database-gantt__track"
          role="presentation"
          onDragOver={
            canMoveRange
              ? (event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              : undefined
          }
          onDrop={
            canMoveRange ? (event) => onDropTrack(event, placed) : undefined
          }
        >
          <div
            className={
              milestone
                ? "oe-database-gantt__bar oe-database-gantt__bar--milestone"
                : "oe-database-gantt__bar"
            }
            style={{
              left: `${barStyle.leftPercent}%`,
              width: `${barStyle.widthPercent}%`
            }}
            data-start={startKey}
            data-end={endKey}
            draggable={canMoveRange}
            onDragStart={(event) => onDragStart(event, item)}
            aria-hidden="true"
          />
        </div>
        {milestoneEditable && startProp ? (
          <label className="oe-database-gantt__date-input">
            <span className="oe-sr-only">Date for {rowTitle}</span>
            <input
              type="date"
              aria-label={`Date for ${rowTitle}`}
              value={startKey}
              disabled={busy}
              onChange={(event) => {
                const next = event.target.value;
                if (!next) return;
                mutateStart(item, next);
              }}
            />
          </label>
        ) : (
          <>
            {startEditable && startProp ? (
              <label className="oe-database-gantt__date-input">
                <span className="oe-sr-only">Start date for {rowTitle}</span>
                <input
                  type="date"
                  aria-label={`Start date for ${rowTitle}`}
                  value={startKey}
                  disabled={busy}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (!next) return;
                    mutateStart(item, next);
                  }}
                />
              </label>
            ) : (
              <span className="oe-database-gantt__date-spacer" aria-hidden="true" />
            )}
            {endEditable && endProp ? (
              <label className="oe-database-gantt__date-input">
                <span className="oe-sr-only">End date for {rowTitle}</span>
                <input
                  type="date"
                  aria-label={`End date for ${rowTitle}`}
                  value={endKey}
                  disabled={busy}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (!next) return;
                    mutateEnd(item, next);
                  }}
                />
              </label>
            ) : (
              <span className="oe-database-gantt__date-spacer" aria-hidden="true" />
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div
      className="oe-database-gantt"
      role="region"
      aria-label={`${title} gantt`}
      data-oe-gantt=""
      data-busy={busy ? "true" : "false"}
      aria-busy={busy || undefined}
    >
      <div
        className="oe-database-gantt__controls"
        role="toolbar"
        aria-label="Gantt controls"
      >
        {eligible.length > 0 ? (
          <>
            <label>
              <span>Start property</span>
              <select
                aria-label="Gantt start date property"
                value={startProp?.id ?? ""}
                onChange={(event) => setStartPropertyId(event.target.value)}
              >
                {eligible.map((def) => (
                  <option key={def.id} value={def.id}>
                    {def.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>End property</span>
              <select
                aria-label="Gantt end date property"
                value={endProp?.id ?? ""}
                onChange={(event) => setEndPropertyId(event.target.value)}
              >
                {eligible.map((def) => (
                  <option key={def.id} value={def.id}>
                    {def.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <p className="oe-database-view__hint" role="status">
            Add a date property to use Gantt.
          </p>
        )}
        <span className="oe-database-gantt__range" aria-live="polite">
          {layout.axis.startDateKey} — {layout.axis.endDateKey}
        </span>
      </div>

      {snap.pagination.hasMore ? (
        <p className="oe-database-view__notice" role="status">
          Showing loaded rows only — axis spans loaded dated rows; more may
          exist outside this range.
        </p>
      ) : null}

      {!startProp || !endProp ? (
        <p className="oe-database-view__empty" role="status">
          Add a date property to use Gantt.
        </p>
      ) : (
        <div className="oe-database-gantt__scroll">
          <div className="oe-database-gantt__axis" aria-hidden="true">
            {layout.axis.ticks.map((tick) => (
              <div
                key={tick.dateKey}
                className="oe-database-gantt__tick"
                style={{ left: `${tick.percent}%` }}
                data-date={tick.dateKey}
              >
                {tick.label}
              </div>
            ))}
            {layout.axis.todayPercent != null ? (
              <div
                className="oe-database-gantt__today"
                style={{ left: `${layout.axis.todayPercent}%` }}
              >
                <span>Today</span>
              </div>
            ) : null}
          </div>

          <div className="oe-database-gantt__rows">
            {layout.placedRows.map((placed) => renderPlacedRow(placed))}
          </div>
        </div>
      )}

      <section
        className="oe-database-gantt__tray"
        aria-label="Incomplete range"
      >
        <h4 className="oe-database-gantt__tray-title">Incomplete range</h4>
        {layout.incompleteItems.length === 0 ? (
          <p className="oe-database-view__hint">
            No incomplete-range rows in loaded page.
          </p>
        ) : (
          <ul className="oe-database-gantt__tray-list">
            {layout.incompleteItems.map((item) => renderTrayItem(item))}
          </ul>
        )}
      </section>

      <section
        className="oe-database-gantt__tray oe-database-gantt__tray--invalid"
        aria-label="Invalid range"
      >
        <h4 className="oe-database-gantt__tray-title">Invalid range</h4>
        {layout.invalidItems.length === 0 ? (
          <p className="oe-database-view__hint">
            No invalid-range rows in loaded page.
          </p>
        ) : (
          <ul className="oe-database-gantt__tray-list">
            {layout.invalidItems.map((item) => renderTrayItem(item))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Default gantt entry for the renderer map (component, not a bare call). */
export const renderGanttView = GanttRenderer;
