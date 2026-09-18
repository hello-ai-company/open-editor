/**
 * @vitest-environment jsdom
 *
 * Phase 4F-4A — Board + Calendar models, mutations, renderer dispatch, date keys.
 */
import { describe, expect, it, vi } from "vitest";
import {
  act,
  createElement,
  useEffect,
  useState,
  type ReactElement
} from "react";
import { createRoot } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import type {
  DatabaseListOptions,
  DatabasePropertyDefinition,
  DatabaseProvider,
  DatabaseRowItem,
  DatabaseRowsPage,
  JsonValue
} from "@hello-ai-company/editor-core";
import {
  createEditorDocument,
  serializeEditorDocument
} from "@hello-ai-company/editor-core";
import {
  boardGroupKeyOf,
  boardGroupKeysEqual,
  buildBoardColumns,
  buildBoardGroupUpdateRow,
  canMutateBoardGroup,
  defaultBoardGroupingProperty,
  encodeBoardGroupKey,
  listBoardGroupingProperties,
  resolveBoardGroupingProperty,
  type BoardGroupColumn,
  type BoardGroupKey
} from "../src/workspace/databaseBoardModel.js";
import {
  addCalendarDays,
  addCalendarMonths,
  buildCalendarDateUpdateRow,
  buildCalendarLayout,
  canMutateCalendarDate,
  defaultCalendarDateProperty,
  formatCanonicalDateKey,
  listCalendarDateProperties,
  parseCanonicalDateKey,
  resolveCalendarDateProperty,
  shiftCalendarCursor,
  todayCanonicalDateKey
} from "../src/workspace/databaseCalendarModel.js";
import { resolveDatabaseRowTitle } from "../src/workspace/databaseRowPresentation.js";
import {
  resolveDatabaseViewRenderer,
  type DatabaseRowOpenRequest,
  type DatabaseViewRenderer,
  type DatabaseViewRendererContext,
  type DatabaseViewRendererMap
} from "../src/workspace/databaseViewRenderers.js";
import { createDatabaseRuntimeStore } from "../src/workspace/databaseRuntimeStore.js";
import {
  metadataAllowsRowMutations,
  resolveDatabasePropertyDefinitions,
  type ResolvedPropertyDefinition
} from "../src/workspace/databaseProperty.js";
import {
  BoardRenderer,
  renderBoardView
} from "../src/workspace/databaseBoardRenderer.js";
import {
  CalendarRenderer,
  renderCalendarView
} from "../src/workspace/databaseCalendarRenderer.js";
import type { DatabaseViewRuntime } from "../src/workspace/databaseViewRuntime.js";

// —— helpers ——

function valueKey(value: string): BoardGroupKey {
  return { kind: "value", value };
}

function columnValues(columns: readonly BoardGroupColumn[]): string[] {
  return columns
    .filter(
      (c): c is BoardGroupColumn & { key: { kind: "value"; value: string } } =>
        c.key.kind === "value"
    )
    .map((c) => c.key.value);
}

function findValueColumn(
  columns: readonly BoardGroupColumn[],
  value: string
): BoardGroupColumn | undefined {
  return columns.find(
    (c) => c.key.kind === "value" && c.key.value === value
  );
}

function typed(
  partial: Omit<ResolvedPropertyDefinition, "source" | "readOnly" | "options"> &
    Partial<
      Pick<ResolvedPropertyDefinition, "source" | "readOnly" | "options" | "rawType">
    >
): ResolvedPropertyDefinition {
  return {
    readOnly: false,
    options: [],
    source: "typed",
    ...partial
  };
}

function row(
  rowKey: string,
  data: Record<string, JsonValue>,
  sortOrder = 0
): DatabaseRowItem {
  return { rowKey, sortOrder, deletedAt: null, row: data };
}

const STATUS = typed({
  id: "status",
  name: "Status",
  type: "status",
  options: [
    { value: "todo", label: "Backlog" },
    { value: "doing", label: "Doing" },
    { value: "done", label: "Done" }
  ]
});

const PRIORITY = typed({
  id: "priority",
  name: "Priority",
  type: "select",
  options: [
    { value: "p1", label: "High" },
    { value: "p2", label: "Low" }
  ]
});

const TITLE = typed({ id: "title", name: "Title", type: "text" });
const DUE = typed({ id: "due", name: "Due", type: "date" });
const START = typed({ id: "start", name: "Start", type: "date" });

const DEFAULT_RENDERERS: DatabaseViewRendererMap = {
  board: renderBoardView,
  calendar: renderCalendarView
};

type MemRow = {
  rowKey: string;
  sortOrder: number;
  deletedAt: string | null;
  row: Record<string, JsonValue>;
};

