/** @vitest-environment jsdom */
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditorDocument, type EditorAsset, type EditorBlock } from "@hello-ai-company/editor-core";
import { createNotesWorkspaceController } from "../src/notes/controller.js";
import type { NotesCommandRequest, NotesCommandResult, NotesDocumentSnapshot, NotesPageSummary, NotesWorkspaceHost, NotesWorkspaceSnapshot } from "../src/notes/contracts.js";
import { NotesInsertDialog, notesSafeInsertionLink, notesSupportedPickerInsertKinds, type NotesInsertDialogProps, type NotesInsertEditor, type NotesInsertionHost, type NotesPickerInsertKind } from "../src/react/NotesInsertDialog.js";

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const scope = { actorId: "synthetic", workspaceId: "test" };
const documentFor = (text: string) => createEditorDocument([{ id: "body", type: "paragraph", content: text }]);
const cleanups: (() => void)[] = [];
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { cleanups.splice(0).reverse().forEach(cleanup => cleanup()); vi.restoreAllMocks(); });
function fixture() {
  let serial = 1, workspaceSerial = 1, unknown = false, selection = "body:0";
  let source: NotesDocumentSnapshot = { scope, target: { kind: "page", pageId: "source" }, revision: "r1", contentRevision: "c1", document: documentFor("Original"), title: "Source", metadata: {}, capabilities: ["document.save", "page.create"], capabilitySemantics: { "document.save": "test-only", "page.create": "test-only" } };
  const pages: NotesPageSummary[] = [{ id: "source", title: "Source", parentId: null, position: 0 }, { id: "card", title: "Authorized card", parentId: null, position: 1 }];
  const readWorkspace = vi.fn(async (): Promise<NotesWorkspaceSnapshot> => ({ scope, revision: "w" + workspaceSerial, pages: copy(pages), nextCursor: null, hasMore: false, complete: true }));
  const readDocument = vi.fn(async (target: Parameters<NotesWorkspaceHost["readDocument"]>[0]): Promise<NotesDocumentSnapshot> => target.kind === "page" && target.pageId === "source" ? copy(source) : { ...copy(source), target, title: "Authorized card" });
  const commit = vi.fn(async (request: NotesCommandRequest): Promise<NotesCommandResult> => {
    if (unknown) return { status: "unknown", operationId: request.operationId, target: request.target };
    if (source.revision !== request.expectedRevision) return { status: "conflict", operationId: request.operationId, target: request.target };
    const command = request.command;
    if (command.kind === "document.save") source = { ...source, document: copy(command.document), title: command.title, revision: "r" + ++serial, contentRevision: "c" + serial };
    else if (command.kind === "page.create") {
      if (command.expectedWorkspaceRevision !== "w" + workspaceSerial) return { status: "conflict", operationId: request.operationId, target: request.target };
      const created = { id: "created", title: command.title, parentId: command.parentId, position: 0 }; pages.push(created); workspaceSerial++;
      source = { ...source, revision: "r" + ++serial };
      return { status: "committed", operationId: request.operationId, target: request.target, snapshot: copy(source), historyId: "h" + serial, persistence: "test-only", evidence: { kind: "page.create", workspaceRevision: "w" + workspaceSerial, page: created, createdDocument: createEditorDocument([]) } };
    } else return { status: "rejected", operationId: request.operationId, target: request.target };
    workspaceSerial++;
    return { status: "committed", operationId: request.operationId, target: request.target, snapshot: copy(source), historyId: "h" + serial, persistence: "test-only" };
  });
  const host: NotesWorkspaceHost = { scope: { ...scope }, readDocument, readWorkspace, beforeSubmit: vi.fn(async () => {}), commit, lookupOperation: vi.fn(async (target, operationId): Promise<NotesCommandResult> => ({ status: "not-found", target, operationId, terminal: true })) };
  let operation = 0;
  const controller = createNotesWorkspaceController(host, { operationId: () => "insert-op-" + ++operation, timeoutMs: 100 });
  const insertBlocks = vi.fn((blocks: readonly EditorBlock[], afterBlockId: string, signal: AbortSignal) => {
    if (signal.aborted) throw new Error("aborted"); const current = controller.getState().draft!;
    const index = current.blocks.findIndex(block => block.id === afterBlockId);
    controller.setDraft(createEditorDocument([...current.blocks.slice(0, index + 1), ...copy(blocks), ...current.blocks.slice(index + 1)]));
  });
  const insertLink = vi.fn((href: string, label: string, signal: AbortSignal) => {
    if (signal.aborted) throw new Error("aborted"); controller.setDraft(createEditorDocument([{ id: "body", type: "paragraph", content: [{ type: "link", href, content: [{ type: "text", text: label, styles: {} }] }] }]));
  });
  const editor: NotesInsertEditor = { installedBlockTypes: ["paragraph", "childPage", "pageCard", "file", "image", "video", "audio", "databaseView", "oeNotesSyncedBlock"], getSelectedBlockId: () => "body", getSelectionFingerprint: () => selection, getSelectedText: () => "Selected words", insertBlocks, insertLink };
  const insertion: NotesInsertionHost = { scope: { ...scope }, databaseViewsBound: true, sharedBlocksBound: true, listDatabases: vi.fn(async () => ({ databases: [{ id: "db", title: "Authorized DB", views: [{ id: "gallery-view", viewType: "gallery" }] }], nextCursor: null, hasMore: false })), getDatabase: vi.fn(async id => ({ id, title: "Authorized DB", views: [{ id: "gallery-view", viewType: "gallery" }] })), listShared: vi.fn(async () => ({ records: [{ id: "shared", title: "Authorized shared" }], nextCursor: null, hasMore: false })), getShared: vi.fn(async id => ({ id, title: "Authorized shared", revision: "shared-r1" })) };
  cleanups.push(() => controller.dispose());
  return { host, controller, editor, insertion, commit, readWorkspace, readDocument, insertBlocks, insertLink, setUnknown: () => { unknown = true; }, setSelection: (value: string) => { selection = value; }, source: () => source };
}
async function openFixture() { const f = fixture(); await f.controller.open({ kind: "page", pageId: "source" }); return f; }
function mount(props: NotesInsertDialogProps, strict = false) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container); act(() => root.render(strict ? createElement(StrictMode, null, createElement(NotesInsertDialog, props)) : createElement(NotesInsertDialog, props)));
  cleanups.push(() => { act(() => root.unmount()); container.remove(); });
  return { container, render: (next: NotesInsertDialogProps) => act(() => root.render(createElement(NotesInsertDialog, next))) };
}
function button(container: ParentNode, label: string): HTMLButtonElement {
  const result = [...container.querySelectorAll<HTMLButtonElement>("button")].find(candidate => candidate.textContent === label || candidate.getAttribute("aria-label") === label);
  if (!result) throw new Error("Missing " + label); return result;
}
function click(container: ParentNode, label: string): void { act(() => button(container, label).click()); }
function input(container: ParentNode, label: string, value: string): void {
  const field = container.querySelector<HTMLInputElement>('input[aria-label="' + label + '"]')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => { setter.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
}
function select(container: ParentNode, label: string, value: string): void {
  const field = container.querySelector<HTMLSelectElement>('select[aria-label="' + label + '"]')!;
  act(() => { field.value = value; field.dispatchEvent(new Event("change", { bubbles: true })); });
}
async function flush(): Promise<void> { await act(async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); }); }
function request(kind: NotesPickerInsertKind) { return { id: "request-" + kind, kind }; }

