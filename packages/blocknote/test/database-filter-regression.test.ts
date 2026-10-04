import { describe, expect, it, vi } from "vitest";
import type { DatabaseFilter, DatabaseProvider, DatabaseRowsPage, EditorDatabase } from "@hello-ai-company/editor-core";
import { createDatabaseRuntimeStore } from "../src/workspace/databaseRuntimeStore.js";
import { createDefaultDatabaseViewConfig, loadDatabaseViewHydration, patchDatabaseViewConfig, persistDatabaseViewConfigIfAuthoritative } from "../src/workspace/databaseViewConfig.js";
const filter: DatabaseFilter = { propertyId: "status", propertyType: "text", operator: "equals", value: "done" };
const typed: EditorDatabase = { id: "db", title: "Synthetic", propertyDefinitions: [{ id: "status", name: "Status", type: "text" }], queryCapabilities: { propertyFilters: true } };
const page = (key: string, limit = 20): DatabaseRowsPage => ({ databaseId: "db", rows: [{ status: key }], items: [{ rowKey: key, sortOrder: 0, row: { status: key } }], schema: { status: "text" }, config: {}, pagination: { limit, hasMore: false, nextCursor: null, total: 1 } });
async function runtime() {
  const listRows = vi.fn(async () => page("original"));
  const store = createDatabaseRuntimeStore({ provider: { getDatabase: async () => typed, listRows } });
  store.ensureView("view", "db");
  await vi.waitFor(() => expect(store.getView("view").status).toBe("ready"));
  return { store, listRows };
}
describe("Legacy hydration and bounded runtime filters", () => {
  it("restores a legacy-schema filter and never displays schema-probe rows", async () => {
    const saved = { ...createDefaultDatabaseViewConfig({ databaseId: "db", viewId: "main", viewType: "table" }), filters: [filter] };
    const provider: DatabaseProvider = { getDatabase: async () => ({ id: "db", title: "Legacy", queryCapabilities: { propertyFilters: true } }),
      listRows: vi.fn(async (_id, options) => page(options?.filters?.length ? "filtered" : "schema-probe", options?.limit)) };
    const loaded = await loadDatabaseViewHydration({ provider: { load: async () => saved }, databaseProvider: provider, databaseId: "db", viewId: "main", viewType: "table" });
    expect(loaded.state).toBe("ready");
    expect(loaded.config.filters).toEqual([filter]);
    const store = createDatabaseRuntimeStore({ provider }); const displayed: string[] = [];
    const unsubscribe = store.subscribe(() => displayed.push(...store.getView("view").items.map(item => item.rowKey)));
    store.ensureView("view", "db", loaded.config);
    await vi.waitFor(() => expect(store.getView("view").status).toBe("ready"));
    expect(store.getView("view").queryState.filters).toEqual([filter]);
    expect(store.getView("view").items.map(item => item.rowKey)).toEqual(["filtered"]);
    expect(displayed).not.toContain("schema-probe"); unsubscribe();
  });
  it.each(["failed", "foreign"] as const)("preserves saved settings when the legacy schema probe is %s", async failure => {
    const saved = { ...createDefaultDatabaseViewConfig({ databaseId: "db", viewId: "main", viewType: "table" }), filters: [filter] };
    const provider: DatabaseProvider = {
      getDatabase: async () => ({ id: "db", title: "Legacy", queryCapabilities: { propertyFilters: true } }),
      listRows: async () => {
        if (failure === "failed") throw new Error("Synthetic offline host");
        return { ...page("foreign"), databaseId: "other-db" };
      }
    };
    const loaded = await loadDatabaseViewHydration({ provider: { load: async () => saved }, databaseProvider: provider, databaseId: "db", viewId: "main", viewType: "table" });
    expect(loaded.state).toBe("metadata-unavailable");
    const save = vi.fn(async () => {});
    expect(await persistDatabaseViewConfigIfAuthoritative(loaded.state, { save }, loaded.config)).toBe(false);
    expect(save).not.toHaveBeenCalled();
    expect(saved.filters).toEqual([filter]);
  });
  it("treats an explicit empty typed schema as authoritative without probing legacy rows", async () => {
    const saved = { ...createDefaultDatabaseViewConfig({ databaseId: "db", viewId: "main", viewType: "table" }), filters: [filter] };
    const listRows = vi.fn(async () => page("unfiltered"));
    const loaded = await loadDatabaseViewHydration({ provider: { load: async () => saved }, databaseProvider: { getDatabase: async () => ({ ...typed, propertyDefinitions: [] }), listRows }, databaseId: "db", viewId: "main", viewType: "table" });
    expect(loaded.state).toBe("invalid");
    expect(loaded.config.filters).toEqual([]);
    expect(listRows).not.toHaveBeenCalled();
  });
  it.each(["setFilters", "setQueryState"] as const)("rejects 21 runtime filters through %s without changing rows or the current query", async method => {
    const { store, listRows } = await runtime();
    store.setFilters("view", [filter]);
    await vi.waitFor(() => expect(store.getView("view").status).toBe("ready"));
    const before = store.getView("view"), count = listRows.mock.calls.length;
    const tooMany = Array.from({ length: 21 }, () => ({ ...filter }));
    expect(() => method === "setFilters" ? store.setFilters("view", tooMany) : store.setQueryState!("view", { filters: tooMany })).toThrow(/20 filters/);
    expect(store.getView("view").queryState).toEqual(before.queryState);
    expect(store.getView("view").items).toEqual(before.items);
    expect(listRows.mock.calls.length).toBe(count);
  });
  it("rejects oversized initial runtime queries before issuing a row request", () => {
    const listRows = vi.fn(async () => page("unfiltered"));
    const store = createDatabaseRuntimeStore({ provider: { getDatabase: async () => typed, listRows } });
    expect(() => store.ensureView("view", "db", { filters: Array.from({ length: 21 }, () => filter) })).toThrow(/20 filters/);
    expect(listRows).not.toHaveBeenCalled();
  });
  it("does not erase current filters when an intentional saved-config patch exceeds the limit", () => {
    const saved = { ...createDefaultDatabaseViewConfig({ databaseId: "db", viewId: "main", viewType: "table" }), filters: [filter] };
    expect(() => patchDatabaseViewConfig(saved, { filters: Array.from({ length: 21 }, () => filter) })).toThrow(/20 filters/);
    expect(saved.filters).toEqual([filter]);
    expect(patchDatabaseViewConfig(saved, { filters: Array.from({ length: 20 }, () => filter) }).filters).toHaveLength(20);
  });
});
