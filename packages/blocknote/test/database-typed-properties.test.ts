/**
 * @vitest-environment jsdom
 *
 * Phase 4F-3B — typed properties, filters, property sort, capability UX.
 */
import { describe, expect, it, vi } from "vitest";
import type {
  DatabaseFilter,
  DatabaseListOptions,
  DatabasePropertyDefinition,
  DatabaseProvider,
  DatabaseRowsPage,
  JsonValue
} from "@hello-ai-company/editor-core";
import {
  createEditorDocument,
  serializeEditorDocument
} from "@hello-ai-company/editor-core";
import {
  buildDatabaseQueryKey,
  createDatabaseRuntimeStore,
  listOptionsFromState
} from "../src/workspace/databaseRuntimeStore.js";
import {
  buildTypedCreateRowPayload,
  formatSelectDisplay,
  hostSupportsPropertyFilters,
  hostSupportsPropertySort,
  isEditableResolvedProperty,
  resolveDatabasePropertyDefinitions,
  sanitizeFiltersAgainstMetadata,
  validateDatabaseFilter,
  validateDatabaseFilters,
  validatePropertySort
} from "../src/workspace/databaseProperty.js";
import {
  encodePropertySortSelectValue,
  parseSortSelectValue,
  resolveCreateRowPayload
} from "../src/workspace/databaseView.js";

type MemRow = {
  rowKey: string;
  sortOrder: number;
  deletedAt: string | null;
  row: Record<string, JsonValue>;
};

const DEFINITIONS: readonly DatabasePropertyDefinition[] = [
  { id: "title", name: "Title", type: "text" },
  {
    id: "status",
    name: "Status",
    type: "status",
    options: [
      { value: "todo", label: "Backlog" },
      { value: "doing", label: "Doing" },
      { value: "done", label: "Done" }
    ]
  },
  { id: "score", name: "Score", type: "number" },
  { id: "done", name: "Done", type: "boolean" },
  { id: "due", name: "Due date", type: "date" },
  { id: "link", name: "Link", type: "url" },
  {
    id: "formulaPreview",
    name: "Formula",
    type: "unknown",
    readOnly: true,
    rawType: "formula"
  }
];

function matchesFilter(row: MemRow, filter: DatabaseFilter): boolean {
  const raw = row.row[filter.propertyId];
  if (filter.operator === "isEmpty") {
    return raw === null || raw === undefined || raw === "";
  }
  if (filter.operator === "isNotEmpty") {
    return !(raw === null || raw === undefined || raw === "");
  }
  if (filter.propertyType === "number" && "value" in filter && typeof filter.value === "number") {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) return false;
    if (filter.operator === "equals") return n === filter.value;
    if (filter.operator === "gt") return n > filter.value;
    if (filter.operator === "gte") return n >= filter.value;
    if (filter.operator === "lt") return n < filter.value;
    if (filter.operator === "lte") return n <= filter.value;
  }
  if (
    (filter.propertyType === "status" || filter.propertyType === "select") &&
    "value" in filter
  ) {
    const v = String(raw ?? "");
    if (filter.operator === "equals") return v === filter.value;
    if (filter.operator === "notEquals") return v !== filter.value;
  }
  if (
    filter.propertyType === "boolean" &&
    filter.operator === "is" &&
    "value" in filter
  ) {
    return (raw === true) === filter.value;
  }
  if (filter.propertyType === "date" && "value" in filter) {
    const d = String(raw ?? "");
    if (filter.operator === "on") return d === filter.value;
    if (filter.operator === "before") return d !== "" && d < filter.value;
    if (filter.operator === "after") return d !== "" && d > filter.value;
  }
  if (
    (filter.propertyType === "text" || filter.propertyType === "url") &&
    "value" in filter
  ) {
    const t = String(raw ?? "");
    if (filter.operator === "contains") {
      return t.toLowerCase().includes(String(filter.value).toLowerCase());
    }
    if (filter.operator === "equals") return t === filter.value;
    if (filter.operator === "notEquals") return t !== filter.value;
  }
  return true;
}

