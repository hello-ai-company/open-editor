/**
 * Timeline layout transforms (Phase 4F-4C).
 * Provider order preserved — no re-sort.
 */
import type { DatabaseRowItem } from "@hello-ai-company/editor-core";
import {
  addCalendarDays,
  buildDateAxisFromDateKeys,
  classifyTimelineDate,
  dateKeyToPercent,
  parseCanonicalDateKey,
  type DatabaseDateAxis
} from "./databaseDateAxisModel.js";
import type { ResolvedPropertyDefinition } from "./databaseProperty.js";

export type TimelinePlacedRow = {
  item: DatabaseRowItem;
  dateKey: string;
  percent: number;
};

export type TimelineLayout = {
  axis: DatabaseDateAxis;
  placedRows: TimelinePlacedRow[];
  missingItems: DatabaseRowItem[];
  invalidItems: DatabaseRowItem[];
};

export function buildTimelineLayout(input: {
  items: readonly DatabaseRowItem[];
  dateProperty: ResolvedPropertyDefinition | null;
  todayKey?: string;
}): TimelineLayout {
  const missingItems: DatabaseRowItem[] = [];
  const invalidItems: DatabaseRowItem[] = [];
  const validKeys: string[] = [];
  const validEntries: { item: DatabaseRowItem; dateKey: string }[] = [];

  if (!input.dateProperty) {
    return {
      axis: buildDateAxisFromDateKeys({
        dateKeys: [],
        todayKey: input.todayKey
      }),
      placedRows: [],
      missingItems: [...input.items],
      invalidItems: []
    };
  }

  const propId = input.dateProperty.id;

  for (const item of input.items) {
    const value = item.row[propId];
    const classification = classifyTimelineDate(value);
    if (classification === "missing") {
      missingItems.push(item);
      continue;
    }
    if (classification === "invalid") {
      invalidItems.push(item);
      continue;
    }
    const parsed = parseCanonicalDateKey(value);
    if (!parsed) {
      invalidItems.push(item);
      continue;
    }
    validKeys.push(parsed.dateKey);
    validEntries.push({ item, dateKey: parsed.dateKey });
  }

  const axis = buildDateAxisFromDateKeys({
    dateKeys: validKeys,
    todayKey: input.todayKey
  });

  const placedRows: TimelinePlacedRow[] = validEntries.map(
    ({ item, dateKey }) => ({
      item,
      dateKey,
      percent:
        dateKeyToPercent(axis.startDateKey, axis.endDateKey, dateKey) ?? 50
    })
  );

  return { axis, placedRows, missingItems, invalidItems };
}

/** Map horizontal drop position (0–100) to a canonical date on the axis. */
export function dateKeyFromAxisPercent(
  axis: DatabaseDateAxis,
  percent: number
): string {
  const clamped = Math.max(0, Math.min(100, percent));
  if (axis.spanDays <= 1) return axis.startDateKey;
  const offsetDays = Math.round((clamped / 100) * (axis.spanDays - 1));
  return addCalendarDays(axis.startDateKey, offsetDays);
}

export function percentFromTrackClientX(
  track: HTMLElement,
  clientX: number
): number {
  const rect = track.getBoundingClientRect();
  if (rect.width <= 0) return 50;
  const x = clientX - rect.left;
  return Math.max(0, Math.min(100, (x / rect.width) * 100));
}
