import type { DatabaseFilter, DatabaseListOptions, DatabasePropertyDefinition, DatabaseProvider, EditorDatabase, EditorBlock, JsonValue } from "@hello-ai-company/editor-core";
import { DATABASE_VIEW_TYPES, createDefaultDatabaseViewConfig, type DatabaseViewConfig, type DatabaseViewConfigProvider } from "@hello-ai-company/editor-blocknote";
import type { NotesInsertionHost, NotesResourceLeaveContext } from "@hello-ai-company/editor-blocknote/react";
import type { NotesScope } from "@hello-ai-company/editor-blocknote/notes";

type Row = { id: string; title: string; values: Record<string, JsonValue> };
const databaseId = "synthetic-db";
const definitions: DatabasePropertyDefinition[] = [
  { id: "name", name: "名前", type: "text", readOnly: true }, { id: "score", name: "点数", type: "number", readOnly: true },
  { id: "status", name: "状態", type: "status", readOnly: true, options: [{ value: "a", label: "計画" }, { value: "b", label: "確認" }] },
  { id: "date", name: "開始", type: "date", readOnly: true }, { id: "finish", name: "終了", type: "date", readOnly: true },
  { id: "url", name: "参照", type: "url", readOnly: true }, { id: "checkbox", name: "確認済み", type: "boolean", readOnly: true },
  { id: "location", name: "位置", type: "unknown", rawType: "location", readOnly: true }
];
function matches(row: Row, filter: DatabaseFilter): boolean {
  const value = row.values[filter.propertyId], empty = value === undefined || value === null || value === "";
  if (filter.operator === "isEmpty") return empty;
  if (filter.operator === "isNotEmpty") return !empty;
  if (empty || !("value" in filter)) return false;
  const expected = filter.value;
  switch (filter.operator) {
    case "contains": return typeof value === "string" && value.toLocaleLowerCase().includes(String(expected).toLocaleLowerCase());
    case "equals": case "on": case "is": return value === expected;
    case "notEquals": return value !== expected;
    case "gt": case "after": return typeof value === typeof expected && value > expected;
    case "gte": return typeof value === "number" && typeof expected === "number" && value >= expected;
    case "lt": case "before": return typeof value === typeof expected && value < expected;
    case "lte": return typeof value === "number" && typeof expected === "number" && value <= expected;
  }
}
/** Explicit read-only fixture; bodies/properties use the existing scoped Notes writer. */
export function createSyntheticNotesDatabaseViews(ports: {
  scope: NotesScope;
  readRows(): Promise<Row[]>;
  readConfig(viewId: string): Promise<DatabaseViewConfig | undefined>;
  writeConfig(config: DatabaseViewConfig): Promise<void>;
  listConfigs(): Promise<DatabaseViewConfig[]>;
}) {
  const check = (id: string) => { if (id !== databaseId) throw new Error("Synthetic database is unavailable"); };
  const views = DATABASE_VIEW_TYPES.map(viewType => ({ id: "main-" + viewType, title: viewType, viewType }));
  const defaults = (viewId: string): DatabaseViewConfig => {
    const view = views.find(view => view.id === viewId); if (!view) throw new Error("Synthetic view is unavailable");
    return { ...createDefaultDatabaseViewConfig({ databaseId, viewId, viewType: view.viewType }), board: { groupPropertyId: "status" }, calendar: { datePropertyId: "date", scale: "month" }, timeline: { datePropertyId: "date" }, gantt: { startPropertyId: "date", endPropertyId: "finish" }, chart: { metricPropertyId: "score" }, feed: { datePropertyId: "date" }, dashboard: { categoricalPropertyId: "status", numericPropertyId: "score", datePropertyId: "date" } };
  };
  const metadata = async (): Promise<EditorDatabase> => {
    const saved = await ports.listConfigs();
    return { id: databaseId, title: "合成DBの全11ビュー", propertyDefinitions: definitions, queryCapabilities: { propertyFilters: true, propertySort: true }, views: [...views, ...saved.filter(config => !views.some(view => view.id === config.viewId)).map(config => ({ id: config.viewId, title: config.viewType, viewType: config.viewType }))] };
  };
  const databaseViewConfig: DatabaseViewConfigProvider = {
    load: async (id, viewId) => { check(id); return await ports.readConfig(viewId) ?? (views.some(view => view.id === viewId) ? defaults(viewId) : null); },
    save: async config => { check(config.databaseId); if (!config.viewId || config.viewId.length > 256 || !DATABASE_VIEW_TYPES.includes(config.viewType)) throw new Error("Invalid synthetic view"); await ports.writeConfig(structuredClone(config)); },
    list: async id => { check(id); const meta = await metadata(); return meta.views!.map(view => ({ databaseId, viewId: view.id, viewType: view.viewType as DatabaseViewConfig["viewType"] })); }
  };
  const provider: DatabaseProvider = {
    getDatabase: async id => { check(id); return metadata(); },
    getRow: async (id, rowKey) => { check(id); const row = (await ports.readRows()).find(row => row.id === rowKey); if (!row) throw new Error("Row unavailable"); return { databaseId, row: structuredClone(row.values) }; },
    listRows: async (id, options?: DatabaseListOptions) => {
      check(id); const start = Number(options?.cursor ?? 0), limit = Math.max(1, Math.min(options?.limit ?? 4, 4));
      if (!Number.isInteger(start) || start < 0 || start > 1000) throw new Error("Invalid synthetic cursor");
      let rows = options?.trashedOnly ? [] : await ports.readRows();
      const query = options?.query?.trim().toLocaleLowerCase(); if (query) rows = rows.filter(row => (row.title + " " + JSON.stringify(row.values)).toLocaleLowerCase().includes(query));
      if (options?.filters?.length) rows = rows.filter(row => options.filters!.every(filter => matches(row, filter)));
      const reverse = (options?.propertySort?.direction ?? options?.direction) === "desc" ? -1 : 1;
      rows.sort((a, b) => {
        if (options?.propertySort) { const left = a.values[options.propertySort.propertyId], right = b.values[options.propertySort.propertyId]; return reverse * (typeof left === "number" && typeof right === "number" ? left - right : String(left ?? "").localeCompare(String(right ?? ""))); }
        return reverse * (options?.sortBy === "title" ? a.title.localeCompare(b.title) : Number(a.id.slice(4)) - Number(b.id.slice(4)));
      });
      const page = rows.slice(start, start + limit), items = page.map(row => ({ rowKey: row.id, sortOrder: Number(row.id.slice(4)), row: structuredClone(row.values) }));
      return { databaseId, rows: items.map(item => item.row), items, schema: Object.fromEntries(definitions.map(def => [def.id, def.type])), config: {}, pagination: { limit, total: rows.length, hasMore: start + limit < rows.length, nextCursor: start + limit < rows.length ? String(start + limit) : null } };
    }
  };
  const media = { src: "/synthetic-notes-cover.svg", alt: "許可された合成画像" };
  const presentation: NonNullable<Parameters<typeof import("@hello-ai-company/editor-blocknote/notes").createOpenEditorNotesPreset>[0]["databasePresentation"]> = {
    resolveRowMedia: request => request.databaseId === databaseId ? media : null,
    resolveFeedRowMedia: request => request.databaseId === databaseId ? media : null,
    resolveMapLocation: request => { const point = request.row.location; if (request.databaseId !== databaseId || !point || typeof point !== "object" || Array.isArray(point) || typeof point.latitude !== "number" || typeof point.longitude !== "number") return null; return { latitude: point.latitude, longitude: point.longitude, ...(typeof point.label === "string" ? { label: point.label } : {}) }; }
  };
  const insertion: NotesInsertionHost = { scope: ports.scope, databaseViewsBound: true, listDatabases: async signal => { if (signal.aborted) throw new Error("Cancelled"); return { databases: [await metadata()], nextCursor: null, hasMore: false }; }, getDatabase: async (id, signal) => { if (signal.aborted) throw new Error("Cancelled"); check(id); return metadata(); } };
  const beforeResourceLeave = async ({ preset, signal }: NotesResourceLeaveContext): Promise<boolean> => {
    if (signal.aborted || preset.controller.getState().pendingEditors || preset.controller.getState().composing) return false;
    const safe = (blocks: readonly EditorBlock[]): boolean => blocks.every(block => !["pageTransclusion", "syncedBlock", "oeNotesSyncedBlock", "notes:database", "notes:database_view", "notes:synced_block"].includes(block.type) && (!block.children || safe(block.children)));
    return safe((preset.controller.getState().draft ?? preset.controller.getState().snapshot!.document).blocks);
  };
  return { provider, databaseViewConfig, presentation, insertion, beforeResourceLeave };
}
