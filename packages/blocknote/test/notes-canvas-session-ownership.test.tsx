// @vitest-environment jsdom
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import type { NotesCommandResult, NotesDocumentSnapshot, NotesTarget, NotesWorkspaceHost } from "../src/notes/contracts.js";
import { createNotesLayout, notesTargetKey, openNotesTab, splitNotesTab, type NotesLayoutStorage } from "../src/notes/layoutState.js";
import { createNotesTabbedWorkspaceSession } from "../src/react/NotesTabbedWorkspace.js";
import { createNotesCanvasController, NotesWorkspaceModes, type NotesCanvasController, type NotesCanvasDraft, type NotesCanvasHost, type NotesCanvasResult, type NotesCanvasSnapshot, type NotesWorkspaceModesProps } from "../src/react/NotesWorkspaceModes.js";

const scope = { actorId: "independent-fixture", workspaceId: "synthetic-only" };
const page = (pageId: string): NotesTarget => ({ kind: "page", pageId });
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const doc = (text: string) => createEditorDocument([{ id: "body", type: "paragraph", content: text }]);
const draft = (label = "original"): NotesCanvasDraft => ({ layout: { blockId: "body", label }, view: {}, theme: "modern" });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { resolve, promise }; };

function fixture(split = false) {
  const documents = new Map<string, NotesDocumentSnapshot>(), canvases = new Map<string, NotesCanvasSnapshot>(), controllers = new Map<string, NotesCanvasController>();
  const documentReceipts = new Map<string, NotesCommandResult>(), canvasReceipts = new Map<string, NotesCanvasResult>(); let serial = 1;
  for (const name of ["a", "b", "c"]) {
    const target = page(name), key = notesTargetKey(target);
    documents.set(key, { scope, target, revision: "r1", contentRevision: "d1", document: doc(name), title: name, metadata: { opaque: true }, capabilities: ["document.save"], capabilitySemantics: { "document.save": "test-only" } });
    canvases.set(key, { scope, target, revision: "c1", documentRevision: "d1", ...draft(), capabilities: ["canvas.save", "canvas.repair"] });
  }
  const documentCommit = vi.fn<NotesWorkspaceHost["commit"]>(async request => {
    const key = notesTargetKey(request.target), prior = documents.get(key)!;
    if (request.expectedRevision !== prior.revision || request.expectedContentRevision !== prior.contentRevision) return { status: "conflict", target: request.target, operationId: request.operationId };
    if (request.command.kind !== "document.save") throw new Error("Unsupported synthetic command");
    const next = { ...copy(prior), revision: `r${++serial}`, contentRevision: `d${serial}`, document: copy(request.command.document), title: request.command.title };
    documents.set(key, next);
    const receipt: NotesCommandResult = { status: "committed", target: request.target, operationId: request.operationId, snapshot: next, historyId: `h${serial}`, persistence: "test-only" };
    documentReceipts.set(request.operationId, receipt); return receipt;
  });
  const host: NotesWorkspaceHost = { scope, readDocument: async target => copy(documents.get(notesTargetKey(target))!), commit: documentCommit, beforeSubmit: async () => {}, lookupOperation: async (target, operationId) => documentReceipts.get(operationId) ?? { target, operationId, status: "not-found", terminal: true } };
  const canvasRead = vi.fn<NotesCanvasHost["read"]>(async (_scope, target) => ({ ...copy(canvases.get(notesTargetKey(target))!), documentRevision: documents.get(notesTargetKey(target))!.contentRevision }));
  const canvasCommit = vi.fn<NotesCanvasHost["commit"]>(async request => {
    const key = notesTargetKey(request.target), prior = canvases.get(key)!;
    if (prior.revision !== request.expectedRevision || documents.get(key)!.contentRevision !== request.expectedDocumentRevision) return { scope, target: request.target, operationId: request.operationId, status: "conflict" };
    const next = { ...copy(prior), ...copy(request.draft), revision: `c${++serial}`, documentRevision: request.expectedDocumentRevision }; canvases.set(key, next);
    const receipt: NotesCanvasResult = { scope, target: request.target, operationId: request.operationId, status: "committed", snapshot: next }; canvasReceipts.set(request.operationId, receipt); return receipt;
  });
  const lookup = vi.fn<NotesCanvasHost["lookup"]>(async (_scope, target, operationId) => canvasReceipts.get(operationId) ?? { scope, target, operationId, status: "not-found", terminal: true });
  const canvasHost: NotesCanvasHost = { read: canvasRead, commit: canvasCommit, lookup, beforeSubmit: async () => {} };
  const values = new Map<string, string>();
  const write = vi.fn<NotesLayoutStorage["write"]>(async (key, value, expected) => { if ((values.get(key) ?? null) !== expected) throw new Error("Synthetic CAS conflict"); values.set(key, value); });
  const storage: NotesLayoutStorage = { read: async key => values.get(key) ?? null, write };
  let initialLayout = openNotesTab(createNotesLayout(scope), { id: notesTargetKey(page("a")), target: page("a"), title: "a", pinned: false });
  if (split) initialLayout = splitNotesTab(openNotesTab(initialLayout, { id: notesTargetKey(page("b")), target: page("b"), title: "b", pinned: false }), notesTargetKey(page("a")), "left");
  const factory = ({ target }: { target: NotesTarget }) => {
    const key = notesTargetKey(target), controller = createNotesCanvasController({ scope, target, documentRevision: documents.get(key)!.contentRevision, snapshot: canvases.get(key)!, host: canvasHost, validate: () => [] }); controllers.set(key, controller); return controller;
  };
  const session = createNotesTabbedWorkspaceSession({ host, initialLayout, layoutStorage: storage, createCanvasController: factory });
  return { session, host, factory, documents, canvases, canvasRead, canvasCommit, documentCommit, lookup, write, storage, controllers };
}

