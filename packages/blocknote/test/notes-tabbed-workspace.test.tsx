// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { StrictMode, act } from "react";
import { createRoot } from "react-dom/client";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import type { NotesCommandResult, NotesDocumentSnapshot, NotesTarget, NotesWorkspaceHost } from "../src/notes/contracts.js";
import { closeNotesTab, notesLayoutStorageKey, notesTargetKey, openNotesTab, splitNotesTab, type NotesLayoutStorage } from "../src/notes/layoutState.js";
import { createNotesTabbedWorkspaceSession, NotesTabbedWorkspace } from "../src/react/NotesTabbedWorkspace.js";
import { createNotesCanvasController } from "../src/react/NotesWorkspaceModes.js";

// Keep renderer tests separate: here we exercise the actual public ownership/orchestration shell.
vi.mock("../src/react/NotesWorkspace.js", async () => {
  const React = await import("react");
  return { NotesWorkspace: (props: import("../src/react/NotesWorkspace.js").NotesWorkspaceProps) => {
    const state = React.useSyncExternalStore(props.preset.controller.subscribe, props.preset.controller.getState, props.preset.controller.getState);
    return <div data-target={state.snapshot?.target.kind === "page" ? state.snapshot.target.pageId : "empty"}><p>{state.snapshot?.title ?? "Catalog"}</p><button type="button" onClick={() => void props.onNavigate?.({ kind: "page", pageId: "a" })}>Open a</button><button type="button" onClick={() => void props.onNavigate?.({ kind: "page", pageId: "b" })}>Open b</button></div>;
  } };
});
const scope = { actorId: "synthetic", workspaceId: "test" };
const page = (pageId: string): NotesTarget => ({ kind: "page", pageId });
const doc = (text: string) => createEditorDocument([{ id: "body", type: "paragraph", content: text }]);
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(res => { resolve = res; }); return { resolve, promise }; };
function fixture() {
  const snapshots = new Map<string, NotesDocumentSnapshot>(), receipts = new Map<string, NotesCommandResult>(); let serial = 1;
  for (const target of [page("a"), page("b"), { kind: "row", databaseId: "db1", rowId: "r" }, { kind: "row", databaseId: "db2", rowId: "r" }] as NotesTarget[]) snapshots.set(notesTargetKey(target), { scope, target, revision: "r1", contentRevision: "c1", document: doc(notesTargetKey(target)), title: notesTargetKey(target), metadata: { future: "keep" }, capabilities: ["document.save"], capabilitySemantics: { "document.save": "test-only" } });
  const commit = vi.fn<NotesWorkspaceHost["commit"]>(async request => {
    const before = snapshots.get(notesTargetKey(request.target))!;
    if (request.expectedRevision !== before.revision) return { status: "conflict", target: request.target, operationId: request.operationId };
    const snapshot = { ...copy(before), revision: `r${++serial}`, contentRevision: `c${serial}` };
    if (request.command.kind === "document.save") { snapshot.document = copy(request.command.document); snapshot.title = request.command.title; }
    snapshots.set(notesTargetKey(request.target), snapshot);
    const receipt: NotesCommandResult = { status: "committed", operationId: request.operationId, target: request.target, snapshot, historyId: `h${serial}`, persistence: "test-only" }; receipts.set(request.operationId, receipt); return receipt;
  });
  const host: NotesWorkspaceHost = { scope, readDocument: async target => copy(snapshots.get(notesTargetKey(target))!), beforeSubmit: async () => {}, commit, lookupOperation: async (target, operationId) => copy(receipts.get(operationId) ?? { status: "not-found", target, operationId, terminal: true }) };
  const values = new Map<string, string>(), writes = vi.fn<NotesLayoutStorage["write"]>(async (key, value, expected) => { if ((values.get(key) ?? null) !== expected) throw new Error("CAS conflict"); values.set(key, value); });
  const storage: NotesLayoutStorage = { read: async key => values.get(key) ?? null, write: writes };
  return { host, commit, snapshots, receipts, values, storage, writes };
}