function createTypedMemoryProvider(
  seed: MemRow[],
  options?: {
    pageSize?: number;
    capabilities?: { propertyFilters?: boolean; propertySort?: boolean };
    definitions?: readonly DatabasePropertyDefinition[];
    onList?: (opts?: DatabaseListOptions) => void;
  }
): DatabaseProvider & {
  rows: MemRow[];
  lastListOptions?: DatabaseListOptions;
  listCalls: number;
  setDefinitions: (defs: readonly DatabasePropertyDefinition[]) => void;
} {
  const rows = seed.map((r) => ({ ...r, row: { ...r.row } }));
  let listCalls = 0;
  let definitions = [...(options?.definitions ?? DEFINITIONS)];
  const pageSize = options?.pageSize ?? 2;
  const caps = options?.capabilities ?? {
    propertyFilters: true,
    propertySort: true
  };
  let lastListOptions: DatabaseListOptions | undefined;

  const provider: DatabaseProvider & {
    rows: MemRow[];
    lastListOptions?: DatabaseListOptions;
    listCalls: number;
    setDefinitions: (defs: readonly DatabasePropertyDefinition[]) => void;
  } = {
    rows,
    get listCalls() {
      return listCalls;
    },
    get lastListOptions() {
      return lastListOptions;
    },
    setDefinitions(defs) {
      definitions = [...defs];
    },
    async getDatabase(databaseId) {
      return {
        id: databaseId,
        title: "Tasks",
        propertyDefinitions: definitions,
        queryCapabilities: caps
      };
    },
    async listRows(databaseId, opts?: DatabaseListOptions): Promise<DatabaseRowsPage> {
      listCalls += 1;
      lastListOptions = opts ? { ...opts, filters: opts.filters ? [...opts.filters] : undefined } : undefined;
      await options?.onList?.(opts);
      let filtered = rows.filter((row) =>
        opts?.trashedOnly ? row.deletedAt != null : row.deletedAt == null
      );
      const q = opts?.query?.trim().toLowerCase();
      if (q) {
        filtered = filtered.filter((row) =>
          String(row.row.title ?? "").toLowerCase().includes(q)
        );
      }
      if (opts?.filters?.length) {
        filtered = filtered.filter((row) =>
          opts.filters!.every((f) => matchesFilter(row, f))
        );
      }
      if (opts?.propertySort) {
        const sort = opts.propertySort;
        filtered = [...filtered].sort((a, b) => {
          const av = a.row[sort.propertyId];
          const bv = b.row[sort.propertyId];
          let cmp = 0;
          if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
          else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
          return sort.direction === "desc" ? -cmp : cmp;
        });
      } else {
        const sortBy = opts?.sortBy ?? "position";
        const direction = opts?.direction ?? "asc";
        filtered = [...filtered].sort((a, b) => {
          const cmp =
            sortBy === "title"
              ? String(a.row.title).localeCompare(String(b.row.title))
              : a.sortOrder - b.sortOrder;
          return direction === "desc" ? -cmp : cmp;
        });
      }
      const limit = opts?.limit ?? pageSize;
      const start = opts?.cursor
        ? Math.max(0, filtered.findIndex((r) => r.rowKey === opts.cursor) + 1)
        : 0;
      const slice = filtered.slice(start, start + limit);
      const nextCursor =
        start + limit < filtered.length
          ? (slice[slice.length - 1]?.rowKey ?? null)
          : null;
      const schema: Record<string, string> = {};
      for (const d of definitions) {
        schema[d.id] = d.rawType ?? d.type;
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
        schema,
        config: {},
        pagination: {
          limit,
          nextCursor,
          hasMore: nextCursor !== null,
          total: filtered.length
        }
      };
    },
    async createRow(_databaseId, row) {
      const created: MemRow = {
        rowKey: `n-${rows.length}`,
        sortOrder: rows.length,
        deletedAt: null,
        row: { ...row }
      };
      rows.push(created);
      return { rowKey: created.rowKey };
    },
    async updateRow(_databaseId, rowKey, row) {
      const hit = rows.find((r) => r.rowKey === rowKey);
      if (!hit) throw new Error("missing");
      hit.row = { ...row };
      return { ok: true };
    },
    async deleteRow() {
      return { ok: true };
    },
    async restoreRow() {
      return { ok: true };
    },
    async reorderRows() {
      return { ok: true };
    }
  };
  return provider;
}

const SEED: MemRow[] = [
  {
    rowKey: "a",
    sortOrder: 0,
    deletedAt: null,
    row: {
      title: "Alpha",
      status: "todo",
      score: 3,
      done: false,
      due: "2026-09-01",
      link: "",
      formulaPreview: "6"
    }
  },
  {
    rowKey: "b",
    sortOrder: 1,
    deletedAt: null,
    row: {
      title: "Beta",
      status: "doing",
      score: 8,
      done: false,
      due: "2026-09-10",
      link: "https://example.com",
      formulaPreview: "16"
    }
  },
  {
    rowKey: "c",
    sortOrder: 2,
    deletedAt: null,
    row: {
      title: "Gamma",
      status: "done",
      score: 5,
      done: true,
      due: "2026-09-05",
      link: "",
      formulaPreview: "10"
    }
  },
  {
    rowKey: "d",
    sortOrder: 3,
    deletedAt: null,
    row: {
      title: "Delta",
      status: "doing",
      score: 9,
      done: false,
      due: "2026-09-20",
      link: "",
      formulaPreview: "18"
    }
  }
];

