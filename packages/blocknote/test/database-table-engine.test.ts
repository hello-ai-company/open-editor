/**
 * @vitest-environment jsdom
 *
 * Phase 4F-3A — DatabaseRuntimeStore + table interaction regressions.
 */
import { describe, expect, it, vi } from "vitest";
import type {
  DatabaseListOptions,
  DatabaseProvider,
  DatabaseRowsPage,
  JsonValue
} from "@hello-ai-company/editor-core";
import {
  buildDatabaseQueryKey,
  createDatabaseRuntimeStore,
  databaseViewInstanceKey,
  databaseViewKey
} from "../src/workspace/databaseRuntimeStore.js";
import {
  buildCreateRowPayload,
  creatableSchemaKeys,
  isCreatablePropertyKind,
  isEditablePropertyKind,
  normalizeDatabasePropertyType,
  valuesEqualForEdit
} from "../src/workspace/databaseProperty.js";
import { catchStoreMutation } from "../src/workspace/databaseView.js";
import { createEditorDocument, serializeEditorDocument } from "@hello-ai-company/editor-core";

type MemRow = {
  rowKey: string;
  sortOrder: number;
  deletedAt: string | null;
  row: Record<string, JsonValue>;
};

function createMemoryProvider(seed: MemRow[], options?: {
  pageSize?: number;
  stuckCursor?: boolean;
}): DatabaseProvider & { rows: MemRow[]; listCalls: number } {
  const rows = seed.map((r) => ({ ...r, row: { ...r.row } }));
  let listCalls = 0;
  const pageSize = options?.pageSize ?? 2;

  const provider: DatabaseProvider & { rows: MemRow[]; listCalls: number } = {
    rows,
    get listCalls() {
      return listCalls;
    },
    async getDatabase(databaseId) {
      return { id: databaseId, title: "Tasks" };
    },
    async listRows(databaseId, opts?: DatabaseListOptions): Promise<DatabaseRowsPage> {
      listCalls += 1;
      if (databaseId !== "tasks" && databaseId !== "x") {
        return {
          databaseId,
          rows: [],
          items: [],
          schema: { title: "text", status: "select" },
          config: {},
          pagination: {
            limit: opts?.limit ?? pageSize,
            nextCursor: null,
            hasMore: false,
            total: 0
          }
        };
      }
      let filtered = rows.filter((row) =>
        opts?.trashedOnly ? row.deletedAt != null : row.deletedAt == null
      );
      const q = opts?.query?.trim().toLowerCase();
      if (q) {
        filtered = filtered.filter((row) =>
          String(row.row.title ?? "").toLowerCase().includes(q)
        );
      }
      const sortBy = opts?.sortBy ?? "position";
      const direction = opts?.direction ?? "asc";
      filtered = [...filtered].sort((a, b) => {
        const cmp =
          sortBy === "title"
            ? String(a.row.title).localeCompare(String(b.row.title))
            : a.sortOrder - b.sortOrder;
        return direction === "desc" ? -cmp : cmp;
      });
      const limit = opts?.limit ?? pageSize;
      const start = opts?.cursor
        ? Math.max(0, filtered.findIndex((r) => r.rowKey === opts.cursor) + 1)
        : 0;
      const slice = filtered.slice(start, start + limit);
      let nextCursor: string | null =
        start + limit < filtered.length
          ? (slice[slice.length - 1]?.rowKey ?? null)
          : null;
      let hasMore = nextCursor !== null;
      if (options?.stuckCursor && opts?.cursor) {
        nextCursor = opts.cursor;
        hasMore = true;
      }
      return {
        databaseId,
        rows: slice.map((r) => r.row),
        items: slice.map((r) => ({
          rowKey: r.rowKey,
          sortOrder: r.sortOrder,
          deletedAt: r.deletedAt,
          row: { ...r.row }
        })),
        schema: { title: "text", status: "select" },
        config: {},
        pagination: {
          limit,
          nextCursor,
          hasMore,
          total: filtered.length
        }
      };
    },
    async createRow(_db, row) {
      const created: MemRow = {
        rowKey: `r-${rows.length + 1}`,
        sortOrder: rows.length,
        deletedAt: null,
        row: { ...row }
      };
      rows.push(created);
      return { rowKey: created.rowKey };
    },
    async updateRow(_db, rowKey, row) {
      const hit = rows.find((r) => r.rowKey === rowKey);
      if (!hit) throw new Error("missing");
      hit.row = { ...row };
      return { ok: true };
    },
    async deleteRow(_db, rowKey) {
      const hit = rows.find((r) => r.rowKey === rowKey);
      if (!hit) throw new Error("missing");
      hit.deletedAt = "now";
      return { ok: true };
    },
    async restoreRow(_db, rowKey) {
      const hit = rows.find((r) => r.rowKey === rowKey);
      if (!hit) throw new Error("missing");
      hit.deletedAt = null;
      return { ok: true };
    },
    async reorderRows(_db, rowKeys) {
      rowKeys.forEach((key, index) => {
        const hit = rows.find((r) => r.rowKey === key);
        if (hit) hit.sortOrder = index;
      });
      return { ok: true };
    }
  };
  return provider;
}

