// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createNotesWorkspaceController } from "../src/notes/controller.js";
import { createNotesCanvasController } from "../src/react/NotesWorkspaceModes.js";
import { createNotesTabbedWorkspaceSession } from "../src/react/NotesTabbedWorkspace.js";
import type { NotesDocumentSnapshot, NotesResourceInvalidation, NotesWorkspaceHost } from "../src/notes/contracts.js";
const scope = { actorId: "synthetic", workspaceId: "refresh" }, target = { kind: "page" as const, pageId: "parent" };
const document = (text: string) => createEditorDocument([{ id: "body", type: "paragraph", content: text }]);
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { resolve, promise }; };
function fixture() {
  let snapshot: NotesDocumentSnapshot = { scope, target, revision: "r1", contentRevision: "c1", title: "Parent", document: document("before"), metadata: { unknown: true }, capabilities: ["document.save"], capabilitySemantics: { "document.save": "test-only" } };
  let notify: ((event: NotesResourceInvalidation) => void) | undefined;
  const read = vi.fn<NotesWorkspaceHost["readDocument"]>(async () => structuredClone(snapshot)), commit = vi.fn<NotesWorkspaceHost["commit"]>(async request => ({ status: "unknown", target: request.target, operationId: request.operationId })), unsubscribe = vi.fn();
  const host: NotesWorkspaceHost = { scope, readDocument: read, commit, beforeSubmit: async () => {}, lookupOperation: async (target, operationId) => ({ status: "unknown", target, operationId }), subscribeResourceChanges(listener) { notify = listener; return unsubscribe; } };
  return { host, read, commit, unsubscribe, update() { snapshot = { ...snapshot, revision: "r2", document: document("after") }; }, notify(event = { scope, target }) { notify?.(event); } };
}
describe("clean scoped resource invalidation", () => {
  it("fences a Canvas instance created and edited while parent read is pending", async () => {
    const f = fixture(), s = createNotesTabbedWorkspaceSession({ host:f.host, initialTarget:target, createCanvasController:({target})=>createNotesCanvasController({scope,target,documentRevision:"c1",validate:()=>[]}) }); await s.initialize();
    // Initialization may create Canvas as part of navigation guards. Remove creation from
    // that path by opening parent via its existing controller without session initialization.
    s.dispose();
    const other = createNotesTabbedWorkspaceSession({host:f.host,createCanvasController:({target})=>createNotesCanvasController({scope,target,documentRevision:"c1",validate:()=>[]})});const c=other.getPreset(target).controller;await c.open(target);
    const gate=deferred<NotesDocumentSnapshot>();f.read.mockImplementationOnce(()=>gate.promise);const work=other.refreshTarget(target);await vi.waitFor(()=>expect(f.read).toHaveBeenCalledTimes(3));const canvas=other.getCanvasController(target)!;canvas.edit({layout:{},view:{},theme:"modern"});gate.resolve({...c.getState().snapshot!,revision:"r2",document:document("after")});expect(await work).toBe(false);expect(c.getState().snapshot?.revision).toBe("r1");expect(canvas.getState().dirty).toBe(true);other.dispose();
  });

  it("refreshes current canonical state without submitting a save", async () => { const f = fixture(), c = createNotesWorkspaceController(f.host); await c.open(target); f.update(); expect(await c.refresh!()).toBe(true); expect(c.getState().snapshot?.revision).toBe("r2"); expect(c.getState().draft).toEqual(document("after")); expect(f.commit).not.toHaveBeenCalled(); c.dispose(); });
  it.each(["body", "input", "ime"])("does not even read with pending %s", async kind => { const f = fixture(), c = createNotesWorkspaceController(f.host); await c.open(target); if (kind === "body") c.setDraft(document("human")); else if (kind === "input") c.setLocalDraft("raw", "keep"); else c.setComposing(true); expect(await c.refresh!()).toBe(false); expect(f.read).toHaveBeenCalledTimes(1); expect(f.commit).not.toHaveBeenCalled(); c.dispose(); });
  it.each(["body", "input", "ime-cycle", "cancel", "dispose", "external-guard"])("retains source when %s changes during read", async kind => {
    const f = fixture(), c = createNotesWorkspaceController(f.host); await c.open(target); const gate = deferred<NotesDocumentSnapshot>(); f.read.mockImplementationOnce(() => gate.promise); let current = true; const work = c.refresh!({ isCurrent: () => current });
    await vi.waitFor(() => expect(f.read).toHaveBeenCalledTimes(2));
    if (kind === "body") c.setDraft(document("human")); else if (kind === "input") c.setLocalDraft("raw", "keep"); else if (kind === "ime-cycle") { c.setComposing(true); c.setComposing(false); } else if (kind === "cancel") c.cancel(); else if (kind === "dispose") c.dispose(); else current = false;
    gate.resolve({ ...c.getState().snapshot!, revision: "r2", document: document("after") }); expect(await work).toBe(false); expect(c.getState().snapshot?.revision).toBe("r1"); expect(f.commit).not.toHaveBeenCalled(); c.dispose();
  });
  it("rejects foreign read evidence and retains current source", async () => { const f = fixture(), c = createNotesWorkspaceController(f.host); await c.open(target); f.read.mockResolvedValueOnce({ ...c.getState().snapshot!, scope: { ...scope, actorId: "other" } }); expect(await c.refresh!()).toBe(false); expect(c.getState().snapshot?.scope).toEqual(scope); c.dispose(); });
  it("refreshes a cached parent on exact notification and unsubscribes on dispose", async () => { const f = fixture(), s = createNotesTabbedWorkspaceSession({ host: f.host, initialTarget: target }); await s.initialize(); f.update(); f.notify(); await vi.waitFor(() => expect(s.getPreset(target).controller.getState().snapshot?.revision).toBe("r2")); expect(s.getState().staleTargets).toEqual([]); s.dispose(); expect(f.unsubscribe).toHaveBeenCalledTimes(1); });
  it("retains dirty parent and stale notice without saving; ignores foreign notice", async () => { const f = fixture(), s = createNotesTabbedWorkspaceSession({ host: f.host, initialTarget: target }); await s.initialize(); const c = s.getPreset(target).controller; c.setDraft(document("human")); f.update(); f.notify(); expect(await s.refreshTarget(target)).toBe(false); expect(c.getState().draft).toEqual(document("human")); expect(s.getState().staleTargets).toEqual([target]); f.notify({ scope: { ...scope, actorId: "other" }, target: { kind: "page", pageId: "foreign" } }); expect(s.getState().staleTargets).toEqual([target]); expect(f.commit).not.toHaveBeenCalled(); s.dispose(); });
  it("a second notice while read is pending fences the first result", async () => { const f = fixture(), s = createNotesTabbedWorkspaceSession({ host: f.host, initialTarget: target }); await s.initialize(); const c = s.getPreset(target).controller, gate = deferred<NotesDocumentSnapshot>(); f.read.mockImplementationOnce(() => gate.promise); f.notify(); await vi.waitFor(() => expect(f.read).toHaveBeenCalledTimes(2)); f.notify(); gate.resolve({ ...c.getState().snapshot!, revision: "r2", document: document("old response") }); await vi.waitFor(() => expect(c.getState().snapshot?.revision).toBe("r1")); f.update(); await vi.waitFor(async () => expect(await s.refreshTarget(target)).toBe(true)); expect(c.getState().draft).toEqual(document("after")); s.dispose(); });
});
