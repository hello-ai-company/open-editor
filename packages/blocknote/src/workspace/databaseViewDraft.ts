import type { JsonValue } from "@hello-ai-company/editor-core";

export type DatabaseFilterDraft = { id: string; propertyId: string; operator: string; value: string };
type InputFields = { search?: string; filters?: DatabaseFilterDraft[] };
/** Invalid or foreign cached input remains in the Notes controller. Never coerce or discard it. */
export function readDatabaseInputDraft(value: JsonValue | undefined, databaseId: string, viewId: string): { fields: InputFields; blocked: boolean } {
  const invalid = { fields: {}, blocked: true };
  if (value === undefined) return { fields: {}, blocked: false };
  if (!value || typeof value !== "object" || Array.isArray(value) || value.databaseId !== databaseId || value.viewId !== viewId || Object.keys(value).some(key => !["databaseId", "viewId", "fields"].includes(key))) return invalid;
  const fields = value.fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields) || Object.keys(fields).some(key => !["search", "filters"].includes(key))) return invalid;
  if (fields.search !== undefined && (typeof fields.search !== "string" || fields.search.length > 500)) return invalid;
  if (fields.filters !== undefined) {
    if (!Array.isArray(fields.filters) || fields.filters.length > 20) return invalid;
    const ids = new Set<string>();
    for (const row of fields.filters) {
      if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).length !== 4 || Object.keys(row).some(key => !["id", "propertyId", "operator", "value"].includes(key))) return invalid;
      if (typeof row.id !== "string" || !row.id.length || row.id.length > 512 || ids.has(row.id) || typeof row.propertyId !== "string" || !row.propertyId.length || row.propertyId.length > 512 || typeof row.operator !== "string" || !row.operator.length || row.operator.length > 64 || typeof row.value !== "string" || row.value.length > 500) return invalid;
      ids.add(row.id);
    }
  }
  return { fields: fields as InputFields, blocked: false };
}
