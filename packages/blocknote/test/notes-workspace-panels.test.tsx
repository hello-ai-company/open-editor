/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDocumentIndex } from "../src/index/documentIndex.js";
import { createNotesWorkspaceController } from "../src/notes/controller.js";
import type { NotesCommandOutcome, NotesWorkspaceController, NotesWorkspaceState } from "../src/notes/contracts.js";
import { NotesDocumentSidebar } from "../src/react/NotesDocumentSidebar.js";
import { NotesInspector } from "../src/react/NotesInspector.js";
import { NotesRowDetail } from "../src/react/NotesRowDetail.js";
import { NOTES_INSERT_CATALOG, NOTES_STYLE_CATALOG, notesAvailableCatalog, type NotesEditorBridge } from "../src/react/notesWorkspacePanels.js";

let container: HTMLDivElement, root: Root;
const global = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
let prior: boolean | undefined;
beforeEach(() => { prior = global.IS_REACT_ACT_ENVIRONMENT; global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); global.IS_REACT_ACT_ENVIRONMENT = prior; });
function fixture() {
  let state: NotesWorkspaceState = { status: "ready", dirty: false, composing: false, localDrafts: {}, pendingEditors: false, message: "", snapshot: { scope: { actorId: "synthetic-actor", workspaceId: "synthetic-workspace" }, contentRevision: "d1", capabilitySemantics: { "comment.add": "test-only", "comment.update": "test-only", "comment.delete": "test-only", "history.save": "test-only", "history.restore": "test-only", "history.rename": "test-only", "history.delete": "test-only", "metadata.patch": "test-only", "property.patch": "test-only", "document.save": "test-only" }, target: { kind: "page", pageId: "synthetic-page" }, revision: "r1", title: "合成の文書", metadata: { category: "work", privacy: "private", tags: ["first"] }, capabilities: ["comment.add", "comment.update", "comment.delete", "history.save", "history.restore", "history.rename", "history.delete", "metadata.patch", "property.patch", "document.save"], document: { schemaVersion: 1, blocks: [{ id: "h", type: "heading", props: { level: 2 }, content: [{ type: "text", text: "見出し" }] }, { id: "task", type: "checkListItem", props: { checked: false }, content: [{ type: "text", text: "合成タスク" }] }] } } };
  const listeners = new Set<() => void>();
  const update = (next: Partial<NotesWorkspaceState>) => { state = { ...state, ...next }; for (const listener of listeners) listener(); };
  const controller: NotesWorkspaceController = { getState: () => state, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, open: vi.fn(), setDraft: vi.fn(), setComposing: value => update({ composing: value }), setLocalDraft: (id, value) => { const localDrafts = { ...state.localDrafts }; if (value === undefined) delete localDrafts[id]; else localDrafts[id] = value; update({ localDrafts, pendingEditors: Object.keys(localDrafts).length > 0 }); }, save: vi.fn(), execute: vi.fn(async () => ({ status: "denied" as const, target: state.snapshot!.target, operationId: "synthetic-op" })), cancel: vi.fn(), reconcile: vi.fn(async () => ({ status: "denied" as const, target: state.snapshot!.target, operationId: "synthetic-op" })), getRecovery: vi.fn(), persistLocalDrafts: vi.fn(async () => true), readLatest: vi.fn(), acceptMergedDraft: vi.fn(), dispose: vi.fn() };
  const index = createDocumentIndex(); index.replaceFromBlocks(state.snapshot!.document.blocks);
  const bridge: NotesEditorBridge = { index, installedBlockTypes: ["paragraph", "heading", "checkListItem", "image", "table", "oeColumns", "oeColumn"], supportedInsertActions: ["text", "image", "columns", "whiteboard"], supportedStyleActions: ["heading", "fontMono"], editable: true, focusBlock: vi.fn(), toggleTask: vi.fn(), insert: vi.fn(), format: vi.fn() };
  return { controller, bridge, update };
}
function button(text: string): HTMLButtonElement { const match = [...container.querySelectorAll("button")].find(element => element.textContent?.trim() === text); if (!match) throw new Error(`Missing button: ${text}`); return match; }
function click(text: string): void { act(() => button(text).click()); }
function input(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void { act(() => { const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })); }); }
const panels = { revision: "panels1", comments: [{ id: "c", blockId: "h", text: "合成コメント", resolved: false, createdAt: "2026-10-07" }], history: [{ id: "v", revision: "v1", name: "合成の版", createdAt: "2026-10-07" }] };

