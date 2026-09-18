/**
 * Timeline renderer — horizontal date axis over DatabaseRuntimeStore rows (4F-4C).
 */
import type { DatabaseRowItem } from "@hello-ai-company/editor-core";
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
  listCalendarDateProperties,
  resolveCalendarDateProperty
} from "./databaseCalendarModel.js";
import {
  buildTimelineLayout,
  dateKeyFromAxisPercent,
  percentFromTrackClientX
} from "./databaseTimelineModel.js";
import { isEditableResolvedProperty } from "./databaseProperty.js";
import { catchStoreMutation } from "./databaseMutationUtils.js";
import { resolveDatabaseRowTitle } from "./databaseRowPresentation.js";
import type { DatabaseViewRendererContext } from "./databaseViewRenderers.js";
import type { DatabaseViewType } from "./types.js";

const TIMELINE_DRAG_MIME = "application/x-oe-timeline-row";

function openRow(ctx: DatabaseViewRendererContext, rowKey: string): void {
  const onOpen = ctx.runtime.onOpenRow;
  if (!onOpen) return;
  onOpen({
    databaseId: ctx.snapshot.databaseId,
    rowKey,
    viewId: ctx.viewId,
    viewType: "timeline" as DatabaseViewType
  });
}

export function TimelineRenderer(
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
  const [datePropertyId, setDatePropertyId] = useState<string | null>(
    () => resolveCalendarDateProperty(definitions, null)?.id ?? null
  );

  useEffect(() => {
    const resolved = resolveCalendarDateProperty(definitions, datePropertyId);
    const nextId = resolved?.id ?? null;
    if (nextId !== datePropertyId) {
      setDatePropertyId(nextId);
    }
  }, [definitions, datePropertyId]);

  const dateProperty = resolveCalendarDateProperty(
    definitions,
    datePropertyId
  );

  const layout = buildTimelineLayout({
    items: snap.items,
    dateProperty
  });

  const trashMode = snap.queryState.trashMode;
  const updateCapable = snap.capabilities.update;

  const mutateDate = (item: DatabaseRowItem, targetDateKey: string): void => {
    if (
      !canMutateCalendarDate({
        mutationsAllowed,
        updateCapability: updateCapable,
        trashMode,
        dateProperty,
        targetDateKey
      }) ||
      !dateProperty
    ) {
      return;
    }
    const current = item.row[dateProperty.id];
    if (String(current ?? "") === targetDateKey) return;
    const completeRow = buildCalendarDateUpdateRow(
      item,
      dateProperty.id,
      targetDateKey
    );
    if (!completeRow) return;
    catchStoreMutation(
      store.updateRow(viewKey, item.rowKey, completeRow, item.sortOrder)
    );
  };

  const trackDroppable = (targetDateKey: string): boolean =>
    canMutateCalendarDate({
      mutationsAllowed,
      updateCapability: updateCapable,
      trashMode,
      dateProperty,
      targetDateKey
    });

  const canEditRowDate = (): boolean =>
    dateProperty != null &&
    mutationsAllowed &&
    updateCapable &&
    trashMode === "active" &&
    !dateProperty.readOnly &&
    dateProperty.source === "typed" &&
    isEditableResolvedProperty(dateProperty);

  const onDragStart = (
    event: DragEvent<HTMLElement>,
    item: DatabaseRowItem
  ): void => {
    if (!canEditRowDate()) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData(
      TIMELINE_DRAG_MIME,
      JSON.stringify({
        databaseId: snap.databaseId,
        rowKey: item.rowKey
      })
    );
    event.dataTransfer.effectAllowed = "move";
  };

  const onDropTrack = (
    event: DragEvent<HTMLElement>,
    item: DatabaseRowItem
  ): void => {
    event.preventDefault();
    const raw = event.dataTransfer.getData(TIMELINE_DRAG_MIME);
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
      payload.rowKey !== item.rowKey
    ) {
      return;
    }
    const percent = percentFromTrackClientX(
      event.currentTarget,
      event.clientX
    );
    const targetDateKey = dateKeyFromAxisPercent(layout.axis, percent);
    if (!trackDroppable(targetDateKey)) return;
    mutateDate(item, targetDateKey);
  };

  const renderTrayItem = (item: DatabaseRowItem): ReactElement => {
    const rowTitle = resolveDatabaseRowTitle(item, definitions);
    const openable = Boolean(ctx.runtime.onOpenRow);
    const editable = canEditRowDate();

    return (
      <li
        key={item.rowKey}
        className="oe-database-timeline__row"
        data-row-key={item.rowKey}
        aria-busy={
          snap.mutating?.rowKey === item.rowKey ? true : undefined
        }
      >
        {openable ? (
          <button
            type="button"
            className="oe-database-timeline__label"
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
          <span className="oe-database-timeline__label">{rowTitle}</span>
        )}
        {editable && dateProperty ? (
          <label className="oe-database-timeline__date-input">
            <span className="oe-sr-only">Set date for {rowTitle}</span>
            <input
              type="date"
              aria-label={`Set date for ${rowTitle}`}
              value=""
              disabled={busy}
              onChange={(event) => {
                const next = event.target.value;
                if (!next) return;
                mutateDate(item, next);
              }}
            />
          </label>
        ) : null}
      </li>
    );
  };

  const renderPlacedRow = (placed: (typeof layout.placedRows)[number]): ReactElement => {
    const { item, dateKey, percent } = placed;
    const rowTitle = resolveDatabaseRowTitle(item, definitions);
    const openable = Boolean(ctx.runtime.onOpenRow);
    const editable = canEditRowDate();

    return (
      <div
        key={item.rowKey}
        className="oe-database-timeline__row"
        data-row-key={item.rowKey}
        aria-busy={
          snap.mutating?.rowKey === item.rowKey ? true : undefined
        }
      >
        {openable ? (
          <button
            type="button"
            className="oe-database-timeline__label"
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
          <span className="oe-database-timeline__label">{rowTitle}</span>
        )}
        <div
          className="oe-database-timeline__track"
          role="presentation"
          onDragOver={
            editable
              ? (event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              : undefined
          }
          onDrop={
            editable ? (event) => onDropTrack(event, item) : undefined
          }
        >
          <div
            className="oe-database-timeline__marker"
            style={{ left: `${percent}%` }}
            data-date={dateKey}
            draggable={editable}
            onDragStart={(event) => onDragStart(event, item)}
            aria-hidden="true"
          />
        </div>
        {editable && dateProperty ? (
          <label className="oe-database-timeline__date-input">
            <span className="oe-sr-only">Move date for {rowTitle}</span>
            <input
              type="date"
              aria-label={`Move date for ${rowTitle}`}
              value={dateKey}
              disabled={busy}
              onChange={(event) => {
                const next = event.target.value;
                if (!next) return;
                mutateDate(item, next);
              }}
            />
          </label>
        ) : null}
      </div>
    );
  };

  return (
    <div
      className="oe-database-timeline"
      role="region"
      aria-label={`${title} timeline`}
      data-oe-timeline=""
      data-busy={busy ? "true" : "false"}
      aria-busy={busy || undefined}
    >
      <div
        className="oe-database-timeline__controls"
        role="toolbar"
        aria-label="Timeline controls"
      >
        {eligible.length > 0 ? (
          <label>
            <span>Date property</span>
            <select
              aria-label="Timeline date property"
              value={dateProperty?.id ?? ""}
              onChange={(event) => setDatePropertyId(event.target.value)}
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
            Add a date property to use Timeline.
          </p>
        )}
        <span className="oe-database-timeline__range" aria-live="polite">
          {layout.axis.startDateKey} — {layout.axis.endDateKey}
        </span>
      </div>

      {snap.pagination.hasMore ? (
        <p className="oe-database-view__notice" role="status">
          Showing loaded rows only — axis spans loaded dated rows; more may
          exist outside this range.
        </p>
      ) : null}

      {!dateProperty ? (
        <p className="oe-database-view__empty" role="status">
          Add a date property to use Timeline.
        </p>
      ) : (
        <div className="oe-database-timeline__scroll">
          <div
            className="oe-database-timeline__axis"
            aria-hidden="true"
          >
            {layout.axis.ticks.map((tick) => (
              <div
                key={tick.dateKey}
                className="oe-database-timeline__tick"
                style={{ left: `${tick.percent}%` }}
                data-date={tick.dateKey}
              >
                {tick.label}
              </div>
            ))}
            {layout.axis.todayPercent != null ? (
              <div
                className="oe-database-timeline__today"
                style={{ left: `${layout.axis.todayPercent}%` }}
              >
                <span>Today</span>
              </div>
            ) : null}
          </div>

          <div className="oe-database-timeline__rows">
            {layout.placedRows.map((placed) => renderPlacedRow(placed))}
          </div>
        </div>
      )}

      <section
        className="oe-database-timeline__undated"
        aria-label="No date"
      >
        <h4 className="oe-database-timeline__undated-title">No date</h4>
        {layout.missingItems.length === 0 ? (
          <p className="oe-database-view__hint">
            No undated rows in loaded page.
          </p>
        ) : (
          <ul className="oe-database-timeline__undated-list">
            {layout.missingItems.map((item) => renderTrayItem(item))}
          </ul>
        )}
      </section>

      <section
        className="oe-database-timeline__undated oe-database-timeline__undated--invalid"
        aria-label="Invalid date"
      >
        <h4 className="oe-database-timeline__undated-title">Invalid date</h4>
        {layout.invalidItems.length === 0 ? (
          <p className="oe-database-view__hint">
            No invalid-date rows in loaded page.
          </p>
        ) : (
          <ul className="oe-database-timeline__undated-list">
            {layout.invalidItems.map((item) => renderTrayItem(item))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Default timeline entry for the renderer map (component, not a bare call). */
export const renderTimelineView = TimelineRenderer;