const seedRows: MemRow[] = [
  { rowKey: "a", sortOrder: 0, deletedAt: null, row: { title: "Alpha", status: "todo" } },
  { rowKey: "b", sortOrder: 1, deletedAt: null, row: { title: "Beta", status: "doing" } },
  { rowKey: "c", sortOrder: 2, deletedAt: null, row: { title: "Gamma", status: "done" } },
  { rowKey: "d", sortOrder: 3, deletedAt: null, row: { title: "Delta", status: "todo" } }
];

describe("normalizeDatabasePropertyType", () => {
  it("maps known aliases and unknown host types", () => {
    expect(normalizeDatabasePropertyType("text")).toBe("text");
    expect(normalizeDatabasePropertyType("checkbox")).toBe("boolean");
    expect(normalizeDatabasePropertyType("status")).toBe("status");
    expect(normalizeDatabasePropertyType("formula")).toBe("unknown");
    expect(isCreatablePropertyKind("readonly")).toBe(false);
    expect(isCreatablePropertyKind("text")).toBe(true);
    expect(isEditablePropertyKind("text")).toBe(true);
    expect(isEditablePropertyKind("select")).toBe(false);
    expect(isEditablePropertyKind("date")).toBe(false);
    expect(isEditablePropertyKind("url")).toBe(false);
  });

  it("New Row payload omits readonly/unknown fields (R1 P1-1)", () => {
    const schema = {
      title: "text",
      done: "checkbox",
      score: "number",
      formula: "formula",
      rollup: "rollup",
      status: "select"
    };
    expect(creatableSchemaKeys(schema)).toEqual(["title", "done", "score"]);
    const payload = buildCreateRowPayload(schema, {
      title: "Hello",
      done: "true",
      score: "3",
      formula: "should-not-appear",
      rollup: "",
      status: "todo"
    });
    expect(payload).toEqual({
      title: "Hello",
      done: true,
      score: 3
    });
    expect(payload).not.toHaveProperty("formula");
    expect(payload).not.toHaveProperty("rollup");
    expect(payload).not.toHaveProperty("status");
  });
});

