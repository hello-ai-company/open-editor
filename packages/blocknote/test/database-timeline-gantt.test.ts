/**
 * @vitest-environment jsdom
 *
 * Phase 4F-4C — Timeline + Gantt models, renderers, date-axis integration.
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
  buildCalendarDateUpdateRow,
  canMutateCalendarDate,
  defaultCalendarDateProperty,
  resolveCalendarDateProperty
} from "../src/workspace/databaseCalendarModel.js";
import {
  dateKeyToOffsetDays,
  daysBetweenCanonicalDates,
  shiftInclusiveRange
} from "../src/workspace/databaseDateAxisModel.js";
import {
  buildGanttLayout,
  resolveGanttEndpoints
} from "../src/workspace/databaseGanttModel.js";
import {
  GanttRenderer,
  renderGanttView
} from "../src/workspace/databaseGanttRenderer.js";
import {
  buildTimelineLayout,
  dateKeyFromAxisPercent
} from "../src/workspace/databaseTimelineModel.js";
import {
  TimelineRenderer,
  renderTimelineView
} from "../src/workspace/databaseTimelineRenderer.js";
import {
  isDeferredDatabaseViewType,
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

// —— helpers ——

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

const TITLE = typed({ id: "title", name: "Title", type: "text" });
const DUE = typed({ id: "due", name: "Due", type: "date" });
const START = typed({ id: "start", name: "Start", type: "date" });
const END = typed({ id: "end", name: "End", type: "date" });
const SCHEDULE_DUE = typed({
  id: "schedule:due",
  name: "Schedule Due",
  type: "date"
});
const SCHEDULE_START = typed({
  id: "schedule:start",
  name: "Schedule Start",
  type: "date"
});
const SCHEDULE_END = typed({
  id: "schedule:end",
  name: "Schedule End",
  type: "date" });
const MILESTONE = typed({ id: "milestone", name: "Milestone", type: "date" });

const DEFAULT_RENDERERS: DatabaseViewRendererMap = {
  timeline: renderTimelineView,
  gantt: renderGanttView
};

type MemRow = {
  rowKey: string;
  sortOrder: number;
  deletedAt: string | null;
  row: Record<string, JsonValue>;
};

function createTimelineGanttProvider(
  seed: MemRow[],
  options?: {
    pageSize?: number;
    definitions?: readonly DatabasePropertyDefinition[];
    failUpdate?: boolean;
    onList?: (opts?: DatabaseListOptions) => void;
    onGetDatabase?: () => void;
    onReorder?: () => void;
    onUpdate?: () => void;
  }
): DatabaseProvider & {
  rows: MemRow[];
  listCalls: number;
  getDatabaseCalls: number;
  reorderCalls: number;
  updateCalls: number;
  setDefinitions: (defs: readonly DatabasePropertyDefinition[]) => void;
  setFailUpdate: (v: boolean) => void;
} {
  const rows = seed.map((r) => ({ ...r, row: { ...r.row } }));
  let listCalls = 0;
  let getDatabaseCalls = 0;
  let reorderCalls = 0;
  let updateCalls = 0;
  let failUpdate = options?.failUpdate ?? false;
  let definitions = [
    ...(options?.definitions ?? [
      { id: "title", name: "Title", type: "text" as const },
      { id: "due", name: "Due", type: "date" as const },
      { id: "start", name: "Start", type: "date" as const },
      { id: "end", name: "End", type: "date" as const }
    ])
  ];
  const pageSize = options?.pageSize ?? 20;

  return {
    rows,
    get listCalls() {
      return listCalls;
    },
    get getDatabaseCalls() {
      return getDatabaseCalls;
    },
    get reorderCalls() {
      return reorderCalls;
    },
    get updateCalls() {
      return updateCalls;
    },
    setDefinitions(defs) {
      definitions = [...defs];
    },
    setFailUpdate(v) {
      failUpdate = v;
    },
    async getDatabase(databaseId) {
      getDatabaseCalls += 1;
      options?.onGetDatabase?.();
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
      updateCalls += 1;
      options?.onUpdate?.();
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
    viewType: "timeline",
    title: "Tasks",
    mutationsAllowed: true,
    busy: false,
    ...partial
  };
}

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
    async rerender(
      next: DatabaseViewRenderer,
      nextCtx: DatabaseViewRendererContext
    ) {
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

class MockDataTransfer {
  private readonly store = new Map<string, string>();
  effectAllowed = "none";
  dropEffect = "none";
  setData(type: string, value: string): void {
    this.store.set(type, value);
  }
  getData(type: string): string {
    return this.store.get(type) ?? "";
  }
}

function dispatchDragDrop(
  source: Element,
  target: Element,
  clientX: number
): void {
  const dt = new MockDataTransfer();
  const dragStart = new Event("dragstart", { bubbles: true, cancelable: true });
  Object.defineProperty(dragStart, "dataTransfer", { value: dt });
  source.dispatchEvent(dragStart);

  const dragOver = new Event("dragover", { bubbles: true, cancelable: true });
  Object.defineProperty(dragOver, "dataTransfer", { value: dt });
  target.dispatchEvent(dragOver);

  const drop = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(drop, "dataTransfer", { value: dt });
  Object.defineProperty(drop, "clientX", { value: clientX });
  target.dispatchEvent(drop);
}

async function setDateInputValue(
  input: HTMLInputElement,
  value: string
): Promise<void> {
  await act(async () => {
    const native = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!;
    native.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const TIMELINE_SEED: MemRow[] = [
  {
    rowKey: "a",
    sortOrder: 0,
    deletedAt: null,
    row: { title: "Alpha", due: "2026-09-10", start: "2026-09-10", end: "2026-09-14" }
  },
  {
    rowKey: "b",
    sortOrder: 1,
    deletedAt: null,
    row: { title: "Bravo", due: "2026-09-14", start: "2026-09-14", end: "2026-09-18" }
  },
  {
    rowKey: "u",
    sortOrder: 2,
    deletedAt: null,
    row: { title: "Undated", due: "", start: "", end: "" }
  },
  {
    rowKey: "bad",
    sortOrder: 3,
    deletedAt: null,
    row: { title: "Bad Date", due: "09/18/2026", start: "soon", end: "2026-09-20" }
  }
];

// —— Dispatch ——

describe("4F-4C — resolveDatabaseViewRenderer dispatch", () => {
  it("dispatches timeline → TimelineRenderer and gantt → GanttRenderer", () => {
    expect(
      resolveDatabaseViewRenderer({
        viewType: "timeline",
        runtime: {},
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(renderTimelineView);
    expect(
      resolveDatabaseViewRenderer({
        viewType: "gantt",
        runtime: {},
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(renderGanttView);
  });

  it("map/dashboard no longer deferred after 4F-4E; timeline/gantt/feed NOT deferred", () => {
    for (const ready of ["map", "dashboard"] as const) {
      expect(isDeferredDatabaseViewType(ready)).toBe(false);
    }
    expect(isDeferredDatabaseViewType("feed")).toBe(false);
    expect(isDeferredDatabaseViewType("chart")).toBe(false);
    expect(isDeferredDatabaseViewType("timeline")).toBe(false);
    expect(isDeferredDatabaseViewType("gantt")).toBe(false);
    expect(
      resolveDatabaseViewRenderer({
        viewType: "timeline",
        runtime: {},
        defaults: DEFAULT_RENDERERS
      })
    ).not.toBeNull();
    expect(
      resolveDatabaseViewRenderer({
        viewType: "gantt",
        runtime: {},
        defaults: DEFAULT_RENDERERS
      })
    ).not.toBeNull();
  });

  it("custom timeline/gantt renderers with useState mount/rerender/switch safely", async () => {
    function makeHooked(tag: string): DatabaseViewRenderer {
      return function Hooked(ctx: DatabaseViewRendererContext): ReactElement {
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

    const customTimeline = makeHooked("timeline");
    const customGantt = makeHooked("gantt");
    const provider = createTimelineGanttProvider([TIMELINE_SEED[0]!]);
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
      runtime: {
        store,
        database: provider,
        renderers: { timeline: customTimeline, gantt: customGantt }
      },
      viewType: "timeline",
      title: "Timeline A"
    });

    const mounted = await mount(customTimeline, baseCtx);
    expect(mounted.host.querySelector("[data-custom-timeline]")).toBeTruthy();
    await vi.waitFor(() => {
      expect(
        mounted.host
          .querySelector("[data-custom-timeline]")
          ?.getAttribute("data-ticks")
      ).toBe("1");
    });

    await mounted.rerender(customTimeline, { ...baseCtx, title: "Timeline A v2" });
    await vi.waitFor(() => {
      expect(
        mounted.host
          .querySelector("[data-custom-timeline]")
          ?.getAttribute("data-ticks")
      ).toBe("2");
    });

    await mounted.rerender(
      customGantt,
      buildContext({
        ...baseCtx,
        viewType: "gantt",
        title: "Gantt B",
        runtime: {
          store,
          database: provider,
          renderers: { gantt: customGantt }
        }
      })
    );
    expect(mounted.host.querySelector("[data-custom-gantt]")).toBeTruthy();
    expect(mounted.host.querySelector("[data-custom-timeline]")).toBeNull();

    await mounted.rerender(
      TimelineRenderer,
      buildContext({
        ...baseCtx,
        viewType: "timeline",
        runtime: { store, database: provider }
      })
    );
    expect(mounted.host.querySelector("[data-oe-timeline]")).toBeTruthy();

    await mounted.rerender(
      GanttRenderer,
      buildContext({
        ...baseCtx,
        viewType: "gantt",
        runtime: { store, database: provider }
      })
    );
    expect(mounted.host.querySelector("[data-oe-gantt]")).toBeTruthy();
    await mounted.cleanup();
  });
});

// —— Timeline model ——

describe("4F-4C — timeline model", () => {
  it("1. first date property default", () => {
    expect(defaultCalendarDateProperty([TITLE, DUE, START])).toBe(DUE);
    const layout = buildTimelineLayout({
      items: [row("a", { due: "2026-09-10" })],
      dateProperty: defaultCalendarDateProperty([TITLE, DUE, START])
    });
    expect(layout.placedRows).toHaveLength(1);
    expect(layout.placedRows[0]!.dateKey).toBe("2026-09-10");
  });

  it('2. property selection by opaque id "schedule:due"', () => {
    const prop = resolveCalendarDateProperty(
      [TITLE, SCHEDULE_DUE, DUE],
      "schedule:due"
    );
    expect(prop?.id).toBe("schedule:due");
    const layout = buildTimelineLayout({
      items: [row("a", { "schedule:due": "2026-09-12", due: "2026-09-01" })],
      dateProperty: prop
    });
    expect(layout.placedRows[0]!.dateKey).toBe("2026-09-12");
  });

  it("3. valid placement on axis", () => {
    const layout = buildTimelineLayout({
      items: [row("a", { due: "2026-09-10" }), row("b", { due: "2026-09-14" })],
      dateProperty: DUE,
      todayKey: "2026-09-01"
    });
    expect(layout.placedRows).toHaveLength(2);
    expect(layout.placedRows[0]!.percent).toBeGreaterThanOrEqual(0);
    expect(layout.placedRows[0]!.percent).toBeLessThanOrEqual(100);
    expect(layout.placedRows[1]!.percent).toBeGreaterThan(
      layout.placedRows[0]!.percent
    );
    expect(layout.axis.startDateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(layout.axis.endDateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("4. missing → No date tray", () => {
    const layout = buildTimelineLayout({
      items: [row("u", { due: "" }), row("n", { title: "No field" })],
      dateProperty: DUE
    });
    expect(layout.missingItems.map((i) => i.rowKey)).toEqual(["u", "n"]);
    expect(layout.placedRows).toHaveLength(0);
  });

  it("5. invalid → Invalid tray (never today)", () => {
    const layout = buildTimelineLayout({
      items: [
        row("bad", { due: "09/18/2026" }),
        row("worse", { due: "2026-13-40" })
      ],
      dateProperty: DUE,
      todayKey: "2026-09-18"
    });
    expect(layout.invalidItems.map((i) => i.rowKey)).toEqual(["bad", "worse"]);
    expect(layout.placedRows).toHaveLength(0);
    expect(layout.missingItems).toHaveLength(0);
    // Invalid rows must not appear on axis at today's position.
    for (const placed of layout.placedRows) {
      expect(placed.dateKey).not.toBe("2026-09-18");
    }
  });

  it("6. no date property → explanation (all missing)", () => {
    const layout = buildTimelineLayout({
      items: [row("a", { due: "2026-09-10" })],
      dateProperty: null
    });
    expect(layout.placedRows).toHaveLength(0);
    expect(layout.missingItems.map((i) => i.rowKey)).toEqual(["a"]);
  });

  it("7. metadata rename preserves selection by id", () => {
    const renamed = typed({ ...DUE, name: "Renamed Due" });
    expect(resolveCalendarDateProperty([TITLE, renamed], "due")?.id).toBe("due");
    expect(resolveCalendarDateProperty([TITLE, renamed], "due")?.name).toBe(
      "Renamed Due"
    );
  });

  it("8. metadata removal fallback", () => {
    expect(resolveCalendarDateProperty([TITLE, START, END], "due")).toBe(START);
    expect(resolveCalendarDateProperty([TITLE, STATUS], "due")).toBeNull();
  });

  it("9. provider order preserved", () => {
    const items = [
      row("z", { due: "2026-09-20" }, 0),
      row("a", { due: "2026-09-10" }, 1),
      row("m", { due: "2026-09-14" }, 2)
    ];
    const layout = buildTimelineLayout({ items, dateProperty: DUE });
    expect(layout.placedRows.map((p) => p.item.rowKey)).toEqual(["z", "a", "m"]);
  });

  it("10. partial hasMore notice is presentation-only", () => {
    const loaded = [
      row("a", { due: "2026-09-10" }),
      row("u", { due: "" })
    ];
    const layout = buildTimelineLayout({ items: loaded, dateProperty: DUE });
    expect(layout.placedRows).toHaveLength(1);
    expect(layout.missingItems.map((i) => i.rowKey)).toEqual(["u"]);
    expect(
      layout.placedRows.length + layout.missingItems.length + layout.invalidItems.length
    ).toBe(loaded.length);
  });
});

const STATUS = typed({
  id: "status",
  name: "Status",
  type: "status",
  options: [{ value: "todo", label: "Backlog" }]
});

// —— Timeline renderer ——

describe("4F-4C — TimelineRenderer", () => {
  it("renders placed rows, No date, Invalid date trays", async () => {
    const provider = createTimelineGanttProvider(TIMELINE_SEED);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { host, cleanup } = await mount(
      TimelineRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "timeline"
      })
    );
    expect(host.querySelector("[data-oe-timeline]")).toBeTruthy();
    expect(host.querySelector('[aria-label="No date"]')).toBeTruthy();
    expect(host.textContent).toContain("Undated");
    expect(host.querySelector('[aria-label="Invalid date"]')).toBeTruthy();
    expect(host.textContent).toContain("Bad Date");
    const placed = host.querySelectorAll(
      ".oe-database-timeline__rows .oe-database-timeline__row"
    );
    expect(placed.length).toBe(2);
    await cleanup();
  });

  it("11. onOpenRow exact { databaseId, rowKey, viewId, viewType: timeline } via click", async () => {
    const onOpenRow = vi.fn();
    const provider = createTimelineGanttProvider([TIMELINE_SEED[0]!]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const reorderSpy = vi.spyOn(provider, "reorderRows");
    const updateSpy = vi.spyOn(provider, "updateRow");
    const { host, cleanup } = await mount(
      TimelineRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewId: "main-timeline",
        runtime: { store, database: provider, onOpenRow },
        viewType: "timeline"
      })
    );
    const openBtn = host.querySelector(
      ".oe-database-timeline__label"
    ) as HTMLButtonElement | null;
    expect(openBtn).toBeTruthy();
    await act(async () => {
      openBtn!.click();
    });
    expect(onOpenRow).toHaveBeenCalledWith({
      databaseId: "tasks",
      rowKey: "a",
      viewId: "main-timeline",
      viewType: "timeline"
    } satisfies DatabaseRowOpenRequest);
    expect(reorderSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    await cleanup();
  });

  it("12. typed editable date → updateRow with complete row", async () => {
    const provider = createTimelineGanttProvider([
      {
        rowKey: "a",
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Alpha", status: "todo", due: "2026-09-10" }
      }
    ], {
      definitions: [
        { id: "title", name: "Title", type: "text" },
        {
          id: "status",
          name: "Status",
          type: "status",
          options: [{ value: "todo", label: "Backlog" }]
        },
        { id: "due", name: "Due", type: "date" }
      ]
    });
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const updateSpy = vi.spyOn(provider, "updateRow");
    const { host, cleanup } = await mount(
      TimelineRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "timeline",
        mutationsAllowed: true
      })
    );
    const dateInput = host.querySelector(
      '.oe-database-timeline__rows input[type="date"]'
    ) as HTMLInputElement | null;
    expect(dateInput).toBeTruthy();
    await setDateInputValue(dateInput!, "2026-09-20");
    await vi.waitFor(() => {
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });
    expect(updateSpy).toHaveBeenCalledWith(
      "tasks",
      "a",
      { title: "Alpha", status: "todo", due: "2026-09-20" },
      0
    );
    await vi.waitFor(() => {
      expect(
        store.getView("tasks::main").items.find((i) => i.rowKey === "a")?.row.due
      ).toBe("2026-09-20");
    });
    await cleanup();
  });

  it("13. readOnly/legacy/trash/metadata pending → no updateRow", async () => {
    const provider = createTimelineGanttProvider([
      {
        rowKey: "a",
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Alpha", due: "2026-09-10" }
      }
    ]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const baseDefinitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const updateSpy = vi.spyOn(provider, "updateRow");

    const readOnlyDefs = baseDefinitions.map((d) =>
      d.id === "due" ? { ...d, readOnly: true } : d
    );
    const readOnlyMount = await mount(
      TimelineRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions: readOnlyDefs,
        runtime: { store, database: provider },
        viewType: "timeline",
        mutationsAllowed: true
      })
    );
    expect(
      readOnlyMount.host.querySelectorAll('input[type="date"]').length
    ).toBe(0);
    await readOnlyMount.cleanup();

    const legacyDefs = baseDefinitions.map((d) =>
      d.id === "due" ? { ...d, source: "legacy" as const } : d
    );
    const legacyMount = await mount(
      TimelineRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions: legacyDefs,
        runtime: { store, database: provider },
        viewType: "timeline",
        mutationsAllowed: true
      })
    );
    expect(legacyMount.host.querySelectorAll('input[type="date"]').length).toBe(
      0
    );
    await legacyMount.cleanup();

    const trashSnap = {
      ...snap,
      queryState: { ...snap.queryState, trashMode: "trash" as const }
    };
    const trashMount = await mount(
      TimelineRenderer,
      buildContext({
        snapshot: trashSnap,
        store,
        definitions: baseDefinitions,
        runtime: { store, database: provider },
        viewType: "timeline",
        mutationsAllowed: true
      })
    );
    expect(trashMount.host.querySelectorAll('input[type="date"]').length).toBe(
      0
    );
    await trashMount.cleanup();

    expect(
      metadataAllowsRowMutations({
        getDatabase: snap.capabilities.getDatabase,
        metaStatus: "loading"
      })
    ).toBe(false);
    const pendingMount = await mount(
      TimelineRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions: baseDefinitions,
        runtime: { store, database: provider },
        viewType: "timeline",
        mutationsAllowed: false
      })
    );
    expect(
      pendingMount.host.querySelectorAll('input[type="date"]').length
    ).toBe(0);
    await pendingMount.cleanup();

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("14. invalid target → no provider call", async () => {
    const provider = createTimelineGanttProvider([
      {
        rowKey: "u",
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Undated", due: "" }
      }
    ]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const updateSpy = vi.spyOn(provider, "updateRow");
    const { host, cleanup } = await mount(
      TimelineRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "timeline",
        mutationsAllowed: true
      })
    );
    const undatedInput = host.querySelector(
      '.oe-database-timeline__undated input[type="date"]'
    ) as HTMLInputElement | null;
    expect(undatedInput).toBeTruthy();
    // canMutateCalendarDate rejects non-canonical targets before provider call.
    expect(
      canMutateCalendarDate({
        mutationsAllowed: true,
        updateCapability: true,
        trashMode: "active",
        dateProperty: DUE,
        targetDateKey: "09/18/2026"
      })
    ).toBe(false);
    await setDateInputValue(undatedInput!, "09/18/2026");
    expect(updateSpy).not.toHaveBeenCalled();
    await cleanup();
  });

  it("15. provider reject → original date retained", async () => {
    const provider = createTimelineGanttProvider([
      {
        rowKey: "a",
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Alpha", due: "2026-09-10" }
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
    ).toBe("2026-09-10");
    expect(provider.rows.find((r) => r.rowKey === "a")?.row.due).toBe(
      "2026-09-10"
    );
  });

  it("16. reorderRows calls === 0 after render + date change + open", async () => {
    const onOpenRow = vi.fn();
    const onReorder = vi.fn();
    const provider = createTimelineGanttProvider([TIMELINE_SEED[0]!], {
      onReorder
    });
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const reorderSpy = vi.spyOn(provider, "reorderRows");
    const { host, cleanup } = await mount(
      TimelineRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider, onOpenRow },
        viewType: "timeline",
        mutationsAllowed: true
      })
    );
    const dateInput = host.querySelector(
      'input[type="date"]'
    ) as HTMLInputElement | null;
    if (dateInput) {
      await setDateInputValue(dateInput, "2026-09-12");
      await vi.waitFor(() => {
        expect(provider.updateCalls).toBeGreaterThanOrEqual(1);
      });
    }
    const openBtn = host.querySelector(
      ".oe-database-timeline__label"
    ) as HTMLButtonElement | null;
    if (openBtn) {
      await act(async () => {
        openBtn.click();
      });
    }
    expect(reorderSpy).not.toHaveBeenCalled();
    expect(provider.reorderCalls).toBe(0);
    expect(onReorder).not.toHaveBeenCalled();
    await cleanup();
  });

  it("17. no raw opaque rowKey in HTML id attributes", async () => {
    const opaqueKey = 'a b:c/d"quoted"';
    const provider = createTimelineGanttProvider([
      {
        rowKey: opaqueKey,
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Opaque", due: "2026-09-10" }
      }
    ]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { host, cleanup } = await mount(
      TimelineRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "timeline"
      })
    );
    const ids = Array.from(host.querySelectorAll("[id]")).map((el) => el.id);
    for (const id of ids) {
      expect(id.includes(opaqueKey)).toBe(false);
      expect(id).not.toMatch(/a b:c/);
    }
    expect(
      host
        .querySelector(".oe-database-timeline__row")
        ?.getAttribute("data-row-key")
    ).toBe(opaqueKey);
    await cleanup();
  });

  it("shows partial hasMore notice", async () => {
    const provider = createTimelineGanttProvider(TIMELINE_SEED, { pageSize: 2 });
    const store = await readyStore(provider, 2);
    const snap = store.getView("tasks::main");
    expect(snap.pagination.hasMore).toBe(true);
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { host, cleanup } = await mount(
      TimelineRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "timeline"
      })
    );
    expect(
      host.querySelector(".oe-database-view__notice")?.textContent
    ).toMatch(/Showing loaded rows only/i);
    await cleanup();
  });

  it("no date property → explanation in controls", async () => {
    const provider = createTimelineGanttProvider(
      [{ rowKey: "a", sortOrder: 0, deletedAt: null, row: { title: "A" } }],
      { definitions: [{ id: "title", name: "Title", type: "text" }] }
    );
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { host, cleanup } = await mount(
      TimelineRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "timeline"
      })
    );
    expect(host.textContent).toMatch(/Add a date property to use Timeline/i);
    await cleanup();
  });
});

// —— Gantt model ——

describe("4F-4C — gantt model", () => {
  it("1. two date props default distinct start/end", () => {
    const { startProp, endProp } = resolveGanttEndpoints(
      [TITLE, START, END],
      null,
      null
    );
    expect(startProp?.id).toBe("start");
    expect(endProp?.id).toBe("end");
    expect(startProp?.id).not.toBe(endProp?.id);
  });

  it("2. one date prop → milestone same start=end", () => {
    const { startProp, endProp } = resolveGanttEndpoints(
      [TITLE, MILESTONE],
      null,
      null
    );
    expect(startProp?.id).toBe("milestone");
    expect(endProp?.id).toBe("milestone");
    const layout = buildGanttLayout({
      items: [row("m", { milestone: "2026-09-10" })],
      startProp,
      endProp
    });
    expect(layout.placedRows).toHaveLength(1);
    expect(layout.placedRows[0]!.milestone).toBe(true);
    expect(layout.placedRows[0]!.startKey).toBe("2026-09-10");
    expect(layout.placedRows[0]!.endKey).toBe("2026-09-10");
  });

  it("3. zero date props → explanation (no endpoints)", () => {
    const { startProp, endProp } = resolveGanttEndpoints([TITLE, STATUS], null, null);
    expect(startProp).toBeNull();
    expect(endProp).toBeNull();
    const layout = buildGanttLayout({
      items: [row("a", { due: "2026-09-10" })],
      startProp,
      endProp
    });
    expect(layout.placedRows).toHaveLength(0);
    expect(layout.incompleteItems.map((i) => i.rowKey)).toEqual(["a"]);
  });

  it('4. opaque start/end ids "schedule:start" / "schedule:end"', () => {
    const { startProp, endProp } = resolveGanttEndpoints(
      [TITLE, SCHEDULE_START, SCHEDULE_END, DUE],
      "schedule:start",
      "schedule:end"
    );
    expect(startProp?.id).toBe("schedule:start");
    expect(endProp?.id).toBe("schedule:end");
    const layout = buildGanttLayout({
      items: [
        row("a", {
          "schedule:start": "2026-09-10",
          "schedule:end": "2026-09-14",
          due: "2026-01-01"
        })
      ],
      startProp,
      endProp
    });
    expect(layout.placedRows[0]!.startKey).toBe("2026-09-10");
    expect(layout.placedRows[0]!.endKey).toBe("2026-09-14");
  });

  it("5. valid inclusive range rendered", () => {
    const { startProp, endProp } = resolveGanttEndpoints([TITLE, START, END], null, null);
    const layout = buildGanttLayout({
      items: [row("a", { start: "2026-09-10", end: "2026-09-14" })],
      startProp,
      endProp
    });
    expect(layout.placedRows).toHaveLength(1);
    expect(layout.placedRows[0]!.barStyle.widthPercent).toBeGreaterThan(0);
    expect(daysBetweenCanonicalDates("2026-09-10", "2026-09-14")).toBe(4);
  });

  it("6. same-day range", () => {
    const { startProp, endProp } = resolveGanttEndpoints([TITLE, START, END], null, null);
    const layout = buildGanttLayout({
      items: [row("a", { start: "2026-09-10", end: "2026-09-10" })],
      startProp,
      endProp
    });
    expect(layout.placedRows).toHaveLength(1);
    expect(layout.placedRows[0]!.milestone).toBe(true);
  });

  it("7. missing start / missing end → incomplete tray", () => {
    const { startProp, endProp } = resolveGanttEndpoints([TITLE, START, END], null, null);
    const layout = buildGanttLayout({
      items: [
        row("ms", { start: "", end: "2026-09-14" }),
        row("me", { start: "2026-09-10", end: "" })
      ],
      startProp,
      endProp
    });
    expect(layout.incompleteItems.map((i) => i.rowKey)).toEqual(["ms", "me"]);
    expect(layout.placedRows).toHaveLength(0);
  });

  it("8. invalid / reversed start>end → invalid tray, NO silent swap", () => {
    const { startProp, endProp } = resolveGanttEndpoints([TITLE, START, END], null, null);
    const layout = buildGanttLayout({
      items: [
        row("rev", { start: "2026-09-14", end: "2026-09-10" }),
        row("bad", { start: "soon", end: "2026-09-14" })
      ],
      startProp,
      endProp
    });
    expect(layout.invalidItems.map((i) => i.rowKey)).toEqual(["rev", "bad"]);
    expect(layout.placedRows).toHaveLength(0);
  });

  it("9. metadata rename / removal fallback", () => {
    const renamedStart = typed({ ...START, name: "Renamed Start" });
    const resolved = resolveGanttEndpoints(
      [TITLE, renamedStart, END],
      "start",
      "end"
    );
    expect(resolved.startProp?.name).toBe("Renamed Start");
    expect(resolved.startProp?.id).toBe("start");
    const fallback = resolveGanttEndpoints([TITLE, END], "start", "gone");
    expect(fallback.startProp?.id).toBe("end");
    expect(fallback.endProp?.id).toBe("end");
  });

  it("10. partial notice is presentation-only", () => {
    const { startProp, endProp } = resolveGanttEndpoints([TITLE, START, END], null, null);
    const loaded = [
      row("a", { start: "2026-09-10", end: "2026-09-14" }),
      row("u", { start: "", end: "" })
    ];
    const layout = buildGanttLayout({ items: loaded, startProp, endProp });
    expect(layout.placedRows).toHaveLength(1);
    expect(layout.incompleteItems.map((i) => i.rowKey)).toEqual(["u"]);
  });

  it("shiftInclusiveRange preserves duration across year boundary", () => {
    const shifted = shiftInclusiveRange(
      "2025-12-30",
      "2026-01-02",
      "2026-12-30"
    );
    expect(shifted).toEqual({
      start: "2026-12-30",
      end: "2027-01-02"
    });
    expect(daysBetweenCanonicalDates(shifted!.start, shifted!.end)).toBe(3);
    expect(
      shiftInclusiveRange("2026-09-10", "2026-09-14", "2026-09-20")
    ).toEqual({
      start: "2026-09-20",
      end: "2026-09-24"
    });
  });
});

// —— Gantt renderer ——

describe("4F-4C — GanttRenderer", () => {
  it("renders bars, incomplete and invalid trays", async () => {
    const provider = createTimelineGanttProvider(TIMELINE_SEED);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { host, cleanup } = await mount(
      GanttRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "gantt"
      })
    );
    expect(host.querySelector("[data-oe-gantt]")).toBeTruthy();
    expect(host.querySelector('[aria-label="Incomplete range"]')).toBeTruthy();
    expect(host.textContent).toContain("Undated");
    expect(host.querySelector('[aria-label="Invalid range"]')).toBeTruthy();
    expect(host.querySelector(".oe-database-gantt__bar")).toBeTruthy();
    await cleanup();
  });

  it("11. onOpenRow viewType gantt exact click", async () => {
    const onOpenRow = vi.fn();
    const provider = createTimelineGanttProvider([TIMELINE_SEED[0]!]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { host, cleanup } = await mount(
      GanttRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewId: "main-gantt",
        runtime: { store, database: provider, onOpenRow },
        viewType: "gantt"
      })
    );
    const openBtn = host.querySelector(
      ".oe-database-gantt__label"
    ) as HTMLButtonElement | null;
    expect(openBtn).toBeTruthy();
    await act(async () => {
      openBtn!.click();
    });
    expect(onOpenRow).toHaveBeenCalledWith({
      databaseId: "tasks",
      rowKey: "a",
      viewId: "main-gantt",
      viewType: "gantt"
    } satisfies DatabaseRowOpenRequest);
    await cleanup();
  });

  it("12. full-range move writes both props; duration Sep10-14 → Sep20-24", async () => {
    const provider = createTimelineGanttProvider([
      {
        rowKey: "a",
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Alpha", start: "2026-09-10", end: "2026-09-14" }
      },
      {
        rowKey: "w",
        sortOrder: 1,
        deletedAt: null,
        row: { title: "Wide", start: "2026-09-20", end: "2026-09-24" }
      }
    ], {
      definitions: [
        { id: "title", name: "Title", type: "text" },
        { id: "start", name: "Start", type: "date" },
        { id: "end", name: "End", type: "date" }
      ]
    });
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const updateSpy = vi.spyOn(provider, "updateRow");
    const { host, cleanup } = await mount(
      GanttRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "gantt",
        mutationsAllowed: true
      })
    );
    const bar = host.querySelector(".oe-database-gantt__bar") as HTMLElement;
    const track = host.querySelector(".oe-database-gantt__track") as HTMLElement;
    expect(bar).toBeTruthy();
    expect(track).toBeTruthy();
    Object.defineProperty(track, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 400,
        bottom: 20,
        width: 400,
        height: 20,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })
    });
    const layout = buildGanttLayout({
      items: snap.items,
      startProp: START,
      endProp: END
    });
    expect(
      shiftInclusiveRange("2026-09-10", "2026-09-14", "2026-09-20")
    ).toEqual({ start: "2026-09-20", end: "2026-09-24" });
    const desiredStart = "2026-09-20";
    const offset = dateKeyToOffsetDays(layout.axis.startDateKey, desiredStart)!;
    const span = Math.max(1, layout.axis.spanDays - 1);
    const percent = (offset / span) * 100;
    const clientX = (percent / 100) * 400;
    const targetStart = dateKeyFromAxisPercent(layout.axis, percent);
    const expected = shiftInclusiveRange(
      "2026-09-10",
      "2026-09-14",
      targetStart
    );
    expect(targetStart).toBe("2026-09-20");
    expect(expected).toEqual({ start: "2026-09-20", end: "2026-09-24" });
    await act(async () => {
      dispatchDragDrop(bar, track, clientX);
    });
    await vi.waitFor(() => {
      expect(updateSpy).toHaveBeenCalled();
    });
    const mocked = updateSpy as unknown as {
      mock: { calls: Array<[string, string, Record<string, JsonValue>]> };
    };
    const lastCall = mocked.mock.calls.at(-1);
    expect(lastCall?.[2]).toEqual({
      title: "Alpha",
      start: expected!.start,
      end: expected!.end
    });
    await cleanup();
  });

  it("13. same property → single property write once", async () => {
    const provider = createTimelineGanttProvider([
      {
        rowKey: "m",
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Milestone", milestone: "2026-09-10" }
      }
    ], {
      definitions: [
        { id: "title", name: "Title", type: "text" },
        { id: "milestone", name: "Milestone", type: "date" }
      ]
    });
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const updateSpy = vi.spyOn(provider, "updateRow");
    const { host, cleanup } = await mount(
      GanttRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "gantt",
        mutationsAllowed: true
      })
    );
    const dateInput = host.querySelector(
      'input[type="date"]'
    ) as HTMLInputElement | null;
    expect(dateInput).toBeTruthy();
    await setDateInputValue(dateInput!, "2026-09-20");
    await vi.waitFor(() => {
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });
    expect(updateSpy).toHaveBeenCalledWith(
      "tasks",
      "m",
      { title: "Milestone", milestone: "2026-09-20" },
      0
    );
    await cleanup();
  });

  it("14. start or end readOnly → full-range move disabled", async () => {
    const provider = createTimelineGanttProvider([
      {
        rowKey: "a",
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Alpha", start: "2026-09-10", end: "2026-09-14" }
      }
    ]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const baseDefinitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });

    const readOnlyStart = baseDefinitions.map((d) =>
      d.id === "start" ? { ...d, readOnly: true } : d
    );
    const startMount = await mount(
      GanttRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions: readOnlyStart,
        runtime: { store, database: provider },
        viewType: "gantt",
        mutationsAllowed: true
      })
    );
    const startBar = startMount.host.querySelector(
      ".oe-database-gantt__bar"
    ) as HTMLElement | null;
    expect(startBar?.getAttribute("draggable")).not.toBe("true");
    await startMount.cleanup();

    const readOnlyEnd = baseDefinitions.map((d) =>
      d.id === "end" ? { ...d, readOnly: true } : d
    );
    const endMount = await mount(
      GanttRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions: readOnlyEnd,
        runtime: { store, database: provider },
        viewType: "gantt",
        mutationsAllowed: true
      })
    );
    const endBar = endMount.host.querySelector(
      ".oe-database-gantt__bar"
    ) as HTMLElement | null;
    expect(endBar?.getAttribute("draggable")).not.toBe("true");
    await endMount.cleanup();
  });

  it("15. provider failure retains range", async () => {
    const provider = createTimelineGanttProvider([
      {
        rowKey: "a",
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Alpha", start: "2026-09-10", end: "2026-09-14" }
      }
    ]);
    const store = await readyStore(provider);
    provider.setFailUpdate(true);
    const item = store.getView("tasks::main").items[0]!;
    const next = {
      ...item.row,
      start: "2026-09-20",
      end: "2026-09-24"
    };
    await expect(
      store.updateRow("tasks::main", item.rowKey, next, item.sortOrder)
    ).rejects.toThrow(/provider rejected/);
    const retained = store.getView("tasks::main").items.find((i) => i.rowKey === "a")!;
    expect(retained.row.start).toBe("2026-09-10");
    expect(retained.row.end).toBe("2026-09-14");
  });

  it("16. reorderRows === 0", async () => {
    const onOpenRow = vi.fn();
    const provider = createTimelineGanttProvider([TIMELINE_SEED[0]!]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const reorderSpy = vi.spyOn(provider, "reorderRows");
    const { host, cleanup } = await mount(
      GanttRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider, onOpenRow },
        viewType: "gantt",
        mutationsAllowed: true
      })
    );
    const endInput = host.querySelectorAll(
      'input[type="date"]'
    )[1] as HTMLInputElement | undefined;
    if (endInput) {
      await setDateInputValue(endInput, "2026-09-18");
      await vi.waitFor(() => {
        expect(provider.updateCalls).toBeGreaterThanOrEqual(1);
      });
    }
    const openBtn = host.querySelector(
      ".oe-database-gantt__label"
    ) as HTMLButtonElement | null;
    if (openBtn) {
      await act(async () => {
        openBtn.click();
      });
    }
    expect(reorderSpy).not.toHaveBeenCalled();
    expect(provider.reorderCalls).toBe(0);
    await cleanup();
  });

  it("shows partial hasMore notice and zero-date explanation", async () => {
    const provider = createTimelineGanttProvider(TIMELINE_SEED, { pageSize: 2 });
    const store = await readyStore(provider, 2);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const partial = await mount(
      GanttRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "gantt"
      })
    );
    expect(
      partial.host.querySelector(".oe-database-view__notice")?.textContent
    ).toMatch(/Showing loaded rows only/i);
    await partial.cleanup();

    const noDates = createTimelineGanttProvider(
      [{ rowKey: "a", sortOrder: 0, deletedAt: null, row: { title: "A" } }],
      { definitions: [{ id: "title", name: "Title", type: "text" }] }
    );
    const noDateStore = await readyStore(noDates);
    const noDateSnap = noDateStore.getView("tasks::main");
    const noDateDefs = resolveDatabasePropertyDefinitions({
      legacySchema: noDateSnap.schema,
      definitions: noDateSnap.meta?.propertyDefinitions
    });
    const empty = await mount(
      GanttRenderer,
      buildContext({
        snapshot: noDateSnap,
        store: noDateStore,
        definitions: noDateDefs,
        runtime: { store: noDateStore, database: noDates },
        viewType: "gantt"
      })
    );
    expect(empty.host.textContent).toMatch(/Add a date property to use Gantt/i);
    await empty.cleanup();
  });
});

// —— EditorDocument ——

describe("4F-4C — EditorDocument identity-only", () => {
  it("timeline/gantt blocks serialize identity props only — no layout selections", () => {
    const doc = createEditorDocument([
      {
        id: "db-timeline",
        type: "databaseView",
        props: {
          databaseId: "tasks",
          viewId: "main-timeline",
          viewType: "timeline",
          titleHint: "Timeline"
        }
      },
      {
        id: "db-gantt",
        type: "databaseView",
        props: {
          databaseId: "tasks",
          viewId: "main-gantt",
          viewType: "gantt",
          titleHint: "Gantt"
        }
      }
    ]);
    const serialized = serializeEditorDocument(doc);
    expect(serialized).toContain('"viewType":"timeline"');
    expect(serialized).toContain('"viewType":"gantt"');
    expect(serialized).toContain('"viewId":"main-timeline"');
    expect(serialized).toContain('"viewId":"main-gantt"');
    expect(serialized).not.toContain('"items"');
    expect(serialized).not.toContain("dateProperty");
    expect(serialized).not.toContain("startProperty");
    expect(serialized).not.toContain("endProperty");
    expect(serialized).not.toContain("placedRows");
    expect(serialized).not.toContain("schedule:start");
  });
});

// —— 4F-4C R1: preserve missing Gantt endpoints ——

const R1_GANTT_DEFS: readonly DatabasePropertyDefinition[] = [
  { id: "title", name: "Title", type: "text" },
  { id: "start", name: "Start", type: "date" },
  { id: "end", name: "End", type: "date" }
];

describe("4F-4C R1 — Gantt endpoint edit never fabricates opposite", () => {
  it("1. start=\"\" end=\"\" Set Start → only start written", async () => {
    const provider = createTimelineGanttProvider(
      [
        {
          rowKey: "a",
          sortOrder: 0,
          deletedAt: null,
          row: { title: "Alpha", start: "", end: "" }
        }
      ],
      { definitions: R1_GANTT_DEFS }
    );
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const updateSpy = vi.spyOn(provider, "updateRow");
    const { host, cleanup } = await mount(
      GanttRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "gantt",
        mutationsAllowed: true
      })
    );
    const startInput = host.querySelector(
      'input[aria-label="Set start date for Alpha"]'
    ) as HTMLInputElement | null;
    expect(startInput).toBeTruthy();
    await setDateInputValue(startInput!, "2026-09-20");
    await vi.waitFor(() => {
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });
    expect(updateSpy).toHaveBeenCalledWith(
      "tasks",
      "a",
      { title: "Alpha", start: "2026-09-20", end: "" },
      0
    );
    await cleanup();
  });

  it("2. start=\"\" end set — Set End keeps start empty", async () => {
    const provider = createTimelineGanttProvider(
      [
        {
          rowKey: "a",
          sortOrder: 0,
          deletedAt: null,
          row: { title: "Alpha", start: "", end: "2026-09-14" }
        }
      ],
      { definitions: R1_GANTT_DEFS }
    );
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const updateSpy = vi.spyOn(provider, "updateRow");
    const { host, cleanup } = await mount(
      GanttRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "gantt",
        mutationsAllowed: true
      })
    );
    const endInput = host.querySelector(
      'input[aria-label="Set end date for Alpha"]'
    ) as HTMLInputElement | null;
    expect(endInput).toBeTruthy();
    await setDateInputValue(endInput!, "2026-09-20");
    await vi.waitFor(() => {
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });
    expect(updateSpy).toHaveBeenCalledWith(
      "tasks",
      "a",
      { title: "Alpha", start: "", end: "2026-09-20" },
      0
    );
    await cleanup();
  });

  it("3. start set end=\"\" — Set Start keeps end empty", async () => {
    const provider = createTimelineGanttProvider(
      [
        {
          rowKey: "a",
          sortOrder: 0,
          deletedAt: null,
          row: { title: "Alpha", start: "2026-09-10", end: "" }
        }
      ],
      { definitions: R1_GANTT_DEFS }
    );
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const updateSpy = vi.spyOn(provider, "updateRow");
    const { host, cleanup } = await mount(
      GanttRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "gantt",
        mutationsAllowed: true
      })
    );
    const startInput = host.querySelector(
      'input[aria-label="Set start date for Alpha"]'
    ) as HTMLInputElement | null;
    expect(startInput).toBeTruthy();
    await setDateInputValue(startInput!, "2026-09-12");
    await vi.waitFor(() => {
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });
    expect(updateSpy).toHaveBeenCalledWith(
      "tasks",
      "a",
      { title: "Alpha", start: "2026-09-12", end: "" },
      0
    );
    await cleanup();
  });

  it("4. valid range Set Start > end → no provider call", async () => {
    const provider = createTimelineGanttProvider(
      [
        {
          rowKey: "a",
          sortOrder: 0,
          deletedAt: null,
          row: { title: "Alpha", start: "2026-09-10", end: "2026-09-14" }
        }
      ],
      { definitions: R1_GANTT_DEFS }
    );
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const updateSpy = vi.spyOn(provider, "updateRow");
    const { host, cleanup } = await mount(
      GanttRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "gantt",
        mutationsAllowed: true
      })
    );
    const startInput = host.querySelector(
      'input[aria-label="Start date for Alpha"]'
    ) as HTMLInputElement | null;
    expect(startInput).toBeTruthy();
    await setDateInputValue(startInput!, "2026-09-20");
    expect(updateSpy).not.toHaveBeenCalled();
    expect(store.getView("tasks::main").items[0]!.row).toEqual({
      title: "Alpha",
      start: "2026-09-10",
      end: "2026-09-14"
    });
    await cleanup();
  });
});
