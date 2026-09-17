/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { createDocumentIndex } from "../src/index/documentIndex.js";
import { createDocumentOutline } from "../src/index/outline.js";
import type { OpenEditorBlockChange } from "../src/bridge/batchedSink.js";
import type { EditorBlock } from "@hello-ai-company/editor-core";

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

  it("applies insert/update/delete/move incrementally", () => {
    const index = createDocumentIndex();
    index.replaceFromBlocks([
      block("a", "paragraph", "A"),
      block("b", "paragraph", "B")
    ]);

    const insert: OpenEditorBlockChange = {
      type: "insert",
      blockId: "c",
      block: block("c", "paragraph", "C"),
      source: "local",
      indexHint: 1
    };
    index.applyChanges([insert]);
    expect(index.list().map((e) => e.blockId)).toContain("c");

    const update: OpenEditorBlockChange = {
      type: "update",
      blockId: "a",
      block: block("a", "heading", "Alpha", { level: 1 }),
      prevBlock: block("a", "paragraph", "A"),
      source: "local"
    };
    index.applyChanges([update]);
    expect(index.getById("a")?.type).toBe("heading");
    expect(index.getById("a")?.headingLevel).toBe(1);

    const move: OpenEditorBlockChange = {
      type: "move",
      blockId: "b",
      block: block("b", "paragraph", "B"),
      prevBlock: block("b", "paragraph", "B"),
      source: "local",
      currentParentId: null
    };
    index.applyChanges([move]);
    expect(index.getById("b")).toBeTruthy();

    const del: OpenEditorBlockChange = {
      type: "delete",
      blockId: "c",
      block: block("c", "paragraph", "C"),
      source: "local"
    };
    index.applyChanges([del]);
    expect(index.getById("c")).toBeUndefined();
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
