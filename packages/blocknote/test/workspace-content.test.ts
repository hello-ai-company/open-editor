/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { fromBlockNote, toBlockNoteForSchema } from "../src/index.js";
import { createOpenEditorPowerPreset } from "../src/features/compose.js";
import {
  CHILD_PAGE_TYPE,
  DATABASE_VIEW_TYPE,
  PAGE_CARD_TYPE,
  PAGE_MENTION_TYPE,
  createPageMentionDom,
  createPageMentionResolverFromLinks,
  createRelationIndex,
  createWorkspaceContentCommands,
  extractRelationEdges,
  type PageMentionRuntime
} from "../src/workspace/index.js";
import { createCommandRegistry } from "../src/commands/registry.js";
import { BLOCK_REFERENCE_TYPE } from "../src/references/blockReference.js";

describe("workspace content primitives", () => {
  it("includes workspace schema and commands by default", () => {
    const preset = createOpenEditorPowerPreset();
    expect(preset.schema.inlineContentSchema).toHaveProperty(PAGE_MENTION_TYPE);
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
    expect(preset.schema.blockSchema).not.toHaveProperty(PAGE_CARD_TYPE);
    expect(preset.registry.get("page.insert-mention")).toBeUndefined();
    expect(preset.registry.get("database.insert-view")).toBeUndefined();
  });

  it("round-trips page mention, page card, child page, and databaseView", () => {
    const preset = createOpenEditorPowerPreset();
    const doc = createEditorDocument([
      {
        id: "p1",
        type: "paragraph",
        content: [
          { type: PAGE_MENTION_TYPE, props: { pageId: "page/arch#1" } }
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
          databaseId: "tasks",
          viewId: "board-1",
          viewType: "board",
          titleHint: "Tasks"
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
    expect(json).toContain("board-1");
    expect(json).not.toContain("rowKey");
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
        { type: BLOCK_REFERENCE_TYPE, props: { blockId: "h1" } }
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
        databaseId: "tasks",
        viewId: "main",
        viewType: "table",
        titleHint: ""
      }
    }
  ];

  it("extracts page, child, block, and database relations", () => {
    const edges = extractRelationEdges("doc-1", sampleBlocks as never);
    const kinds = edges.map((e) => e.kind).sort();
    expect(kinds).toEqual([
      "block-reference",
      "child-page",
      "database-relation",
      "page-reference",
      "page-reference"
    ]);
  });

  it("applies incremental insert/update/delete without stale duplicates", () => {
    const index = createRelationIndex();
    index.replaceFromBlocks("doc-1", sampleBlocks as never);
    expect(index.size()).toBe(5);

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
    expect(index.listByKind("database-relation")).toHaveLength(0);
    expect(index.size()).toBe(4);
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