describe("independent Canvas session ownership regressions", () => {
  it("rebases the retained Canvas draft after this writer saves its changed document", async () => {
    const f = fixture(); await f.session.initialize(); const canvas = f.session.getCanvasController(page("a"))!;
    f.session.getPreset(page("a")).controller.setDraft(doc("saved body")); canvas.edit(draft("human layout"));
    expect(await f.session.open(page("b"))).toBe(true);
    expect(f.documentCommit).toHaveBeenCalledTimes(1); expect(f.canvasCommit).toHaveBeenCalledTimes(1);
    expect(f.canvasCommit.mock.calls[0]![0].expectedDocumentRevision).toBe(f.documents.get(notesTargetKey(page("a")))!.contentRevision);
    expect(canvas.getState()).toMatchObject({ dirty: false, draft: draft("human layout") }); f.session.dispose();
  });
  it("retains the Canvas draft when a concurrent layout changes during document rebase", async () => {
    const f = fixture(); await f.session.initialize(); const canvas = f.session.getCanvasController(page("a"))!;
    f.session.getPreset(page("a")).controller.setDraft(doc("saved body")); canvas.edit(draft("human layout"));
    f.canvases.set(notesTargetKey(page("a")), { ...f.canvases.get(notesTargetKey(page("a")))!, revision: "remote-c2", ...draft("remote layout") });
    const before = f.session.getState().layout; expect(await f.session.open(page("b"))).toBe(false);
    expect(f.session.getState().layout).toBe(before); expect(canvas.getState()).toMatchObject({ status: "conflict", dirty: true, draft: draft("human layout") }); expect(f.canvasCommit).not.toHaveBeenCalled(); f.session.dispose();
  });
  it.each(["document input", "IME ABA", "Canvas ABA"])("fences earlier split pane %s during the later pane save", async kind => {
    const f = fixture(true); await f.session.initialize(); const a = f.session.getPreset(page("a")).controller;
    const ac = f.session.getCanvasController(page("a"))!, bc = f.session.getCanvasController(page("b"))!; bc.edit(draft("B pending"));
    const gate = deferred<void>(), commit = f.canvasCommit.getMockImplementation()!; f.canvasCommit.mockImplementationOnce(async (...args) => { await gate.promise; return commit(...args); });
    const before = f.session.getState().layout, pending = f.session.open(page("c")); await vi.waitFor(() => expect(f.canvasCommit).toHaveBeenCalledTimes(1));
    if (kind === "document input") a.setDraft(doc("late A input"));
    else if (kind === "IME ABA") { a.setComposing(true); a.setComposing(false); }
    else { ac.edit(draft("temporary")); ac.edit(draft()); }
    gate.resolve(); expect(await pending).toBe(false); expect(f.session.getState().layout).toBe(before); f.session.dispose();
  });
  it("restores layout with CAS after Canvas ABA during storage wait", async () => {
    const f = fixture(); await f.session.initialize(); const canvas = f.session.getCanvasController(page("a"))!, before = f.session.getState().layout;
    const gate = deferred<void>(), write = f.write.getMockImplementation()!; f.write.mockImplementationOnce(async (...args) => { await gate.promise; return write(...args); });
    const pending = f.session.open(page("b")); await vi.waitFor(() => expect(f.write).toHaveBeenCalledTimes(1));
    canvas.edit(draft("temporary")); canvas.edit(draft()); gate.resolve(); expect(await pending).toBe(false);
    expect(f.session.getState().layout).toBe(before); expect(f.write).toHaveBeenCalledTimes(2); expect(f.write.mock.calls[1]![2]).toBe(f.write.mock.calls[0]![1]); expect(canvas.getState().dirty).toBe(true); f.session.dispose();
  });
  it("rejects another actor's factory controller and disposes it without writing", async () => {
    const f = fixture(), wrong = createNotesCanvasController({ scope: { ...scope, actorId: "other" }, target: page("a"), documentRevision: "d1", validate: () => [] }); const dispose = vi.spyOn(wrong, "dispose");
    const session = createNotesTabbedWorkspaceSession({ host: f.host, initialTarget: page("a"), createCanvasController: () => wrong }); await session.initialize();
    expect(await session.open(page("b"))).toBe(false); expect(dispose).toHaveBeenCalledTimes(1); expect(f.documentCommit).not.toHaveBeenCalled(); expect(f.canvasCommit).not.toHaveBeenCalled(); session.dispose(); f.session.dispose();
  });
  it("retains unknown Canvas receipt across blocked navigation and reconciles without resend", async () => {
    const f = fixture(); await f.session.initialize(); const canvas = f.session.getCanvasController(page("a"))!; canvas.edit(draft("one save"));
    const commit = f.canvasCommit.getMockImplementation()!; f.canvasCommit.mockImplementationOnce(async (...args) => { await commit(...args); throw new Error("Synthetic ACK loss"); });
    expect(await f.session.open(page("b"))).toBe(false); expect(canvas.getState()).toMatchObject({ status: "unknown", dirty: true, draft: draft("one save") });
    expect(await f.session.open(page("b"))).toBe(false); expect(f.canvasCommit).toHaveBeenCalledTimes(1);
    expect(await canvas.reconcile()).toBe(true); expect(await f.session.open(page("b"))).toBe(true); expect(f.lookup).toHaveBeenCalledTimes(1); expect(f.canvasCommit).toHaveBeenCalledTimes(1); f.session.dispose();
  });
});

