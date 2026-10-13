// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createNotesWorkspaceController } from "../src/notes/controller.js";
import type { NotesCommandResult, NotesDocumentSnapshot, NotesWorkspaceHost } from "../src/notes/contracts.js";
import { NotesAssistancePanel, type NotesAssistanceResult } from "../src/react/NotesAssistancePanel.js";
import { NotesDatabaseExplorer, type NotesDatabaseNavigationPage } from "../src/react/NotesDatabaseExplorer.js";
import { NotesDictionaryPanel } from "../src/react/NotesDictionaryPanel.js";
import { NotesDatabaseProperties } from "../src/react/NotesDatabaseProperties.js";
import { useNotesPropertyPickers, type NotesPropertyOptionsHost } from "../src/react/NotesPropertyPickers.js";
import { NotesProposalRail } from "../src/react/NotesProposalRail.js";
import { createDocumentIndex } from "../src/index/documentIndex.js";
import type { NotesEditorBridge } from "../src/react/notesWorkspacePanels.js";
import { validateNotesDatabasePropertyValue } from "../src/notes/propertyCatalog.js";

const scope = { actorId: "service-fixture", workspaceId: "synthetic" }, target = { kind: "row" as const, databaseId: "db", rowId: "row" };
const reactGlobal = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
let container: HTMLDivElement, root: Root, previous: boolean | undefined;
beforeEach(() => { previous = reactGlobal.IS_REACT_ACT_ENVIRONMENT; reactGlobal.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); reactGlobal.IS_REACT_ACT_ENVIRONMENT = previous; });
function fixture() {
  let snapshot: NotesDocumentSnapshot = { scope, target, title: "Synthetic", revision: "r1", contentRevision: "c1", document: createEditorDocument([{ id: "body", type: "paragraph", content: "Shared term and <script>text</script>" }]), metadata: { properties: { user: "元の名前" } }, capabilities: ["document.save", "property.patch"], capabilitySemantics: { "document.save": "test-only", "property.patch": "test-only" } };
  const commit = vi.fn<NotesWorkspaceHost["commit"]>(async request => {
    if (request.expectedRevision !== snapshot.revision) return { status: "conflict", target, operationId: request.operationId };
    if (request.command.kind === "property.patch") snapshot = { ...snapshot, metadata: { properties: { user: request.command.value } } };
    snapshot = { ...snapshot, revision: "r2" };
    return { status: "committed", target, operationId: request.operationId, snapshot, historyId: "h2", persistence: "test-only" };
  });
  const host: NotesWorkspaceHost = { scope, readDocument: async () => snapshot, beforeSubmit: async () => {}, commit, lookupOperation: async (_target, operationId): Promise<NotesCommandResult> => ({ target, operationId, status: "unknown" }) };
  return { controller: createNotesWorkspaceController(host), commit };
}
function click(label: string) { const button = [...document.body.querySelectorAll("button")].find(item => item.textContent?.trim() === label); if (!button) throw new Error(label); act(() => button.click()); }
function input(element: HTMLInputElement | HTMLTextAreaElement, value: string) { act(() => { const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); }); }
async function flush() { await act(async () => { await Promise.resolve(); }); }
const answer: NotesAssistanceResult = { scope, target, revision: "r1", text: "<script>inert</script> authorized answer", hits: [{ id: "hit", target: { kind: "page", pageId: "allowed" }, title: "Allowed hit" }] };

