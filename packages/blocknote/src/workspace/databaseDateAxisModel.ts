/**
 * Shared date-axis model for Timeline / Gantt views (Phase 4F-4C).
 * Date-only YYYY-MM-DD — UTC civil arithmetic, no timezone shifts.
 */
import {
  addCalendarDays,
  formatCanonicalDateKey,
  listCalendarDateProperties,
  parseCanonicalDateKey,
  resolveCalendarDateProperty,
  todayCanonicalDateKey
} from "./databaseCalendarModel.js";

export {
  addCalendarDays,
  formatCanonicalDateKey,
  listCalendarDateProperties,
  parseCanonicalDateKey,
  resolveCalendarDateProperty,
  todayCanonicalDateKey
};

export type DatabaseDateAxisTick = {
  dateKey: string;
  label: string;
  offsetDays: number;
  percent: number;
};

export type DatabaseDateAxis = {
  startDateKey: string;
  endDateKey: string;
  spanDays: number;
  ticks: readonly DatabaseDateAxisTick[];
  todayOffsetDays: number | null;
  todayPercent: number | null;
};

export type GanttRangeClassification =
  | { kind: "valid"; startKey: string; endKey: string; milestone: boolean }
  | { kind: "incomplete" }
  | { kind: "invalid" };

const MIN_BAR_WIDTH_PERCENT = 2;

function isMissingDateValue(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/** Lexicographic compare for valid canonical keys; invalid keys sort after valid. */
export function compareCanonicalDateKeys(a: string, b: string): number {
  const parsedA = parseCanonicalDateKey(a);
  const parsedB = parseCanonicalDateKey(b);
  if (!parsedA && !parsedB) return 0;
  if (!parsedA) return 1;
  if (!parsedB) return -1;
  if (parsedA.dateKey < parsedB.dateKey) return -1;
  if (parsedA.dateKey > parsedB.dateKey) return 1;
  return 0;
}

/** Day offset of end relative to start (end - start). Same day = 0. */
export function daysBetweenCanonicalDates(
  startKey: string,
  endKey: string
): number | null {
  const start = parseCanonicalDateKey(startKey);
  const end = parseCanonicalDateKey(endKey);
  if (!start || !end) return null;
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endUtc - startUtc) / 86_400_000);
}

export function minCanonicalDateKey(
  ...keys: readonly string[]
): string | null {
  let best: string | null = null;
  for (const key of keys) {
    const parsed = parseCanonicalDateKey(key);
    if (!parsed) continue;
    if (best === null || compareCanonicalDateKeys(parsed.dateKey, best) < 0) {
      best = parsed.dateKey;
    }
  }
  return best;
}

export function maxCanonicalDateKey(
  ...keys: readonly string[]
): string | null {
  let best: string | null = null;
  for (const key of keys) {
    const parsed = parseCanonicalDateKey(key);
    if (!parsed) continue;
    if (best === null || compareCanonicalDateKeys(parsed.dateKey, best) > 0) {
      best = parsed.dateKey;
    }
  }
  return best;
}

export function dateKeyToOffsetDays(
  axisStart: string,
  dateKey: string
): number | null {
  return daysBetweenCanonicalDates(axisStart, dateKey);
}

export function dateKeyToPercent(
  axisStart: string,
  axisEnd: string,
  dateKey: string
): number | null {
  const offset = dateKeyToOffsetDays(axisStart, dateKey);
  if (offset === null) return null;

  const spanDays = inclusiveSpanDays(axisStart, axisEnd);
  if (spanDays === null) return null;
  if (spanDays <= 1) return 50;

  const raw = (offset / (spanDays - 1)) * 100;
  return clampPercent(raw);
}

export function rangeToBarStyle(
  axisStart: string,
  axisEnd: string,
  startKey: string,
  endKey: string
): { leftPercent: number; widthPercent: number } | null {
  const startOffset = dateKeyToOffsetDays(axisStart, startKey);
  const endOffset = dateKeyToOffsetDays(axisStart, endKey);
  if (startOffset === null || endOffset === null) return null;
  if (startOffset > endOffset) return null;

  const spanDays = inclusiveSpanDays(axisStart, axisEnd);
  if (spanDays === null || spanDays <= 0) return null;

  const durationDays = endOffset - startOffset + 1;

  if (spanDays <= 1) {
    const widthPercent = Math.max(MIN_BAR_WIDTH_PERCENT, 100);
    return {
      leftPercent: clampPercent(50 - widthPercent / 2),
      widthPercent
    };
  }

  const dayWidth = 100 / spanDays;
  let leftPercent = (startOffset / spanDays) * 100;
  let widthPercent = durationDays * dayWidth;

  if (durationDays === 1) {
    widthPercent = Math.max(MIN_BAR_WIDTH_PERCENT, widthPercent);
    leftPercent = clampPercent(leftPercent + dayWidth / 2 - widthPercent / 2);
  }

  return {
    leftPercent: clampPercent(leftPercent),
    widthPercent: clampPercent(widthPercent)
  };
}

function inclusiveSpanDays(startKey: string, endKey: string): number | null {
  const delta = daysBetweenCanonicalDates(startKey, endKey);
  if (delta === null) return null;
  return delta + 1;
}