describe("NotesInsertDialog", () => {
  it("advertises all thirteen pickers only with exact schema, scoped callbacks and runtime bindings", async () => {
    const f = await openFixture();
    const media = { upload: vi.fn(async () => ({ attachmentId: "asset", url: "https://synthetic.invalid/file", name: "File", mimeType: "application/pdf", kind: "pdf" as const })), searchImages: vi.fn(async () => ({ results: [], hasMore: false })), acceptImage: vi.fn(async () => ({ attachmentId: "asset", url: "https://synthetic.invalid/image", name: "Image", mimeType: "image/png", kind: "image" as const })) };
    expect(notesSupportedPickerInsertKinds({ ...f, media })).toHaveLength(13);
    expect(notesSupportedPickerInsertKinds({ ...f, insertion: { ...f.insertion, sharedBlocksBound: false, databaseViewsBound: false }, media: undefined })).toEqual(["page", "link", "card"]);
    expect(notesSupportedPickerInsertKinds({ ...f, editor: { ...f.editor, installedBlockTypes: ["paragraph", "pageTransclusion"] } })).toEqual(["link"]);
    expect(notesSupportedPickerInsertKinds({ ...f, insertion: { ...f.insertion, scope: { actorId: "different", workspaceId: "test" } } })).toEqual(["page", "link", "card"]);
  });
  it("rejects executable, credential and malformed URLs while accepting explicit internal page identities", () => {
    for (const value of ["javascript:alert(1)", "data:text/html,hello", "https://user:secret@example.invalid", "//example.invalid", "https://example.invalid/a b", "openeditor://page/"]) expect(notesSafeInsertionLink(value)).toBe(false);
    for (const value of ["https://example.invalid", "mailto:hello@example.invalid", "tel:+123", "openeditor://page/page%2Fone"]) expect(notesSafeInsertionLink(value)).toBe(true);
  });
  it("preserves selected link text and publishes only a local draft without a host save", async () => {
    const f = await openFixture(), onClose = vi.fn();
    const { container } = mount({ ...f, request: request("link"), onClose });
    expect(container.querySelector<HTMLInputElement>('[aria-label="リンクの表示文字"]')?.value).toBe("Selected words");
    input(container, "リンク先URL", "https://example.invalid/page"); click(container, "確認して本文に挿入"); await flush();
    expect(f.insertLink).toHaveBeenCalledWith("https://example.invalid/page", "Selected words", expect.any(AbortSignal)); expect(f.controller.getState().dirty).toBe(true); expect(f.commit).not.toHaveBeenCalled(); expect(onClose).toHaveBeenCalledWith({ status: "inserted" });
  });
  it("does not bind a foreign database host to independent, authorized URL editing", async () => {
    const f = await openFixture(), foreign = { ...f.insertion, scope: { actorId: "different", workspaceId: "test" } }, { container } = mount({ ...f, insertion: foreign, request: request("link"), onClose: vi.fn() });
    input(container, "リンク先URL", "https://example.invalid/page"); click(container, "確認して本文に挿入"); await flush();
    expect(f.insertLink).toHaveBeenCalledTimes(1); expect(f.insertion.listDatabases).not.toHaveBeenCalled(); expect(f.insertion.getShared).not.toHaveBeenCalled();
  });
  it("reauthorizes a selected page card and never copies the referenced page document into the block", async () => {
    const f = await openFixture(), onClose = vi.fn(), { container } = mount({ ...f, request: request("card"), onClose }); await flush();
    select(container, "挿入する項目", "card"); click(container, "確認して本文に挿入"); await flush();
    expect(f.readDocument).toHaveBeenLastCalledWith({ kind: "page", pageId: "card" }, expect.any(AbortSignal));
    expect(f.controller.getState().draft!.blocks[1]).toMatchObject({ type: "pageCard", props: { pageId: "card", titleHint: "Authorized card" } }); expect(f.controller.getState().draft!.blocks[1]?.content).toBeUndefined(); expect(f.commit).not.toHaveBeenCalled();
  });
  it("restarts the initial authorized catalog read after StrictMode aborts the first effect cohort", async () => {
    const f = await openFixture(), { container } = mount({ ...f, request: request("card"), onClose: vi.fn() }, true); await flush();
    expect(f.readWorkspace).toHaveBeenCalledTimes(1);
    expect((f.readWorkspace.mock.calls as unknown as [AbortSignal][])[0]![0].aborted).toBe(false);
    const choices = [...container.querySelectorAll<HTMLOptionElement>('select[aria-label="挿入する項目"] option')].map(option => option.value);
    expect(choices).toContain("card"); select(container, "挿入する項目", "card"); click(container, "確認して本文に挿入"); await flush(); expect(f.insertBlocks).toHaveBeenCalledTimes(1);
  });
  it("does not accept a page from a different actor scope after selection", async () => {
    const f = await openFixture(), onClose = vi.fn(), { container } = mount({ ...f, request: request("card"), onClose }); await flush();
    f.readDocument.mockImplementationOnce(async target => ({ ...f.source(), scope: { actorId: "another", workspaceId: "test" }, target }));
    select(container, "挿入する項目", "card"); click(container, "確認して本文に挿入"); await flush(); expect(f.insertBlocks).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });
  it.each(["collection", "gallery", "kanban"] as const)("inserts %s only after a listed database is authorized and binds the real view type", async kind => {
    const f = await openFixture(), onClose = vi.fn(), { container } = mount({ ...f, request: request(kind), onClose }); await flush();
    select(container, "挿入する項目", "db"); click(container, "確認して本文に挿入"); await flush();
    const expected = kind === "gallery" ? "gallery" : kind === "kanban" ? "board" : "table";
    expect(f.insertion.getDatabase).toHaveBeenCalledWith("db", expect.any(AbortSignal)); expect(f.controller.getState().draft!.blocks[1]).toMatchObject({ type: "databaseView", props: { databaseId: "db", viewType: expected } });
    if (kind === "gallery") expect(f.controller.getState().draft!.blocks[1]?.props?.viewId).toBe("gallery-view");
    expect(f.commit).not.toHaveBeenCalled(); expect(onClose).toHaveBeenCalledWith({ status: "inserted" });
  });
  it("requires a real shared resolver and inserts a shared reference with no copied body or transclusion fallback", async () => {
    const f = await openFixture(), onClose = vi.fn(), { container } = mount({ ...f, request: request("syncedBlock"), onClose }); await flush();
    select(container, "挿入する項目", "shared"); click(container, "確認して本文に挿入"); await flush();
    expect(f.insertion.getShared).toHaveBeenCalledWith("shared", expect.any(AbortSignal)); expect(f.controller.getState().draft!.blocks[1]).toMatchObject({ type: "oeNotesSyncedBlock", props: { sharedId: "shared", body: "" } }); expect(f.commit).not.toHaveBeenCalled();
  });
  it("creates a child through a canonical receipt and then adds its reference as an unsaved local draft", async () => {
    const f = await openFixture(), onClose = vi.fn(), { container } = mount({ ...f, request: request("page"), onClose }); await flush();
    input(container, "子ページの名前", "New child"); click(container, "確認して子ページを作成"); await flush();
    expect(f.commit).toHaveBeenCalledTimes(1); expect(f.commit.mock.calls[0]![0].command).toEqual({ kind: "page.create", expectedWorkspaceRevision: "w1", parentId: "source", title: "New child" });
    expect(f.controller.getState().draft!.blocks[1]).toMatchObject({ type: "childPage", props: { pageId: "created", titleHint: "New child" } }); expect(f.controller.getState().dirty).toBe(true); expect(onClose).toHaveBeenCalledWith({ status: "inserted", createdPageId: "created" });
  });
  it("explicitly saves a dirty source, refreshes tree CAS, and never loses the original paragraph", async () => {
    const f = await openFixture(); f.controller.setDraft(documentFor("Human edit"));
    const { container } = mount({ ...f, request: request("page"), onClose: vi.fn() }); await flush();
    input(container, "子ページの名前", "New child"); click(container, "本文を保存して子ページを作成"); await flush();
    expect(f.commit).toHaveBeenCalledTimes(2); expect(f.commit.mock.calls[0]![0].command.kind).toBe("document.save"); expect(f.commit.mock.calls[1]![0].command).toMatchObject({ kind: "page.create", expectedWorkspaceRevision: "w2" });
    expect(f.controller.getState().draft!.blocks[0]?.content).toBe("Human edit"); expect(f.controller.getState().draft!.blocks[1]?.type).toBe("childPage");
  });
  it("does not insert a fabricated child after an unknown result and blocks repeat creation", async () => {
    const f = await openFixture(); f.setUnknown(); const onClose = vi.fn(), { container } = mount({ ...f, request: request("page"), onClose }); await flush();
    input(container, "子ページの名前", "New child"); click(container, "確認して子ページを作成"); click(container, "確認して子ページを作成"); await flush();
    expect(f.commit).toHaveBeenCalledTimes(1); expect(f.controller.getState().status).toBe("unknown"); expect(f.insertBlocks).not.toHaveBeenCalled(); expect(button(container, "確認して子ページを作成").disabled).toBe(true); expect(onClose).not.toHaveBeenCalled(); expect(container.textContent).toContain("保存結果が不明");
  });
  it.each(["attachment", "image", "video", "audio", "pdf"] as const)("scopes %s uploads to actor/workspace/page/block and confirms the resource before insertion", async kind => {
    const f = await openFixture(), mime = kind === "pdf" ? "application/pdf" : kind === "attachment" ? "application/octet-stream" : kind + "/test";
    const asset: EditorAsset = { attachmentId: "asset-id", url: "https://synthetic.invalid/asset", name: "Synthetic file", mimeType: mime, kind: kind === "attachment" ? "file" : kind };
    const upload = vi.fn(async () => asset), onClose = vi.fn(), { container } = mount({ ...f, media: { upload }, request: request(kind), onClose });
    const file = new File(["synthetic"], "Synthetic file", { type: mime }), field = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(field, "files", { configurable: true, value: [file] }); act(() => field.dispatchEvent(new Event("change", { bubbles: true }))); await flush();
    expect(upload).toHaveBeenCalledWith(file, { scope, target: { kind: "page", pageId: "source" }, blockId: "body" }, expect.any(AbortSignal)); expect(f.insertBlocks).not.toHaveBeenCalled();
    click(container, "確認して本文に挿入"); await flush(); expect(f.controller.getState().draft!.blocks[1]).toMatchObject({ type: kind === "attachment" || kind === "pdf" ? "file" : kind, props: { url: asset.url, name: asset.name, showPreview: true } }); expect(f.commit).not.toHaveBeenCalled(); expect(onClose).toHaveBeenCalledWith({ status: "inserted" });
  });
  it("performs image search and acceptance only on explicit clicks, with scoped identity and pagination", async () => {
    const f = await openFixture(), image = { id: "img", title: "Synthetic image", url: "https://synthetic.invalid/image" };
    const searchImages = vi.fn(async () => ({ results: [image], hasMore: true })), acceptImage = vi.fn(async () => ({ attachmentId: "image-asset", url: image.url, name: image.title, mimeType: "image/png", kind: "image" as const }));
    const { container } = mount({ ...f, media: { searchImages, acceptImage }, request: request("unsplash"), onClose: vi.fn() });
    expect(searchImages).not.toHaveBeenCalled(); input(container, "挿入素材の検索語", "flowers"); click(container, "素材を検索"); await flush(); expect(searchImages).toHaveBeenCalledWith({ scope, target: { kind: "page", pageId: "source" }, blockId: "body" }, "flowers", 1, expect.any(AbortSignal));
    click(container, "次の画像"); await flush(); expect(searchImages).toHaveBeenLastCalledWith(expect.any(Object), "flowers", 2, expect.any(AbortSignal)); click(container, "Synthetic image"); await flush(); expect(acceptImage).toHaveBeenCalledWith(image, { scope, target: { kind: "page", pageId: "source" }, blockId: "body" }, expect.any(AbortSignal)); expect(f.insertBlocks).not.toHaveBeenCalled(); click(container, "確認して本文に挿入"); await flush(); expect(f.controller.getState().draft!.blocks[1]?.type).toBe("image");
  });
  it("ignores late reads after cancellation and restores focus without a local or durable mutation", async () => {
    const f = await openFixture(); let resolve!: (value: Awaited<ReturnType<NonNullable<NotesInsertionHost["listDatabases"]>>>) => void;
    let signal!: AbortSignal; f.insertion.listDatabases = vi.fn(async nextSignal => { signal = nextSignal; return new Promise<Awaited<ReturnType<NonNullable<NotesInsertionHost["listDatabases"]>>>>(done => { resolve = done; }); });
    const opener = document.createElement("button"); document.body.append(opener); opener.focus(); cleanups.push(() => opener.remove());
    const onClose = vi.fn(), view = mount({ ...f, request: request("collection"), onClose }), { container } = view; await flush(); click(container, "キャンセル");
    view.render({ ...f, request: null, onClose }); expect(document.activeElement).toBe(opener);
    expect(signal.aborted).toBe(true); expect(onClose).toHaveBeenCalledWith({ status: "cancelled" });
    await act(async () => resolve({ databases: [{ id: "late", title: "Late" }], nextCursor: null, hasMore: false })); await flush(); expect(container.textContent).not.toContain("Late"); expect(f.insertBlocks).not.toHaveBeenCalled(); expect(f.commit).not.toHaveBeenCalled();
  });
  it("rejects body ABA before applying a picker result", async () => {
    const f = await openFixture(), { container } = mount({ ...f, request: request("card"), onClose: vi.fn() }); await flush(); select(container, "挿入する項目", "card");
    act(() => { f.controller.setDraft(documentFor("Temporary")); f.controller.setDraft(documentFor("Original")); });
    expect(button(container, "確認して本文に挿入").disabled).toBe(true); click(container, "確認して本文に挿入"); await flush(); expect(f.insertBlocks).not.toHaveBeenCalled();
  });
  it("rejects a delayed database response after the selection moves away and back", async () => {
    const f = await openFixture(); let resolve!: (value: Awaited<ReturnType<NonNullable<NotesInsertionHost["getDatabase"]>>>) => void;
    f.insertion.getDatabase = vi.fn(async () => new Promise<Awaited<ReturnType<NonNullable<NotesInsertionHost["getDatabase"]>>>>(done => { resolve = done; }));
    const { container } = mount({ ...f, request: request("collection"), onClose: vi.fn() }); await flush(); select(container, "挿入する項目", "db"); click(container, "確認して本文に挿入"); await flush();
    f.setSelection("other:1"); f.setSelection("body:2");
    await act(async () => resolve({ id: "db", title: "Authorized DB" })); await flush();
    expect(f.insertBlocks).not.toHaveBeenCalled(); expect(container.textContent).toContain("選択範囲");
  });
  it("holds external local drafts and never applies a candidate read before those inputs changed", async () => {
    const f = await openFixture(), onClose = vi.fn(), { container } = mount({ ...f, request: request("card"), onClose }); await flush(); select(container, "挿入する項目", "card");
    act(() => f.controller.setLocalDraft("metadata.classification", { category: "Uncommitted human input" }));
    expect(button(container, "確認して本文に挿入").disabled).toBe(true); click(container, "キャンセル"); expect(f.controller.getState().localDrafts["metadata.classification"]).toEqual({ category: "Uncommitted human input" }); expect(f.insertBlocks).not.toHaveBeenCalled(); expect(f.commit).not.toHaveBeenCalled();
  });
  it("rejects an upload without a stable id or with URL credentials before local insertion", async () => {
    const f = await openFixture(), upload = vi.fn(async () => ({ url: "https://user:password@synthetic.invalid/asset", name: "Unsafe asset", mimeType: "image/png", kind: "image" as const })), { container } = mount({ ...f, media: { upload }, request: request("image"), onClose: vi.fn() });
    const field = container.querySelector<HTMLInputElement>('input[type="file"]')!; Object.defineProperty(field, "files", { configurable: true, value: [new File(["synthetic"], "Asset", { type: "image/png" })] }); act(() => field.dispatchEvent(new Event("change", { bubbles: true }))); await flush();
    expect(container.textContent).toContain("安全な保存先"); expect(button(container, "確認して本文に挿入").disabled).toBe(true); expect(f.insertBlocks).not.toHaveBeenCalled(); expect(f.commit).not.toHaveBeenCalled();
  });
  it("closes an in-flight child creation with a retained unknown receipt, and ignores a later ACK", async () => {
    const f = await openFixture(); let resolve!: (value: NotesCommandResult) => void;
    f.commit.mockImplementation(async () => new Promise<NotesCommandResult>(done => { resolve = done; }));
    const onClose = vi.fn(), { container } = mount({ ...f, request: request("page"), onClose }); await flush(); input(container, "子ページの名前", "Delayed child"); click(container, "確認して子ページを作成"); await flush();
    expect(f.commit).toHaveBeenCalledTimes(1); click(container, "キャンセル"); await flush(); expect(f.controller.getState().status).toBe("unknown"); expect(f.controller.getRecovery()).toBeTruthy();
    const sent = f.commit.mock.calls[0]![0]; await act(async () => resolve({ status: "committed", operationId: sent.operationId, target: sent.target, snapshot: { ...f.source(), revision: "r2" }, historyId: "h2", persistence: "test-only", evidence: { kind: "page.create", workspaceRevision: "w2", page: { id: "late-created", title: "Delayed child", parentId: "source", position: 0 }, createdDocument: createEditorDocument([]) } })); await flush();
    expect(f.insertBlocks).not.toHaveBeenCalled(); expect(f.controller.getState().status).toBe("unknown"); expect(onClose).toHaveBeenCalledExactlyOnceWith({ status: "cancelled" });
  });
  it("keeps IME Escape, traps Tab and cancels a request signal without inserting", async () => {
    const f = await openFixture(), onClose = vi.fn(), abort = new AbortController(), { container } = mount({ ...f, request: { ...request("link"), signal: abort.signal }, onClose });
    const field = container.querySelector<HTMLInputElement>('[aria-label="リンク先URL"]')!;
    act(() => field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", isComposing: true, bubbles: true, cancelable: true }))); expect(onClose).not.toHaveBeenCalled();
    const cancel = button(container, "キャンセル"); cancel.focus(); act(() => cancel.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }))); expect(document.activeElement).toBe(container.querySelector("button"));
    act(() => abort.abort()); await flush(); expect(onClose).toHaveBeenCalledWith({ status: "cancelled" }); expect(f.insertLink).not.toHaveBeenCalled(); expect(f.commit).not.toHaveBeenCalled();
  });
});
