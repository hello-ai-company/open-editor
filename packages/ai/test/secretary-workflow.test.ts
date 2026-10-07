import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createSecretaryWorkflow } from "../src/secretaryWorkflow.js";
import { createQuietCooperationSession } from "../src/quietCooperation.js";
import { createDurableReviewCoordinator, type ReviewedCommitResult } from "../src/durableReview.js";
const document = createEditorDocument([{ id: "p", type: "paragraph", content: "日本語の計画" }]);
const context = { documentId: "note", revision: "r1", secretaryId: "secretary", instruction: "選択した計画の確認項目を提案", selectionBlockIds: ["p"] };
const proposal = { schemaVersion: 1, id: "idea", title: "Contextual", baseDocument: document, changes: [{ op: "insert", block: { id: "ai", type: "paragraph", content: "確認項目" } }] };
const decision = { acceptedBy: "human", acceptedAt: "2026-10-06T20:00:00.000Z", source: { agentId: "assigned", runId: "run", generatedAt: "2026-10-06T19:00:00.000Z" } };
afterEach(() => vi.useRealTimers());
describe("secretary context and durability", () => {
  it("cannot label a late commit verified for a changed instruction or start writes after disposal", async () => {
    vi.useFakeTimers(); let current = { revision: "r1", document }, request!: { operationId: string; document: typeof document }, settle!: (value: ReviewedCommitResult) => void;
    const commit = vi.fn(async r => { request = r; return new Promise<ReviewedCommitResult>(resolve => { settle = resolve; }); });
    const workflow = createSecretaryWorkflow({ document, context, agentId: "assigned", idleMs: 500, provider: { prepare: async () => ({ hypothesis: "確認", group: proposal }), cancel: async () => {} }, writer: { read: async () => current, commit, lookupOperation: vi.fn() } });
    workflow.refresh(document, context, true); workflow.quiet.enable(); await vi.advanceTimersByTimeAsync(500);
    const ready = workflow.quiet.getSnapshot().proposal!, pending = workflow.approve({ ...decision, source: { ...decision.source, runId: ready.runId } });
    await vi.advanceTimersByTimeAsync(0); workflow.refresh(document, { ...context, instruction: "別の指示" }, false);
    current = { revision: "r2", document: request.document }; settle({ status: "committed", operationId: request.operationId, snapshot: current });
    expect((await pending).verification).toBe("unavailable"); workflow.dispose();
    await expect(workflow.undo()).rejects.toThrow(/disposed/); expect(() => workflow.refresh(document, context, true)).toThrow(/disposed/); expect(commit).toHaveBeenCalledTimes(1);
  });
  it("rejects an ABA revision even when the complete document equals the old base", async () => {
    const commit = vi.fn();
    const coordinator = createDurableReviewCoordinator({ read: async () => ({ revision: "r3", document }), commit, lookupOperation: vi.fn() });
    expect((await coordinator.accept(proposal, decision, { expectedRevision: "r1" })).status).toBe("stale"); expect(commit).not.toHaveBeenCalled();
  });
  it("invalidates ready context on revision or selection change, and suppresses reconnect preparation", async () => {
    vi.useFakeTimers(); const prepare = vi.fn(async () => ({ hypothesis: "文脈に合う確認", group: proposal }));
    const session = createQuietCooperationSession({ provider: { prepare, cancel: async () => {} }, document, context, agentId: "assigned", purpose: context.instruction, idleMs: 500 });
    session.enable(); await vi.advanceTimersByTimeAsync(500); expect(session.getSnapshot().proposal!.context).toEqual(context);
    session.updateContext({ ...context, revision: "r3", selectionBlockIds: [] }); expect(session.takeForReview()).toBeUndefined();
    session.setReady(false); await vi.advanceTimersByTimeAsync(5000); expect(prepare).toHaveBeenCalledTimes(1);
    session.setReady(true); await vi.advanceTimersByTimeAsync(500); expect(prepare).toHaveBeenCalledTimes(2); session.dispose();
  });
  it("runs instruction-to-assigned-agent-to-approved-write verification and keeps a refresh barrier", async () => {
    vi.useFakeTimers(); let current = { revision: "r1", document }, writes = 0;
    const workflow = createSecretaryWorkflow({ document, context, agentId: "assigned", idleMs: 500, provider: { prepare: async request => { expect(request.context!.instruction).toBe(context.instruction); return { hypothesis: "計画の確認", group: proposal }; }, cancel: async () => {} }, writer: { read: async () => structuredClone(current), commit: async r => { writes++; current = { revision: `r${writes+1}`, document: r.document }; return { status: "committed", operationId: r.operationId, snapshot: current }; }, lookupOperation: vi.fn() } });
    workflow.quiet.enable(); await vi.advanceTimersByTimeAsync(1000); expect(workflow.quiet.getSnapshot().proposal).toBeUndefined();
    workflow.refresh(document, context, true); await vi.advanceTimersByTimeAsync(500);
    const ready = workflow.quiet.getSnapshot().proposal!;
    const approved = await workflow.approve({ ...decision, source: { ...decision.source, runId: ready.runId } });
    expect(approved.verification).toBe("verified"); expect(writes).toBe(1);
    await vi.advanceTimersByTimeAsync(2000); expect(workflow.quiet.getSnapshot().proposal).toBeUndefined();
    expect((await workflow.undo()).verification).toBe("verified"); workflow.dispose();
  });
  it("distinguishes a committed receipt from failed read-back verification", async () => {
    vi.useFakeTimers(); let reads = 0;
    const workflow = createSecretaryWorkflow({ document, context, agentId: "assigned", idleMs: 500, provider: { prepare: async () => ({ hypothesis: "確認", group: proposal }), cancel: async () => {} }, writer: { read: async () => { if (++reads > 1) throw new Error("Offline"); return { revision: "r1", document }; }, commit: async r => ({ status: "committed", operationId: r.operationId, snapshot: { revision: "r2", document: r.document } }), lookupOperation: vi.fn() } });
    workflow.refresh(document, context, true); workflow.quiet.enable(); await vi.advanceTimersByTimeAsync(500); const ready = workflow.quiet.getSnapshot().proposal!;
    const result = await workflow.approve({ ...decision, source: { ...decision.source, runId: ready.runId } });
    expect(result.outcome.status).toBe("committed"); expect(result.verification).toBe("unavailable"); workflow.dispose();
  });
  it("bounds pending commits, waits for reconciliation and never resubmits", async () => {
    vi.useFakeTimers(); const commit = vi.fn(() => new Promise<ReviewedCommitResult>(() => {}));
    const coordinator = createDurableReviewCoordinator({ read: async () => ({ revision: "r1", document }), commit, lookupOperation: async operationId => ({ status: "unknown", operationId }) }, { timeoutMs: 100 });
    const pending = coordinator.accept(proposal, decision, { expectedRevision: "r1" }); await vi.advanceTimersByTimeAsync(100);
    expect((await pending).status).toBe("unknown"); expect((await coordinator.reconcile()).status).toBe("unknown"); expect(commit).toHaveBeenCalledTimes(1);
  });
  it("does not prepare through 1000 continuous Japanese edits/selection changes (virtual time)", async () => {
    vi.useFakeTimers(); const prepare = vi.fn(async () => ({ hypothesis: "確認", group: proposal }));
    const session = createQuietCooperationSession({ document, context, agentId: "assigned", purpose: "確認", idleMs: 500, provider: { prepare, cancel: async () => {} } }); session.enable(); session.compositionStart();
    for (let i = 0; i < 1000; i++) { session.updateDocument(createEditorDocument([{ id: "p", type: "paragraph", content: `変換${i}` }])); session.updateContext({ ...context, revision: `r${i}` }); await vi.advanceTimersByTimeAsync(100); }
    expect(prepare).not.toHaveBeenCalled(); session.compositionEnd(); session.setReady(false); await vi.advanceTimersByTimeAsync(10000); expect(prepare).not.toHaveBeenCalled(); session.dispose();
  });
});