function clampPercent(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function formatTickLabel(dateKey: string): string {
  const parsed = parseCanonicalDateKey(dateKey);
  if (!parsed) return dateKey;
  if (parsed.month === 1 && parsed.day === 1) {
    return parsed.dateKey;
  }
  const m = String(parsed.month).padStart(2, "0");
  const d = String(parsed.day).padStart(2, "0");
  return `${m}-${d}`;
}

function buildAxisTicks(
  startDateKey: string,
  spanDays: number,
  maxTicks: number
): DatabaseDateAxisTick[] {
  const tickCount = Math.min(maxTicks, Math.max(1, spanDays));
  const ticks: DatabaseDateAxisTick[] = [];

  for (let i = 0; i < tickCount; i += 1) {
    const offsetDays =
      tickCount === 1 ? 0 : Math.round((i * (spanDays - 1)) / (tickCount - 1));
    const dateKey = addCalendarDays(startDateKey, offsetDays);
    const percent =
      spanDays <= 1 ? 50 : clampPercent((offsetDays / (spanDays - 1)) * 100);
    ticks.push({
      dateKey,
      label: formatTickLabel(dateKey),
      offsetDays,
      percent
    });
  }

  return ticks;
}

export function buildDateAxisFromDateKeys(input: {
  dateKeys: readonly string[];
  paddingDays?: number;
  maxTicks?: number;
  todayKey?: string;
}): DatabaseDateAxis {
  const paddingDays = input.paddingDays ?? 2;
  const maxTicks = input.maxTicks ?? 48;
  const todayKey = input.todayKey ?? todayCanonicalDateKey();

  const validKeys = input.dateKeys
    .map((key) => parseCanonicalDateKey(key)?.dateKey ?? null)
    .filter((key): key is string => key !== null);

  let startDateKey: string;
  let endDateKey: string;

  if (validKeys.length === 0) {
    startDateKey = addCalendarDays(todayKey, -7);
    endDateKey = addCalendarDays(todayKey, 7);
  } else {
    const minKey = minCanonicalDateKey(...validKeys)!;
    const maxKey = maxCanonicalDateKey(...validKeys)!;
    startDateKey = addCalendarDays(minKey, -paddingDays);
    endDateKey = addCalendarDays(maxKey, paddingDays);
  }

  const spanDays = inclusiveSpanDays(startDateKey, endDateKey) ?? 1;
  const ticks = buildAxisTicks(startDateKey, spanDays, maxTicks);

  const todayOffset = dateKeyToOffsetDays(startDateKey, todayKey);
  const rangeEndOffset = dateKeyToOffsetDays(startDateKey, endDateKey);
  const todayInAxis =
    todayOffset !== null &&
    rangeEndOffset !== null &&
    todayOffset >= 0 &&
    todayOffset <= rangeEndOffset;

  return {
    startDateKey,
    endDateKey,
    spanDays,
    ticks,
    todayOffsetDays: todayInAxis ? todayOffset : null,
    todayPercent: todayInAxis
      ? dateKeyToPercent(startDateKey, endDateKey, todayKey)
      : null
  };
}

export function shiftInclusiveRange(
  startKey: string,
  endKey: string,
  newStartKey: string
): { start: string; end: string } | null {
  const delta = daysBetweenCanonicalDates(startKey, endKey);
  const newStart = parseCanonicalDateKey(newStartKey);
  if (delta === null || !newStart) return null;
  return {
    start: newStart.dateKey,
    end: addCalendarDays(newStart.dateKey, delta)
  };
}

export function classifyTimelineDate(
  value: unknown
): "valid" | "missing" | "invalid" {
  if (isMissingDateValue(value)) return "missing";
  if (parseCanonicalDateKey(value)) return "valid";
  return "invalid";
}

export function classifyGanttRange(input: {
  startValue: unknown;
  endValue: unknown;
  sameProperty: boolean;
}): GanttRangeClassification {
  const startMissing = isMissingDateValue(input.startValue);
  const endMissing = isMissingDateValue(input.endValue);
  const startParsed = parseCanonicalDateKey(input.startValue);
  const endParsed = parseCanonicalDateKey(input.endValue);

  if (input.sameProperty) {
    if (!startMissing && !startParsed) return { kind: "invalid" };
    if (!endMissing && !endParsed) return { kind: "invalid" };
    const validKey = startParsed?.dateKey ?? endParsed?.dateKey ?? null;
    if (!validKey) return { kind: "incomplete" };
    if (
      startParsed &&
      endParsed &&
      startParsed.dateKey !== endParsed.dateKey
    ) {
      return { kind: "invalid" };
    }
    return {
      kind: "valid",
      startKey: validKey,
      endKey: validKey,
      milestone: true
    };
  }

  if (!startMissing && !startParsed) return { kind: "invalid" };
  if (!endMissing && !endParsed) return { kind: "invalid" };
  if (startMissing || endMissing) return { kind: "incomplete" };
  if (!startParsed || !endParsed) return { kind: "invalid" };

  if (compareCanonicalDateKeys(startParsed.dateKey, endParsed.dateKey) > 0) {
    return { kind: "invalid" };
  }

  const milestone = startParsed.dateKey === endParsed.dateKey;
  return {
    kind: "valid",
    startKey: startParsed.dateKey,
    endKey: endParsed.dateKey,
    milestone
  };
}
