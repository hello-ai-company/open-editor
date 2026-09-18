/**
 * Board grouping presentation transforms (Phase 4F-4A).
 * Operates on already-queried snap.items — never a second client filter engine.
 */
import type {
  DatabasePropertyOption,
  DatabaseRowItem,
  JsonValue
} from "@hello-ai-company/editor-core";
import type { ResolvedPropertyDefinition } from "./databaseProperty.js";

/** Internal UI token — never sent to the provider. */
export const BOARD_UNASSIGNED_VALUE = "__oe_unassigned__" as const;

export type BoardGroupColumn = {
  /** Column identity = raw option/row value, or {@link BOARD_UNASSIGNED_VALUE}. */
  value: string;
  label: string;
  /** True when this value comes from typed options (drop/select target). */
  isConfiguredOption: boolean;
  /** True for the Unassigned bucket. */
  isUnassigned: boolean;
  items: DatabaseRowItem[];
};

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

export function boardGroupValueOf(
  row: Record<string, JsonValue>,
  propertyId: string
): string | typeof BOARD_UNASSIGNED_VALUE {
  const raw = row[propertyId];
  if (isEmptyGroupValue(raw)) return BOARD_UNASSIGNED_VALUE;
  return String(raw);
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
    return [
      {
        value: "__all__",
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

  for (const item of items) {
    const key = boardGroupValueOf(item.row, groupProperty.id);
    if (key === BOARD_UNASSIGNED_VALUE) {
      hasUnassigned = true;
      continue;
    }
    if (!buckets.has(key)) {
      buckets.set(key, []);
      observedExtras.push(key);
    }
    buckets.get(key)!.push(item);
  }

  for (const extra of observedExtras) {
    if (!order.includes(extra)) order.push(extra);
  }

  const columns: BoardGroupColumn[] = order.map((value) => {
    const opt = optionByValue.get(value);
    return {
      value,
      label: opt?.label ?? value,
      isConfiguredOption: Boolean(opt),
      isUnassigned: false,
      items: buckets.get(value) ?? []
    };
  });

  if (hasUnassigned) {
    const unassignedItems = items.filter(
      (item) =>
        boardGroupValueOf(item.row, groupProperty.id) === BOARD_UNASSIGNED_VALUE
    );
    columns.push({
      value: BOARD_UNASSIGNED_VALUE,
      label: "Unassigned",
      isConfiguredOption: false,
      isUnassigned: true,
      items: unassignedItems
    });
  }

  return columns;
}

/**
 * Whether Board may mutate a card into the given column value.
 */
export function canMutateBoardGroup(input: {
  mutationsAllowed: boolean;
  updateCapability: boolean;
  trashMode: "active" | "trash";
  groupProperty: ResolvedPropertyDefinition | null;
  targetValue: string;
}): boolean {
  if (!input.mutationsAllowed) return false;
  if (!input.updateCapability) return false;
  if (input.trashMode !== "active") return false;
  const prop = input.groupProperty;
  if (!prop) return false;
  if (prop.readOnly) return false;
  if (prop.source !== "typed") return false;
  if (!isBoardGroupingProperty(prop)) return false;
  if (input.targetValue === BOARD_UNASSIGNED_VALUE) return false;
  if (input.targetValue === "__all__") return false;
  return prop.options.some((o) => o.value === input.targetValue);
}

/**
 * Build complete row for a Board group change. Returns null when target is invalid.
 */
export function buildBoardGroupUpdateRow(
  item: DatabaseRowItem,
  groupPropertyId: string,
  targetValue: string
): Record<string, JsonValue> | null {
  if (
    targetValue === BOARD_UNASSIGNED_VALUE ||
    targetValue === "__all__"
  ) {
    return null;
  }
  return {
    ...item.row,
    [groupPropertyId]: targetValue
  };
}
