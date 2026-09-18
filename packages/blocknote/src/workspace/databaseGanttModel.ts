/**
 * Gantt layout transforms (Phase 4F-4C).
 * Provider order preserved — no re-sort, no silent endpoint swap.
 */
import type { DatabaseRowItem } from "@hello-ai-company/editor-core";
import {
  buildDateAxisFromDateKeys,
  classifyGanttRange,
  rangeToBarStyle,
  type DatabaseDateAxis
} from "./databaseDateAxisModel.js";
import { listCalendarDateProperties } from "./databaseCalendarModel.js";
import type { ResolvedPropertyDefinition } from "./databaseProperty.js";

export type GanttPlacedRow = {
  item: DatabaseRowItem;
  startKey: string;
  endKey: string;
  milestone: boolean;
  barStyle: { leftPercent: number; widthPercent: number };
};

export type GanttLayout = {
  axis: DatabaseDateAxis;
  placedRows: GanttPlacedRow[];
  incompleteItems: DatabaseRowItem[];
  invalidItems: DatabaseRowItem[];
};

export function resolveGanttEndpoints(
  definitions: readonly ResolvedPropertyDefinition[],
  startId: string | null | undefined,
  endId: string | null | undefined
): {
  startProp: ResolvedPropertyDefinition | null;
  endProp: ResolvedPropertyDefinition | null;
} {
  const eligible = listCalendarDateProperties(definitions);
  if (eligible.length === 0) {
    return { startProp: null, endProp: null };
  }

  let startProp: ResolvedPropertyDefinition | null = null;
  if (startId) {
    startProp = eligible.find((def) => def.id === startId) ?? null;
  }
  if (!startProp) {
    startProp = eligible[0] ?? null;
  }

  let endProp: ResolvedPropertyDefinition | null = null;
  if (endId) {
    endProp = eligible.find((def) => def.id === endId) ?? null;
  }
  if (!endProp) {
    if (eligible.length >= 2) {
      endProp =
        eligible.find((def) => def.id !== startProp!.id) ??
        eligible[1] ??
        startProp;
    } else {
      endProp = startProp;
    }
  }

  return { startProp, endProp };
}

export function buildGanttLayout(input: {
  items: readonly DatabaseRowItem[];
  startProp: ResolvedPropertyDefinition | null;
  endProp: ResolvedPropertyDefinition | null;
  todayKey?: string;
}): GanttLayout {
  const incompleteItems: DatabaseRowItem[] = [];
  const invalidItems: DatabaseRowItem[] = [];
  const validKeys: string[] = [];
  const validEntries: {
    item: DatabaseRowItem;
    startKey: string;
    endKey: string;
    milestone: boolean;
  }[] = [];

  if (!input.startProp || !input.endProp) {
    return {
      axis: buildDateAxisFromDateKeys({
        dateKeys: [],
        todayKey: input.todayKey
      }),
      placedRows: [],
      incompleteItems: [...input.items],
      invalidItems: []
    };
  }

  const startId = input.startProp.id;
  const endId = input.endProp.id;
  const sameProperty = startId === endId;

  for (const item of input.items) {
    const classification = classifyGanttRange({
      startValue: item.row[startId],
      endValue: item.row[endId],
      sameProperty
    });

    if (classification.kind === "incomplete") {
      incompleteItems.push(item);
      continue;
    }
    if (classification.kind === "invalid") {
      invalidItems.push(item);
      continue;
    }

    validKeys.push(classification.startKey, classification.endKey);
    validEntries.push({
      item,
      startKey: classification.startKey,
      endKey: classification.endKey,
      milestone: classification.milestone
    });
  }

  const axis = buildDateAxisFromDateKeys({
    dateKeys: validKeys,
    todayKey: input.todayKey
  });

  const placedRows: GanttPlacedRow[] = [];
  for (const entry of validEntries) {
    const barStyle = rangeToBarStyle(
      axis.startDateKey,
      axis.endDateKey,
      entry.startKey,
      entry.endKey
    );
    if (!barStyle) {
      invalidItems.push(entry.item);
      continue;
    }
    placedRows.push({
      item: entry.item,
      startKey: entry.startKey,
      endKey: entry.endKey,
      milestone: entry.milestone,
      barStyle
    });
  }

  return { axis, placedRows, incompleteItems, invalidItems };
}
