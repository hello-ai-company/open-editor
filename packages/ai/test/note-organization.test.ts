import { afterEach, describe, expect, it, vi } from "vitest";
import { createNoteOrganizationSession, createOrganizationRequest, parseOrganizationSnapshot, parseOrganizationPlan, validateOrganizationRequest, type OrganizationSnapshot, type OrganizationPlan, type OrganizationReceipt, type OrganizationRequest, type OrganizationCommitResult, type NoteOrganizationHost } from "../src/noteOrganization.js";
const initial = (): OrganizationSnapshot => ({ documentId: "note", revision: "r1", hierarchyRevision: "h1", pinRevision: "p1", title: "自由メモ", parentId: null, titleManual: false, parentPinned: false, autoOrganize: true,
  root: { scope: "one", sharing: "private", editable: true }, pages: [ { id: "note", parentId: null, title: "自由メモ", scope: "one", sharing: "private", editable: true }, { id: "travel", parentId: null, title: "旅", scope: "one", sharing: "private", editable: true }, { id: "child", parentId: "note", title: "子", scope: "one", sharing: "private", editable: true } ],
  document: { schemaVersion: 1, blocks: [ { id: "p", type: "paragraph", content: [{ type: "text", text: "旅の準備", styles: { bold: true } }], props: { future: { keep: true } } }, { id: "q", type: "paragraph", content: "3点。不要ではない。天気は未確認。" }, { id: "unknown", type: "future-widget", props: { raw: "<script>inert()</script>" }, content: { opaque: true }, children: [{ id: "nested", type: "paragraph", content: "保全" }] } ] } });
