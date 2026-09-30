import type { CanvasLayoutSpec } from "@hello-ai-company/editor-canvas";
import type { CanvasEditorViewState } from "@hello-ai-company/editor-canvas/react";
import type { CanvasRenderState, OpenEditorSiteOptions } from "@hello-ai-company/editor-publish";

type CanvasPublicationOptions = Pick<
  OpenEditorSiteOptions,
  "title" | "canvasSpec" | "canvasRenderState"
>;

export function toCanvasRenderState(
  viewState: CanvasEditorViewState | undefined
): CanvasRenderState | undefined {
  if (!viewState) return undefined;
  return {
    hiddenNodeIds: viewState.hiddenNodeIds,
    alignmentByNodeId: viewState.alignmentByNodeId
  };
}

export function createCanvasPublicationOptions(
  title: string,
  canvasSpec: CanvasLayoutSpec,
  viewState: CanvasEditorViewState | undefined
): CanvasPublicationOptions {
  return {
    title,
    canvasSpec,
    canvasRenderState: toCanvasRenderState(viewState)
  };
}