describe("portable Notes host services", () => {
  it("runs assistance only on explicit submit, fences repeats and opens only an authorized result", async () => {
    const f = fixture(); await f.controller.open(target); const onOpen = vi.fn(async () => true);
    let resolve!: (value: NotesAssistanceResult) => void; const run = vi.fn(() => new Promise<NotesAssistanceResult>(done => { resolve = done; }));
    act(() => root.render(<NotesAssistancePanel controller={f.controller} scope={scope} kind="search" service={{ run }} onOpen={onOpen} />));
    expect(run).not.toHaveBeenCalled(); input(container.querySelector("textarea")!, "question");
    act(() => { const form = container.querySelector("form")!; form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(run).toHaveBeenCalledTimes(1); await act(async () => resolve(answer));
    expect(container.textContent).toContain(answer.text); expect(container.querySelector("script")).toBeNull(); expect(f.commit).not.toHaveBeenCalled();
    click("Allowed hit"); await flush(); expect(onOpen).toHaveBeenCalledWith({ kind: "page", pageId: "allowed" }); f.controller.dispose();
  });
  it("aborts cancelled and edited requests and ignores late answers", async () => {
    const f = fixture(); await f.controller.open(target); let resolve!: (value: NotesAssistanceResult) => void;
    const run = vi.fn(() => new Promise<NotesAssistanceResult>(done => { resolve = done; }));
    act(() => root.render(<NotesAssistancePanel controller={f.controller} scope={scope} kind="ask-page" service={{ run }} />));
    input(container.querySelector("textarea")!, "keep question"); click("送信"); click("中止"); await act(async () => resolve(answer)); expect(container.textContent).not.toContain(answer.text);
    expect(container.querySelector("textarea")!.value).toBe("keep question"); click("送信"); act(() => f.controller.setDraft(createEditorDocument([{ id: "new", type: "paragraph", content: "human edit" }]))); await act(async () => resolve(answer));
    expect(container.textContent).not.toContain(answer.text); expect(f.commit).not.toHaveBeenCalled(); f.controller.dispose();
  });
  it("rejects cross-scope answers and suppresses a provider during local IME", async () => {
    const f = fixture(); await f.controller.open(target); const run = vi.fn(async () => ({ ...answer, scope: { ...scope, workspaceId: "other" } }));
    act(() => root.render(<NotesAssistancePanel controller={f.controller} scope={scope} kind="search" service={{ run, allowWeb: false }} />));
    input(container.querySelector("textarea")!, "question"); act(() => container.querySelector("textarea")!.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))); click("送信"); expect(run).not.toHaveBeenCalled();
    act(() => container.querySelector("textarea")!.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }))); click("送信"); await flush(); expect(container.textContent).toContain("結果を読み込めませんでした"); expect(container.querySelector('[type="checkbox"]')).toBeNull(); f.controller.dispose();
  });
  it("keeps DB previews bounded, distinguishes loaded rows from total, and deduplicates pages", async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ id: "row-" + i, title: "Row " + i, values: { a: "value" } })), columns = Array.from({ length: 8 }, (_, i) => ({ id: "col-" + i, title: "Column " + i }));
    const projection: NotesDatabaseNavigationPage = { scope, databaseId: "db", revision: "d1", columns, rows: rows.slice(0, 8), total: 12, nextCursor: "8" };
    const read = vi.fn(async request => request.cursor ? { ...projection, rows: rows.slice(7), nextCursor: undefined } : projection), onOpen = vi.fn(async () => true);
    act(() => root.render(<NotesDatabaseExplorer scope={scope} databases={[{ id: "db", title: "DB" }]} host={{ read }} onOpen={onOpen} />)); expect(read).not.toHaveBeenCalled();
    click("▦ DB"); await flush(); expect(container.textContent).toContain("読込済み 8件 / 全12件"); click("続きを読み込む"); await flush(); expect(container.textContent).toContain("読込済み 12件 / 全12件");
    click("プレビュー"); expect(document.body.querySelectorAll("tbody tr")).toHaveLength(8); expect(document.body.querySelectorAll("thead th")).toHaveLength(6);
    const row = document.body.querySelector<HTMLButtonElement>("tbody button")!; act(() => row.click()); await flush(); expect(onOpen).toHaveBeenCalledWith({ kind: "row", databaseId: "db", rowId: "row-0" }); expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
  it("treats missing DB totals as unknown and refuses paging after a remote revision changes", async () => {
    const read = vi.fn(async request => ({ scope, databaseId: "db", revision: request.cursor ? "d2" : "d1", columns: [], rows: [{ id: "row", title: "Row", values: {} }], nextCursor: request.cursor ? undefined : "next" }));
    act(() => root.render(<NotesDatabaseExplorer scope={scope} databases={[{ id: "db", title: "DB" }]} host={{ read }} onOpen={async () => true} />)); click("▦ DB"); await flush(); expect(container.textContent).toContain("総件数は未取得"); click("続きを読み込む"); await flush(); expect(container.textContent).toContain("一覧が変更されました"); expect(container.querySelectorAll("li")).toHaveLength(1);
  });
  it("uses literal dictionary terms and jumps without fetching or writing", () => {
    const index = createDocumentIndex(); index.replaceFromBlocks([{ id: "a", type: "paragraph", content: "A [term] appears here" }]); const focusBlock = vi.fn();
    const bridge: NotesEditorBridge = { index, focusBlock, editable: false, installedBlockTypes: [], supportedInsertActions: [], supportedStyleActions: [], insert: vi.fn(), format: vi.fn() };
    act(() => root.render(<NotesDictionaryPanel bridge={bridge} entries={[{ id: "term", term: "[term]", definition: "<b>inert</b>" }]} />)); expect(container.querySelector("b")).toBeNull(); click("A [term] appears here"); expect(focusBlock).toHaveBeenCalledWith("a");
  });
  it("displays escaped before/after and prevents concurrent proposal adoption and Undo during unknown save", async () => {
    let resolve!: () => void; const onApprove = vi.fn(() => new Promise<void>(done => { resolve = done; })), onUndo = vi.fn();
    act(() => root.render(<NotesProposalRail status="review" comparison={{ before: "<script>before</script>", after: "after" }} canApprove onApprove={onApprove} />));
    click("採用する"); click("採用する"); expect(onApprove).toHaveBeenCalledTimes(1); expect(container.querySelector("script")).toBeNull(); await act(async () => resolve());
    act(() => root.render(<NotesProposalRail status="unknown" canUndo onUndo={onUndo} />)); expect([...document.body.querySelectorAll("button")].find(button => button.textContent === "原文へ戻す")!.disabled).toBe(true); expect(onUndo).not.toHaveBeenCalled();
  });
  it("supports explicit legacy text/file modes without inventing reference identities", () => {
    expect(validateNotesDatabasePropertyValue({ id: "user", name: "User", type: "user", config: { valueMode: "legacy-text" } }, "元の名前")).toBe("元の名前");
    expect(validateNotesDatabasePropertyValue({ id: "place", name: "Place", type: "location", config: { valueMode: "legacy-text" } }, "場所の文字列")).toBe("場所の文字列");
    const files = [{ url: "https://example.invalid/a", name: "Old file", kind: "file", size: 12 }];
    expect(validateNotesDatabasePropertyValue({ id: "files", name: "Files", type: "files", config: { valueMode: "legacy-files" } }, files)).toEqual(files);
    expect(() => validateNotesDatabasePropertyValue({ id: "user", name: "User", type: "user" }, "元の名前")).toThrow();
    expect(() => validateNotesDatabasePropertyValue({ id: "files", name: "Files", type: "files", config: { valueMode: "legacy-files" } }, [{ url: "javascript:unsafe" }])).toThrow();
  });
  it("public picker choice remains a draft until a separate scoped save and cancel keeps the old legacy string", async () => {
    const f = fixture(); await f.controller.open(target); const definition = { id: "user", name: "担当者", type: "user", config: { valueMode: "legacy-text" } };
    const read: NotesPropertyOptionsHost["read"] = vi.fn(async () => ({ scope, target, propertyId: "user", valueMode: "legacy-text" as const, choices: [{ id: "allowed", label: "許可された旧形式名", value: "選択した名前" }] }));
    const optionsHost = { read };
    function Picker() { const binding = useNotesPropertyPickers({ controller: f.controller, scope, host: optionsHost }); return <><NotesDatabaseProperties databaseId="db" rowId="row" definitions={[definition]} values={{ user: "元の名前" }} controller={f.controller} adapters={binding.adapters} />{binding.picker}</>; }
    act(() => root.render(<Picker />)); expect(read).not.toHaveBeenCalled(); click("選択する"); await flush(); click("キャンセル"); await flush(); expect(container.querySelector("output")!.textContent).toBe("元の名前"); expect(f.commit).not.toHaveBeenCalled();
    click("選択する"); await flush(); act(() => document.body.querySelector<HTMLInputElement>('[type="radio"]')!.click()); click("この値を選択"); await flush(); expect(container.querySelector("output")!.textContent).toBe("選択した名前"); expect(f.commit).not.toHaveBeenCalled();
    await act(async () => click("確認して保存")); expect(f.commit.mock.calls[0]![0].command).toEqual({ kind: "property.patch", propertyId: "user", value: "選択した名前" }); f.controller.dispose();
  });
  it("cancels an open picker before calling a replacement provider and defers IME search until composition ends", async () => {
    const f = fixture(); await f.controller.open(target);
    const definition = { id: "user", name: "担当者", type: "user", config: { valueMode: "legacy-text" } };
    const projection = { scope, target, propertyId: "user", valueMode: "legacy-text" as const, choices: [{ id: "allowed", label: "名前", value: "名前" }] };
    const read = vi.fn<NotesPropertyOptionsHost["read"]>(async () => projection), replacement = vi.fn<NotesPropertyOptionsHost["read"]>(async () => projection);
    const hosts = new Map([[read, { read }], [replacement, { read: replacement }]]);
    function Picker({ provider = read, currentScope = scope }) { const binding = useNotesPropertyPickers({ controller: f.controller, scope: currentScope, host: hosts.get(provider)! }); return <><NotesDatabaseProperties databaseId="db" rowId="row" definitions={[definition]} values={{ user: "元の名前" }} controller={f.controller} adapters={binding.adapters} />{binding.picker}</>; }
    act(() => root.render(<Picker />)); click("選択する"); await flush(); expect(read).toHaveBeenCalledTimes(1);
    const search = document.body.querySelector<HTMLInputElement>('[aria-label="選択肢を検索"]')!;
    act(() => search.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))); input(search, "日本語"); await flush(); expect(read).toHaveBeenCalledTimes(1);
    act(() => search.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }))); await flush(); expect(read).toHaveBeenCalledTimes(2); expect(read.mock.calls[1]![0].query).toBe("日本語");
    act(() => root.render(<Picker provider={replacement} />)); await flush(); expect(replacement).not.toHaveBeenCalled(); expect(document.body.querySelector('[role="dialog"]')).toBeNull(); expect(f.commit).not.toHaveBeenCalled();
    act(() => root.render(<Picker currentScope={{ ...scope, workspaceId: "other" }} />)); click("選択する"); await flush(); expect(read).toHaveBeenCalledTimes(2); f.controller.dispose();
  });
  it("preserves the captured provider receiver and cancels same-method replacement instances", async () => {
    const f = fixture(); await f.controller.open(target);
    const definition = { id: "user", name: "担当者", type: "user", config: { valueMode: "legacy-text" } };
    const read = vi.fn(function(this: { label: string }) { return Promise.resolve({ scope, target, propertyId: "user", valueMode: "legacy-text" as const, choices: [{ id: "allowed", label: this.label, value: this.label }] }); });
    const first = { label: "first", read }, second = { label: "second", read };
    function Picker({ host = first }) { const binding = useNotesPropertyPickers({ controller: f.controller, scope, host }); return <><NotesDatabaseProperties databaseId="db" rowId="row" definitions={[definition]} values={{ user: "元の名前" }} controller={f.controller} adapters={binding.adapters} />{binding.picker}</>; }
    act(() => root.render(<Picker />)); click("選択する"); await flush(); expect(read.mock.contexts[0]).toBe(first); expect(document.body.querySelector('[role="dialog"]')!.textContent).toContain("first");
    act(() => root.render(<Picker host={second} />)); await flush(); expect(read).toHaveBeenCalledTimes(1); expect(document.body.querySelector('[role="dialog"]')).toBeNull(); expect(f.commit).not.toHaveBeenCalled(); f.controller.dispose();
  });
  it("refuses malformed assistance targets and database columns/values without exposing open actions", async () => {
    const f = fixture(); await f.controller.open(target);
    const run = vi.fn(async () => ({ ...answer, hits: [{ id: "bad", title: "Must not open", target: { kind: "row" as const, databaseId: "db", rowId: "" } }] }));
    act(() => root.render(<NotesAssistancePanel controller={f.controller} scope={scope} kind="search" service={{ run }} />)); input(container.querySelector("textarea")!, "question"); click("送信"); await flush(); expect(container.textContent).toContain("結果を読み込めませんでした"); expect(container.textContent).not.toContain("Must not open");
    const read = vi.fn(async () => ({ scope, databaseId: "db", revision: "r1", columns: [{ id: "", title: "Bad column" }], rows: [{ id: "bad", title: "Bad row", values: [] }] }) as unknown as Promise<NotesDatabaseNavigationPage>);
    act(() => root.render(<NotesDatabaseExplorer scope={scope} databases={[{ id: "db", title: "DB" }]} host={{ read }} onOpen={async () => true} />)); click("▦ DB"); await flush(); expect(container.textContent).toContain("行を読み込めませんでした"); expect(container.textContent).not.toContain("Bad row"); f.controller.dispose();
  });
});

