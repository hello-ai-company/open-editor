/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorDocument } from "@hello-ai-company/editor-core";
import type { NotesCommandOutcome, NotesWorkspaceController, NotesWorkspaceState } from "../src/notes/contracts.js";
import { NotesContentTools, notesSafeAssetUrl, type NotesMediaScope } from "../src/react/NotesContentTools.js";

let container: HTMLDivElement, root: Root;
const global = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
let prior: boolean | undefined;
beforeEach(() => { prior = global.IS_REACT_ACT_ENVIRONMENT; global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); global.IS_REACT_ACT_ENVIRONMENT = prior; });
const imported: EditorDocument = { schemaVersion: 1, blocks: [{ id: "unknown", type: "futureBlock", props: { future: { untouched: [true, "original"] } }, content: [{ type: "futureInline", source: "原文" }] }] };
function fixture() {
  let state: NotesWorkspaceState = { status: "ready", dirty: false, composing: false, localDrafts: {}, pendingEditors: false, message: "", snapshot: { scope: { actorId: "test-actor", workspaceId: "test-workspace" }, target: { kind: "row", databaseId: "db-a", rowId: "same-id" }, revision: "r1", contentRevision: "d1", title: "合成", metadata: {}, capabilities: ["document.save", "template.save", "template.apply", "template.delete", "media.attach"], capabilitySemantics: { "document.save": "test-only", "template.save": "test-only", "template.apply": "test-only", "template.delete": "test-only", "media.attach": "test-only" }, document: { schemaVersion: 1, blocks: [{ id: "existing", type: "paragraph", content: "原文" }] } } };
  const listeners = new Set<() => void>(), update = (next: Partial<NotesWorkspaceState>) => { state = { ...state, ...next }; listeners.forEach(listener => listener()); };
  const controller: NotesWorkspaceController = { getState: () => state, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, open: vi.fn(), setDraft: vi.fn((document: EditorDocument) => update({ draft: document, dirty: true })), setComposing: value => update({ composing: value }), setLocalDraft: (id, value) => { const localDrafts = { ...state.localDrafts }; if (value === undefined) delete localDrafts[id]; else localDrafts[id] = value; update({ localDrafts, pendingEditors: Object.keys(localDrafts).length > 0 }); }, save: vi.fn(), execute: vi.fn(async (): Promise<NotesCommandOutcome> => ({ status: "denied", target: state.snapshot!.target, operationId: "test-op" })), cancel: vi.fn(), reconcile: vi.fn(), getRecovery: vi.fn(), persistLocalDrafts: vi.fn(async () => true), readLatest: vi.fn(), acceptMergedDraft: vi.fn(), dispose: vi.fn() };
  return { controller, update };
}
function button(text: string): HTMLButtonElement { const match = [...container.querySelectorAll("button")].find(element => element.textContent?.trim() === text); if (!match) throw new Error(`Missing button: ${text}`); return match; }
function click(text: string) { act(() => button(text).click()); }
function input(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) { act(() => { const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })); }); }

