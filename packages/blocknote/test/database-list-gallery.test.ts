/**
 * @vitest-environment jsdom
 *
 * Phase 4F-4B — List + Gallery renderers, media resolver, secondary text.
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
  buildDatabaseRowPresentation,
  cloneDatabaseRowRecord,
  resolveDatabaseRowSecondaryText,
  resolveDatabaseRowTitle,
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
import {
  GalleryRenderer,
  renderGalleryView
} from "../src/workspace/databaseGalleryRenderer.js";
import {
  ListRenderer,
  renderListView
} from "../src/workspace/databaseListRenderer.js";
import type {
  DatabaseRowMedia,
  DatabaseRowMediaRequest,
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
const NOTES = typed({ id: "notes", name: "Notes", type: "text" });
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
const DUE = typed({ id: "due", name: "Due", type: "date" });
const DONE = typed({ id: "done", name: "Done", type: "boolean" });
const META = typed({ id: "meta", name: "Meta", type: "unknown" });

const DEFAULT_RENDERERS: DatabaseViewRendererMap = {
  list: renderListView,
  gallery: renderGalleryView
};

type MemRow = {
  rowKey: string;
  sortOrder: number;
  deletedAt: string | null;
  row: Record<string, JsonValue>;
};

function createListGalleryProvider(
  seed: MemRow[],
  options?: {
    pageSize?: number;
    definitions?: readonly DatabasePropertyDefinition[];
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
} {
  const rows = seed.map((r) => ({ ...r, row: { ...r.row } }));
  let listCalls = 0;
  let getDatabaseCalls = 0;
  let reorderCalls = 0;
  let updateCalls = 0;
  const definitions = [
    ...(options?.definitions ?? [
      { id: "title", name: "Title", type: "text" as const },
      { id: "summary", name: "Summary", type: "text" as const },
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
      { id: "due", name: "Due", type: "date" as const },
      { id: "done", name: "Done", type: "boolean" as const }
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
    viewType: "list",
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
      due: "2026-09-18",
      done: true
    }
  }
];

// —— Renderer dispatch ——

describe("4F-4B — resolveDatabaseViewRenderer", () => {
  it("dispatches list → ListRenderer and gallery → GalleryRenderer", () => {
    expect(
      resolveDatabaseViewRenderer({
        viewType: "list",
        runtime: {},
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(renderListView);
    expect(
      resolveDatabaseViewRenderer({
        viewType: "gallery",
        runtime: {},
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(renderGalleryView);
  });

  it("timeline and gantt are not deferred", () => {
    expect(isDeferredDatabaseViewType("timeline")).toBe(false);
    expect(isDeferredDatabaseViewType("gantt")).toBe(false);
    expect(isDeferredDatabaseViewType("list")).toBe(false);
    expect(isDeferredDatabaseViewType("gallery")).toBe(false);
  });

  it("uses custom list/gallery overrides from runtime", () => {
    const customList: DatabaseViewRenderer = () =>
      createElement("div", { "data-custom-list": "" });
    const customGallery: DatabaseViewRenderer = () =>
      createElement("div", { "data-custom-gallery": "" });
    expect(
      resolveDatabaseViewRenderer({
        viewType: "list",
        runtime: { renderers: { list: customList } },
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(customList);
    expect(
      resolveDatabaseViewRenderer({
        viewType: "gallery",
        runtime: { renderers: { gallery: customGallery } },
        defaults: DEFAULT_RENDERERS
      })
    ).toBe(customGallery);
  });
});

// —— Secondary text helpers ——

describe("4F-4B — resolveDatabaseRowSecondaryText", () => {
  it("returns first non-title text string; skips title and non-text", () => {
    expect(
      resolveDatabaseRowSecondaryText(
        row("r1", {
          title: "Named",
          summary: "  Hello secondary  ",
          status: "todo"
        }),
        [TITLE, SUMMARY, STATUS]
      )
    ).toBe("Hello secondary");
  });

  it("skips empty / non-string text values and never JSON-dumps objects", () => {
    expect(
      resolveDatabaseRowSecondaryText(
        row("r2", {
          title: "Named",
          summary: "",
          notes: "   ",
          meta: { nested: true } as unknown as JsonValue
        }),
        [TITLE, SUMMARY, NOTES, META]
      )
    ).toBeUndefined();
    expect(
      resolveDatabaseRowSecondaryText(
        row("r3", { title: "Only", status: "todo" }),
        [TITLE, STATUS]
      )
    ).toBeUndefined();
  });

  it("excludes the title-source property when title falls back to first text", () => {
    const name = typed({ id: "name", name: "Name", type: "text" });
    const blurb = typed({ id: "blurb", name: "Blurb", type: "text" });
    const item = row("r4", { name: "N", blurb: "B" });
    expect(resolveDatabaseRowTitle(item, [name, blurb])).toBe("N");
    // R1: secondary must not reuse the same property that supplied the title.
    expect(resolveDatabaseRowSecondaryText(item, [name, blurb])).toBe("B");
    const presentation = buildDatabaseRowPresentation(item, [name, blurb]);
    expect(presentation).toEqual({
      title: "N",
      secondaryText: "B",
      previewFields: []
    });
  });

  it("buildDatabaseRowPresentation caps preview and excludes secondary field", () => {
    const defs = [
      TITLE,
      SUMMARY,
      STATUS,
      PRIORITY,
      DUE,
      DONE,
      typed({ id: "extra1", name: "E1", type: "text" }),
      typed({ id: "extra2", name: "E2", type: "text" }),
      typed({ id: "extra3", name: "E3", type: "text" }),
      typed({ id: "extra4", name: "E4", type: "text" })
    ];
    const item = row("p1", {
      title: "Packed",
      summary: "Secondary line",
      status: "todo",
      priority: "p1",
      due: "2026-09-01",
      done: true,
      extra1: "one",
      extra2: "two",
      extra3: "three",
      extra4: "four"
    });
    const presentation = buildDatabaseRowPresentation(item, defs, {
      maxPreviewFields: 5
    });
    expect(presentation.title).toBe("Packed");
    expect(presentation.secondaryText).toBe("Secondary line");
    expect(presentation.previewFields.length).toBeLessThanOrEqual(5);
    expect(
      presentation.previewFields.every((f) => f.def.id !== "summary")
    ).toBe(true);
    expect(
      presentation.previewFields.every((f) => f.def.id !== "title")
    ).toBe(true);
  });
});

describe("4F-4B — safeResolveRowMedia", () => {
  it("returns null for missing resolver, null, undefined, empty src, and throws", () => {
    const request = {
      databaseId: "tasks",
      rowKey: "a",
      row: { title: "A" },
      viewId: "main-gallery",
      viewType: "gallery" as const
    };
    expect(safeResolveRowMedia({}, request)).toBeNull();
    expect(
      safeResolveRowMedia({ resolveRowMedia: () => null }, request)
    ).toBeNull();
    expect(
      safeResolveRowMedia({ resolveRowMedia: () => undefined }, request)
    ).toBeNull();
    expect(
      safeResolveRowMedia(
        { resolveRowMedia: () => ({ src: "   " }) },
        request
      )
    ).toBeNull();
    expect(
      safeResolveRowMedia(
        {
          resolveRowMedia: () => {
            throw new Error("boom");
          }
        },
        request
      )
    ).toBeNull();
  });

  it("returns trimmed src and optional alt", () => {
    const media = safeResolveRowMedia(
      {
        resolveRowMedia: () => ({
          src: "  https://example.test/x.png  ",
          alt: "Cover"
        })
      },
      {
        databaseId: "tasks",
        rowKey: "a",
        row: {},
        viewId: "g",
        viewType: "gallery"
      }
    );
    expect(media).toEqual({ src: "https://example.test/x.png", alt: "Cover" });
  });
});

// —— List renderer ——

describe("4F-4B — ListRenderer", () => {
  it("renders order, title, secondary, opaque rowKey, and preview cap", async () => {
    const opaqueKey = 'row"><img src=x onerror=1>';
    const provider = createListGalleryProvider([
      {
        rowKey: opaqueKey,
        sortOrder: 0,
        deletedAt: null,
        row: {
          title: "Opaque",
          summary: "Secondary opaque",
          status: "todo",
          due: "2026-09-01",
          done: false,
          extra: "x"
        }
      },
      ...SEED_ROWS
    ], {
      definitions: [
        { id: "title", name: "Title", type: "text" },
        { id: "summary", name: "Summary", type: "text" },
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
        { id: "due", name: "Due", type: "date" },
        { id: "done", name: "Done", type: "boolean" },
        { id: "priority", name: "Priority", type: "select", options: [{ value: "p1", label: "High" }] },
        { id: "notes", name: "Notes", type: "text" },
        { id: "extra", name: "Extra", type: "text" }
      ]
    });
    // Enrich first opaque row with more chip fields via seed already; use SEED for order.
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { host, cleanup } = await mount(
      ListRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "list"
      })
    );
    expect(host.querySelector("[data-oe-list]")).toBeTruthy();
    const rowEls = Array.from(
      host.querySelectorAll(".oe-database-list__row")
    ) as HTMLElement[];
    expect(rowEls.map((el) => el.getAttribute("data-row-key"))).toEqual([
      opaqueKey,
      "a",
      "b",
      "c"
    ]);
    expect(host.textContent).toContain("Opaque");
    expect(host.textContent).toContain("Secondary opaque");
    expect(host.textContent).toContain("Alpha");
    expect(host.textContent).toContain("First task");
    // No completion checkbox heuristic.
    expect(host.querySelector('input[type="checkbox"]')).toBeNull();
    const firstChips = rowEls[0]!.querySelectorAll(".oe-database-list__chip");
    expect(firstChips.length).toBeLessThanOrEqual(5);
    await cleanup();
  });

  it("onOpenRow click fires exact request; no reorderRows / updateRow", async () => {
    const onOpenRow = vi.fn();
    const onReorder = vi.fn();
    const onUpdate = vi.fn();
    const provider = createListGalleryProvider(SEED_ROWS, {
      onReorder,
      onUpdate
    });
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const listCallsAtReady = provider.listCalls;
    const getDbAtReady = provider.getDatabaseCalls;
    const reorderSpy = vi.spyOn(provider, "reorderRows");
    const updateSpy = vi.spyOn(provider, "updateRow");
    const { host, cleanup } = await mount(
      ListRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewId: "main-list",
        runtime: { store, database: provider, onOpenRow },
        viewType: "list"
      })
    );
    const openBtn = host.querySelector(
      ".oe-database-list__row-title"
    ) as HTMLButtonElement | null;
    expect(openBtn).toBeTruthy();
    await act(async () => {
      openBtn!.click();
    });
    expect(onOpenRow).toHaveBeenCalledTimes(1);
    expect(onOpenRow).toHaveBeenCalledWith({
      databaseId: "tasks",
      rowKey: "a",
      viewId: "main-list",
      viewType: "list"
    } satisfies DatabaseRowOpenRequest);
    expect(reorderSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(provider.reorderCalls).toBe(0);
    expect(provider.updateCalls).toBe(0);
    expect(onReorder).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
    // Render + open do not refetch.
    expect(provider.listCalls).toBe(listCallsAtReady);
    expect(provider.getDatabaseCalls).toBe(getDbAtReady);
    await cleanup();
  });

  it("shows partial hasMore notice", async () => {
    const provider = createListGalleryProvider(SEED_ROWS, { pageSize: 2 });
    const store = await readyStore(provider, 2);
    const snap = store.getView("tasks::main");
    expect(snap.pagination.hasMore).toBe(true);
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const { host, cleanup } = await mount(
      ListRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        runtime: { store, database: provider },
        viewType: "list"
      })
    );
    const notice = host.querySelector(".oe-database-view__notice");
    expect(notice?.textContent).toMatch(/Showing loaded rows only/i);
    expect(host.querySelectorAll(".oe-database-list__row")).toHaveLength(2);
    await cleanup();
  });
});

// —— Gallery renderer ——

describe("4F-4B — GalleryRenderer", () => {
  it("renders media, placeholders, alt fallback, opaque rowKey to resolver", async () => {
    const opaqueKey = 'gal"><script>';
    const seenKeys: string[] = [];
    const provider = createListGalleryProvider([
      {
        rowKey: opaqueKey,
        sortOrder: 0,
        deletedAt: null,
        row: { title: "Opaque Gal", summary: "S", status: "todo", due: "", done: false }
      },
      {
        rowKey: "img",
        sortOrder: 1,
        deletedAt: null,
        row: { title: "Has Image", summary: "S", status: "todo", due: "", done: false }
      },
      {
        rowKey: "empty",
        sortOrder: 2,
        deletedAt: null,
        row: { title: "Empty Src", summary: "S", status: "todo", due: "", done: false }
      },
      {
        rowKey: "nullish",
        sortOrder: 3,
        deletedAt: null,
        row: { title: "Null Media", summary: "S", status: "todo", due: "", done: false }
      },
      {
        rowKey: "throw",
        sortOrder: 4,
        deletedAt: null,
        row: { title: "Throws", summary: "S", status: "todo", due: "", done: false }
      }
    ]);
    const store = await readyStore(provider);
    const snap = store.getView("tasks::main");
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const resolveRowMedia = (
      request: Parameters<NonNullable<DatabaseViewRuntime["resolveRowMedia"]>>[0]
    ): DatabaseRowMedia | null => {
      seenKeys.push(request.rowKey);
      if (request.rowKey === "throw") throw new Error("resolver failed");
      if (request.rowKey === "nullish") return null;
      if (request.rowKey === "empty") return { src: "" };
      if (request.rowKey === "img") {
        return { src: "data:image/svg+xml,%3Csvg/%3E" };
      }
      if (request.rowKey === opaqueKey) {
        return {
          src: "data:image/svg+xml,%3Csvg/%3E",
          alt: "Custom alt"
        };
      }
      return null;
    };
    const { host, cleanup } = await mount(
      GalleryRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewId: "main-gallery",
        viewType: "gallery",
        runtime: { store, database: provider, resolveRowMedia }
      })
    );
    expect(host.querySelector("[data-oe-gallery]")).toBeTruthy();
    expect(seenKeys).toContain(opaqueKey);
    expect(seenKeys).toEqual(
      expect.arrayContaining([opaqueKey, "img", "empty", "nullish", "throw"])
    );

    const opaqueCard = Array.from(
      host.querySelectorAll(".oe-database-gallery__card")
    ).find((el) => el.getAttribute("data-row-key") === opaqueKey);
    expect(opaqueCard?.querySelector("img")?.getAttribute("alt")).toBe(
      "Custom alt"
    );

    const imgCard = host.querySelector('[data-row-key="img"]');
    expect(imgCard?.querySelector("img")).toBeTruthy();
    // No alt from resolver → falls back to card title.
    expect(imgCard?.querySelector("img")?.getAttribute("alt")).toBe(
      "Has Image"
    );

    for (const key of ["empty", "nullish", "throw"]) {
      const card = host.querySelector(`[data-row-key="${key}"]`);
      expect(
        card?.querySelector(".oe-database-gallery__media--placeholder")
      ).toBeTruthy();
      expect(card?.querySelector("img")).toBeNull();
    }
    // Throw isolated — other cards still render.
    expect(host.querySelector('[data-row-key="img"] img')).toBeTruthy();
    expect(host.textContent).toContain("Throws");
    await cleanup();
  });

  it("onOpenRow gallery; no reorderRows; partial notice", async () => {
    const onOpenRow = vi.fn();
    const provider = createListGalleryProvider(SEED_ROWS, { pageSize: 2 });
    const store = await readyStore(provider, 2);
    const snap = store.getView("tasks::main");
    expect(snap.pagination.hasMore).toBe(true);
    const definitions = resolveDatabasePropertyDefinitions({
      legacySchema: snap.schema,
      definitions: snap.meta?.propertyDefinitions
    });
    const reorderSpy = vi.spyOn(provider, "reorderRows");
    const listCallsAtReady = provider.listCalls;
    const { host, cleanup } = await mount(
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
          onOpenRow,
          resolveRowMedia: () => ({
            src: "data:image/svg+xml,%3Csvg/%3E",
            alt: "x"
          })
        }
      })
    );
    expect(
      host.querySelector(".oe-database-view__notice")?.textContent
    ).toMatch(/Showing loaded rows only/i);
    const openBtn = host.querySelector(
      ".oe-database-gallery__card-title"
    ) as HTMLButtonElement | null;
    expect(openBtn).toBeTruthy();
    await act(async () => {
      openBtn!.click();
    });
    expect(onOpenRow).toHaveBeenCalledWith({
      databaseId: "tasks",
      rowKey: "a",
      viewId: "main-gallery",
      viewType: "gallery"
    });
    expect(reorderSpy).not.toHaveBeenCalled();
    expect(provider.listCalls).toBe(listCallsAtReady);
    await cleanup();
  });
});

// —— Runtime isolation ——

describe("4F-4B — resolveRowMedia runtime isolation", () => {
  it("Runtime A vs B resolveRowMedia do not leak", async () => {
    const provider = createListGalleryProvider([SEED_ROWS[0]!]);
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
      (_request: DatabaseRowMediaRequest): DatabaseRowMedia => ({
        src: "data:image/svg+xml,A",
        alt: "A"
      })
    );
    const resolveB = vi.fn(
      (_request: DatabaseRowMediaRequest): DatabaseRowMedia => ({
        src: "data:image/svg+xml,B",
        alt: "B"
      })
    );

    const ctxA = buildContext({
      snapshot: snap,
      store,
      definitions,
      viewType: "gallery",
      runtime: { store, database: provider, resolveRowMedia: resolveA }
    });
    const ctxB = buildContext({
      snapshot: snap,
      store,
      definitions,
      viewType: "gallery",
      runtime: { store, database: provider, resolveRowMedia: resolveB }
    });

    await act(async () => {
      rootA.render(createElement(GalleryRenderer, ctxA));
      rootB.render(createElement(GalleryRenderer, ctxB));
    });

    expect(hostA.querySelector("img")?.getAttribute("alt")).toBe("A");
    expect(hostB.querySelector("img")?.getAttribute("alt")).toBe("B");
    expect(resolveA).toHaveBeenCalled();
    expect(resolveB).toHaveBeenCalled();
    expect(resolveA.mock.calls[0]?.[0]?.rowKey).toBe("a");
    expect(resolveB.mock.calls[0]?.[0]?.rowKey).toBe("a");

    await act(async () => {
      rootA.unmount();
      rootB.unmount();
    });
    hostA.remove();
    hostB.remove();
  });
});

// —— Custom hooks R1 ——

describe("4F-4B — custom List/Gallery hooks mount/rerender/switch", () => {
  it("custom List/Gallery with useState mount, rerender, switch safely", async () => {
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

    const customList = makeHooked("list");
    const customGallery = makeHooked("gallery");
    const provider = createListGalleryProvider([SEED_ROWS[0]!]);
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
        renderers: { list: customList, gallery: customGallery }
      },
      viewType: "list",
      title: "List A"
    });

    const mounted = await mount(customList, baseCtx);
    expect(mounted.host.querySelector("[data-custom-list]")).toBeTruthy();
    await vi.waitFor(() => {
      expect(
        mounted.host
          .querySelector("[data-custom-list]")
          ?.getAttribute("data-ticks")
      ).toBe("1");
    });

    await mounted.rerender(customList, { ...baseCtx, title: "List A v2" });
    await vi.waitFor(() => {
      expect(
        mounted.host
          .querySelector("[data-custom-list]")
          ?.getAttribute("data-ticks")
      ).toBe("2");
    });

    await mounted.rerender(
      customGallery,
      buildContext({
        ...baseCtx,
        viewType: "gallery",
        title: "Gallery B",
        runtime: {
          store,
          database: provider,
          renderers: { gallery: customGallery }
        }
      })
    );
    expect(mounted.host.querySelector("[data-custom-gallery]")).toBeTruthy();
    expect(mounted.host.querySelector("[data-custom-list]")).toBeNull();

    await mounted.rerender(
      ListRenderer,
      buildContext({
        ...baseCtx,
        viewType: "list",
        runtime: { store, database: provider }
      })
    );
    expect(mounted.host.querySelector("[data-oe-list]")).toBeTruthy();

    await mounted.rerender(
      GalleryRenderer,
      buildContext({
        ...baseCtx,
        viewType: "gallery",
        runtime: { store, database: provider }
      })
    );
    expect(mounted.host.querySelector("[data-oe-gallery]")).toBeTruthy();
    await mounted.cleanup();
  });
});

// —— EditorDocument ——

describe("4F-4B — EditorDocument identity-only (no media)", () => {
  it("serialize keeps view identity only — no media / items / resolveRowMedia", () => {
    const doc = createEditorDocument([
      {
        id: "db-list",
        type: "databaseView",
        props: {
          databaseId: "tasks",
          viewId: "main-list",
          viewType: "list",
          titleHint: "List"
        }
      },
      {
        id: "db-gallery",
        type: "databaseView",
        props: {
          databaseId: "tasks",
          viewId: "main-gallery",
          viewType: "gallery",
          titleHint: "Gallery"
        }
      }
    ]);
    const serialized = serializeEditorDocument(doc);
    expect(serialized).toContain('"viewType":"list"');
    expect(serialized).toContain('"viewType":"gallery"');
    expect(serialized).toContain('"viewId":"main-list"');
    expect(serialized).toContain('"viewId":"main-gallery"');
    expect(serialized).not.toContain('"items"');
    expect(serialized).not.toContain("resolveRowMedia");
    expect(serialized).not.toContain("data:image");
    expect(serialized).not.toContain('"src"');
    expect(serialized).not.toContain("secondaryText");
  });
});

// —— 4F-4B R1 ——

describe("4F-4B R1 — media row isolation / title-secondary / opaque HTML ids", () => {
  it("P1-1: resolveRowMedia cannot mutate RuntimeStore or provider rows", async () => {
    const nested: Record<string, JsonValue> = {
      deep: { label: "keep" }
    };
    const provider = createListGalleryProvider([
      {
        rowKey: "a",
        sortOrder: 0,
        deletedAt: null,
        row: {
          title: "Alpha",
          summary: "First task",
          status: "todo",
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
    expect(storeRowBefore.title).toBe("Alpha");

    let seenRequestRow: Record<string, JsonValue> | undefined;
    const resolveRowMedia = (
      request: Parameters<
        NonNullable<DatabaseViewRuntime["resolveRowMedia"]>
      >[0]
    ): null => {
      seenRequestRow = request.row as Record<string, JsonValue>;
      // Hostile host: mutate request.row without going through provider.
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
      GalleryRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewType: "gallery",
        runtime: { store, database: provider, resolveRowMedia }
      })
    );

    expect(seenRequestRow).toBeTruthy();
    // Request row must be a defensive clone, not the live store object.
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

  it("P1-2: title fallback property is excluded from secondary and chips", () => {
    const name = typed({ id: "name", name: "Name", type: "text" });
    const blurb = typed({ id: "blurb", name: "Blurb", type: "text" });
    const status = typed({
      id: "status",
      name: "Status",
      type: "status",
      options: [{ value: "todo", label: "Backlog" }]
    });
    const item = row("x", { name: "N", blurb: "B", status: "todo" });
    const presentation = buildDatabaseRowPresentation(item, [
      name,
      blurb,
      status
    ]);
    expect(presentation.title).toBe("N");
    expect(presentation.secondaryText).toBe("B");
    expect(
      presentation.previewFields.map((f) => f.def.id)
    ).not.toContain("name");
    expect(
      presentation.previewFields.map((f) => f.def.id)
    ).not.toContain("blurb");
  });

  it("P1-3: List/Gallery do not put raw opaque rowKey into HTML id", async () => {
    const opaqueKey = 'a b:c/d"quoted"';
    const provider = createListGalleryProvider([
      {
        rowKey: opaqueKey,
        sortOrder: 0,
        deletedAt: null,
        row: {
          title: "Opaque Id",
          summary: "Secondary",
          status: "todo",
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

    const list = await mount(
      ListRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewType: "list",
        runtime: { store, database: provider }
      })
    );
    const listIds = Array.from(list.host.querySelectorAll("[id]")).map(
      (el) => el.id
    );
    for (const id of listIds) {
      expect(id.includes(opaqueKey)).toBe(false);
      expect(id).not.toMatch(/a b:c/);
    }
    expect(
      list.host
        .querySelector(".oe-database-list__row")
        ?.getAttribute("data-row-key")
    ).toBe(opaqueKey);
    await list.cleanup();

    const gallery = await mount(
      GalleryRenderer,
      buildContext({
        snapshot: snap,
        store,
        definitions,
        viewType: "gallery",
        runtime: { store, database: provider }
      })
    );
    const galleryIds = Array.from(gallery.host.querySelectorAll("[id]")).map(
      (el) => el.id
    );
    for (const id of galleryIds) {
      expect(id.includes(opaqueKey)).toBe(false);
      expect(id).not.toMatch(/a b:c/);
    }
    expect(
      gallery.host
        .querySelector(".oe-database-gallery__card")
        ?.getAttribute("data-row-key")
    ).toBe(opaqueKey);
    await gallery.cleanup();
  });
});