describe("independent borrowed Canvas surfaces", () => {
  async function surface(f: ReturnType<typeof fixture>) {
    await f.session.initialize(); const controller = f.session.getCanvasController(page("a"))!, container = document.createElement("div"), root = createRoot(container); document.body.append(container);
    const flag = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }, prior = flag.IS_REACT_ACT_ENVIRONMENT; flag.IS_REACT_ACT_ENVIRONMENT = true;
    const props: NotesWorkspaceModesProps = { scope, target: page("a"), document: doc("a"), documentRevision: "d1", title: "Synthetic", canvasController: controller, children: "Original document", beforeModeChange: async () => "d1", renderers: { createLayout: () => draft(), validateLayout: () => [], canvas: () => "Canvas body", presentation: () => ["<p>Slide</p>"] } };
    const render = async (next = props) => { await act(async () => root.render(createElement(StrictMode, null, createElement(NotesWorkspaceModes, next)))); };
    const close = async () => { await act(async () => root.unmount()); container.remove(); flag.IS_REACT_ACT_ENVIRONMENT = prior; f.session.dispose(); };
    return { controller, root, container, props, render, close };
  }
  it("keeps borrowed dirty controller alive through StrictMode and surface unmount/remount", async () => {
    const f = fixture(), s = await surface(f), dispose = vi.spyOn(s.controller, "dispose");
    try { await s.render(); await act(async () => s.controller.edit(draft("retained"))); await act(async () => s.root.render(null));
      expect(dispose).not.toHaveBeenCalled(); expect(s.controller.getState()).toMatchObject({ dirty: true, draft: draft("retained") }); await s.render(); expect(dispose).not.toHaveBeenCalled(); expect(s.controller.getState().draft).toEqual(draft("retained"));
    } finally { await s.close(); } expect(dispose).toHaveBeenCalledTimes(1);
  });
  it("does not flush or save when repeatedly selecting the already active mode", async () => {
    const f = fixture(), s = await surface(f), beforeModeChange = vi.fn(async () => "d1");
    try {
      await s.render({ ...s.props, beforeModeChange });
      const documentTab = [...s.container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Document")!;
      await act(async () => { documentTab.click(); documentTab.click(); });
      expect(beforeModeChange).not.toHaveBeenCalled(); expect(f.documentCommit).not.toHaveBeenCalled(); expect(f.canvasCommit).not.toHaveBeenCalled();
      const canvasTab = [...s.container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Canvas")!;
      await act(async () => canvasTab.click()); expect(beforeModeChange).toHaveBeenCalledTimes(1);
      await act(async () => { canvasTab.click(); canvasTab.click(); }); expect(beforeModeChange).toHaveBeenCalledTimes(1);
      await act(async () => s.controller.edit(draft("explicitly saved")));
      const save = [...s.container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Save Canvas")!;
      await act(async () => save.click()); expect(f.canvasCommit).toHaveBeenCalledTimes(1); expect(s.controller.getState().dirty).toBe(false);
      await act(async () => documentTab.click()); expect(beforeModeChange).toHaveBeenCalledTimes(3);
    } finally { await s.close(); }
  });
  it("pauses unsupported Present/Site before any flush, save or renderer; retains the source", async () => {
    const f = fixture(), s = await surface(f), beforeModeChange = vi.fn(async () => "d1");
    const source = createEditorDocument([{ id: "drawing", type: "oeLegacyNotesDrawing", props: { opaque: "original bytes" } }]);
    const original = JSON.stringify(source), site = vi.fn(() => "<p>Incomplete</p>"), presentation = vi.fn(() => ["<p>Incomplete</p>"]);
    try {
      await s.render({ ...s.props, document: source, beforeModeChange, renderers: { ...s.props.renderers!, site, presentation, validatePublication: () => [{ blockId: "drawing" }] } });
      for (const name of ["Present", "Site"]) {
        const tab = [...s.container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === name)!;
        await act(async () => tab.click());
        expect(s.container.querySelector('[role="alert"]')?.textContent).toContain("Preview paused");
        expect(s.container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe("Document");
      }
      expect(beforeModeChange).not.toHaveBeenCalled(); expect(site).not.toHaveBeenCalled(); expect(presentation).not.toHaveBeenCalled();
      expect(f.canvasCommit).not.toHaveBeenCalled(); expect(f.documentCommit).not.toHaveBeenCalled();
      expect(JSON.stringify(source)).toBe(original);
    } finally { await s.close(); }
  });

  it("rechecks preview admission after an awaited body flush changes the document", async () => {
    const f = fixture(), s = await surface(f), gate = deferred<string | false>();
    const onModeChange = vi.fn(), presentation = vi.fn(() => ["<p>Incomplete</p>"]);
    const original = s.props.document, unsupported = createEditorDocument([{ id: "drawing", type: "oeLegacyNotesDrawing", props: { payload: "preserved" } }]);
    const renderers = { ...s.props.renderers!, presentation, validatePublication: (document: typeof original) => document.blocks.some(block => block.type === "oeLegacyNotesDrawing") ? ["unsupported"] : [] };
    const beforeModeChange = vi.fn(() => gate.promise);
    try {
      await s.render({ ...s.props, beforeModeChange, renderers, onModeChange });
      const tab = [...s.container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Present")!;
      await act(async () => tab.click());
      await s.render({ ...s.props, document: unsupported, documentRevision: "d2", beforeModeChange, renderers, onModeChange });
      await act(async () => gate.resolve("d2"));
      expect(s.container.querySelector('[role="alert"]')?.textContent).toContain("Preview paused");
      expect(onModeChange).not.toHaveBeenCalled(); expect(presentation).not.toHaveBeenCalled();
      expect(f.canvasCommit).not.toHaveBeenCalled(); expect(f.documentCommit).not.toHaveBeenCalled();
      expect(s.container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe("Document");
      expect(unsupported.blocks[0]?.props?.payload).toBe("preserved");
    } finally { await s.close(); }
  });

  it("allows the first mode switch after its body flush publishes undefined-to-false flags and a new revision", async () => {
    const f = fixture(), s = await surface(f), gate = deferred<string | false>();
    const beforeModeChange = vi.fn(() => gate.promise);
    try {
      await s.render({ ...s.props, beforeModeChange });
      const canvas = [...s.container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Canvas")!;
      await act(async () => canvas.click()); expect(beforeModeChange).toHaveBeenCalledTimes(1);
      // The same pending body-flush callback publishes its committed snapshot before returning.
      const current = f.documents.get(notesTargetKey(page("a")))!; f.documents.set(notesTargetKey(page("a")), { ...current, contentRevision: "d2", revision: "r2", document: doc("saved body") });
      await s.render({ ...s.props, beforeModeChange, document: doc("saved body"), documentRevision: "d2", manualSaveRequired: false });
      await act(async () => gate.resolve("d2"));
      expect(canvas.getAttribute("aria-selected")).toBe("true"); expect(s.controller.getState().snapshot!.documentRevision).toBe("d2"); expect(f.canvasCommit).not.toHaveBeenCalled();
    } finally { await s.close(); }
  });
  it.each(["composing", "pendingEditors"] as const)("still rejects real %s false-to-true-to-false during body flush", async flag => {
    const f = fixture(), s = await surface(f), gate = deferred<string | false>(), beforeModeChange = () => gate.promise;
    try {
      await s.render({ ...s.props, beforeModeChange, [flag]: false });
      const canvas = [...s.container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Canvas")!; await act(async () => canvas.click());
      await s.render({ ...s.props, beforeModeChange, [flag]: true }); await s.render({ ...s.props, beforeModeChange, [flag]: false });
      await act(async () => gate.resolve("d1")); expect(canvas.getAttribute("aria-selected")).toBe("false"); expect(f.canvasCommit).not.toHaveBeenCalled();
    } finally { await s.close(); }
  });
  it("rejects a stale body-flush revision after another writer publishes a newer document", async () => {
    const f = fixture(), s = await surface(f), gate = deferred<string | false>(), beforeModeChange = () => gate.promise;
    try {
      await s.render({ ...s.props, beforeModeChange });
      const present = [...s.container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Present")!; await act(async () => present.click());
      const current = f.documents.get(notesTargetKey(page("a")))!; f.documents.set(notesTargetKey(page("a")), { ...current, contentRevision: "d2", revision: "r2", document: doc("external body") });
      await s.render({ ...s.props, beforeModeChange, document: doc("external body"), documentRevision: "d2" });
      await act(async () => gate.resolve("d1")); expect(present.getAttribute("aria-selected")).toBe("false"); expect(s.container.querySelector("iframe")).toBeNull();
    } finally { await s.close(); }
  });
  it("keeps Document selected when clean Canvas refresh fails after document revision change", async () => {
    const f = fixture(), s = await surface(f);
    try { await s.render(); f.canvasRead.mockRejectedValueOnce(new Error("Synthetic read failure"));
      await s.render({ ...s.props, beforeModeChange: async () => "d2" });
      const present = [...s.container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Present")!; await act(async () => present.click());
      expect(present.getAttribute("aria-selected")).toBe("false"); expect(s.container.querySelector('[role="tab"][aria-selected="true"]')!.textContent).toBe("Document"); expect(s.container.querySelector("iframe")).toBeNull(); expect(s.controller.getState().status).toBe("error");
    } finally { await s.close(); }
  });
  it("keeps unknown recovery on the borrowed controller after remount and only looks up its receipt", async () => {
    const f = fixture(), s = await surface(f), dispose = vi.spyOn(s.controller, "dispose");
    try {
      await s.render(); const commit = f.canvasCommit.getMockImplementation()!;
      f.canvasCommit.mockImplementationOnce(async (...args) => { await commit(...args); throw new Error("Synthetic ACK loss"); });
      await act(async () => { s.controller.edit(draft("uncertain")); expect(await s.controller.save()).toBe(false); });
      const recovery = s.controller.getState().recovery; expect(recovery).toBeDefined();
      await act(async () => s.root.render(null)); await s.render();
      expect(dispose).not.toHaveBeenCalled(); expect(s.controller.getState().recovery).toBe(recovery); expect(f.canvasCommit).toHaveBeenCalledTimes(1);
      const query = [...s.container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Query save receipt")!;
      await act(async () => query.click()); expect(s.controller.getState().recovery).toBeUndefined(); expect(s.controller.getState().draft).toEqual(draft("uncertain")); expect(f.lookup).toHaveBeenCalledTimes(1); expect(f.canvasCommit).toHaveBeenCalledTimes(1);
    } finally { await s.close(); }
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
