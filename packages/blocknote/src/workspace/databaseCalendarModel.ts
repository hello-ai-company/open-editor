/**
 * Calendar date presentation transforms (Phase 4F-4A).
 * Date-only YYYY-MM-DD — no timezone / datetime / ranges.
 */
import type {
  DatabaseRowItem,
  JsonValue
} from "@hello-ai-company/editor-core";
import {
  isIsoDateString,
  type ResolvedPropertyDefinition
} from "./databaseProperty.js";

export type CalendarScale = "month" | "week";

export type CalendarDayCell = {
  /** YYYY-MM-DD key (stable, timezone-independent). */
  dateKey: string;
  year: number;
  month: number; // 1-12
  day: number;
  /** True when cell belongs to the focused month (month mode padding). */
  inFocusedMonth: boolean;
  isToday: boolean;
  items: DatabaseRowItem[];
};

export type CalendarLayout = {
  scale: CalendarScale;
  /** First day shown (Sunday-aligned week start). */
  startDateKey: string;
  /** Inclusive focus label, e.g. "2026-09". */
  focusLabel: string;
  weekdayLabels: readonly string[];
  days: CalendarDayCell[];
  undatedItems: DatabaseRowItem[];
};

export const CALENDAR_WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat"
] as const;

export function isCalendarDateProperty(
  def: ResolvedPropertyDefinition
): boolean {
  return def.type === "date";
}

export function listCalendarDateProperties(
  definitions: readonly ResolvedPropertyDefinition[]
): ResolvedPropertyDefinition[] {
  return definitions.filter(isCalendarDateProperty);
}

export function defaultCalendarDateProperty(
  definitions: readonly ResolvedPropertyDefinition[]
): ResolvedPropertyDefinition | null {
  return listCalendarDateProperties(definitions)[0] ?? null;
}

export function resolveCalendarDateProperty(
  definitions: readonly ResolvedPropertyDefinition[],
  selectedPropertyId: string | null | undefined
): ResolvedPropertyDefinition | null {
  const eligible = listCalendarDateProperties(definitions);
  if (selectedPropertyId) {
    const match = eligible.find((d) => d.id === selectedPropertyId);
    if (match) return match;
  }
  return defaultCalendarDateProperty(definitions);
}

/**
 * Parse YYYY-MM-DD into components without Date timezone shifts.
 * Invalid / empty → null (No date).
 */
export function parseCanonicalDateKey(
  value: unknown
): { year: number; month: number; day: number; dateKey: string } | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!isIsoDateString(raw)) return null;
  const [ys, ms, ds] = raw.split("-");
  const year = Number(ys);
  const month = Number(ms);
  const day = Number(ds);
  return { year, month, day, dateKey: raw };
}