async function readyStore(
  provider: DatabaseProvider,
  pageSize = 2
) {
  const store = createDatabaseRuntimeStore({ provider, defaultPageSize: pageSize });
  store.ensureView("tasks::main", "tasks");
  await vi.waitFor(() => {
    const s = store.getView("tasks::main");
    expect(s.status === "ready" || s.status === "empty").toBe(true);
    expect(s.metaStatus === "ready" || s.metaStatus === "unavailable").toBe(
      true
    );
  });
  return store;
}

describe("4F-3B — resolve metadata", () => {
  it("prefers typed definitions over legacy schema", () => {
    const resolved = resolveDatabasePropertyDefinitions({
      legacySchema: { status: "select", title: "text" },
      definitions: DEFINITIONS
    });
    expect(resolved.every((d) => d.source === "typed")).toBe(true);
    expect(resolved.find((d) => d.id === "status")?.name).toBe("Status");
  });

  it("falls back to legacy inference when definitions absent", () => {
    const resolved = resolveDatabasePropertyDefinitions({
      legacySchema: { title: "text", status: "select", due: "date" }
    });
    expect(resolved.every((d) => d.source === "legacy")).toBe(true);
    const status = resolved.find((d) => d.id === "status");
    expect(status?.type).toBe("select");
    expect(isEditableResolvedProperty(status!)).toBe(false);
  });

  it("property id remains identity after rename", () => {
    const before = resolveDatabasePropertyDefinitions({
      definitions: [{ id: "status", name: "Status", type: "status", options: [] }]
    });
    const after = resolveDatabasePropertyDefinitions({
      definitions: [
        { id: "status", name: "Workflow", type: "status", options: [] }
      ]
    });
    expect(before[0]?.id).toBe("status");
    expect(after[0]?.id).toBe("status");
    expect(after[0]?.name).toBe("Workflow");
  });

  it("select display uses option label while value stays stored", () => {
    expect(
      formatSelectDisplay("doing", [
        { value: "doing", label: "In progress" }
      ])
    ).toBe("In progress");
    expect(
      formatSelectDisplay("archived", [
        { value: "doing", label: "In progress" }
      ])
    ).toBe("archived");
  });
});

describe("4F-3B — filter / sort validation", () => {
  const defs = resolveDatabasePropertyDefinitions({ definitions: DEFINITIONS });
  const caps = { propertyFilters: true, propertySort: true };

  it("accepts valid typed filters", () => {
    const cases: DatabaseFilter[] = [
      {
        propertyId: "title",
        propertyType: "text",
        operator: "contains",
        value: "a"
      },
      {
        propertyId: "score",
        propertyType: "number",
        operator: "gte",
        value: 5
      },
      {
        propertyId: "done",
        propertyType: "boolean",
        operator: "is",
        value: true
      },
      {
        propertyId: "due",
        propertyType: "date",
        operator: "on",
        value: "2026-09-01"
      },
      {
        propertyId: "status",
        propertyType: "status",
        operator: "equals",
        value: "doing"
      }
    ];
    for (const filter of cases) {
      expect(validateDatabaseFilter(filter, defs, caps).ok).toBe(true);
    }
  });

  it("rejects unknown property / type mismatch / bad option / missing capability", () => {
    expect(
      validateDatabaseFilter(
        {
          propertyId: "nope",
          propertyType: "text",
          operator: "equals",
          value: "x"
        },
        defs,
        caps
      ).ok
    ).toBe(false);
    expect(
      validateDatabaseFilter(
        {
          propertyId: "score",
          propertyType: "text",
          operator: "equals",
          value: "x"
        },
        defs,
        caps
      ).ok
    ).toBe(false);
    expect(
      validateDatabaseFilter(
        {
          propertyId: "status",
          propertyType: "status",
          operator: "equals",
          value: "archived"
        },
        defs,
        caps
      ).ok
    ).toBe(false);
    expect(
      validateDatabaseFilters(
        [
          {
            propertyId: "score",
            propertyType: "number",
            operator: "gt",
            value: 1
          }
        ],
        defs,
        {}
      ).ok
    ).toBe(false);
  });

  it("validates property sort against metadata + capability", () => {
    expect(
      validatePropertySort(
        { propertyId: "score", direction: "desc" },
        defs,
        caps
      ).ok
    ).toBe(true);
    expect(
      validatePropertySort(
        { propertyId: "missing", direction: "asc" },
        defs,
        caps
      ).ok
    ).toBe(false);
    expect(
      validatePropertySort(
        { propertyId: "score", direction: "asc" },
        defs,
        { propertySort: false }
      ).ok
    ).toBe(false);
  });

  it("sanitizes filters when options disappear", () => {
    const active: DatabaseFilter[] = [
      {
        propertyId: "status",
        propertyType: "status",
        operator: "equals",
        value: "doing"
      }
    ];
    const nextDefs = resolveDatabasePropertyDefinitions({
      definitions: [
        {
          id: "status",
          name: "Status",
          type: "status",
          options: [{ value: "todo", label: "To do" }]
        }
      ]
    });
    const result = sanitizeFiltersAgainstMetadata(active, nextDefs, caps);
    expect(result.filters).toHaveLength(0);
    expect(result.removed).toHaveLength(1);
  });
});

