/**
 * Calendar renderer — month/week date layout over DatabaseRuntimeStore rows (4F-4A).
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
  buildCalendarLayout,
  canMutateCalendarDate,
  listCalendarDateProperties,
  resolveCalendarDateProperty,
  shiftCalendarCursor,
  todayCanonicalDateKey,
  type CalendarScale
} from "./databaseCalendarModel.js";
import { isEditableResolvedProperty } from "./databaseProperty.js";
import { catchStoreMutation } from "./databaseMutationUtils.js";
import { resolveDatabaseRowTitle } from "./databaseRowPresentation.js";
import type { DatabaseViewRendererContext } from "./databaseViewRenderers.js";
import type { DatabaseViewType } from "./types.js";

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
    viewType: "calendar" as DatabaseViewType
  });
}

export function CalendarRenderer(
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
  const [scale, setScale] = useState<CalendarScale>("month");
  const [cursorDateKey, setCursorDateKey] = useState(() =>
    todayCanonicalDateKey()
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

  const layout = buildCalendarLayout({
    items: snap.items,
    dateProperty,
    scale,
    cursorDateKey
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

  const dayDroppable = (dateKey: string): boolean =>
    canMutateCalendarDate({
      mutationsAllowed,
      updateCapability: updateCapable,
      trashMode,
      dateProperty,
      targetDateKey: dateKey
    });

  const onDragStart = (
    event: DragEvent<HTMLElement>,
    item: DatabaseRowItem
  ) => {
    if (!dateProperty || trashMode !== "active") {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData(
      "application/x-oe-calendar-row",
      JSON.stringify({
        databaseId: snap.databaseId,
        rowKey: item.rowKey
      })
    );
    event.dataTransfer.effectAllowed = "move";
  };

  const onDropDay = (event: DragEvent<HTMLElement>, dateKey: string) => {
    event.preventDefault();
    if (!dayDroppable(dateKey)) return;
    const raw = event.dataTransfer.getData("application/x-oe-calendar-row");
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
    mutateDate(item, dateKey);
  };

  const renderItem = (item: DatabaseRowItem): ReactElement => {
    const cardTitle = resolveDatabaseRowTitle(item, definitions);
    const openable = Boolean(ctx.runtime.onOpenRow);
    const canEdit =
      dateProperty != null &&
      mutationsAllowed &&
      updateCapable &&
      trashMode === "active" &&
      !dateProperty.readOnly &&
      dateProperty.source === "typed" &&
      isEditableResolvedProperty(dateProperty);

    return (
      <li
        key={item.rowKey}
        className="oe-database-calendar__item"
        data-row-key={item.rowKey}
        draggable={Boolean(canEdit)}
        onDragStart={(event) => onDragStart(event, item)}
        aria-busy={
          snap.mutating?.rowKey === item.rowKey ? true : undefined
        }
      >
        {openable ? (
          <button
            type="button"
            className="oe-database-calendar__item-title"
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
          <span className="oe-database-calendar__item-title">{cardTitle}</span>
        )}
        {canEdit && dateProperty ? (
          <label className="oe-database-calendar__date-input">
            <span className="oe-sr-only">
              Move date for {item.rowKey}
            </span>
            <input
              type="date"
              aria-label={`Move date for ${item.rowKey}`}
              value={
                typeof item.row[dateProperty.id] === "string" &&
                /^\d{4}-\d{2}-\d{2}$/.test(String(item.row[dateProperty.id]))
                  ? String(item.row[dateProperty.id])
                  : ""
              }
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

  return (
    <div
      className="oe-database-calendar"
      role="region"
      aria-label={`${title} calendar`}
      data-oe-calendar=""
      data-scale={scale}
      data-busy={busy ? "true" : "false"}
      aria-busy={busy || undefined}
    >
      <div className="oe-database-calendar__controls" role="toolbar" aria-label="Calendar controls">
        {eligible.length > 0 ? (
          <label>
            <span>Date property</span>
            <select
              aria-label="Calendar date property"
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
            No date property — rows appear under No date.
          </p>
        )}
        <div className="oe-database-calendar__scale" role="group" aria-label="Calendar scale">
          <button
            type="button"
            className={
              scale === "month"
                ? "oe-database-view__chip oe-database-view__chip--on"
                : "oe-database-view__chip"
            }
            aria-pressed={scale === "month"}
            onClick={() => setScale("month")}
          >
            Month
          </button>
          <button
            type="button"
            className={
              scale === "week"
                ? "oe-database-view__chip oe-database-view__chip--on"
                : "oe-database-view__chip"
            }
            aria-pressed={scale === "week"}
            onClick={() => setScale("week")}
          >
            Week
          </button>
        </div>
        <div className="oe-database-calendar__nav" role="group" aria-label="Calendar navigation">
          <button
            type="button"
            className="oe-database-view__chip"
            aria-label="Previous"
            onClick={() =>
              setCursorDateKey((prev) => shiftCalendarCursor(prev, scale, -1))
            }
          >
            Previous
          </button>
          <button
            type="button"
            className="oe-database-view__chip"
            aria-label="Today"
            onClick={() => setCursorDateKey(todayCanonicalDateKey())}
          >
            Today
          </button>
          <button
            type="button"
            className="oe-database-view__chip"
            aria-label="Next"
            onClick={() =>
              setCursorDateKey((prev) => shiftCalendarCursor(prev, scale, 1))
            }
          >
            Next
          </button>
        </div>
        <span className="oe-database-calendar__focus" aria-live="polite">
          {layout.focusLabel}
        </span>
      </div>

      {snap.pagination.hasMore ? (
        <p className="oe-database-view__notice" role="status">
          Showing loaded rows only — empty days may still have unloaded rows.
        </p>
      ) : null}

      {!dateProperty ? (
        <p className="oe-database-view__empty" role="status">
          No date property available for calendar placement.
        </p>
      ) : (
        <div
          className={
            scale === "week"
              ? "oe-database-calendar__grid oe-database-calendar__grid--week"
              : "oe-database-calendar__grid oe-database-calendar__grid--month"
          }
        >
          {layout.weekdayLabels.map((label) => (
            <div
              key={label}
              className="oe-database-calendar__weekday"
              role="columnheader"
            >
              {label}
            </div>
          ))}
          {layout.days.map((day) => (
            <div
              key={day.dateKey}
              className={
                day.inFocusedMonth
                  ? "oe-database-calendar__day"
                  : "oe-database-calendar__day oe-database-calendar__day--outside"
              }
              data-date={day.dateKey}
              data-today={day.isToday ? "true" : "false"}
              aria-label={`${day.dateKey}${day.isToday ? " (today)" : ""}`}
              onDragOver={
                dayDroppable(day.dateKey)
                  ? (event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }
                  : undefined
              }
              onDrop={
                dayDroppable(day.dateKey)
                  ? (event) => onDropDay(event, day.dateKey)
                  : undefined
              }
            >
              <div className="oe-database-calendar__day-number">
                <span aria-hidden="true">{day.day}</span>
                {day.isToday ? (
                  <span className="oe-database-calendar__today-mark">Today</span>
                ) : null}
              </div>
              <ul className="oe-database-calendar__day-items">
                {day.items.map((item) => renderItem(item))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <section
        className="oe-database-calendar__undated"
        aria-label="No date"
      >
        <h4 className="oe-database-calendar__undated-title">No date</h4>
        {layout.undatedItems.length === 0 ? (
          <p className="oe-database-view__hint">No undated rows in loaded page.</p>
        ) : (
          <ul className="oe-database-calendar__undated-list">
            {layout.undatedItems.map((item) => renderItem(item))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Default calendar entry for the renderer map (component, not a bare call). */
export const renderCalendarView = CalendarRenderer;
