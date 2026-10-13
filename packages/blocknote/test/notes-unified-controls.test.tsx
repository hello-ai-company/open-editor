/** @vitest-environment jsdom */
import { act } from "react";
import { readFileSync } from "node:fs";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDocumentIndex } from "../src/index/documentIndex.js";
import { NotesFormattingToolbar, NotesFormattingToolbarController, NotesLinkToolbarController, notesToolbarCloseTransition, NotesSelectionActionsContext, notesSelectionToolbarButtons } from "../src/react/NotesFormattingToolbar.js";
import { NotesSelectionTools } from "../src/react/NotesSelectionTools.js";
import { NotesInspector } from "../src/react/NotesInspector.js";
import { NotesSlashMenuController, notesInsertionCatalog, notesInsertionCommands, notesRequestInsertion } from "../src/react/NotesInsertionCommands.js";
import { NOTES_INSERT_CATALOG, type NotesEditorBridge } from "../src/react/notesWorkspacePanels.js";
import type { NotesWorkspaceController, NotesWorkspaceState } from "../src/notes/contracts.js";
import { NotesIcon } from "../src/react/notesPresentation.js";
import { createDocumentGripIcon } from "../src/document/controlGlyphs.js";
const mocks = vi.hoisted(() => ({ slash: undefined as any, formatting: undefined as any, link: undefined as any, includeLink: false, nativeClick: vi.fn(), block: { id: "source", type: "paragraph", content: [] } }));
vi.mock("@blocknote/react", async original => ({ ...await original<typeof import("@blocknote/react")>(),
  getFormattingToolbarItems: () => [<button key="blockTypeSelect">Text</button>, <button key="boldStyleButton" aria-label="Bold" onClick={mocks.nativeClick}>B</button>, <button key="addCommentButton">Duplicate comment</button>, ...(mocks.includeLink ? [<button key="createLinkButton" className="mantine-ActionIcon-root" aria-label="Create link" title="Create link" onClick={mocks.nativeClick}><NotesIcon name="link" /></button>] : [])],
  SuggestionMenuController: (props: any) => { mocks.slash = props; return null; },
  FormattingToolbarController: (props: any) => { mocks.formatting = props; return null; },
  LinkToolbarController: (props: any) => { mocks.link = props; return null; },
  useBlockNoteEditor: () => ({ getBlock: (id: string) => id === mocks.block.id ? mocks.block : undefined, getTextCursorPosition: () => ({ block: mocks.block }) }),
}));
let root: Root, container: HTMLDivElement;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); mocks.nativeClick.mockClear(); mocks.includeLink = false; });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; });
function fixture() {
  let state: NotesWorkspaceState = { status: "ready", dirty: false, composing: false, pendingEditors: false, localDrafts: {}, message: "", snapshot: { scope: { actorId: "actor", workspaceId: "workspace" }, target: { kind: "page", pageId: "page" }, revision: "r1", contentRevision: "c1", title: "Synthetic", metadata: {}, document: { schemaVersion: 1, blocks: [{ id: "source", type: "paragraph", content: "Selected text" }] }, capabilities: ["document.save", "comment.add"], capabilitySemantics: { "document.save": "test-only", "comment.add": "test-only" } } };
  const listeners = new Set<() => void>(), update = (patch: Partial<NotesWorkspaceState>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  const controller: NotesWorkspaceController = { getState: () => state, subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, setComposing: composing => update({ composing }), setLocalDraft: (id, value) => { const localDrafts = { ...state.localDrafts }; if (value === undefined) delete localDrafts[id]; else localDrafts[id] = value; update({ localDrafts, pendingEditors: !!Object.keys(localDrafts).length }); }, open: vi.fn(), save: vi.fn(), execute: vi.fn(), cancel: vi.fn(), reconcile: vi.fn(), getRecovery: vi.fn(), persistLocalDrafts: vi.fn(), readLatest: vi.fn(), acceptMergedDraft: vi.fn(), dispose: vi.fn(), setDraft: vi.fn() };
  const bridge: NotesEditorBridge = { index: createDocumentIndex(), installedBlockTypes: [...new Set(NOTES_INSERT_CATALOG.flatMap(item => [...item.blockTypes ?? [], ...item.oneOfBlockTypes ?? []]))], supportedInsertActions: ["text", "columns", "tableInsert", "divider", "code", "htmlEmbed"], supportedStyleActions: [], editable: true, commandsAvailable: true, focusBlock: vi.fn(), insert: vi.fn(), requestInsert: vi.fn(), format: vi.fn(), focusEditor: vi.fn(), showSelectionToolbar: vi.fn(), hasTextSelection: () => true, getSelectionIdentity: () => "same-range", captureSelection: vi.fn(() => ({ id: "range", scope: state.snapshot!.scope, target: state.snapshot!.target, revision: "r1", contentRevision: "c1", blockId: "source", text: "Selected text" })), isSelectionCurrent: () => true };
  return { controller, bridge, update };
}
const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const key = (target: Element, value: string, extra = {}) => target.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...extra }));

