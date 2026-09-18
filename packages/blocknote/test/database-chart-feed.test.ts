/**
 * @vitest-environment jsdom
 *
 * Phase 4F-4D — Chart + Feed models, renderers, media compat, dispatch.
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
  buildCategoricalChart,
  buildNumericChart,
  categoryKeyEncode,
  isChartMetricProperty,
  listChartMetricProperties,
  resolveChartMetricProperty
} from "../src/workspace/databaseChartModel.js";
import {
  ChartRenderer,
  renderChartView
} from "../src/workspace/databaseChartRenderer.js";
import {
  buildFeedItemPresentation,
  formatFeedDateMeta,
  listFeedDateProperties,
  resolveFeedDateProperty
} from "../src/workspace/databaseFeedModel.js";
import {
  FeedRenderer,
  renderFeedView
} from "../src/workspace/databaseFeedRenderer.js";
import {
  GalleryRenderer,
  renderGalleryView
} from "../src/workspace/databaseGalleryRenderer.js";
import {
  cloneDatabaseRowRecord,
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
  DatabaseFeedRowMediaRequest,
  DatabaseRowMedia,
  DatabaseViewRuntime
} from "../src/workspace/databaseViewRuntime.js";

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
const SUMMARY = typed({ id: "summary", name: "Summary", type: "text" });
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
const START = typed({ id: "start", name: "Start", type: "date" });
const DONE = typed({ id: "done", name: "Done", type: "boolean" });
const URL = typed({ id: "url", name: "URL", type: "url" });
const META = typed({ id: "meta", name: "Meta", type: "unknown" });

const DEFAULT_RENDERERS: DatabaseViewRendererMap = {
  chart: renderChartView,
  feed: renderFeedView,
  gallery: renderGalleryView
};

const DEFAULT_DEFINITIONS: DatabasePropertyDefinition[] = [
  { id: "title", name: "Title", type: "text" },
  { id: "summary", name: "Summary", type: "text" },
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

function createChartFeedProvider(
  seed: MemRow[],
  options?: {
    pageSize?: number;
    definitions?: readonly DatabasePropertyDefinition[];
    onList?: (opts?: DatabaseListOptions) => void;
    onGetDatabase?: () => void;
    onReorder?: () => void;
    onUpdate?: () => void;
    onCreate?: () => void;
    onDelete?: () => void;
    onRestore?: () => void;
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
      createCalls += 1;
      options?.onCreate?.();
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
      const hit = rows.find((r) => r.rowKey === rowKey);
      if (!hit) throw new Error("missing");
      hit.row = { ...data };
      return { ok: true };
    },
    async deleteRow() {
      deleteCalls += 1;
      options?.onDelete?.();
      return { ok: true };
    },
    async restoreRow() {
      restoreCalls += 1;
      options?.onRestore?.();
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
    viewType: "chart",
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
      summary: "First task",
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
      summary: "Second task",
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
      summary: "Third task",
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

// —— Renderer dispatch ——

describe("4F-4D — resolveDatabaseViewRenderer", () => {
  it("dispatches chart → ChartRenderer and feed → FeedRenderer", () => {
    expect(
      resolveDatabaseViewRenderer({
        viewType: "chart",
        runtime: {},
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(renderChartView);
    expect(
      resolveDatabaseViewRenderer({
        viewType: "feed",
        runtime: {},
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(renderFeedView);
  });

  it("deferred is ONLY map|dashboard — chart/feed/gallery are not deferred", () => {
    expect(isDeferredDatabaseViewType("map")).toBe(true);
    expect(isDeferredDatabaseViewType("dashboard")).toBe(true);
    expect(isDeferredDatabaseViewType("chart")).toBe(false);
    expect(isDeferredDatabaseViewType("feed")).toBe(false);
    expect(isDeferredDatabaseViewType("gallery")).toBe(false);
    expect(isDeferredDatabaseViewType("list")).toBe(false);
  });

  it("uses custom chart/feed overrides from runtime", () => {
    const customChart: DatabaseViewRenderer = () =>
      createElement("div", { "data-custom-chart": "" });
    const customFeed: DatabaseViewRenderer = () =>
      createElement("div", { "data-custom-feed": "" });
    expect(
      resolveDatabaseViewRenderer({
        viewType: "chart",
        runtime: { renderers: { chart: customChart } },
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(customChart);
    expect(
      resolveDatabaseViewRenderer({
        viewType: "feed",
        runtime: { renderers: { feed: customFeed } },
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(customFeed);
  });
});

// —— Chart model ——

describe("4F-4D — chart model eligibility & selection", () => {
  it("status/select eligible; number eligible; text/url/date/boolean/unknown NOT", () => {
    expect(isChartMetricProperty(STATUS)).toBe(true);
    expect(isChartMetricProperty(PRIORITY)).toBe(true);
    expect(isChartMetricProperty(SCORE)).toBe(true);
    expect(isChartMetricProperty(TITLE)).toBe(false);
    expect(isChartMetricProperty(URL)).toBe(false);
    expect(isChartMetricProperty(DUE)).toBe(false);
    expect(isChartMetricProperty(DONE)).toBe(false);
    expect(isChartMetricProperty(META)).toBe(false);
    expect(
      listChartMetricProperties([
        TITLE,
        URL,
        DUE,
        DONE,
        META,
        STATUS,
        PRIORITY,
        SCORE
      ]).map((d) => d.id)
    ).toEqual(["status", "priority", "score"]);
  });

  it("first eligible is default; selection by opaque ID", () => {
    const metricScore = typed({ id: "metric:score", name: "Score", type: "number" });
    const workflowStatus = typed({
      id: "workflow/status",
      name: "Workflow",
      type: "status",
      options: [{ value: "open", label: "Open" }]
    });
    const defs = [TITLE, metricScore, workflowStatus];
    expect(resolveChartMetricProperty(defs, null)?.id).toBe("metric:score");
    expect(resolveChartMetricProperty(defs, "workflow/status")?.id).toBe(
      "workflow/status"
    );
    expect(resolveChartMetricProperty(defs, "metric:score")?.id).toBe(
      "metric:score"
    );
  });

  it("rename preserves selection by id; removal falls back; no eligible → null", () => {
    const scoreRenamed = typed({
      id: "score",
      name: "Points",
      type: "number"
    });
    expect(
      resolveChartMetricProperty([TITLE, scoreRenamed, STATUS], "score")?.name
    ).toBe("Points");
    expect(
      resolveChartMetricProperty([TITLE, STATUS], "score")?.id
    ).toBe("status");
    expect(resolveChartMetricProperty([TITLE, DUE, DONE], "score")).toBeNull();
    expect(resolveChartMetricProperty([TITLE, DUE], null)).toBeNull();
  });
});

describe("4F-4D — categorical chart buckets", () => {
  it("configured option ordering; duplicate option values deduped (first wins)", () => {
    const metric = typed({
      id: "status",
      name: "Status",
      type: "status",
      options: [
        { value: "todo", label: "Backlog" },
        { value: "doing", label: "Doing" },
        { value: "todo", label: "Duplicate Todo" },
        { value: "done", label: "Done" }
      ]
    });
    const { buckets } = buildCategoricalChart({
      items: [
        row("a", { status: "todo" }),
        row("b", { status: "doing" }),
        row("c", { status: "done" })
      ],
      metric
    });
    const valueBuckets = buckets.filter((b) => b.key.kind === "value");
    expect(valueBuckets.map((b) => (b.key.kind === "value" ? b.key.value : ""))).toEqual([
      "todo",
      "doing",
      "done"
    ]);
    expect(valueBuckets[0]!.label).toBe("Backlog");
  });

  it("unknown observed raw value preserved (legacy-state)", () => {
    const { buckets } = buildCategoricalChart({
      items: [
        row("a", { status: "todo" }),
        row("b", { status: "legacy-state" })
      ],
      metric: STATUS
    });
    const legacy = buckets.find(
      (b) => b.key.kind === "value" && b.key.value === "legacy-state"
    );
    expect(legacy).toEqual({
      key: { kind: "value", value: "legacy-state" },
      label: "legacy-state",
      count: 1
    });
    const configuredOrder = buckets
      .filter((b) => b.key.kind === "value")
      .map((b) => (b.key.kind === "value" ? b.key.value : ""));
    expect(configuredOrder).toEqual(["todo", "doing", "done", "legacy-state"]);
  });

  it("option label/value separation (value=doing, label=In progress)", () => {
    const { buckets } = buildCategoricalChart({
      items: [row("a", { status: "doing" }), row("b", { status: "doing" })],
      metric: STATUS
    });
    const doing = buckets.find(
      (b) => b.key.kind === "value" && b.key.value === "doing"
    );
    expect(doing?.label).toBe("In progress");
    expect(doing?.count).toBe(2);
  });

  it("empty bucket for null/undefined/\"\"; Invalid for non-string", () => {
    const { buckets } = buildCategoricalChart({
      items: [
        row("e1", { status: null }),
        row("e2", { status: "" }),
        row("e3", {}),
        row("i1", { status: 3 as unknown as JsonValue }),
        row("i2", { status: true as unknown as JsonValue }),
        row("i3", { status: { x: 1 } as unknown as JsonValue }),
        row("v", { status: "todo" })
      ],
      metric: STATUS
    });
    const empty = buckets.find((b) => b.key.kind === "empty");
    const invalid = buckets.find((b) => b.key.kind === "invalid");
    expect(empty).toEqual({ key: { kind: "empty" }, label: "Empty", count: 3 });
    expect(invalid).toEqual({
      key: { kind: "invalid" },
      label: "Invalid",
      count: 3
    });
  });

  it("sentinel-like host values remain ordinary value categories", () => {
    const { buckets } = buildCategoricalChart({
      items: [
        row("a", { status: "__empty__" }),
        row("b", { status: "__invalid__" }),
        row("c", { status: "a:b:c" })
      ],
      metric: STATUS
    });
    expect(buckets.some((b) => b.key.kind === "empty")).toBe(false);
    expect(buckets.some((b) => b.key.kind === "invalid")).toBe(false);
    const values = buckets
      .filter((b) => b.key.kind === "value")
      .map((b) => (b.key.kind === "value" ? b.key.value : ""));
    expect(values).toContain("__empty__");
    expect(values).toContain("__invalid__");
    expect(values).toContain("a:b:c");
    expect(categoryKeyEncode({ kind: "value", value: "__empty__" })).toBe(
      `v:${JSON.stringify("__empty__")}`
    );
    expect(categoryKeyEncode({ kind: "empty" })).toBe("empty");
  });

  it("counts loaded rows only (partial page)", () => {
    const loaded = [
      row("a", { status: "todo" }),
      row("b", { status: "todo" })
    ];
    const { buckets } = buildCategoricalChart({ items: loaded, metric: STATUS });
    const todo = buckets.find(
      (b) => b.key.kind === "value" && b.key.value === "todo"
    );
    expect(todo?.count).toBe(2);
    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(2);
  });
});

describe("4F-4D — numeric chart", () => {
  it("provider order preserved; domains; missing excluded; string not coerced; finite geometry", () => {
    const items = [
      row("p", { score: 10 }),
      row("n", { score: -5 }),
      row("z", { score: 0 }),
      row("missing", {}),
      row("str", { score: "5" as unknown as JsonValue }),
      row("nan", { score: Number.NaN }),
      row("inf", { score: Number.POSITIVE_INFINITY }),
      row("large", { score: 1e12 })
    ];
    const chart = buildNumericChart({ items, metric: SCORE });
    expect(chart.entries.map((e) => e.item.rowKey)).toEqual([
      "p",
      "n",
      "z",
      "large"
    ]);
    expect(chart.skippedCount).toBe(4);
    expect(chart.domainMin).toBeLessThanOrEqual(-5);
    expect(chart.domainMax).toBeGreaterThanOrEqual(10);
    for (const entry of chart.entries) {
      expect(Number.isFinite(entry.leftPercent)).toBe(true);
      expect(Number.isFinite(entry.widthPercent)).toBe(true);
      expect(Number.isNaN(entry.leftPercent)).toBe(false);
      expect(Number.isNaN(entry.widthPercent)).toBe(false);
    }
  });

  it("positive/negative/zero/mixed domain; all-zero", () => {
    const positive = buildNumericChart({
      items: [row("a", { score: 3 }), row("b", { score: 7 })],
      metric: SCORE
    });
    expect(positive.domainMin).toBe(0);
    expect(positive.domainMax).toBe(7);
    expect(positive.entries.every((e) => e.direction !== "negative")).toBe(true);

    const negative = buildNumericChart({
      items: [row("a", { score: -3 }), row("b", { score: -7 })],
      metric: SCORE
    });
    expect(negative.domainMin).toBe(-7);
    expect(negative.domainMax).toBe(0);

    const mixed = buildNumericChart({
      items: [row("a", { score: -2 }), row("b", { score: 4 }), row("c", { score: 0 })],
      metric: SCORE
    });
    expect(mixed.domainMin).toBe(-2);
    expect(mixed.domainMax).toBe(4);
    expect(mixed.entries.find((e) => e.item.rowKey === "c")?.direction).toBe(
      "zero"
    );

    const allZero = buildNumericChart({
      items: [row("a", { score: 0 }), row("b", { score: 0 })],
      metric: SCORE
    });
    expect(allZero.entries).toHaveLength(2);
    for (const entry of allZero.entries) {
      expect(entry.direction).toBe("zero");
      expect(Number.isFinite(entry.leftPercent)).toBe(true);
      expect(Number.isFinite(entry.widthPercent)).toBe(true);
    }
  });
});

// —— Chart renderer ——

describe("4F-4D — ChartRenderer", () => {
  it("renders categorical + numeric bars; metric selector ephemeral", async () => {
    const provider = createChartFeedProvider(SEED_ROWS);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { host, cleanup } = await mount(
      ChartRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "chart"
      })
    );
    expect(host.querySelector("[data-oe-chart]")).toBeTruthy();
    const metricSelect = host.querySelector(
      'select[aria-label="Chart metric property"]'
    ) as HTMLSelectElement;
    expect(metricSelect).toBeTruthy();
    // First eligible in DEFAULT_DEFINITIONS is status (categorical).
    expect(metricSelect.value).toBe("status");
    expect(host.querySelector(".oe-database-chart__categories")).toBeTruthy();
    expect(host.textContent).toContain("In progress");

    await changeSelect(metricSelect, "score");
    expect(host.querySelector(".oe-database-chart__numeric-rows")).toBeTruthy();
    expect(host.querySelectorAll(".oe-database-chart__numeric-row").length).toBe(
      3
    );
    await cleanup();
  });

  it("partial notice and no-eligible explanation", async () => {
    const partial = createChartFeedProvider(SEED_ROWS, { pageSize: 2 });
    const store = await readyStore(partial, 2);
    const snap = store.getView("tasks::main");
    expect(snap.pagination.hasMore).toBe(true);
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const mounted = await mount(
      ChartRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: partial },
        viewType: "chart"
      })
    );
    expect(mounted.host.querySelector(".oe-database-view__notice")?.textContent).toMatch(
      /Showing loaded rows only/i
    );
    await mounted.cleanup();

    const noMetricProvider = createChartFeedProvider(
      [
        {
          rowKey: "a",
          sortOrder: 0,
          deletedAt: null,
          row: { title: "Only text", summary: "x" }
        }
      ],
      {
        definitions: [
          { id: "title", name: "Title", type: "text" },
          { id: "summary", name: "Summary", type: "text" }
        ]
      }
    );
    const noMetricStore = await readyStore(noMetricProvider);
    const noSnap = noMetricStore.getView("tasks::main");
    const noDefs = resolveDatabasePropertyDefinitions({
      legacySchema: noSnap.schema,
      definitions: noSnap.meta?.propertyDefinitions
    });
    const emptyMount = await mount(
      ChartRenderer,
      buildContext({
        snapshot: noSnap,
        store: noMetricStore,
        definitions: noDefs,
        runtime: { store: noMetricStore, database: noMetricProvider },
        viewType: "chart"
      })
    );
    expect(emptyMount.host.textContent).toMatch(
      /Add a number, select, or status property to use Chart/i
    );
    await emptyMount.cleanup();
  });

  it("numeric row-open exact; categorical does not invent row-open; zero mutations", async () => {
    const onOpenRow = vi.fn();
    const provider = createChartFeedProvider(SEED_ROWS);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const createSpy = vi.spyOn(provider, "createRow");
    const updateSpy = vi.spyOn(provider, "updateRow");
    const deleteSpy = vi.spyOn(provider, "deleteRow");
    const restoreSpy = vi.spyOn(provider, "restoreRow");
    const reorderSpy = vi.spyOn(provider, "reorderRows");
    const listAtReady = provider.listCalls;
    const getAtReady = provider.getDatabaseCalls;

    const { host, cleanup } = await mount(
      ChartRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewId: "main-chart",
        runtime: { store, database: provider, onOpenRow },
        viewType: "chart"
      })
    );

    // Categorical default — bars must not invent open.
    const categoryBars = host.querySelectorAll(".oe-database-chart__category");
    expect(categoryBars.length).toBeGreaterThan(0);
    await act(async () => {
      (categoryBars[0] as HTMLElement).click();
    });
    expect(onOpenRow).not.toHaveBeenCalled();

    const metricSelect = host.querySelector(
      'select[aria-label="Chart metric property"]'
    ) as HTMLSelectElement;
    await changeSelect(metricSelect, "score");

    const openBtn = host.querySelector(
      ".oe-database-chart__numeric-title"
    ) as HTMLButtonElement | null;
    expect(openBtn).toBeTruthy();
    await act(async () => {
      openBtn!.click();
    });
    expect(onOpenRow).toHaveBeenCalledTimes(1);
    expect(onOpenRow).toHaveBeenCalledWith({
      databaseId: "tasks",
      rowKey: "a",
      viewId: "main-chart",
      viewType: "chart"
    } satisfies DatabaseRowOpenRequest);

    expect(createSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(restoreSpy).not.toHaveBeenCalled();
    expect(reorderSpy).not.toHaveBeenCalled();
    expect(provider.createCalls).toBe(0);
    expect(provider.updateCalls).toBe(0);
    expect(provider.deleteCalls).toBe(0);
    expect(provider.restoreCalls).toBe(0);
    expect(provider.reorderCalls).toBe(0);
    // After load, changing metric causes 0 listRows/getDatabase.
    expect(provider.listCalls).toBe(listAtReady);
    expect(provider.getDatabaseCalls).toBe(getAtReady);
    await cleanup();
  });

  it("opaque rowKey not in HTML id; data-row-key exact", async () => {
    const opaqueKey = 'chart"><script>a b:c/d';
    const provider = createChartFeedProvider([
      {
        rowKey: opaqueKey,
        sortOrder: 0,
        deletedAt: null,
        row: {
          title: "Opaque",
          summary: "S",
          status: "todo",
          priority: "p1",
          score: 4,
          due: "2026-09-01",
          done: false
        }
      }
    ]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { host, cleanup } = await mount(
      ChartRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "chart"
      })
    );
    const metricSelect = host.querySelector(
      'select[aria-label="Chart metric property"]'
    ) as HTMLSelectElement;
    await changeSelect(metricSelect, "score");
    for (const id of Array.from(host.querySelectorAll("[id]")).map((el) => el.id)) {
      expect(id.includes(opaqueKey)).toBe(false);
    }
    expect(
      host
        .querySelector(".oe-database-chart__numeric-row")
        ?.getAttribute("data-row-key")
    ).toBe(opaqueKey);
    await cleanup();
  });

  it("custom Chart with hooks mounts; switch Chart → Feed → Chart safely", async () => {
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
    const customChart = makeHooked("chart");
    const provider = createChartFeedProvider([SEED_ROWS[0]!]);
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
        renderers: { chart: customChart, feed: renderFeedView }
      },
      viewType: "chart",
      title: "Chart A"
    });
    const mounted = await mount(customChart, baseCtx);
    expect(mounted.host.querySelector("[data-custom-chart]")).toBeTruthy();
    await vi.waitFor(() => {
      expect(
        mounted.host
          .querySelector("[data-custom-chart]")
          ?.getAttribute("data-ticks")
      ).toBe("1");
    });

    await mounted.rerender(
      FeedRenderer,
      buildContext({
        ...baseCtx,
        viewType: "feed",
        title: "Feed B",
        runtime: { store, database: provider }
      })
    );
    expect(mounted.host.querySelector("[data-oe-feed]")).toBeTruthy();
    expect(mounted.host.querySelector("[data-custom-chart]")).toBeNull();

    await mounted.rerender(
      ChartRenderer,
      buildContext({
        ...baseCtx,
        viewType: "chart",
        title: "Chart C",
        runtime: { store, database: provider }
      })
    );
    expect(mounted.host.querySelector("[data-oe-chart]")).toBeTruthy();
    await mounted.cleanup();
  });
});

// —— Feed model ——

describe("4F-4D — feed model", () => {
  it("title/secondary via buildFeedItemPresentation; 4-field preview cap; excludes title/secondary/date", () => {
    const defs = [
      TITLE,
      SUMMARY,
      STATUS,
      PRIORITY,
      SCORE,
      DUE,
      DONE,
      typed({ id: "extra1", name: "E1", type: "text" }),
      typed({ id: "extra2", name: "E2", type: "text" })
    ];
    const item = row("p1", {
      title: "Packed",
      summary: "Secondary line",
      status: "todo",
      priority: "p1",
      score: 3,
      due: "2026-09-01",
      done: true,
      extra1: "one",
      extra2: "two"
    });
    const presentation = buildFeedItemPresentation(item, defs, "due");
    expect(presentation.title).toBe("Packed");
    expect(presentation.secondaryText).toBe("Secondary line");
    expect(presentation.previewFields.length).toBeLessThanOrEqual(4);
    const ids = presentation.previewFields.map((f) => f.def.id);
    expect(ids).not.toContain("title");
    expect(ids).not.toContain("summary");
    expect(ids).not.toContain("due");
  });

  it("date selection by opaque ID; rename preserves; removal fallback", () => {
    const opaqueDue = typed({ id: "schedule/due", name: "Due", type: "date" });
    const defs = [TITLE, opaqueDue, START];
    expect(resolveFeedDateProperty(defs, null)?.id).toBe("schedule/due");
    expect(resolveFeedDateProperty(defs, "schedule/due")?.id).toBe(
      "schedule/due"
    );
    const renamed = typed({
      id: "schedule/due",
      name: "Deadline",
      type: "date"
    });
    expect(
      resolveFeedDateProperty([TITLE, renamed, START], "schedule/due")?.name
    ).toBe("Deadline");
    expect(
      resolveFeedDateProperty([TITLE, START], "schedule/due")?.id
    ).toBe("start");
    expect(listFeedDateProperties([TITLE, DONE, SCORE])).toEqual([]);
  });

  it("formatFeedDateMeta: missing / invalid / valid YYYY-MM-DD", () => {
    expect(formatFeedDateMeta(null)).toEqual({
      kind: "missing",
      text: "No date"
    });
    expect(formatFeedDateMeta(undefined)).toEqual({
      kind: "missing",
      text: "No date"
    });
    expect(formatFeedDateMeta("")).toEqual({
      kind: "missing",
      text: "No date"
    });
    expect(formatFeedDateMeta("not-a-date")).toEqual({
      kind: "invalid",
      text: "Invalid date"
    });
    expect(formatFeedDateMeta("2026-09-18")).toEqual({
      kind: "valid",
      text: "2026-09-18"
    });
  });
});

// —— Feed renderer ——

describe("4F-4D — FeedRenderer", () => {
  it("every loaded item once; provider order exact; date does not sort", async () => {
    const provider = createChartFeedProvider([
      {
        rowKey: "late",
        sortOrder: 0,
        deletedAt: null,
        row: {
          title: "Late",
          summary: "S",
          status: "todo",
          priority: "p1",
          score: 1,
          due: "2026-12-01",
          done: false
        }
      },
      {
        rowKey: "early",
        sortOrder: 1,
        deletedAt: null,
        row: {
          title: "Early",
          summary: "S",
          status: "todo",
          priority: "p1",
          score: 1,
          due: "2026-01-01",
          done: false
        }
      },
      {
        rowKey: "mid",
        sortOrder: 2,
        deletedAt: null,
        row: {
          title: "Mid",
          summary: "S",
          status: "todo",
          priority: "p1",
          score: 1,
          due: "2026-06-01",
          done: false
        }
      }
    ]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { host, cleanup } = await mount(
      FeedRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "feed"
      })
    );
    const items = Array.from(
      host.querySelectorAll(".oe-database-feed__item")
    ) as HTMLElement[];
    expect(items.map((el) => el.getAttribute("data-row-key"))).toEqual([
      "late",
      "early",
      "mid"
    ]);
    expect(host.textContent).toContain("Late");
    expect(host.textContent).toContain("Early");
    expect(host.textContent).toContain("Mid");
    await cleanup();
  });

  it("date formats; partial notice; row-open feed; no callback no throw; zero mutations", async () => {
    const onOpenRow = vi.fn();
    const provider = createChartFeedProvider(
      [
        {
          rowKey: "valid",
          sortOrder: 0,
          deletedAt: null,
          row: {
            title: "Valid",
            summary: "S",
            status: "todo",
            priority: "p1",
            score: 1,
            due: "2026-09-18",
            done: false,
            start: ""
          }
        },
        {
          rowKey: "missing",
          sortOrder: 1,
          deletedAt: null,
          row: {
            title: "Missing",
            summary: "S",
            status: "todo",
            priority: "p1",
            score: 1,
            due: "",
            done: false,
            start: "2026-01-02"
          }
        },
        {
          rowKey: "invalid",
          sortOrder: 2,
          deletedAt: null,
          row: {
            title: "Invalid",
            summary: "S",
            status: "todo",
            priority: "p1",
            score: 1,
            due: "nope",
            done: false,
            start: "2026-01-03"
          }
        }
      ],
      {
        pageSize: 2,
        definitions: [
          ...DEFAULT_DEFINITIONS,
          { id: "start", name: "Start", type: "date" }
        ]
      }
    );
    const store = await readyStore(provider, 2);
    const snap = store.getView("tasks::main");
    expect(snap.pagination.hasMore).toBe(true);
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const listAtReady = provider.listCalls;
    const getAtReady = provider.getDatabaseCalls;
    const updateSpy = vi.spyOn(provider, "updateRow");
    const reorderSpy = vi.spyOn(provider, "reorderRows");
    const createSpy = vi.spyOn(provider, "createRow");
    const deleteSpy = vi.spyOn(provider, "deleteRow");
    const restoreSpy = vi.spyOn(provider, "restoreRow");

    const { host, cleanup } = await mount(
      FeedRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewId: "main-feed",
        runtime: { store, database: provider, onOpenRow },
        viewType: "feed"
      })
    );
    expect(host.querySelector(".oe-database-view__notice")?.textContent).toMatch(
      /Showing loaded rows only/i
    );
    expect(host.textContent).toContain("2026-09-18");
    expect(host.textContent).toContain("No date");

    const openBtn = host.querySelector(
      ".oe-database-feed__title"
    ) as HTMLButtonElement | null;
    expect(openBtn).toBeTruthy();
    await act(async () => {
      openBtn!.click();
    });
    expect(onOpenRow).toHaveBeenCalledWith({
      databaseId: "tasks",
      rowKey: "valid",
      viewId: "main-feed",
      viewType: "feed"
    } satisfies DatabaseRowOpenRequest);

    const dateSelect = host.querySelector(
      'select[aria-label="Feed date property"]'
    ) as HTMLSelectElement;
    expect(dateSelect).toBeTruthy();
    await changeSelect(dateSelect, "start");
    expect(provider.listCalls).toBe(listAtReady);
    expect(provider.getDatabaseCalls).toBe(getAtReady);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(reorderSpy).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(restoreSpy).not.toHaveBeenCalled();
    await cleanup();

    // no callback → no throw
    const noCb = await mount(
      FeedRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "feed"
      })
    );
    const titleBtn = noCb.host.querySelector(".oe-database-feed__title");
    // Without onOpenRow, title is an h4, not a button.
    expect(titleBtn?.tagName.toLowerCase()).toBe("h4");
    await noCb.cleanup();
  });

  it("opaque rowKey safe; no raw rowKey HTML id", async () => {
    const opaqueKey = 'feed"><img src=x onerror=1> a:b';
    const provider = createChartFeedProvider([
      {
        rowKey: opaqueKey,
        sortOrder: 0,
        deletedAt: null,
        row: {
          title: "Opaque Feed",
          summary: "Secondary",
          status: "todo",
          priority: "p1",
          score: 1,
          due: "2026-09-01",
          done: false
        }
      }
    ]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { host, cleanup } = await mount(
      FeedRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "feed"
      })
    );
    for (const id of Array.from(host.querySelectorAll("[id]")).map((el) => el.id)) {
      expect(id.includes(opaqueKey)).toBe(false);
    }
    expect(
      host.querySelector(".oe-database-feed__item")?.getAttribute("data-row-key")
    ).toBe(opaqueKey);
    await cleanup();
  });

  it("media: resolveFeedRowMedia viewType===feed; Gallery resolveRowMedia remains gallery", async () => {
    const opaqueKey = 'gal"><script>';
    const seen: DatabaseFeedRowMediaRequest[] = [];
    const provider = createChartFeedProvider([
      {
        rowKey: opaqueKey,
        sortOrder: 0,
        deletedAt: null,
        row: {
          title: "Opaque",
          summary: "S",
          status: "todo",
          priority: "p1",
          score: 1,
          due: "",
          done: false
        }
      },
      {
        rowKey: "img",
        sortOrder: 1,
        deletedAt: null,
        row: {
          title: "Has Image",
          summary: "S",
          status: "todo",
          priority: "p1",
          score: 1,
          due: "",
          done: false
        }
      },
      {
        rowKey: "empty",
        sortOrder: 2,
        deletedAt: null,
        row: {
          title: "Empty Src",
          summary: "S",
          status: "todo",
          priority: "p1",
          score: 1,
          due: "",
          done: false
        }
      },
      {
        rowKey: "nullish",
        sortOrder: 3,
        deletedAt: null,
        row: {
          title: "Null Media",
          summary: "S",
          status: "todo",
          priority: "p1",
          score: 1,
          due: "",
          done: false
        }
      },
      {
        rowKey: "throw",
        sortOrder: 4,
        deletedAt: null,
        row: {
          title: "Throws",
          summary: "S",
          status: "todo",
          priority: "p1",
          score: 1,
          due: "",
          done: false
        }
      }
    ]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const resolveFeedRowMedia = (
      request: DatabaseFeedRowMediaRequest
    ): DatabaseRowMedia | null => {
      seen.push(request);
      if (request.rowKey === "throw") throw new Error("resolver failed");
      if (request.rowKey === "nullish") return null;
      if (request.rowKey === "empty") return { src: "" };
      if (request.rowKey === "img") {
        return { src: "data:image/svg+xml,%3Csvg/%3E" };
      }
      if (request.rowKey === opaqueKey) {
        return { src: "data:image/svg+xml,%3Csvg/%3E", alt: "Custom alt" };
      }
      return undefined as unknown as null;
    };

    const feed = await mount(
      FeedRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewId: "main-feed",
        viewType: "feed",
        runtime: { store, database: provider, resolveFeedRowMedia }
      })
    );
    expect(seen.every((r) => r.viewType === "feed")).toBe(true);
    const opaqueCard = Array.from(
      feed.host.querySelectorAll(".oe-database-feed__item")
    ).find((el) => el.getAttribute("data-row-key") === opaqueKey);
    expect(opaqueCard?.querySelector("img")?.getAttribute("alt")).toBe(
      "Custom alt"
    );
    expect(
      feed.host.querySelector('[data-row-key="img"] img')?.getAttribute("alt")
    ).toBe("Has Image");
    for (const key of ["empty", "nullish", "throw"]) {
      const card = feed.host.querySelector(`[data-row-key="${key}"]`);
      expect(
        card?.querySelector(".oe-database-feed__media--placeholder")
      ).toBeTruthy();
      expect(card?.querySelector("img")).toBeNull();
    }
    expect(feed.host.textContent).toContain("Throws");
    await feed.cleanup();

    // Gallery still uses resolveRowMedia with viewType "gallery" only.
    const gallerySeen: Array<"gallery"> = [];
    const gallery = await mount(
      GalleryRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewId: "main-gallery",
        viewType: "gallery",
        runtime: {
          store,
          database: provider,
          resolveRowMedia: (request) => {
            gallerySeen.push(request.viewType);
            return { src: "data:image/svg+xml,%3Csvg/%3E" };
          }
        }
      })
    );
    expect(gallerySeen.length).toBeGreaterThan(0);
    expect(gallerySeen.every((v) => v === "gallery")).toBe(true);
    await gallery.cleanup();
  });

  it("host mutates request.row → RuntimeStore + provider unchanged, updateRow 0", async () => {
    const nested: Record<string, JsonValue> = {
      deep: { label: "keep" }
    };
    const provider = createChartFeedProvider([
      {
        rowKey: "a",
        sortOrder: 0,
        deletedAt: null,
        row: {
          title: "Alpha",
          summary: "First task",
          status: "todo",
          priority: "p1",
          score: 1,
          due: "2026-09-01",
          done: false,
          meta: nested
        }
      }
    ]);
    const updateSpy = vi.spyOn(provider, "updateRow");
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const storeRowBefore = snap.items[0]!.row;

    let seenRequestRow: Record<string, JsonValue> | undefined;
    const resolveFeedRowMedia = (
      request: Parameters<
        NonNullable<DatabaseViewRuntime["resolveFeedRowMedia"]>
      >[0]
    ): null => {
      seenRequestRow = request.row as Record<string, JsonValue>;
      (request.row as Record<string, JsonValue>).title = "MUTATED";
      const meta = request.row.meta as Record<string, JsonValue> | undefined;
      if (meta && typeof meta === "object" && !Array.isArray(meta)) {
        const deep = meta.deep as Record<string, JsonValue> | undefined;
        if (deep) deep.label = "MUTATED_NESTED";
      }
      return null;
    };

    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { cleanup } = await mount(
      FeedRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewType: "feed",
        runtime: { store, database: provider, resolveFeedRowMedia }
      })
    );

    expect(seenRequestRow).toBeTruthy();
    expect(seenRequestRow).not.toBe(store.getView("tasks::main").items[0]!.row);
    expect(cloneDatabaseRowRecord(storeRowBefore).title).toBe("Alpha");
    const after = store.getView("tasks::main");
    expect(after.items[0]!.row.title).toBe("Alpha");
    const afterMeta = after.items[0]!.row.meta as
      | { deep?: { label?: string } }
      | undefined;
    expect(afterMeta?.deep?.label).toBe("keep");
    expect(provider.rows[0]!.row.title).toBe("Alpha");
    expect(updateSpy).not.toHaveBeenCalled();
    expect(provider.updateCalls).toBe(0);
    await cleanup();
  });

  it("Runtime A vs B Feed media isolation", async () => {
    const provider = createChartFeedProvider([SEED_ROWS[0]!]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });

    const hostA = document.createElement("div");
    const hostB = document.createElement("div");
    document.body.appendChild(hostA);
    document.body.appendChild(hostB);
    const rootA = createRoot(hostA);
    const rootB = createRoot(hostB);

    const resolveA = vi.fn(
      (_request: DatabaseFeedRowMediaRequest): DatabaseRowMedia => ({
        src: "data:image/svg+xml,A",
        alt: "A"
      })
    );
    const resolveB = vi.fn(
      (_request: DatabaseFeedRowMediaRequest): DatabaseRowMedia => ({
        src: "data:image/svg+xml,B",
        alt: "B"
      })
    );

    await act(async () => {
      rootA.render(
        createElement(
          FeedRenderer,
          buildContext({
            snapshot: snap,
            store,
            definitions,
            viewType: "feed",
            runtime: {
              store,
              database: provider,
              resolveFeedRowMedia: resolveA
            }
          })
        )
      );
      rootB.render(
        createElement(
          FeedRenderer,
          buildContext({
            snapshot: snap,
            store,
            definitions,
            viewType: "feed",
            runtime: {
              store,
              database: provider,
              resolveFeedRowMedia: resolveB
            }
          })
        )
      );
    });

    expect(hostA.querySelector("img")?.getAttribute("alt")).toBe("A");
    expect(hostB.querySelector("img")?.getAttribute("alt")).toBe("B");
    expect(resolveA.mock.calls[0]?.[0]?.viewType).toBe("feed");
    expect(resolveB.mock.calls[0]?.[0]?.viewType).toBe("feed");

    await act(async () => {
      rootA.unmount();
      rootB.unmount();
    });
    hostA.remove();
    hostB.remove();
  });

  it("custom Feed hooks safety", async () => {
    function makeHooked(): DatabaseViewRenderer {
      return function Hooked(ctx: DatabaseViewRendererContext): ReactElement {
        const [ticks, setTicks] = useState(0);
        useEffect(() => {
          setTicks((n) => n + 1);
        }, [ctx.title]);
        return createElement("div", {
          "data-custom-feed": "",
          "data-ticks": String(ticks)
        });
      };
    }
    const customFeed = makeHooked();
    const provider = createChartFeedProvider([SEED_ROWS[0]!]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const mounted = await mount(
      customFeed,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewType: "feed",
        title: "Feed A",
        runtime: {
          store,
          database: provider,
          renderers: { feed: customFeed }
        }
      })
    );
    await vi.waitFor(() => {
      expect(
        mounted.host
          .querySelector("[data-custom-feed]")
          ?.getAttribute("data-ticks")
      ).toBe("1");
    });
    await mounted.rerender(
      customFeed,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewType: "feed",
        title: "Feed B",
        runtime: { store, database: provider, renderers: { feed: customFeed } }
      })
    );
    await vi.waitFor(() => {
      expect(
        mounted.host
          .querySelector("[data-custom-feed]")
          ?.getAttribute("data-ticks")
      ).toBe("2");
    });
    await mounted.cleanup();
  });
});

// —— EditorDocument ——

describe("4F-4D — EditorDocument identity-only", () => {
  it("serialize keeps view identity only — no metric/aggregation/media", () => {
    const doc = createEditorDocument([
      {
        id: "db-chart",
        type: "databaseView",
        props: {
          databaseId: "tasks",
          viewId: "main-chart",
          viewType: "chart",
          titleHint: "Chart"
        }
      },
      {
        id: "db-feed",
        type: "databaseView",
        props: {
          databaseId: "tasks",
          viewId: "main-feed",
          viewType: "feed",
          titleHint: "Feed"
        }
      }
    ]);
    const serialized = serializeEditorDocument(doc);
    expect(serialized).toContain('"viewType":"chart"');
    expect(serialized).toContain('"viewType":"feed"');
    expect(serialized).toContain('"viewId":"main-chart"');
    expect(serialized).toContain('"viewId":"main-feed"');
    expect(serialized).not.toContain('"items"');
    expect(serialized).not.toContain("metric");
    expect(serialized).not.toContain("aggregation");
    expect(serialized).not.toContain("resolveRowMedia");
    expect(serialized).not.toContain("resolveFeedRowMedia");
    expect(serialized).not.toContain("data:image");
  });
});

// —— 4F-4D R1 media API: Gallery contract preserved; Feed additive ——

describe("4F-4D R1 — Gallery resolveRowMedia + additive resolveFeedRowMedia", () => {
  it("safeResolveRowMedia is Gallery-only; Feed uses safeResolveFeedRowMedia", () => {
    const gallerySeen: Array<"gallery"> = [];
    const feedSeen: Array<"feed"> = [];
    const runtime: DatabaseViewRuntime = {
      resolveRowMedia: (request) => {
        gallerySeen.push(request.viewType);
        return { src: "https://example.test/gallery.png" };
      },
      resolveFeedRowMedia: (request) => {
        feedSeen.push(request.viewType);
        return { src: "https://example.test/feed.png" };
      }
    };
    const base = {
      databaseId: "tasks",
      rowKey: "a",
      row: { title: "A" },
      viewId: "main"
    };
    expect(
      safeResolveRowMedia(runtime, { ...base, viewType: "gallery" })?.src
    ).toBe("https://example.test/gallery.png");
    expect(
      safeResolveFeedRowMedia(runtime, { ...base, viewType: "feed" })?.src
    ).toBe("https://example.test/feed.png");
    // Gallery resolver must not be invoked for Feed.
    expect(gallerySeen).toEqual(["gallery"]);
    expect(feedSeen).toEqual(["feed"]);
  });

  it("legacy Gallery-only callback parameter remains assignable to DatabaseViewRuntime", () => {
    type LegacyGalleryRequest = {
      databaseId: string;
      rowKey: string;
      row: Readonly<Record<string, JsonValue>>;
      viewId: string;
      viewType: "gallery";
    };
    const legacyGalleryResolver = (
      request: LegacyGalleryRequest
    ): DatabaseRowMedia | null => {
      void request;
      return null;
    };
    const runtime: DatabaseViewRuntime = {
      resolveRowMedia: legacyGalleryResolver
    };
    expect(runtime.resolveRowMedia).toBe(legacyGalleryResolver);
  });
});
