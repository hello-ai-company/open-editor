import { describe, expect, it } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { DEFAULT_CANVAS_BREAKPOINTS, type CanvasLayoutSpec } from "@hello-ai-company/editor-canvas";
import { getPublicKnowledgeContext, renderOpenEditorPresentation, renderOpenEditorSite } from "../src/index.js";

const document = createEditorDocument([
  { id: "private-title", type: "heading", props: { level: 1 }, content: "HIDDEN_HEADING_SENTINEL" },
  { id: "visible", type: "paragraph", content: "VISIBLE_BODY_SENTINEL" }
]);
function spec(type: "stack" | "grid"): CanvasLayoutSpec {
  const children = [
    { id: "title-frame", type: "frame" as const, children: [{ id: "title-ref", type: "text" as const, blockId: "private-title" }] },
    { id: "body-frame", type: "frame" as const, children: [{ id: "body-ref", type: "text" as const, blockId: "visible" }] }
  ];
  return { template: "presentation", theme: "editorial", breakpoints: { ...DEFAULT_CANVAS_BREAKPOINTS }, root: type === "stack"
    ? { id: "root", type, direction: "vertical", children }
    : { id: "root", type, columns: { mobile: 1 }, children } };
}
describe("Canvas visibility in static exports", () => {
  it.each(["stack", "grid"] as const)("keeps all children of a hidden %s root out of Present", type => {
    const options = { canvasSpec: spec(type), canvasRenderState: { hiddenNodeIds: ["root"] } };
    const html = renderOpenEditorPresentation(document, options);
    expect(html).not.toContain("VISIBLE_BODY_SENTINEL");
    expect(html).not.toContain("HIDDEN_HEADING_SENTINEL");
    expect(html).toContain("No public content");
  });
  it.each([renderOpenEditorPresentation, renderOpenEditorSite])("excludes hidden heading-derived titles from every part of the export", render => {
    const options = { canvasSpec: spec("stack"), canvasRenderState: { hiddenNodeIds: ["title-frame"] } };
    const html = render(document, options);
    expect(html).toContain("VISIBLE_BODY_SENTINEL");
    expect(html).not.toContain("HIDDEN_HEADING_SENTINEL");
    expect(getPublicKnowledgeContext(document, options).title).not.toContain("HIDDEN_HEADING_SENTINEL");
  });
  it("keeps an explicitly supplied title when a source heading is hidden", () => {
    const html = renderOpenEditorPresentation(document, { title: "Explicit public title", canvasSpec: spec("stack"), canvasRenderState: { hiddenNodeIds: ["title-frame"] } });
    expect(html).toContain("Explicit public title");
    expect(html).not.toContain("HIDDEN_HEADING_SENTINEL");
  });
});