describe("4F-3B R1 — typed create never falls back to legacy", () => {
  it("readOnly text is omitted when typed metadata exists and status is unselected", () => {
    const definitions: readonly DatabasePropertyDefinition[] = [
      {
        id: "systemTitle",
        name: "System title",
        type: "text",
        readOnly: true
      },
      {
        id: "status",
        name: "Status",
        type: "status",
        options: [
          { value: "todo", label: "To do" },
          { value: "doing", label: "Doing" }
        ]
      }
    ];
    const resolved = resolveDatabasePropertyDefinitions({
      legacySchema: { systemTitle: "text", status: "status" },
      definitions
    });
    const typed = buildTypedCreateRowPayload(resolved, {
      // status left unselected → typed payload may be {}
      status: ""
    });
    expect(typed).toEqual({});
    const row = resolveCreateRowPayload({
      hasTypedDefinitions: true,
      typedResult: typed,
      legacySchema: { systemTitle: "text", status: "status" },
      draft: { systemTitle: "", status: "" }
    });
    expect(row).toEqual({});
    expect(row).not.toHaveProperty("systemTitle");
    expect(row).not.toHaveProperty("status");
  });

  it("legacy fallback still applies when typed metadata is absent", () => {
    const row = resolveCreateRowPayload({
      hasTypedDefinitions: false,
      typedResult: {},
      legacySchema: { title: "text", status: "select" },
      draft: { title: "Hello", status: "ignored" }
    });
    expect(row).toEqual({ title: "Hello" });
    expect(row).not.toHaveProperty("status");
  });
});

describe("4F-3B R1 — opaque property ID sort encoding", () => {
  it("round-trips property IDs that contain ':'", () => {
    for (const propertyId of ["custom:score", "a:b:c", "score"]) {
      for (const direction of ["asc", "desc"] as const) {
        const encoded = encodePropertySortSelectValue(propertyId, direction);
        const parsed = parseSortSelectValue(encoded);
        expect(parsed).toEqual({
          kind: "property",
          propertyId,
          direction
        });
      }
    }
  });

  it("legacy position/title values still parse", () => {
    expect(parseSortSelectValue("position:asc")).toEqual({
      kind: "legacy",
      sortBy: "position",
      direction: "asc"
    });
    expect(parseSortSelectValue("title:desc")).toEqual({
      kind: "legacy",
      sortBy: "title",
      direction: "desc"
    });
  });

  it("setPropertySort receives exact opaque propertyId from encoded select value", async () => {
    const definitions: readonly DatabasePropertyDefinition[] = [
      { id: "title", name: "Title", type: "text" },
      { id: "custom:score", name: "Score", type: "number" },
      { id: "a:b:c", name: "Nested", type: "text" }
    ];
    const seed: MemRow[] = [
      {
        rowKey: "a",
        sortOrder: 0,
        deletedAt: null,
        row: { title: "A", "custom:score": 1, "a:b:c": "x" }
      },
      {
        rowKey: "b",
        sortOrder: 1,
        deletedAt: null,
        row: { title: "B", "custom:score": 9, "a:b:c": "y" }
      }
    ];
    const provider = createTypedMemoryProvider(seed, {
      pageSize: 10,
      definitions
    });
    const store = await readyStore(provider, 10);

    for (const propertyId of ["custom:score", "a:b:c"] as const) {
      for (const direction of ["asc", "desc"] as const) {
        const encoded = encodePropertySortSelectValue(propertyId, direction);
        const parsed = parseSortSelectValue(encoded);
        expect(parsed?.kind).toBe("property");
        if (parsed?.kind !== "property") return;
        store.setPropertySort("tasks::main", {
          propertyId: parsed.propertyId,
          direction: parsed.direction
        });
        await vi.waitFor(() => {
          expect(store.getView("tasks::main").status).not.toBe("loading");
        });
        expect(store.getView("tasks::main").queryState.propertySort).toEqual({
          propertyId,
          direction
        });
        expect(provider.lastListOptions?.propertySort).toEqual({
          propertyId,
          direction
        });
      }
    }
  });
});

