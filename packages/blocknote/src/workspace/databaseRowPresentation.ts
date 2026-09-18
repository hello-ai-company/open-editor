/**
 * Shared row presentation helpers for Board / Calendar / Table cards (4F-4A).
 */
import type { DatabaseRowItem, JsonValue } from "@hello-ai-company/editor-core";
import {
  formatDatabaseCellDisplay,
  formatSelectDisplay,
  type ResolvedPropertyDefinition
} from "./databaseProperty.js";

/**
 * Resolve a compact display title for a row.
 *
 * 1. property id `"title"` when type is text
 * 2. otherwise first text property
 * 3. otherwise rowKey
 */
export function resolveDatabaseRowTitle(
  row: DatabaseRowItem | { rowKey: string; row: Record<string, JsonValue> },
  definitions: readonly ResolvedPropertyDefinition[]
): string {
  const titleDef = definitions.find(
    (d) => d.id === "title" && d.type === "text"
  );
  if (titleDef) {
    const raw = row.row[titleDef.id];
    const text = formatDatabaseCellDisplay(raw, "text").trim();
    if (text) return text;
  }
  const firstText = definitions.find((d) => d.type === "text");
  if (firstText) {
    const raw = row.row[firstText.id];
    const text = formatDatabaseCellDisplay(raw, "text").trim();
    if (text) return text;
  }
  return row.rowKey;
}

/**
 * Compact property previews for Board cards (excludes title + group property).
 */
export function resolveDatabaseCardPreviewFields(
  definitions: readonly ResolvedPropertyDefinition[],
  options: {
    excludePropertyIds?: ReadonlySet<string>;
    maxFields?: number;
  } = {}
): ResolvedPropertyDefinition[] {
  const exclude = options.excludePropertyIds ?? new Set<string>();
  const max = options.maxFields ?? 3;
  const out: ResolvedPropertyDefinition[] = [];
  for (const def of definitions) {
    if (exclude.has(def.id)) continue;
    if (def.id === "title" && def.type === "text") continue;
    if (def.type === "unknown") continue;
    out.push(def);
    if (out.length >= max) break;
  }
  return out;
}

export function formatDatabaseCardFieldValue(
  def: ResolvedPropertyDefinition,
  value: unknown
): string {
  if (def.type === "select" || def.type === "status") {
    return formatSelectDisplay(value, def.options);
  }
  return formatDatabaseCellDisplay(value, def.type);
}
