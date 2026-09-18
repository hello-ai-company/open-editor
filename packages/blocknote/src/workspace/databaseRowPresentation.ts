/**
 * Shared row presentation helpers for Board / Calendar / List / Gallery (4F-4A / 4F-4B).
 */
import type { DatabaseRowItem, JsonValue } from "@hello-ai-company/editor-core";
import {
  formatDatabaseCellDisplay,
  formatSelectDisplay,
  type ResolvedPropertyDefinition
} from "./databaseProperty.js";
import type {
  DatabaseRowMedia,
  DatabaseRowMediaRequest,
  DatabaseViewRuntime
} from "./databaseViewRuntime.js";

type RowLike =
  | DatabaseRowItem
  | { rowKey: string; row: Record<string, JsonValue> };

/**
 * Resolve a compact display title for a row.
 *
 * 1. property id `"title"` when type is text
 * 2. otherwise first text property
 * 3. otherwise rowKey
 */
export function resolveDatabaseRowTitle(
  row: RowLike,
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
 * First non-title text property with a non-empty string value.
 * Never JSON-dumps objects; never assumes a `"content"` property id.
 */
export function resolveDatabaseRowSecondaryText(
  row: RowLike,
  definitions: readonly ResolvedPropertyDefinition[]
): string | undefined {
  for (const def of definitions) {
    if (def.id === "title" && def.type === "text") continue;
    if (def.type !== "text") continue;
    const raw = row.row[def.id];
    // Plain string only — never JSON.stringify opaque values.
    if (typeof raw !== "string") continue;
    const text = raw.trim();
    if (text) return text;
  }
  return undefined;
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

export type DatabaseRowPreviewField = {
  def: ResolvedPropertyDefinition;
  text: string;
};

export type DatabaseRowPresentation = {
  title: string;
  secondaryText?: string;
  previewFields: DatabaseRowPreviewField[];
};

/**
 * Title + optional secondary text + non-empty preview chips for List / Gallery.
 */
export function buildDatabaseRowPresentation(
  row: RowLike,
  definitions: readonly ResolvedPropertyDefinition[],
  options: {
    maxPreviewFields?: number;
    excludePropertyIds?: ReadonlySet<string>;
  } = {}
): DatabaseRowPresentation {
  const title = resolveDatabaseRowTitle(row, definitions);
  const secondaryText = resolveDatabaseRowSecondaryText(row, definitions);
  const max = options.maxPreviewFields ?? 5;
  const exclude = new Set(options.excludePropertyIds ?? []);

  // Avoid duplicating the secondary text field in chips when it matches a text property.
  if (secondaryText !== undefined) {
    for (const def of definitions) {
      if (def.type !== "text") continue;
      if (def.id === "title") continue;
      const raw = row.row[def.id];
      if (typeof raw === "string" && raw.trim() === secondaryText) {
        exclude.add(def.id);
        break;
      }
    }
  }

  const previewFields: DatabaseRowPreviewField[] = [];
  for (const def of definitions) {
    if (previewFields.length >= max) break;
    if (exclude.has(def.id)) continue;
    if (def.id === "title" && def.type === "text") continue;
    if (def.type === "unknown") continue;
    const text = formatDatabaseCardFieldValue(def, row.row[def.id]).trim();
    if (!text) continue;
    previewFields.push({ def, text });
  }

  return secondaryText !== undefined
    ? { title, secondaryText, previewFields }
    : { title, previewFields };
}

/**
 * Host media resolver with fail-closed behavior for Gallery cards.
 */
export function safeResolveRowMedia(
  runtime: Pick<DatabaseViewRuntime, "resolveRowMedia">,
  request: DatabaseRowMediaRequest
): DatabaseRowMedia | null {
  const resolver = runtime.resolveRowMedia;
  if (!resolver) return null;
  try {
    const media = resolver(request);
    if (!media || typeof media.src !== "string") return null;
    const src = media.src.trim();
    if (!src) return null;
    return {
      src,
      alt: typeof media.alt === "string" ? media.alt : undefined
    };
  } catch {
    return null;
  }
}
