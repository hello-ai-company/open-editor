import { describe, expect, it } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import {
  CANVAS_THEME_PRESETS,
  DEFAULT_CANVAS_BREAKPOINTS,
  duplicateCanvasNode,
  flattenCanvasNodes,
  moveCanvasNode,
  reorderCanvasNode,
  resolveResponsiveValue,
  setCanvasNodeGap,
  validateCanvasLayoutSpec,
  type CanvasLayoutSpec
} from "../src/index.js";

const doc = createEditorDocument([
  { id: "a", type: "paragraph", content: [{ type: "text", text: "A" }] },
  { id: "b", type: "paragraph", content: [{ type: "text", text: "B" }] },
  { id: "c", type: "paragraph", content: [{ type: "text", text: "C" }] }
]);

function layout(): CanvasLayoutSpec {
  return {
    template: "report",
    breakpoints: { ...DEFAULT_CANVAS_BREAKPOINTS },
    theme: "editorial",
    root: {
      id: "root",
      type: "stack",
      direction: "vertical",
      gap: { mobile: 12 },
      children: [
        { id: "section-a", type: "section", children: [{ id: "node-a", type: "text", blockId: "a" }] },
        { id: "section-b", type: "section", children: [{ id: "node-b", type: "text", blockId: "b" }] },
        { id: "node-c", type: "text", blockId: "c" }
      ]
    }
  };
}