describe("4F-3B — typed create payload", () => {
  it("includes typed creatable fields and omits unknown/readOnly", () => {
    const defs = resolveDatabasePropertyDefinitions({ definitions: DEFINITIONS });
    const payload = buildTypedCreateRowPayload(defs, {
      title: "New",
      status: "doing",
      score: "7",
      done: "true",
      due: "2026-09-18",
      link: "https://example.com",
      formulaPreview: "should-omit"
    });
    expect(payload).not.toHaveProperty("error");
    if ("error" in payload) return;
    expect(payload).toEqual({
      title: "New",
      status: "doing",
      score: 7,
      done: true,
      due: "2026-09-18",
      link: "https://example.com"
    });
    expect(payload).not.toHaveProperty("formulaPreview");
  });

  it("rejects invalid number / date / option drafts", () => {
    const defs = resolveDatabasePropertyDefinitions({ definitions: DEFINITIONS });
    expect(
      buildTypedCreateRowPayload(defs, { title: "x", score: "nope" })
    ).toEqual({ error: "Invalid number for Score" });
    expect(
      buildTypedCreateRowPayload(defs, { title: "x", due: "18-09-2026" })
    ).toEqual({ error: "Invalid date for Due date" });
    expect(
      buildTypedCreateRowPayload(defs, { title: "x", status: "archived" })
    ).toEqual({ error: "Invalid option for Status" });
  });
});