describe("DatabaseRuntimeStore — read", () => {
  it("loads ready / empty / error states", async () => {
    const provider = createMemoryProvider(seedRows);
    const store = createDatabaseRuntimeStore({
      provider,
      defaultPageSize: 10
    });
    const key = databaseViewKey("tasks", "main");
    store.ensureView(key, "tasks");
    await store.load(key);
    expect(store.getView(key).status).toBe("ready");
    expect(store.getView(key).items.length).toBe(4);

    const emptyProvider = createMemoryProvider([]);
    const emptyStore = createDatabaseRuntimeStore({
      provider: emptyProvider,
      defaultPageSize: 10
    });
    emptyStore.ensureView(key, "tasks");
    await emptyStore.load(key);
    expect(emptyStore.getView(key).status).toBe("empty");
    expect(emptyStore.getView(key).emptyReason).toBe("no-rows");

    const failing: DatabaseProvider = {
      listRows: async () => {
        throw new Error("boom");
      }
    };
    const errStore = createDatabaseRuntimeStore({ provider: failing });
    errStore.ensureView(key, "tasks");
    await errStore.load(key);
    expect(errStore.getView(key).status).toBe("error");
    expect(errStore.getView(key).errorMessage).toBe("boom");
  });

  it("dedupes identical in-flight listRows", async () => {
    let resolve!: (page: DatabaseRowsPage) => void;
    let calls = 0;
    const provider: DatabaseProvider = {
      listRows: () => {
        calls += 1;
        return new Promise((r) => {
          resolve = r;
        });
      }
    };
    const store = createDatabaseRuntimeStore({ provider, defaultPageSize: 10 });
    const key = databaseViewKey("tasks", "main");
    store.ensureView(key, "tasks");
    const a = store.load(key);
    const b = store.load(key);
    // Second load bumps generation — may start another request after first generation bump
    // Use concurrent ensure via fetchPage by creating two views with same query
    resolve({
      databaseId: "tasks",
      rows: [],
      items: [],
      schema: {},
      config: {},
      pagination: { limit: 10, nextCursor: null, hasMore: false, total: 0 }
    });
    await Promise.all([a, b]);
    expect(calls).toBeGreaterThanOrEqual(1);

    // Explicit concurrent same query key
    let resolve2!: (page: DatabaseRowsPage) => void;
    let calls2 = 0;
    const provider2: DatabaseProvider = {
      listRows: () => {
        calls2 += 1;
        return new Promise((r) => {
          resolve2 = r;
        });
      }
    };
    const store2 = createDatabaseRuntimeStore({ provider: provider2, defaultPageSize: 10 });
    const k1 = databaseViewKey("tasks", "v1");
    const k2 = databaseViewKey("tasks", "v2");
    store2.ensureView(k1, "tasks");
    store2.ensureView(k2, "tasks");
    // Both start load with same query options → shared inflight
    const p1 = store2.load(k1);
    const p2 = store2.load(k2);
    expect(calls2).toBe(1);
    resolve2({
      databaseId: "tasks",
      rows: [],
      items: [
        { rowKey: "x", sortOrder: 0, row: { title: "X" } }
      ],
      schema: { title: "text" },
      config: {},
      pagination: { limit: 10, nextCursor: null, hasMore: false, total: 1 }
    });
    await Promise.all([p1, p2]);
    expect(calls2).toBe(1);
    expect(store2.getView(k1).items[0]?.rowKey).toBe("x");
    expect(store2.getView(k2).items[0]?.rowKey).toBe("x");
  });

  it("isolates two database IDs and two store instances", async () => {
    const provider = createMemoryProvider(seedRows, { pageSize: 10 });
    const store = createDatabaseRuntimeStore({ provider, defaultPageSize: 10 });
    store.ensureView("tasks::main", "tasks");
    store.ensureView("projects::main", "projects");
    await store.load("tasks::main");
    await store.load("projects::main");
    expect(store.getView("tasks::main").items.length).toBe(4);
    expect(store.getView("projects::main").status).toBe("empty");

    const storeA = createDatabaseRuntimeStore({
      provider: createMemoryProvider([
        { rowKey: "a", sortOrder: 0, deletedAt: null, row: { title: "A" } }
      ], { pageSize: 10 }),
      defaultPageSize: 10
    });
    const storeB = createDatabaseRuntimeStore({
      provider: createMemoryProvider([
        { rowKey: "b", sortOrder: 0, deletedAt: null, row: { title: "B" } }
      ], { pageSize: 10 }),
      defaultPageSize: 10
    });
    storeA.ensureView("x::main", "x");
    storeB.ensureView("x::main", "x");
    await storeA.load("x::main");
    await storeB.load("x::main");
    expect(storeA.getView("x::main").items[0]?.row.title).toBe("A");
    expect(storeB.getView("x::main").items[0]?.row.title).toBe("B");
  });

  it("ignores stale query A after query B wins", async () => {
    let resolveA!: (page: DatabaseRowsPage) => void;
    let resolveB!: (page: DatabaseRowsPage) => void;
    let n = 0;
    const provider: DatabaseProvider = {
      listRows: async (_db, _opts) => {
        n += 1;
        if (n === 1) {
          return new Promise((resolve) => {
            resolveA = resolve;
          });
        }
        return new Promise((resolve) => {
          resolveB = resolve;
        });
      }
    };
    const store = createDatabaseRuntimeStore({ provider, defaultPageSize: 10 });
    const key = databaseViewKey("tasks", "main");
    store.ensureView(key, "tasks");
    const loadA = store.load(key);
    store.setQuery(key, "roadmap");
    // setQuery triggers new load (B)
    await new Promise((r) => setTimeout(r, 5));
    resolveB({
      databaseId: "tasks",
      rows: [{ title: "Roadmap" }],
      items: [{ rowKey: "r", sortOrder: 0, row: { title: "Roadmap" } }],
      schema: { title: "text" },
      config: {},
      pagination: { limit: 10, nextCursor: null, hasMore: false, total: 1 }
    });
    await new Promise((r) => setTimeout(r, 5));
    expect(store.getView(key).items[0]?.row.title).toBe("Roadmap");
    resolveA({
      databaseId: "tasks",
      rows: [{ title: "Apple" }],
      items: [{ rowKey: "a", sortOrder: 0, row: { title: "Apple" } }],
      schema: { title: "text" },
      config: {},
      pagination: { limit: 10, nextCursor: null, hasMore: false, total: 1 }
    });
    await loadA.catch(() => undefined);
    await new Promise((r) => setTimeout(r, 5));
    expect(store.getView(key).items[0]?.row.title).toBe("Roadmap");
  });

  it("treats missing getDatabase as optional meta", async () => {
    const provider: DatabaseProvider = {
      listRows: async () => ({
        databaseId: "tasks",
        rows: [],
        items: [],
        schema: {},
        config: {},
        pagination: { limit: 10, nextCursor: null, hasMore: false, total: 0 }
      })
    };
    const store = createDatabaseRuntimeStore({ provider, defaultPageSize: 10 });
    store.ensureView("tasks::main", "tasks");
    await store.load("tasks::main");
    expect(store.getView("tasks::main").metaStatus).toBe("unavailable");
    expect(store.getView("tasks::main").status).toBe("empty");
  });
});

