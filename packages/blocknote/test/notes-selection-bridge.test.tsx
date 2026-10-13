/** @vitest-environment jsdom */
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { NotesBlockNoteDocument, type NotesDocumentRenderer } from "../src/react/NotesBlockNoteDocument.js";
import * as fromAdapter from "../src/adapter/fromBlockNote.js";
import * as toAdapter from "../src/adapter/toBlockNote.js";
import { NotesWorkspace, type NotesWorkspacePreset } from "../src/react/NotesWorkspace.js";
import type { NotesEditorBridge } from "../src/react/notesWorkspacePanels.js";
import type { NotesWorkspaceController, NotesWorkspaceState } from "../src/notes/contracts.js";

import { LinkToolbarExtension, SuggestionMenu } from "@blocknote/core/extensions";
import { en } from "@blocknote/core/locales";
import { BlockNoteContext, ComponentsContext, EditLinkMenuItems } from "@blocknote/react";
import { notesNativeLinkCompositionSignal } from "../src/react/notesLinkPolicy.js";
import { EditorState } from "@tiptap/pm/state";
import { Schema } from "@tiptap/pm/model";
const hook = vi.hoisted(() => ({ editor: undefined as any, options: undefined as any }));
vi.mock("@blocknote/react", async original => ({ ...await original<typeof import("@blocknote/react")>(), useCreateBlockNote: (options: any) => { hook.options = options; return hook.editor; } }));
let root: Root, container: HTMLDivElement;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; });
function fixture(withPagePicker = false, localInsertKinds?: import("../src/react/notesWorkspacePanels.js").NotesInsertKind[], policy?: import("../src/react/NotesInsertDialog.js").NotesInsertionHost, render?: NotesDocumentRenderer) {
  const source = createEditorDocument([{ id: "block", type: "paragraph", content: [{ type: "text", text: "Selected source", styles: {} }] }]);
  let state: NotesWorkspaceState = { status: "ready", dirty: false, composing: false, pendingEditors: false, localDrafts: {}, message: "", snapshot: { scope: { actorId: "actor", workspaceId: "workspace" }, target: { kind: "page", pageId: "page" }, revision: "r1", contentRevision: "b1", title: "Synthetic", metadata: {}, document: source, capabilities: ["document.save"], capabilitySemantics: { "document.save": "test-only" } } };
  const listeners = new Set<() => void>(), update = (patch: Partial<NotesWorkspaceState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  const controller: NotesWorkspaceController = { getState: () => state, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, setDraft: vi.fn(document => update({ draft: document, dirty: true })), setLocalDraft(id, value) { const localDrafts = { ...state.localDrafts }; if (value === undefined) delete localDrafts[id]; else localDrafts[id] = value; update({ localDrafts, pendingEditors: Object.keys(localDrafts).length > 0 }); }, setComposing: value => update({ composing: value }), open: vi.fn(), save: vi.fn(), execute: vi.fn(), cancel: vi.fn(), reconcile: vi.fn(), getRecovery: vi.fn(), persistLocalDrafts: vi.fn(), readLatest: vi.fn(), acceptMergedDraft: vi.fn(), dispose: vi.fn() };
  const selectionListeners = new Set<() => void>(), changeListeners = new Set<() => void>();
  const searchSchema = new Schema({ nodes: { doc: { content: "paragraph+" }, paragraph: { content: "text*" }, text: {} } });
  let pm = EditorState.create({ schema: searchSchema, doc: searchSchema.node("doc", null, [searchSchema.node("paragraph", null, searchSchema.text("Selected source"))]) });
  const suggestion = { store: { subscribe: vi.fn(() => () => undefined) } };
  const toolbar = { store: { setState: vi.fn() } };
  const tiptap = { get state() { return pm; }, view: { dom: document.createElement("div"), dispatch(tr: Parameters<typeof pm.apply>[0]) { pm = pm.apply(tr); } }, registerPlugin(plugin: typeof pm.plugins[number]) { pm = pm.reconfigure({ plugins: [...pm.plugins, plugin] }); }, unregisterPlugin(key: { get(state: typeof pm): typeof pm.plugins[number] | undefined }) { pm = pm.reconfigure({ plugins: pm.plugins.filter(plugin => plugin !== key.get(pm)) }); } };
  const editor = { dictionary: en, editLink: vi.fn((_href: string, _text: string, _position?: number) => {}), get prosemirrorState() { return pm; }, prosemirrorView: tiptap.view, setTextCursorPosition: vi.fn(), createLink: vi.fn((href: string, text?: string) => {
    const content = text === undefined ? editor.document[0]!.content : [{ type: "text", text, styles: {} }];
    editor.document[0]!.content = [{ type: "link", href, content }] as never;
    changeListeners.forEach(fn => fn());
  }), getExtension: (extension: unknown) => extension === SuggestionMenu ? suggestion : extension === LinkToolbarExtension ? { editLink: (href: string, text: string, position?: number) => editor.editLink(href, text, position) } : toolbar, _tiptapEditor: tiptap, focus: vi.fn(), document: [{ id: "block", type: "paragraph", props: {}, content: [{ type: "text", text: "Selected source", styles: {} }], children: [] }], isEditable: true, onChange: (fn: () => void) => { changeListeners.add(fn); return () => changeListeners.delete(fn); }, onSelectionChange: (fn: () => void) => { selectionListeners.add(fn); return () => selectionListeners.delete(fn); }, getSelection: () => ({ blocks: editor.document }), getSelectedText: () => editor.document[0]!.content[0]!.text, getTextCursorPosition: () => ({ block: editor.document[0] }), getBlock: (id: string) => editor.document.find(block => block.id === id), replaceBlocks: vi.fn((_old, next) => { editor.document = next; }), insertInlineContent: vi.fn((text: string) => { editor.document[0]!.content = [{ type: "text", text, styles: {} }]; selectionListeners.forEach(fn => fn()); changeListeners.forEach(fn => fn()); }) };
  const nativeCreateLink = editor.createLink;
  const nativeEditLink = editor.editLink;
  hook.editor = editor;
  const preset = { controller, config: { locale: "ja" }, schema: { blockSchema: { paragraph: {} }, styleSchema: { bold: { type: "bold", propSchema: "boolean" }, italic: { type: "italic", propSchema: "boolean" } } }, host: { scope: state.snapshot!.scope }, editorOptions: () => ({}) } as unknown as NotesWorkspacePreset;
  if (withPagePicker) {
    preset.schema.blockSchema.childPage = {} as never;
    preset.host.readWorkspace = vi.fn();
    update({ snapshot: { ...state.snapshot!, capabilities: [...state.snapshot!.capabilities, "page.create"], capabilitySemantics: { ...state.snapshot!.capabilitySemantics, "page.create": "test-only" } } });
  }
  let bridge!: NotesEditorBridge;
  act(() => root.render(<NotesBlockNoteDocument preset={preset} insertion={policy ?? (localInsertKinds ? { scope: state.snapshot!.scope, localInsertKinds } : undefined)} onBridge={value => { bridge = value; }} render={render ?? (() => <p>Public editor harness</p>)} />));
  const review = () => { const selection = bridge.captureSelection!()!; expect(selection).toBeDefined(); const key = "reviewed-selection", draft = { kind: "selection", selection, proposal: "Reviewed output", instruction: "first" }; act(() => controller.setLocalDraft(key, draft)); return { selection, key, draft, expected: JSON.stringify(draft) }; };
  return { preset, controller, editor, nativeCreateLink, nativeEditLink, toolbar, update, source, review, selectionListeners, get bridge() { return bridge; } };
}

// Exercise BlockNote's actual Enter handler; only the visual provider and editor
// command port are test doubles. Match both browser-observed popup ancestors.
const nativeFormComponents = { Generic: { Form: {
  Root: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TextInput: ({ name, value, onChange, onKeyDown, onSubmit }: any) => <input name={name} aria-label={name} value={value} onChange={onChange} onKeyDown={onKeyDown} onSubmit={onSubmit} />,
} } };
function NativeLinkFields({ editor, kind }: { editor: any; kind: "create" | "edit" }) {
  const [open, setOpen] = useState(true);
  return <BlockNoteContext.Provider value={{ editor }}><ComponentsContext.Provider value={nativeFormComponents as never}>
    <div className="bn-editor" contentEditable suppressContentEditableWarning>Editor</div>
    <button onClick={() => setOpen(true)}>Reopen</button>
    {open ? <div className={kind === "create" ? "oe-notes-format-item" : "bn-toolbar bn-link-toolbar"} data-notes-native-item={kind === "create" ? "createLinkButton" : undefined}>
      <div className="bn-popover-content bn-form-popover" role="dialog" onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
        <EditLinkMenuItems url="https://example.invalid" text="Selected source" range={{ from: 1, to: 16 }} setToolbarOpen={setOpen} />
        <button onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div> : null}
  </ComponentsContext.Provider></BlockNoteContext.Provider>;
}
const nativeKey = (input: Element, extra = {}) => { const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...extra }); act(() => { input.dispatchEvent(event); }); return event; };
const nativeComposition = (input: Element, type: "compositionstart" | "compositionend") => { const event = new CompositionEvent(type, { bubbles: true, cancelable: true }); act(() => { input.dispatchEvent(event); }); return event; };
const nativeInputFixture = (kind: "create" | "edit", restricted = true) => fixture(false, undefined, restricted ? { scope: { actorId: "actor", workspaceId: "workspace" }, pickerInsertKinds: ["link"] } : undefined, ({ editor }) => <NativeLinkFields editor={editor} kind={kind} />);

