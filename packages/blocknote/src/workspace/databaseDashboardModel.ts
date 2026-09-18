/**
 * Dashboard presentation aggregates (Phase 4F-4E).
 * Loaded-snapshot descriptive summary only — no product BI heuristics.
 */
import type { DatabaseRowItem } from "@hello-ai-company/editor-core";
import {
  buildCategoricalChart,
  categoryKeyEncode,
  type ChartCategoryKey
} from "./databaseChartModel.js";
import {
  classifyTimelineDate,
  parseCanonicalDateKey
} from "./databaseDateAxisModel.js";
import {
  listCalendarDateProperties,
  resolveCalendarDateProperty
} from "./databaseCalendarModel.js";
import type { ResolvedPropertyDefinition } from "./databaseProperty.js";

export function listDashboardCategoricalProperties(
  definitions: readonly ResolvedPropertyDefinition[]
): ResolvedPropertyDefinition[] {
  return definitions.filter(
    (d) => d.type === "status" || d.type === "select"
  );
}

export function listDashboardNumericProperties(
  definitions: readonly ResolvedPropertyDefinition[]
): ResolvedPropertyDefinition[] {
  return definitions.filter((d) => d.type === "number");
}

export function listDashboardDateProperties(
  definitions: readonly ResolvedPropertyDefinition[]
): ResolvedPropertyDefinition[] {
  return listCalendarDateProperties(definitions);
}

export function resolveDashboardCategoricalProperty(
  definitions: readonly ResolvedPropertyDefinition[],
  selectedPropertyId: string | null | undefined
): ResolvedPropertyDefinition | null {
  const eligible = listDashboardCategoricalProperties(definitions);
  if (selectedPropertyId) {
    const match = eligible.find((d) => d.id === selectedPropertyId);
    if (match) return match;
  }
  return eligible[0] ?? null;
}

export function resolveDashboardNumericProperty(
  definitions: readonly ResolvedPropertyDefinition[],
  selectedPropertyId: string | null | undefined
): ResolvedPropertyDefinition | null {
  const eligible = listDashboardNumericProperties(definitions);
  if (selectedPropertyId) {
    const match = eligible.find((d) => d.id === selectedPropertyId);
    if (match) return match;
  }
  return eligible[0] ?? null;
}

export function resolveDashboardDateProperty(
  definitions: readonly ResolvedPropertyDefinition[],
  selectedPropertyId: string | null | undefined
): ResolvedPropertyDefinition | null {
  return resolveCalendarDateProperty(definitions, selectedPropertyId);
}

export type DashboardNumericSummary = {
  finiteCount: number;
  skippedCount: number;
  sum: number;
  average: number | null;
  min: number | null;
  max: number | null;
};

/**
 * Single-pass finite-number accumulator (no Math.min(...hugeArrays)).
 * Strings / non-finite values are skipped — never coerced.
 */
export function buildDashboardNumericSummary(input: {
  items: readonly DatabaseRowItem[];
  metric: ResolvedPropertyDefinition;
}): DashboardNumericSummary {
  let finiteCount = 0;
  let skippedCount = 0;
  let sum = 0;
  let min: number | null = null;
  let max: number | null = null;

  for (const item of input.items) {
    const raw = item.row[input.metric.id];
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      skippedCount++;
      continue;
    }
    finiteCount++;
    sum += raw;
    if (min === null || raw < min) min = raw;
    if (max === null || raw > max) max = raw;
  }

  return {
    finiteCount,
    skippedCount,
    sum,
    average: finiteCount > 0 ? sum / finiteCount : null,
    min,
    max
  };
}

export type DashboardDateSummary = {
  validCount: number;
  missingCount: number;
  invalidCount: number;
  earliest: string | null;
  latest: string | null;
};

export function buildDashboardDateSummary(input: {
  items: readonly DatabaseRowItem[];
  dateProperty: ResolvedPropertyDefinition;
}): DashboardDateSummary {
  let validCount = 0;
  let missingCount = 0;
  let invalidCount = 0;
  let earliest: string | null = null;
  let latest: string | null = null;

  for (const item of input.items) {
    const raw = item.row[input.dateProperty.id];
    const kind = classifyTimelineDate(raw);
    if (kind === "missing") {
      missingCount++;
      continue;
    }
    if (kind === "invalid") {
      invalidCount++;
      continue;
    }
    const parsed = parseCanonicalDateKey(raw);
    if (!parsed) {
      invalidCount++;
      continue;
    }
    validCount++;
    if (earliest === null || parsed.dateKey < earliest) {
      earliest = parsed.dateKey;
    }
    if (latest === null || parsed.dateKey > latest) {
      latest = parsed.dateKey;
    }
  }

  return {
    validCount,
    missingCount,
    invalidCount,
    earliest,
    latest
  };
}

export type DashboardCategoricalBucket = {
  key: ChartCategoryKey;
  label: string;
  count: number;
  keyEncode: string;
};

/**
 * Reuse Chart categorical identity (Empty / Invalid / option order).
 */
export function buildDashboardCategoricalSummary(input: {
  items: readonly DatabaseRowItem[];
  metric: ResolvedPropertyDefinition;
}): { buckets: DashboardCategoricalBucket[] } {
  const { buckets } = buildCategoricalChart(input);
  return {
    buckets: buckets.map((b) => ({
      ...b,
      keyEncode: categoryKeyEncode(b.key)
    }))
  };
}

export type DashboardOverview = {
  loadedRowCount: number;
  propertyDefinitionCount: number;
};

export function buildDashboardOverview(input: {
  items: readonly DatabaseRowItem[];
  definitions: readonly ResolvedPropertyDefinition[];
}): DashboardOverview {
  return {
    loadedRowCount: input.items.length,
    propertyDefinitionCount: input.definitions.length
  };
}