describe("one selection icon toolbar", () => {
  it("keeps the native formatting surface above ambient backup without replacing portal or focus behavior", () => {
    const ready = vi.fn();
    act(() => root.render(<NotesFormattingToolbarController onReady={ready} />));
    const options = mocks.formatting.floatingUIOptions;
    expect(options.elementProps).toEqual({ className: "oe-notes-formatting-surface", style: { zIndex: 60 } });
    const css = readFileSync("src/power/notesFeedback.css", "utf8");
    const feedbackLayer = Number(css.match(/\.oe-notes-floating-surface\{z-index:(\d+)/)?.[1]);
    expect(options.elementProps.style.zIndex).toBeGreaterThan(feedbackLayer);
    expect(mocks.formatting.portalElement).toBeUndefined();
    expect(options.focusManagerProps).toBeUndefined();
    expect(options.useFloatingOptions).toBeUndefined();
    expect(options.useTransitionStylesProps).toBe(notesToolbarCloseTransition.useTransitionStylesProps);
    expect(options.useTransitionStatusProps).toBe(notesToolbarCloseTransition.useTransitionStatusProps);
    expect(mocks.formatting.formattingToolbar).toBe(NotesFormattingToolbar);
    expect(ready).toHaveBeenLastCalledWith(true);
    act(() => root.render(<NotesFormattingToolbarController onReady={ready} />));
    expect(mocks.formatting.floatingUIOptions).toBe(options);
    act(() => root.render(null));
    expect(ready).toHaveBeenLastCalledWith(false);
  });
  it("uses the same immediate close transition for the native link controller without changing its commands or focus", () => {
    act(() => root.render(<NotesLinkToolbarController />));
    expect(mocks.link).toEqual({ floatingUIOptions: notesToolbarCloseTransition });
    expect(notesToolbarCloseTransition.useTransitionStylesProps).toEqual({ duration: { open: 250, close: 0 }, close: { opacity: 0, visibility: "hidden", pointerEvents: "none" } });
    expect(notesToolbarCloseTransition.useTransitionStatusProps).toEqual({ duration: { open: 250, close: 0 } });
  });
  it("keeps an allowed native chain icon distinct, accessible and bounded with the unified actions", () => {
    mocks.includeLink = true;
    const f = fixture(); f.bridge.supportedNativeFormattingItems = ["boldStyleButton", "createLinkButton"];
    act(() => root.render(<NotesSelectionTools {...f} integrated service={{ run: vi.fn() }}><NotesFormattingToolbar /></NotesSelectionTools>));
    const icon = button("Create link");
    expect(icon.title).toBe("Create link"); expect(icon.querySelector("svg path")?.getAttribute("d")).toBeTruthy();
    expect(icon.closest('[data-notes-native-item="createLinkButton"]')).not.toBeNull();
    expect(container.querySelectorAll('[role="toolbar"]')).toHaveLength(1);
    const toolbar = container.querySelector<HTMLElement>('[data-notes-unified-selection]')!;
    expect(notesSelectionToolbarButtons(toolbar)).toContain(icon);
    const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true }); icon.dispatchEvent(down); expect(down.defaultPrevented).toBe(true);
    f.bridge.supportedNativeFormattingItems = ["boldStyleButton"]; act(() => icon.click()); expect(mocks.nativeClick).not.toHaveBeenCalled();
    const css = readFileSync("src/power/notesDesign.css", "utf8");
    expect(css).toContain("max-width:min(680px,calc(100vw - 24px))"); expect(css).toContain("flex-wrap:wrap");
    expect(css).toContain("width:36px;height:36px;min-width:36px;min-height:36px");
    expect(css).toContain("svg{width:20px;height:20px;flex-shrink:0}");
  });
  it("filters native formatting through the optional live host policy and fences a queued revoked click", () => {
    const f = fixture(); f.bridge.supportedNativeFormattingItems = ["boldStyleButton"];
    act(() => root.render(<NotesSelectionTools {...f} integrated service={{ run: vi.fn() }}><NotesFormattingToolbar /></NotesSelectionTools>));
    expect(container.textContent).not.toContain("Text"); expect(button("Bold")).not.toBeNull(); expect(button("選択文をAIで編集")).not.toBeNull();
    f.bridge.supportedNativeFormattingItems = []; act(() => button("Bold").click()); expect(mocks.nativeClick).not.toHaveBeenCalled(); expect(f.controller.setDraft).not.toHaveBeenCalled();
  });
  it("combines formatting, AI and comments with one role, readable SVGs and no duplicate native comment", () => {
    const f = fixture(); act(() => root.render(<NotesSelectionTools {...f} integrated service={{ run: vi.fn() }}><NotesFormattingToolbar /></NotesSelectionTools>));
    expect(container.querySelectorAll('[role="toolbar"]')).toHaveLength(1);
    expect(container.querySelectorAll('.oe-notes-selection-icon svg')).toHaveLength(3);
    expect(container.querySelector('.oe-notes-selection-tools')!.textContent).toBe("");
    expect(container.textContent).not.toContain("Duplicate comment");
    expect(button("選択文をAIで編集").title).toBeTruthy(); expect(button("選択文にコメント").title).toBeTruthy();
  });
  it("uses a single keyboard order across native and host actions, excluding menu inputs", () => {
    const dismiss = vi.fn(), f = fixture();
    act(() => root.render(<NotesSelectionActionsContext.Provider value={{ controls: <><button aria-label="AI">AI</button><div role="menu"><button>Menu item</button><input aria-label="URL" /></div></>, language: "en", suppressed: false, canFormat: () => true, dismiss }}><NotesFormattingToolbar /></NotesSelectionActionsContext.Provider>));
    const toolbar = container.querySelector<HTMLElement>('[data-notes-unified-selection]')!;
    expect(notesSelectionToolbarButtons(toolbar)).toHaveLength(3);
    button("Bold").focus(); act(() => { key(button("Bold"), "ArrowRight"); }); expect(document.activeElement).toBe(button("AI"));
    act(() => { key(button("AI"), "Home"); }); expect(document.activeElement?.textContent).toBe("Text");
    act(() => { key(document.activeElement!, "End"); }); expect(document.activeElement).toBe(button("AI"));
    act(() => { key(button("AI"), "ArrowLeft", { keyCode: 229 }); }); expect(document.activeElement).toBe(button("AI"));
    const input = container.querySelector('input')!; input.focus(); act(() => { key(input, "ArrowLeft"); }); expect(document.activeElement).toBe(input);
    button("AI").focus(); act(() => { key(button("AI"), "Escape"); }); expect(dismiss).toHaveBeenCalledOnce(); expect(f.bridge.insert).not.toHaveBeenCalled();
  });
  it("preserves the text range on toolbar mousedown and fences native edits before React renders revocation", () => {
    const f = fixture(); act(() => root.render(<NotesSelectionTools {...f} integrated service={{ run: vi.fn() }}><NotesFormattingToolbar /></NotesSelectionTools>));
    const bold = button("Bold"), down = new MouseEvent("mousedown", { bubbles: true, cancelable: true }); bold.dispatchEvent(down); expect(down.defaultPrevented).toBe(true);
    act(() => { f.controller.setComposing(true); bold.click(); }); expect(mocks.nativeClick).not.toHaveBeenCalled(); expect(container.querySelector('[role="toolbar"]')!.getAttribute("aria-disabled")).toBe("true");
  });
  it("retains a native link input through composition and blocks its Enter submission including keyCode 229", () => {
    const f = fixture(), submit = vi.fn();
    const render = () => root.render(<div onCompositionStart={() => f.controller.setComposing(true)} onCompositionEnd={() => f.controller.setComposing(false)}><NotesSelectionTools {...f} integrated service={{ run: vi.fn() }}><NotesSelectionActionsContext.Consumer>{context => <NotesSelectionActionsContext.Provider value={{ ...context!, controls: <div className="bn-popover-content"><input aria-label="Native link URL" defaultValue="https://example.invalid/日本語" onKeyDown={event => { if (event.key === "Enter") submit(); }} /></div> }}><NotesFormattingToolbar /></NotesSelectionActionsContext.Provider>}</NotesSelectionActionsContext.Consumer></NotesSelectionTools></div>);
    act(render); const input = container.querySelector<HTMLInputElement>("input")!; input.focus();
    act(() => input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
    expect(input.isConnected).toBe(true); expect(document.activeElement).toBe(input); expect(input.value).toContain("日本語");
    act(() => { key(input, "Enter", { isComposing: true }); key(input, "Enter", { keyCode: 229 }); }); expect(submit).not.toHaveBeenCalled();
    act(() => input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })));
    expect(f.controller.getState().composing).toBe(false); expect(input.isConnected).toBe(true);
    act(() => { key(input, "Enter"); }); expect(submit).toHaveBeenCalledOnce();
  });
  it("makes unconnected controls honest connection-status actions, with no capture, save or fake generation", async () => {
    const f = fixture(); f.update({ snapshot: { ...f.controller.getState().snapshot!, capabilities: ["document.save"], capabilitySemantics: { "document.save": "test-only" } } });
    act(() => root.render(<NotesSelectionTools {...f} integrated><NotesFormattingToolbar /></NotesSelectionTools>));
    expect(button("AI編集の接続状態").dataset.availability).toBe("unavailable");
    await act(async () => button("AI編集の接続状態").click()); expect(document.body.textContent).toContain("未接続"); expect(container.querySelector('[role="toolbar"]')).toBeNull();
    expect(f.bridge.captureSelection).not.toHaveBeenCalled(); expect(f.controller.save).not.toHaveBeenCalled(); expect(f.controller.execute).not.toHaveBeenCalled();
  });
  it("leaves Escape and IME keystrokes to nested menus before dismissing the bar", () => {
    const f = fixture(); act(() => root.render(<div className="oe-notes-workspace"><NotesSelectionTools {...f} integrated service={{ run: vi.fn() }}><NotesFormattingToolbar /><div role="menu"><input aria-label="Nested link input" /></div></NotesSelectionTools></div>));
    const input = container.querySelector("input")!; input.focus(); act(() => { key(input, "Escape"); });
    expect(container.querySelector('[role="toolbar"]')).not.toBeNull(); expect(f.bridge.focusEditor).not.toHaveBeenCalled();
    button("Bold").focus(); act(() => { key(button("Bold"), "Escape", { keyCode: 229 }); }); expect(container.querySelector('[role="toolbar"]')).not.toBeNull();
  });
  it("focuses and dismisses native formatting for a multi-block range without exposing single-block AI", () => {
    const f = fixture(); f.bridge.hasTextSelection = () => false; f.bridge.hasFormattingSelection = () => true;
    const frames: FrameRequestCallback[] = []; vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frames.push(callback); return frames.length; });
    act(() => root.render(<div className="oe-notes-workspace"><textarea aria-label="Editor" /><NotesSelectionTools {...f} integrated service={{ run: vi.fn() }}><NotesFormattingToolbar /></NotesSelectionTools></div>));
    expect(container.querySelector(".oe-notes-selection-tools")).toBeNull();
    const input = container.querySelector("textarea")!; input.focus(); act(() => { key(input, "F8"); }); act(() => { frames.splice(0).forEach(fn => fn(0)); });
    expect(document.activeElement?.textContent).toBe("Text"); expect(f.bridge.showSelectionToolbar).toHaveBeenCalledOnce();
    act(() => { key(document.activeElement!, "Escape"); }); expect(container.querySelector('[role="toolbar"]')).toBeNull(); expect(f.bridge.captureSelection).not.toHaveBeenCalled();
  });
  it("Escape dismisses the entire bar and F8 reopens the same text selection without an edit", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 100, height: 40, left: 0, top: 0, right: 100, bottom: 40, x: 0, y: 0, toJSON() {} });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { callback(0); return 1; });
    const f = fixture(); act(() => root.render(<div className="oe-notes-workspace"><textarea aria-label="Editor" /><NotesSelectionTools {...f} integrated service={{ run: vi.fn() }}><NotesFormattingToolbar /></NotesSelectionTools></div>));
    button("Bold").focus(); act(() => { key(button("Bold"), "Escape"); }); expect(container.querySelector('[role="toolbar"]')).toBeNull();
    const input = container.querySelector('textarea')!; input.focus(); act(() => { key(input, "F8"); }); expect(f.bridge.showSelectionToolbar).toHaveBeenCalledOnce(); expect(container.querySelectorAll('[role="toolbar"]')).toHaveLength(1); expect(f.controller.setDraft).not.toHaveBeenCalled();
  });
});

