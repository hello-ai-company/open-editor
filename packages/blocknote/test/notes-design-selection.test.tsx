/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDocumentIndex } from "../src/index/documentIndex.js";
import type { NotesCommandOutcome, NotesWorkspaceController, NotesWorkspaceState } from "../src/notes/contracts.js";
import { NotesStyleGalleryButton } from "../src/react/NotesStyleGallery.js";
import { NotesSelectionTools } from "../src/react/NotesSelectionTools.js";
import { NotesPageHeader } from "../src/react/NotesPageHeader.js";
import type { NotesPageAppearanceOptions, NotesCoverCatalog } from "../src/react/notesPresentation.js";
import type { NotesEditorBridge } from "../src/react/notesWorkspacePanels.js";
import type { NotesSelectionAIRequest, NotesSelectionAIResult, NotesSelectionAIService, NotesTextSelection } from "../src/react/notesSelection.js";

let root: Root, container: HTMLDivElement;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; });
function fixture() {
  let state: NotesWorkspaceState = { status: "ready", dirty: false, composing: false, localDrafts: {}, pendingEditors: false, message: "", snapshot: { scope: { actorId: "actor", workspaceId: "workspace" }, target: { kind: "page", pageId: "page" }, revision: "r1", contentRevision: "b1", title: "Synthetic title", metadata: { style: "clean", untouched: { archived: true } }, capabilities: ["metadata.patch", "document.save", "comment.add"], capabilitySemantics: { "metadata.patch": "test-only", "document.save": "test-only", "comment.add": "test-only" }, document: { schemaVersion: 1, blocks: [{ id: "block", type: "paragraph", content: "Selected source" }] } } };
  const listeners = new Set<() => void>(), update = (patch: Partial<NotesWorkspaceState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  const controller: NotesWorkspaceController = { getState: () => state, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, setLocalDraft(id, value) { const localDrafts = { ...state.localDrafts }; if (value === undefined) delete localDrafts[id]; else localDrafts[id] = value; update({ localDrafts, pendingEditors: Object.keys(localDrafts).length > 0 }); }, setComposing: value => update({ composing: value }), execute: vi.fn(async () => ({ status: "denied", target: state.snapshot!.target, operationId: "op" } as NotesCommandOutcome)), open: vi.fn(), setDraft: vi.fn(), save: vi.fn(), cancel: vi.fn(), reconcile: vi.fn(), getRecovery: vi.fn(), persistLocalDrafts: vi.fn(), readLatest: vi.fn(), acceptMergedDraft: vi.fn(), dispose: vi.fn() };
  const selection: NotesTextSelection = { id: "opaque-range", scope: state.snapshot!.scope, target: state.snapshot!.target, revision: "r1", contentRevision: "b1", blockId: "block", text: "Selected source" };
  const bridge: NotesEditorBridge = { index: createDocumentIndex(), installedBlockTypes: ["paragraph"], supportedInsertActions: [], supportedStyleActions: [], editable: true, focusBlock: vi.fn(), insert: vi.fn(), format: vi.fn(), captureSelection: vi.fn(() => selection), hasTextSelection: () => true, isSelectionCurrent: vi.fn(() => state.snapshot!.revision === selection.revision), replaceSelection: vi.fn(), undoSelection: vi.fn(() => true) };
  const appearance: NotesPageAppearanceOptions = { fields: { style: "style", cover: "cover", coverAlt: "coverAlt", coverLayout: "coverLayout" }, coverCatalog: { read: vi.fn<NotesCoverCatalog["read"]>(async request => ({ scope: request.scope, target: request.target, revision: request.revision, items: [{ id: "forest", label: "合成の森", url: "https://example.invalid/forest.svg", alt: "合成", style: "studio", layout: "wide" }] })) } };
  return { controller, bridge, update, selection, appearance };
}
function button(label: string): HTMLButtonElement { const match = [...document.body.querySelectorAll("button")].find(button => button.getAttribute("aria-label") === label || button.textContent?.trim() === label); if (!match) throw new Error(`Missing ${label}`); return match; }
async function click(label: string) { await act(async () => button(label).click()); }
function input(element: HTMLTextAreaElement, value: string) { act(() => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); }); }
function response(request: NotesSelectionAIRequest, text = "Reviewed suggestion"): NotesSelectionAIResult { return { requestId: request.requestId, scope: request.scope, target: request.target, revision: request.revision, contentRevision: request.contentRevision, selectionId: request.selection.id, text }; }

