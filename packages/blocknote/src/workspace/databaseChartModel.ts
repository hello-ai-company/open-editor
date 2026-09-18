/**
 * Chart presentation transforms (Phase 4F-4D).
 * Operates on already-queried snap.items — counts loaded rows only.
 */
import type { DatabaseRowItem } from "@hello-ai-company/editor-core";
import type { ResolvedPropertyDefinition } from "./databaseProperty.js";

export type ChartCategoryKey =
  | { kind: "value"; value: string }
  | { kind: "empty" }
  | { kind: "invalid" };

/** Encode a ChartCategoryKey for React keys (not CSS class names). */
export function categoryKeyEncode(key: ChartCategoryKey): string {
  if (key.kind === "value") {
    return `v:${JSON.stringify(key.value)}`;
  }
  return key.kind;
}

export function chartCategoryKeysEqual(
  a: ChartCategoryKey,
  b: ChartCategoryKey
): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "value" && b.kind === "value") {
    return a.value === b.value;
  }
  return true;
}

export function isChartMetricProperty(
  def: ResolvedPropertyDefinition
): boolean {
  return (
    def.type === "number" || def.type === "select" || def.type === "status"
  );
}

export function listChartMetricProperties(
  definitions: readonly ResolvedPropertyDefinition[]
): ResolvedPropertyDefinition[] {
  return definitions.filter(isChartMetricProperty);
}

export function resolveChartMetricProperty(
  definitions: readonly ResolvedPropertyDefinition[],
  selectedPropertyId: string | null | undefined
): ResolvedPropertyDefinition | null {
  const eligible = listChartMetricProperties(definitions);
  if (selectedPropertyId) {
    const match = eligible.find((d) => d.id === selectedPropertyId);
    if (match) return match;
  }
  return eligible[0] ?? null;
}

function classifyCategoricalValue(raw: unknown): ChartCategoryKey {
  if (raw === null || raw === undefined || raw === "") {
    return { kind: "empty" };
  }
  if (typeof raw !== "string") {
    return { kind: "invalid" };
  }
  return { kind: "value", value: raw };
}

/**
 * Categorical buckets for select/status metrics.
 * Ordering: configured options, unknown observed values, Empty, Invalid.
 */
export function buildCategoricalChart(input: {
  items: readonly DatabaseRowItem[];
  metric: ResolvedPropertyDefinition;
}): {
  buckets: Array<{
    key: ChartCategoryKey;
    label: string;
    count: number;
  }>;
} {
  const { items, metric } = input;
  const counts = new Map<string, number>();

  for (const opt of metric.options) {
    if (!counts.has(opt.value)) {
      counts.set(opt.value, 0);
    }
  }

  const observedExtras: string[] = [];
  let emptyCount = 0;
  let invalidCount = 0;

  for (const item of items) {
    const key = classifyCategoricalValue(item.row[metric.id]);
    if (key.kind === "empty") {
      emptyCount++;
      continue;
    }
    if (key.kind === "invalid") {
      invalidCount++;
      continue;
    }
    if (!counts.has(key.value)) {
      counts.set(key.value, 0);
      observedExtras.push(key.value);
    }
    counts.set(key.value, (counts.get(key.value) ?? 0) + 1);
  }

  const buckets: Array<{
    key: ChartCategoryKey;
    label: string;
    count: number;
  }> = [];

  for (const opt of metric.options) {
    if (buckets.some((b) => b.key.kind === "value" && b.key.value === opt.value)) {
      continue;
    }
    const key: ChartCategoryKey = { kind: "value", value: opt.value };
    buckets.push({
      key,
      label: opt.label ?? opt.value,
      count: counts.get(opt.value) ?? 0
    });
  }

  for (const extra of observedExtras) {
    if (buckets.some((b) => b.key.kind === "value" && b.key.value === extra)) {
      continue;
    }
    const key: ChartCategoryKey = { kind: "value", value: extra };
    buckets.push({
      key,
      label: extra,
      count: counts.get(extra) ?? 0
    });
  }

  if (emptyCount > 0) {
    buckets.push({
      key: { kind: "empty" },
      label: "Empty",
      count: emptyCount
    });
  }

  if (invalidCount > 0) {
    buckets.push({
      key: { kind: "invalid" },
      label: "Invalid",
      count: invalidCount
    });
  }

  return { buckets };
}

export type NumericChartEntry = {
  item: DatabaseRowItem;
  value: number;
  leftPercent: number;
  widthPercent: number;
  direction: "negative" | "zero" | "positive";
};

function numericBarGeometry(input: {
  value: number;
  domainMin: number;
  domainMax: number;
  zeroPercent: number;
}): Pick<NumericChartEntry, "leftPercent" | "widthPercent" | "direction"> {
  const { value, domainMin, domainMax, zeroPercent } = input;
  const span = domainMax - domainMin;

  if (value === 0) {
    return {
      direction: "zero",
      leftPercent: zeroPercent,
      widthPercent: span === 0 ? 0 : 0
    };
  }

  if (span === 0) {
    return {
      direction: value > 0 ? "positive" : "negative",
      leftPercent: zeroPercent,
      widthPercent: 0
    };
  }

  if (value > 0) {
    return {
      direction: "positive",
      leftPercent: zeroPercent,
      widthPercent: (value / span) * 100
    };
  }

  return {
    direction: "negative",
    leftPercent: zeroPercent + (value / span) * 100,
    widthPercent: (Math.abs(value) / span) * 100
  };
}

/**
 * Numeric bar chart for number metrics.
 * Provider order preserved among valid finite numbers only.
 */
export function buildNumericChart(input: {
  items: readonly DatabaseRowItem[];
  metric: ResolvedPropertyDefinition;
}): {
  entries: NumericChartEntry[];
  skippedCount: number;
  domainMin: number;
  domainMax: number;
  zeroPercent: number;
} {
  const { items, metric } = input;
  const validValues: number[] = [];
  let skippedCount = 0;

  for (const item of items) {
    const raw = item.row[metric.id];
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      skippedCount++;
      continue;
    }
    validValues.push(raw);
  }

  let domainMin = validValues.length > 0 ? Math.min(0, ...validValues) : 0;
  let domainMax = validValues.length > 0 ? Math.max(0, ...validValues) : 0;

  if (domainMin === domainMax) {
    domainMax = 1;
  }

  const span = domainMax - domainMin;
  const zeroPercent = span === 0 ? 0 : ((0 - domainMin) / span) * 100;

  const entries: NumericChartEntry[] = [];
  for (const item of items) {
    const raw = item.row[metric.id];
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      continue;
    }
    const geometry = numericBarGeometry({
      value: raw,
      domainMin,
      domainMax,
      zeroPercent
    });
    entries.push({
      item,
      value: raw,
      ...geometry
    });
  }

  return {
    entries,
    skippedCount,
    domainMin,
    domainMax,
    zeroPercent
  };
}
