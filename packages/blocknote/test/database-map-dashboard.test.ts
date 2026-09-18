/**
 * @vitest-environment jsdom
 *
 * Phase 4F-4E — Map + Dashboard models, renderers, location seam, dispatch.
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
  buildDashboardCategoricalSummary,
  buildDashboardDateSummary,
  buildDashboardNumericSummary,
  buildDashboardOverview,
  listDashboardCategoricalProperties,
  listDashboardDateProperties,
  listDashboardNumericProperties,
  resolveDashboardCategoricalProperty,
  resolveDashboardDateProperty,
  resolveDashboardNumericProperty
} from "../src/workspace/databaseDashboardModel.js";
import {
  DashboardRenderer,
  renderDashboardView
} from "../src/workspace/databaseDashboardRenderer.js";
import {
  buildMapRowPresentations,
  projectEquirectangular,
  safeResolveMapLocation,
  validateMapLocation
} from "../src/workspace/databaseMapModel.js";
import {
  MapRenderer,
  renderMapView
} from "../src/workspace/databaseMapRenderer.js";
import {
  cloneDatabaseRowRecord,
  resolveDatabaseRowTitle,
  safeResolveFeedRowMedia,
  safeResolveRowMedia
} from "../src/workspace/databaseRowPresentation.js";
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
  resolveDatabasePropertyDefinitions,
  type ResolvedPropertyDefinition
} from "../src/workspace/databaseProperty.js";
import type {
  DatabaseMapLocation,
  DatabaseMapLocationRequest,
  DatabaseViewRuntime
} from "../src/workspace/databaseViewRuntime.js";
import { DATABASE_VIEW_TYPES, isDatabaseViewType } from "../src/workspace/types.js";
import { categoryKeyEncode } from "../src/workspace/databaseChartModel.js";
import { renderChartView } from "../src/workspace/databaseChartRenderer.js";
import { renderFeedView } from "../src/workspace/databaseFeedRenderer.js";
import { SharedDatabaseViewShell } from "../src/workspace/databaseView.js";
import { renderBoardView } from "../src/workspace/databaseBoardRenderer.js";
import { renderCalendarView } from "../src/workspace/databaseCalendarRenderer.js";
import { renderGalleryView } from "../src/workspace/databaseGalleryRenderer.js";
import { renderListView } from "../src/workspace/databaseListRenderer.js";
import { renderGanttView } from "../src/workspace/databaseGanttRenderer.js";
import { renderTimelineView } from "../src/workspace/databaseTimelineRenderer.js";

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
const STATUS = typed({
  id: "status",
  name: "Status",
  type: "status",
  options: [
    { value: "todo", label: "Backlog" },
    { value: "doing", label: "In progress" },
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
const SCORE = typed({ id: "score", name: "Score", type: "number" });
const DUE = typed({ id: "due", name: "Due", type: "date" });
const DONE = typed({ id: "done", name: "Done", type: "boolean" });
const URL = typed({ id: "url", name: "URL", type: "url" });

const DEFAULT_RENDERERS: DatabaseViewRendererMap = {
  map: renderMapView,
  dashboard: renderDashboardView,
  chart: renderChartView,
  feed: renderFeedView
};

const DEFAULT_DEFINITIONS: DatabasePropertyDefinition[] = [
  { id: "title", name: "Title", type: "text" },
  {
    id: "status",
    name: "Status",
    type: "status",
    options: [
      { value: "todo", label: "Backlog" },
      { value: "doing", label: "In progress" },
      { value: "done", label: "Done" }
    ]
  },
  {
    id: "priority",
    name: "Priority",
    type: "select",
    options: [
      { value: "p1", label: "High" },
      { value: "p2", label: "Low" }
    ]
  },
  { id: "score", name: "Score", type: "number" },
  { id: "due", name: "Due", type: "date" },
  { id: "done", name: "Done", type: "boolean" }
];

type MemRow = {
  rowKey: string;
  sortOrder: number;
  deletedAt: string | null;
  row: Record<string, JsonValue>;
};

function createMapDashProvider(
  seed: MemRow[],
  options?: {
    pageSize?: number;
    definitions?: readonly DatabasePropertyDefinition[];
  }
): DatabaseProvider & {
  rows: MemRow[];
  listCalls: number;
  getDatabaseCalls: number;
  reorderCalls: number;
  updateCalls: number;
  createCalls: number;
  deleteCalls: number;
  restoreCalls: number;
} {
  const rows = seed.map((r) => ({ ...r, row: { ...r.row } }));
  let listCalls = 0;
  let getDatabaseCalls = 0;
  let reorderCalls = 0;
  let updateCalls = 0;
  let createCalls = 0;
  let deleteCalls = 0;
  let restoreCalls = 0;
  const definitions = [...(options?.definitions ?? DEFAULT_DEFINITIONS)];
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
    get createCalls() {
      return createCalls;
    },
    get deleteCalls() {
      return deleteCalls;
    },
    get restoreCalls() {
      return restoreCalls;
    },
    async getDatabase(databaseId) {
      getDatabaseCalls += 1;
      return {
        id: databaseId,
        title: "Tasks",
        propertyDefinitions: definitions,
        queryCapabilities: { propertyFilters: true, propertySort: true }
      };
    },
    async listRows(databaseId, opts?: DatabaseListOptions): Promise<DatabaseRowsPage> {
      listCalls += 1;
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
      createCalls += 1;
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
      const hit = rows.find((r) => r.rowKey === rowKey);
      if (!hit) throw new Error("missing");
      hit.row = { ...data };
      return { ok: true };
    },
    async deleteRow() {
      deleteCalls += 1;
      return { ok: true };
    },
    async restoreRow() {
      restoreCalls += 1;
      return { ok: true };
    },
    async reorderRows() {
      reorderCalls += 1;
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
    viewType: "map",
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

const SEED_ROWS: MemRow[] = [
  {
    rowKey: "a",
    sortOrder: 0,
    deletedAt: null,
    row: {
      title: "Alpha",
      status: "todo",
      priority: "p1",
      score: 10,
      due: "2026-09-01",
      done: false
    }
  },
  {
    rowKey: "b",
    sortOrder: 1,
    deletedAt: null,
    row: {
      title: "Bravo",
      status: "doing",
      priority: "p2",
      score: -5,
      due: "2026-09-10",
      done: false
    }
  },
  {
    rowKey: "c",
    sortOrder: 2,
    deletedAt: null,
    row: {
      title: "Charlie",
      status: "done",
      priority: "p1",
      score: 0,
      due: "2026-09-18",
      done: true
    }
  }
];

async function changeSelect(
  select: HTMLSelectElement,
  value: string
): Promise<void> {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

// —— Dispatch ——

describe("4F-4E — resolveDatabaseViewRenderer", () => {
  it("dispatches map → MapRenderer and dashboard → DashboardRenderer", () => {
    expect(
      resolveDatabaseViewRenderer({
        viewType: "map",
        runtime: {},
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(renderMapView);
    expect(
      resolveDatabaseViewRenderer({
        viewType: "dashboard",
        runtime: {},
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(renderDashboardView);
  });

  it("no current DatabaseViewType is deferred — all 11 ready", () => {
    expect(DATABASE_VIEW_TYPES).toHaveLength(11);
    for (const vt of DATABASE_VIEW_TYPES) {
      expect(isDeferredDatabaseViewType(vt)).toBe(false);
    }
  });

  it("uses custom map/dashboard overrides from runtime", () => {
    const customMap: DatabaseViewRenderer = () =>
      createElement("div", { "data-custom-map": "" });
    const customDash: DatabaseViewRenderer = () =>
      createElement("div", { "data-custom-dashboard": "" });
    expect(
      resolveDatabaseViewRenderer({
        viewType: "map",
        runtime: { renderers: { map: customMap } },
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(customMap);
    expect(
      resolveDatabaseViewRenderer({
        viewType: "dashboard",
        runtime: { renderers: { dashboard: customDash } },
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(customDash);
  });
});

// —— Map validation & projection ——

describe("4F-4E — Map location validation", () => {
  it("accepts finite lat/lng including (0,0); rejects out of range / non-finite / coerced", () => {
    expect(validateMapLocation({ latitude: 0, longitude: 0 })).toEqual({
      latitude: 0,
      longitude: 0
    });
    expect(
      validateMapLocation({ latitude: 35.6, longitude: 139.7, label: "T" })
    ).toEqual({ latitude: 35.6, longitude: 139.7, label: "T" });
    expect(validateMapLocation({ latitude: 90, longitude: -180 })).toEqual({
      latitude: 90,
      longitude: -180
    });
    expect(validateMapLocation({ latitude: -90, longitude: 180 })).toEqual({
      latitude: -90,
      longitude: 180
    });

    expect(validateMapLocation(null)).toBeNull();
    expect(validateMapLocation(undefined)).toBeNull();
    expect(validateMapLocation({ latitude: 91, longitude: 0 })).toBeNull();
    expect(validateMapLocation({ latitude: 0, longitude: 181 })).toBeNull();
    expect(validateMapLocation({ latitude: NaN, longitude: 0 })).toBeNull();
    expect(validateMapLocation({ latitude: Infinity, longitude: 0 })).toBeNull();
    expect(
      validateMapLocation({ latitude: "35" as unknown as number, longitude: 0 })
    ).toBeNull();
    expect(
      validateMapLocation({ latitude: true as unknown as number, longitude: 0 })
    ).toBeNull();
    // No truthiness: empty object / missing coords
    expect(validateMapLocation({})).toBeNull();
    expect(validateMapLocation({ latitude: 1 })).toBeNull();
  });

  it("safeResolveMapLocation: null → no-location; invalid/throw → invalid-location", () => {
    const base: DatabaseMapLocationRequest = {
      databaseId: "tasks",
      rowKey: "a",
      row: { title: "A" },
      viewId: "main",
      viewType: "map"
    };
    expect(safeResolveMapLocation({}, base).kind).toBe("no-location");
    expect(
      safeResolveMapLocation({ resolveMapLocation: () => null }, base).kind
    ).toBe("no-location");
    expect(
      safeResolveMapLocation({ resolveMapLocation: () => undefined }, base)
        .kind
    ).toBe("no-location");
    expect(
      safeResolveMapLocation(
        { resolveMapLocation: () => ({ latitude: 999, longitude: 0 }) },
        base
      ).kind
    ).toBe("invalid-location");
    expect(
      safeResolveMapLocation(
        {
          resolveMapLocation: () => {
            throw new Error("boom");
          }
        },
        base
      ).kind
    ).toBe("invalid-location");
    const ok = safeResolveMapLocation(
      {
        resolveMapLocation: () => ({
          latitude: 10,
          longitude: 20,
          address: "X"
        })
      },
      base
    );
    expect(ok).toEqual({
      kind: "located",
      location: { latitude: 10, longitude: 20, address: "X" }
    });
  });

  it("equirectangular projection: corners and (0,0); no jitter", () => {
    expect(projectEquirectangular({ latitude: 0, longitude: 0 })).toEqual({
      xPercent: 50,
      yPercent: 50
    });
    expect(projectEquirectangular({ latitude: 90, longitude: -180 })).toEqual({
      xPercent: 0,
      yPercent: 0
    });
    expect(projectEquirectangular({ latitude: -90, longitude: 180 })).toEqual({
      xPercent: 100,
      yPercent: 100
    });
    // Same coords → identical projection (overlapping OK)
    const a = projectEquirectangular({ latitude: 1, longitude: 2 });
    const b = projectEquirectangular({ latitude: 1, longitude: 2 });
    expect(a).toEqual(b);
  });
});

describe("4F-4E — Map source-of-truth / no mutation / isolation", () => {
  it("defensive clone: resolver cannot mutate RuntimeStore or provider rows", async () => {
    const provider = createMapDashProvider([SEED_ROWS[0]!]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const original = structuredClone(snap.items[0]!.row);
    const providerOriginal = structuredClone(provider.rows[0]!.row);

    const resolveMapLocation = (
      request: DatabaseMapLocationRequest
    ): DatabaseMapLocation => {
      const mutable = request.row as Record<string, JsonValue>;
      mutable.title = "MUTATED";
      mutable.extra = "leak";
      return { latitude: 1, longitude: 2 };
    };

    const status = safeResolveMapLocation(
      { resolveMapLocation },
      {
        databaseId: "tasks",
        rowKey: snap.items[0]!.rowKey,
        row: cloneDatabaseRowRecord(snap.items[0]!.row),
        viewId: "main",
        viewType: "map"
      }
    );
    expect(status.kind).toBe("located");
    expect(store.getView("tasks::main").items[0]!.row).toEqual(original);
    expect(provider.rows[0]!.row).toEqual(providerOriginal);
  });

  it("after snapshot ready: Map render causes 0 listRows/getDatabase/mutations", async () => {
    const provider = createMapDashProvider(SEED_ROWS);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const listBefore = provider.listCalls;
    const getBefore = provider.getDatabaseCalls;

    const mounted = await mount(
      MapRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewType: "map",
        runtime: {
          store,
          database: provider,
          resolveMapLocation: () => ({ latitude: 10, longitude: 20 })
        }
      })
    );

    expect(provider.listCalls).toBe(listBefore);
    expect(provider.getDatabaseCalls).toBe(getBefore);
    expect(provider.updateCalls).toBe(0);
    expect(provider.createCalls).toBe(0);
    expect(provider.deleteCalls).toBe(0);
    expect(provider.restoreCalls).toBe(0);
    expect(provider.reorderCalls).toBe(0);
    await mounted.cleanup();
  });

  it("Runtime A vs B resolveMapLocation do not leak", async () => {
    const provider = createMapDashProvider([SEED_ROWS[0]!]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });

    const seenA: string[] = [];
    const seenB: string[] = [];
    const mapA = await mount(
      MapRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        title: "A",
        runtime: {
          store,
          database: provider,
          resolveMapLocation: () => {
            seenA.push("a");
            return { latitude: 1, longitude: 1, label: "A-loc" };
          }
        }
      })
    );
    const mapB = await mount(
      MapRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        title: "B",
        runtime: {
          store,
          database: provider,
          resolveMapLocation: () => {
            seenB.push("b");
            return { latitude: 2, longitude: 2, label: "B-loc" };
          }
        }
      })
    );

    expect(mapA.host.textContent).toContain("A-loc");
    expect(mapA.host.textContent).not.toContain("B-loc");
    expect(mapB.host.textContent).toContain("B-loc");
    expect(mapB.host.textContent).not.toContain("A-loc");
    expect(seenA.length).toBeGreaterThan(0);
    expect(seenB.length).toBeGreaterThan(0);
    await mapA.cleanup();
    await mapB.cleanup();
  });
});

describe("4F-4E — MapRenderer", () => {
  it("renders pins + accessible list in provider order; no/invalid location labels", async () => {
    const provider = createMapDashProvider(SEED_ROWS);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });

    const resolveMapLocation = (
      request: DatabaseMapLocationRequest
    ): DatabaseMapLocation | null => {
      if (request.rowKey === "a") {
        return { latitude: 0, longitude: 0, label: "Origin" };
      }
      if (request.rowKey === "b") return null;
      return { latitude: 999, longitude: 0 } as DatabaseMapLocation;
    };

    const opens: DatabaseRowOpenRequest[] = [];
    const mounted = await mount(
      MapRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewType: "map",
        runtime: {
          store,
          database: provider,
          resolveMapLocation,
          onOpenRow: (req) => opens.push(req)
        }
      })
    );

    expect(mounted.host.querySelector("[data-oe-map]")).toBeTruthy();
    const listItems = Array.from(
      mounted.host.querySelectorAll(".oe-database-map__list-item")
    );
    expect(listItems.map((el) => el.getAttribute("data-row-key"))).toEqual([
      "a",
      "b",
      "c"
    ]);
    expect(listItems[0]?.getAttribute("data-location-status")).toBe("located");
    expect(listItems[1]?.getAttribute("data-location-status")).toBe(
      "no-location"
    );
    expect(listItems[2]?.getAttribute("data-location-status")).toBe(
      "invalid-location"
    );
    expect(mounted.host.textContent).toContain("No location");
    expect(mounted.host.textContent).toContain("Invalid location");
    expect(mounted.host.textContent).toContain("Origin");

    // Only located rows get pins
    const pins = mounted.host.querySelectorAll(".oe-database-map__pin");
    expect(pins).toHaveLength(1);
    expect(pins[0]?.getAttribute("data-row-key")).toBe("a");

    const titleBtn = mounted.host.querySelector(
      '.oe-database-map__list-item[data-row-key="a"] .oe-database-map__list-title'
    ) as HTMLButtonElement;
    await act(async () => {
      titleBtn.click();
    });
    expect(opens).toEqual([
      {
        databaseId: "tasks",
        rowKey: "a",
        viewId: "main",
        viewType: "map"
      }
    ]);

    await mounted.cleanup();
  });

  it("partial pagination notice; opaque rowKey safe in HTML id", async () => {
    const opaqueKey = 'map"><script>a b:c/d';
    const provider = createMapDashProvider(
      [
        {
          rowKey: opaqueKey,
          sortOrder: 0,
          deletedAt: null,
          row: { title: "Opaque", status: "todo", score: 1, due: "2026-09-01" }
        },
        {
          rowKey: "more",
          sortOrder: 1,
          deletedAt: null,
          row: { title: "More", status: "todo", score: 2, due: "2026-09-02" }
        }
      ],
      { pageSize: 1 }
    );
    const store = await readyStore(provider, 1);
    const snap = store.getView("tasks::main");
    expect(snap.pagination.hasMore).toBe(true);
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });

    const mounted = await mount(
      MapRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewType: "map",
        runtime: {
          store,
          database: provider,
          resolveMapLocation: () => ({ latitude: 5, longitude: 5 })
        }
      })
    );

    expect(mounted.host.textContent).toMatch(/Showing loaded rows only/i);
    for (const el of Array.from(mounted.host.querySelectorAll("[id]"))) {
      const id = el.getAttribute("id") ?? "";
      expect(id.includes(opaqueKey)).toBe(false);
    }
    expect(
      mounted.host
        .querySelector(".oe-database-map__list-item")
        ?.getAttribute("data-row-key")
    ).toBe(opaqueKey);
    await mounted.cleanup();
  });

  it("custom map renderer with useState mount/rerender/switch safely", async () => {
    function Hooked(ctx: DatabaseViewRendererContext): ReactElement {
      const [ticks, setTicks] = useState(0);
      useEffect(() => {
        setTicks((n) => n + 1);
      }, [ctx.title]);
      return createElement("div", {
        "data-custom-map": "",
        "data-ticks": String(ticks),
        "data-title": ctx.title
      });
    }

    const provider = createMapDashProvider([SEED_ROWS[0]!]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });

    const mounted = await mount(
      Hooked,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewType: "map",
        title: "Map A",
        runtime: { store, database: provider, renderers: { map: Hooked } }
      })
    );
    await vi.waitFor(() => {
      expect(
        mounted.host
          .querySelector("[data-custom-map]")
          ?.getAttribute("data-ticks")
      ).toBe("1");
    });
    await mounted.rerender(
      Hooked,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewType: "map",
        title: "Map B",
        runtime: { store, database: provider, renderers: { map: Hooked } }
      })
    );
    await vi.waitFor(() => {
      expect(
        mounted.host
          .querySelector("[data-custom-map]")
          ?.getAttribute("data-ticks")
      ).toBe("2");
    });
    await mounted.cleanup();
  });

  it("Gallery/Feed media APIs unchanged — Map uses resolveMapLocation only", () => {
    const gallerySeen: string[] = [];
    const feedSeen: string[] = [];
    const mapSeen: string[] = [];
    const runtime: DatabaseViewRuntime = {
      resolveRowMedia: (request) => {
        gallerySeen.push(request.viewType);
        return { src: "g.png" };
      },
      resolveFeedRowMedia: (request) => {
        feedSeen.push(request.viewType);
        return { src: "f.png" };
      },
      resolveMapLocation: (request) => {
        mapSeen.push(request.viewType);
        return { latitude: 1, longitude: 2 };
      }
    };
    const base = {
      databaseId: "tasks",
      rowKey: "a",
      row: { title: "A" },
      viewId: "main"
    };
    safeResolveRowMedia(runtime, { ...base, viewType: "gallery" });
    safeResolveFeedRowMedia(runtime, { ...base, viewType: "feed" });
    safeResolveMapLocation(runtime, { ...base, viewType: "map" });
    expect(gallerySeen).toEqual(["gallery"]);
    expect(feedSeen).toEqual(["feed"]);
    expect(mapSeen).toEqual(["map"]);
  });
});

// —— Dashboard model ——

describe("4F-4E — Dashboard model", () => {
  it("overview uses loaded items.length — not pagination.total", () => {
    const items = [row("a", { title: "A" }), row("b", { title: "B" })];
    const overview = buildDashboardOverview({
      items,
      definitions: [TITLE, STATUS, SCORE]
    });
    expect(overview.loadedRowCount).toBe(2);
    expect(overview.propertyDefinitionCount).toBe(3);
  });

  it("categorical: status/select only; reuses Chart Empty/Invalid identity", () => {
    expect(listDashboardCategoricalProperties([TITLE, STATUS, SCORE, DUE])).toEqual(
      [STATUS]
    );
    expect(
      listDashboardCategoricalProperties([PRIORITY, DONE, URL]).map((d) => d.id)
    ).toEqual(["priority"]);

    const items = [
      row("a", { status: "todo" }),
      row("b", { status: "" }),
      row("c", { status: 7 as unknown as JsonValue }),
      row("d", { status: "legacy" })
    ];
    const { buckets } = buildDashboardCategoricalSummary({
      items,
      metric: STATUS
    });
    const byKey = Object.fromEntries(
      buckets.map((b) => [categoryKeyEncode(b.key), b.count])
    );
    expect(byKey["v:\"todo\""]).toBe(1);
    expect(byKey.empty).toBe(1);
    expect(byKey.invalid).toBe(1);
    expect(byKey['v:"legacy"']).toBe(1);
    expect(buckets.find((b) => b.key.kind === "empty")?.label).toBe("Empty");
    expect(buckets.find((b) => b.key.kind === "invalid")?.label).toBe(
      "Invalid"
    );
  });

  it("numeric: finite-only single-pass; no string coercion", () => {
    const items = [
      row("a", { score: 10 }),
      row("b", { score: -5 }),
      row("c", { score: "3" as unknown as JsonValue }),
      row("d", { score: NaN }),
      row("e", { score: null }),
      row("f", { score: 0 })
    ];
    const summary = buildDashboardNumericSummary({ items, metric: SCORE });
    expect(summary.finiteCount).toBe(3);
    expect(summary.skippedCount).toBe(3);
    expect(summary.sum).toBe(5);
    expect(summary.average).toBeCloseTo(5 / 3);
    expect(summary.min).toBe(-5);
    expect(summary.max).toBe(10);
  });

  it("date: valid/missing/invalid + earliest/latest; no overdue", () => {
    const items = [
      row("a", { due: "2026-09-10" }),
      row("b", { due: "2026-09-01" }),
      row("c", { due: "" }),
      row("d", { due: "09/18/2026" }),
      row("e", { due: null })
    ];
    const summary = buildDashboardDateSummary({
      items,
      dateProperty: DUE
    });
    expect(summary.validCount).toBe(2);
    expect(summary.missingCount).toBe(2);
    expect(summary.invalidCount).toBe(1);
    expect(summary.earliest).toBe("2026-09-01");
    expect(summary.latest).toBe("2026-09-10");
    expect(JSON.stringify(summary)).not.toMatch(/overdue/i);
  });

  it("selectors resolve by opaque id; rename survives; removal fallback", () => {
    const opaqueStatus = typed({
      id: "workflow/status",
      name: "Status",
      type: "status",
      options: STATUS.options
    });
    const defs = [TITLE, opaqueStatus, SCORE, DUE];
    expect(
      resolveDashboardCategoricalProperty(defs, "workflow/status")?.id
    ).toBe("workflow/status");
    expect(resolveDashboardNumericProperty(defs, null)?.id).toBe("score");
    expect(resolveDashboardDateProperty(defs, null)?.id).toBe("due");
    // Removal fallback
    expect(
      resolveDashboardCategoricalProperty([TITLE, SCORE], "workflow/status")
    ).toBeNull();
    expect(listDashboardNumericProperties(defs).map((d) => d.id)).toEqual([
      "score"
    ]);
    expect(listDashboardDateProperties(defs).map((d) => d.id)).toEqual([
      "due"
    ]);
  });
});

describe("4F-4E — DashboardRenderer", () => {
  it("renders overview + categorical/numeric/date; partial notice; no row-open", async () => {
    const provider = createMapDashProvider(SEED_ROWS, { pageSize: 2 });
    const store = await readyStore(provider, 2);
    const snap = store.getView("tasks::main");
    expect(snap.pagination.hasMore).toBe(true);
    expect(snap.items.length).toBe(2);
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });

    const opens: DatabaseRowOpenRequest[] = [];
    const mounted = await mount(
      DashboardRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewType: "dashboard",
        runtime: {
          store,
          database: provider,
          onOpenRow: (req) => opens.push(req)
        }
      })
    );

    expect(mounted.host.querySelector("[data-oe-dashboard]")).toBeTruthy();
    expect(
      mounted.host
        .querySelector("[data-oe-dashboard-loaded-rows]")
        ?.textContent
    ).toBe("2");
    expect(mounted.host.textContent).toMatch(
      /Showing loaded rows only — metrics do not represent full database/i
    );
    expect(mounted.host.textContent).not.toMatch(/overdue|completion|recent/i);

    // Selectors present; changing categorical does not call provider
    const listBefore = provider.listCalls;
    const catSelect = mounted.host.querySelector(
      'select[aria-label="Dashboard categorical property"]'
    ) as HTMLSelectElement;
    await changeSelect(catSelect, "priority");
    expect(provider.listCalls).toBe(listBefore);
    expect(provider.updateCalls).toBe(0);

    // Aggregates are not clickable row targets
    expect(
      mounted.host.querySelectorAll("button[aria-label^='Open row']")
    ).toHaveLength(0);
    expect(opens).toHaveLength(0);

    await mounted.cleanup();
  });

  it("duplicate Dashboard blocks keep independent selector state", async () => {
    const provider = createMapDashProvider(SEED_ROWS);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });

    const a = await mount(
      DashboardRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewType: "dashboard",
        viewId: "dash-a",
        title: "Dash A",
        runtime: { store, database: provider }
      })
    );
    const b = await mount(
      DashboardRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewType: "dashboard",
        viewId: "dash-b",
        title: "Dash B",
        runtime: { store, database: provider }
      })
    );

    const selectA = a.host.querySelector(
      'select[aria-label="Dashboard categorical property"]'
    ) as HTMLSelectElement;
    const selectB = b.host.querySelector(
      'select[aria-label="Dashboard categorical property"]'
    ) as HTMLSelectElement;
    expect(selectA.value).toBe("status");
    expect(selectB.value).toBe("status");
    await changeSelect(selectA, "priority");
    expect(selectA.value).toBe("priority");
    expect(selectB.value).toBe("status");

    await a.cleanup();
    await b.cleanup();
  });

  it("custom dashboard renderer with useState is hooks-safe", async () => {
    function Hooked(ctx: DatabaseViewRendererContext): ReactElement {
      const [ticks, setTicks] = useState(0);
      useEffect(() => {
        setTicks((n) => n + 1);
      }, [ctx.title]);
      return createElement("div", {
        "data-custom-dashboard": "",
        "data-ticks": String(ticks)
      });
    }

    const provider = createMapDashProvider([SEED_ROWS[0]!]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });

    const mounted = await mount(
      Hooked,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewType: "dashboard",
        title: "D1",
        runtime: {
          store,
          database: provider,
          renderers: { dashboard: Hooked }
        }
      })
    );
    await vi.waitFor(() => {
      expect(
        mounted.host
          .querySelector("[data-custom-dashboard]")
          ?.getAttribute("data-ticks")
      ).toBe("1");
    });
    await mounted.rerender(
      Hooked,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewType: "dashboard",
        title: "D2",
        runtime: {
          store,
          database: provider,
          renderers: { dashboard: Hooked }
        }
      })
    );
    await vi.waitFor(() => {
      expect(
        mounted.host
          .querySelector("[data-custom-dashboard]")
          ?.getAttribute("data-ticks")
      ).toBe("2");
    });
    await mounted.cleanup();
  });
});

describe("4F-4E — EditorDocument identity-only", () => {
  it("serialize keeps view identity only — no locations / metrics / resolveMapLocation", () => {
    const doc = createEditorDocument([
      {
        id: "db-map",
        type: "databaseView",
        props: {
          databaseId: "tasks",
          viewId: "main-map",
          viewType: "map",
          titleHint: "Map"
        }
      },
      {
        id: "db-dashboard",
        type: "databaseView",
        props: {
          databaseId: "tasks",
          viewId: "main-dashboard",
          viewType: "dashboard",
          titleHint: "Dashboard"
        }
      }
    ]);
    const serialized = serializeEditorDocument(doc);
    expect(serialized).toContain('"viewType":"map"');
    expect(serialized).toContain('"viewType":"dashboard"');
    expect(serialized).not.toContain("resolveMapLocation");
    expect(serialized).not.toContain("latitude");
    expect(serialized).not.toContain("longitude");
    expect(serialized).not.toContain('"items"');
    expect(serialized).not.toContain("aggregation");
  });
});

describe("4F-4E — TS consumer: additive resolveMapLocation", () => {
  it("legacy Gallery/Feed runtime still assignable; Map additive", () => {
    type LegacyGalleryRequest = {
      databaseId: string;
      rowKey: string;
      row: Readonly<Record<string, JsonValue>>;
      viewId: string;
      viewType: "gallery";
    };
    const legacyGallery = (
      request: LegacyGalleryRequest
    ): { src: string } | null => {
      void request;
      return null;
    };
    const runtime: DatabaseViewRuntime = {
      resolveRowMedia: legacyGallery,
      resolveMapLocation: (request) => {
        const _vt: "map" = request.viewType;
        void _vt;
        return { latitude: 0, longitude: 0 };
      }
    };
    expect(runtime.resolveRowMedia).toBe(legacyGallery);
    expect(runtime.resolveMapLocation).toBeTypeOf("function");
  });

  it("buildMapRowPresentations preserves provider order", () => {
    const items = [
      row("z", { title: "Z" }),
      row("a", { title: "A" }),
      row("m", { title: "M" })
    ];
    const presentations = buildMapRowPresentations({
      items,
      databaseId: "tasks",
      viewId: "main",
      runtime: {
        resolveMapLocation: (req) =>
          req.rowKey === "a"
            ? { latitude: 1, longitude: 1 }
            : null
      }
    });
    expect(presentations.map((p) => p.item.rowKey)).toEqual(["z", "a", "m"]);
    expect(presentations.map((p) => p.status.kind)).toEqual([
      "no-location",
      "located",
      "no-location"
    ]);
    expect(resolveDatabaseRowTitle(items[0]!, [TITLE])).toBe("Z");
  });
});

// —— 4F-4E R1: unknown viewType fail-closed (no silent → table) ——

describe("4F-4E R1 — unknown viewType must not become table", () => {
  async function mountShell(input: {
    viewType: string;
    provider: ReturnType<typeof createMapDashProvider>;
    store: Awaited<ReturnType<typeof readyStore>>;
  }) {
    const { viewType, provider, store } = input;
    const snap = store.getView("tasks::main");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        createElement(SharedDatabaseViewShell, {
          snap,
          store,
          viewKey: "tasks::main",
          viewId: "main",
          viewType,
          titleHint: "Tasks",
          runtime: { store, database: provider }
        })
      );
    });
    return {
      host,
      async cleanup() {
        await act(async () => {
          root.unmount();
        });
        host.remove();
      }
    };
  }

  it("future-view shows unsupported state — Table renderer NOT used; no mutation UI", async () => {
    const provider = createMapDashProvider(SEED_ROWS);
    const store = await readyStore(provider);
    const listBefore = provider.listCalls;
    const updateBefore = provider.updateCalls;

    const mounted = await mountShell({
      viewType: "future-view",
      provider,
      store
    });

    expect(
      mounted.host.querySelector("[data-oe-unsupported-view-type]")
    ).toBeTruthy();
    const status = mounted.host.querySelector('[role="status"]');
    expect(status?.textContent).toMatch(/Unsupported database view type/i);
    expect(status?.textContent).toContain("future-view");
    expect(
      mounted.host
        .querySelector("[data-view-type]")
        ?.getAttribute("data-view-type")
    ).toBe("future-view");

    // No fabricated Table semantics
    expect(mounted.host.querySelector(".oe-database-view__table")).toBeNull();
    expect(mounted.host.querySelector("[data-oe-map]")).toBeNull();
    expect(mounted.host.querySelector("[data-oe-dashboard]")).toBeNull();
    expect(
      mounted.host.querySelector('button[aria-label^="Edit "]')
    ).toBeNull();
    expect(mounted.host.textContent).not.toMatch(/\bNew row\b/);

    // No additional provider semantic churn from unsupported paint
    expect(provider.updateCalls).toBe(updateBefore);
    expect(provider.createCalls).toBe(0);
    expect(provider.reorderCalls).toBe(0);
    expect(provider.listCalls).toBe(listBefore);

    await mounted.cleanup();
  });

  it("kanban-v2 is also unsupported (not coerced to table)", async () => {
    const provider = createMapDashProvider([SEED_ROWS[0]!]);
    const store = await readyStore(provider);
    const mounted = await mountShell({
      viewType: "kanban-v2",
      provider,
      store
    });
    expect(
      mounted.host.querySelector("[data-oe-unsupported-view-type]")
    ).toBeTruthy();
    expect(mounted.host.textContent).toContain("kanban-v2");
    expect(mounted.host.querySelector(".oe-database-view__table")).toBeNull();
    await mounted.cleanup();
  });

  it("all 11 DATABASE_VIEW_TYPES remain supported (not unsupported)", async () => {
    expect(DATABASE_VIEW_TYPES).toHaveLength(11);
    for (const vt of DATABASE_VIEW_TYPES) {
      expect(isDatabaseViewType(vt)).toBe(true);
      expect(isDeferredDatabaseViewType(vt)).toBe(false);
    }
    expect(isDatabaseViewType("future-view")).toBe(false);
    expect(isDatabaseViewType("kanban-v2")).toBe(false);

    const provider = createMapDashProvider(SEED_ROWS);
    const store = await readyStore(provider);

    const tableMount = await mountShell({
      viewType: "table",
      provider,
      store
    });
    expect(
      tableMount.host.querySelector("[data-oe-unsupported-view-type]")
    ).toBeNull();
    expect(
      tableMount.host.querySelector(".oe-database-view__table")
    ).toBeTruthy();
    await tableMount.cleanup();

    const mapMount = await mountShell({
      viewType: "map",
      provider,
      store
    });
    expect(
      mapMount.host.querySelector("[data-oe-unsupported-view-type]")
    ).toBeNull();
    expect(mapMount.host.querySelector("[data-oe-map]")).toBeTruthy();
    await mapMount.cleanup();

    const dashMount = await mountShell({
      viewType: "dashboard",
      provider,
      store
    });
    expect(
      dashMount.host.querySelector("[data-oe-unsupported-view-type]")
    ).toBeNull();
    expect(dashMount.host.querySelector("[data-oe-dashboard]")).toBeTruthy();
    await dashMount.cleanup();

    const defaults: DatabaseViewRendererMap = {
      board: renderBoardView,
      calendar: renderCalendarView,
      list: renderListView,
      gallery: renderGalleryView,
      feed: renderFeedView,
      timeline: renderTimelineView,
      gantt: renderGanttView,
      chart: renderChartView,
      map: renderMapView,
      dashboard: renderDashboardView
    };
    for (const vt of DATABASE_VIEW_TYPES) {
      if (vt === "table") continue;
      expect(
        resolveDatabaseViewRenderer({
          viewType: vt,
          runtime: {},
          defaults
        })
      ).not.toBeNull();
    }
    expect(
      resolveDatabaseViewRenderer({
        viewType: "future-view",
        runtime: {},
        defaults
      })
    ).toBeNull();
  });
});