describe("Notes content tools", () => {
  it("reviews JSON losslessly and writes only a local draft after explicit confirmation", async () => {
    const { controller } = fixture(); act(() => root.render(<NotesContentTools controller={controller} />)); click("読み込む");
    input(container.querySelector("textarea")!, JSON.stringify(imported)); await act(async () => button("内容を確認").click());
    expect(controller.setDraft).not.toHaveBeenCalled(); await act(async () => button("確認して本文を置き換える").click());
    expect(controller.setDraft).toHaveBeenCalledWith(imported); expect(controller.execute).not.toHaveBeenCalled(); expect(controller.save).not.toHaveBeenCalled(); expect(container.textContent).toContain("保存はまだ行っていません");
  });
  it("retains parsed content while rejecting an editor change during parsing", async () => {
    const { controller, update } = fixture(); let resolve!: (doc: EditorDocument) => void;
    const parse = vi.fn(() => new Promise<EditorDocument>(done => { resolve = done; }));
    act(() => root.render(<NotesContentTools controller={controller} codecs={{ parse, serialize: vi.fn() }} />)); click("読み込む"); input(container.querySelector("textarea")!, "markdown source");
    await act(async () => button("内容を確認").click()); act(() => update({ draft: { schemaVersion: 1, blocks: [{ id: "existing", type: "paragraph", content: "他の入力" }] }, dirty: true }));
    await act(async () => resolve(imported)); expect(button("確認して本文を置き換える").disabled).toBe(true); expect(controller.setDraft).not.toHaveBeenCalled(); expect(container.querySelector("textarea")!.value).toBe("markdown source"); expect(container.textContent).toContain("文書が変更されました");
  });
  it("aborts parsing on Escape and never applies late completion", async () => {
    const { controller } = fixture(); let signal!: AbortSignal, resolve!: (doc: EditorDocument) => void;
    const parse = vi.fn((_format, _text, captured: AbortSignal) => { signal = captured; return new Promise<EditorDocument>(done => { resolve = done; }); });
    act(() => root.render(<NotesContentTools controller={controller} codecs={{ parse, serialize: vi.fn() }} />)); click("読み込む"); input(container.querySelector("textarea")!, "retained source"); await act(async () => button("内容を確認").click());
    act(() => container.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(signal.aborted).toBe(true); await act(async () => resolve(imported)); expect(container.querySelector('[role="dialog"]')).toBeNull(); expect(controller.setDraft).not.toHaveBeenCalled();
  });
  it("leaves IME input enabled and suppresses preview and Escape until composition ends", async () => {
    const { controller } = fixture(); act(() => root.render(<NotesContentTools controller={controller} />)); click("読み込む"); const textarea = container.querySelector("textarea")!; input(textarea, JSON.stringify(imported));
    act(() => textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))); expect(textarea.disabled).toBe(false); expect(button("内容を確認").disabled).toBe(true);
    act(() => textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, isComposing: true }))); expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    act(() => textarea.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }))); await act(async () => button("内容を確認").click()); expect(button("確認して本文を置き換える").disabled).toBe(false);
  });
  it("offers Markdown/HTML only with codecs and exports a captured document through the public callback", async () => {
    const { controller } = fixture(), onExport = vi.fn(), serialize = vi.fn(async (_format: string, _document: EditorDocument, _signal: AbortSignal) => "<p>原文</p>");
    act(() => root.render(<NotesContentTools controller={controller} onExport={onExport} />)); click("書き出す"); expect(container.querySelector("select")!.options).toHaveLength(1); click("閉じる");
    act(() => root.render(<NotesContentTools controller={controller} codecs={{ parse: vi.fn(), serialize }} onExport={onExport} />)); click("書き出す"); input(container.querySelector("select")!, "html");
    await act(async () => { button("ファイルを書き出す").click(); button("ファイルを書き出す").click(); }); expect(serialize).toHaveBeenCalledTimes(1); expect(serialize.mock.calls[0]?.[0]).toBe("html"); expect(onExport).toHaveBeenCalledWith("合成.html", "<p>原文</p>", "text/html");
  });
  it("requires template review with the exact revision and denies stale template updates", async () => {
    const { controller } = fixture(), template = { id: "t", revision: "tr1", title: "合成テンプレート", document: imported };
    const render = (revision: string) => root.render(<NotesContentTools controller={controller} panels={{ revision: "p1", templates: [{ ...template, revision }] }} />);
    act(() => render("tr1")); click("テンプレート"); click("テンプレートで置き換える"); expect(controller.execute).not.toHaveBeenCalled(); act(() => render("tr2")); expect(button("確認してテンプレートを反映").disabled).toBe(true);
    click("反映をキャンセル"); click("テンプレートで置き換える"); await act(async () => button("確認してテンプレートを反映").click());
    expect(controller.execute).toHaveBeenCalledWith({ kind: "template.apply", templateId: "t", expectedTemplateRevision: "tr2", afterDocument: imported }); expect(container.textContent).toContain("保存できませんでした");
  });
  it("preserves originals until template insertion is prepared and explicitly accepted", async () => {
    const { controller } = fixture(), template = { id: "t", revision: "tr1", title: "挿入用", document: imported }, after = { schemaVersion: 1, blocks: [...controller.getState().snapshot!.document.blocks, ...imported.blocks] };
    const prepare = vi.fn(async () => after);
    act(() => root.render(<NotesContentTools controller={controller} panels={{ revision: "p1", templates: [template] }} prepareTemplateInsertion={prepare} />)); click("テンプレート"); await act(async () => button("テンプレートを挿入").click()); expect(controller.execute).not.toHaveBeenCalled(); expect(prepare).toHaveBeenCalledTimes(1);
    await act(async () => button("確認してテンプレートを反映").click()); expect(controller.execute).toHaveBeenCalledWith({ kind: "template.apply", templateId: "t", expectedTemplateRevision: "tr1", afterDocument: after });
  });
  it("passes actor/workspace/database/row/block scope to upload and suppresses canceled assets", async () => {
    const { controller } = fixture(); let signal!: AbortSignal, scope!: NotesMediaScope, resolve!: (asset: { attachmentId: string; url: string; name: string; mimeType: string }) => void;
    const upload = vi.fn((_file, capturedScope: NotesMediaScope, capturedSignal: AbortSignal) => { scope = capturedScope; signal = capturedSignal; return new Promise<{ attachmentId: string; url: string; name: string; mimeType: string }>(done => { resolve = done; }); }), accepted = vi.fn();
    act(() => root.render(<NotesContentTools controller={controller} media={{ upload }} mediaBlockId="existing" onAssetAccepted={accepted} />)); click("メディアを追加");
    await act(async () => { const input = container.querySelector<HTMLInputElement>('input[type="file"]')!; Object.defineProperty(input, "files", { configurable: true, value: [new File(["synthetic"], "sample.png", { type: "image/png" })] }); input.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(scope).toEqual({ scope: { actorId: "test-actor", workspaceId: "test-workspace" }, target: { kind: "row", databaseId: "db-a", rowId: "same-id" }, blockId: "existing" });
    click("進行中の操作をキャンセル"); expect(signal.aborted).toBe(true); await act(async () => resolve({ attachmentId: "a", url: "https://example.invalid/a", name: "sample.png", mimeType: "image/png" })); expect(accepted).not.toHaveBeenCalled(); expect(container.textContent).not.toContain("確認して素材を追加");
  });
  it("never accepts dangerous asset URLs or id-less provider results", async () => {
    expect(notesSafeAssetUrl("javascript:alert(1)")).toBe(false); expect(notesSafeAssetUrl("data:text/html,a")).toBe(false); expect(notesSafeAssetUrl("https://user:password@example.invalid/a")).toBe(false); expect(notesSafeAssetUrl("https://example.invalid/a")).toBe(true);
    const { controller } = fixture(), accepted = vi.fn();
    const upload = vi.fn(async () => ({ url: "https://example.invalid/file", name: "no identity", mimeType: "image/png" }));
    act(() => root.render(<NotesContentTools controller={controller} media={{ upload }} mediaBlockId="existing" onAssetAccepted={accepted} />)); click("メディアを追加");
    await act(async () => { const input = container.querySelector<HTMLInputElement>('input[type="file"]')!; Object.defineProperty(input, "files", { configurable: true, value: [new File(["x"], "x.png")] }); input.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(container.textContent).toContain("保存先と安全なURLを確認できませんでした"); expect(accepted).not.toHaveBeenCalled(); expect(controller.execute).not.toHaveBeenCalled();
  });
  it("searches images only on request and confirms an authorized resource before local insertion", async () => {
    const { controller } = fixture(), image = { id: "image", title: "合成の画像", url: "https://example.invalid/image" }, asset = { attachmentId: "owned-image", name: "合成の素材", mimeType: "image/png", url: "https://example.invalid/owned" };
    const searchImages = vi.fn(async () => ({ results: [image], hasMore: false })), acceptImage = vi.fn(async () => asset), onAssetAccepted = vi.fn(async () => {});
    act(() => root.render(<NotesContentTools controller={controller} media={{ searchImages, acceptImage }} mediaBlockId="existing" onAssetAccepted={onAssetAccepted} />)); click("メディアを追加");
    expect(searchImages).not.toHaveBeenCalled(); expect(container.querySelectorAll("img")).toHaveLength(0); input(container.querySelector<HTMLInputElement>('input[aria-label="素材の検索語"]')!, "合成");
    await act(async () => button("素材を検索").click()); expect(searchImages).toHaveBeenCalledTimes(1); await act(async () => button("合成の画像").click()); expect(acceptImage).toHaveBeenCalledTimes(1); expect(onAssetAccepted).not.toHaveBeenCalled();
    await act(async () => button("確認して素材を追加").click()); expect(onAssetAccepted).toHaveBeenCalledTimes(1); expect(onAssetAccepted).toHaveBeenCalledWith(asset, { scope: { actorId: "test-actor", workspaceId: "test-workspace" }, target: { kind: "row", databaseId: "db-a", rowId: "same-id" }, blockId: "existing" }, expect.any(AbortSignal), "card"); expect(controller.execute).not.toHaveBeenCalled();
  });
  it("fences a prepared resource when the selected block changes", async () => {
    const { controller, update } = fixture(), asset = { attachmentId: "owned", name: "合成の素材", mimeType: "image/png", url: "https://example.invalid/owned" }, upload = vi.fn(async () => asset), accepted = vi.fn();
    act(() => update({ snapshot: { ...controller.getState().snapshot!, document: { schemaVersion: 1, blocks: [...controller.getState().snapshot!.document.blocks, { id: "other", type: "paragraph", content: "別の対象" }] } } }));
    const render = (block: string) => root.render(<NotesContentTools controller={controller} media={{ upload }} mediaBlockId={block} onAssetAccepted={accepted} />);
    act(() => render("existing")); click("メディアを追加");
    await act(async () => { const input = container.querySelector<HTMLInputElement>('input[type="file"]')!; Object.defineProperty(input, "files", { configurable: true, value: [new File(["x"], "x.png")] }); input.dispatchEvent(new Event("change", { bubbles: true })); });
    act(() => render("other")); expect(button("確認して素材を追加").disabled).toBe(true); expect(accepted).not.toHaveBeenCalled();
  });
});