describe("legacy presentation without implicit provider access", () => {
  it("keeps link layouts inert until explicit navigation or an authorized media preview", async () => {
    const { NotesLegacyLinkPresentation } = await import("../src/react/NotesLegacyPresentation.js");
    const resolveMediaURL = vi.fn(() => "data:image/png;base64,c3ludGhldGlj"), onOpenPage = vi.fn(async () => {});
    for (const style of ["text", "card", "article", "portrait"]) {
      act(() => root.render(<NotesLegacyLinkPresentation blockId="legacy" pageId="allowed" title="<b>Original title</b>" description="Original description" style={style} imageURL="https://example.invalid/old" imageAlt="Old image" options={{ resolveMediaURL, onOpenPage }} />));
      expect(container.querySelector("b,img")).toBeNull(); expect(container.querySelector('[data-presentation]')!.getAttribute("data-presentation")).toBe(style);
    }
    expect(resolveMediaURL).not.toHaveBeenCalled(); click("プレビューを表示"); expect(resolveMediaURL).toHaveBeenCalledWith({ blockId: "legacy", sourceURL: "https://example.invalid/old", kind: "image" }); expect(container.querySelector("img")!.alt).toBe("Old image"); click("プレビューを閉じる"); expect(container.querySelector("img")).toBeNull();
    click("<b>Original title</b>"); await flush(); expect(onOpenPage).toHaveBeenCalledWith("allowed");
    act(() => root.render(<NotesLegacyLinkPresentation blockId="unsafe" url="javascript:unsafe" title="Unsafe reference" description="" style="card" imageURL="" imageAlt="" options={{}} />)); expect(container.querySelector("a")).toBeNull();
  });
});
