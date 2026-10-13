/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteViewRaw } from "@blocknote/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createOpenEditorNotesPreset } from "../src/notes/preset.js";
import type { NotesWorkspaceHost } from "../src/notes/contracts.js";
import { NotesBlockNoteDocument } from "../src/react/NotesBlockNoteDocument.js";
import type { NotesEditorBridge } from "../src/react/notesWorkspacePanels.js";
import * as fromAdapter from "../src/adapter/fromBlockNote.js";
import * as toAdapter from "../src/adapter/toBlockNote.js";

let root: Root, container: HTMLDivElement;
const editors = new Set<BlockNoteEditor<any, any, any>>();
const presets: ReturnType<typeof createOpenEditorNotesPreset>[] = [];
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  for (const editor of editors) editor._tiptapEditor.destroy();
  for (const preset of presets) preset.dispose();
  editors.clear(); presets.length = 0; container.remove(); vi.restoreAllMocks();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});

async function fixture(pageId: string, text: string, restrictedAlignment = false) {
  const scope = { actorId: "actor", workspaceId: "workspace" }, target = { kind: "page" as const, pageId };
  const source = createEditorDocument([{ id: `${pageId}-body`, type: "paragraph", content: [{ type: "text", text, styles: {} }] }]);
  const host: NotesWorkspaceHost = {
    scope,
    readDocument: async () => ({ scope, target, title: pageId, document: source, metadata: {}, revision: "r1", contentRevision: "c1", capabilities: ["document.save"], capabilitySemantics: { "document.save": "test-only" } }),
    beforeSubmit: async () => {},
    commit: async request => ({ status: "not-found", target, operationId: request.operationId, terminal: true }),
    lookupOperation: async (_target, operationId) => ({ status: "not-found", target, operationId, terminal: true })
  };
  const preset = createOpenEditorNotesPreset({ host }); presets.push(preset);
  expect(await preset.controller.open(target)).toBe(true);
  let currentEditor!: BlockNoteEditor<any, any, any>, bridge!: NotesEditorBridge;
  act(() => root.render(<NotesBlockNoteDocument key={pageId} preset={preset} insertion={restrictedAlignment ? { scope, nativeFormattingItems: ["textAlignLeftButton", "textAlignCenterButton", "textAlignRightButton"], nativeFormattingBlockTypes: ["paragraph"] } : undefined} onBridge={value => { bridge = value; }} render={({ editor }) => {
    currentEditor = editor; editors.add(editor);
    return <BlockNoteViewRaw editor={editor} sideMenu={false} slashMenu={false} formattingToolbar={false} linkToolbar={false} filePanel={false} tableHandles={false} emojiPicker={false} />;
  }} />));
  return { preset, source, get editor() { return currentEditor; }, get bridge() { return bridge; } };
}

