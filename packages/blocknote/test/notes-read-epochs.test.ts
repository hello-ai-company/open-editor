import { expect, it } from "vitest";
import type { DatabaseProvider, DatabaseRowsPage } from "@hello-ai-company/editor-core";
import { createDatabaseRuntimeStore } from "../src/workspace/databaseRuntimeStore.js";
const page = (title: string): DatabaseRowsPage => ({ databaseId: "db", rows: [{ title }], items: [{ rowKey: "r", sortOrder: 0, row: { title } }], schema: { title: "text" }, config: {}, pagination: { limit: 10, total: 1, hasMore: false, nextCursor: null } });
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
it("dedupes concurrent reads but prevents query ABA and reconnect from resurrecting old responses", async () => {
  const pending: { query: string; resolve(p: DatabaseRowsPage): void }[] = [];
  const store = createDatabaseRuntimeStore({ provider: { listRows: (_id, options) => new Promise(resolve => pending.push({ query: options?.query ?? "", resolve })) } });
  store.ensureView("v", "db"); const initial = store.load("v"); expect(pending).toHaveLength(1);
  store.setQuery("v", "B"); store.setQuery("v", ""); expect(pending).toHaveLength(3);
  pending[2]!.resolve(page("Fresh A")); await flush(); expect(store.getView("v").items[0]!.row.title).toBe("Fresh A");
  pending[0]!.resolve(page("Old A")); pending[1]!.resolve(page("Old B")); await initial; await flush(); expect(store.getView("v").items[0]!.row.title).toBe("Fresh A");
  const oldRefresh = store.refresh("v"); store.invalidateReads(); expect(pending).toHaveLength(5);
  pending[3]!.resolve(page("Before reconnect")); await oldRefresh; expect(store.getView("v").status).toBe("loading");
  pending[4]!.resolve(page("Reconnected")); await flush(); expect(store.getView("v").items[0]!.row.title).toBe("Reconnected");
});
it("reloads all views of a written DB and cannot verify a write with a prewrite cohort", async () => {
  let calls = 0; const pending: ((p: DatabaseRowsPage) => void)[] = [];
  const provider: DatabaseProvider = { getDatabase: async () => ({ id: "db", title: "DB" }), listRows: async () => { if (++calls === 1) return page("Before"); return new Promise(resolve => pending.push(resolve)); }, createRow: async () => ({ created: true }) };
  const store = createDatabaseRuntimeStore({ provider }); store.ensureView("v1", "db"); await store.load("v1");
  store.ensureView("v2", "db"); await flush(); const write = store.createRow("v1", { title: "New" }); await flush();
  expect(calls).toBe(3); pending[1]!(page("After write")); await write; await flush();
  pending[0]!(page("Stale before write")); await flush();
  expect(store.getView("v1").items[0]!.row.title).toBe("After write"); expect(store.getView("v2").items[0]!.row.title).toBe("After write");
});
