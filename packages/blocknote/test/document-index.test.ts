/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { createDocumentIndex } from "../src/index/documentIndex.js";
import { createDocumentOutline } from "../src/index/outline.js";
import type { OpenEditorBlockChange } from "../src/bridge/batchedSink.js";
import type { EditorBlock } from "@hello-ai-company/editor-core";
import { createBlockChangeBridge } from "../src/bridge/createBlockChangeBridge.js";

function block(
  id: string,
  type: string,
  text: string,
  props?: Record<string, unknown>,
  children?: EditorBlock[]
): EditorBlock {
  return {
    id,
    type,
    props: props as never,
    content: [{ type: "text", text, styles: {} }],
    children
  };
}

describe("DocumentIndex", () => {
  it("builds initial snapshot and preserves order", () => {
    const index = createDocumentIndex();
    index.replaceFromBlocks([
      block("h1", "heading", "Intro", { level: 1 }),
      block("p1", "paragraph", "Hello"),
      block("h2", "heading", "Goals", { level: 2 })
    ]);
    expect(index.size()).toBe(3);
    expect(index.list().map((e) => e.blockId)).toEqual(["h1", "p1", "h2"]);
    expect(index.getById("h1")?.headingLevel).toBe(1);
  });

  it("inserts mid-document using prevSiblingId (not append)", () => {
    const index = createDocumentIndex();
    index.replaceFromBlocks([
      block("a", "paragraph", "A"),
      block("b", "paragraph", "B")
    ]);

    index.applyChanges([
      {
        type: "insert",
        blockId: "c",
        block: block("c", "paragraph", "C"),
        source: "local",
        parentId: null,
        prevSiblingId: "a",
        nextSiblingId: "b"
      }
    ]);
    expect(index.list().map((e) => e.blockId)).toEqual(["a", "c", "b"]);
  });

  it("inserts nested children under parent", () => {
    const index = createDocumentIndex();
    index.replaceFromBlocks([block("parent", "bulletListItem", "Parent")]);
    index.applyChanges([
      {
        type: "insert",
        blockId: "child",
        block: block("child", "paragraph", "Child"),
        source: "local",
        parentId: "parent",
        prevSiblingId: null,
        nextSiblingId: null
      }
    ]);
    expect(index.getById("child")?.parentId).toBe("parent");
    expect(index.list().map((e) => e.blockId)).toEqual(["parent", "child"]);
  });

  it("indexes nested subtree on insert and cascades delete", () => {
    const index = createDocumentIndex();
    index.replaceFromBlocks([block("a", "paragraph", "A")]);
    index.applyChanges([
      {
        type: "insert",
        blockId: "parent",
        block: block("parent", "bulletListItem", "P", undefined, [
          block("kid", "paragraph", "K")
        ]),
        source: "local",
        parentId: null,
        prevSiblingId: "a"
      }
    ]);
    expect(index.getById("kid")?.parentId).toBe("parent");
    expect(index.list().map((e) => e.blockId)).toEqual(["a", "parent", "kid"]);

    index.applyChanges([
      {
        type: "delete",
        blockId: "parent",
        block: block("parent", "bulletListItem", "P"),
        source: "local"
      }
    ]);
    expect(index.getById("parent")).toBeUndefined();
    expect(index.getById("kid")).toBeUndefined();
    expect(index.list().map((e) => e.blockId)).toEqual(["a"]);
  });

  it("moves using sibling anchors without appending to end", () => {
    const index = createDocumentIndex();
    index.replaceFromBlocks([
      block("a", "paragraph", "A"),
      block("b", "paragraph", "B"),
      block("c", "paragraph", "C")
    ]);

    index.applyChanges([
      {
        type: "move",
        blockId: "c",
        block: block("c", "paragraph", "C"),
        prevBlock: block("c", "paragraph", "C"),
        source: "local",
        currentParentId: null,
        parentId: null,
        prevSiblingId: null,
        nextSiblingId: "a"
      }
    ]);
    expect(index.list().map((e) => e.blockId)).toEqual(["c", "a", "b"]);
  });

  it("applies update and bumps revision for subscribers", () => {
    const index = createDocumentIndex();
    index.replaceFromBlocks([block("a", "paragraph", "A")]);
    const revs: number[] = [];
    index.subscribe(() => revs.push(index.getRevision()));

    index.applyChanges([
      {
        type: "update",
        blockId: "a",
        block: block("a", "heading", "Alpha", { level: 1 }),
        prevBlock: block("a", "paragraph", "A"),
        source: "local"
      }
    ]);
    expect(index.getById("a")?.type).toBe("heading");
    expect(revs.length).toBeGreaterThan(0);
  });

  it("builds nested outline from headings", () => {
    const index = createDocumentIndex();
    index.replaceFromBlocks([
      block("h1", "heading", "Document", { level: 1 }),
      block("h2", "heading", "Intro", { level: 2 }),
      block("h3", "heading", "Goals", { level: 3 }),
      block("h2b", "heading", "Impl", { level: 2 })
    ]);
    const outline = createDocumentOutline(index);
    expect(outline).toHaveLength(1);
    expect(outline[0]?.title).toBe("Document");
    expect(outline[0]?.children).toHaveLength(2);
    expect(outline[0]?.children[0]?.children[0]?.title).toBe("Goals");
  });

  it("query ranks headings and text matches", () => {
    const index = createDocumentIndex();
    index.replaceFromBlocks([
      block("h1", "heading", "Architecture", { level: 1 }),
      block("p1", "paragraph", "architecture notes"),
      block("p2", "paragraph", "unrelated")
    ]);
    const hits = index.query({ query: "arch", preferHeadings: true });
    expect(hits[0]?.blockId).toBe("h1");
    expect(hits.map((h) => h.blockId)).not.toContain("p2");
  });

  it("hot path applyChanges does not require document snapshot", () => {
    const index = createDocumentIndex();
    index.replaceFromBlocks([block("p1", "paragraph", "x")]);
    const replaceSpy = vi.spyOn(index, "replaceFromBlocks");
    index.applyChanges([
      {
        type: "update",
        blockId: "p1",
        block: block("p1", "paragraph", "y"),
        prevBlock: block("p1", "paragraph", "x"),
        source: "local"
      }
    ]);
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(index.getById("p1")?.text).toContain("y");
  });
});