describe("Notes design gallery", () => {
  it("catches a synchronously throwing catalog and keeps the gallery usable", async () => {
    const { controller, appearance } = fixture(); appearance.coverCatalog!.read = () => { throw new Error("Host unavailable"); }; await act(async () => root.render(<NotesStyleGalleryButton controller={controller} appearance={appearance} language="ja" />)); await click("書式とカバーを変更"); expect(document.body.textContent).toContain("カバー一覧を確認できませんでした"); await click("Editorial"); expect(button("確認して適用").disabled).toBe(false); expect(controller.execute).not.toHaveBeenCalled();
  });
  it("preserves a newer same-key gallery draft before React rerenders the cancel handler", async () => {
    const { controller, appearance } = fixture(); await act(async () => root.render(<NotesStyleGalleryButton controller={controller} appearance={appearance} language="ja" />)); await click("書式とカバーを変更"); await click("Editorial"); const key = Object.keys(controller.getState().localDrafts)[0]!, old = controller.getState().localDrafts[key] as any, cancel = button("キャンセル"); const newer = { ...old, style: "mono", command: { kind: "metadata.patch", fields: { style: "mono" } } };
    act(() => { controller.setLocalDraft(key, newer); cancel.click(); }); expect(controller.getState().localDrafts[key]).toEqual(newer); expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
  });
  it.each([['style','future-style'], ['cover','javascript:alert(1)'], ['coverLayout','future-layout'], ['coverAlt','x'.repeat(1001)]])("keeps shape-valid invalid %s values inert", async (key, value) => {
    const { controller, appearance } = fixture(); await act(async () => root.render(<NotesStyleGalleryButton controller={controller} appearance={appearance} language="ja" />)); await click("書式とカバーを変更"); await click("Editorial"); const cacheKey = Object.keys(controller.getState().localDrafts)[0]!, old = controller.getState().localDrafts[cacheKey] as any; const displayKey = key === 'coverLayout' ? 'layout' : key === 'coverAlt' ? 'alt' : key;
    act(() => controller.setLocalDraft(cacheKey, { ...old, [displayKey]: value, command: { kind: "metadata.patch", fields: { [key]: value } } })); expect(button("確認して適用").disabled).toBe(true); await click("確認して適用"); expect(controller.execute).not.toHaveBeenCalled(); expect(controller.getState().pendingEditors).toBe(true);
  });
  it("does not request a safe but unauthorized retained cover URL", async () => {
    const { controller, appearance } = fixture(); await act(async () => root.render(<NotesStyleGalleryButton controller={controller} appearance={appearance} language="ja" />)); await click("書式とカバーを変更"); await click("Editorial"); const key = Object.keys(controller.getState().localDrafts)[0]!, old = controller.getState().localDrafts[key] as any, cover = "https://example.invalid/unauthorized.svg"; act(() => controller.setLocalDraft(key, { ...old, cover, command: { kind: "metadata.patch", fields: { cover } } })); expect(document.body.querySelector('.oe-notes-design-media img')).toBeNull(); expect(button("確認して適用").disabled).toBe(true); expect(controller.getState().pendingEditors).toBe(true);
  });
  it("stages cover/style atomically and submits only the reviewed command once; denial retains input", async () => {
    const { controller, appearance } = fixture(); await act(async () => root.render(<NotesStyleGalleryButton controller={controller} appearance={appearance} language="ja" />));
    await click("書式とカバーを変更"); await click("合成の森"); expect(controller.execute).not.toHaveBeenCalled();
    expect(document.body.querySelector<HTMLImageElement>(".oe-notes-design-media img")!.src).toBe("https://example.invalid/forest.svg");
    let settle!: (result: NotesCommandOutcome) => void; controller.execute = vi.fn(() => new Promise<NotesCommandOutcome>(done => { settle = done; }));
    await act(async () => { button("確認して適用").click(); button("確認して適用").click(); });
    expect(controller.execute).toHaveBeenCalledTimes(1); expect(controller.execute).toHaveBeenCalledWith({ kind: "metadata.patch", fields: { style: "studio", cover: "https://example.invalid/forest.svg", coverAlt: "合成", coverLayout: "wide" } }, { localDraftId: expect.any(String) });
    await act(async () => settle({ status: "denied", target: { kind: "page", pageId: "page" }, operationId: "op" })); expect(controller.getState().pendingEditors).toBe(true); expect(controller.getState().snapshot!.metadata.untouched).toEqual({ archived: true });
  });
  it("retains a staged design through close and forced unmount; explicit cancel clears only its own input", async () => {
    const { controller, appearance } = fixture(); const render = () => root.render(<NotesStyleGalleryButton controller={controller} appearance={appearance} language="ja" />);
    await act(async () => render()); await click("書式とカバーを変更"); await click("Editorial"); await click("閉じる"); expect(controller.getState().pendingEditors).toBe(true);
    act(() => root.render(null)); expect(controller.getState().pendingEditors).toBe(true); await act(async () => render()); await click("書式とカバーを変更 •");
    expect(document.body.querySelector('[data-style="editorial"][aria-pressed="true"]')).not.toBeNull(); await click("キャンセル"); expect(controller.getState().pendingEditors).toBe(false); expect(controller.execute).not.toHaveBeenCalled();
  });
  it("blocks stale revision and remapped metadata without overwriting retained input", async () => {
    const { controller, appearance, update } = fixture(); await act(async () => root.render(<NotesStyleGalleryButton controller={controller} appearance={appearance} language="ja" />)); await click("書式とカバーを変更"); await click("Editorial");
    const retained = JSON.stringify(controller.getState().localDrafts); await act(async () => update({ snapshot: { ...controller.getState().snapshot!, revision: "r2" } })); expect(button("確認して適用").disabled).toBe(true); expect(JSON.stringify(controller.getState().localDrafts)).toBe(retained); expect(controller.execute).not.toHaveBeenCalled();
  });
  it("rejects a foreign catalog and unsafe references as one bounded result", async () => {
    const { controller, appearance } = fixture(); appearance.coverCatalog!.read = vi.fn(async request => ({ scope: { ...request.scope, actorId: "foreign" }, target: request.target, revision: request.revision, items: [{ id: "bad", label: "Unsafe", url: "javascript:alert(1)", alt: "" }] }));
    await act(async () => root.render(<NotesStyleGalleryButton controller={controller} appearance={appearance} language="ja" />)); await click("書式とカバーを変更"); expect(document.body.querySelector(".oe-notes-cover-catalog img")).toBeNull(); expect(document.body.textContent).toContain("カバー一覧を確認できませんでした"); expect(controller.execute).not.toHaveBeenCalled();
  });
  it("aborts catalog reads on close and ignores a late result", async () => {
    const { controller, appearance } = fixture(); let request!: Parameters<NonNullable<NotesPageAppearanceOptions["coverCatalog"]>["read"]>[0], settle!: (value: any) => void;
    appearance.coverCatalog!.read = vi.fn(value => { request = value; return new Promise<Awaited<ReturnType<NotesCoverCatalog["read"]>>>(done => { settle = done; }); }); await act(async () => root.render(<NotesStyleGalleryButton controller={controller} appearance={appearance} language="ja" />)); await click("書式とカバーを変更"); await click("閉じる"); expect(request.signal.aborted).toBe(true);
    await act(async () => settle({ scope: request.scope, target: request.target, revision: request.revision, items: [] })); expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });
  it("keeps malformed retained cache inert until explicit cancellation", async () => {
    const { controller, appearance } = fixture(); const key = JSON.stringify([controller.getState().snapshot!.scope, controller.getState().snapshot!.target, "oe.page.design"]); controller.setLocalDraft(key, { unexpected: "original" });
    await act(async () => root.render(<NotesStyleGalleryButton controller={controller} appearance={appearance} language="ja" />)); await click("書式とカバーを変更 •"); expect(button("確認して適用").disabled).toBe(true); expect(controller.getState().localDrafts[key]).toEqual({ unexpected: "original" }); await click("キャンセル"); expect(controller.getState().pendingEditors).toBe(false);
  });
  it("renders only safe existing cover metadata without changing archives", () => {
    const { controller, appearance, update } = fixture(); act(() => update({ snapshot: { ...controller.getState().snapshot!, metadata: { cover: "javascript:alert(1)", untouched: { archived: true } } } })); act(() => root.render(<NotesPageHeader controller={controller} appearance={appearance} language="ja" onShowPages={vi.fn()} onOpen={vi.fn()} />)); expect(container.querySelector("img")).toBeNull(); expect(controller.getState().snapshot!.metadata.cover).toBe("javascript:alert(1)");
  });
});
describe("selection assistance and comments", () => {
  it.each(["ime", "status", "cache", "other-input", "entitlement"])("does not invoke the host service after live %s changes before render", async kind => {
    const { controller, bridge, update } = fixture(), service: NotesSelectionAIService = { run: vi.fn(async request => response(request)) }; act(() => root.render(<NotesSelectionTools controller={controller} bridge={bridge} service={service} />)); await click("選択文をAIで編集"); const generate = button("エージェントに編集させる"), key = Object.keys(controller.getState().localDrafts)[0]!;
    act(() => { if (kind === "ime") controller.setComposing(true); else if (kind === "status") update({ status: "unknown" }); else if (kind === "cache") controller.setLocalDraft(key, { ...(controller.getState().localDrafts[key] as any), instruction: "newer" }); else if (kind === "other-input") controller.setLocalDraft("other", { source: "retain" }); else update({ snapshot: { ...controller.getState().snapshot!, capabilities: [] } }); generate.click(); }); expect(service.run).not.toHaveBeenCalled(); expect(controller.getState().pendingEditors).toBe(true);
  });
  it("preserves a newer selection instruction before the stale apply/cancel handler rerenders", async () => {
    const { controller, bridge } = fixture(), service: NotesSelectionAIService = { run: async request => response(request) }; act(() => root.render(<NotesSelectionTools controller={controller} bridge={bridge} service={service} />)); await click("選択文をAIで編集"); await click("エージェントに編集させる"); const key = Object.keys(controller.getState().localDrafts)[0]!, old = controller.getState().localDrafts[key] as any, apply = button("選択範囲を置換"), cancel = button("キャンセル"), newer = { ...old, instruction: "newer" };
    act(() => { controller.setLocalDraft(key, newer); apply.click(); cancel.click(); }); expect(controller.getState().localDrafts[key]).toEqual(newer); expect(bridge.replaceSelection).not.toHaveBeenCalled();
  });
  it("makes an already reviewed proposal inert after changing the service instance", async () => {
    const { controller, bridge } = fixture(), service: NotesSelectionAIService = { run: async request => response(request) }; act(() => root.render(<NotesSelectionTools controller={controller} bridge={bridge} service={service} />)); await click("選択文をAIで編集"); await click("エージェントに編集させる"); const retained = JSON.stringify(controller.getState().localDrafts); act(() => root.render(<NotesSelectionTools controller={controller} bridge={bridge} service={{ run: async request => response(request) }} />)); expect(button("選択範囲を置換").disabled).toBe(true); expect(JSON.stringify(controller.getState().localDrafts)).toBe(retained);
  });
  it("generates once, never writes automatically, and rejects a proposal while preserving instruction", async () => {
    const { controller, bridge } = fixture(); let settle!: (result: NotesSelectionAIResult) => void, request!: NotesSelectionAIRequest; const service: NotesSelectionAIService = { run: vi.fn(value => { request = value; return new Promise<NotesSelectionAIResult>(done => { settle = done; }); }) };
    act(() => root.render(<NotesSelectionTools controller={controller} bridge={bridge} service={service} />)); await click("選択文をAIで編集"); input(document.body.querySelector("textarea")!, "保つ指示"); await act(async () => { button("エージェントに編集させる").click(); button("エージェントに編集させる").click(); }); expect(service.run).toHaveBeenCalledTimes(1); expect(request.selection.text).toBe("Selected source");
    await act(async () => settle(response(request))); expect(bridge.replaceSelection).not.toHaveBeenCalled(); expect(controller.execute).not.toHaveBeenCalled(); await click("提案を拒否"); expect(document.body.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("保つ指示"); expect(controller.getState().pendingEditors).toBe(true);
  });
  it("rejects foreign result identity and keeps raw input", async () => {
    const { controller, bridge } = fixture(), service: NotesSelectionAIService = { run: vi.fn(async request => ({ ...response(request), selectionId: "another" })) }; act(() => root.render(<NotesSelectionTools controller={controller} bridge={bridge} service={service} />)); await click("選択文をAIで編集"); await click("エージェントに編集させる"); expect(document.body.textContent).toContain("提案を確認できませんでした"); expect(bridge.replaceSelection).not.toHaveBeenCalled(); expect(controller.getState().pendingEditors).toBe(true);
  });
  it("cancels generation and ignores late settlement after close", async () => {
    const { controller, bridge } = fixture(); let request!: NotesSelectionAIRequest, settle!: (value: NotesSelectionAIResult) => void; const service: NotesSelectionAIService = { run: value => { request = value; return new Promise(done => { settle = done; }); } };
    act(() => root.render(<NotesSelectionTools controller={controller} bridge={bridge} service={service} />)); await click("選択文をAIで編集"); await click("エージェントに編集させる"); await click("閉じる"); expect(request.signal.aborted).toBe(true); await act(async () => settle(response(request))); expect(controller.getState().pendingEditors).toBe(true); await click("保持した入力を開く"); expect(document.body.querySelector(".oe-notes-selection-proposal")).toBeNull();
  });
  it("holds a proposal when the source revision changes and does not apply it", async () => {
    const { controller, bridge, update } = fixture(), service: NotesSelectionAIService = { run: async request => response(request) }; act(() => root.render(<NotesSelectionTools controller={controller} bridge={bridge} service={service} />)); await click("選択文をAIで編集"); await click("エージェントに編集させる"); act(() => update({ snapshot: { ...controller.getState().snapshot!, revision: "r2" } })); expect(button("選択範囲を置換").disabled).toBe(true); await click("選択範囲を置換"); expect(bridge.replaceSelection).not.toHaveBeenCalled(); expect(controller.getState().pendingEditors).toBe(true);
  });
  it("uses the local draft body bridge only after explicit review, then offers guarded Undo", async () => {
    const { controller, bridge } = fixture(), service: NotesSelectionAIService = { run: async request => response(request) }; act(() => root.render(<NotesSelectionTools controller={controller} bridge={bridge} service={service} />)); await click("選択文をAIで編集"); await click("エージェントに編集させる"); await click("選択範囲を置換"); expect(bridge.replaceSelection).toHaveBeenCalledWith(expect.objectContaining({ blockId: "block", text: "Selected source" }), "Reviewed suggestion", expect.any(String), expect.any(String)); expect(controller.execute).not.toHaveBeenCalled(); expect(controller.getState().pendingEditors).toBe(false); await click("AI置換を取り消す"); expect(bridge.undoSelection).toHaveBeenCalledWith("opaque-range");
  });
  it("handles a stale public Undo exception without changing the body or crashing the UI", async () => {
    const { controller, bridge } = fixture(), service: NotesSelectionAIService = { run: async request => response(request) }; bridge.undoSelection = vi.fn(() => { throw new Error("Writer unavailable"); }); act(() => root.render(<NotesSelectionTools controller={controller} bridge={bridge} service={service} />)); await click("選択文をAIで編集"); await click("エージェントに編集させる"); await click("選択範囲を置換"); await click("AI置換を取り消す"); expect(document.body.textContent).toContain("取り消せません"); expect(controller.execute).not.toHaveBeenCalled();
  });
  it("retains a comment across close/unmount and blocks IME submission", async () => {
    const { controller, bridge } = fixture(); const render = () => root.render(<NotesSelectionTools controller={controller} bridge={bridge} />); act(render); await click("選択文にコメント"); input(document.body.querySelector("textarea")!, "コメントを保持"); act(() => document.body.querySelector("textarea")!.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))); expect(button("コメントを追加").disabled).toBe(true); await click("コメントを追加"); expect(controller.execute).not.toHaveBeenCalled(); await click("閉じる"); expect(controller.getState().composing).toBe(false); act(() => root.render(null)); act(render); await click("保持した入力を開く"); expect(document.body.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("コメントを保持");
  });
  it("submits the source block comment via the existing writer and preserves it on denial", async () => {
    const { controller, bridge } = fixture(); act(() => root.render(<NotesSelectionTools controller={controller} bridge={bridge} />)); await click("選択文にコメント"); input(document.body.querySelector("textarea")!, "block comment"); await click("コメントを追加"); expect(controller.execute).toHaveBeenCalledWith({ kind: "comment.add", blockId: "block", text: "block comment" }, { localDraftId: expect.any(String) }); expect(document.body.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("block comment"); expect(controller.getState().pendingEditors).toBe(true);
  });
  it("retains malformed selection cache without calling a host or replacing it", () => {
    const { controller, bridge } = fixture(); const key = JSON.stringify([controller.getState().snapshot!.scope, controller.getState().snapshot!.target, "oe.text.selection"]); controller.setLocalDraft(key, { unexpected: "retained" }); act(() => root.render(<NotesSelectionTools controller={controller} bridge={bridge} />)); expect(container.textContent).toContain("入力を確認できません"); expect(controller.getState().localDrafts[key]).toEqual({ unexpected: "retained" }); expect(bridge.captureSelection).not.toHaveBeenCalled();
  });
});

describe("selection action host entry and unavailable explanations", () => {
  it("explains an unbound AI and ungranted comment without capture, draft or request", async () => {
    const { controller, bridge, update } = fixture(); update({ snapshot: {...controller.getState().snapshot!,capabilities:["document.save"],capabilitySemantics:{"document.save":"test-only"}} });
    act(() => root.render(<NotesSelectionTools controller={controller} bridge={bridge} />));
    await click("AI編集の接続状態"); expect(document.body.textContent).toContain("未接続"); await click("閉じる");
    await click("コメントの利用状態"); expect(document.body.textContent).toContain("保存権限または保存先"); expect(bridge.captureSelection).not.toHaveBeenCalled(); expect(controller.execute).not.toHaveBeenCalled(); expect(controller.getState().localDrafts).toEqual({});
  });
  it("opens existing review once without creating a draft, applying, saving or generating", async () => {
    const { controller, bridge, selection, update } = fixture(); let resolve!: () => void; let request!: import("../src/react/notesSelection.js").NotesSelectionProposalRequest;
    const entry = {open: vi.fn((r: typeof request) => {request=r; return new Promise<void>(done=>{resolve=done;});})};
    act(() => root.render(<NotesSelectionTools controller={controller} bridge={bridge} proposalEntry={entry} />));
    await act(async()=>{button("選択文をAIで編集").click();button("選択文をAIで編集").click();}); expect(entry.open).toHaveBeenCalledTimes(1); expect(request.selection).toBe(selection); expect(request.isCurrent()).toBe(true); expect(controller.getState().localDrafts).toEqual({}); expect(controller.execute).not.toHaveBeenCalled(); expect(bridge.replaceSelection).not.toHaveBeenCalled();
    act(()=>update({snapshot:{...controller.getState().snapshot!,revision:"r2"}})); expect(request.isCurrent()).toBe(false); await act(async()=>resolve());
  });
  it.each(["ime","pending","save","recovery"])("never opens host review while %s blocks the live writer", async kind => {
    const {controller,bridge,update}=fixture(), entry={open:vi.fn()}; act(()=>root.render(<NotesSelectionTools controller={controller} bridge={bridge} proposalEntry={entry} />)); const startButton=button("選択文をAIで編集");
    act(()=>{ if(kind==="ime")controller.setComposing(true); if(kind==="pending")controller.setLocalDraft("human",{input:"retained"}); if(kind==="save")update({status:"saving"}); if(kind==="recovery")update({manualSaveRequired:true}); startButton.click();}); expect(entry.open).not.toHaveBeenCalled(); expect(bridge.replaceSelection).not.toHaveBeenCalled();
  });
  it("revokes forwarded source on rebinding and unmount", async () => {
    const {controller,bridge}=fixture(); let request!: import("../src/react/notesSelection.js").NotesSelectionProposalRequest; const entry={open:(r:typeof request)=>{request=r;}};
    act(()=>root.render(<NotesSelectionTools controller={controller} bridge={bridge} proposalEntry={entry} />)); await click("選択文をAIで編集"); act(()=>root.render(<NotesSelectionTools controller={controller} bridge={bridge} proposalEntry={{open:vi.fn()}} />)); expect(request.signal.aborted).toBe(true); expect(request.isCurrent()).toBe(false);
    act(()=>root.render(null)); expect(request.isCurrent()).toBe(false);
  });
  it("keeps the composer and typed comment when transient toolbar children unmount", async () => {
    const {controller,bridge}=fixture(); act(()=>root.render(<NotesSelectionTools controller={controller} bridge={bridge}><span>Transient toolbar</span></NotesSelectionTools>)); await click("選択文にコメント"); input(document.body.querySelector("textarea")!,"持続するコメント"); act(()=>root.render(<NotesSelectionTools controller={controller} bridge={bridge} integrated />)); expect(document.body.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("持続するコメント"); expect(controller.execute).not.toHaveBeenCalled();
  });
});

describe("selection start permission fence", () => {
  it("does not capture, create a draft or open host review after live document permission revocation", async () => {
    const {controller,bridge,update}=fixture(),entry={open:vi.fn()}; act(()=>root.render(<NotesSelectionTools controller={controller} bridge={bridge} proposalEntry={entry} />)); const action=button("選択文をAIで編集");
    act(()=>{update({snapshot:{...controller.getState().snapshot!,capabilities:["comment.add"],capabilitySemantics:{"comment.add":"test-only"}}});action.click();}); expect(entry.open).not.toHaveBeenCalled();expect(bridge.captureSelection).not.toHaveBeenCalled();expect(controller.getState().localDrafts).toEqual({});
  });
});
