/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOpenEditorNotesPreset } from "../src/notes/preset.js";
import { NotesPageHeader } from "../src/react/NotesPageHeader.js";

let root: Root, container: HTMLDivElement, preset: ReturnType<typeof createOpenEditorNotesPreset>;
const scope = { actorId: "synthetic", workspaceId: "metadata-row" }, target = { kind: "page" as const, pageId: "page" };
beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  preset = createOpenEditorNotesPreset({ host: {
    scope,
    readDocument: async () => ({ scope, target, revision: "r1", contentRevision: "c1", title: "Page", document: { schemaVersion: 1, blocks: [] }, metadata: { tags: ["existing"] }, capabilities: ["document.save", "metadata.patch"], capabilitySemantics: { "document.save": "test-only", "metadata.patch": "test-only" } }),
    beforeSubmit: async () => {}, commit: async request => ({ status: "denied", target, operationId: request.operationId }), lookupOperation: async (_target, operationId) => ({ status: "not-found", terminal: true, target, operationId })
  } });
  await preset.controller.open(target);
});
afterEach(() => { act(() => root.unmount()); container.remove(); preset.dispose(); delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; });

describe("wrapping metadata actions preserve their independent input owners", () => {
  it("keeps the host cover form outside the tag form and outside the title grid", async () => {
    await act(async () => root.render(<NotesPageHeader controller={preset.controller} language="en" onShowPages={() => {}} onOpen={async () => false} appearance={{ fields: { tags: "tags", cover: "cover" }, renderCoverControl: () => <form aria-label="Host cover"><input aria-label="Cover URL" /></form> }} />));
    const actions = container.querySelector(".oe-notes-meta-actions")!;
    expect(actions.children[0]?.className).toBe("oe-notes-cover-control"); expect(actions.children[1]?.className).toBe("oe-notes-tag-editor");
    expect(container.querySelector("form form")).toBeNull(); expect(container.querySelector(".oe-notes-title-editor .oe-notes-cover-control")).toBeNull();
    expect(actions.textContent).toContain("#existing"); expect(container.querySelector<HTMLInputElement>('[aria-label="Page title"]')!.value).toBe("Page");
  });
  it("retains the same title and tag inputs across a title draft update", async () => {
    const render = () => <NotesPageHeader controller={preset.controller} language="en" onShowPages={() => {}} onOpen={async () => false} appearance={{ fields: { tags: "tags" } }} />;
    await act(async () => root.render(render()));
    const title = container.querySelector<HTMLInputElement>('[aria-label="Page title"]')!, tag = container.querySelector<HTMLInputElement>('input[aria-label="Add tag"]')!;
    act(() => preset.controller.setDraft(preset.controller.getState().snapshot!.document, "Updated title"));
    expect(container.querySelector('[aria-label="Page title"]')).toBe(title); expect(container.querySelector('input[aria-label="Add tag"]')).toBe(tag); expect(title.value).toBe("Updated title");
  });
});