const plan = (s = initial()): OrganizationPlan => ({ documentId: s.documentId, revision: s.revision, hierarchyRevision: s.hierarchyRevision, pinRevision: s.pinRevision, formats: [{ blockId: "p", type: "heading", level: 2 }, { blockId: "q", type: "bulletListItem" }], title: "旅の準備", parentId: "travel", placement: "certain" });
function fixture() {
  let current = initial(), writes = 0;
  const receipts = new Map<string, { request: OrganizationRequest; receipt: OrganizationReceipt }>();
  const host: NoteOrganizationHost = { read: vi.fn(async () => structuredClone(current)), beforeSubmit: vi.fn(async () => {}), lookupOperation: vi.fn(async (id: string): Promise<OrganizationCommitResult> => receipts.has(id) ? { status: "committed", receipt: structuredClone(receipts.get(id)!.receipt) } : { status: "not-found", terminal: true, operationId: id }),
    commit: vi.fn(async (r: OrganizationRequest): Promise<OrganizationCommitResult> => {
      if (receipts.has(r.operationId)) return { status: "committed", receipt: structuredClone(receipts.get(r.operationId)!.receipt) };
      try { validateOrganizationRequest(r, current); } catch { return { status: "conflict" }; }
      writes++; const hierarchyChanged = r.after.title !== current.title || r.after.parentId !== current.parentId;
      current = { ...current, ...structuredClone(r.after), revision: `r${writes + 1}`, hierarchyRevision: hierarchyChanged ? `h${writes + 1}` : current.hierarchyRevision, pages: current.pages.map(p => p.id === current.documentId ? { ...p, title: r.after.title, parentId: r.after.parentId } : p) };
      const receipt = { operationId: r.operationId, snapshot: structuredClone(current), historyId: `history:${r.operationId}` }; receipts.set(r.operationId, { request: structuredClone(r), receipt }); return { status: "committed", receipt };
    }) };
  const prepare = vi.fn(async ({ snapshot }: { snapshot: OrganizationSnapshot }) => plan(snapshot)), cancel = vi.fn(async () => {});
  const session = () => createNoteOrganizationSession({ host, agent: { prepare, cancel }, idleMs: 500, timeoutMs: 100 });
  return { host, prepare, cancel, session, get current() { return current; }, set current(v) { current = v; }, receipts };
}
afterEach(() => vi.useRealTimers());
describe("meaning-preserving note organization contract", () => {
  it("changes only structure, title and existing parent while preserving negation, numbers, uncertainty, inline styles and unknowns", () => {
    const source = initial(), before = structuredClone(source), request = createOrganizationRequest(source, plan(source), "op1");
    expect(source).toEqual(before); expect(request.after.title).toBe("旅の準備"); expect(request.after.parentId).toBe("travel");
    expect(request.after.document.blocks.map(b => b.content)).toEqual(source.document.blocks.map(b => b.content));
    expect(request.after.document.blocks[2]).toEqual(source.document.blocks[2]); expect(request.after.document.blocks[0]!.props!.future).toEqual({ keep: true });
  });
  it.each(["permission", "manual-title", "pinned-parent", "stale-body", "stale-tree", "stale-pin", "invented-title", "self", "descendant", "missing", "other-scope", "sharing", "read-only", "root-sharing"])("rejects %s", kind => {
    const s = initial(), p = plan(s);
    if (kind === "permission") s.autoOrganize = false;
    if (kind === "manual-title") s.titleManual = true;
    if (kind === "pinned-parent") s.parentPinned = true;
    if (kind === "stale-body") p.revision = "r0";
    if (kind === "stale-tree") p.hierarchyRevision = "h0";
    if (kind === "stale-pin") p.pinRevision = "p0";
    if (kind === "invented-title") p.title = "晴天なので予約します";
    if (kind === "self") p.parentId = "note";
    if (kind === "descendant") p.parentId = "child";
    if (kind === "missing") p.parentId = "missing";
    if (kind === "other-scope") s.pages[1]!.scope = "other";
    if (kind === "sharing") s.pages[1]!.sharing = "public";
    if (kind === "read-only") s.pages[1]!.editable = false;
    if (kind === "root-sharing") { s.parentId = "travel"; s.pages[0]!.parentId = "travel"; p.parentId = null; s.root.sharing = "public"; }
    expect(() => createOrganizationRequest(s, p, "op")).toThrow();
  });
  it("respects unchanged manual title and parent pins and can choose authorized top-level", () => {
    const s = initial(); s.titleManual = s.parentPinned = true;
    expect(createOrganizationRequest(s, { ...plan(s), title: s.title, parentId: s.parentId }, "op").after.title).toBe(s.title);
    const t = initial(); t.parentId = "travel"; t.pages[0]!.parentId = "travel";
    expect(createOrganizationRequest(t, { ...plan(t), parentId: null }, "op").after.parentId).toBeNull();
  });
  it("rejects text rewriting, opaque/child targets, cycles, getters, hostile keys, duplicate IDs and oversized context", () => {
    const s = initial(), r = createOrganizationRequest(s, plan(s), "op"); r.after.document.blocks[1]!.content = "3点。不要です。";
    expect(() => validateOrganizationRequest(r, s)).toThrow();
    for (const id of ["unknown", "nested", "missing"]) expect(() => createOrganizationRequest(s, { ...plan(s), formats: [{ blockId: id, type: "heading", level: 1 }] }, "op")).toThrow();
    const cyclic = initial(); cyclic.pages[0]!.parentId = "child"; cyclic.parentId = "child"; expect(() => parseOrganizationSnapshot(cyclic)).toThrow(/cycle/);
    const getter = { ...plan() }; Object.defineProperty(getter, "title", { enumerable: true, get() { throw new Error("must not execute"); } }); expect(() => parseOrganizationPlan(getter)).toThrow(/data value/);
    expect(() => parseOrganizationPlan({ ...plan(), supplement: "untrusted" })).toThrow();
    expect(() => parseOrganizationPlan({ ...plan(), formats: [{ blockId: "p", type: "heading", level: 2 }, { blockId: "p", type: "bulletListItem" }] })).toThrow(/duplicate/);
    const large = initial(); large.document.blocks[0]!.content = "a".repeat(500001); expect(() => parseOrganizationSnapshot(large)).toThrow();
  });
});
describe("idle auto-organization and atomic host coordination", () => {
  it("defaults off without note-specific authority and applies a permitted idle note exactly once", async () => {
    vi.useFakeTimers(); const f = fixture(), s = f.session(); s.update({ ...f.current, autoOrganize: false }); await vi.advanceTimersByTimeAsync(2000); expect(f.prepare).not.toHaveBeenCalled();
    s.update(f.current); await vi.advanceTimersByTimeAsync(500); expect(f.host.commit).toHaveBeenCalledTimes(1); expect(s.getSnapshot().status).toBe("applied");
    s.update(f.current); await vi.advanceTimersByTimeAsync(3000); expect(f.host.commit).toHaveBeenCalledTimes(1); expect(s.getSnapshot().canUndo).toBe(true); s.dispose();
  });
  it("atomically undoes body/title/move and refuses subsequent human edits, even an ABA revision", async () => {
    vi.useFakeTimers(); const f = fixture(), s = f.session(); s.update(f.current); await vi.advanceTimersByTimeAsync(500); s.update(f.current); await s.undo();
    expect(f.current.document).toEqual(initial().document); expect(f.current.title).toBe(initial().title); expect(f.current.parentId).toBeNull(); expect(s.getSnapshot().canUndo).toBe(false); s.update(f.current); await vi.advanceTimersByTimeAsync(1000); expect(f.host.commit).toHaveBeenCalledTimes(2); s.dispose();
    const g = fixture(), a = g.session(); a.update(g.current); await vi.advanceTimersByTimeAsync(500); g.current = { ...g.current, revision: "human-ABA" }; a.update(g.current); await a.undo(); expect(g.host.commit).toHaveBeenCalledTimes(1); a.dispose();
  });
  it("suppresses 1000 IME/continuous-input revisions and invalidates a late preparation after switching notes", async () => {
    vi.useFakeTimers(); const f = fixture(), s = f.session(); s.update(f.current); s.compositionStart();
    for (let i = 0; i < 1000; i++) { s.update({ ...f.current, revision: `draft-${i}` }, false); await vi.advanceTimersByTimeAsync(100); }
    expect(f.prepare).not.toHaveBeenCalled(); s.compositionEnd(); s.update(f.current); await vi.advanceTimersByTimeAsync(500); expect(f.host.commit).toHaveBeenCalledTimes(1); s.dispose();
    const g = fixture(); let release!: (p: OrganizationPlan) => void; g.prepare.mockImplementation(() => new Promise(resolve => { release = resolve; })); const a = g.session(); a.update(g.current); await vi.advanceTimersByTimeAsync(500); a.update({ ...g.current, revision: "r3" }, false); release(plan()); await vi.advanceTimersByTimeAsync(0); expect(g.host.commit).not.toHaveBeenCalled(); expect(g.cancel).toHaveBeenCalledTimes(1); a.dispose();
  });
  it("only ambiguous placement requests confirmation and offers retaining current parent", async () => {
    vi.useFakeTimers(); const f = fixture(); f.prepare.mockImplementation(async ({ snapshot }) => ({ ...plan(snapshot), placement: "ambiguous" })); const s = f.session(); s.update(f.current); await vi.advanceTimersByTimeAsync(500);
    expect(s.getSnapshot().status).toBe("confirming"); expect(f.host.commit).not.toHaveBeenCalled(); await s.confirmPlacement(null); expect(f.current.parentId).toBeNull(); expect(f.current.title).toBe("旅の準備"); s.dispose();
  });
  it.each(["revision", "hierarchyRevision", "pinRevision"] as const)("rechecks %s immediately before committing", async key => {
    vi.useFakeTimers(); const f = fixture(); const read = f.host.read; f.host.read = async (id, signal) => ({ ...await read(id, signal), [key]: "changed" }); const s = f.session(); s.update(f.current); await vi.advanceTimersByTimeAsync(500); expect(f.host.commit).not.toHaveBeenCalled(); expect(s.getSnapshot().status).toBe("blocked"); s.dispose();
  });
  it("persists recovery before submission and does not write if the journal fails", async () => {
    vi.useFakeTimers(); const f = fixture(); f.host.beforeSubmit = vi.fn(async () => { throw new Error("disk full"); }); const s = f.session(); s.update(f.current); await vi.advanceTimersByTimeAsync(500); expect(f.host.commit).not.toHaveBeenCalled(); expect(s.getRecovery()).toBeUndefined(); s.dispose();
  });
  it("recovers lost ACK by operation ID across restart without resubmission", async () => {
    vi.useFakeTimers(); const f = fixture(), commit = f.host.commit; f.host.commit = vi.fn(async (r, signal) => { await commit(r, signal); throw new Error("ack lost"); }); const s = f.session(); s.update(f.current); await vi.advanceTimersByTimeAsync(500);
    expect(s.getSnapshot().status).toBe("unknown"); const recovery = s.getRecovery()!; expect(recovery.request.before.document).toEqual(initial().document); s.update(f.current); await vi.advanceTimersByTimeAsync(2000); expect(f.host.commit).toHaveBeenCalledTimes(1); s.dispose();
    const restarted = createNoteOrganizationSession({ host: f.host, agent: { prepare: f.prepare, cancel: f.cancel }, recovery }); restarted.update(f.current); await restarted.reconcile(); expect(restarted.getSnapshot().status).toBe("applied"); expect(f.host.lookupOperation).toHaveBeenCalledWith(recovery.request.operationId, expect.any(AbortSignal)); expect(f.host.commit).toHaveBeenCalledTimes(1); restarted.update(f.current); await restarted.undo(); expect(f.host.commit).toHaveBeenCalledTimes(2); restarted.dispose();
  });
  it("bounds pending save, never resends, rejects forged receipts and blocks after unacknowledged cancel", async () => {
    vi.useFakeTimers(); const f = fixture(); f.host.commit = vi.fn(async () => new Promise<OrganizationCommitResult>(() => {})); const s = f.session(); s.update(f.current); await vi.advanceTimersByTimeAsync(600); expect(s.getSnapshot().status).toBe("unknown"); s.update(f.current); await vi.advanceTimersByTimeAsync(5000); expect(f.host.commit).toHaveBeenCalledTimes(1); s.dispose();
    const g = fixture(); const commit = g.host.commit; g.host.commit = async (r, signal) => { const result = await commit(r, signal); if (result.status === "committed") result.receipt.snapshot.title = "forged"; return result; }; const a = g.session(); a.update(g.current); await vi.advanceTimersByTimeAsync(500); expect(a.getSnapshot().status).toBe("unknown"); expect(a.getRecovery()).toBeDefined(); a.dispose();
    const h = fixture(); h.prepare.mockImplementation(async () => new Promise(() => {})); h.cancel.mockImplementation(async () => new Promise(() => {})); const b = h.session(); b.update(h.current); await vi.advanceTimersByTimeAsync(600); await vi.advanceTimersByTimeAsync(100); expect(b.getSnapshot().status).toBe("blocked"); expect(h.host.commit).not.toHaveBeenCalled(); b.dispose();
  });
  it("never overlaps preparation, reconnect invalidates old runs, and frozen observers cannot alter proposals", async () => {
    vi.useFakeTimers(); const f = fixture(); let release!: (p: OrganizationPlan) => void, oldSignal!: AbortSignal;
    f.prepare.mockImplementation(({ signal }: { snapshot: OrganizationSnapshot; signal?: AbortSignal }) => { oldSignal = signal!; return new Promise(resolve => { release = resolve; }); });
    const s = createNoteOrganizationSession({ host: f.host, agent: { prepare: f.prepare, cancel: f.cancel }, idleMs: 500, timeoutMs: 10000 }); s.update(f.current); await vi.advanceTimersByTimeAsync(500); s.setActive(true); s.update(f.current); await vi.advanceTimersByTimeAsync(600); expect(f.prepare).toHaveBeenCalledTimes(1);
    await s.reconnect(); expect(oldSignal.aborted).toBe(true); release(plan()); await vi.advanceTimersByTimeAsync(0); expect(f.host.commit).not.toHaveBeenCalled(); s.dispose();
    const g = fixture(); g.prepare.mockImplementation(async ({ snapshot }) => ({ ...plan(snapshot), placement: "ambiguous" })); const a = g.session(); a.subscribe(() => { throw new Error("observer"); }); a.update(g.current); await vi.advanceTimersByTimeAsync(500); expect(Object.isFrozen(a.getSnapshot().plan)).toBe(true); expect(() => { a.getSnapshot().plan!.title = "tamper"; }).toThrow(); a.dispose();
  });
  it("does not submit a cancelled slow journal or write after disposal", async () => {
    vi.useFakeTimers(); const f = fixture(); let journal!: () => void; f.host.beforeSubmit = async () => new Promise(resolve => { journal = resolve; }); const s = f.session(); s.update(f.current); await vi.advanceTimersByTimeAsync(500); await s.stop(); journal(); await vi.advanceTimersByTimeAsync(0); expect(f.host.commit).not.toHaveBeenCalled(); s.dispose(); await s.undo(); await s.reconnect(); expect(f.host.commit).not.toHaveBeenCalled();
  });
  it("retains nonterminal lookup recovery, requires a matching fenced operation, and aborts timed-out commits", async () => {
    vi.useFakeTimers(); const f = fixture(); let signal!: AbortSignal;
    f.host.commit = async (_r, abort) => { signal = abort; return new Promise(() => {}); };
    f.host.lookupOperation = async () => ({ status: "pending" }); const s = f.session(); s.update(f.current); await vi.advanceTimersByTimeAsync(600);
    expect(signal.aborted).toBe(true); const id = s.getRecovery()!.request.operationId; await s.reconcile(); expect(s.getRecovery()!.request.operationId).toBe(id);
    f.host.lookupOperation = async () => ({ status: "not-found", terminal: true, operationId: "wrong" }); await s.reconcile(); expect(s.getRecovery()).toBeDefined();
    f.host.lookupOperation = async () => ({ status: "not-found", terminal: true, operationId: id }); await s.reconcile(); expect(s.getRecovery()).toBeUndefined(); expect(s.getSnapshot().status).toBe("blocked"); s.dispose();
  });
  it("does not reopen a failed cancellation ACK during reconnect", async () => {
    vi.useFakeTimers(); const f = fixture(); f.prepare.mockImplementation(async () => new Promise(() => {})); f.cancel.mockImplementation(async () => { throw new Error("ACK failed"); });
    const s = createNoteOrganizationSession({ host: f.host, agent: { prepare: f.prepare, cancel: f.cancel }, idleMs: 500, timeoutMs: 10000 }); s.update(f.current); await vi.advanceTimersByTimeAsync(500); await s.reconnect(); await vi.advanceTimersByTimeAsync(2000);
    expect(s.getSnapshot().status).toBe("blocked"); expect(f.prepare).toHaveBeenCalledTimes(1); expect(f.host.commit).not.toHaveBeenCalled(); s.dispose();
  });
  it("waits for the canonical saved revision before preparing again and restores durable Undo after reload", async () => {
    vi.useFakeTimers(); const f = fixture(), s = f.session(), old = f.current; s.update(old); await vi.advanceTimersByTimeAsync(500); s.update(old); await vi.advanceTimersByTimeAsync(2000); expect(f.prepare).toHaveBeenCalledTimes(1);
    const history = [...f.receipts.values()][0]!; s.dispose();
    const restored = f.session(); restored.update(f.current); expect(restored.restoreUndo(history.request, history.receipt)).toBe(true); const count = f.prepare.mock.calls.length; await vi.advanceTimersByTimeAsync(1000); expect(f.prepare).toHaveBeenCalledTimes(count); await restored.undo(); expect(f.current.document).toEqual(initial().document); restored.dispose();
  });
  it("accepts bounded opaque CAS tokens including quoted ETags", () => {
    const s = initial(); s.revision = '\"ETag/abc+==\"'; s.hierarchyRevision = "tree/token+=="; s.pinRevision = "pin/token+==";
    expect(createOrganizationRequest(s, plan(s), "op").before.revision).toBe(s.revision);
  });

  it("a later stop wins over an earlier reconnect ACK and reconnect is single-flight", async () => {
    vi.useFakeTimers(); const f = fixture(); let ack!: () => void; f.cancel.mockImplementation(async () => new Promise(resolve => { ack = resolve; }));
    const s = f.session(); s.update(f.current); const reconnect = s.reconnect(); const duplicate = s.reconnect(); await s.stop(); expect(s.getSnapshot().status).toBe("off"); ack(); await reconnect; await duplicate; await vi.advanceTimersByTimeAsync(1000);
    expect(s.getSnapshot().status).toBe("off"); expect(f.cancel).toHaveBeenCalledTimes(1); expect(f.prepare).not.toHaveBeenCalled(); s.dispose();
  });

});