describe("bridge → DocumentIndex integration", () => {
  it("maps insert anchors from editor getPrev/getNext/getParent and preserves order", () => {
    const blocks = {
      a: { id: "a", type: "paragraph", content: "A" },
      b: { id: "b", type: "paragraph", content: "B" },
      c: { id: "c", type: "paragraph", content: "C" }
    };

    type FakeEditor = {
      onChange: (
        cb: (
          editor: FakeEditor,
          ctx: { getChanges: () => unknown[] }
        ) => void
      ) => () => void;
      getParentBlock: (block: { id: string }) => undefined;
      getPrevBlock: (block: { id: string }) => { id: string } | undefined;
      getNextBlock: (block: { id: string }) => { id: string } | undefined;
      _emit?: (
        editor: FakeEditor,
        ctx: { getChanges: () => unknown[] }
      ) => void;
    };

    const editor: FakeEditor = {
      onChange(cb) {
        editor._emit = cb;
        return () => undefined;
      },
      getParentBlock: () => undefined,
      getPrevBlock: (block) => (block.id === "c" ? blocks.a : undefined),
      getNextBlock: (block) => (block.id === "c" ? blocks.b : undefined)
    };

    const index = createDocumentIndex();
    index.replaceFromBlocks([
      block("a", "paragraph", "A"),
      block("b", "paragraph", "B")
    ]);

    const bridge = createBlockChangeBridge({
      batch: { strategy: "sync" },
      toEditorBlock: (bn) => {
        const id = (bn as { id: string }).id;
        return block(id, "paragraph", id.toUpperCase());
      },
      onBatch: (batch) => {
        index.applyChanges(batch.changes as OpenEditorBlockChange[]);
      }
    });
    bridge.attach(editor as never);

    editor._emit?.(editor, {
      getChanges: () => [
        {
          type: "insert",
          block: blocks.c,
          prevBlock: undefined,
          source: { type: "local" }
        }
      ]
    });

    expect(index.list().map((e) => e.blockId)).toEqual(["a", "c", "b"]);
  });
});
