/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDocumentIndex } from "../src/index/documentIndex.js";
import { createOpenEditorNotesPreset } from "../src/notes/preset.js";
import { NotesInspector } from "../src/react/NotesInspector.js";
import type { NotesEditorBridge } from "../src/react/notesWorkspacePanels.js";

let root: Root, container: HTMLDivElement, preset: ReturnType<typeof createOpenEditorNotesPreset>;
const scope = { actorId: "synthetic", workspaceId: "cloud-ux" }, target = { kind: "page" as const, pageId: "page" };
const tool = () => container.querySelector<HTMLButtonElement>('.oe-notes-tool-button[aria-label="Text"]')!;
const hover = () => container.querySelector<HTMLElement>('[role="tooltip"]');
beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.useFakeTimers();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  preset = createOpenEditorNotesPreset({ host: {
    scope,
    readDocument: async () => ({ scope, target, revision: "r1", contentRevision: "c1", title: "Page", document: { schemaVersion: 1, blocks: [{ id: "body", type: "paragraph", content: "Text" }] }, metadata: {}, capabilities: ["document.save"], capabilitySemantics: { "document.save": "test-only" } }),
    beforeSubmit: async () => {}, commit: async request => ({ status: "denied", target, operationId: request.operationId }), lookupOperation: async (_target, operationId) => ({ status: "not-found", terminal: true, target, operationId })
  } });
  await preset.controller.open(target);
  const index = createDocumentIndex(); index.replaceFromBlocks(preset.controller.getState().snapshot!.document.blocks);
  const bridge: NotesEditorBridge = { index, installedBlockTypes: ["paragraph"], supportedInsertActions: ["text"], supportedStyleActions: [], editable: true, focusBlock: () => {}, toggleTask: () => {}, insert: async () => {}, format: async () => {} };
  await act(async () => root.render(<NotesInspector classic language="en" controller={preset.controller} bridge={bridge} />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); preset.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; });
const enter = () => act(() => tool().dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
const advance = (time: number) => act(() => vi.advanceTimersByTime(time));

describe("deliberate, accessible inspector previews", () => {
  it("does not flash previews when crossing the rail, but shows a deliberate hover", () => {
    enter(); advance(349); expect(hover()).toBeNull(); advance(1); expect(hover()).not.toBeNull();
    expect(tool().getAttribute("aria-describedby")).toBe(hover()!.id); expect(tool().title).toBe("");
    act(() => tool().dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))); advance(120); expect(hover()).toBeNull();
    enter(); advance(100); act(() => tool().dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))); advance(500); expect(hover()).toBeNull();
  });
  it("shows keyboard descriptions immediately, preserves IME Escape, and dismisses ordinary Escape", () => {
    act(() => tool().focus()); expect(hover()).not.toBeNull();
    act(() => tool().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, isComposing: true }))); expect(hover()).not.toBeNull();
    act(() => tool().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))); expect(hover()).toBeNull(); expect(document.activeElement).toBe(tool());
  });
  it("cancels pending previews on scroll so they cannot appear after navigation", () => {
    enter(); advance(100); act(() => window.dispatchEvent(new Event("scroll"))); advance(500); expect(hover()).toBeNull();
  });
  it("does not start hover previews on a hoverless pointer", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true })); enter(); advance(500); expect(hover()).toBeNull();
    act(() => tool().focus()); expect(hover()).not.toBeNull();
  });
});
