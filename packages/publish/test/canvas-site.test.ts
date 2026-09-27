import { describe, expect, it } from "vitest";
import { createEditorDocument, type EditorBlock } from "@hello-ai-company/editor-core";
import {
  CANVAS_THEME_PRESETS,
  DEFAULT_CANVAS_BREAKPOINTS,
  type CanvasLayoutSpec
} from "@hello-ai-company/editor-canvas";
import {
  renderOpenEditorMarkdown,
  renderOpenEditorPresentation,
  renderOpenEditorSite
} from "../src/index.js";

function document(blocks: EditorBlock[]) {
  return createEditorDocument(blocks);
}

describe("Canvas site projection", () => {
  it("preserves native columns as responsive transparent containers", () => {
    const html = renderOpenEditorSite(document([{
      id: "columns",
      type: "columnList",
      children: [
        { id: "column-a", type: "column", props: { width: 0.6 }, children: [
          { id: "a", type: "paragraph", content: "Column A" },
          { id: "private-a", type: "paragraph", props: { visibility: "private" }, content: "Private column text" }
        ] },
        { id: "column-b", type: "column", props: { columnWidth: 0.4 }, children: [{ id: "b", type: "paragraph", content: "Column B" }] }
      ]
    }]));

    expect(html).toContain('class="oe-site__legacy-columns"');
    expect(html).toContain("--oe-site-column-tracks:minmax(0,0.6fr) minmax(0,0.4fr)");
    expect(html).toContain("<p>Column A</p>");
    expect(html).toContain("<p>Column B</p>");
    expect(html).toContain("@media(max-width:640px)");
    expect(html).not.toContain("Private column text");
    const markdown = renderOpenEditorMarkdown(document([{
      id: "columns",
      type: "columnList",
      children: [
        { id: "column-a", type: "column", children: [{ id: "a", type: "paragraph", content: "Column A" }] },
        { id: "column-b", type: "column", children: [{ id: "b", type: "paragraph", content: "Column B" }] }
      ]
    }]));
    expect(markdown).toContain("Column A");
    expect(markdown).toContain("Column B");
  });

  it("renders validated Canvas hierarchy, theme tokens, and responsive values", () => {
    const doc = document([
      { id: "title", type: "heading", props: { level: 1 }, content: "Launch" },
      { id: "copy", type: "paragraph", content: "Public copy" },
      { id: "private", type: "paragraph", props: { visibility: "private" }, content: "Never publish" },
      { id: "image", type: "image", props: { url: "javascript:alert(1)" } }
    ]);
    const spec: CanvasLayoutSpec = {
      template: "landing-page",
      breakpoints: { ...DEFAULT_CANVAS_BREAKPOINTS },
      theme: CANVAS_THEME_PRESETS.editorial,
      root: {
        id: "root",
        type: "stack",
        direction: "vertical",
        gap: { mobile: 8, tablet: 16, desktop: 24 },
        children: [{
          id: "section",
          type: "section",
          blockId: "title",
          children: [{
            id: "columns",
            type: "columns",
            gap: { mobile: 8, tablet: 16 },
            columns: [
              [{ id: "card-copy", type: "card", blockId: "copy" }],
              [{ id: "image-ref", type: "image", blockId: "image" }],
              [{ id: "missing-ref", type: "text", blockId: "deleted" }]
            ]
          }]
        }]
      }
    };

    const html = renderOpenEditorSite(doc, { canvasSpec: spec });
    expect(html).toContain("--oe-site-accent:#8A4B32");
    expect(html).toContain("--oe-site-max-width:920px");
    expect(html).toContain("repeat(1,minmax(0,1fr))");
    expect(html).toContain("repeat(2,minmax(0,1fr))");
    expect(html).toContain("repeat(3,minmax(0,1fr))");
    expect(html).toContain('class="oe-site__card"');
    expect(html).toContain("Content unavailable.");
    expect(html).toContain("Image preview");
    expect(html).toContain("Launch");
    expect(html).toContain("Public copy");
    expect(html).not.toContain("Never publish");
    expect(html).not.toContain("javascript:");
    expect(html).not.toMatch(/<script\b/i);
  });

  it("fails closed on an invalid Canvas theme or layout", () => {
    const doc = document([{ id: "copy", type: "paragraph", content: "Visible" }]);
    const invalid = {
      template: "report",
      breakpoints: { tablet: 900, desktop: 800 },
      theme: "minimal",
      root: { id: "root", type: "text", blockId: "copy" }
    };
    expect(() => renderOpenEditorSite(doc, { canvasSpec: invalid as never })).toThrow(/breakpoints/i);
  });
});

describe("OpenEditor presentation player", () => {
  it("groups visible content into slides and provides accessible keyboard/fullscreen controls", () => {
    const html = renderOpenEditorPresentation(document([
      { id: "lead", type: "paragraph", content: "Introduction" },
      { id: "first", type: "heading", props: { level: 1 }, content: "First slide" },
      { id: "body", type: "paragraph", content: "Slide one" },
      { id: "secret", type: "heading", props: { visibility: "private" }, content: "Hidden slide" },
      { id: "last", type: "heading", props: { level: 1 }, content: "Last slide" }
    ]));

    expect(html).toContain('aria-label="Slide 1 of 3"');
    expect(html).toContain('aria-label="Slide 3 of 3"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('data-previous');
    expect(html).toContain('data-next');
    expect(html).toContain('data-fullscreen');
    expect(html).toContain('requestFullscreen');
    expect(html).toContain('event.key==="ArrowRight"');
    expect(html).toContain('event.key==="ArrowLeft"');
    expect(html).toContain('event.key==="Escape"');
    expect(html).toContain('event.key===" "');
    expect(html).toContain("@media(prefers-reduced-motion:reduce)");
    expect(html).not.toContain("Hidden slide");
    expect(html).not.toMatch(/<iframe\b/i);
  });
});