function createBoardCalendarProvider(
  seed: MemRow[],
  options?: {
    pageSize?: number;
    definitions?: readonly DatabasePropertyDefinition[];
    failUpdate?: boolean;
    onList?: (opts?: DatabaseListOptions) => void;
    onReorder?: () => void;
  }
): DatabaseProvider & {
  rows: MemRow[];
  listCalls: number;
  reorderCalls: number;
  setDefinitions: (defs: readonly DatabasePropertyDefinition[]) => void;
  setFailUpdate: (v: boolean) => void;
} {
  const rows = seed.map((r) => ({ ...r, row: { ...r.row } }));
  let listCalls = 0;
  let reorderCalls = 0;
  let failUpdate = options?.failUpdate ?? false;
  let definitions = [
    ...(options?.definitions ?? [
      { id: "title", name: "Title", type: "text" as const },
      {
        id: "status",
        name: "Status",
        type: "status" as const,
        options: [
          { value: "todo", label: "Backlog" },
          { value: "doing", label: "Doing" },
          { value: "done", label: "Done" }
        ]
      },
      { id: "due", name: "Due", type: "date" as const }
    ])
  ];
  const pageSize = options?.pageSize ?? 20;

  return {
    rows,
    get listCalls() {
      return listCalls;
    },
    get reorderCalls() {
      return reorderCalls;
    },
    setDefinitions(defs) {
      definitions = [...defs];
    },
    setFailUpdate(v) {
      failUpdate = v;
    },
    async getDatabase(databaseId) {
      return {
        id: databaseId,
        title: "Tasks",
        propertyDefinitions: definitions,
        queryCapabilities: { propertyFilters: true, propertySort: true }
      };
    },
    async listRows(databaseId, opts?: DatabaseListOptions): Promise<DatabaseRowsPage> {
      listCalls += 1;
      options?.onList?.(opts);
      const filtered = rows.filter((r) =>
        opts?.trashedOnly ? r.deletedAt != null : r.deletedAt == null
      );
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
    async createRow(_databaseId, data) {
      const created: MemRow = {
        rowKey: `n-${rows.length}`,
        sortOrder: rows.length,
        deletedAt: null,
        row: { ...data }
      };
      rows.push(created);
      return { rowKey: created.rowKey };
    },
    async updateRow(_databaseId, rowKey, data) {
      if (failUpdate) throw new Error("provider rejected update");
      const hit = rows.find((r) => r.rowKey === rowKey);
      if (!hit) throw new Error("missing");
      hit.row = { ...data };
      return { ok: true };
    },
    async deleteRow() {
      return { ok: true };
    },
    async restoreRow() {
      return { ok: true };
    },
    async reorderRows() {
      reorderCalls += 1;
      options?.onReorder?.();
      return { ok: true };
    }
  };
}

async function readyStore(
  provider: DatabaseProvider,
  pageSize = 20,
  viewKey = "tasks::main",
  databaseId = "tasks"
) {
  const store = createDatabaseRuntimeStore({ provider, defaultPageSize: pageSize });
  store.ensureView(viewKey, databaseId);
  await vi.waitFor(() => {
    const s = store.getView(viewKey);
    expect(s.status === "ready" || s.status === "empty").toBe(true);
    expect(s.metaStatus === "ready" || s.metaStatus === "unavailable").toBe(
      true
    );
  });
  return store;
}

function buildContext(
  partial: Partial<DatabaseViewRendererContext> &
    Pick<
      DatabaseViewRendererContext,
      "snapshot" | "store" | "definitions" | "runtime"
    >
): DatabaseViewRendererContext {
  return {
    viewKey: "tasks::main",
    viewId: "main",
    viewType: "board",
    title: "Tasks",
    mutationsAllowed: true,
    busy: false,
    ...partial
  };
}

// —— Renderer dispatch ——

describe("4F-4A — resolveDatabaseViewRenderer", () => {
  it("returns null for table from defaults (shell-owned)", () => {
    expect(
      resolveDatabaseViewRenderer({
        viewType: "table",
        runtime: {},
        defaults: DEFAULT_RENDERERS
      })
    ).toBeNull();
  });

  it("dispatches board → board and calendar → calendar", () => {
    expect(
      resolveDatabaseViewRenderer({
        viewType: "board",
        runtime: {},
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(renderBoardView);
    expect(
      resolveDatabaseViewRenderer({
        viewType: "calendar",
        runtime: {},
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(renderCalendarView);
  });

  it("returns null for deferred timeline from defaults", () => {
    expect(
      resolveDatabaseViewRenderer({
        viewType: "timeline",
        runtime: {},
        defaults: DEFAULT_RENDERERS
      })
    ).toBeNull();
  });

  it("uses custom board override from runtime", () => {
    const custom: DatabaseViewRenderer = () =>
      createElement("div", { "data-custom-board": "" });
    const resolved = resolveDatabaseViewRenderer({
      viewType: "board",
      runtime: { renderers: { board: custom } },
      defaults: DEFAULT_RENDERERS
    });
    expect(resolved).toBe(custom);
  });

  it("isolates renderer overrides across runtime instances", () => {
    const customA: DatabaseViewRenderer = () =>
      createElement("div", { "data-runtime-a": "" });
    const runtimeA: DatabaseViewRuntime = { renderers: { board: customA } };
    const runtimeB: DatabaseViewRuntime = {};

    expect(
      resolveDatabaseViewRenderer({
        viewType: "board",
        runtime: runtimeA,
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(customA);
    expect(
      resolveDatabaseViewRenderer({
        viewType: "board",
        runtime: runtimeB,
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(renderBoardView);
  });
});

// —— Board model ——

describe("4F-4A — board model", () => {
  it("1. status options become columns", () => {
    const columns = buildBoardColumns({
      items: [row("a", { status: "todo" }), row("b", { status: "doing" })],
      groupProperty: STATUS
    });
    expect(columnValues(columns)).toEqual(["todo", "doing", "done"]);
    expect(columns[0]!.key).toEqual(valueKey("todo"));
    expect(columns[0]!.keyId).toBe(encodeBoardGroupKey(valueKey("todo")));
    expect(columns[0]!.items.map((i) => i.rowKey)).toEqual(["a"]);
    expect(columns[1]!.items.map((i) => i.rowKey)).toEqual(["b"]);
    expect(columns.every((c) => c.isConfiguredOption)).toBe(true);
  });

  it("2. select property can be grouping", () => {
    expect(listBoardGroupingProperties([TITLE, PRIORITY, DUE])).toEqual([
      PRIORITY
    ]);
    const columns = buildBoardColumns({
      items: [row("a", { priority: "p1" })],
      groupProperty: PRIORITY
    });
    expect(columnValues(columns)).toEqual(["p1", "p2"]);
  });

  it("3. default status preferred over select", () => {
    expect(defaultBoardGroupingProperty([PRIORITY, STATUS, TITLE])).toBe(
      STATUS
    );
    expect(defaultBoardGroupingProperty([PRIORITY, TITLE])).toBe(PRIORITY);
  });

  it("4. observed unknown value preserved as own column", () => {
    const columns = buildBoardColumns({
      items: [row("x", { status: "archived" })],
      groupProperty: STATUS
    });
    const archived = findValueColumn(columns, "archived");
    expect(archived).toMatchObject({
      key: valueKey("archived"),
      label: "archived",
      isConfiguredOption: false,
      isUnassigned: false
    });
    expect(archived!.items.map((i) => i.rowKey)).toEqual(["x"]);
  });

  it("5. empty → Unassigned bucket (kind unassigned)", () => {
    const columns = buildBoardColumns({
      items: [
        row("e1", { status: "" }),
        row("e2", { title: "no status" }),
        row("e3", { status: null })
      ],
      groupProperty: STATUS
    });
    const unassigned = columns.at(-1)!;
    expect(unassigned.key.kind).toBe("unassigned");
    expect(unassigned.keyId).toBe(
      encodeBoardGroupKey({ kind: "unassigned" })
    );
    expect(unassigned.label).toBe("Unassigned");
    expect(unassigned.isUnassigned).toBe(true);
    expect(unassigned.isConfiguredOption).toBe(false);
    expect(unassigned.items.map((i) => i.rowKey)).toEqual(["e1", "e2", "e3"]);
    expect(boardGroupKeyOf({ status: "" }, "status")).toEqual({
      kind: "unassigned"
    });
  });

  it("6. duplicate options deduped by raw value", () => {
    const dup = typed({
      id: "status",
      name: "Status",
      type: "status",
      options: [
        { value: "todo", label: "First" },
        { value: "todo", label: "Second" },
        { value: "done", label: "Done" }
      ]
    });
    const columns = buildBoardColumns({
      items: [row("a", { status: "todo" })],
      groupProperty: dup
    });
    expect(columns.filter((c) => c.key.kind === "value" && c.key.value === "todo")).toHaveLength(1);
    expect(findValueColumn(columns, "todo")!.label).toBe("First");
  });

  it("7. label/value identity separated", () => {
    const columns = buildBoardColumns({
      items: [row("a", { status: "todo" })],
      groupProperty: STATUS
    });
    expect(columns[0]).toMatchObject({
      key: valueKey("todo"),
      label: "Backlog"
    });
  });

  it("8. opaque option values safe", () => {
    const opaque = 'todo"><img src=x onerror=1>';
    const prop = typed({
      id: "status",
      name: "Status",
      type: "status",
      options: [{ value: opaque, label: "Weird" }]
    });
    const columns = buildBoardColumns({
      items: [row("a", { status: opaque })],
      groupProperty: prop
    });
    expect(columns[0]!.key).toEqual(valueKey(opaque));
    expect(columns[0]!.label).toBe("Weird");
    expect(columns[0]!.items[0]!.row.status).toBe(opaque);
  });

  it("9. opaque property IDs safe", () => {
    const id = 'status"><script>';
    const prop = typed({
      id,
      name: "Status",
      type: "status",
      options: [{ value: "open", label: "Open" }]
    });
    const columns = buildBoardColumns({
      items: [row("a", { [id]: "open" })],
      groupProperty: prop
    });
    expect(columns[0]!.items[0]!.row[id]).toBe("open");
    expect(resolveBoardGroupingProperty([prop], id)?.id).toBe(id);
  });

  it("10. resolveDatabaseRowTitle fallback (title text, first text, rowKey)", () => {
    expect(
      resolveDatabaseRowTitle(row("r1", { title: "Named" }), [TITLE, STATUS])
    ).toBe("Named");
    // No `title` property → first text property wins.
    expect(
      resolveDatabaseRowTitle(row("r2", { name: "Alt" }), [
        typed({ id: "name", name: "Name", type: "text" })
      ])
    ).toBe("Alt");
    expect(
      resolveDatabaseRowTitle(row("fallback-key", { status: "todo" }), [
        STATUS
      ])
    ).toBe("fallback-key");
  });

  it("11. metadata rename preserves grouping identity (id not name)", () => {
    const renamed = typed({
      ...STATUS,
      name: "Workflow"
    });
    expect(resolveBoardGroupingProperty([renamed], "status")?.id).toBe(
      "status"
    );
    expect(resolveBoardGroupingProperty([renamed], "status")?.name).toBe(
      "Workflow"
    );
    const columns = buildBoardColumns({
      items: [row("a", { status: "todo" })],
      groupProperty: renamed
    });
    expect(columns[0]!.key).toEqual(valueKey("todo"));
  });

  it("12. metadata removal safely falls back", () => {
    expect(resolveBoardGroupingProperty([TITLE, DUE], "status")).toBeNull();
    expect(
      resolveBoardGroupingProperty([PRIORITY, TITLE], "missing-id")
    ).toBe(PRIORITY);
    const columns = buildBoardColumns({
      items: [row("a", { title: "Only" })],
      groupProperty: null
    });
    expect(columns).toHaveLength(1);
    expect(columns[0]!.key.kind).toBe("all");
    expect(columns[0]!.keyId).toBe(encodeBoardGroupKey({ kind: "all" }));
    expect(columns[0]!.label).toBe("All items");
    expect(columns[0]!.items).toHaveLength(1);
  });

  it("13. buildBoardColumns with hasMore context doesn't invent totals", () => {
    const items = [
      row("a", { status: "todo" }),
      row("b", { status: "todo" }),
      row("c", { status: "doing" })
    ];
    const columns = buildBoardColumns({ items, groupProperty: STATUS });
    const todo = findValueColumn(columns, "todo")!;
    const doing = findValueColumn(columns, "doing")!;
    // Counts reflect loaded items only — not provider pagination.total.
    expect(todo.items).toHaveLength(2);
    expect(doing.items).toHaveLength(1);
    expect(columns.reduce((n, c) => n + c.items.length, 0)).toBe(items.length);
  });

  it("14. Board never calls reorderRows — group update via updateRow only", async () => {
    const onReorder = vi.fn();
    const provider = createBoardCalendarProvider(
      [
        {
          rowKey: "a",
          sortOrder: 0,
          deletedAt: null,
          row: { title: "Alpha", status: "todo", due: "2026-09-01" }
        }
      ],
      { onReorder }
    );
    const reorderSpy = vi.spyOn(provider, "reorderRows");
    const store = await readyStore(provider);
    const item = store.getView("tasks::main").items[0]!;
    const next = buildBoardGroupUpdateRow(item, "status", valueKey("doing"));
    expect(next).toEqual({ title: "Alpha", status: "doing", due: "2026-09-01" });
    await store.updateRow("tasks::main", item.rowKey, next!, item.sortOrder);
    await vi.waitFor(() => {
      expect(
        store.getView("tasks::main").items.find((i) => i.rowKey === "a")?.row
          .status
      ).toBe("doing");
    });
    expect(reorderSpy).not.toHaveBeenCalled();
    expect(provider.reorderCalls).toBe(0);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("15. R1 opaque collision: host values never collide with Unassigned/All", () => {
    const collisionProp = typed({
      id: "status",
      name: "Status",
      type: "status",
      options: [
        { value: "__oe_unassigned__", label: "Special" },
        { value: "__all__", label: "All" },
        { value: "a:b:c", label: "Colon" }
      ]
    });
    const columns = buildBoardColumns({
      items: [
        row("special", { status: "__oe_unassigned__" }),
        row("empty", { status: "" }),
        row("colon", { status: "a:b:c" })
      ],
      groupProperty: collisionProp
    });

    const special = findValueColumn(columns, "__oe_unassigned__")!;
    const allOpt = findValueColumn(columns, "__all__")!;
    const colon = findValueColumn(columns, "a:b:c")!;
    const unassigned = columns.find((c) => c.key.kind === "unassigned")!;

    expect(special.key.kind).toBe("value");
    expect(special.label).toBe("Special");
    expect(special.isConfiguredOption).toBe(true);
    expect(special.isUnassigned).toBe(false);
    expect(special.items.map((i) => i.rowKey)).toEqual(["special"]);

    expect(unassigned.key.kind).toBe("unassigned");
    expect(unassigned.label).toBe("Unassigned");
    expect(unassigned.items.map((i) => i.rowKey)).toEqual(["empty"]);
    expect(unassigned.keyId).not.toBe(special.keyId);
    expect(unassigned.keyId).toBe(
      encodeBoardGroupKey({ kind: "unassigned" })
    );
    expect(special.keyId).toBe(
      encodeBoardGroupKey(valueKey("__oe_unassigned__"))
    );

    expect(allOpt.label).toBe("All");
    expect(allOpt.keyId).not.toBe(encodeBoardGroupKey({ kind: "all" }));
    expect(colon.items.map((i) => i.rowKey)).toEqual(["colon"]);

    expect(
      boardGroupKeysEqual(special.key, { kind: "unassigned" })
    ).toBe(false);
    expect(
      boardGroupKeyOf({ status: "__oe_unassigned__" }, "status")
    ).toEqual(valueKey("__oe_unassigned__"));

    expect(
      canMutateBoardGroup({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "active",
        groupProperty: collisionProp,
        targetKey: valueKey("__oe_unassigned__")
      })
    ).toBe(true);
    expect(
      canMutateBoardGroup({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "active",
        groupProperty: collisionProp,
        targetKey: { kind: "unassigned" }
      })
    ).toBe(false);
    expect(
      canMutateBoardGroup({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "active",
        groupProperty: collisionProp,
        targetKey: { kind: "all" }
      })
    ).toBe(false);

    expect(
      buildBoardGroupUpdateRow(
        row("a", { status: "todo" }),
        "status",
        valueKey("__all__")
      )
    ).toEqual({ status: "__all__" });
  });
});

// —— Board mutation ——

describe("4F-4A — board mutation", () => {
  it("canMutateBoardGroup: typed editable + update → true for configured option", () => {
    expect(
      canMutateBoardGroup({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "active",
        groupProperty: STATUS,
        targetKey: valueKey("doing")
      })
    ).toBe(true);
  });

  it("readOnly status → false", () => {
    expect(
      canMutateBoardGroup({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "active",
        groupProperty: { ...STATUS, readOnly: true },
        targetKey: valueKey("doing")
      })
    ).toBe(false);
  });

  it("legacy source → false", () => {
    expect(
      canMutateBoardGroup({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "active",
        groupProperty: { ...STATUS, source: "legacy" },
        targetKey: valueKey("doing")
      })
    ).toBe(false);
  });

  it("trash mode → false", () => {
    expect(
      canMutateBoardGroup({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "trash",
        groupProperty: STATUS,
        targetKey: valueKey("doing")
      })
    ).toBe(false);
  });

  it("unknown observed column (not in options) → false", () => {
    expect(
      canMutateBoardGroup({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "active",
        groupProperty: STATUS,
        targetKey: valueKey("archived")
      })
    ).toBe(false);
  });

  it("Unassigned / All targets → false", () => {
    expect(
      canMutateBoardGroup({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "active",
        groupProperty: STATUS,
        targetKey: { kind: "unassigned" }
      })
    ).toBe(false);
    expect(
      canMutateBoardGroup({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "active",
        groupProperty: STATUS,
        targetKey: { kind: "all" }
      })
    ).toBe(false);
    expect(
      buildBoardGroupUpdateRow(row("a", { status: "todo" }), "status", {
        kind: "unassigned"
      })
    ).toBeNull();
    expect(
      buildBoardGroupUpdateRow(row("a", { status: "todo" }), "status", {
        kind: "all"
      })
    ).toBeNull();
  });

  it("provider reject → after updateRow fails, row status remains original", async () => {
    const provider = createBoardCalendarProvider([
      {
        rowKey: "a",
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Alpha", status: "todo", due: "2026-09-01" }
      }
    ]);
    const store = await readyStore(provider);
    provider.setFailUpdate(true);
    const item = store.getView("tasks::main").items[0]!;
    const next = buildBoardGroupUpdateRow(item, "status", valueKey("done"))!;
    await expect(
      store.updateRow("tasks::main", item.rowKey, next, item.sortOrder)
    ).rejects.toThrow(/provider rejected/);
    expect(
      store.getView("tasks::main").items.find((i) => i.rowKey === "a")?.row
        .status
    ).toBe("todo");
    expect(provider.rows.find((r) => r.rowKey === "a")?.row.status).toBe(
      "todo"
    );
  });
});

// —— Calendar model ——

describe("4F-4A — calendar model", () => {
  it("1. first date property default", () => {
    expect(defaultCalendarDateProperty([TITLE, DUE, START])).toBe(DUE);
    expect(listCalendarDateProperties([TITLE, DUE, START])).toEqual([
      DUE,
      START
    ]);
  });

  it("2. multiple date-property selection via resolveCalendarDateProperty", () => {
    expect(resolveCalendarDateProperty([DUE, START], "start")).toBe(START);
    expect(resolveCalendarDateProperty([DUE, START], null)).toBe(DUE);
  });

  it("3. opaque date property ID", () => {
    const id = 'due"><b>';
    const prop = typed({ id, name: "Due", type: "date" });
    expect(resolveCalendarDateProperty([prop], id)?.id).toBe(id);
    const layout = buildCalendarLayout({
      items: [row("a", { [id]: "2026-09-18", title: "X" })],
      dateProperty: prop,
      scale: "week",
      cursorDateKey: "2026-09-18",
      todayKey: "2026-09-18"
    });
    const day = layout.days.find((d) => d.dateKey === "2026-09-18");
    expect(day?.items.map((i) => i.rowKey)).toEqual(["a"]);
  });

  it("4. valid YYYY-MM-DD grouping via buildCalendarLayout", () => {
    // Week of 2026-09-18 (Fri) is Sun 2026-09-13 … Sat 2026-09-19.
    const layout = buildCalendarLayout({
      items: [
        row("a", { due: "2026-09-18", title: "A" }),
        row("b", { due: "2026-09-18", title: "B" }),
        row("c", { due: "2026-09-19", title: "C" })
      ],
      dateProperty: DUE,
      scale: "week",
      cursorDateKey: "2026-09-18",
      todayKey: "2026-09-18"
    });
    expect(
      layout.days.find((d) => d.dateKey === "2026-09-18")?.items.map(
        (i) => i.rowKey
      )
    ).toEqual(["a", "b"]);
    expect(
      layout.days.find((d) => d.dateKey === "2026-09-19")?.items.map(
        (i) => i.rowKey
      )
    ).toEqual(["c"]);
    expect(layout.undatedItems).toHaveLength(0);
  });

  it("5. missing date → undatedItems", () => {
    const layout = buildCalendarLayout({
      items: [row("a", { title: "No due" }), row("b", { due: null })],
      dateProperty: DUE,
      scale: "month",
      cursorDateKey: "2026-09-01",
      todayKey: "2026-09-18"
    });
    expect(layout.undatedItems.map((i) => i.rowKey)).toEqual(["a", "b"]);
  });

  it('6. invalid date "09/18/2026" → undatedItems', () => {
    const layout = buildCalendarLayout({
      items: [row("a", { due: "09/18/2026" })],
      dateProperty: DUE,
      scale: "month",
      cursorDateKey: "2026-09-01",
      todayKey: "2026-09-18"
    });
    expect(layout.undatedItems.map((i) => i.rowKey)).toEqual(["a"]);
  });

  it("7. month layout 42 days", () => {
    const layout = buildCalendarLayout({
      items: [],
      dateProperty: DUE,
      scale: "month",
      cursorDateKey: "2026-09-15",
      todayKey: "2026-09-18"
    });
    expect(layout.days).toHaveLength(42);
    expect(layout.focusLabel).toBe("2026-09");
    expect(layout.weekdayLabels).toHaveLength(7);
  });

  it("8. week layout 7 days", () => {
    const layout = buildCalendarLayout({
      items: [],
      dateProperty: DUE,
      scale: "week",
      cursorDateKey: "2026-09-18",
      todayKey: "2026-09-18"
    });
    expect(layout.days).toHaveLength(7);
    expect(layout.startDateKey).toBe("2026-09-13"); // Sunday
    expect(layout.focusLabel).toBe("Week of 2026-09-13");
  });

  it("9. shiftCalendarCursor month/week changes presentation keys only", () => {
    expect(shiftCalendarCursor("2026-09-18", "month", 1)).toBe("2026-10-18");
    expect(shiftCalendarCursor("2026-09-18", "month", -1)).toBe("2026-08-18");
    expect(shiftCalendarCursor("2026-09-18", "week", 1)).toBe("2026-09-25");
    expect(shiftCalendarCursor("2026-09-18", "week", -1)).toBe("2026-09-11");
  });

  it("10. todayCanonicalDateKey format", () => {
    const key = todayCanonicalDateKey(new Date(2026, 8, 18, 15, 30, 0));
    expect(key).toBe("2026-09-18");
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("11. navigation does not call listRows — pure shiftCalendarCursor", () => {
    const onList = vi.fn();
    const provider = createBoardCalendarProvider(
      [
        {
          rowKey: "a",
          sortOrder: 0,
          deletedAt: null,
          row: { title: "A", status: "todo", due: "2026-09-18" }
        }
      ],
      { onList }
    );
    // Pure function: cursor shift never touches the provider.
    const before = provider.listCalls;
    const next = shiftCalendarCursor("2026-09-18", "month", 1);
    expect(next).toBe("2026-10-18");
    expect(provider.listCalls).toBe(before);
    expect(onList).not.toHaveBeenCalled();
  });

  it("12. metadata removal falls back", () => {
    expect(resolveCalendarDateProperty([TITLE, STATUS], "due")).toBeNull();
    expect(resolveCalendarDateProperty([START, DUE], "gone")).toBe(START);
    const layout = buildCalendarLayout({
      items: [row("a", { due: "2026-09-18" })],
      dateProperty: null,
      scale: "month",
      cursorDateKey: "2026-09-01",
      todayKey: "2026-09-18"
    });
    expect(layout.undatedItems.map((i) => i.rowKey)).toEqual(["a"]);
  });

  it("13. partial pagination is presentation-only (layout uses passed items)", () => {
    const loadedOnly = [
      row("a", { due: "2026-09-10", title: "Loaded" }),
      row("b", { title: "Undated loaded" })
    ];
    const layout = buildCalendarLayout({
      items: loadedOnly,
      dateProperty: DUE,
      scale: "month",
      cursorDateKey: "2026-09-01",
      todayKey: "2026-09-18"
    });
    const placed = layout.days.reduce((n, d) => n + d.items.length, 0);
    expect(placed + layout.undatedItems.length).toBe(loadedOnly.length);
    expect(layout.undatedItems.map((i) => i.rowKey)).toEqual(["b"]);
    // No invented rows for unloaded pages.
    expect(
      layout.days.flatMap((d) => d.items).every((i) => i.rowKey === "a" || i.rowKey === "b")
    ).toBe(true);
  });
});

// —— Calendar mutation ——

describe("4F-4A — calendar mutation", () => {
  it("canMutateCalendarDate typed editable", () => {
    expect(
      canMutateCalendarDate({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "active",
        dateProperty: DUE,
        targetDateKey: "2026-09-20"
      })
    ).toBe(true);
  });

  it("legacy / readOnly / trash → false", () => {
    expect(
      canMutateCalendarDate({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "active",
        dateProperty: { ...DUE, source: "legacy" },
        targetDateKey: "2026-09-20"
      })
    ).toBe(false);
    expect(
      canMutateCalendarDate({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "active",
        dateProperty: { ...DUE, readOnly: true },
        targetDateKey: "2026-09-20"
      })
    ).toBe(false);
    expect(
      canMutateCalendarDate({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "trash",
        dateProperty: DUE,
        targetDateKey: "2026-09-20"
      })
    ).toBe(false);
  });

  it("invalid target → false", () => {
    expect(
      canMutateCalendarDate({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "active",
        dateProperty: DUE,
        targetDateKey: "09/18/2026"
      })
    ).toBe(false);
    expect(
      canMutateCalendarDate({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "active",
        dateProperty: DUE,
        targetDateKey: "2026-13-40"
      })
    ).toBe(false);
  });

  it("buildCalendarDateUpdateRow", () => {
    const item = row("a", { title: "A", due: "2026-09-01", status: "todo" });
    expect(buildCalendarDateUpdateRow(item, "due", "2026-09-20")).toEqual({
      title: "A",
      due: "2026-09-20",
      status: "todo"
    });
    expect(buildCalendarDateUpdateRow(item, "due", "09/18/2026")).toBeNull();
  });

  it("provider failure retains original date via store.updateRow", async () => {
    const provider = createBoardCalendarProvider([
      {
        rowKey: "a",
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Alpha", status: "todo", due: "2026-09-01" }
      }
    ]);
    const store = await readyStore(provider);
    provider.setFailUpdate(true);
    const item = store.getView("tasks::main").items[0]!;
    const next = buildCalendarDateUpdateRow(item, "due", "2026-09-20")!;
    await expect(
      store.updateRow("tasks::main", item.rowKey, next, item.sortOrder)
    ).rejects.toThrow(/provider rejected/);
    expect(
      store.getView("tasks::main").items.find((i) => i.rowKey === "a")?.row.due
    ).toBe("2026-09-01");
    expect(provider.rows.find((r) => r.rowKey === "a")?.row.due).toBe(
      "2026-09-01"
    );
  });
});

// —— Date boundaries ——

describe("4F-4A — date boundaries", () => {
  it("parseCanonicalDateKey: calendar edge dates", () => {
    for (const key of [
      "2026-01-01",
      "2026-02-28",
      "2026-12-31",
      "2028-02-29"
    ]) {
      const parsed = parseCanonicalDateKey(key);
      expect(parsed?.dateKey).toBe(key);
    }
    expect(parseCanonicalDateKey("2026-02-29")).toBeNull();
    expect(parseCanonicalDateKey("09/18/2026")).toBeNull();
    expect(parseCanonicalDateKey("")).toBeNull();
  });

  it("addCalendarDays / addCalendarMonths don't shift via timezone", () => {
    expect(addCalendarDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addCalendarMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addCalendarMonths("2026-03-15", -1)).toBe("2026-02-15");
  });

  it("formatCanonicalDateKey round-trip", () => {
    for (const key of [
      "2026-01-01",
      "2026-02-28",
      "2026-09-18",
      "2026-12-31",
      "2028-02-29"
    ]) {
      const p = parseCanonicalDateKey(key)!;
      expect(formatCanonicalDateKey(p.year, p.month, p.day)).toBe(key);
    }
  });
});

// —— Row open / EditorDocument ——

describe("4F-4A — row open / EditorDocument", () => {
  it("board+calendar blocks serialize only identity props", () => {
    const doc = createEditorDocument([
      {
        id: "db-board",
        type: "databaseView",
        props: {
          databaseId: "tasks",
          viewId: "board-main",
          viewType: "board",
          titleHint: "Board"
        }
      },
      {
        id: "db-cal",
        type: "databaseView",
        props: {
          databaseId: "tasks",
          viewId: "cal-main",
          viewType: "calendar",
          titleHint: "Calendar"
        }
      }
    ]);
    const serialized = serializeEditorDocument(doc);
    expect(serialized).toContain('"databaseId":"tasks"');
    expect(serialized).toContain('"viewId":"board-main"');
    expect(serialized).toContain('"viewType":"board"');
    expect(serialized).toContain('"titleHint":"Board"');
    expect(serialized).toContain('"viewType":"calendar"');
    expect(serialized).toContain('"titleHint":"Calendar"');
    expect(serialized).not.toContain('"items"');
    expect(serialized).not.toContain("filters");
    expect(serialized).not.toContain("groupProperty");
    expect(serialized).not.toContain("cursorDateKey");
    expect(serialized).not.toContain(
      encodeBoardGroupKey({ kind: "unassigned" })
    );
  });

  it("pure open request shape", () => {
    const request: DatabaseRowOpenRequest = {
      databaseId: "tasks",
      rowKey: "row-42",
      viewId: "board-main",
      viewType: "board"
    };
    expect(request).toEqual({
      databaseId: "tasks",
      rowKey: "row-42",
      viewId: "board-main",
      viewType: "board"
    });
    const cal: DatabaseRowOpenRequest = {
      ...request,
      viewId: "cal-main",
      viewType: "calendar"
    };
    expect(cal.viewType).toBe("calendar");
  });
});

// —— React smoke ——

describe("4F-4A — React smoke BoardRenderer / CalendarRenderer", () => {
  async function mount(
    Component: DatabaseViewRenderer,
    ctx: DatabaseViewRendererContext
  ) {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(createElement(Component, ctx));
    });
    return {
      host,
      root,
      async rerender(next: DatabaseViewRenderer, nextCtx: DatabaseViewRendererContext) {
        await act(async () => {
          root.render(createElement(next, nextCtx));
        });
      },
      async cleanup() {
        await act(async () => {
          root.unmount();
        });
        host.remove();
      }
    };
  }

  it("board shows columns / Unassigned via data-column-kind", async () => {
    const provider = createBoardCalendarProvider([
      {
        rowKey: "a",
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Alpha", status: "todo", due: "2026-09-01" }
      },
      {
        rowKey: "u",
        sortOrder: 1,
        deletedAt: null,
        row: { title: "Unset", status: "", due: "" }
      }
    ]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { host, cleanup } = await mount(
      BoardRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "board",
        mutationsAllowed: true
      })
    );
    expect(host.querySelector("[data-oe-board]")).toBeTruthy();
    const todoKeyId = encodeBoardGroupKey(valueKey("todo"));
    const todoColumn = Array.from(
      host.querySelectorAll("[data-column-kind='value']")
    ).find((el) => el.getAttribute("data-column-key") === todoKeyId);
    expect(todoColumn).toBeTruthy();
    expect(host.querySelector('[data-column-kind="unassigned"]')).toBeTruthy();
    expect(
      host
        .querySelector('[data-column-kind="unassigned"]')
        ?.getAttribute("data-column-key")
    ).toBe(encodeBoardGroupKey({ kind: "unassigned" }));
    expect(host.querySelector("[data-column-value]")).toBeNull();
    expect(host.textContent).toContain("Unassigned");
    expect(host.textContent).toContain("Alpha");
    await cleanup();
  });

  it("calendar shows No date section", async () => {
    const provider = createBoardCalendarProvider([
      {
        rowKey: "a",
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Dated", status: "todo", due: "2026-09-18" }
      },
      {
        rowKey: "u",
        sortOrder: 1,
        deletedAt: null,
        row: { title: "NoDue", status: "todo", due: "" }
      }
    ]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { host, cleanup } = await mount(
      CalendarRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "calendar",
        mutationsAllowed: true
      })
    );
    expect(host.querySelector("[data-oe-calendar]")).toBeTruthy();
    const undated = host.querySelector(".oe-database-calendar__undated");
    expect(undated).toBeTruthy();
    expect(undated!.getAttribute("aria-label")).toBe("No date");
    expect(undated!.textContent).toContain("NoDue");
    await cleanup();
  });

  it("metadata pending: mutationsAllowed false disables mutation controls", async () => {
    const provider = createBoardCalendarProvider([
      {
        rowKey: "a",
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Alpha", status: "todo", due: "2026-09-01" }
      }
    ]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    expect(
      metadataAllowsRowMutations({
        getDatabase: snap.capabilities.getDatabase,
        metaStatus: "loading"
      })
    ).toBe(false);
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const ctx = buildContext({
      snapshot: snap,
      store,
      definitions,
      runtime: { store, database: provider },
      viewType: "board",
      mutationsAllowed: false
    });
    const board = await mount(BoardRenderer, ctx);
    // Group-by property select remains; per-card status selects are gated.
    const cardSelects = board.host.querySelectorAll(
      ".oe-database-board__card select"
    );
    expect(cardSelects.length).toBe(0);
    expect(
      board.host.querySelector(".oe-database-board__status-label")
    ).toBeTruthy();
    await board.cleanup();

    const cal = await mount(
      CalendarRenderer,
      buildContext({
        ...ctx,
        viewType: "calendar",
        mutationsAllowed: false
      })
    );
    expect(
      cal.host.querySelectorAll(".oe-database-calendar__item input[type=date]")
        .length
    ).toBe(0);
    await cal.cleanup();
  });

  it("R1 custom renderer hooks: mount, rerender, switch, isolate runtimes", async () => {
    function makeHookedBoard(tag: string): DatabaseViewRenderer {
      return function HookedBoard(
        ctx: DatabaseViewRendererContext
      ): ReactElement {
        const [ticks, setTicks] = useState(0);
        useEffect(() => {
          setTicks((n) => n + 1);
        }, [ctx.title]);
        return createElement("div", {
          [`data-custom-${tag}`]: "",
          "data-ticks": String(ticks),
          "data-title": ctx.title
        });
      };
    }

    const customA = makeHookedBoard("a");
    const customB = makeHookedBoard("b");
    const provider = createBoardCalendarProvider([
      {
        rowKey: "a",
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Alpha", status: "todo", due: "2026-09-01" }
      }
    ]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });

    const baseCtx = buildContext({
      snapshot: snap,
      store,
      definitions,
      runtime: { store, database: provider, renderers: { board: customA } },
      viewType: "board",
      mutationsAllowed: true,
      title: "Runtime A"
    });

    const mounted = await mount(customA, baseCtx);
    expect(mounted.host.querySelector("[data-custom-a]")).toBeTruthy();
    await vi.waitFor(() => {
      expect(
        mounted.host.querySelector("[data-custom-a]")?.getAttribute("data-ticks")
      ).toBe("1");
    });

    await mounted.rerender(customA, { ...baseCtx, title: "Runtime A v2" });
    await vi.waitFor(() => {
      expect(
        mounted.host.querySelector("[data-custom-a]")?.getAttribute("data-ticks")
      ).toBe("2");
    });
    expect(mounted.host.querySelector("[data-custom-a]")?.getAttribute("data-title")).toBe(
      "Runtime A v2"
    );

    // Switch to calendar without hook-order crash.
    await mounted.rerender(
      CalendarRenderer,
      buildContext({
        ...baseCtx,
        viewType: "calendar",
        title: "Cal",
        runtime: { store, database: provider }
      })
    );
    expect(mounted.host.querySelector("[data-oe-calendar]")).toBeTruthy();
    expect(mounted.host.querySelector("[data-custom-a]")).toBeNull();

    // Switch back to default board.
    await mounted.rerender(
      BoardRenderer,
      buildContext({
        ...baseCtx,
        viewType: "board",
        runtime: { store, database: provider }
      })
    );
    expect(mounted.host.querySelector("[data-oe-board]")).toBeTruthy();
    await mounted.cleanup();

    // Two runtimes: A's custom state does not leak to B.
    const hostA = document.createElement("div");
    const hostB = document.createElement("div");
    document.body.appendChild(hostA);
    document.body.appendChild(hostB);
    const rootA = createRoot(hostA);
    const rootB = createRoot(hostB);
    await act(async () => {
      rootA.render(
        createElement(customA, {
          ...baseCtx,
          title: "A",
          runtime: { store, database: provider, renderers: { board: customA } }
        })
      );
      rootB.render(
        createElement(customB, {
          ...baseCtx,
          title: "B",
          runtime: { store, database: provider, renderers: { board: customB } }
        })
      );
    });
    expect(hostA.querySelector("[data-custom-a]")).toBeTruthy();
    expect(hostB.querySelector("[data-custom-b]")).toBeTruthy();
    expect(hostA.querySelector("[data-custom-b]")).toBeNull();
    expect(hostB.querySelector("[data-custom-a]")).toBeNull();
    await vi.waitFor(() => {
      expect(hostA.querySelector("[data-custom-a]")?.getAttribute("data-ticks")).toBe(
        "1"
      );
      expect(hostB.querySelector("[data-custom-b]")?.getAttribute("data-ticks")).toBe(
        "1"
      );
    });
    await act(async () => {
      rootA.render(
        createElement(customA, {
          ...baseCtx,
          title: "A2",
          runtime: { store, database: provider, renderers: { board: customA } }
        })
      );
    });
    await vi.waitFor(() => {
      expect(hostA.querySelector("[data-custom-a]")?.getAttribute("data-ticks")).toBe(
        "2"
      );
    });
    // B unchanged — no leaked state from A.
    expect(hostB.querySelector("[data-custom-b]")?.getAttribute("data-ticks")).toBe(
      "1"
    );
    expect(hostB.querySelector("[data-custom-b]")?.getAttribute("data-title")).toBe(
      "B"
    );
    await act(async () => {
      rootA.unmount();
      rootB.unmount();
    });
    hostA.remove();
    hostB.remove();
  });

  it("board open row button fires onOpenRow with viewType board", async () => {
    const onOpenRow = vi.fn();
    const provider = createBoardCalendarProvider([
      {
        rowKey: "a",
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Alpha", status: "todo", due: "2026-09-01" }
      }
    ]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { host, cleanup } = await mount(
      BoardRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewId: "board-main",
        runtime: { store, database: provider, onOpenRow },
        viewType: "board",
        mutationsAllowed: true
      })
    );
    const openBtn = host.querySelector(
      ".oe-database-board__card-title"
    ) as HTMLButtonElement | null;
    expect(openBtn).toBeTruthy();
    await act(async () => {
      openBtn!.click();
    });
    expect(onOpenRow).toHaveBeenCalledTimes(1);
    expect(onOpenRow).toHaveBeenCalledWith({
      databaseId: "tasks",
      rowKey: "a",
      viewId: "board-main",
      viewType: "board"
    });
    await cleanup();
  });

  it("calendar Previous click does not call listRows", async () => {
    const onList = vi.fn();
    const provider = createBoardCalendarProvider(
      [
        {
          rowKey: "a",
          sortOrder: 0,
          deletedAt: null,
          row: { title: "Dated", status: "todo", due: "2026-09-18" }
        }
      ],
      { onList }
    );
    const store = await readyStore(provider);
    const listCallsAfterReady = provider.listCalls;
    onList.mockClear();
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { host, cleanup } = await mount(
      CalendarRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "calendar",
        mutationsAllowed: true
      })
    );
    const prev = host.querySelector(
      'button[aria-label="Previous"]'
    ) as HTMLButtonElement | null;
    expect(prev).toBeTruthy();
    await act(async () => {
      prev!.click();
    });
    expect(onList).not.toHaveBeenCalled();
    expect(provider.listCalls).toBe(listCallsAfterReady);
    await cleanup();
  });
});
