/**
 * Portable database property type normalization + typed metadata (Phase 4F-3B).
 *
 * Legacy `schema: Record<string, string>` remains supported.
 * Explicit `propertyDefinitions` enable advanced editors / filters.
 * Unknown host types degrade to display-only — never guess destructive editors.
 */

import type {
  DatabaseFilter,
  DatabasePropertyDefinition,
  DatabasePropertyOption,
  DatabasePropertySort,
  DatabasePropertyType,
  DatabaseQueryCapabilities,
  JsonValue
} from "@hello-ai-company/editor-core";

export type NormalizedPropertyKind =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "url"
  | "select"
  | "status"
  | "readonly"
  | "unknown";

/**
 * Resolved column metadata for UI.
 * `source: "typed"` = host propertyDefinitions; `"legacy"` = inferred from schema strings.
 */
export type ResolvedPropertyDefinition = {
  id: string;
  name: string;
  type: DatabasePropertyType;
  readOnly: boolean;
  options: readonly DatabasePropertyOption[];
  rawType?: string;
  source: "typed" | "legacy";
};

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
const SELECT_ALIASES = new Set(["select", "enum"]);
const STATUS_ALIASES = new Set(["status"]);
const UNKNOWN_HOST_TYPES = new Set([
  "formula",
  "relation",
  "rollup",
  "multi_select",
  "multiselect",
  "user",
  "files",
  "file",
  "email",
  "phone",
  "location",
  "button",
  "id",
  "created_time",
  "created_by",
  "last_edited_time",
  "last_edited_by"
]);

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
  if (STATUS_ALIASES.has(t)) return "status";
  if (SELECT_ALIASES.has(t)) return "select";
  if (UNKNOWN_HOST_TYPES.has(t)) return "unknown";
  return "readonly";
}

function legacyKindToPropertyType(
  kind: NormalizedPropertyKind
): DatabasePropertyType {
  if (
    kind === "text" ||
    kind === "number" ||
    kind === "boolean" ||
    kind === "date" ||
    kind === "url" ||
    kind === "select" ||
    kind === "status"
  ) {
    return kind;
  }
  return "unknown";
}

/**
 * Prefer explicit typed metadata; otherwise infer conservatively from legacy schema.
 *
 * Presence semantics (4F-3B R2):
 * - `definitions === undefined | null` → typed metadata absent → legacy fallback
 * - `definitions === []` → typed metadata present but empty → return [] (no legacy)
 * - `definitions.length > 0` → use host definitions
 *
 * Mutation authority (4F-3B R3): callers must also gate edits/creates with
 * {@link metadataAllowsRowMutations} so legacy fallback is not used while
 * `getDatabase` metadata is still loading.
 */
export function hasExplicitPropertyDefinitions(
  definitions: readonly DatabasePropertyDefinition[] | null | undefined
): boolean {
  return definitions != null;
}

/**
 * Whether row create/update UI may use schema authority (4F-3B R3).
 *
 * - No `getDatabase` capability → legacy schema may authorize mutations
 * - `getDatabase` present + meta not yet `ready` → display-only (fail-closed)
 * - `getDatabase` present + `ready` → typed definitions or explicit legacy
 *   (`propertyDefinitions === undefined`) via {@link resolveDatabasePropertyDefinitions}
 * - `missing` / `error` → fail-closed for mutations (rows may still display)
 */
export function metadataAllowsRowMutations(input: {
  getDatabase: boolean;
  metaStatus:
    | "idle"
    | "loading"
    | "ready"
    | "missing"
    | "error"
    | "unavailable";
}): boolean {
  if (!input.getDatabase) {
    return true;
  }
  return input.metaStatus === "ready";
}

export function resolveDatabasePropertyDefinitions(input: {
  legacySchema?: Record<string, string> | null;
  definitions?: readonly DatabasePropertyDefinition[] | null;
}): ResolvedPropertyDefinition[] {
  const defs = input.definitions;
  if (defs != null) {
    return defs.map((def) => ({
      id: def.id,
      name: def.name,
      type: def.type,
      readOnly: Boolean(def.readOnly),
      options: def.options ? [...def.options] : [],
      rawType: def.rawType,
      source: "typed" as const
    }));
  }
  const schema = input.legacySchema ?? {};
  return Object.keys(schema).map((key) => {
    const raw = schema[key] ?? "text";
    const kind = normalizeDatabasePropertyType(raw);
    return {
      id: key,
      name: key,
      type: legacyKindToPropertyType(kind),
      readOnly: kind === "readonly" || kind === "unknown",
      options: [],
      rawType: raw,
      source: "legacy" as const
    };
  });
}