describe("reusable Notes tab/pane owner", () => {
  it("keeps invalid-layout recovery visible without a document owner, including the default presentation", async () => {
    const f = fixture(), raw = '{"invalid":"keep original"}', key = notesLayoutStorageKey(scope);
    f.values.set(key, raw);
    const container = document.createElement("div"), root = createRoot(container); document.body.append(container);
    const flag = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }; flag.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => root.render(<NotesTabbedWorkspace host={f.host} layoutStorage={f.storage} />));
      expect(container.querySelector('.oe-notes-layout-feedback[role="alert"]')).not.toBeNull();
      expect(document.querySelector('.oe-notes-floating-surface')).toBeNull();
      const repair = container.querySelector<HTMLButtonElement>('.oe-notes-layout-feedback button')!;
      expect(repair.textContent).toBe("元の表示データを保持して修復"); expect(f.values.get(key)).toBe(raw); expect(f.commit).not.toHaveBeenCalled();
      await act(async () => repair.click()); expect(JSON.parse(f.values.get(key)!).legacyOriginal).toBe(raw); expect(container.querySelector('.oe-notes-layout-feedback')).toBeNull();
    } finally { await act(async () => root.unmount()); container.remove(); flag.IS_REACT_ACT_ENVIRONMENT = false; }
  });
  it("reselects the active resource without saving, persisting, or clearing dirty IME input", async () => {
    const f = fixture(), session = createNotesTabbedWorkspaceSession({ host: f.host, initialTarget: page("a"), layoutStorage: f.storage });
    await session.initialize(); const writer = session.getPreset(page("a")).controller;
    writer.setDraft(doc("human input")); writer.setComposing(true);
    const layout = session.getState().layout, input = writer.getState(), writes = f.writes.mock.calls.length;
    for (let i = 0; i < 6; i++) expect(await session.open(page("a"))).toBe(true);
    expect(session.getState().layout).toBe(layout); expect(writer.getState()).toBe(input);
    expect(f.writes).toHaveBeenCalledTimes(writes); expect(f.commit).not.toHaveBeenCalled();
    expect(await session.open(page("b"))).toBe(false);
    expect(writer.getState()).toMatchObject({ dirty: true, composing: true }); session.dispose();
  });
  it("allows a host to decline Canvas for rows while retaining page Canvas and one factory decision per target", async () => {
    const f = fixture(), row: NotesTarget = { kind: "row", databaseId: "db1", rowId: "r" };
    const createCanvasController = vi.fn(({ target }: { target: NotesTarget }) => target.kind === "row" ? undefined : createNotesCanvasController({ scope, target, documentRevision: "c1", validate: () => [] }));
    const session = createNotesTabbedWorkspaceSession({ host: f.host, initialTarget: row, createCanvasController }); await session.initialize();
    expect(session.getCanvasController(row)).toBeUndefined(); expect(session.getCanvasController(row)).toBeUndefined(); expect(createCanvasController).toHaveBeenCalledTimes(1);
    expect(await session.open(page("a"))).toBe(true); const pageCanvas = session.getCanvasController(page("a")); expect(pageCanvas).toBeDefined(); expect(session.getCanvasController(page("a"))).toBe(pageCanvas); expect(createCanvasController).toHaveBeenCalledTimes(2);
    const dispose = vi.spyOn(pageCanvas!, "dispose"); session.dispose(); expect(dispose).toHaveBeenCalledTimes(1);
  });
  it("keeps row raw input guarded even when Canvas is explicitly unavailable", async () => {
    const f = fixture(), row: NotesTarget = { kind: "row", databaseId: "db1", rowId: "r" }, createCanvasController = vi.fn(() => undefined);
    const session = createNotesTabbedWorkspaceSession({ host: f.host, initialTarget: row, createCanvasController }); await session.initialize();
    session.getPreset(row).controller.setLocalDraft("pending-row-field", "Keep"); expect(await session.open(page("a"))).toBe(false); expect(session.getState().layout.tabs).toHaveLength(1); expect(f.commit).not.toHaveBeenCalled(); session.dispose();
  });
  it("keeps one fixed controller per scoped target and saves draft before opening another tab", async () => {
    const f = fixture(), session = createNotesTabbedWorkspaceSession({ host: f.host, initialTarget: page("a") }); await session.initialize();
    const a = session.getPreset(page("a")), b = session.getPreset(page("b")); expect(a).not.toBe(b); expect(session.getPreset(page("a"))).toBe(a);
    a.controller.setDraft(doc("Human draft")); expect(await session.open(page("b"))).toBe(true);
    expect(a.controller.getState().snapshot!.target).toEqual(page("a")); expect(b.controller.getState().snapshot!.target).toEqual(page("b"));
    expect(f.snapshots.get(notesTargetKey(page("a")))!.document).toEqual(doc("Human draft")); expect(session.getState().layout.tabs).toHaveLength(2);
    expect(session.getPreset({ kind: "row", databaseId: "db1", rowId: "r" })).not.toBe(session.getPreset({ kind: "row", databaseId: "db2", rowId: "r" }));
    expect(session.getState().persistence).toBe("memory-only"); session.dispose();
  });
  it("activates an inactive mutation target before lost ACK and exposes only its recovery", async () => {
    const f = fixture(), session = createNotesTabbedWorkspaceSession({ host: f.host, initialTarget: page("a") }); await session.initialize();
    const a = session.getPreset(page("a")), b = session.getPreset(page("b")); a.controller.setDraft(doc("A human draft"));
    const original = f.commit.getMockImplementation()!;
    f.commit.mockImplementation(async (...args) => { const receipt = await original(...args); if (notesTargetKey(args[0].target) === notesTargetKey(page("b"))) throw new Error("B ACK lost"); return receipt; });
    const result = await session.execute(page("b"), { kind: "document.save", document: doc("B explicit payload"), title: "B changed" });
    expect(result.status).toBe("unknown"); expect(f.commit.mock.calls.map(call => call[0].target)).toEqual([page("a"), page("b")]);
    expect(a.controller.getState().snapshot!.document).toEqual(doc("A human draft")); expect(a.controller.getRecovery()).toBeUndefined();
    expect(b.controller.getRecovery()!.request.target).toEqual(page("b"));
    expect(session.getState().layout.activeTabId).toBe(notesTargetKey(page("b"))); expect(session.getState().layout.tabs).toHaveLength(2);
    await b.controller.reconcile(); expect(b.controller.getState().snapshot!.document).toEqual(doc("B explicit payload")); expect(b.controller.getRecovery()).toBeUndefined(); expect(f.commit).toHaveBeenCalledTimes(2); session.dispose();
  });
  it("returns typed cancellation before a target mutation when active IME blocks navigation", async () => {
    const f = fixture(), session = createNotesTabbedWorkspaceSession({ host: f.host, initialTarget: page("a") }); await session.initialize();
    session.getPreset(page("a")).controller.setComposing(true);
    const result = await session.execute(page("b"), { kind: "document.save", document: doc("B untouched"), title: "B" });
    expect(result.status).toBe("cancelled"); expect(f.commit).not.toHaveBeenCalled(); expect(session.getState().layout.activeTabId).toBe(notesTargetKey(page("a"))); expect(session.getPreset(page("b")).controller.getRecovery()).toBeUndefined(); session.dispose();
  });
  it.each(["open", "prepare", "layout"] as const)("fences source IME ABA during delayed target read in %s", async method => {
    const f = fixture(), session = createNotesTabbedWorkspaceSession({ host: f.host, initialTarget: page("a") }); await session.initialize();
    const controller = session.getPreset(page("a")).controller, gate = deferred<NotesDocumentSnapshot>(), read = vi.spyOn(f.host, "readDocument"); read.mockImplementationOnce(() => gate.promise);
    const pending = method === "open" ? session.open(page("b")) : method === "prepare" ? session.prepareNavigation(page("b"), "activate", new AbortController().signal) : session.setLayout(openNotesTab(session.getState().layout, { id: notesTargetKey(page("b")), target: page("b"), title: "B", pinned: false }));
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1)); controller.setComposing(true); controller.setComposing(false);
    gate.resolve(copy(f.snapshots.get(notesTargetKey(page("b")))!)); expect(await pending).toBe(false); expect(session.getState().layout.activeTabId).toBe(notesTargetKey(page("a"))); expect(controller.getState().composing).toBe(false); session.dispose();
  });
  it("fences source draft ABA during delayed target read without overwriting or closing it", async () => {
    const f = fixture(), session = createNotesTabbedWorkspaceSession({ host: f.host, initialTarget: page("a") }); await session.initialize();
    const controller = session.getPreset(page("a")).controller, original = controller.getState().draft!, gate = deferred<NotesDocumentSnapshot>(), read = vi.spyOn(f.host, "readDocument"); read.mockImplementationOnce(() => gate.promise);
    const pending = session.open(page("b")); await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1)); controller.setDraft(doc("Human resumed")); controller.setDraft(original);
    gate.resolve(copy(f.snapshots.get(notesTargetKey(page("b")))!)); expect(await pending).toBe(false); expect(session.getState().layout.activeTabId).toBe(notesTargetKey(page("a"))); expect(f.commit).not.toHaveBeenCalled(); session.dispose();
  });
  it("restores only its exact persisted layout with CAS when input resumes during storage write", async () => {
    const f = fixture(), session = createNotesTabbedWorkspaceSession({ host: f.host, layoutStorage: f.storage, initialTarget: page("a") }); await session.initialize();
    const before = session.getState().layout, gate = deferred<void>(), write = f.writes.getMockImplementation()!;
    f.writes.mockImplementationOnce(async (...args) => { await gate.promise; return write(...args); });
    const pending = session.open(page("b")); await vi.waitFor(() => expect(f.writes).toHaveBeenCalledTimes(2));
    const controller = session.getPreset(page("a")).controller; controller.setDraft(doc("Late human input")); gate.resolve(); expect(await pending).toBe(false);
    expect(session.getState().layout).toBe(before); expect(controller.getState().draft).toEqual(doc("Late human input")); expect(controller.getState().dirty).toBe(true);
    expect(JSON.parse(f.values.get(notesLayoutStorageKey(scope))!).layout).toEqual(before); expect(f.writes).toHaveBeenCalledTimes(3); expect(f.writes.mock.calls[2]![2]).toBe(f.writes.mock.calls[1]![1]); session.dispose();
  });
  it("blocks close/navigation during IME and unknown commit, then reconciles without resend", async () => {
    const f = fixture(), session = createNotesTabbedWorkspaceSession({ host: f.host, initialTarget: page("a") }); await session.initialize(); const controller = session.getPreset(page("a")).controller;
    controller.setComposing(true); expect(await session.open(page("b"))).toBe(false); controller.setComposing(false);
    controller.setDraft(doc("Retained")); const original = f.commit.getMockImplementation()!; f.commit.mockImplementationOnce(async (...args) => { await original(...args); throw new Error("lost ACK"); });
    expect(await session.beforeClose(page("a"), new AbortController().signal)).toBe(false); expect(controller.getState().status).toBe("unknown");
    const closed = closeNotesTab(session.getState().layout, notesTargetKey(page("a"))); expect(await session.setLayout(closed)).toBe(false); expect(session.getState().layout.tabs).toHaveLength(1);
    await controller.reconcile(); expect(await session.setLayout(closed)).toBe(true); expect(f.commit).toHaveBeenCalledTimes(1); session.dispose();
  });
  it("keeps local comment/property input on its target and requires explicit save or cancel before leaving", async () => {
    const f = fixture(), session = createNotesTabbedWorkspaceSession({ host: f.host, initialTarget: page("a") }); await session.initialize();
    const controller = session.getPreset(page("a")).controller;
    controller.setLocalDraft("comment:new", { text: "Unsaved human comment", blockId: "body" });
    expect(await session.open(page("b"))).toBe(false); expect(await session.beforeClose(page("a"), new AbortController().signal)).toBe(false);
    expect(controller.getState().localDrafts["comment:new"]).toEqual({ text: "Unsaved human comment", blockId: "body" }); expect(f.commit).not.toHaveBeenCalled();
    controller.setLocalDraft("comment:new", undefined); expect(await session.open(page("b"))).toBe(true); session.dispose();
  });
  it("fails closed for unbound nested readiness and waits for bound nested writers", async () => {
    const f = fixture(), nested = createEditorDocument([{ id: "db", type: "databaseView", props: { databaseId: "db1" } }]);
    f.snapshots.get(notesTargetKey(page("a")))!.document = nested;
    const unbound = createNotesTabbedWorkspaceSession({ host: f.host, initialTarget: page("a") }); await unbound.initialize(); expect(await unbound.open(page("b"))).toBe(false); unbound.dispose();
    const readiness = vi.fn(async () => false), bound = createNotesTabbedWorkspaceSession({ host: f.host, initialTarget: page("a"), beforeResourceLeave: readiness }); await bound.initialize();
    expect(await bound.open(page("b"))).toBe(false); readiness.mockResolvedValueOnce(true); expect(await bound.open(page("b"))).toBe(true); expect(readiness).toHaveBeenCalledTimes(2); bound.dispose();
  });
  it("restores tabs/splits after reload and refuses to overwrite a concurrent persisted layout", async () => {
    const f = fixture(), first = createNotesTabbedWorkspaceSession({ host: f.host, layoutStorage: f.storage, initialTarget: page("a") }); await first.initialize(); await first.open(page("b"));
    expect(await first.setLayout(splitNotesTab(first.getState().layout, notesTargetKey(page("a")), "left"))).toBe(true);
    const expected = first.getState().layout; first.dispose();
    const second = createNotesTabbedWorkspaceSession({ host: f.host, layoutStorage: f.storage }); await second.initialize(); expect(second.getState().layout).toEqual(expected);
    const external = JSON.stringify({ layout: { ...expected, previewTabId: notesTargetKey(page("a")) } }); f.values.set(notesLayoutStorageKey(scope), external);
    expect(await second.setLayout({ ...expected, previewTabId: notesTargetKey(page("b")) })).toBe(false); expect(f.values.get(notesLayoutStorageKey(scope))).toBe(external); expect(second.getState().layout).toEqual(expected); second.dispose();
  });
  it("retains invalid layout byte-for-byte until explicit original-preserving repair", async () => {
    const f = fixture(), raw = '{ "version": 999, "unknown": "preserve" }'; f.values.set(notesLayoutStorageKey(scope), raw);
    const session = createNotesTabbedWorkspaceSession({ host: f.host, layoutStorage: f.storage }); await session.initialize(); expect(session.getState().status).toBe("invalid"); expect(f.writes).not.toHaveBeenCalled();
    expect(await session.open(page("a"))).toBe(false); expect(f.values.get(notesLayoutStorageKey(scope))).toBe(raw);
    expect(await session.repairLayout()).toBe(true); expect(JSON.parse(f.values.get(notesLayoutStorageKey(scope))!).legacyOriginal).toBe(raw); session.dispose();
  });
  it("does not import one actor/workspace layout into another", async () => {
    const f = fixture(), session = createNotesTabbedWorkspaceSession({ host: f.host, layoutStorage: f.storage, initialTarget: page("a") }); await session.initialize(); session.dispose();
    const otherScope = { actorId: "other", workspaceId: "other" }, original = f.values.get(notesLayoutStorageKey(scope))!;
    const other = createNotesTabbedWorkspaceSession({ host: { ...f.host, scope: otherScope }, layoutStorage: f.storage }); await other.initialize(); expect(other.getState().layout.tabs).toHaveLength(0); expect(f.values.get(notesLayoutStorageKey(scope))).toBe(original); other.dispose();
  });
  it("mounts through public slots under StrictMode and intercepts sidebar opens into tabs", async () => {
    const f = fixture(), container = document.createElement("div"), root = createRoot(container); document.body.append(container);
    const flag = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }; flag.IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () => root.render(<StrictMode><NotesTabbedWorkspace host={f.host} /></StrictMode>));
    const open = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent === label)!;
    await act(async () => open("Open a").click()); await vi.waitFor(() => expect(container.querySelector('[data-target="a"]')).not.toBeNull());
    await act(async () => open("Open b").click()); await vi.waitFor(() => expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2));
    expect(container.querySelector('[data-target="b"]')).not.toBeNull(); expect(container.dataset.layoutPersistence).toBeUndefined(); expect(container.querySelector('[data-layout-persistence="memory-only"]')).not.toBeNull();
    await act(async () => root.unmount()); container.remove(); flag.IS_REACT_ACT_ENVIRONMENT = false;
  });
});
