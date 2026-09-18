/**
 * Portable database property type normalization (Phase 4F-3A).
 * Unknown types degrade to display-only — never guess destructive editors.
 */

export type NormalizedPropertyKind =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "url"
  | "select"
  | "readonly";

const TEXT_ALIASES = new Set([
  "text",
  "string",
  "title",
  "rich_text",
  "richtext"
]);
const NUMBER_ALIASES = new Set(["number", "num", "integer", "float", "int"]);
const BOOLEAN_ALIASES = new Set([
  "boolean",
  "bool",
  "checkbox",
  "check"
]);
const DATE_ALIASES = new Set(["date", "datetime", "timestamp"]);
const URL_ALIASES = new Set(["url", "link", "href"]);
const SELECT_ALIASES = new Set(["select", "status", "enum"]);

/**
 * Map host schema type strings to a portable editor kind.
 * Unknown → readonly (safe display as text/JSON).
 */
export function normalizeDatabasePropertyType(
  type: string | undefined | null
): NormalizedPropertyKind {
  const t = (type ?? "text").trim().toLowerCase();
  if (TEXT_ALIASES.has(t)) return "text";
  if (NUMBER_ALIASES.has(t)) return "number";
  if (BOOLEAN_ALIASES.has(t)) return "boolean";
  if (DATE_ALIASES.has(t)) return "date";
  if (URL_ALIASES.has(t)) return "url";
  if (SELECT_ALIASES.has(t)) return "select";
  return "readonly";
}

export function isEditablePropertyKind(
  kind: NormalizedPropertyKind
): boolean {
  return (
    kind === "text" ||
    kind === "number" ||
    kind === "boolean" ||
    kind === "date" ||
    kind === "url" ||
    kind === "select"
  );
}

/** Format a cell value for display (never throws). */
export function formatDatabaseCellDisplay(
  value: unknown,
  kind: NormalizedPropertyKind
): string {
  if (value === null || value === undefined) return "";
  if (kind === "boolean") {
    return value === true || value === "true" || value === 1 ? "✓" : "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Parse edited string back into a JsonValue-compatible primitive. */
export function parseEditedCellValue(
  raw: string,
  kind: NormalizedPropertyKind
): string | number | boolean {
  if (kind === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (kind === "boolean") {
    const lower = raw.trim().toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes") return true;
    if (lower === "false" || lower === "0" || lower === "no" || lower === "") {
      return false;
    }
    return raw;
  }
  return raw;
}

export function valuesEqualForEdit(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  return String(a ?? "") === String(b ?? "");
}
