import type { NotesPageAppearanceOptions, NotesSelectionAIService } from "@hello-ai-company/editor-blocknote/react";

/** Opt-in, local references and deterministic text. No model, upload or external request. */
export const syntheticDesignAppearance: NotesPageAppearanceOptions = {
  fields: { icon: "icon", tags: "tags", style: "style", cover: "cover", coverAlt: "coverAlt", coverLayout: "coverLayout" },
  coverCatalog: { async read(request) {
    if (request.signal.aborted) throw new Error("Synthetic cancelled");
    return { scope: request.scope, target: request.target, revision: request.revision, items: [
      { id: "synthetic-forest", label: "合成の森", url: `${location.origin}/synthetic-notes-cover.svg`, alt: "合成の森のイラスト", style: "studio", layout: "wide" },
      { id: "synthetic-blueprint", label: "合成の設計図", url: `${location.origin}/synthetic-notes-blueprint.svg`, alt: "合成の設計図のイラスト", style: "blueprint", layout: "cinematic" }
    ] };
  } }
};
export const syntheticDesignAI: NotesSelectionAIService = { async run(request) {
  await new Promise<void>(resolve => setTimeout(resolve, 150));
  if (request.signal.aborted) throw new Error("Synthetic cancelled");
  return { requestId: request.requestId, scope: request.scope, target: request.target, revision: request.revision, contentRevision: request.contentRevision, selectionId: request.selection.id, text: `[合成:${request.action}] ${request.selection.text}${request.instruction ? ` · ${request.instruction}` : ""}` };
} };