describe("reusable Notes panels", () => {
  it("filters all 23 insert and 21 style definitions using actual installed schema and bound actions", () => {
    expect(NOTES_INSERT_CATALOG).toHaveLength(23); expect(NOTES_STYLE_CATALOG).toHaveLength(21);
    expect(notesAvailableCatalog(NOTES_INSERT_CATALOG, ["equation", "columns", "image"], ["math", "oeColumns", "image"]).map(item => item.kind)).toEqual(["image"]);
    expect(notesAvailableCatalog(NOTES_INSERT_CATALOG, ["equation", "columns"], ["mathBlock", "oeColumns", "oeColumn"]).map(item => item.kind)).toEqual(["equation", "columns"]);
    const { controller, bridge } = fixture(); act(() => root.render(<NotesInspector controller={controller} bridge={bridge} />));
    expect(container.textContent).toContain("カラム"); expect(container.textContent).not.toContain("ホワイトボード");
  });
  it("uses document index for navigation and keeps tab focus/IME keys local", () => {
    const { controller, bridge } = fixture(); act(() => root.render(<NotesDocumentSidebar controller={controller} bridge={bridge} panels={panels} />));
    act(() => container.querySelector<HTMLButtonElement>(".oe-outline__link")!.click()); expect(bridge.focusBlock).toHaveBeenCalledWith("h");
    const first = container.querySelector<HTMLButtonElement>('[role="tab"]')!;
    act(() => { first.focus(); first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, isComposing: true })); });
    expect(first.getAttribute("aria-selected")).toBe("true");
    act(() => first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(document.activeElement?.textContent).toBe("タスク"); expect(container.textContent).toContain("合成タスク");
  });
  it("keeps comment drafts editable during IME, prevents composition submission and clears target-scoped drafts", async () => {
    const { controller, bridge, update } = fixture(); act(() => root.render(<NotesDocumentSidebar controller={controller} bridge={bridge} panels={panels} initialTab="comments" />));
    const textarea = container.querySelector("textarea")!; input(textarea, "まだ入力中"); input(container.querySelector("select")!, "h");
    act(() => textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
    expect(textarea.disabled).toBe(false); expect(button("コメントを追加").disabled).toBe(true);
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(controller.execute).not.toHaveBeenCalled();
    act(() => update({ snapshot: { ...controller.getState().snapshot!, target: { kind: "page", pageId: "another-page" } } }));
    expect(container.querySelector("textarea")!.value).toBe(""); expect(controller.getState().composing).toBe(false);
  });
  it("sends one reviewed comment despite repeated submissions and retains text on denied writes", async () => {
    const { controller, bridge } = fixture(); let resolve!: (value: NotesCommandOutcome) => void;
    controller.execute = vi.fn(() => new Promise<NotesCommandOutcome>(done => { resolve = done; }));
    act(() => root.render(<NotesDocumentSidebar controller={controller} bridge={bridge} panels={panels} initialTab="comments" />));
    input(container.querySelector("textarea")!, "保持する入力"); input(container.querySelector("select")!, "h");
    await act(async () => { const form = container.querySelector("form")!; form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(controller.execute).toHaveBeenCalledTimes(1); expect(controller.execute).toHaveBeenCalledWith({ kind: "comment.add", blockId: "h", text: "保持する入力" }, { localDraftId: expect.any(String) });
    await act(async () => resolve({ status: "denied" as const, target: { kind: "page", pageId: "synthetic-page" }, operationId: "synthetic-op" }));
    expect(container.querySelector("textarea")!.value).toBe("保持する入力"); expect(container.textContent).toContain("保存できませんでした");
  });
  it("requires explicit restore confirmation, Escape cancels, and unsupported history actions stay disabled", () => {
    const { controller, bridge, update } = fixture(); act(() => root.render(<NotesDocumentSidebar controller={controller} bridge={bridge} panels={panels} initialTab="history" />));
    click("この版を復元"); expect(controller.execute).not.toHaveBeenCalled(); expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();
    act(() => container.querySelector('[role="alertdialog"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    act(() => update({ snapshot: { ...controller.getState().snapshot!, capabilities: [] } }));
    expect(button("この版を復元").disabled).toBe(true); expect(button("現在の版を保存").disabled).toBe(true);
  });
  it("retains metadata input when an external revision changes and blocks the stale patch", async () => {
    const { controller, bridge, update } = fixture(); act(() => root.render(<NotesDocumentSidebar controller={controller} bridge={bridge} initialTab="info" />));
    input(container.querySelector('input[aria-label="タグ"]')!, "自分の入力");
    act(() => update({ snapshot: { ...controller.getState().snapshot!, revision: "r2", metadata: { tags: ["external"] } } }));
    expect(container.querySelector<HTMLInputElement>('input[aria-label="タグ"]')!.value).toBe("自分の入力"); expect(button("情報を確認して保存").disabled).toBe(true);
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(controller.execute).not.toHaveBeenCalled(); click("キャンセル"); expect(container.querySelector<HTMLInputElement>('input[aria-label="タグ"]')!.value).toBe("external");
  });
  it("preserves unsaved metadata across sidebar tabs and ends only its own IME composition", () => {
    const { controller, bridge } = fixture(); act(() => root.render(<NotesDocumentSidebar controller={controller} bridge={bridge} initialTab="info" />));
    const tag = container.querySelector<HTMLInputElement>('input[aria-label="タグ"]')!; input(tag, "保持するタグ"); act(() => tag.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
    const outlineTab = container.querySelector<HTMLButtonElement>('[role="tab"]')!; act(() => outlineTab.click()); expect(controller.getState().composing).toBe(false);
    click("情報"); expect(container.querySelector<HTMLInputElement>('input[aria-label="タグ"]')!.value).toBe("保持するタグ"); expect(controller.execute).not.toHaveBeenCalled();
  });
  it("uses authoritative lookup for an unknown save outcome and blocks further mutations", async () => {
    const { controller, bridge, update } = fixture(); act(() => update({ status: "unknown", message: "保存結果が不明です" }));
    act(() => root.render(<NotesDocumentSidebar controller={controller} bridge={bridge} panels={panels} initialTab="history" />));
    expect(button("現在の版を保存").disabled).toBe(true);
    await act(async () => button("保存結果を照会").click());
    expect(controller.reconcile).toHaveBeenCalledTimes(1); expect(controller.execute).not.toHaveBeenCalled();
  });
  it("aborts inspector work and ignores late picker settlement after cancellation", async () => {
    const { controller, bridge } = fixture(); let resolve!: () => void, signal!: AbortSignal;
    bridge.insert = vi.fn((_kind, captured) => { signal = captured; return new Promise<void>(done => { resolve = done; }); });
    act(() => root.render(<NotesInspector controller={controller} bridge={bridge} />));
    await act(async () => { button("画像").click(); button("画像").click(); }); expect(bridge.insert).toHaveBeenCalledTimes(1);
    click("挿入・書式をキャンセル"); expect(signal.aborted).toBe(true);
    await act(async () => resolve()); expect(container.textContent).toContain("操作を中断しました"); expect(container.textContent).not.toContain("本文に反映しました");
  });
  it("rejects parent controllers and row id collisions across different databases", () => {
    const { controller, bridge, update } = fixture(); act(() => update({ snapshot: { ...controller.getState().snapshot!, target: { kind: "row", databaseId: "db-a", rowId: "7" } } }));
    act(() => root.render(<NotesRowDetail target={{ kind: "row", databaseId: "db-b", rowId: "7" }} controller={controller} bridge={bridge} properties={[]} editor={<p>wrong editor</p>} onBack={vi.fn()} />));
    expect(container.textContent).not.toContain("wrong editor");
    act(() => root.render(<NotesRowDetail target={{ kind: "row", databaseId: "db-a", rowId: "7" }} controller={controller} parentController={controller} bridge={bridge} properties={[]} editor={<p>parent editor</p>} onBack={vi.fn()} />));
    expect(container.textContent).not.toContain("parent editor"); expect(controller.execute).not.toHaveBeenCalled();
  });
  it("prevents row navigation and Escape from abandoning dirty drafts", () => {
    const { controller, bridge, update } = fixture(), onBack = vi.fn(), onNext = vi.fn(); act(() => update({ dirty: true, snapshot: { ...controller.getState().snapshot!, target: { kind: "row", databaseId: "db", rowId: "r" } } }));
    act(() => root.render(<NotesRowDetail target={{ kind: "row", databaseId: "db", rowId: "r" }} controller={controller} bridge={bridge} properties={[]} editor={<textarea aria-label="行本文" />} onBack={onBack} onNext={onNext} />));
    click("戻る"); expect(onBack).not.toHaveBeenCalled(); expect(button("次の行").disabled).toBe(true);
    act(() => container.querySelector("textarea")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(onBack).not.toHaveBeenCalled(); expect(container.textContent).toContain("行の変更と保存結果を確認");
  });
  it("keeps a property-only draft across unmount and blocks Back, row switching and presentation changes", () => {
    const { controller, bridge, update } = fixture(), onBack = vi.fn(), onNext = vi.fn(), onPresentationChange = vi.fn();
    act(() => update({ snapshot: { ...controller.getState().snapshot!, target: { kind: "row", databaseId: "db", rowId: "r" } } }));
    const render = () => root.render(<NotesRowDetail target={{ kind: "row", databaseId: "db", rowId: "r" }} controller={controller} bridge={bridge} properties={[{ id: "title", label: "名前", value: "old", definition: { type: "text" } }]} editor={<p>行本文</p>} onBack={onBack} onNext={onNext} presentation="drawer" onPresentationChange={onPresentationChange} />);
    act(render); click("プロパティを編集"); input(container.querySelector("textarea")!, '"保持するプロパティ"');
    expect(controller.getState().dirty).toBe(false); expect(controller.getState().pendingEditors).toBe(true); expect(button("戻る").disabled).toBe(true); expect(button("次の行").disabled).toBe(true); expect(button("ページで表示").disabled).toBe(true);
    click("戻る"); expect(onBack).not.toHaveBeenCalled(); act(() => root.render(null)); expect(controller.getState().pendingEditors).toBe(true);
    act(render); expect(container.querySelector("textarea")!.value).toBe('"保持するプロパティ"'); click("キャンセル"); expect(controller.getState().pendingEditors).toBe(false); click("戻る"); expect(onBack).toHaveBeenCalledTimes(1);
  });
  it("preserves property input when its schema changes instead of submitting against a new type", () => {
    const { controller, bridge, update } = fixture(); act(() => update({ snapshot: { ...controller.getState().snapshot!, target: { kind: "row", databaseId: "db", rowId: "r" } } }));
    const render = (type: "text" | "number") => root.render(<NotesRowDetail target={{ kind: "row", databaseId: "db", rowId: "r" }} controller={controller} bridge={bridge} properties={[{ id: "property", label: "値", value: type === "text" ? "old" : 12, definition: { type } }]} editor={<p>行本文</p>} onBack={vi.fn()} />);
    act(() => render("text")); click("プロパティを編集"); input(container.querySelector("textarea")!, '"旧スキーマの入力"'); act(() => render("number"));
    expect(container.querySelector("textarea")!.value).toBe('"旧スキーマの入力"'); expect(button("値を確認して保存").disabled).toBe(true); expect(controller.execute).not.toHaveBeenCalled(); expect(container.textContent).toContain("スキーマの変更");
    click("キャンセル"); click("プロパティを編集"); expect(container.querySelector("textarea")!.value).toBe("12");
  });
  it("binds a property save to its cached exact input and retains it while the acknowledgement is unknown", async () => {
    const { controller, bridge, update } = fixture(); act(() => update({ snapshot: { ...controller.getState().snapshot!, target: { kind: "row", databaseId: "db", rowId: "r" } } }));
    controller.execute = vi.fn(async (): Promise<NotesCommandOutcome> => { update({ status: "unknown" }); return { status: "unknown", target: controller.getState().snapshot!.target, operationId: "unknown-op" }; });
    act(() => root.render(<NotesRowDetail target={{ kind: "row", databaseId: "db", rowId: "r" }} controller={controller} bridge={bridge} properties={[{ id: "property", label: "値", value: "old", definition: { type: "text" } }]} editor={<p>行本文</p>} onBack={vi.fn()} />));
    click("プロパティを編集"); input(container.querySelector("textarea")!, '"確認済み入力"'); await act(async () => button("値を確認して保存").click());
    expect(controller.execute).toHaveBeenCalledWith({ kind: "property.patch", propertyId: "property", value: "確認済み入力" }, { localDraftId: expect.any(String) }); expect(container.querySelector("textarea")!.value).toBe('"確認済み入力"'); expect(button("キャンセル").disabled).toBe(true); expect(button("戻る").disabled).toBe(true); expect(controller.getState().pendingEditors).toBe(true);
  });
  it("restores sidebar comment and metadata drafts after the sidebar closes", () => {
    const { controller, bridge } = fixture(); const render = (tab: "comments" | "info") => root.render(<NotesDocumentSidebar controller={controller} bridge={bridge} panels={panels} initialTab={tab} />);
    act(() => render("comments")); input(container.querySelector("textarea")!, "保持するコメント"); input(container.querySelector("select")!, "h"); act(() => root.render(null)); act(() => render("comments")); expect(container.querySelector("textarea")!.value).toBe("保持するコメント"); expect(container.querySelector("select")!.value).toBe("h");
    click("入力を取り消す"); click("情報"); input(container.querySelector<HTMLInputElement>('input[aria-label="タグ"]')!, "保持するメタデータ"); act(() => root.render(null)); act(() => render("info")); expect(container.querySelector<HTMLInputElement>('input[aria-label="タグ"]')!.value).toBe("保持するメタデータ"); expect(controller.getState().pendingEditors).toBe(true);
  });
  it("saves a cached property through the real controller and clears only the confirmed editor", async () => {
    const { controller: seed, bridge } = fixture(), target = { kind: "row" as const, databaseId: "db", rowId: "r" };
    let snapshot = { ...seed.getState().snapshot!, target, metadata: { properties: { property: "old" } } };
    const controller = createNotesWorkspaceController({ scope: snapshot.scope, readDocument: async () => snapshot, beforeSubmit: async () => {}, lookupOperation: vi.fn(), commit: async request => {
      if (request.command.kind !== "property.patch") throw new Error("Unexpected command");
      snapshot = { ...snapshot, revision: "r2", metadata: { properties: { property: String(request.command.value) } } };
      return { status: "committed", target, operationId: request.operationId, snapshot, historyId: "h2", persistence: "test-only" };
    } });
    await act(async () => { await controller.open(target); });
    act(() => root.render(<NotesRowDetail target={target} controller={controller} bridge={bridge} properties={[{ id: "property", label: "値", value: "old", definition: { type: "text" } }]} editor={<p>行本文</p>} onBack={vi.fn()} />));
    click("プロパティを編集"); input(container.querySelector("textarea")!, '"確認して保存"'); expect(button("値を確認して保存").disabled).toBe(false); expect(controller.getState().pendingEditors).toBe(true);
    await act(async () => button("値を確認して保存").click()); expect(controller.getState().pendingEditors).toBe(false); expect(controller.getState().localDrafts).toEqual({}); expect(container.querySelector("textarea")).toBeNull(); expect(container.textContent).toContain("確認して保存"); expect(button("戻る").disabled).toBe(false);
  });
});
