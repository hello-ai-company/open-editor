import { describe, expect, it } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import {
  CANVAS_THEME_PRESETS,
  DEFAULT_CANVAS_BREAKPOINTS,
  createMagicLayoutSpec,
  createPresentationSlides,
  validateCanvasLayoutSpec,
  type CanvasLayoutSpec
} from "../src/index.js";

const document = createEditorDocument([
  { id: "intro", type: "heading", content: [{ type: "text", text: "Overview" }] },
  { id: "copy", type: "paragraph", content: [{ type: "text", text: "Keep this semantic content in the document." }] },
  { id: "photo", type: "image", props: { url: "https://example.test/image.png" } },
  { id: "details", type: "heading", content: [{ type: "text", text: "Details" }] },
  { id: "chart", type: "chartPlaceholder", props: { title: "Quarterly" } },
  { id: "end", type: "paragraph", content: [{ type: "text", text: "Last paragraph." }] }
]);

function issueCodes(spec: unknown): string[] {
  return validateCanvasLayoutSpec(spec, document).map((entry) => entry.code);
}

function referencedBlockIds(node: CanvasLayoutSpec["root"]): string[] {
  const refs: string[] = [];
  const visit = (current: CanvasLayoutSpec["root"]): void => {
    if ("blockId" in current && current.blockId) refs.push(current.blockId);
    if (current.type === "absolute") {
      current.items.forEach(({ element }) => refs.push(element.blockId));
    } else if ("children" in current) {
      current.children.forEach(visit);
    } else if (current.type === "columns") {
      current.columns.flat().forEach(visit);
    }
  };
  visit(node);
  return refs;
}

describe("editor-canvas", () => {
  it("validates IDs, block references, breakpoints, and bounded responsive values", () => {
    const invalid: CanvasLayoutSpec = {
      template: "report",
      breakpoints: { tablet: 1024, desktop: 768 },
      theme: "editorial",
      root: {
        id: "same",
        type: "grid",
        columns: { mobile: 0, tablet: 13 },
        gap: { mobile: 300 },
        children: [
          { id: "same", type: "text", blockId: "missing" }
        ]
      }
    };

    expect(issueCodes(invalid)).toEqual(expect.arrayContaining([
      "INVALID_BREAKPOINTS",
      "DUPLICATE_LAYOUT_ID",
      "MISSING_BLOCK_REFERENCE",
      "OUT_OF_RANGE"
    ]));
  });

  it("accepts responsive grid values, bounded overlays, and token presets", () => {
    const valid: CanvasLayoutSpec = {
      template: "landing-page",
      breakpoints: { ...DEFAULT_CANVAS_BREAKPOINTS },
      theme: CANVAS_THEME_PRESETS.modern,
      root: {
        id: "root",
        type: "stack",
        direction: "vertical",
        gap: { mobile: 12, tablet: 24, desktop: 32 },
        children: [
          {
            id: "grid",
            type: "grid",
            columns: { mobile: 1, tablet: 2, desktop: 3 },
            children: [
              { id: "copy-ref", type: "text", blockId: "copy" },
              { id: "image-ref", type: "image", blockId: "photo" }
            ]
          },
          {
            id: "overlay",
            type: "absolute",
            items: [{
              element: { id: "button-ref", type: "button", blockId: "intro" },
              rect: {
                mobile: { x: 4, y: 4, width: 40, height: 12 },
                desktop: { x: 70, y: 5, width: 25, height: 10 }
              }
            }]
          }
        ]
      }
    };
    expect(validateCanvasLayoutSpec(valid, document)).toEqual([]);
  });

  it("creates deterministic layouts that reference blocks without copying content", () => {
    const first = createMagicLayoutSpec(document, "landing-page");
    const second = createMagicLayoutSpec(document, "landing-page");
    const encoded = JSON.stringify(first);

    expect(first).toEqual(second);
    expect(encoded).not.toContain("Keep this semantic content");
    expect(encoded).not.toContain("Quarterly");
    expect(encoded).toContain('"blockId":"intro"');
    expect(encoded).toContain('"blockId":"copy"');
    expect(encoded).toContain('"blockId":"photo"');
    expect(encoded).toContain('"blockId":"chart"');
    expect(referencedBlockIds(first.root)).toEqual(["intro", "copy", "photo", "details", "chart", "end"]);
    expect(validateCanvasLayoutSpec(createMagicLayoutSpec(document, "report"), document)).toEqual([]);
    expect(validateCanvasLayoutSpec(createMagicLayoutSpec(document, "presentation"), document)).toEqual([]);
  });

  it("groups preface content and heading sections into stable slides", () => {
    const doc = createEditorDocument([
      { id: "lead", type: "paragraph" },
      { id: "title-a", type: "heading" },
      { id: "body-a", type: "paragraph" },
      { id: "title-b", type: "heading" },
      { id: "body-b", type: "paragraph" }
    ]);
    const slides = createPresentationSlides(doc);

    expect(slides).toEqual([
      { id: "slide:preface:lead", blockIds: ["lead"] },
      { id: "slide:heading:title-a", headingBlockId: "title-a", blockIds: ["title-a", "body-a"] },
      { id: "slide:heading:title-b", headingBlockId: "title-b", blockIds: ["title-b", "body-b"] }
    ]);
    expect(createPresentationSlides(doc)).toEqual(slides);
  });

  it("includes nested headings and child blocks by stable reference", () => {
    const nested = createEditorDocument([{
      id: "outer-title",
      type: "heading",
      content: [{ type: "text", text: "Outer" }],
      children: [
        { id: "outer-copy", type: "paragraph", content: [{ type: "text", text: "Child" }] },
        {
          id: "nested-title",
          type: "heading",
          content: [{ type: "text", text: "Nested" }],
          children: [{ id: "nested-copy", type: "paragraph", content: [{ type: "text", text: "Nested body" }] }]
        }
      ]
    }]);
    const spec = createMagicLayoutSpec(nested, "report");
    expect(referencedBlockIds(spec.root)).toEqual(["outer-title", "outer-copy", "nested-title", "nested-copy"]);
    expect(validateCanvasLayoutSpec(spec, nested)).toEqual([]);
  });
});
