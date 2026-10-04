import { describe, expect, it } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import {
  DEFAULT_CANVAS_BREAKPOINTS,
  type CanvasLayoutSpec
} from "@hello-ai-company/editor-canvas";
import {
  renderOpenEditorPresentation,
  renderOpenEditorSite
} from "../../../packages/publish/src/index.js";
import {
  createCanvasPublicationOptions,
  toCanvasRenderState
} from "../src/canvasPublication";

describe("Canvas publication options", () => {
  it("projects only publication-safe state and passes the current layout to Site and Present", () => {
    const document = createEditorDocument([
      { id: "hidden-title", type: "heading", content: "Hidden frame" },
      { id: "hidden-copy", type: "paragraph", content: "Hidden Canvas content" },
      { id: "visible-title", type: "heading", content: "Current Canvas frame" },
      { id: "visible-copy", type: "paragraph", content: "Current Canvas content" }
    ]);
    const canvasSpec: CanvasLayoutSpec = {
      template: "presentation",
      breakpoints: { ...DEFAULT_CANVAS_BREAKPOINTS },
      theme: "editorial",
      root: {
        id: "canvas-root",
        type: "stack",
        direction: "vertical",
        children: [
          {
            id: "hidden-frame",
            type: "frame",
            blockId: "hidden-title",
            children: [{ id: "hidden-copy-ref", type: "text", blockId: "hidden-copy" }]
          },
          {
            id: "visible-frame",
            type: "frame",
            blockId: "visible-title",
            children: [{ id: "visible-copy-ref", type: "text", blockId: "visible-copy" }]
          }
        ]
      }
    };
    const viewState = {
      selectedNodeId: "hidden-frame",
      hiddenNodeIds: ["hidden-frame"],
      lockedNodeIds: ["visible-frame"],
      alignmentByNodeId: { "visible-frame": "center" as const },
      breakpoint: "tablet" as const
    };

    const renderState = toCanvasRenderState(viewState);
    expect(renderState).toEqual({
      hiddenNodeIds: ["hidden-frame"],
      alignmentByNodeId: { "visible-frame": "center" }
    });
    expect(Object.keys(renderState ?? {}).sort()).toEqual([
      "alignmentByNodeId",
      "hiddenNodeIds"
    ]);
    expect(toCanvasRenderState(undefined)).toBeUndefined();

    const options = createCanvasPublicationOptions(
      "Workspace primitives",
      canvasSpec,
      viewState
    );
    expect(options.canvasSpec).toBe(canvasSpec);
    expect(options.canvasRenderState).toEqual(renderState);

    const site = renderOpenEditorSite(document, options);
    const presentation = renderOpenEditorPresentation(document, options);
    for (const html of [site, presentation]) {
      expect(html).toContain("Current Canvas frame");
      expect(html).toContain("Current Canvas content");
      expect(html).not.toContain("Hidden Canvas content");
      expect(html).toContain("--oe-site-accent:#8A4B32");
      expect(html).toContain("text-align:center");
    }
  });
});
