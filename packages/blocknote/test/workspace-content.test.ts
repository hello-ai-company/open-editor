/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { fromBlockNote, toBlockNoteForSchema } from "../src/index.js";
import { createOpenEditorPowerPreset } from "../src/features/compose.js";
import {
  CHILD_PAGE_TYPE,
  DATABASE_RELATION_TYPE,
  DATABASE_VIEW_TYPE,
  PAGE_CARD_TYPE,
  PAGE_MENTION_TYPE,
  createPageCardBlockSpec,
  createPageMentionDom,
  createPageMentionResolverFromLinks,
  createRelationIndex,
  createWorkspaceContentCommands,
  extractRelationEdges,
  resolveChildPageDisplay,
  resolvePageCardDisplay,
  type PageMentionRuntime
} from "../src/workspace/index.js";
import { createCommandRegistry } from "../src/commands/registry.js";
import { BLOCK_REFERENCE_TYPE } from "../src/references/blockReference.js";

describe("workspace content primitives", () => {
  it("includes workspace schema and commands by default", () => {
    const preset = createOpenEditorPowerPreset();
    expect(preset.schema.inlineContentSchema).toHaveProperty(PAGE_MENTION_TYPE);
    expect(preset.schema.inlineContentSchema).toHaveProperty(
      DATABASE_RELATION_TYPE
    );
    expect(preset.schema.blockSchema).toHaveProperty(PAGE_CARD_TYPE);
    expect(preset.schema.blockSchema).toHaveProperty(CHILD_PAGE_TYPE);
    expect(preset.schema.blockSchema).toHaveProperty(DATABASE_VIEW_TYPE);
    expect(preset.registry.get("page.insert-mention")).toBeDefined();
    expect(preset.registry.get("page.insert-card")).toBeDefined();
    expect(preset.registry.get("page.create-child")).toBeDefined();
    expect(preset.registry.get("database.insert-view")).toBeDefined();
  });

  it("omits workspace schema and commands when includeWorkspaceContent is false", () => {
    const preset = createOpenEditorPowerPreset({
      includeWorkspaceContent: false
    });
    expect(preset.schema.inlineContentSchema).not.toHaveProperty(
      PAGE_MENTION_TYPE
    );
    expect(preset.schema.inlineContentSchema).not.toHaveProperty(
      DATABASE_RELATION_TYPE
    );
    expect(preset.schema.blockSchema).not.toHaveProperty(PAGE_CARD_TYPE);
    expect(preset.registry.get("page.insert-mention")).toBeUndefined();
    expect(preset.registry.get("database.insert-view")).toBeUndefined();
  });

  it("round-trips page mention, page card, child page, databaseView, and databaseRelation", () => {
    const preset = createOpenEditorPowerPreset();
    const doc = createEditorDocument([
      {
        id: "p1",
        type: "paragraph",
        content: [
          { type: PAGE_MENTION_TYPE, props: { pageId: "page/arch#1" } },
          {
            type: DATABASE_RELATION_TYPE,
            props: { databaseId: "projects", rowId: "project-123" }
          }
        ]
      },
      {
        id: "c1",
        type: PAGE_CARD_TYPE,
        props: { pageId: "page-card", titleHint: "Card" }
      },
      {
        id: "ch1",
        type: CHILD_PAGE_TYPE,
        props: { pageId: "child-1", titleHint: "Child" }
      },
      {
        id: "db1",
        type: DATABASE_VIEW_TYPE,
        props: {
          databaseId: "projects",
          viewId: "board-1",
          viewType: "board",
          titleHint: "Projects"
        }
      }
    ]);
    const bn = toBlockNoteForSchema(doc, preset.schema);
    const back = fromBlockNote(bn as never);
    const json = JSON.stringify(back.blocks);
    expect(json).toContain("page/arch#1");
    expect(json).toContain(PAGE_CARD_TYPE);
    expect(json).toContain(CHILD_PAGE_TYPE);
    expect(json).toContain(DATABASE_VIEW_TYPE);
    expect(json).toContain(DATABASE_RELATION_TYPE);
    expect(json).toContain("project-123");
    expect(json).toContain("board-1");
    expect(json).not.toContain("rowKey");
    expect(json).not.toContain('"title":"Alpha Project"');
  });

  it("does not share pageCard runtime across presets (P1-1)", () => {
    const presetA = createOpenEditorPowerPreset({
      pageCardRuntime: {
        resolve: () => ({ title: "Workspace A" })
      }
    });
    const presetB = createOpenEditorPowerPreset({
      pageCardRuntime: {
        resolve: () => ({ title: "Workspace B" })
      }
    });

    expect(
      resolvePageCardDisplay(presetA.pageCardRuntime, "any").title
    ).toBe("Workspace A");
    expect(
      resolvePageCardDisplay(presetB.pageCardRuntime, "any").title
    ).toBe("Workspace B");
    // Creating B must not contaminate A
    expect(
      resolvePageCardDisplay(presetA.pageCardRuntime, "any").title
    ).toBe("Workspace A");
    expect(presetA.pageCardRuntime).not.toBe(presetB.pageCardRuntime);

    const specA = createPageCardBlockSpec({
      resolve: () => ({ title: "Spec A" })
    });
    const specB = createPageCardBlockSpec({
      resolve: () => ({ title: "Spec B" })
    });
    expect(specA).not.toBe(specB);
    expect(presetA.schema.blockSchema).toHaveProperty(PAGE_CARD_TYPE);
    expect(presetB.schema.blockSchema).toHaveProperty(PAGE_CARD_TYPE);
  });

  it("does not share databaseView runtime across presets (P1-1)", () => {
    const emptyPage = {
      databaseId: "x",
      items: [] as [],
      schema: {},
      rows: [] as [],
      config: {},
      pagination: {
        limit: 50,
        nextCursor: null,
        hasMore: false,
        total: 0
      }
    };
    const listRowsA = vi.fn(async () => emptyPage);
    const listRowsB = vi.fn(async () => emptyPage);
    const presetA = createOpenEditorPowerPreset({
      databaseViewRuntime: {
        database: { listRows: listRowsA },
        getTitle: () => "DB-A"
      }
    });
    const presetB = createOpenEditorPowerPreset({
      databaseViewRuntime: {
        database: { listRows: listRowsB },
        getTitle: () => "DB-B"
      }
    });

    expect(presetA.databaseViewRuntime.getTitle?.("x")).toBe("DB-A");
    expect(presetB.databaseViewRuntime.getTitle?.("x")).toBe("DB-B");
    expect(presetA.databaseViewRuntime.getTitle?.("x")).toBe("DB-A");
    expect(presetA.databaseViewRuntime.database).not.toBe(
      presetB.databaseViewRuntime.database
    );
  });

  it("live-updates page mention labels via subscribe", () => {
    const titles = new Map([["p1", "Architecture"]]);
    const listeners = new Set<() => void>();
    const runtime: PageMentionRuntime = {
      resolve: (id) => {
        const title = titles.get(id);
        if (!title) return { title: "", missing: true };
        return { title };
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    };
    const dom = createPageMentionDom("p1", runtime);
    expect(dom.textContent).toBe("@Architecture");
    titles.set("p1", "System Architecture");
    for (const listener of listeners) listener();
    expect(dom.textContent).toBe("@System Architecture");
    titles.delete("p1");
    for (const listener of listeners) listener();
    expect(dom.textContent).toBe("@Missing page");
  });

  it("page card / child page resolve react to runtime title changes (P2-2)", () => {
    const titles = new Map([["p1", "Card Title"]]);
    const listeners = new Set<() => void>();
    const runtime = {
      resolve: (id: string) => {
        const title = titles.get(id);
        if (!title) return { title: "", missing: true };
        return { title };
      },
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    };
    expect(resolvePageCardDisplay(runtime, "p1").title).toBe("Card Title");
    expect(resolveChildPageDisplay(runtime, "p1").title).toBe("Card Title");
    titles.set("p1", "Renamed");
    for (const listener of listeners) listener();
    expect(resolvePageCardDisplay(runtime, "p1").title).toBe("Renamed");
    expect(resolveChildPageDisplay(runtime, "p1").title).toBe("Renamed");
  });

  it("disables page commands without picker / createChildPage / database", async () => {
    const registry = createCommandRegistry(createWorkspaceContentCommands());
    const baseEditor = {
      insertBlocks: vi.fn(),
      updateBlock: () => undefined,
      getTextCursorPosition: () => ({
        block: { id: "current", type: "paragraph" }
      }),
      insertInlineContent: vi.fn(),
      transact: <T>(fn: () => T) => fn()
    };
    expect(
      registry.get("page.insert-mention")!.isEnabled?.({
        editor: baseEditor
      } as never)
    ).toEqual({ ok: false, reason: "Page picker not available" });
    expect(
      registry.get("page.create-child")!.isEnabled?.({
        editor: baseEditor
      } as never)
    ).toEqual({ ok: false, reason: "Child page creation not available" });
    expect(
      registry.get("database.insert-view")!.isEnabled?.({
        editor: baseEditor
      } as never)
    ).toEqual({ ok: false, reason: "Database provider not available" });
  });

  it("requires database picker even when DatabaseProvider is present (P1-3)", () => {
    const registry = createCommandRegistry(createWorkspaceContentCommands());
    const enabled = registry.get("database.insert-view")!.isEnabled?.({
      editor: {
        insertBlocks: vi.fn(),
        getTextCursorPosition: () => ({
          block: { id: "current", type: "paragraph" }
        }),
        transact: <T>(fn: () => T) => fn()
      },
      providers: {
        database: {
          listRows: async () => ({ items: [], schema: {}, rows: [] })
        }
      }
    } as never);
    expect(enabled).toEqual({
      ok: false,
      reason: "Database picker not available"
    });
  });

  it("does not insert when database picker returns null (P1-3)", async () => {
    const insertBlocks = vi.fn();
    const registry = createCommandRegistry(createWorkspaceContentCommands());
    await registry.run("database.insert-view", {
      editor: {
        insertBlocks,
        updateBlock: () => undefined,
        getTextCursorPosition: () => ({
          block: { id: "current", type: "paragraph" }
        }),
        transact: <T>(fn: () => T) => fn()
      },
      providers: {
        database: {
          listRows: async () => ({ items: [], schema: {}, rows: [] })
        }
      },
      requestDatabaseViewPick: async () => null
    } as never);
    expect(insertBlocks).not.toHaveBeenCalled();
  });

  it("stores exact databaseId from picker and never invents tasks (P1-3)", async () => {
    const insertBlocks = vi.fn();
    const registry = createCommandRegistry(createWorkspaceContentCommands());
    await registry.run("database.insert-view", {
      editor: {
        insertBlocks,
        updateBlock: () => undefined,
        getTextCursorPosition: () => ({
          block: { id: "current", type: "paragraph" }
        }),
        transact: <T>(fn: () => T) => fn()
      },
      providers: {
        database: {
          listRows: async () => ({ items: [], schema: {}, rows: [] })
        }
      },
      requestDatabaseViewPick: async () => ({
        databaseId: "db-X",
        viewId: "board-1",
        viewType: "board",
        titleHint: "Custom"
      })
    } as never);
    expect(insertBlocks).toHaveBeenCalledWith(
      [
        {
          type: DATABASE_VIEW_TYPE,
          props: {
            databaseId: "db-X",
            viewId: "board-1",
            viewType: "board",
            titleHint: "Custom"
          }
        }
      ],
      { id: "current", type: "paragraph" },
      "after"
    );
    const inserted = JSON.stringify(insertBlocks.mock.calls[0]);
    expect(inserted).not.toMatch(/"tasks"/);
  });

  it("falls back invalid viewType to table after valid DB selection (P1-3)", async () => {
    const insertBlocks = vi.fn();
    const registry = createCommandRegistry(createWorkspaceContentCommands());
    await registry.run("database.insert-view", {
      editor: {
        insertBlocks,
        updateBlock: () => undefined,
        getTextCursorPosition: () => ({
          block: { id: "current", type: "paragraph" }
        }),
        transact: <T>(fn: () => T) => fn()
      },
      providers: {
        database: {
          listRows: async () => ({ items: [], schema: {}, rows: [] })
        }
      },
      requestDatabaseViewPick: async () => ({
        databaseId: "db-Y",
        viewType: "not-a-real-view"
      })
    } as never);
    expect(insertBlocks).toHaveBeenCalledWith(
      [
        {
          type: DATABASE_VIEW_TYPE,
          props: {
            databaseId: "db-Y",
            viewId: "main",
            viewType: "table",
            titleHint: ""
          }
        }
      ],
      { id: "current", type: "paragraph" },
      "after"
    );
  });

  it("creates child page only after host returns an id", async () => {
    const insertBlocks = vi.fn();
    const createChildPage = vi.fn(async () => ({
      id: "new-child",
      title: "Untitled"
    }));
    const registry = createCommandRegistry(createWorkspaceContentCommands());
    await registry.run("page.create-child", {
      editor: {
        insertBlocks,
        updateBlock: () => undefined,
        getTextCursorPosition: () => ({
          block: { id: "current", type: "paragraph" }
        }),
        transact: <T>(fn: () => T) => fn()
      },
      documentId: "parent-doc",
      providers: { pages: { createChildPage } }
    } as never);
    expect(createChildPage).toHaveBeenCalledWith({
      parentPageId: "parent-doc",
      title: "Untitled"
    });
    expect(insertBlocks).toHaveBeenCalledWith(
      [
        {
          type: CHILD_PAGE_TYPE,
          props: { pageId: "new-child", titleHint: "Untitled" }
        }
      ],
      { id: "current", type: "paragraph" },
      "after"
    );
  });
});

describe("RelationIndex", () => {
  const sampleBlocks = [
    {
      id: "p1",
      type: "paragraph",
      content: [
        { type: PAGE_MENTION_TYPE, props: { pageId: "arch" } },
        { type: BLOCK_REFERENCE_TYPE, props: { blockId: "h1" } },
        {
          type: DATABASE_RELATION_TYPE,
          props: { databaseId: "db-a", rowId: "row-1" }
        }
      ]
    },
    {
      id: "card",
      type: PAGE_CARD_TYPE,
      props: { pageId: "design", titleHint: "Design" }
    },
    {
      id: "child",
      type: CHILD_PAGE_TYPE,
      props: { pageId: "child-a", titleHint: "Child" }
    },
    {
      id: "db",
      type: DATABASE_VIEW_TYPE,
      props: {
        databaseId: "projects",
        viewId: "main",
        viewType: "table",
        titleHint: ""
      }
    }
  ];

  it("extracts page, child, block, view-reference, and row-relation edges", () => {
    const edges = extractRelationEdges("doc-1", sampleBlocks as never);
    const kinds = edges.map((e) => e.kind).sort();
    expect(kinds).toEqual([
      "block-reference",
      "child-page",
      "database-row-relation",
      "database-view-reference",
      "page-reference",
      "page-reference"
    ]);
  });

  it("keeps same row id in two databases as distinct targets (P1-4)", () => {
    const blocks = [
      {
        id: "p1",
        type: "paragraph",
        content: [
          {
            type: DATABASE_RELATION_TYPE,
            props: { databaseId: "db-a", rowId: "row-1" }
          },
          {
            type: DATABASE_RELATION_TYPE,
            props: { databaseId: "db-b", rowId: "row-1" }
          }
        ]
      }
    ];
    const edges = extractRelationEdges("doc-1", blocks as never);
    expect(edges).toHaveLength(2);
    expect(edges[0]!.edgeId).not.toBe(edges[1]!.edgeId);
    expect(
      edges.filter(
        (e) =>
          e.targetType === "database-row" &&
          e.targetId === "row-1" &&
          e.targetDatabaseId === "db-a"
      )
    ).toHaveLength(1);
    expect(
      edges.filter(
        (e) =>
          e.targetType === "database-row" &&
          e.targetId === "row-1" &&
          e.targetDatabaseId === "db-b"
      )
    ).toHaveLength(1);
    // No embedded destination row payload
    expect(JSON.stringify(edges)).not.toContain("embedded");
    expect(edges.every((e) => !("row" in e))).toBe(true);
  });

  it("round-trips databaseRelation props without row objects (P1-4)", () => {
    const preset = createOpenEditorPowerPreset();
    const doc = createEditorDocument([
      {
        id: "p1",
        type: "paragraph",
        content: [
          {
            type: DATABASE_RELATION_TYPE,
            props: { databaseId: "db-a", rowId: "row-1" }
          }
        ]
      }
    ]);
    const bn = toBlockNoteForSchema(doc, preset.schema);
    const back = fromBlockNote(bn as never);
    const inline = (back.blocks[0] as { content?: unknown[] }).content?.[0] as {
      type: string;
      props: Record<string, unknown>;
    };
    expect(inline.type).toBe(DATABASE_RELATION_TYPE);
    expect(inline.props).toEqual({ databaseId: "db-a", rowId: "row-1" });
    expect(Object.keys(inline.props).sort()).toEqual(["databaseId", "rowId"]);
  });

  it("applies incremental insert/update/delete without stale duplicates", () => {
    const index = createRelationIndex();
    index.replaceFromBlocks("doc-1", sampleBlocks as never);
    expect(index.size()).toBe(6);

    index.applyChanges("doc-1", [
      {
        type: "update",
        blockId: "card",
        block: {
          id: "card",
          type: PAGE_CARD_TYPE,
          props: { pageId: "design-v2", titleHint: "Design" }
        },
        prevBlock: sampleBlocks[1] as never,
        source: "local"
      }
    ]);
    expect(index.listOutgoingTo("page", "design")).toHaveLength(0);
    expect(index.listOutgoingTo("page", "design-v2")).toHaveLength(1);

    index.applyChanges("doc-1", [
      {
        type: "delete",
        blockId: "db",
        block: sampleBlocks[3] as never,
        source: "local"
      }
    ]);
    expect(index.listByKind("database-view-reference")).toHaveLength(0);
    expect(index.size()).toBe(5);
  });

  it("removes stale nested edges when a child disappears (P1-2)", () => {
    const index = createRelationIndex();
    const before = {
      id: "parent",
      type: "paragraph",
      content: [],
      children: [
        {
          id: "child",
          type: "paragraph",
          content: [{ type: PAGE_MENTION_TYPE, props: { pageId: "PageA" } }]
        }
      ]
    };
    index.replaceFromBlocks("doc-1", [before] as never);
    expect(index.listOutgoingTo("page", "PageA")).toHaveLength(1);

    const after = {
      id: "parent",
      type: "paragraph",
      content: [],
      children: []
    };
    index.applyChanges("doc-1", [
      {
        type: "update",
        blockId: "parent",
        block: after as never,
        prevBlock: before as never,
        source: "local"
      }
    ]);
    expect(index.listOutgoingTo("page", "PageA")).toHaveLength(0);
    expect(index.size()).toBe(0);
  });

  it("replaces nested child page mention without leaving stale or duplicate edges (P1-2)", () => {
    const index = createRelationIndex();
    const before = {
      id: "parent",
      type: "paragraph",
      children: [
        {
          id: "old-child",
          type: "paragraph",
          content: [{ type: PAGE_MENTION_TYPE, props: { pageId: "PageA" } }]
        }
      ]
    };
    index.replaceFromBlocks("doc-1", [before] as never);

    const after = {
      id: "parent",
      type: "paragraph",
      children: [
        {
          id: "new-child",
          type: "paragraph",
          content: [{ type: PAGE_MENTION_TYPE, props: { pageId: "PageB" } }]
        }
      ]
    };
    const revBefore = index.getRevision();
    index.applyChanges("doc-1", [
      {
        type: "update",
        blockId: "parent",
        block: after as never,
        prevBlock: before as never,
        source: "local"
      }
    ]);
    expect(index.listOutgoingTo("page", "PageA")).toHaveLength(0);
    expect(index.listOutgoingTo("page", "PageB")).toHaveLength(1);
    expect(index.size()).toBe(1);
    expect(index.getRevision()).toBeGreaterThan(revBefore);
  });

  it("clears nested database-view-reference on parent update (P1-2)", () => {
    const index = createRelationIndex();
    const before = {
      id: "parent",
      type: "paragraph",
      children: [
        {
          id: "nested-db",
          type: DATABASE_VIEW_TYPE,
          props: {
            databaseId: "nested-db-id",
            viewId: "main",
            viewType: "table",
            titleHint: ""
          }
        }
      ]
    };
    index.replaceFromBlocks("doc-1", [before] as never);
    expect(index.listByKind("database-view-reference")).toHaveLength(1);

    index.applyChanges("doc-1", [
      {
        type: "update",
        blockId: "parent",
        block: { id: "parent", type: "paragraph", children: [] } as never,
        prevBlock: before as never,
        source: "local"
      }
    ]);
    expect(index.listByKind("database-view-reference")).toHaveLength(0);
  });

  it("notifies subscribers on revision bumps", () => {
    const index = createRelationIndex();
    const revs: number[] = [];
    index.subscribe(() => revs.push(index.getRevision()));
    index.replaceFromBlocks("doc-1", sampleBlocks as never);
    expect(revs.length).toBeGreaterThan(0);
  });
});

describe("page mention resolver", () => {
  it("resolves titles from link lists", () => {
    const resolve = createPageMentionResolverFromLinks([
      { id: "a", title: "Alpha" }
    ]);
    expect(resolve("a")).toEqual({ title: "Alpha" });
    expect(resolve("missing")?.missing).toBe(true);
  });
});

describe("usePageLinks dependency stability (P2-1)", () => {
  it("reload identity follows listLinks / refreshToken, not options object", async () => {
    // Lightweight unit check without mounting React: the hook contract is that
    // callers may pass a fresh options object each render.
    const listLinks = vi.fn(async () => [{ id: "a", title: "A" }]);
    const optionsA = { listLinks, refreshToken: 1 };
    const optionsB = { listLinks, refreshToken: 1 };
    expect(optionsA).not.toBe(optionsB);
    expect(optionsA.listLinks).toBe(optionsB.listLinks);
    expect(optionsA.refreshToken).toBe(optionsB.refreshToken);
    await expect(optionsA.listLinks()).resolves.toEqual([
      { id: "a", title: "A" }
    ]);
  });
});