describe("restricted native link field composition", () => {
  it.each(["create", "edit"] as const)("keeps the %s field mounted through IME and standalone Enter229 until ordinary Return", kind => {
    const f = nativeInputFixture(kind), input = container.querySelector<HTMLInputElement>('input[name="url"]')!; input.focus();
    expect(nativeKey(input, { keyCode: 229 }).defaultPrevented).toBe(false);
    expect(f.nativeEditLink).not.toHaveBeenCalled(); expect(input.isConnected).toBe(true);
    expect(nativeComposition(input, "compositionstart").defaultPrevented).toBe(false);
    expect(notesNativeLinkCompositionSignal(f.controller).getSnapshot()).toBe(true);
    expect(f.controller.getState().composing).toBe(false); expect(document.activeElement).toBe(input);
    expect(nativeKey(input, { isComposing: true }).defaultPrevented).toBe(false);
    expect(nativeKey(input, { repeat: true }).defaultPrevented).toBe(false);
    const submit = new Event("submit", { bubbles: true, cancelable: true }); act(() => { input.dispatchEvent(submit); }); expect(submit.defaultPrevented).toBe(true);
    act(() => f.editor.editLink("https://example.invalid", "Selected source", 1));
    expect(f.nativeEditLink).not.toHaveBeenCalled(); expect(input.isConnected).toBe(true);
    expect(nativeComposition(input, "compositionend").defaultPrevented).toBe(false);
    expect(notesNativeLinkCompositionSignal(f.controller).getSnapshot()).toBe(false);
    nativeKey(input); expect(f.nativeEditLink).toHaveBeenCalledOnce(); expect(input.isConnected).toBe(false);
    expect(f.controller.setDraft).not.toHaveBeenCalled(); expect(f.controller.save).not.toHaveBeenCalled();
  });
  it.each(["Cancel", "Escape"])("allows %s during composition and does not retain the guard on reopen", dismissal => {
    const f = nativeInputFixture("edit"), input = container.querySelector<HTMLInputElement>('input[name="title"]')!; input.focus(); nativeComposition(input, "compositionstart");
    if (dismissal === "Escape") nativeKey(input, { key: "Escape" });
    else act(() => [...container.querySelectorAll("button")].find(button => button.textContent === "Cancel")!.click());
    expect(input.isConnected).toBe(false); expect(f.nativeEditLink).not.toHaveBeenCalled(); expect(f.controller.getState().composing).toBe(false);
    act(() => [...container.querySelectorAll("button")].find(button => button.textContent === "Reopen")!.click());
    nativeKey(container.querySelector<HTMLInputElement>('input[name="url"]')!); expect(f.nativeEditLink).toHaveBeenCalledOnce();
  });
  it("clears field composition on blur while preserving normal editor composition", () => {
    const f = nativeInputFixture("edit"), input = container.querySelector<HTMLInputElement>('input[name="url"]')!; input.focus(); nativeComposition(input, "compositionstart");
    const editor = container.querySelector<HTMLElement>(".bn-editor")!; act(() => editor.focus());
    nativeComposition(editor, "compositionstart"); expect(f.controller.getState().composing).toBe(true);
    act(() => f.editor.editLink("https://example.invalid", "Selected source", 1)); expect(f.nativeEditLink).not.toHaveBeenCalled();
    nativeComposition(editor, "compositionend"); expect(f.controller.getState().composing).toBe(false);
    input.focus(); nativeKey(input); expect(f.nativeEditLink).toHaveBeenCalledOnce();
  });
  it("preserves the unrestricted host's native event behavior", () => {
    const f = nativeInputFixture("edit", false), input = container.querySelector<HTMLInputElement>('input[name="url"]')!;
    nativeComposition(input, "compositionstart"); expect(f.controller.getState().composing).toBe(true);
    expect(notesNativeLinkCompositionSignal(f.controller).getSnapshot()).toBe(false);
    nativeComposition(input, "compositionend"); expect(f.controller.getState().composing).toBe(false);
    nativeKey(input, { keyCode: 229 }); expect(f.nativeEditLink).toHaveBeenCalledOnce();
  });
  it("releases the private Save interlock when its composing writer unmounts", () => {
    const f = nativeInputFixture("edit"), input = container.querySelector<HTMLInputElement>('input[name="url"]')!;
    nativeComposition(input, "compositionstart"); expect(notesNativeLinkCompositionSignal(f.controller).getSnapshot()).toBe(true);
    act(() => root.render(null)); expect(notesNativeLinkCompositionSignal(f.controller).getSnapshot()).toBe(false);
  });
  it("releases the actual shell Save lock on a props-only insertion owner change", () => {
    const f = fixture(), render: NotesDocumentRenderer = ({ editor }) => <NativeLinkFields editor={editor} kind="edit" />;
    const insertion = { scope: { actorId: "actor", workspaceId: "workspace" }, pickerInsertKinds: ["link" as const] };
    act(() => { root.render(<NotesWorkspace preset={f.preset} insertion={insertion} renderDocument={render} />); f.update({ dirty: true }); });
    const input = container.querySelector<HTMLInputElement>('input[name="url"]')!, save = [...container.querySelectorAll("button")].find(button => button.textContent === "保存")!;
    input.focus(); nativeComposition(input, "compositionstart"); expect(save.disabled).toBe(true); expect(input.isConnected).toBe(true); expect(document.activeElement).toBe(input);
    act(() => root.render(<NotesWorkspace preset={f.preset} insertion={{ ...insertion, scope: { ...insertion.scope, actorId: "different-owner" } }} renderDocument={render} />));
    expect(notesNativeLinkCompositionSignal(f.controller).getSnapshot()).toBe(false); expect(save.disabled).toBe(false); expect(input.isConnected).toBe(true);
  });
});
describe("live public Notes selection bridge guards", () => {
  it("keeps unrestricted hosts unchanged while restricting the owner picker and native formats", () => {
    const unrestricted = fixture(); expect(unrestricted.bridge.supportedInsertActions).toContain("link"); expect(unrestricted.bridge.supportedStyleActions).toContain("fontSerif"); expect(unrestricted.bridge.supportedNativeFormattingItems).toBeUndefined(); expect(hook.options.links).toBeUndefined();
    expect(container.querySelector(".oe-notes-blocknote-document")!.hasAttribute("data-notes-restricted-links")).toBe(false);
    const policy = { scope: { actorId: "actor", workspaceId: "workspace" }, pickerInsertKinds: [], localStyleKinds: ["clearFormatting" as const], nativeFormattingItems: ["boldStyleButton"], nativeFormattingBlockTypes: ["paragraph"] };
    const f = fixture(false, undefined, policy); expect(f.bridge.supportedInsertActions).toEqual(["text"]); expect(f.bridge.supportedStyleActions).toEqual(["clearFormatting"]); expect(f.bridge.supportedNativeFormattingItems).toEqual(["boldStyleButton"]);
    expect(() => f.bridge.format("fontSerif", new AbortController().signal)).toThrow("Formatting unavailable"); expect(f.controller.setDraft).not.toHaveBeenCalled();
  });
  it("rechecks format/picker policy and scope without waiting for React", () => {
    const policy: import("../src/react/NotesInsertDialog.js").NotesInsertionHost = { scope: { actorId: "actor", workspaceId: "workspace" }, pickerInsertKinds: ["link"], localStyleKinds: ["clearFormatting"], nativeFormattingItems: ["boldStyleButton"] };
    const f = fixture(false, undefined, policy), bridge = f.bridge; expect(bridge.supportedInsertActions).toContain("link");
    policy.pickerInsertKinds = []; policy.localStyleKinds = []; policy.nativeFormattingItems = [];
    expect(bridge.supportedInsertActions).not.toContain("link"); expect(bridge.supportedStyleActions).toEqual([]); expect(bridge.supportedNativeFormattingItems).toEqual([]);
    policy.pickerInsertKinds = ["link"]; policy.localStyleKinds = ["clearFormatting"]; policy.nativeFormattingItems = ["boldStyleButton"]; policy.scope = { ...policy.scope, actorId: "foreign" };
    expect(bridge.supportedInsertActions).not.toContain("link"); expect(bridge.supportedStyleActions).toEqual([]); expect(bridge.supportedNativeFormattingItems).toEqual([]); expect(f.controller.setDraft).not.toHaveBeenCalled();
  });
  it("does not advertise restricted native marks for plain widget selections", () => {
    const f = fixture(false, undefined, { scope: { actorId: "actor", workspaceId: "workspace" }, nativeFormattingItems: ["boldStyleButton"], nativeFormattingBlockTypes: ["paragraph", "table"] });
    f.editor.document[0]!.type = "mathBlock"; expect(f.bridge.supportedNativeFormattingItems).toEqual([]);
    f.editor.document[0]!.type = "table"; expect(f.bridge.supportedNativeFormattingItems).toEqual(["boldStyleButton"]);
  });

  it("hides only the link item on table or cross-block selections outside its host codec", () => {
    const f = fixture(false, undefined, { scope: { actorId: "actor", workspaceId: "workspace" }, pickerInsertKinds: ["link"], nativeFormattingItems: ["boldStyleButton", "createLinkButton"], nativeFormattingBlockTypes: ["paragraph", "table"], linkBlockTypes: ["paragraph"] });
    expect(f.bridge.supportedNativeFormattingItems).toEqual(["boldStyleButton", "createLinkButton"]);
    expect(f.bridge.supportedInsertActions).toContain("link");
    f.editor.document[0]!.type = "table";
    expect(f.bridge.supportedNativeFormattingItems).toEqual(["boldStyleButton"]);
    expect(f.bridge.supportedInsertActions).not.toContain("link");
    f.editor.document.push({ ...f.editor.document[0]!, id: "another", type: "paragraph" });
    expect(f.bridge.supportedNativeFormattingItems).toEqual(["boldStyleButton"]);
    expect(f.bridge.supportedInsertActions).not.toContain("link");
  });
  it("hides only link creation for a hardbreak block, even without a native toolbar allowlist", () => {
    const f = fixture(false, undefined, { scope: { actorId: "actor", workspaceId: "workspace" }, pickerInsertKinds: ["link"], allowLinkHardBreaks: false });
    expect(f.bridge.supportedNativeFormattingItems).toBeUndefined();
    f.editor.document[0]!.content[0]!.text = "First\nsecond";
    expect(f.bridge.supportedNativeFormattingItems).toContain("boldStyleButton");
    expect(f.bridge.supportedNativeFormattingItems).not.toContain("createLinkButton");
    expect(f.bridge.supportedInsertActions).not.toContain("link");
  });
  it.each([" label ", "  "])("keeps the selected %j range and its marks when opening and submitting the link picker", async label => {
    const f = fixture(false, undefined, { scope: { actorId: "actor", workspaceId: "workspace" }, pickerInsertKinds: ["link"], isValidLink: href => href === "https://example.invalid", linkBlockTypes: ["paragraph"], allowLinkHardBreaks: false });
    act(() => { f.controller.setDraft(createEditorDocument([{ id: "block", type: "paragraph", content: [{ type: "text", text: label, styles: { bold: true, italic: true } }] }])); });
    let pending: void | Promise<void>;
    await act(async () => { pending = f.bridge.requestInsert!("link", new AbortController().signal, { anchor: { blockId: "block", placement: "after" } }); });
    expect(f.editor.setTextCursorPosition).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLInputElement>('input[aria-label="リンクの表示文字"]')!.value).toBe(label);
    act(() => { const input = container.querySelector<HTMLInputElement>('input[aria-label="リンク先URL"]')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "https://example.invalid"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => { [...container.querySelectorAll("button")].find(button => button.textContent === "確認して本文に挿入")!.click(); await pending; });
    expect(f.nativeCreateLink).toHaveBeenCalledWith("https://example.invalid", undefined);
    expect(f.controller.getState().draft?.blocks[0]!.content).toEqual([{ type: "link", href: "https://example.invalid", content: [{ type: "text", text: label, styles: { bold: true, italic: true } }] }]);
    expect(f.controller.execute).not.toHaveBeenCalled(); expect(f.controller.save).not.toHaveBeenCalled();
  });
  it("preserves the SDK picker’s explicit internal page URL without relaxing native ingress", async () => {
    const f = fixture(false, undefined, { scope: { actorId: "actor", workspaceId: "workspace" }, pickerInsertKinds: ["link"] });
    expect(hook.options.links.isValidLink("openeditor://page/authorized")).toBe(false);
    let pending: void | Promise<void>;
    await act(async () => { pending = f.bridge.requestInsert!("link", new AbortController().signal, { anchor: { blockId: "block", placement: "after" } }); });
    act(() => { const input = container.querySelector<HTMLInputElement>('input[aria-label="リンク先URL"]')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "openeditor://page/authorized"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => { [...container.querySelectorAll("button")].find(button => button.textContent === "確認して本文に挿入")!.click(); await pending; });
    expect(f.nativeCreateLink).toHaveBeenCalledWith("openeditor://page/authorized", undefined);
    expect((f.controller.getState().draft?.blocks[0]!.content as any)[0].href).toBe("openeditor://page/authorized");
  });
  it("binds the live owner policy to the actual BlockNote link option", () => {
    const policy: import("../src/react/NotesInsertDialog.js").NotesInsertionHost = { scope: { actorId: "actor", workspaceId: "workspace" }, pickerInsertKinds: [] };
    fixture(false, undefined, policy); const validate = hook.options.links.isValidLink;
    expect(container.querySelector(".oe-notes-blocknote-document")!.getAttribute("data-notes-restricted-links")).toBe("true");
    expect(validate("https://example.invalid")).toBe(false); policy.pickerInsertKinds = ["link"];
    expect(validate("https://example.invalid")).toBe(true); expect(validate("javascript:alert(1)")).toBe(false);
  });
  it("honors the host local-insert restriction without adding a writer or granting a picker", () => {
    const f = fixture(false, []); expect(f.bridge.supportedInsertActions).toEqual(["link"]);
    expect(f.controller.setDraft).not.toHaveBeenCalled(); expect(f.controller.execute).not.toHaveBeenCalled();
  });
  it("revokes picker catalog entries immediately when the capability changes without replacing the bridge", () => {
    const f = fixture(true), bridge = f.bridge;
    expect(bridge.supportedInsertActions).toContain("page");
    act(() => { f.update({ snapshot: { ...f.controller.getState().snapshot!, capabilities: ["document.save"], capabilitySemantics: { "document.save": "test-only" } } }); expect(bridge.supportedInsertActions).not.toContain("page"); });
    expect(f.bridge).toBe(bridge);
  });
  it("converts each body edit once without recomputing mount-only projections", () => {
    const f = fixture(), from = vi.spyOn(fromAdapter, "fromBlockNote"), to = vi.spyOn(toAdapter, "toBlockNoteForSchema");
    f.editor.replaceBlocks.mockClear();
    for (let i = 0; i < 20; i++) act(() => f.editor.insertInlineContent(`Human edit ${i}`));
    expect(from).toHaveBeenCalledTimes(20);
    expect(to).not.toHaveBeenCalled();
    expect(f.controller.setDraft).toHaveBeenCalledTimes(20);
    expect(f.editor.replaceBlocks).not.toHaveBeenCalled();
  });
  it("does not convert the body for status, composition or source-draft updates", () => {
    const f = fixture(), from = vi.spyOn(fromAdapter, "fromBlockNote"), to = vi.spyOn(toAdapter, "toBlockNoteForSchema");
    f.editor.replaceBlocks.mockClear();
    for (let i = 0; i < 5; i++) act(() => f.update({ message: `Status ${i}` }));
    act(() => f.controller.setComposing(true));
    act(() => f.controller.setComposing(false));
    act(() => f.controller.setLocalDraft("source", { body: "Unapplied source" }));
    act(() => f.controller.setLocalDraft("source", undefined));
    expect(from).not.toHaveBeenCalled();
    expect(to).not.toHaveBeenCalled();
    expect(f.controller.setDraft).not.toHaveBeenCalled();
    expect(f.editor.replaceBlocks).not.toHaveBeenCalled();
  });
  it("still projects external documents once and treats a canonical acknowledgement as unchanged", () => {
    const f = fixture(), from = vi.spyOn(fromAdapter, "fromBlockNote"), to = vi.spyOn(toAdapter, "toBlockNoteForSchema");
    const external = createEditorDocument([{ id: "external", type: "paragraph", content: [{ type: "text", text: "External body", styles: {} }] }]);
    f.editor.replaceBlocks.mockClear();
    act(() => f.update({ draft: external }));
    expect(f.editor.replaceBlocks).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledTimes(1);
    from.mockClear(); to.mockClear(); f.editor.replaceBlocks.mockClear();
    act(() => f.update({ draft: undefined, dirty: false, snapshot: { ...f.controller.getState().snapshot!, document: external, revision: "r2", contentRevision: "b2" } }));
    expect(from).not.toHaveBeenCalled();
    expect(to).not.toHaveBeenCalled();
    expect(f.editor.replaceBlocks).not.toHaveBeenCalled();
    expect(f.controller.setDraft).not.toHaveBeenCalled();
  });
  it("revokes shared commands immediately during composition, retained input, saving and unmount", () => {
    const f = fixture(), bridge = f.bridge; expect(bridge.commandsAvailable).toBe(true);
    act(() => { f.controller.setComposing(true); expect(bridge.commandsAvailable).toBe(false); f.controller.setComposing(false); f.controller.setLocalDraft("human", { body: "Retained human input" }); expect(bridge.commandsAvailable).toBe(false); });
    act(() => { f.controller.setLocalDraft("human", undefined); expect(bridge.commandsAvailable).toBe(true); f.update({ status: "saving" }); expect(bridge.commandsAvailable).toBe(false); });
    act(() => { f.update({ status: "ready" }); root.render(null); }); expect(bridge.commandsAvailable).toBe(false);
  });
  it("searches and selects without changing the body/cache/undo writer, and revokes on unmount", () => {
    const f = fixture(), bridge = f.bridge;
    act(() => { expect(bridge.setSearchQuery!("source")).toEqual({ count: 1, capped: false }); expect(bridge.focusSearchMatch!(0)).toBe(true); });
    expect(f.controller.setDraft).not.toHaveBeenCalled(); expect(f.controller.getState().localDrafts).toEqual({});
    act(() => { f.controller.setComposing(true); expect(bridge.focusSearchMatch!(0)).toBe(false); });
    act(() => root.render(null)); expect(bridge.setSearchQuery!("source")).toEqual({ count: 0, capped: false }); expect(bridge.focusSearchMatch!(0)).toBe(false);
  });
  it("closes its formatting toolbar on active search and when focus returns to the sidebar", () => {
    const f = fixture(); act(() => f.bridge.setSearchQuery!("source")); expect(f.toolbar.store.setState).toHaveBeenLastCalledWith(false);
    f.toolbar.store.setState.mockClear(); act(() => { f.bridge.focusSearchMatch!(0); f.editor._tiptapEditor.view.dom.dispatchEvent(new Event("blur")); }); expect(f.toolbar.store.setState).toHaveBeenLastCalledWith(false);
    act(() => f.bridge.setSearchQuery!("")); f.toolbar.store.setState.mockClear(); f.editor._tiptapEditor.view.dom.dispatchEvent(new Event("blur")); expect(f.toolbar.store.setState).not.toHaveBeenCalled(); expect(f.controller.setDraft).not.toHaveBeenCalled();
  });
  it.each(["scope", "target", "revision", "contentRevision"])("fences stale search before React applies a new %s", field => {
    const f = fixture(), bridge = f.bridge;
    act(() => bridge.setSearchQuery!("source")); f.editor.focus.mockClear();
    act(() => { const snapshot = f.controller.getState().snapshot!; f.update({ snapshot: { ...snapshot, ...(field === "scope" ? { scope: { ...snapshot.scope, actorId: "other" } } : field === "target" ? { target: { kind: "page", pageId: "other" } } : { [field]: "other" }) } }); expect(bridge.setSearchQuery!("selected")).toEqual({ count: 0, capped: false }); expect(bridge.focusSearchMatch!(0)).toBe(false); });
    expect(f.editor.focus).not.toHaveBeenCalled(); expect(f.controller.setDraft).not.toHaveBeenCalled();
  });
  it("checks live IME state in the same turn before React can rerender", () => {
    const f = fixture(), r = f.review(), bridge = f.bridge;
    act(() => { f.controller.setComposing(true); expect(() => bridge.replaceSelection!(r.selection, "Reviewed output", r.key, r.expected)).toThrow(); }); expect(f.editor.insertInlineContent).not.toHaveBeenCalled(); expect(f.controller.setDraft).not.toHaveBeenCalled();
  });
  it("checks newer same-key input and other input before replacing any text", () => {
    const f = fixture(), r = f.review(), bridge = f.bridge;
    act(() => { f.controller.setLocalDraft(r.key, { ...r.draft, instruction: "newer" }); expect(() => bridge.replaceSelection!(r.selection, "Reviewed output", r.key, r.expected)).toThrow(); }); expect(f.editor.insertInlineContent).not.toHaveBeenCalled(); expect(f.controller.getState().localDrafts[r.key]).toEqual({ ...r.draft, instruction: "newer" });
  });
  it("rejects a selection moved away and back even if text/block IDs are identical", () => {
    const f = fixture(), r = f.review(); act(() => f.selectionListeners.forEach(fn => fn())); expect(f.bridge.isSelectionCurrent!(r.selection)).toBe(false); expect(() => f.bridge.replaceSelection!(r.selection, "Reviewed output", r.key, r.expected)).toThrow();
  });
  it("publishes through the same writer and allows Undo only while the exact applied body is current", () => {
    const f = fixture(), r = f.review(); act(() => f.bridge.replaceSelection!(r.selection, "Reviewed output", r.key, r.expected)); expect(f.controller.setDraft).toHaveBeenCalled(); expect(f.controller.execute).not.toHaveBeenCalled(); act(() => f.controller.setLocalDraft(r.key, undefined)); act(() => expect(f.bridge.undoSelection!(r.selection.id)).toBe(true)); expect(f.controller.getState().draft).toEqual(f.source);
  });
  it.each(["scope", "target", "contentRevision", "revision", "body"])("rejects Undo after changing %s in the same turn", field => {
    const f = fixture(), r = f.review(), bridge = f.bridge; act(() => { bridge.replaceSelection!(r.selection, "Reviewed output", r.key, r.expected); f.controller.setLocalDraft(r.key, undefined); }); const calls = vi.mocked(f.controller.setDraft).mock.calls.length;
    act(() => { const snapshot = f.controller.getState().snapshot!; if (field === "body") f.update({ draft: createEditorDocument([{ id: "block", type: "paragraph", content: "Later human edit" }]) }); else f.update({ snapshot: { ...snapshot, ...(field === "scope" ? { scope: { ...snapshot.scope, actorId: "another" } } : field === "target" ? { target: { kind: "page", pageId: "another" } } : { [field]: "another" }) } }); expect(bridge.undoSelection!(r.selection.id)).toBe(false); }); expect(vi.mocked(f.controller.setDraft).mock.calls.length).toBe(calls);
  });
  it("revokes a retained public bridge after its writer unmounts", () => {
    const f = fixture(), r = f.review(), bridge = f.bridge; act(() => { bridge.replaceSelection!(r.selection, "Reviewed output", r.key, r.expected); f.controller.setLocalDraft(r.key, undefined); root.render(null); }); expect(() => bridge.undoSelection!(r.selection.id)).toThrow(); expect(bridge.isSelectionCurrent!(r.selection)).toBe(false);
  });
});


describe("ordinary inline color item restriction", () => {
  const policy = () => ({scope:{actorId:"actor",workspaceId:"workspace"},nativeFormattingItems:["boldStyleButton","colorStyleButton"],nativeFormattingBlockTypes:["paragraph","table"],inlineColorBlockTypes:["paragraph"],allowInlineColorHardBreaks:false});
  it("keeps table boolean marks but never advertises inline colors for table/mixed/hard-break selections", () => {
    const f=fixture(false,undefined,policy());
    expect(f.bridge.supportedNativeFormattingItems).toEqual(["boldStyleButton","colorStyleButton"]);
    f.editor.document[0]!.type="table";expect(f.bridge.supportedNativeFormattingItems).toEqual(["boldStyleButton"]);
    f.editor.document.push({id:"other",type:"paragraph",props:{},content:[{type:"text",text:"other",styles:{}}],children:[]});
    expect(f.bridge.supportedNativeFormattingItems).toEqual(["boldStyleButton"]);
    f.editor.document.shift();f.editor.document[0]!.content[0]!.text="a\nb";
    expect(f.bridge.supportedNativeFormattingItems).toEqual(["boldStyleButton"]);
  });
  it.each(["scope","target","revision","contentRevision"])("rejects a queued color action before React applies changed %s", field => {
    const f=fixture(false,undefined,policy()),bridge=f.bridge;
    act(()=>{const snapshot=f.controller.getState().snapshot!;f.update({snapshot:{...snapshot,...(field==="scope"?{scope:{...snapshot.scope,actorId:"other"}}:field==="target"?{target:{kind:"page",pageId:"other"}}:{[field]:"other"})}});expect(bridge.supportedNativeFormattingItems).not.toContain("colorStyleButton");});
    expect(f.controller.setDraft).not.toHaveBeenCalled();
  });
});

describe("ordinary native text alignment boundary", () => {
  const keys = ["textAlignLeftButton", "textAlignCenterButton", "textAlignRightButton"];
  const policy = () => ({ scope: { actorId: "actor", workspaceId: "workspace" }, nativeFormattingItems: ["boldStyleButton", ...keys, "textAlignJustifyButton"], nativeFormattingBlockTypes: ["paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "quote", "callout", "table", "image", "codeBlock"], localStyleKinds: ["alignLeft", "alignCenter", "alignRight"] as import("../src/react/notesWorkspacePanels.js").NotesStyleKind[] });
  it("exposes only installed native keys for every supported ordinary type and enum", () => {
    const f = fixture(false, undefined, policy());
    for (const type of ["paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "quote", "callout"]) for (const textAlignment of [undefined, "left", "center", "right", "justify"]) {
      f.editor.document[0]!.type = type; f.editor.document[0]!.props = textAlignment === undefined ? {} : { textAlignment };
      expect(f.bridge.supportedNativeFormattingItems).toEqual(["boldStyleButton", ...keys]);
      expect(f.bridge.supportedStyleActions).toEqual(["alignLeft", "alignCenter", "alignRight"]);
    }
  });
  it("keeps table/media contracts and boolean marks separate from ordinary alignment", () => {
    const f = fixture(false, undefined, policy());
    for (const type of ["table", "image", "codeBlock"]) {
      f.editor.document[0]!.type = type;
      expect(f.bridge.supportedNativeFormattingItems).toEqual(["boldStyleButton"]);
      expect(f.bridge.supportedStyleActions).toEqual([]);
      f.editor.document.push({ id: "other", type: "paragraph", props: {}, content: [], children: [] });
      expect(f.bridge.supportedNativeFormattingItems).toEqual(["boldStyleButton"]);
      expect(() => f.bridge.format("alignRight", new AbortController().signal)).toThrow("Formatting unavailable");
      f.editor.document.pop();
    }
    f.editor.document[0]!.type = "future-widget"; expect(f.bridge.supportedNativeFormattingItems).toEqual([]);
    expect(f.controller.setDraft).not.toHaveBeenCalled();
  });
  it.each([null, false, 1, {}, [], "", "start", "RIGHT"])("hides ordinary alignment for malformed current native value %j", textAlignment => {
    const f = fixture(false, undefined, policy()); f.editor.document[0]!.props = { textAlignment };
    expect(f.bridge.supportedNativeFormattingItems).toEqual(["boldStyleButton"]);
    expect(f.bridge.supportedStyleActions).toEqual([]);
  });
  it.each(["scope", "target", "revision", "contentRevision", "draft"])("fences queued alignment before React applies changed %s", field => {
    const f = fixture(false, undefined, policy()), bridge = f.bridge;
    act(() => {
      const snapshot = f.controller.getState().snapshot!;
      f.update(field === "draft" ? { draft: createEditorDocument([{ id: "new", type: "paragraph", content: "new" }]) } : { snapshot: { ...snapshot, ...(field === "scope" ? { scope: { ...snapshot.scope, actorId: "other" } } : field === "target" ? { target: { kind: "page", pageId: "other" } } : { [field]: "other" }) } });
      for (const key of keys) expect(bridge.supportedNativeFormattingItems).not.toContain(key);
      expect(() => bridge.format("alignRight", new AbortController().signal)).toThrow();
    });
    expect(f.controller.setDraft).not.toHaveBeenCalled();
  });
  it.each(["composing", "pendingEditors", "manualSaveRequired", "saving", "save-denied", "recovery"])("rechecks %s before native or sidebar dispatch", flag => {
    const f = fixture(false, undefined, policy());
    act(() => {
      f.update(flag === "saving" ? { status: "saving" } : flag === "save-denied" ? { snapshot: { ...f.controller.getState().snapshot!, capabilities: [] } } : flag === "recovery" ? { recovery: {} as never } : { [flag]: true });
      for (const key of keys) expect(f.bridge.supportedNativeFormattingItems).not.toContain(key);
      expect(() => f.bridge.format("alignRight", new AbortController().signal)).toThrow();
    });
    expect(f.controller.setDraft).not.toHaveBeenCalled();
  });
  it("rechecks policy revocation without React and keeps unrestricted SDK defaults", () => {
    const p = policy(), f = fixture(false, undefined, p);
    p.nativeFormattingItems = ["boldStyleButton"]; expect(f.bridge.supportedNativeFormattingItems).toEqual(["boldStyleButton"]); expect(f.bridge.supportedStyleActions).toEqual([]);
    const unrestricted = fixture(); unrestricted.editor.document[0]!.type = "table";
    expect(unrestricted.bridge.supportedNativeFormattingItems).toBeUndefined();
    expect(unrestricted.bridge.supportedStyleActions).toContain("alignCenter");
  });
});