describe("DatabaseRuntimeStore — pagination", () => {
  it("appends load more, dedupes, and stops on stuck cursor", async () => {
    const provider = createMemoryProvider(seedRows, { pageSize: 2 });
    const store = createDatabaseRuntimeStore({
      provider,
      defaultPageSize: 2
    });
    const key = databaseViewKey("tasks", "main");
    store.ensureView(key, "tasks");
    await store.load(key);
    expect(store.getView(key).items.map((i) => i.rowKey)).toEqual(["a", "b"]);
    expect(store.getView(key).pagination.hasMore).toBe(true);

    await store.loadMore(key);
    expect(store.getView(key).items.map((i) => i.rowKey)).toEqual([
      "a",
      "b",
      "c",
      "d"
    ]);

    // Concurrent loadMore prevented
    const stuck = createMemoryProvider(seedRows, {
      pageSize: 2,
      stuckCursor: true
    });
    const stuckStore = createDatabaseRuntimeStore({
      provider: stuck,
      defaultPageSize: 2
    });
    stuckStore.ensureView(key, "tasks");
    await stuckStore.load(key);
    await stuckStore.loadMore(key);
    expect(stuckStore.getView(key).pagination.hasMore).toBe(false);
    expect(stuckStore.getView(key).loadMoreError).toMatch(/cursor/i);
  });

  it("ignores stale loadMore after query change", async () => {
    let resolveMore!: (page: DatabaseRowsPage) => void;
    let calls = 0;
    const provider: DatabaseProvider = {
      listRows: async (_db, opts) => {
        calls += 1;
        if (opts?.cursor) {
          return new Promise((resolve) => {
            resolveMore = resolve;
          });
        }
        return {
          databaseId: "tasks",
          rows: [{ title: "A" }],
          items: [{ rowKey: "a", sortOrder: 0, row: { title: "A" } }],
          schema: { title: "text" },
          config: {},
          pagination: {
            limit: 1,
            nextCursor: "a",
            hasMore: true,
            total: 2
          }
        };
      }
    };
    const store = createDatabaseRuntimeStore({ provider, defaultPageSize: 1 });
    const key = databaseViewKey("tasks", "main");
    store.ensureView(key, "tasks");
    await store.load(key);
    const more = store.loadMore(key);
    store.setQuery(key, "z");
    resolveMore({
      databaseId: "tasks",
      rows: [{ title: "Stale" }],
      items: [{ rowKey: "stale", sortOrder: 1, row: { title: "Stale" } }],
      schema: { title: "text" },
      config: {},
      pagination: { limit: 1, nextCursor: null, hasMore: false, total: 1 }
    });
    await more;
    await new Promise((r) => setTimeout(r, 10));
    expect(
      store.getView(key).items.some((i) => i.rowKey === "stale")
    ).toBe(false);
    expect(calls).toBeGreaterThanOrEqual(2);
    // R2 P1-1: superseded loadMore must not leave permanent busy state
    expect(store.getView(key).mutating).toBeNull();
  });

  it("disables load more when hasMore is false", async () => {
    const provider = createMemoryProvider(seedRows.slice(0, 1), {
      pageSize: 10
    });
    const store = createDatabaseRuntimeStore({
      provider,
      defaultPageSize: 10
    });
    store.ensureView("tasks::main", "tasks");
    await store.load("tasks::main");
    expect(store.getView("tasks::main").pagination.hasMore).toBe(false);
    const before = provider.listCalls;
    await store.loadMore("tasks::main");
    expect(provider.listCalls).toBe(before);
  });
});