describe("4F-3B — RuntimeStore query state", () => {
  it("defaults filters=[] and propertySort=null; clones on set/snapshot", async () => {
    const provider = createTypedMemoryProvider(SEED);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    expect(snap.queryState.filters).toEqual([]);
    expect(snap.queryState.propertySort).toBeNull();

    const input: DatabaseFilter[] = [
      {
        propertyId: "status",
        propertyType: "status",
        operator: "equals",
        value: "doing"
      }
    ];
    store.setFilters("tasks::main", input);
    input[0] = {
      propertyId: "status",
      propertyType: "status",
      operator: "equals",
      value: "done"
    };
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").status).not.toBe("loading");
    });
    expect(store.getView("tasks::main").queryState.filters[0]).toMatchObject({
      value: "doing"
    });
    const snapFilters = store.getView("tasks::main").queryState.filters;
    expect(snapFilters).not.toBe(input);
    expect(Object.isFrozen(snapFilters)).toBe(true);
    const gen = store.getView("tasks::main").generation;
    // Re-applying the same filter is a no-op — proves internal state stayed intact.
    store.setFilters("tasks::main", [
      {
        propertyId: "status",
        propertyType: "status",
        operator: "equals",
        value: "doing"
      }
    ]);
    expect(store.getView("tasks::main").generation).toBe(gen);
    expect(store.getView("tasks::main").queryState.filters).toHaveLength(1);
  });

  it("query key differs by filter and by propertySort; equivalent still dedupes", async () => {
    const provider = createTypedMemoryProvider(SEED, { pageSize: 10 });
    const store = await readyStore(provider, 10);
    const base = store.getView("tasks::main").queryState;
    const keyA = buildDatabaseQueryKey("tasks", {
      ...base,
      filters: [
        {
          propertyId: "status",
          propertyType: "status",
          operator: "equals",
          value: "doing"
        }
      ]
    });
    const keyB = buildDatabaseQueryKey("tasks", {
      ...base,
      filters: [
        {
          propertyId: "status",
          propertyType: "status",
          operator: "equals",
          value: "done"
        }
      ]
    });
    const keyC = buildDatabaseQueryKey("tasks", {
      ...base,
      propertySort: { propertyId: "score", direction: "asc" }
    });
    const keyD = buildDatabaseQueryKey("tasks", {
      ...base,
      propertySort: { propertyId: "score", direction: "desc" }
    });
    expect(keyA).not.toBe(keyB);
    expect(keyC).not.toBe(keyD);

    const before = provider.listCalls;
    const p1 = store.refresh("tasks::main");
    const p2 = store.refresh("tasks::main");
    await Promise.all([p1, p2]);
    expect(provider.listCalls - before).toBe(1);
  });

  it("setFilters / setPropertySort trigger safe first-page reload", async () => {
    const provider = createTypedMemoryProvider(SEED, { pageSize: 2 });
    const store = await readyStore(provider, 2);
    expect(store.getView("tasks::main").pagination.hasMore).toBe(true);
    expect(store.getView("tasks::main").pagination.nextCursor).not.toBeNull();
    await store.loadMore("tasks::main");

    store.setFilters("tasks::main", [
      {
        propertyId: "status",
        propertyType: "status",
        operator: "equals",
        value: "doing"
      }
    ]);
    const mid = store.getView("tasks::main");
    expect(mid.status).toBe("loading");
    expect(mid.pagination.hasMore).toBe(false);
    expect(mid.pagination.nextCursor).toBeNull();
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").status).toBe("ready");
    });
    expect(store.getView("tasks::main").items.every((i) => i.row.status === "doing")).toBe(
      true
    );

    store.setPropertySort("tasks::main", {
      propertyId: "score",
      direction: "desc"
    });
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").status).toBe("ready");
    });
    const scores = store
      .getView("tasks::main")
      .items.map((i) => i.row.score as number);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe("4F-3B — provider forwarding + pagination continuity", () => {
  it("listRows receives query, filters, propertySort, trash, limit, cursor", async () => {
    const provider = createTypedMemoryProvider(SEED, { pageSize: 2 });
    const store = await readyStore(provider, 2);
    store.setQuery("tasks::main", "Beta");
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").status).not.toBe("loading");
    });
    store.setFilters("tasks::main", [
      {
        propertyId: "score",
        propertyType: "number",
        operator: "gte",
        value: 5
      }
    ]);
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").status).not.toBe("loading");
    });
    store.setPropertySort("tasks::main", {
      propertyId: "score",
      direction: "asc"
    });
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").status).not.toBe("loading");
    });
    const opts = provider.lastListOptions!;
    expect(opts.query).toBe("Beta");
    expect(opts.filters).toEqual([
      {
        propertyId: "score",
        propertyType: "number",
        operator: "gte",
        value: 5
      }
    ]);
    expect(opts.propertySort).toEqual({
      propertyId: "score",
      direction: "asc"
    });
    expect(opts.sortBy).toBeUndefined();
    expect(opts.direction).toBeUndefined();
    expect(opts.limit).toBe(2);
  });

  it("listOptionsFromState omits legacy sort when propertySort set", () => {
    const opts = listOptionsFromState({
      query: "",
      sortBy: "position",
      direction: "asc",
      trashMode: "active",
      pageSize: 10,
      filters: [],
      propertySort: { propertyId: "score", direction: "desc" }
    });
    expect(opts.propertySort).toEqual({
      propertyId: "score",
      direction: "desc"
    });
    expect(opts.sortBy).toBeUndefined();
    expect(opts.direction).toBeUndefined();
  });

  it("loadMore under filter keeps same filters + propertySort + cursor", async () => {
    const provider = createTypedMemoryProvider(SEED, { pageSize: 1 });
    const store = await readyStore(provider, 1);
    store.setFilters("tasks::main", [
      {
        propertyId: "status",
        propertyType: "status",
        operator: "equals",
        value: "doing"
      }
    ]);
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").status).toBe("ready");
    });
    store.setPropertySort("tasks::main", {
      propertyId: "score",
      direction: "asc"
    });
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").pagination.hasMore).toBe(true);
    });
    const cursor = store.getView("tasks::main").pagination.nextCursor;
    await store.loadMore("tasks::main");
    expect(provider.lastListOptions?.filters).toEqual([
      {
        propertyId: "status",
        propertyType: "status",
        operator: "equals",
        value: "doing"
      }
    ]);
    expect(provider.lastListOptions?.propertySort).toEqual({
      propertyId: "score",
      direction: "asc"
    });
    expect(provider.lastListOptions?.cursor).toBe(cursor);
  });
});

