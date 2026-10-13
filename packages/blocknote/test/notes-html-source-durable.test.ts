import { describe, it, expect, vi } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createNotesWorkspaceController } from "../src/notes/controller.js";
import { createNotesHtmlSourceDraftSession, parseNotesHtmlSourceDraft, notesHtmlSourceDraftKey, notesHtmlSourceCacheKey, sameNotesHtmlSourceDraft } from "../src/notes/htmlSourceDraft.js";
import type { NotesHtmlSourceDraft, NotesHtmlSourceDraftJournal } from "../src/notes/htmlSourceDraft.js";
import type { NotesWorkspaceHost, NotesDocumentSnapshot, NotesTarget } from "../src/notes/contracts.js";
const scope = { workspaceId: "synthetic", actorId: "human" }, target: NotesTarget = { kind: "page", pageId: "a" };
const original = { html: "<p>Original</p>\n", css: " p {}\n", javascript: "keptNeverRun()\n" }, input = { html: "<invalid 日本語\n", css: "bad{\n", javascript: "throw new Error('never run')\n" };
const doc = (source = original) => createEditorDocument([{ id: "widget", type: "oeHtmlWidget", props: { title: "Widget", ...source } }]);
const snapshot = (t: NotesTarget = target): NotesDocumentSnapshot => ({ scope, target: t, revision: "r1", contentRevision: "c1", title: "Test", document: doc(), metadata: {}, capabilities: ["document.save"], capabilitySemantics: { "document.save": "test-only" } });
const cache = (source = input) => ({ version: 1, base: JSON.stringify(original), draft: { ...source }, part: "javascript" });
const raw = (source = input): NotesHtmlSourceDraft => ({ version: 1, scope, target, blockId: "widget", revision: "r1", contentRevision: "c1", original, input: source, composing: false, part: "javascript", stage: "editing", sequence: "one" });
function journal() {
  const stored = new Map<string, NotesHtmlSourceDraft>();
  const port: NotesHtmlSourceDraftJournal = { version: 1, compareAndSwap: true,
    list: vi.fn(async (s, t) => [...stored.values()].filter(d => sameNotesHtmlSourceDraft(d.scope, s) && sameNotesHtmlSourceDraft(d.target, t)).map(d => structuredClone(d))),
    put: vi.fn(async (next, expected) => { const key = notesHtmlSourceDraftKey(next); if (!sameNotesHtmlSourceDraft(stored.get(key), expected)) throw new Error("CAS"); stored.set(key, structuredClone(next)); }),
    remove: vi.fn(async expected => { const key = notesHtmlSourceDraftKey(expected); if (!sameNotesHtmlSourceDraft(stored.get(key), expected)) throw new Error("CAS remove"); stored.delete(key); })
  };
  return { port, stored };
}
function setup(j = journal()) {
  const host: NotesWorkspaceHost = { scope, sourceDraftJournal: j.port, readDocument: vi.fn(async t => snapshot(t)), beforeSubmit: vi.fn(async () => undefined),
    commit: vi.fn<NotesWorkspaceHost["commit"]>(async r => ({ status: "committed", operationId: r.operationId, target: r.target, historyId: "h", persistence: "test-only", snapshot: { ...snapshot(r.target), revision: "r2", contentRevision: "c2", document: r.command.kind === "document.save" ? r.command.document : doc() } })),
    lookupOperation: vi.fn<NotesWorkspaceHost["lookupOperation"]>(async (t, operationId) => ({ status: "not-found", target: t, operationId, terminal: true })) };
  const controller = createNotesWorkspaceController(host, { timeoutMs: 100, operationId: () => "fixed" });
  const key = notesHtmlSourceCacheKey(scope, target, "widget");
  return { j, host, controller, key };
}
const tick = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };

describe("durable unapplied HTML source", () => {
  it("retains exact invalid raw, source language and captured revisions; never submits or executes", async () => {
    const f = setup(); expect(await f.controller.open(target)).toBe(true); f.controller.setLocalDraft(f.key, cache());
    expect(f.controller.getState().localDrafts[f.key]).toEqual(cache()); expect(await f.controller.flushSourceDrafts!()).toBe(true);
    const record = [...f.j.stored.values()][0]!; expect(record.input).toEqual(input); expect(record.original).toEqual(original); expect(record.revision).toBe("r1"); expect(record.contentRevision).toBe("c1"); expect(record.part).toBe("javascript"); expect(f.controller.getState().pendingEditors).toBe(true); expect(f.host.commit).not.toHaveBeenCalled();
  });
  it("fresh controller hydrates all strings and applied backup as raw review; no automatic Apply/save", async () => {
    const j = journal(), d = { ...raw(), stage: "applied" as const, composing: true }; j.stored.set(notesHtmlSourceDraftKey(d), d);
    const f = setup(j); expect(await f.controller.open(target)).toBe(true); expect(f.controller.getState().localDrafts[f.key]).toEqual(cache()); expect(f.controller.getState().draft).toEqual(doc()); expect(f.controller.getState().composing).toBe(false); expect(f.controller.getState().pendingEditors).toBe(true); expect(f.host.commit).not.toHaveBeenCalled();
  });
  it("blocks direct page movement immediately after input and during durable write", async () => {
    const f = setup(); await f.controller.open(target); f.controller.setLocalDraft(f.key, cache());
    expect(await f.controller.open({ kind: "page", pageId: "b" })).toBe(false); expect(f.controller.getState().snapshot?.target).toEqual(target); expect(f.host.readDocument).toHaveBeenCalledTimes(1);
  });
  it("quota preserves synchronous cache, reports unconfirmed durability and blocks leave/Apply", async () => {
    const f = setup(); await f.controller.open(target); vi.mocked(f.j.port.put).mockRejectedValue(new Error("quota")); f.controller.setLocalDraft(f.key, cache());
    expect(await f.controller.flushSourceDrafts!()).toBe(false); expect(f.controller.getState().sourceDrafts?.status).toBe("error"); expect(f.controller.getState().localDrafts[f.key]).toEqual(cache()); expect(await f.controller.open({ kind: "page", pageId: "b" })).toBe(false); expect(() => f.controller.assertLocalSourceCurrent!(f.key)).toThrow("unconfirmed");
  });
  it("rechecks unknown write via read-only exact match without duplicate put", async () => {
    const f = setup(); await f.controller.open(target); const put = f.j.port.put;
    vi.mocked(put).mockImplementationOnce(async next => { f.j.stored.set(notesHtmlSourceDraftKey(next), structuredClone(next)); throw Error("lost durable ACK"); });
    f.controller.setLocalDraft(f.key, cache()); expect(await f.controller.flushSourceDrafts!()).toBe(false); expect(await f.controller.retrySourceDrafts!()).toBe(true); expect(put).toHaveBeenCalledTimes(1); expect(f.controller.getState().localDrafts[f.key]).toEqual(cache());
  });
  it("input after unknown raw ACK reconciles the captured own attempt before CAS storing newest raw", async () => {
    const f = setup(); await f.controller.open(target);
    vi.mocked(f.j.port.put).mockImplementationOnce(async next => { f.j.stored.set(notesHtmlSourceDraftKey(next), structuredClone(next)); throw Error("lost ACK"); });
    f.controller.setLocalDraft(f.key, cache()); expect(await f.controller.flushSourceDrafts!()).toBe(false);
    f.controller.setLocalDraft(f.key, cache({ ...input, html: "Newest after unknown ACK" })); expect(await f.controller.flushSourceDrafts!()).toBe(true);
    expect([...f.j.stored.values()][0]!.input.html).toBe("Newest after unknown ACK"); expect(f.j.port.put).toHaveBeenCalledTimes(2); expect(f.host.commit).not.toHaveBeenCalled();
  });
  it("two controllers create one CAS winner; losing human raw and winner storage both remain", async () => {
    const j = journal(), a = setup(j), b = setup(j); await a.controller.open(target); await b.controller.open(target);
    a.controller.setLocalDraft(a.key, cache({ ...input, html: "A human" })); expect(await a.controller.flushSourceDrafts!()).toBe(true);
    b.controller.setLocalDraft(b.key, cache({ ...input, html: "B human" })); expect(await b.controller.flushSourceDrafts!()).toBe(false); expect(b.controller.getState().sourceDrafts?.status).toBe("conflict"); expect(JSON.stringify(b.controller.getState().localDrafts)).toContain("B human"); expect([...j.stored.values()][0]!.input.html).toBe("A human"); expect(j.port.put).toHaveBeenCalledTimes(1);
  });
  it("exact discard fails against a newer other reader; never deletes winner raw", async () => {
    const j = journal(), d = raw(); j.stored.set(notesHtmlSourceDraftKey(d), d); const f = setup(j); await f.controller.open(target);
    const newer = { ...d, sequence: "newer", input: { ...input, html: "Other reader" } }; j.stored.set(notesHtmlSourceDraftKey(d), newer);
    expect(await f.controller.discardLocalDraft!(f.key)).toBe(false); expect(f.controller.getState().localDrafts[f.key]).toEqual(cache()); expect([...j.stored.values()][0]!.input.html).toBe("Other reader"); expect(j.port.remove).not.toHaveBeenCalled();
  });
  it("explicit exact discard drains storage before removing cache/allowing leave", async () => {
    const f = setup(); await f.controller.open(target); f.controller.setLocalDraft(f.key, cache()); await f.controller.flushSourceDrafts!();
    expect(await f.controller.discardLocalDraft!(f.key)).toBe(true); expect(f.j.stored.size).toBe(0); expect(f.controller.getState().localDrafts[f.key]).toBeUndefined(); expect(await f.controller.open({ kind: "page", pageId: "b" })).toBe(true);
  });
  it("Apply marks protected raw separately from body save; only checked exact save retires it", async () => {
    const f = setup(); await f.controller.open(target); f.controller.setLocalDraft(f.key, cache()); await f.controller.flushSourceDrafts!(); f.controller.assertLocalSourceCurrent!(f.key);
    f.controller.setDraft(doc(input)); f.controller.markLocalDraftApplied!(f.key); await f.controller.flushSourceDrafts!();
    expect(f.controller.getState().dirty).toBe(true); expect(f.controller.getState().pendingEditors).toBe(false); expect([...f.j.stored.values()][0]!.stage).toBe("applied"); expect(f.host.commit).not.toHaveBeenCalled();
    expect((await f.controller.save())?.status).toBe("committed"); expect(await f.controller.flushSourceDrafts!()).toBe(true); expect(f.j.stored.size).toBe(0); expect(f.controller.getState().dirty).toBe(false);
  });
  it("a fresh edit after verified save binds to the new canonical revision, without rebasing old raw", async () => {
    const f = setup(); await f.controller.open(target); f.controller.setLocalDraft(f.key, cache()); await f.controller.flushSourceDrafts!(); f.controller.setDraft(doc(input)); f.controller.markLocalDraftApplied!(f.key); await f.controller.flushSourceDrafts!(); await f.controller.save(); await f.controller.flushSourceDrafts!();
    f.controller.setLocalDraft(f.key, { version: 1, base: JSON.stringify(input), draft: { ...input, html: "Next reviewed input" }, part: "html" }); await f.controller.flushSourceDrafts!(); expect([...f.j.stored.values()][0]!.revision).toBe("r2"); expect([...f.j.stored.values()][0]!.original).toEqual(input); expect(() => f.controller.assertLocalSourceCurrent!(f.key)).not.toThrow();
  });
  it.each(["conflict", "denied", "rejected"] as const)("body %s preserves applied backup and original raw", async status => {
    const f = setup(); await f.controller.open(target); f.controller.setLocalDraft(f.key, cache()); await f.controller.flushSourceDrafts!(); f.controller.setDraft(doc(input)); f.controller.markLocalDraftApplied!(f.key); await f.controller.flushSourceDrafts!();
    vi.mocked(f.host.commit).mockImplementation(async r => ({ status, target: r.target, operationId: r.operationId })); expect((await f.controller.save())?.status).toBe(status); expect([...f.j.stored.values()][0]!.input).toEqual(input); expect(f.j.port.remove).not.toHaveBeenCalled();
  });
  it("unknown body ACK uses the existing fixed-ID lookup, never repeats POST; then exact cleanup", async () => {
    const f = setup(); await f.controller.open(target); f.controller.setLocalDraft(f.key, cache()); await f.controller.flushSourceDrafts!(); f.controller.setDraft(doc(input)); f.controller.markLocalDraftApplied!(f.key); await f.controller.flushSourceDrafts!();
    const commit = f.host.commit; vi.mocked(commit).mockRejectedValueOnce(Error("lost ACK")); expect((await f.controller.save())?.status).toBe("unknown"); expect(f.j.stored.size).toBe(1);
    const recovery = f.controller.getRecovery()!;
    vi.mocked(f.host.lookupOperation).mockResolvedValueOnce({ status: "committed", target, operationId: "fixed", historyId: "h", persistence: "test-only", snapshot: { ...snapshot(), revision: "r2", contentRevision: "c2", document: doc(input) } });
    expect(recovery.request.operationId).toBe("fixed"); expect((await f.controller.reconcile()).status).toBe("committed"); expect(await f.controller.flushSourceDrafts!()).toBe(true); expect(commit).toHaveBeenCalledTimes(1); expect(f.j.stored.size).toBe(0);
  });
  it("fresh process body ticket lookup hydrates its applied raw then retires it only after exact fixed receipt", async () => {
    const f = setup(); await f.controller.open(target); f.controller.setLocalDraft(f.key, cache()); await f.controller.flushSourceDrafts!(); f.controller.setDraft(doc(input)); f.controller.markLocalDraftApplied!(f.key); await f.controller.flushSourceDrafts!(); vi.mocked(f.host.commit).mockRejectedValue(Error("lost ACK")); await f.controller.save();
    const recovery = f.controller.getRecovery()!; f.controller.dispose();
    vi.mocked(f.host.lookupOperation).mockResolvedValue({ status: "committed", target, operationId: "fixed", historyId: "h", persistence: "test-only", snapshot: { ...snapshot(), revision: "r2", contentRevision: "c2", document: doc(input) } });
    const fresh = createNotesWorkspaceController(f.host, { recovery }); expect((await fresh.reconcile()).status).toBe("committed"); expect(await fresh.flushSourceDrafts!()).toBe(true); expect(f.j.stored.size).toBe(0); expect(f.host.commit).toHaveBeenCalledTimes(1); expect(f.host.lookupOperation).toHaveBeenCalledWith(target, "fixed", expect.any(AbortSignal));
  });
  it.each(["denied", "conflict", "not-found"] as const)("restart ticket %s retains its applied raw for reopening the same authorized target", async status => {
    const f = setup(); await f.controller.open(target); f.controller.setLocalDraft(f.key, cache()); await f.controller.flushSourceDrafts!(); f.controller.setDraft(doc(input)); f.controller.markLocalDraftApplied!(f.key); await f.controller.flushSourceDrafts!(); vi.mocked(f.host.commit).mockRejectedValue(Error("lost ACK")); await f.controller.save(); const recovery = f.controller.getRecovery()!; f.controller.dispose();
    vi.mocked(f.host.lookupOperation).mockResolvedValue(status === "not-found" ? { status, target, operationId: "fixed", terminal: true } : { status, target, operationId: "fixed" });
    const fresh = createNotesWorkspaceController(f.host, { recovery }); expect((await fresh.reconcile()).status).toBe(status); expect(fresh.getState().localDrafts[f.key]).toEqual(cache()); expect(await fresh.open(target)).toBe(true); expect(fresh.getState().localDrafts[f.key]).toEqual(cache()); expect(f.j.stored.size).toBe(1); expect(f.host.commit).toHaveBeenCalledTimes(1);
  });
  it("cleanup failure after confirmed body save keeps backup and blocks movement", async () => {
    const f = setup(); await f.controller.open(target); f.controller.setLocalDraft(f.key, cache()); await f.controller.flushSourceDrafts!(); f.controller.setDraft(doc(input)); f.controller.markLocalDraftApplied!(f.key); await f.controller.flushSourceDrafts!(); vi.mocked(f.j.port.remove).mockRejectedValue(Error("cleanup quota"));
    expect((await f.controller.save())?.status).toBe("committed"); expect(await f.controller.flushSourceDrafts!()).toBe(false); expect(f.controller.getState().dirty).toBe(false); expect(f.controller.getState().pendingEditors).toBe(true); expect(f.j.stored.size).toBe(1); expect(await f.controller.open({ kind: "page", pageId: "b" })).toBe(false); expect(f.host.commit).toHaveBeenCalledTimes(1);
  });
  it("foreign or malformed journal cannot be treated as an empty successful restoration", async () => {
    const f = setup(); vi.mocked(f.j.port.list).mockResolvedValue([{ ...raw(), scope: { ...scope, actorId: "foreign" } }]); expect(await f.controller.open(target)).toBe(false); expect(f.controller.getState().snapshot).toBeUndefined(); expect(f.j.port.remove).not.toHaveBeenCalled();
  });
  it("old revision and missing block input remain reviewable but never automatically Apply", async () => {
    const j = journal(), d = { ...raw(), revision: "old", contentRevision: "old-content" }; j.stored.set(notesHtmlSourceDraftKey(d), d);
    const f = setup(j); expect(await f.controller.open(target)).toBe(true); expect(() => f.controller.assertLocalSourceCurrent!(f.key)).toThrow("revision changed"); expect(f.controller.getState().localDrafts[f.key]).toEqual(cache()); expect(f.host.commit).not.toHaveBeenCalled();
  });
  it("multiple historical originals stay preserved; UI cannot silently choose/rebase one", async () => {
    const j = journal(), a = raw(), b = { ...raw(), revision: "r-old", input: { ...input, html: "older raw" } }; for (const d of [a,b]) j.stored.set(notesHtmlSourceDraftKey(d), d);
    const f = setup(j); expect(await f.controller.open(target)).toBe(true); expect(JSON.stringify(f.controller.getState().localDrafts)).toContain("older raw"); expect(() => f.controller.assertLocalSourceCurrent!(f.key)).toThrow(); expect(j.stored.size).toBe(2);
  });
  it("input while destination journal read waits invalidates navigation and preserves source", async () => {
    const f = setup(); await f.controller.open(target); let release!: () => void;
    vi.mocked(f.j.port.list).mockImplementationOnce(async () => { await new Promise<void>(r => release = r); return []; });
    const moving = f.controller.open({ kind: "page", pageId: "b" }); await tick(); f.controller.setLocalDraft(f.key, cache()); release(); expect(await moving).toBe(false); expect(f.controller.getState().snapshot?.target).toEqual(target); expect(f.controller.getState().localDrafts[f.key]).toEqual(cache());
  });
  it("IME and changing raw during awaited discard retain newest input", async () => {
    const f = setup(); await f.controller.open(target); f.controller.setLocalDraft(f.key, cache()); await f.controller.flushSourceDrafts!(); f.controller.setComposing(true); expect(await f.controller.discardLocalDraft!(f.key)).toBe(false); expect(await f.controller.open({ kind: "page", pageId: "b" })).toBe(false);
    f.controller.setComposing(false); await f.controller.flushSourceDrafts!(); let release!: () => void; const remove = f.j.port.remove;
    vi.mocked(remove).mockImplementationOnce(async expected => { await new Promise<void>(r => release = r); f.j.stored.delete(notesHtmlSourceDraftKey(expected)); });
    const closing = f.controller.discardLocalDraft!(f.key); await tick(); f.controller.setLocalDraft(f.key, cache({ ...input, html: "Newest during close" })); release(); expect(await closing).toBe(false); expect(JSON.stringify(f.controller.getState().localDrafts)).toContain("Newest during close"); expect([...f.j.stored.values()][0]!.input.html).toBe("Newest during close");
  });
  it("preview size does not truncate raw; strict parser rejects accessors and identity/type changes", () => {
    const large = { ...raw(), input: { ...input, html: "x".repeat(210000) } }; expect(parseNotesHtmlSourceDraft(large).input.html).toHaveLength(210000);
    expect(() => parseNotesHtmlSourceDraft({ ...raw(), version: 2 })).toThrow(); expect(() => parseNotesHtmlSourceDraft({ ...raw(), blockId: "" })).toThrow(); expect(() => parseNotesHtmlSourceDraft({ ...raw(), input: { html: "", css: "", get javascript() { throw Error("must not invoke"); } } })).toThrow("Accessors");
  });
  it("bounded hung storage retains raw and returns failure without submitting", async () => {
    const f = setup(); await f.controller.open(target); vi.mocked(f.j.port.put).mockImplementation(async () => new Promise(() => undefined)); f.controller.setLocalDraft(f.key, cache()); expect(await f.controller.flushSourceDrafts!()).toBe(false); expect(f.controller.getState().localDrafts[f.key]).toEqual(cache()); expect(f.host.commit).not.toHaveBeenCalled();
  });
  it("session records are detached from host references and notify observers cannot mutate raw", async () => {
    const j = journal(), s = createNotesHtmlSourceDraftSession(j.port, scope, vi.fn()); const hydrate = await s.hydrate(snapshot(), new AbortController().signal); hydrate(); const c = cache(); s.set("widget", c, false); c.draft.html = "foreign reference edit"; await s.flush(); expect([...j.stored.values()][0]!.input.html).toBe(input.html);
  });
});