describe("Notes document native editor initialization", () => {
  it("publishes native text edits without remounting or recomputing initial content", async () => {
    const f = await fixture("first", "Original source"), editor = f.editor;
    const from = vi.spyOn(fromAdapter, "fromBlockNote"), to = vi.spyOn(toAdapter, "toBlockNoteForSchema"), replace = vi.spyOn(editor, "replaceBlocks");
    const publish = vi.spyOn(f.preset.controller, "setDraft");
    for (let i = 0; i < 20; i++) await act(async () => { editor.updateBlock("first-body", { content: `Native text edit ${i}` }); });
    expect(f.editor).toBe(editor);
    expect(from).toHaveBeenCalledTimes(20); expect(to).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(20);
    expect(f.preset.controller.getState().draft!.blocks[0]!.content).toEqual([{ type: "text", text: "Native text edit 19", styles: {} }]);
  });

  it("keeps the same native editor and document through unrelated controller updates", async () => {
    const f = await fixture("first", "Original source"), editor = f.editor;
    const before = editor.document, from = vi.spyOn(fromAdapter, "fromBlockNote"), to = vi.spyOn(toAdapter, "toBlockNoteForSchema");
    const replace = vi.spyOn(editor, "replaceBlocks");
    act(() => f.preset.controller.setComposing(true));
    expect(f.bridge.commandsAvailable).toBe(false);
    act(() => f.preset.controller.setComposing(false));
    act(() => f.preset.controller.setLocalDraft("source", { body: "Retained input" }));
    expect(f.bridge.commandsAvailable).toBe(false);
    act(() => f.preset.controller.setLocalDraft("source", undefined));
    expect(f.editor).toBe(editor); expect(editor.document).toEqual(before);
    expect(from).not.toHaveBeenCalled(); expect(to).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled();
  });

  it("applies a new external draft through the existing native writer exactly once", async () => {
    const f = await fixture("first", "Original source"), editor = f.editor;
    const from = vi.spyOn(fromAdapter, "fromBlockNote"), to = vi.spyOn(toAdapter, "toBlockNoteForSchema"), replace = vi.spyOn(editor, "replaceBlocks");
    const next = createEditorDocument([{ id: "external", type: "paragraph", content: [{ type: "text", text: "External source", styles: {} }] }]);
    act(() => f.preset.controller.setDraft(next));
    expect(f.editor).toBe(editor); expect(editor.getBlock("external")).toBeDefined();
    expect(replace).toHaveBeenCalledTimes(1); expect(to).toHaveBeenCalledTimes(1); expect(from).toHaveBeenCalledTimes(1);
    expect(f.preset.controller.getState().draft).toEqual(next);
  });

  it("keeps the real mounted native alignment transaction guard active across IME and pending input", async () => {
    const f = await fixture("aligned", "Original source", true), editor = f.editor, initial = fromAdapter.fromBlockNote(editor.document);
    act(() => { editor.updateBlock("aligned-body", { props: { textAlignment: "start" } } as never); });
    expect(fromAdapter.fromBlockNote(editor.document)).toEqual(initial);
    act(() => { f.preset.controller.setComposing(true); editor.updateBlock("aligned-body", { props: { textAlignment: "right" } } as never); });
    expect(fromAdapter.fromBlockNote(editor.document)).toEqual(initial);
    act(() => f.preset.controller.setComposing(false));
    act(() => { editor.updateBlock("aligned-body", { props: { textAlignment: "center" } } as never); });
    const centered = fromAdapter.fromBlockNote(editor.document);
    expect(centered.blocks[0]!.props!.textAlignment).toBe("center"); expect(f.preset.controller.getState().draft).toEqual(centered);
    act(() => { f.preset.controller.setLocalDraft("retained", { body: "Pending" }); editor.updateBlock("aligned-body", { props: { textAlignment: "right" } } as never); });
    expect(fromAdapter.fromBlockNote(editor.document)).toEqual(centered);
    act(() => f.preset.controller.setLocalDraft("retained", undefined));
    act(() => { editor.updateBlock("aligned-body", { props: { textAlignment: "right" } } as never); });
    expect(f.preset.controller.getState().draft!.blocks[0]!.props!.textAlignment).toBe("right");
  });

  it("fences old native alignment while a new controller draft is awaiting projection", async () => {
    const f = await fixture("aligned", "Original source", true), editor = f.editor;
    const next = createEditorDocument([{ id: "external", type: "paragraph", props: { textAlignment: "justify" }, content: "External source" }]);
    const before = fromAdapter.fromBlockNote(editor.document);
    act(() => {
      f.preset.controller.setDraft(next);
      editor.updateBlock("aligned-body", { props: { textAlignment: "right" } } as never);
      expect(fromAdapter.fromBlockNote(editor.document)).toEqual(before);
    });
    expect(editor.getBlock("aligned-body")).toBeUndefined();
    expect(editor.getBlock("external")!.props.textAlignment).toBe("justify");
    expect(f.preset.controller.getState().draft).toEqual(next);
  });

  it("initializes fresh content for a newly keyed native writer", async () => {
    const first = await fixture("first", "First source"), editor = first.editor;
    const second = await fixture("second", "Second source");
    expect(second.editor).not.toBe(editor);
    expect(second.editor.getBlock("second-body")).toBeDefined();
    expect(second.editor.getBlock("first-body")).toBeUndefined();
    expect(second.preset.controller.getState().draft).toEqual(second.source);
    expect(first.bridge.commandsAvailable).toBe(false);
  });
});