describe("4F-3B — stale races + write concurrency", () => {
  it("stale filter A cannot overwrite filter B", async () => {
    let releaseA!: () => void;
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    let call = 0;
    const provider = createTypedMemoryProvider(SEED, {
      pageSize: 10,
      onList: async () => {
        call += 1;
        if (call === 2) await gateA;
      }
    });
    const store = await readyStore(provider, 10);
    // call 1 was initial load
    store.setFilters("tasks::main", [
      {
        propertyId: "status",
        propertyType: "status",
        operator: "equals",
        value: "todo"
      }
    ]);
    store.setFilters("tasks::main", [
      {
        propertyId: "status",
        propertyType: "status",
        operator: "equals",
        value: "doing"
      }
    ]);
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").queryState.filters[0]).toMatchObject({
        value: "doing"
      });
    });
    releaseA();
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").status).toBe("ready");
    });
    expect(
      store.getView("tasks::main").items.every((i) => i.row.status === "doing")
    ).toBe(true);
  });

  it("stale propertySort A cannot overwrite B", async () => {
    let releaseA!: () => void;
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    let call = 0;
    const provider = createTypedMemoryProvider(SEED, {
      pageSize: 10,
      onList: async () => {
        call += 1;
        if (call === 2) await gateA;
      }
    });
    const store = await readyStore(provider, 10);
    store.setPropertySort("tasks::main", {
      propertyId: "score",
      direction: "asc"
    });
    store.setPropertySort("tasks::main", {
      propertyId: "score",
      direction: "desc"
    });
    releaseA();
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").status).toBe("ready");
    });
    expect(store.getView("tasks::main").queryState.propertySort).toEqual({
      propertyId: "score",
      direction: "desc"
    });
    const scores = store
      .getView("tasks::main")
      .items.map((i) => Number(i.row.score));
    expect(scores[0]).toBeGreaterThanOrEqual(scores[scores.length - 1]!);
  });

  it("filter change during create preserves write mutating", async () => {
    let releaseCreate!: () => void;
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    const provider = createTypedMemoryProvider(SEED, { pageSize: 10 });
    const originalCreate = provider.createRow!.bind(provider);
    provider.createRow = async (databaseId, row, opts) => {
      await createGate;
      return originalCreate(databaseId, row, opts);
    };
    const store = await readyStore(provider, 10);
    const createPromise = store.createRow("tasks::main", { title: "New" });
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").mutating?.kind).toBe("creating");
    });
    store.setFilters("tasks::main", [
      {
        propertyId: "score",
        propertyType: "number",
        operator: "gte",
        value: 1
      }
    ]);
    expect(store.getView("tasks::main").mutating?.kind).toBe("creating");
    expect(store.getView("tasks::main").status).toBe("loading");
    let blocked: unknown;
    try {
      await store.createRow("tasks::main", { title: "Other" });
    } catch (err) {
      blocked = err;
    }
    expect(blocked).toBeInstanceOf(Error);
    expect(String(blocked)).toMatch(/mutation is in progress|View is loading/);
    releaseCreate();
    await createPromise;
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").mutating).toBeNull();
    });
    expect(provider.lastListOptions?.filters?.[0]).toMatchObject({
      operator: "gte",
      value: 1
    });
  });

  it("propertySort change during loadMore ignores stale page", async () => {
    let releaseMore!: () => void;
    const moreGate = new Promise<void>((resolve) => {
      releaseMore = resolve;
    });
    let listN = 0;
    const provider = createTypedMemoryProvider(SEED, {
      pageSize: 1,
      onList: async (opts) => {
        listN += 1;
        if (opts?.cursor) await moreGate;
      }
    });
    const store = await readyStore(provider, 1);
    const loadMorePromise = store.loadMore("tasks::main");
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").mutating?.kind).toBe("loadingMore");
    });
    store.setPropertySort("tasks::main", {
      propertyId: "score",
      direction: "desc"
    });
    expect(store.getView("tasks::main").pagination.nextCursor).toBeNull();
    releaseMore();
    await loadMorePromise;
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").status).toBe("ready");
    });
    expect(store.getView("tasks::main").mutating).toBeNull();
    expect(store.getView("tasks::main").queryState.propertySort).toEqual({
      propertyId: "score",
      direction: "desc"
    });
    void listN;
  });
});