describe("shared insertion catalog and live authorization", () => {
  it("exposes exactly the enabled right-sidebar widgets in slash, including tables, columns and HTML", async () => {
    const f = fixture(); act(() => root.render(<><NotesInspector {...f} classic language="en" /><NotesSlashMenuController bridge={f.bridge} language="en" onError={vi.fn()} /></>));
    const sidebar = [...container.querySelectorAll<HTMLButtonElement>('[data-notes-insert-kind]:not(:disabled)')].map(button => button.dataset.notesInsertKind);
    const expected = notesInsertionCommands(f.bridge, "en"); expect(sidebar).toEqual(expected.map(item => item.kind));
    const slash = await mocks.slash.getItems(""); expect(slash.map((item: any) => item.title)).toEqual(expected.map(item => item.label));
    expect(notesInsertionCatalog(f.bridge).find(item => item.kind === "collection")!.unavailable).toBe("binding");
    expect(container.querySelector<HTMLButtonElement>('[data-notes-insert-kind="collection"]')!.disabled).toBe(true);
  });
  it.each(["composing", "readonly", "pending", "revoked", "schema"])("rejects an already-open slash choice when %s changes", async reason => {
    const f = fixture(), onError = vi.fn(); act(() => root.render(<NotesSlashMenuController bridge={f.bridge} language="en" onError={onError} />));
    const choices = await mocks.slash.getItems(""); const choice = choices.find((item: any) => item.title === "Table");
    if (reason === "composing") f.bridge.composing = true;
    if (reason === "readonly") f.bridge.editable = false;
    if (reason === "pending") f.bridge.commandsAvailable = false;
    if (reason === "revoked") f.bridge.supportedInsertActions = [];
    if (reason === "schema") f.bridge.installedBlockTypes = ["paragraph"];
    await act(async () => choice.onItemClick()); expect(f.bridge.requestInsert).not.toHaveBeenCalled(); expect(f.bridge.insert).not.toHaveBeenCalled();
  });
  it("uses the same request/choice writer and cancellation signal for sidebar and slash", async () => {
    const f = fixture(); act(() => root.render(<NotesSlashMenuController bridge={f.bridge} language="en" onError={vi.fn()} />));
    const items = await mocks.slash.getItems(""); await act(async () => items.find((item: any) => item.title === "Table").onItemClick());
    expect(f.bridge.requestInsert).toHaveBeenCalledWith("tableInsert", expect.any(AbortSignal), { anchor: { blockId: "source", placement: "after" }, replaceEmptyBlockId: "source" });
    const abort = new AbortController(); abort.abort(); expect(() => notesRequestInsertion(f.bridge, "columns", abort.signal)).toThrow("Insertion unavailable");
  });
});

describe("readable control glyphs", () => {
  it("keeps decorative DOM and React glyphs from taking the grip pointer target", () => {
    act(() => root.render(<NotesIcon name="grip" />));
    expect(createDocumentGripIcon(document).getAttribute("pointer-events")).toBe("none");
    expect(container.querySelector("svg")!.getAttribute("pointer-events")).toBe("none");
  });
  it("uses six fixed SVG dots for both DOM and React grips and a real ellipsis for options", () => {
    act(() => root.render(<><NotesIcon name="grip" /><NotesIcon name="more" /></>));
    const dom = createDocumentGripIcon(document); expect(dom.querySelectorAll("circle")).toHaveLength(6); expect(dom.getAttribute("width")).toBe("24");
    expect(container.querySelector('[data-oe-control-icon="grip"]')!.querySelectorAll("circle")).toHaveLength(6);
    expect(container.querySelector('[data-oe-control-icon="more"]')!.querySelectorAll("circle")).toHaveLength(3); expect(container.textContent).toBe("");
  });
});