export function propertyDefinitionMap(
  defs: readonly ResolvedPropertyDefinition[]
): Map<string, ResolvedPropertyDefinition> {
  return new Map(defs.map((d) => [d.id, d]));
}

/**
 * Cell editors — legacy schema stays conservative (4F-3A).
 * Typed metadata unlocks date/url/select/status when options exist.
 */
export function isEditableResolvedProperty(
  def: ResolvedPropertyDefinition
): boolean {
  if (def.readOnly) return false;
  if (def.type === "unknown") return false;
  if (def.source === "legacy") {
    return (
      def.type === "text" || def.type === "number" || def.type === "boolean"
    );
  }
  if (def.type === "select" || def.type === "status") {
    return def.options.length > 0;
  }
  return (
    def.type === "text" ||
    def.type === "number" ||
    def.type === "boolean" ||
    def.type === "date" ||
    def.type === "url"
  );
}

/** @deprecated Prefer isEditableResolvedProperty with resolved metadata. */
export function isEditablePropertyKind(
  kind: NormalizedPropertyKind
): boolean {
  return kind === "text" || kind === "number" || kind === "boolean";
}

export function isCreatableResolvedProperty(
  def: ResolvedPropertyDefinition
): boolean {
  return isEditableResolvedProperty(def);
}

/** @deprecated Prefer creatable keys from resolved definitions. */
export function isCreatablePropertyKind(
  kind: NormalizedPropertyKind
): boolean {
  return kind === "text" || kind === "number" || kind === "boolean";
}

/** Schema keys that may appear as New Row inputs (legacy path). */
export function creatableSchemaKeys(
  schema: Record<string, string>
): string[] {
  return Object.keys(schema).filter((key) =>
    isCreatablePropertyKind(normalizeDatabasePropertyType(schema[key]))
  );
}

export function creatablePropertyIds(
  defs: readonly ResolvedPropertyDefinition[]
): string[] {
  return defs.filter(isCreatableResolvedProperty).map((d) => d.id);
}

/**
 * Build a createRow payload from draft inputs.
 * Omits readonly / unknown / non-creatable fields entirely (no empty-string spam).
 */
export function buildCreateRowPayload(
  schema: Record<string, string>,
  draft: Record<string, string>
): Record<string, string | number | boolean> {
  const row: Record<string, string | number | boolean> = {};
  for (const key of creatableSchemaKeys(schema)) {
    const kind = normalizeDatabasePropertyType(schema[key]);
    const parsed = parseEditedCellValue(draft[key] ?? "", kind);
    if (parsed === undefined) continue;
    row[key] = parsed;
  }
  return row;
}

/**
 * Typed New Row payload. Invalid number drafts are omitted (caller should block submit).
 */
export function buildTypedCreateRowPayload(
  defs: readonly ResolvedPropertyDefinition[],
  draft: Record<string, string>
): Record<string, string | number | boolean> | { error: string } {
  const row: Record<string, string | number | boolean> = {};
  for (const def of defs) {
    if (!isCreatableResolvedProperty(def)) continue;
    const raw = draft[def.id] ?? "";
    if (def.type === "boolean") {
      row[def.id] = parseBooleanDraft(raw);
      continue;
    }
    if (def.type === "number") {
      const n = parseNumberDraft(raw);
      if (n === null) {
        return { error: `Invalid number for ${def.name}` };
      }
      row[def.id] = n;
      continue;
    }
    if (def.type === "date") {
      if (raw && !isIsoDateString(raw)) {
        return { error: `Invalid date for ${def.name}` };
      }
      row[def.id] = raw;
      continue;
    }
    if (def.type === "select" || def.type === "status") {
      if (!raw) continue;
      if (!def.options.some((o) => o.value === raw)) {
        return { error: `Invalid option for ${def.name}` };
      }
      row[def.id] = raw;
      continue;
    }
    row[def.id] = raw;
  }
  return row;
}