export function formatCanonicalDateKey(
  year: number,
  month: number,
  day: number
): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Civil date arithmetic in UTC noon to avoid DST edge issues on local clocks. */
function utcCivil(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function fromUtcCivil(dt: Date): {
  year: number;
  month: number;
  day: number;
  dateKey: string;
} {
  const year = dt.getUTCFullYear();
  const month = dt.getUTCMonth() + 1;
  const day = dt.getUTCDate();
  return { year, month, day, dateKey: formatCanonicalDateKey(year, month, day) };
}

export function addCalendarDays(
  dateKey: string,
  deltaDays: number
): string {
  const parsed = parseCanonicalDateKey(dateKey);
  if (!parsed) return dateKey;
  const dt = utcCivil(parsed.year, parsed.month, parsed.day);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return fromUtcCivil(dt).dateKey;
}

export function addCalendarMonths(
  dateKey: string,
  deltaMonths: number
): string {
  const parsed = parseCanonicalDateKey(dateKey);
  if (!parsed) return dateKey;
  const dt = utcCivil(parsed.year, parsed.month, 1);
  dt.setUTCMonth(dt.getUTCMonth() + deltaMonths);
  // Keep day-of-month when possible; clamp to month length.
  const lastDay = new Date(
    Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const day = Math.min(parsed.day, lastDay);
  dt.setUTCDate(day);
  return fromUtcCivil(dt).dateKey;
}

/** Sunday-aligned start of the week containing dateKey. */
export function startOfWeekSunday(dateKey: string): string {
  const parsed = parseCanonicalDateKey(dateKey);
  if (!parsed) return dateKey;
  const dt = utcCivil(parsed.year, parsed.month, parsed.day);
  const dow = dt.getUTCDay(); // 0=Sun
  dt.setUTCDate(dt.getUTCDate() - dow);
  return fromUtcCivil(dt).dateKey;
}

export function todayCanonicalDateKey(
  now: Date = new Date()
): string {
  // Use local Y/M/D components for "Today" affordance only.
  return formatCanonicalDateKey(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  );
}

export function calendarRowDateKey(
  row: Record<string, JsonValue>,
  datePropertyId: string
): string | null {
  return parseCanonicalDateKey(row[datePropertyId])?.dateKey ?? null;
}

export function canMutateCalendarDate(input: {
  mutationsAllowed: boolean;
  updateCapability: boolean;
  trashMode: "active" | "trash";
  dateProperty: ResolvedPropertyDefinition | null;
  targetDateKey: string;
}): boolean {
  if (!input.mutationsAllowed) return false;
  if (!input.updateCapability) return false;
  if (input.trashMode !== "active") return false;
  const prop = input.dateProperty;
  if (!prop) return false;
  if (prop.readOnly) return false;
  if (prop.source !== "typed") return false;
  if (prop.type !== "date") return false;
  return isIsoDateString(input.targetDateKey);
}

export function buildCalendarDateUpdateRow(
  item: DatabaseRowItem,
  datePropertyId: string,
  targetDateKey: string
): Record<string, JsonValue> | null {
  if (!isIsoDateString(targetDateKey)) return null;
  return {
    ...item.row,
    [datePropertyId]: targetDateKey
  };
}

export function buildCalendarLayout(input: {
  items: readonly DatabaseRowItem[];
  dateProperty: ResolvedPropertyDefinition | null;
  scale: CalendarScale;
  cursorDateKey: string;
  todayKey?: string;
}): CalendarLayout {
  const todayKey = input.todayKey ?? todayCanonicalDateKey();
  const undatedItems: DatabaseRowItem[] = [];
  const byDate = new Map<string, DatabaseRowItem[]>();

  if (input.dateProperty) {
    for (const item of input.items) {
      const key = calendarRowDateKey(item.row, input.dateProperty.id);
      if (!key) {
        undatedItems.push(item);
        continue;
      }
      const list = byDate.get(key);
      if (list) list.push(item);
      else byDate.set(key, [item]);
    }
  } else {
    undatedItems.push(...input.items);
  }

  const cursor =
    parseCanonicalDateKey(input.cursorDateKey) ??
    parseCanonicalDateKey(todayKey)!;

  let startKey: string;
  let dayCount: number;
  let focusLabel: string;
  let focusedMonth: number;
  let focusedYear: number;

  if (input.scale === "week") {
    startKey = startOfWeekSunday(cursor.dateKey);
    dayCount = 7;
    focusLabel = `Week of ${startKey}`;
    focusedMonth = cursor.month;
    focusedYear = cursor.year;
  } else {
    focusedYear = cursor.year;
    focusedMonth = cursor.month;
    focusLabel = `${String(focusedYear).padStart(4, "0")}-${String(focusedMonth).padStart(2, "0")}`;
    const firstOfMonth = formatCanonicalDateKey(focusedYear, focusedMonth, 1);
    startKey = startOfWeekSunday(firstOfMonth);
    // 6 weeks × 7 days covers every month.
    dayCount = 42;
  }

  const days: CalendarDayCell[] = [];
  for (let i = 0; i < dayCount; i += 1) {
    const dateKey = addCalendarDays(startKey, i);
    const parsed = parseCanonicalDateKey(dateKey)!;
    days.push({
      dateKey,
      year: parsed.year,
      month: parsed.month,
      day: parsed.day,
      inFocusedMonth:
        input.scale === "week" ||
        (parsed.year === focusedYear && parsed.month === focusedMonth),
      isToday: dateKey === todayKey,
      items: byDate.get(dateKey) ?? []
    });
  }

  return {
    scale: input.scale,
    startDateKey: startKey,
    focusLabel,
    weekdayLabels: CALENDAR_WEEKDAY_LABELS,
    days,
    undatedItems
  };
}

export function shiftCalendarCursor(
  cursorDateKey: string,
  scale: CalendarScale,
  direction: -1 | 1
): string {
  if (scale === "week") {
    return addCalendarDays(cursorDateKey, direction * 7);
  }
  return addCalendarMonths(cursorDateKey, direction);
}