describe("DatabaseRuntimeStore — mutations", () => {
  it("create: cancel-free path; success refreshes; failure preserves rows", async () => {
    const provider = createMemoryProvider(seedRows.slice(0, 1), {
      pageSize: 10
    });
    const store = createDatabaseRuntimeStore({
      provider,
      defaultPageSize: 10
    });
    store.ensureView("tasks::main", "tasks");
    await store.load("tasks::main");
    await store.createRow("tasks::main", { title: "New", status: "todo" });
    expect(store.getView("tasks::main").items.some((i) => i.row.title === "New")).toBe(
      true
    );

    const failingCreate: DatabaseProvider = {
      ...createMemoryProvider(seedRows.slice(0, 1), { pageSize: 10 }),
      createRow: async () => {
        throw new Error("create fail");
      }
    };
    const store2 = createDatabaseRuntimeStore({
      provider: failingCreate,
      defaultPageSize: 10
    });
    store2.ensureView("tasks::main", "tasks");
    await store2.load("tasks::main");
    const before = store2.getView("tasks::main").items.length;
    await expect(
      store2.createRow("tasks::main", { title: "X" })
    ).rejects.toThrow("create fail");
    expect(store2.getView("tasks::main").items.length).toBe(before);
    expect(store2.getView("tasks::main").mutationError).toBe("create fail");
  });

  it("update: unchanged valuesEqual; changed sends complete row; failure recoverable", async () => {
    expect(valuesEqualForEdit("a", "a")).toBe(true);
    expect(valuesEqualForEdit("a", "b")).toBe(false);

    const provider = createMemoryProvider(
      [{ rowKey: "a", sortOrder: 0, deletedAt: null, row: { title: "Alpha", status: "todo" } }],
      { pageSize: 10 }
    );
    const updateSpy = vi.spyOn(provider, "updateRow");
    const store = createDatabaseRuntimeStore({
      provider,
      defaultPageSize: 10
    });
    store.ensureView("tasks::main", "tasks");
    await store.load("tasks::main");
    await store.updateRow("tasks::main", "a", {
      title: "Alpha2",
      status: "todo"
    });
    expect(updateSpy).toHaveBeenCalledWith(
      "tasks",
      "a",
      { title: "Alpha2", status: "todo" },
      undefined
    );
    expect(store.getView("tasks::main").items[0]?.row.title).toBe("Alpha2");

    provider.updateRow = async () => {
      throw new Error("update fail");
    };
    await expect(
      store.updateRow("tasks::main", "a", {
        title: "Nope",
        status: "todo"
      })
    ).rejects.toThrow("update fail");
    expect(store.getView("tasks::main").items[0]?.row.title).toBe("Alpha2");
  });

  it("delete / restore with trash mode", async () => {
    const provider = createMemoryProvider(
      [{ rowKey: "a", sortOrder: 0, deletedAt: null, row: { title: "Alpha" } }],
      { pageSize: 10 }
    );
    const store = createDatabaseRuntimeStore({
      provider,
      defaultPageSize: 10
    });
    store.ensureView("tasks::main", "tasks");
    await store.load("tasks::main");
    await store.deleteRow("tasks::main", "a");
    expect(store.getView("tasks::main").status).toBe("empty");
    store.setTrashMode("tasks::main", "trash");
    await new Promise((r) => setTimeout(r, 10));
    expect(store.getView("tasks::main").items[0]?.rowKey).toBe("a");
    await store.restoreRow("tasks::main", "a");
    store.setTrashMode("tasks::main", "active");
    await new Promise((r) => setTimeout(r, 10));
    expect(store.getView("tasks::main").items[0]?.rowKey).toBe("a");
  });

  it("delete failure keeps row", async () => {
    const provider = createMemoryProvider(
      [{ rowKey: "a", sortOrder: 0, deletedAt: null, row: { title: "Alpha" } }],
      { pageSize: 10 }
    );
    provider.deleteRow = async () => {
      throw new Error("delete fail");
    };
    const store = createDatabaseRuntimeStore({
      provider,
      defaultPageSize: 10
    });
    store.ensureView("tasks::main", "tasks");
    await store.load("tasks::main");
    await expect(store.deleteRow("tasks::main", "a")).rejects.toThrow(
      "delete fail"
    );
    expect(store.getView("tasks::main").items[0]?.rowKey).toBe("a");
  });
});

describe("DatabaseRuntimeStore — reorder safety", () => {
  it("enables only for full position asc list; disables otherwise", async () => {
    const provider = createMemoryProvider(seedRows, { pageSize: 10 });
    const store = createDatabaseRuntimeStore({
      provider,
      defaultPageSize: 10
    });
    store.ensureView("tasks::main", "tasks");
    await store.load("tasks::main");
    expect(store.getView("tasks::main").canReorder).toBe(true);

    store.setQuery("tasks::main", "al");
    await new Promise((r) => setTimeout(r, 10));
    expect(store.getView("tasks::main").canReorder).toBe(false);

    store.setQuery("tasks::main", "");
    store.setSort("tasks::main", "title", "asc");
    await new Promise((r) => setTimeout(r, 10));
    expect(store.getView("tasks::main").canReorder).toBe(false);

    store.setSort("tasks::main", "position", "desc");
    await new Promise((r) => setTimeout(r, 10));
    expect(store.getView("tasks::main").canReorder).toBe(false);
    expect(store.getView("tasks::main").reorderDisabledReason).toMatch(
      /ascending/i
    );

    const paged = createMemoryProvider(seedRows, { pageSize: 2 });
    const pagedStore = createDatabaseRuntimeStore({
      provider: paged,
      defaultPageSize: 2
    });
    pagedStore.ensureView("tasks::main", "tasks");
    await pagedStore.load("tasks::main");
    expect(pagedStore.getView("tasks::main").canReorder).toBe(false);
    expect(pagedStore.getView("tasks::main").reorderDisabledReason).toMatch(
      /Load all/
    );
  });

  it("disables reorder when items.length !== total (R1 P2)", async () => {
    const provider: DatabaseProvider = {
      listRows: async () => ({
        databaseId: "tasks",
        rows: [],
        items: [
          {
            rowKey: "a",
            sortOrder: 0,
            deletedAt: null,
            row: { title: "A" }
          },
          {
            rowKey: "b",
            sortOrder: 1,
            deletedAt: null,
            row: { title: "B" }
          }
        ],
        schema: { title: "text" },
        config: {},
        pagination: {
          limit: 10,
          nextCursor: null,
          hasMore: false,
          total: 10
        }
      }),
      reorderRows: async () => null
    };
    const store = createDatabaseRuntimeStore({ provider, defaultPageSize: 10 });
    store.ensureView("tasks::main", "tasks");
    await store.load("tasks::main");
    expect(store.getView("tasks::main").canReorder).toBe(false);
    expect(store.getView("tasks::main").reorderDisabledReason).toMatch(
      /Incomplete/
    );
  });

  it("disables reorder when total is 0 but items exist (R2 P2 fail-closed)", async () => {
    const provider: DatabaseProvider = {
      listRows: async () => ({
        databaseId: "tasks",
        rows: [],
        items: [
          {
            rowKey: "a",
            sortOrder: 0,
            deletedAt: null,
            row: { title: "A" }
          },
          {
            rowKey: "b",
            sortOrder: 1,
            deletedAt: null,
            row: { title: "B" }
          }
        ],
        schema: { title: "text" },
        config: {},
        pagination: {
          limit: 10,
          nextCursor: null,
          hasMore: false,
          total: 0
        }
      }),
      reorderRows: async () => null
    };
    const store = createDatabaseRuntimeStore({ provider, defaultPageSize: 10 });
    store.ensureView("tasks::main", "tasks");
    await store.load("tasks::main");
    expect(store.getView("tasks::main").canReorder).toBe(false);
    expect(store.getView("tasks::main").reorderDisabledReason).toMatch(
      /Incomplete/
    );
  });

  it("reorder success uses ordered keys; error preserves order", async () => {
    const provider = createMemoryProvider(seedRows.slice(0, 2), {
      pageSize: 10
    });
    const spy = vi.spyOn(provider, "reorderRows");
    const store = createDatabaseRuntimeStore({
      provider,
      defaultPageSize: 10
    });
    store.ensureView("tasks::main", "tasks");
    await store.load("tasks::main");
    await store.reorderRows("tasks::main", ["b", "a"]);
    expect(spy).toHaveBeenCalledWith("tasks", ["b", "a"]);
    expect(store.getView("tasks::main").items.map((i) => i.rowKey)).toEqual([
      "b",
      "a"
    ]);

    provider.reorderRows = async () => {
      throw new Error("reorder fail");
    };
    await expect(
      store.reorderRows("tasks::main", ["a", "b"])
    ).rejects.toThrow("reorder fail");
    expect(store.getView("tasks::main").items.map((i) => i.rowKey)).toEqual([
      "b",
      "a"
    ]);
  });
});

