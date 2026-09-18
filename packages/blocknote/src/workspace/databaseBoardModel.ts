/**
 * Board grouping presentation transforms (Phase 4F-4A / R1).
 * Operates on already-queried snap.items — never a second client filter engine.
 *
 * R1: Internal bucket identity is a discriminated {@link BoardGroupKey}.
 * Host option values stay opaque and never collide with Unassigned / All buckets.
 */
import type {
  DatabasePropertyOption,
  DatabaseRowItem,
  JsonValue
} from "@hello-ai-company/editor-core";
import type { ResolvedPropertyDefinition } from "./databaseProperty.js";

/**
 * Stable Board column identity — separate from host provider option values.
 * Never send `kind: "unassigned" | "all"` to the provider.
 */
export type BoardGroupKey =
  | { kind: "value"; value: string }
  | { kind: "unassigned" }
  | { kind: "all" };

export type BoardGroupColumn = {
  key: BoardGroupKey;
  /**
   * Collision-safe React / DOM key derived from {@link encodeBoardGroupKey}.
   * Never a raw host option value alone.
   */
  keyId: string;
  label: string;
  /** True when this column is a typed option (drop/select mutation target). */
  isConfiguredOption: boolean;
  /** True for the Unassigned bucket. */
  isUnassigned: boolean;
  items: DatabaseRowItem[];
};

/** Encode a BoardGroupKey for React keys / data attributes (not provider I/O). */
export function encodeBoardGroupKey(key: BoardGroupKey): string {
  if (key.kind === "value") {
    return JSON.stringify(["value", key.value]);
  }
  return JSON.stringify([key.kind]);
}

export function boardGroupKeysEqual(
  a: BoardGroupKey,
  b: BoardGroupKey
): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "value" && b.kind === "value") {
    return a.value === b.value;
  }
  return true;
}

export function isBoardGroupingProperty(
  def: ResolvedPropertyDefinition
): boolean {
  return def.type === "status" || def.type === "select";
}

export function listBoardGroupingProperties(
  definitions: readonly ResolvedPropertyDefinition[]
): ResolvedPropertyDefinition[] {
  return definitions.filter(isBoardGroupingProperty);
}

/**
 * Prefer first status, otherwise first select.
 */
export function defaultBoardGroupingProperty(
  definitions: readonly ResolvedPropertyDefinition[]
): ResolvedPropertyDefinition | null {
  const eligible = listBoardGroupingProperties(definitions);
  return (
    eligible.find((d) => d.type === "status") ??
    eligible.find((d) => d.type === "select") ??
    null
  );
}

/**
 * Resolve selected group property with safe fallback after metadata refresh.
 */
export function resolveBoardGroupingProperty(
  definitions: readonly ResolvedPropertyDefinition[],
  selectedPropertyId: string | null | undefined
): ResolvedPropertyDefinition | null {
  const eligible = listBoardGroupingProperties(definitions);
  if (selectedPropertyId) {
    const match = eligible.find((d) => d.id === selectedPropertyId);
    if (match) return match;
  }
  return defaultBoardGroupingProperty(definitions);
}

function isEmptyGroupValue(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * Map a row cell to a Board group key.
 * Empty/null/"" → unassigned; any other string (including host "__oe_unassigned__") → value.
 */
export function boardGroupKeyOf(
  row: Record<string, JsonValue>,
  propertyId: string
): BoardGroupKey {
  const raw = row[propertyId];
  if (isEmptyGroupValue(raw)) return { kind: "unassigned" };
  return { kind: "value", value: String(raw) };
}

/**
 * Build Board columns: configured options first, then observed unknowns, then Unassigned.
 * Deduplicates by raw provider value. Labels prefer option labels.
 */
export function buildBoardColumns(input: {
  items: readonly DatabaseRowItem[];
  groupProperty: ResolvedPropertyDefinition | null;
}): BoardGroupColumn[] {
  const { items, groupProperty } = input;
  if (!groupProperty) {
    const key: BoardGroupKey = { kind: "all" };
    return [
      {
        key,
        keyId: encodeBoardGroupKey(key),
        label: "All items",
        isConfiguredOption: false,
        isUnassigned: false,
        items: [...items]
      }
    ];
  }

  const optionByValue = new Map<string, DatabasePropertyOption>();
  for (const opt of groupProperty.options) {
    if (!optionByValue.has(opt.value)) {
      optionByValue.set(opt.value, opt);
    }
  }

  const buckets = new Map<string, DatabaseRowItem[]>();
  const order: string[] = [];

  for (const opt of groupProperty.options) {
    if (!buckets.has(opt.value)) {
      buckets.set(opt.value, []);
      order.push(opt.value);
    }
  }

  let hasUnassigned = false;
  const observedExtras: string[] = [];
  const unassignedItems: DatabaseRowItem[] = [];

  for (const item of items) {
    const key = boardGroupKeyOf(item.row, groupProperty.id);
    if (key.kind !== "value") {
      hasUnassigned = true;
      unassignedItems.push(item);
      continue;
    }
    if (!buckets.has(key.value)) {
      buckets.set(key.value, []);
      observedExtras.push(key.value);
    }
    buckets.get(key.value)!.push(item);
  }

  for (const extra of observedExtras) {
    if (!order.includes(extra)) order.push(extra);
  }

  const columns: BoardGroupColumn[] = order.map((value) => {
    const opt = optionByValue.get(value);
    const key: BoardGroupKey = { kind: "value", value };
    return {
      key,
      keyId: encodeBoardGroupKey(key),
      label: opt?.label ?? value,
      isConfiguredOption: Boolean(opt),
      isUnassigned: false,
      items: buckets.get(value) ?? []
    };
  });

  if (hasUnassigned) {
    const key: BoardGroupKey = { kind: "unassigned" };
    columns.push({
      key,
      keyId: encodeBoardGroupKey(key),
      label: "Unassigned",
      isConfiguredOption: false,
      isUnassigned: true,
      items: unassignedItems
    });
  }

  return columns;
}

/**
 * Whether Board may mutate a card into the given column key.
 * Only configured typed option values (`kind: "value"`) are mutation targets.
 */
export function canMutateBoardGroup(input: {
  mutationsAllowed: boolean;
  updateCapability: boolean;
  trashMode: "active" | "trash";
  groupProperty: ResolvedPropertyDefinition | null;
  targetKey: BoardGroupKey;
}): boolean {
  if (!input.mutationsAllowed) return false;
  if (!input.updateCapability) return false;
  if (input.trashMode !== "active") return false;
  const prop = input.groupProperty;
  if (!prop) return false;
  if (prop.readOnly) return false;
  if (prop.source !== "typed") return false;
  if (!isBoardGroupingProperty(prop)) return false;
  const target = input.targetKey;
  if (target.kind !== "value") return false;
  return prop.options.some((o) => o.value === target.value);
}

/**
 * Build complete row for a Board group change. Returns null when target is not a provider value.
 */
export function buildBoardGroupUpdateRow(
  item: DatabaseRowItem,
  groupPropertyId: string,
  targetKey: BoardGroupKey
): Record<string, JsonValue> | null {
  if (targetKey.kind !== "value") {
    return null;
  }
  return {
    ...item.row,
    [groupPropertyId]: targetKey.value
  };
}
