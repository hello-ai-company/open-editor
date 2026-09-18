/**
 * Shared row presentation helpers for Board / Calendar / List / Gallery (4F-4A / 4F-4B / R1).
 */
import type { DatabaseRowItem, JsonValue } from "@hello-ai-company/editor-core";
import {
  formatDatabaseCellDisplay,
  formatSelectDisplay,
  type ResolvedPropertyDefinition
} from "./databaseProperty.js";
import type {
  DatabaseFeedRowMediaRequest,
  DatabaseRowMedia,
  DatabaseRowMediaRequest,
  DatabaseViewRuntime
} from "./databaseViewRuntime.js";

type RowLike =
  | DatabaseRowItem
  | { rowKey: string; row: Record<string, JsonValue> };

/** Which text property supplied the title, when any. */
type TitleResolution = {
  text: string;
  /** Property id used for the title text; omitted when title falls back to rowKey. */
  propertyId?: string;
};

/**
 * Deep-clone a row record for host presentation seams (e.g. resolveRowMedia).
 * Never pass RuntimeStore live row references to host callbacks.
 */
export function cloneDatabaseRowRecord(
  row: Readonly<Record<string, JsonValue>>
): Record<string, JsonValue> {
  // JsonValue is JSON-serializable; deep clone so nested objects/arrays are isolated.
  return JSON.parse(JSON.stringify(row)) as Record<string, JsonValue>;
}

/**
 * Resolve title text and the property (if any) that produced it.
 *
 * 1. property id `"title"` when type is text and non-empty
 * 2. otherwise first text property with non-empty display
 * 3. otherwise rowKey (no propertyId)
 */
function resolveDatabaseRowTitleSource(
  row: RowLike,
  definitions: readonly ResolvedPropertyDefinition[]
): TitleResolution {
  const titleDef = definitions.find(
    (d) => d.id === "title" && d.type === "text"
  );
  if (titleDef) {
    const raw = row.row[titleDef.id];
    const text = formatDatabaseCellDisplay(raw, "text").trim();
    if (text) return { text, propertyId: titleDef.id };
  }
  const firstText = definitions.find((d) => d.type === "text");
  if (firstText) {
    const raw = row.row[firstText.id];
    const text = formatDatabaseCellDisplay(raw, "text").trim();
    if (text) return { text, propertyId: firstText.id };
  }
  return { text: row.rowKey };
}

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
  return resolveDatabaseRowTitleSource(row, definitions).text;
}

/**
 * First text property that was not used as the row title, with a non-empty string value.
 * Never JSON-dumps objects; never assumes a `"content"` property id.
 */
export function resolveDatabaseRowSecondaryText(
  row: RowLike,
  definitions: readonly ResolvedPropertyDefinition[]
): string | undefined {
  const titleSource = resolveDatabaseRowTitleSource(row, definitions);
  for (const def of definitions) {
    if (titleSource.propertyId !== undefined && def.id === titleSource.propertyId) {
      continue;
    }
    // Also skip the conventional title id even when empty / unused as display title.
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
  const titleSource = resolveDatabaseRowTitleSource(row, definitions);
  const title = titleSource.text;
  const secondaryText = resolveDatabaseRowSecondaryText(row, definitions);
  const max = options.maxPreviewFields ?? 5;
  const exclude = new Set(options.excludePropertyIds ?? []);
  if (titleSource.propertyId !== undefined) {
    exclude.add(titleSource.propertyId);
  }

  // Avoid duplicating the secondary text field in chips when it matches a text property.
  if (secondaryText !== undefined) {
    for (const def of definitions) {
      if (def.type !== "text") continue;
      if (exclude.has(def.id)) continue;
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

function normalizeResolvedMedia(
  media: DatabaseRowMedia | null | undefined
): DatabaseRowMedia | null {
  if (!media || typeof media.src !== "string") return null;
  const src = media.src.trim();
  if (!src) return null;
  return {
    src,
    alt: typeof media.alt === "string" ? media.alt : undefined
  };
}

/**
 * Host media resolver with fail-closed behavior for Gallery cards.
 * Caller must pass a defensive row clone — never a RuntimeStore live reference.
 * Uses Gallery-only `resolveRowMedia` (4F-4B contract).
 */
export function safeResolveRowMedia(
  runtime: Pick<DatabaseViewRuntime, "resolveRowMedia">,
  request: DatabaseRowMediaRequest
): DatabaseRowMedia | null {
  const resolver = runtime.resolveRowMedia;
  if (!resolver) return null;
  try {
    return normalizeResolvedMedia(resolver(request));
  } catch {
    return null;
  }
}

/**
 * Host media resolver with fail-closed behavior for Feed cards (4F-4D).
 * Caller must pass a defensive row clone — never a RuntimeStore live reference.
 * Uses additive `resolveFeedRowMedia` — does not call Gallery `resolveRowMedia`.
 */
export function safeResolveFeedRowMedia(
  runtime: Pick<DatabaseViewRuntime, "resolveFeedRowMedia">,
  request: DatabaseFeedRowMediaRequest
): DatabaseRowMedia | null {
  const resolver = runtime.resolveFeedRowMedia;
  if (!resolver) return null;
  try {
    return normalizeResolvedMedia(resolver(request));
  } catch {
    return null;
  }
}