/** Format a cell value for display (never throws). */
export function formatDatabaseCellDisplay(
  value: unknown,
  kind: NormalizedPropertyKind | DatabasePropertyType
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

/** Display label for select/status — prefer option label, never coerce unknown values. */
export function formatSelectDisplay(
  value: unknown,
  options: readonly DatabasePropertyOption[]
): string {
  const raw = value == null ? "" : String(value);
  if (!raw) return "";
  const match = options.find((o) => o.value === raw);
  return match?.label ?? raw;
}

export function isIsoDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y == null || m == null || d == null) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function parseNumberDraft(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseBooleanDraft(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  if (lower === "true" || lower === "1" || lower === "yes") return true;
  return false;
}

/**
 * Parse edited string back into a JsonValue-compatible primitive.
 * Returns `undefined` when a number draft is invalid (do not commit).
 */
export function parseEditedCellValue(
  raw: string,
  kind: NormalizedPropertyKind | DatabasePropertyType
): string | number | boolean | undefined {
  if (kind === "number") {
    const n = parseNumberDraft(raw);
    return n === null ? undefined : n;
  }
  if (kind === "boolean") {
    return parseBooleanDraft(raw);
  }
  if (kind === "date") {
    return raw;
  }
  return raw;
}

export function valuesEqualForEdit(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  return String(a ?? "") === String(b ?? "");
}

export type FilterValidationResult =
  | { ok: true; filter: DatabaseFilter }
  | { ok: false; error: string };

export type PropertySortValidationResult =
  | { ok: true; sort: DatabasePropertySort }
  | { ok: false; error: string };

const FILTERABLE_TYPES = new Set<DatabasePropertyType>([
  "text",
  "number",
  "boolean",
  "date",
  "url",
  "select",
  "status"
]);

export function isFilterablePropertyType(
  type: DatabasePropertyType
): boolean {
  return FILTERABLE_TYPES.has(type);
}

export function hostSupportsPropertyFilters(
  caps: DatabaseQueryCapabilities | undefined | null
): boolean {
  return caps?.propertyFilters === true;
}

export function hostSupportsPropertySort(
  caps: DatabaseQueryCapabilities | undefined | null
): boolean {
  return caps?.propertySort === true;
}

/**
 * Validate a structured filter against resolved metadata + host capabilities.
 * Invalid filters must never reach DatabaseProvider.listRows.
 */
export function validateDatabaseFilter(
  filter: DatabaseFilter,
  defs: readonly ResolvedPropertyDefinition[],
  caps: DatabaseQueryCapabilities | undefined | null
): FilterValidationResult {
  if (!hostSupportsPropertyFilters(caps)) {
    return {
      ok: false,
      error: "Host does not advertise propertyFilters"
    };
  }
  const def = defs.find((d) => d.id === filter.propertyId);
  if (!def) {
    return { ok: false, error: `Unknown property: ${filter.propertyId}` };
  }
  if (def.type !== filter.propertyType) {
    return {
      ok: false,
      error: `Property type mismatch for ${filter.propertyId}: expected ${def.type}, got ${filter.propertyType}`
    };
  }
  if (!isFilterablePropertyType(def.type)) {
    return {
      ok: false,
      error: `Property type ${def.type} is not filterable`
    };
  }
  if (filter.operator === "isEmpty" || filter.operator === "isNotEmpty") {
    return { ok: true, filter };
  }
  if (
    (filter.propertyType === "select" || filter.propertyType === "status") &&
    def.options.length > 0 &&
    "value" in filter
  ) {
    const allowed = def.options.some((o) => o.value === filter.value);
    if (!allowed) {
      return {
        ok: false,
        error: `Option "${String(filter.value)}" is not allowed for ${def.name}`
      };
    }
  }
  if (filter.propertyType === "date" && "value" in filter) {
    if (!isIsoDateString(String(filter.value))) {
      return { ok: false, error: `Invalid date value for ${def.name}` };
    }
  }
  if (filter.propertyType === "number" && "value" in filter) {
    if (typeof filter.value !== "number" || !Number.isFinite(filter.value)) {
      return { ok: false, error: `Invalid number value for ${def.name}` };
    }
  }
  return { ok: true, filter };
}

export function validateDatabaseFilters(
  filters: readonly DatabaseFilter[],
  defs: readonly ResolvedPropertyDefinition[],
  caps: DatabaseQueryCapabilities | undefined | null
):
  | { ok: true; filters: readonly DatabaseFilter[] }
  | { ok: false; error: string } {
  if (filters.length === 0) {
    return { ok: true, filters: [] };
  }
  if (!hostSupportsPropertyFilters(caps)) {
    return {
      ok: false,
      error: "Host does not advertise propertyFilters"
    };
  }
  const out: DatabaseFilter[] = [];
  for (const filter of filters) {
    const result = validateDatabaseFilter(filter, defs, caps);
    if (!result.ok) return result;
    out.push(result.filter);
  }
  return { ok: true, filters: out };
}

export function validatePropertySort(
  sort: DatabasePropertySort,
  defs: readonly ResolvedPropertyDefinition[],
  caps: DatabaseQueryCapabilities | undefined | null
): PropertySortValidationResult {
  if (!hostSupportsPropertySort(caps)) {
    return {
      ok: false,
      error: "Host does not advertise propertySort"
    };
  }
  const def = defs.find((d) => d.id === sort.propertyId);
  if (!def) {
    return { ok: false, error: `Unknown property: ${sort.propertyId}` };
  }
  if (def.type === "unknown") {
    return {
      ok: false,
      error: `Cannot sort by unknown property ${sort.propertyId}`
    };
  }
  if (sort.direction !== "asc" && sort.direction !== "desc") {
    return { ok: false, error: "Invalid sort direction" };
  }
  return { ok: true, sort: { ...sort } };
}

/**
 * Drop filters that no longer match metadata (e.g. option removed).
 * Preserves display order of still-valid filters.
 */
export function sanitizeFiltersAgainstMetadata(
  filters: readonly DatabaseFilter[],
  defs: readonly ResolvedPropertyDefinition[],
  caps: DatabaseQueryCapabilities | undefined | null
): {
  filters: readonly DatabaseFilter[];
  removed: readonly DatabaseFilter[];
} {
  if (!hostSupportsPropertyFilters(caps)) {
    return { filters: [], removed: [...filters] };
  }
  const kept: DatabaseFilter[] = [];
  const removed: DatabaseFilter[] = [];
  for (const filter of filters) {
    const result = validateDatabaseFilter(filter, defs, caps);
    if (result.ok) kept.push(result.filter);
    else removed.push(filter);
  }
  return { filters: kept, removed };
}

export function sanitizePropertySortAgainstMetadata(
  sort: DatabasePropertySort | null,
  defs: readonly ResolvedPropertyDefinition[],
  caps: DatabaseQueryCapabilities | undefined | null
): DatabasePropertySort | null {
  if (!sort) return null;
  const result = validatePropertySort(sort, defs, caps);
  return result.ok ? result.sort : null;
}

/** Clone filters so caller-owned arrays are not retained. */
export function cloneFilters(
  filters: readonly DatabaseFilter[]
): DatabaseFilter[] {
  return filters.map((f) => ({ ...f }) as DatabaseFilter);
}

export function clonePropertySort(
  sort: DatabasePropertySort | null
): DatabasePropertySort | null {
  return sort ? { ...sort } : null;
}

export function filtersEqual(
  a: readonly DatabaseFilter[],
  b: readonly DatabaseFilter[]
): boolean {
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function propertySortEqual(
  a: DatabasePropertySort | null,
  b: DatabasePropertySort | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.propertyId === b.propertyId && a.direction === b.direction;
}

/** Derive a legacy-compatible schema map from resolved definitions (for snapshot.schema). */
export function schemaFromResolvedDefinitions(
  defs: readonly ResolvedPropertyDefinition[]
): Record<string, string> {
  const schema: Record<string, string> = {};
  for (const def of defs) {
    schema[def.id] = def.rawType ?? def.type;
  }
  return schema;
}

export function toJsonValue(
  value: string | number | boolean
): JsonValue {
  return value;
}