describe("canvas layout operations", () => {
  it("resolves responsive values with the nearest smaller breakpoint fallback", () => {
    const value = { mobile: 12, tablet: 20 };
    expect(resolveResponsiveValue(value, "mobile")).toBe(12);
    expect(resolveResponsiveValue(value, "tablet")).toBe(20);
    expect(resolveResponsiveValue(value, "desktop")).toBe(20);
  });

  it("duplicates nested layout nodes with fresh layout IDs while keeping semantic references", () => {
    const original = layout();
    const copy = duplicateCanvasNode(original, "section-a");
    expect(copy).not.toBeNull();
    expect(flattenCanvasNodes(copy!.root).map(({ id }) => id)).toEqual([
      "root", "section-a", "node-a", "section-a:copy:1", "node-a:copy:1", "section-b", "node-b", "node-c"
    ]);
    expect(flattenCanvasNodes(copy!.root).flatMap((node) => "blockId" in node && typeof node.blockId === "string" ? [node.blockId] : [])).toEqual(["a", "a", "b", "c"]);
    expect(validateCanvasLayoutSpec(copy, doc)).toEqual([]);
    expect(JSON.stringify(doc)).toContain("\"text\":\"A\"");
  });

  it("reorders and moves nodes across nested groups without changing the document", () => {
    const original = layout();
    const reordered = reorderCanvasNode(original, "section-b", -1);
    expect(reordered?.root.type).toBe("stack");
    if (reordered?.root.type !== "stack") throw new Error("Expected stack root");
    expect(reordered.root.children.map(({ id }) => id)).toEqual(["section-b", "section-a", "node-c"]);

    const moved = moveCanvasNode(original, "node-c", "section-a");
    expect(moved?.root.type).toBe("stack");
    if (moved?.root.type !== "stack") throw new Error("Expected stack root");
    const sectionA = moved.root.children[0];
    expect(sectionA?.type).toBe("section");
    if (sectionA?.type !== "section") throw new Error("Expected section");
    expect(sectionA.children.map(({ id }) => id)).toEqual(["node-a", "node-c"]);
    expect(JSON.stringify(doc)).toBe(JSON.stringify(createEditorDocument([
      { id: "a", type: "paragraph", content: [{ type: "text", text: "A" }] },
      { id: "b", type: "paragraph", content: [{ type: "text", text: "B" }] },
      { id: "c", type: "paragraph", content: [{ type: "text", text: "C" }] }
    ])));
    expect(validateCanvasLayoutSpec(moved, doc)).toEqual([]);
  });

  it("rejects moving a node into its own descendant and leaves originals immutable", () => {
    const original = layout();
    expect(moveCanvasNode(original, "section-a", "node-a")).toBeNull();
    expect(original.root.type === "stack" && original.root.children[0]?.id).toBe("section-a");
  });

  it("updates responsive spacing without altering semantic content", () => {
    const original = layout();
    const updated = setCanvasNodeGap(original, "root", "desktop", 40);
    expect(updated?.root.type).toBe("stack");
    if (updated?.root.type !== "stack") throw new Error("Expected stack root");
    expect(updated.root.gap).toEqual({ mobile: 12, desktop: 40 });
    expect(resolveResponsiveValue(updated.root.gap, "tablet")).toBe(12);
    expect(resolveResponsiveValue(updated.root.gap, "desktop")).toBe(40);
    expect(setCanvasNodeGap(original, "root", "mobile", 257)).toBeNull();
  });

  it("keeps absolute overlay rectangles attached when items move or duplicate", () => {
    const absoluteSpec: CanvasLayoutSpec = {
      template: "presentation",
      breakpoints: { ...DEFAULT_CANVAS_BREAKPOINTS },
      theme: "technical",
      root: {
        id: "overlay", type: "absolute", items: [
          { element: { id: "overlay-a", type: "button", blockId: "a" }, rect: { mobile: { x: 0, y: 0, width: 20, height: 20 } } },
          { element: { id: "overlay-b", type: "text", blockId: "b" }, rect: { mobile: { x: 40, y: 40, width: 30, height: 20 } } }
        ]
      }
    };
    const moved = reorderCanvasNode(absoluteSpec, "overlay-b", -1);
    expect(moved?.root.type).toBe("absolute");
    if (moved?.root.type !== "absolute") throw new Error("Expected absolute root");
    expect(moved.root.items.map(({ element, rect }) => [element.id, rect.mobile.x])).toEqual([["overlay-b", 40], ["overlay-a", 0]]);

    const duplicated = duplicateCanvasNode(absoluteSpec, "overlay-a");
    expect(duplicated?.root.type).toBe("absolute");
    if (duplicated?.root.type !== "absolute") throw new Error("Expected absolute root");
    expect(duplicated.root.items.map(({ element, rect }) => [element.id, rect.mobile.x])).toEqual([
      ["overlay-a", 0], ["overlay-a:copy:1", 0], ["overlay-b", 40]
    ]);
    expect(validateCanvasLayoutSpec(duplicated, doc)).toEqual([]);
  });

  it("accepts duplicate block references but rejects missing refs and duplicate layout IDs", () => {
    const repeatedRef: CanvasLayoutSpec = {
      ...layout(),
      root: { id: "root", type: "stack", direction: "vertical", children: [
        { id: "copy-a", type: "text", blockId: "a" },
        { id: "copy-b", type: "card", blockId: "a" }
      ] }
    };
    expect(validateCanvasLayoutSpec(repeatedRef, doc)).toEqual([]);

    const missing: CanvasLayoutSpec = {
      ...repeatedRef,
      root: { id: "root", type: "stack", direction: "vertical", children: [{ id: "gone", type: "text", blockId: "deleted" }] }
    };
    expect(validateCanvasLayoutSpec(missing, doc).map(({ code }) => code)).toContain("MISSING_BLOCK_REFERENCE");

    const duplicateId: CanvasLayoutSpec = {
      ...repeatedRef,
      root: { id: "root", type: "stack", direction: "vertical", children: [
        { id: "same", type: "text", blockId: "a" },
        { id: "same", type: "card", blockId: "a" }
      ] }
    };
    expect(validateCanvasLayoutSpec(duplicateId, doc).map(({ code }) => code)).toContain("DUPLICATE_LAYOUT_ID");
  });

  it("bounds large layouts and renders a full supported-size layout", () => {
    const blocks = Array.from({ length: 1001 }, (_, index) => ({ id: `b-${index}`, type: "paragraph" }));
    const largeDoc = createEditorDocument(blocks);
    const make = (count: number): CanvasLayoutSpec => ({
      template: "report",
      breakpoints: { ...DEFAULT_CANVAS_BREAKPOINTS },
      theme: CANVAS_THEME_PRESETS.minimal,
      root: {
        id: "large-root", type: "grid", columns: { mobile: 1, desktop: 4 }, children:
          Array.from({ length: count }, (_, index) => ({ id: `layout-${index}`, type: "text" as const, blockId: `b-${index}` }))
      }
    });
    expect(validateCanvasLayoutSpec(make(999), largeDoc)).toEqual([]);
    expect(validateCanvasLayoutSpec(make(1000), largeDoc).map(({ code }) => code)).toContain("LIMIT_EXCEEDED");
  });
});