describe("4F-3B — reorder safety with filters / propertySort", () => {
  it("disables reorder when filters or propertySort active", async () => {
    const provider = createTypedMemoryProvider(SEED, { pageSize: 10 });
    const store = await readyStore(provider, 10);
    expect(store.getView("tasks::main").canReorder).toBe(true);

    store.setFilters("tasks::main", [
      {
        propertyId: "status",
        propertyType: "status",
        operator: "equals",
        value: "doing"
      }
    ]);
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").canReorder).toBe(false);
    });
    expect(store.getView("tasks::main").reorderDisabledReason).toMatch(
      /filter/i
    );

    store.setFilters("tasks::main", []);
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").canReorder).toBe(true);
    });

    store.setPropertySort("tasks::main", {
      propertyId: "score",
      direction: "asc"
    });
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").canReorder).toBe(false);
    });
    expect(store.getView("tasks::main").reorderDisabledReason).toMatch(
      /property sort/i
    );
  });
});

describe("4F-3B — capabilities fail-closed", () => {
  it("list-only host without queryCapabilities rejects advanced filters/sort", async () => {
    const provider = createTypedMemoryProvider(SEED, {
      pageSize: 10,
      capabilities: {}
    });
    const store = await readyStore(provider, 10);
    expect(
      hostSupportsPropertyFilters(store.getView("tasks::main").meta?.queryCapabilities)
    ).toBe(false);
    expect(
      hostSupportsPropertySort(store.getView("tasks::main").meta?.queryCapabilities)
    ).toBe(false);
    expect(() =>
      store.setFilters("tasks::main", [
        {
          propertyId: "score",
          propertyType: "number",
          operator: "gt",
          value: 1
        }
      ])
    ).toThrow(/propertyFilters/);
    expect(() =>
      store.setPropertySort("tasks::main", {
        propertyId: "score",
        direction: "asc"
      })
    ).toThrow(/propertySort/);
    // Legacy search/sort still works
    store.setQuery("tasks::main", "Alpha");
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").status).not.toBe("loading");
    });
    store.setSort("tasks::main", "title", "asc");
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").queryState.sortBy).toBe("title");
    });
  });
});

describe("4F-3B — EditorDocument invariant", () => {
  it("typed edits/filters/sort leave document without rows or query state", async () => {
    const provider = createTypedMemoryProvider(SEED, { pageSize: 10 });
    const store = await readyStore(provider, 10);
    store.setFilters("tasks::main", [
      {
        propertyId: "status",
        propertyType: "status",
        operator: "equals",
        value: "doing"
      }
    ]);
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").status).toBe("ready");
    });
    store.setPropertySort("tasks::main", {
      propertyId: "score",
      direction: "desc"
    });
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").status).toBe("ready");
    });
    await store.updateRow("tasks::main", "b", {
      ...SEED[1]!.row,
      status: "done"
    });

    const doc = createEditorDocument([
      {
        id: "db1",
        type: "databaseView",
        props: {
          databaseId: "tasks",
          viewId: "main",
          viewType: "table",
          titleHint: "Tasks"
        }
      }
    ]);
    const serialized = serializeEditorDocument(doc);
    expect(serialized).not.toContain("filters");
    expect(serialized).not.toContain("propertySort");
    expect(serialized).not.toContain("formulaPreview");
    expect(serialized).not.toContain('"items"');
    expect(serialized).toContain('"databaseId":"tasks"');
    expect(serialized).toContain('"viewType":"table"');
  });
});

describe("4F-3B — metadata refresh label", () => {
  it("option label refresh keeps stored value", async () => {
    const provider = createTypedMemoryProvider(SEED, { pageSize: 10 });
    const store = await readyStore(provider, 10);
    const before = store.getView("tasks::main").items.find((i) => i.rowKey === "b");
    expect(before?.row.status).toBe("doing");
    provider.setDefinitions([
      ...DEFINITIONS.filter((d) => d.id !== "status"),
      {
        id: "status",
        name: "Workflow",
        type: "status",
        options: [
          { value: "todo", label: "Backlog" },
          { value: "doing", label: "Active" },
          { value: "done", label: "Done" }
        ]
      }
    ]);
    await store.refresh("tasks::main");
    await vi.waitFor(() => {
      expect(store.getView("tasks::main").meta?.propertyDefinitions?.find((d) => d.id === "status")?.name).toBe(
        "Workflow"
      );
    });
    const after = store.getView("tasks::main").items.find((i) => i.rowKey === "b");
    expect(after?.row.status).toBe("doing");
    const opt = store
      .getView("tasks::main")
      .meta?.propertyDefinitions?.find((d) => d.id === "status")
      ?.options?.find((o) => o.value === "doing");
    expect(opt?.label).toBe("Active");
  });
});