describe("4F-3A R1 — block instance isolation + mutation catch", () => {
  it("two blocks with same databaseId+viewId keep independent UI state (P1-2)", async () => {
    const provider = createMemoryProvider(seedRows, { pageSize: 10 });
    const store = createDatabaseRuntimeStore({
      provider,
      defaultPageSize: 10
    });
    const a = databaseViewInstanceKey("block-a", "tasks", "main");
    const b = databaseViewInstanceKey("block-b", "tasks", "main");
    expect(a).not.toBe(b);
    expect(a).not.toBe(databaseViewKey("tasks", "main"));

    store.ensureView(a, "tasks");
    store.ensureView(b, "tasks");
    await Promise.all([store.load(a), store.load(b)]);

    store.setQuery(a, "roadmap");
    store.setTrashMode(a, "trash");
    store.setSort(a, "title", "desc");
    await new Promise((r) => setTimeout(r, 20));

    expect(store.getView(a).queryState.query).toBe("roadmap");
    expect(store.getView(a).queryState.trashMode).toBe("trash");
    expect(store.getView(a).queryState.sortBy).toBe("title");

    expect(store.getView(b).queryState.query).toBe("");
    expect(store.getView(b).queryState.trashMode).toBe("active");
    expect(store.getView(b).queryState.sortBy).toBe("position");
    expect(store.getView(b).queryState.direction).toBe("asc");
  });

  it("catchStoreMutation prevents unhandled rejection while preserving rows (P1-3)", async () => {
    const provider = createMemoryProvider(
      [{ rowKey: "a", sortOrder: 0, deletedAt: null, row: { title: "Alpha" } }],
      { pageSize: 10 }
    );
    provider.deleteRow = async () => {
      throw new Error("delete fail");
    };
    const store = createDatabaseRuntimeStore({
      provider,
      defaultPageSize: 10
    });
    const key = databaseViewInstanceKey("blk", "tasks", "main");
    store.ensureView(key, "tasks");
    await store.load(key);

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      catchStoreMutation(store.deleteRow(key, "a"));
      await new Promise((r) => setTimeout(r, 30));
      expect(unhandled).toEqual([]);
      expect(store.getView(key).mutationError).toMatch(/delete fail/);
      expect(store.getView(key).items[0]?.rowKey).toBe("a");
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});

describe("4F-3A R2 — idle isolation + query key safety", () => {
  it("idle snapshots do not leak capabilities across store instances (P1-2)", () => {
    const storeA = createDatabaseRuntimeStore({
      provider: {
        listRows: async () => ({
          databaseId: "tasks",
          rows: [],
          items: [],
          schema: {},
          config: {},
          pagination: { limit: 10, nextCursor: null, hasMore: false, total: 0 }
        }),
        createRow: async () => null
      }
    });
    const storeB = createDatabaseRuntimeStore({
      provider: {
        listRows: async () => ({
          databaseId: "tasks",
          rows: [],
          items: [],
          schema: {},
          config: {},
          pagination: { limit: 10, nextCursor: null, hasMore: false, total: 0 }
        })
      }
    });
    const key = "same-view-key";
    const snapA = storeA.getView(key);
    const snapB = storeB.getView(key);
    expect(snapA.capabilities.create).toBe(true);
    expect(snapB.capabilities.create).toBe(false);
    expect(snapA).not.toBe(snapB);
  });

  it("query keys distinguish delimiter-colliding databaseId/query pairs (P1-3)", async () => {
    const base = {
      sortBy: "position" as const,
      direction: "asc" as const,
      trashMode: "active" as const,
      pageSize: 10,
      filters: [] as const,
      propertySort: null
    };
    const keyA = buildDatabaseQueryKey("a|q=b", { ...base, query: "c" });
    const keyB = buildDatabaseQueryKey("a", { ...base, query: "b|q=c" });
    expect(keyA).not.toBe(keyB);

    const calls: Array<{ db: string; q?: string }> = [];
    let resolveA!: (page: DatabaseRowsPage) => void;
    let resolveB!: (page: DatabaseRowsPage) => void;
    const provider: DatabaseProvider = {
      listRows: (databaseId, opts) => {
        calls.push({ db: databaseId, q: opts?.query });
        return new Promise((resolve) => {
          if (databaseId === "a|q=b") resolveA = resolve;
          else resolveB = resolve;
        });
      }
    };
    const store = createDatabaseRuntimeStore({ provider, defaultPageSize: 10 });
    store.ensureView("v1", "a|q=b");
    store.ensureView("v2", "a");
    // Reset auto-load noise by waiting a tick then issuing simultaneous loads
    // with the historically colliding query shapes.
    store.setQuery("v1", "c");
    store.setQuery("v2", "b|q=c");
    await new Promise((r) => setTimeout(r, 0));

    // Both requests must be in flight independently (not one shared promise).
    expect(typeof resolveA).toBe("function");
    expect(typeof resolveB).toBe("function");
    expect(resolveA).not.toBe(resolveB);

    resolveA({
      databaseId: "a|q=b",
      rows: [],
      items: [{ rowKey: "from-a", sortOrder: 0, row: { title: "A" } }],
      schema: { title: "text" },
      config: {},
      pagination: { limit: 10, nextCursor: null, hasMore: false, total: 1 }
    });
    resolveB({
      databaseId: "a",
      rows: [],
      items: [{ rowKey: "from-b", sortOrder: 0, row: { title: "B" } }],
      schema: { title: "text" },
      config: {},
      pagination: { limit: 10, nextCursor: null, hasMore: false, total: 1 }
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(store.getView("v1").items.map((i) => i.rowKey)).toEqual(["from-a"]);
    expect(store.getView("v2").items.map((i) => i.rowKey)).toEqual(["from-b"]);
    expect(
      calls.some((c) => c.db === "a|q=b" && c.q === "c")
    ).toBe(true);
    expect(
      calls.some((c) => c.db === "a" && c.q === "b|q=c")
    ).toBe(true);
  });

  it("instance keys distinguish delimiter-colliding block/db ids", () => {
    const a = databaseViewInstanceKey("x::y", "db", "main");
    const b = databaseViewInstanceKey("x", "y::db", "main");
    expect(a).not.toBe(b);
    expect(databaseViewKey("a::b", "c")).not.toBe(databaseViewKey("a", "b::c"));
  });
});

describe("4F-3A R3 — write mutating + first-page/loadMore races", () => {
  it("query change during create keeps write mutating busy (P1-1)", async () => {
    let resolveCreate!: (value: JsonValue) => void;
    let resolveQuery!: (page: DatabaseRowsPage) => void;
    const provider: DatabaseProvider = {
      listRows: async (_db, opts) => {
        if (opts?.query === "roadmap") {
          return new Promise((resolve) => {
            resolveQuery = resolve;
          });
        }
        return {
          databaseId: "tasks",
          rows: [],
          items: [
            { rowKey: "a", sortOrder: 0, row: { title: "Alpha" } }
          ],
          schema: { title: "text" },
          config: {},
          pagination: { limit: 10, nextCursor: null, hasMore: false, total: 1 }
        };
      },
      createRow: () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
      deleteRow: async () => null
    };
    const store = createDatabaseRuntimeStore({ provider, defaultPageSize: 10 });
    store.ensureView("tasks::main", "tasks");
    await store.load("tasks::main");

    const createPromise = store.createRow("tasks::main", { title: "New" });
    await new Promise((r) => setTimeout(r, 0));
    expect(store.getView("tasks::main").mutating?.kind).toBe("creating");

    store.setQuery("tasks::main", "roadmap");
    await new Promise((r) => setTimeout(r, 0));
    expect(store.getView("tasks::main").status).toBe("loading");
    expect(store.getView("tasks::main").mutating?.kind).toBe("creating");

    await expect(
      store.deleteRow("tasks::main", "a")
    ).rejects.toThrow(/loading|mutation/i);

    resolveCreate({ ok: true });
    resolveQuery({
      databaseId: "tasks",
      rows: [],
      items: [],
      schema: { title: "text" },
      config: {},
      pagination: { limit: 10, nextCursor: null, hasMore: false, total: 0 }
    });
    await createPromise;
    expect(store.getView("tasks::main").mutating).toBeNull();
  });

  it("first-page reload clears pagination so loadMore cannot use stale cursor (P1-2)", async () => {
    let resolveFirst!: (page: DatabaseRowsPage) => void;
    let loadMoreCalls = 0;
    const provider: DatabaseProvider = {
      listRows: async (_db, opts) => {
        if (opts?.cursor) {
          loadMoreCalls += 1;
          return {
            databaseId: "tasks",
            rows: [],
            items: [
              {
                rowKey: "stale-append",
                sortOrder: 99,
                row: { title: "Should not append" }
              }
            ],
            schema: { title: "text" },
            config: {},
            pagination: {
              limit: 1,
              nextCursor: null,
              hasMore: false,
              total: 2
            }
          };
        }
        if (opts?.query === "roadmap") {
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        }
        return {
          databaseId: "tasks",
          rows: [],
          items: [
            { rowKey: "a", sortOrder: 0, row: { title: "A" } }
          ],
          schema: { title: "text" },
          config: {},
          pagination: {
            limit: 1,
            nextCursor: "a",
            hasMore: true,
            total: 2
          }
        };
      }
    };
    const store = createDatabaseRuntimeStore({ provider, defaultPageSize: 1 });
    store.ensureView("tasks::main", "tasks");
    await store.load("tasks::main");
    expect(store.getView("tasks::main").pagination.hasMore).toBe(true);
    expect(store.getView("tasks::main").pagination.nextCursor).toBe("a");

    store.setQuery("tasks::main", "roadmap");
    await new Promise((r) => setTimeout(r, 0));
    const mid = store.getView("tasks::main");
    expect(mid.status).toBe("loading");
    expect(mid.pagination.hasMore).toBe(false);
    expect(mid.pagination.nextCursor).toBeNull();

    await store.loadMore("tasks::main");
    expect(loadMoreCalls).toBe(0);

    resolveFirst({
      databaseId: "tasks",
      rows: [],
      items: [
        { rowKey: "r1", sortOrder: 0, row: { title: "roadmap" } }
      ],
      schema: { title: "text" },
      config: {},
      pagination: { limit: 1, nextCursor: null, hasMore: false, total: 1 }
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(
      store.getView("tasks::main").items.some((i) => i.rowKey === "stale-append")
    ).toBe(false);
    expect(store.getView("tasks::main").items.map((i) => i.rowKey)).toEqual([
      "r1"
    ]);
  });
});

describe("architecture — rows never persist into EditorDocument", () => {
  it("serialized databaseView props exclude rows/items/schema/query", async () => {
    const provider = createMemoryProvider(seedRows, { pageSize: 10 });
    const store = createDatabaseRuntimeStore({
      provider,
      defaultPageSize: 10
    });
    store.ensureView("tasks::main", "tasks");
    await store.load("tasks::main");
    await store.createRow("tasks::main", { title: "Extra", status: "todo" });
    store.setQuery("tasks::main", "Extra");
    await new Promise((r) => setTimeout(r, 10));

    const doc = createEditorDocument([
      {
        id: "db1",
        type: "databaseView",
        props: {
          databaseId: "tasks",
          viewId: "main-table",
          viewType: "table",
          titleHint: "Tasks"
        },
        children: []
      }
    ]);
    const json = serializeEditorDocument(doc);
    expect(json).toContain('"databaseId":"tasks"');
    expect(json).not.toContain("Outline power UX");
    expect(json).not.toContain("Extra");
    expect(json).not.toContain('"items"');
    expect(json).not.toContain("mutation");
    expect(json).not.toContain("nextCursor");
  });
});

describe("capability-aware UI flags", () => {
  it("list-only provider has no mutation capabilities", async () => {
    const provider: DatabaseProvider = {
      listRows: async () => ({
        databaseId: "tasks",
        rows: [],
        items: [],
        schema: {},
        config: {},
        pagination: { limit: 10, nextCursor: null, hasMore: false, total: 0 }
      })
    };
    const store = createDatabaseRuntimeStore({ provider, defaultPageSize: 10 });
    store.ensureView("tasks::main", "tasks");
    await store.load("tasks::main");
    const caps = store.getView("tasks::main").capabilities;
    expect(caps.list).toBe(true);
    expect(caps.create).toBe(false);
    expect(caps.update).toBe(false);
    expect(caps.delete).toBe(false);
    expect(caps.restore).toBe(false);
    expect(caps.reorder).toBe(false);
  });
});
