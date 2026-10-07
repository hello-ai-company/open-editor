import { describe, expect, it } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createDurableReviewCoordinator, type DurableReviewProvider, type ReviewedCommitRequest, type ReviewedCommitResult } from "../src/durableReview.js";
const base = () => createEditorDocument([{ id: "a", type: "paragraph", content: "Human original" }, { id: "b", type: "paragraph", content: "Keep me" }]);
const proposal = () => ({ schemaVersion: 1, id: "proposal", title: "Review edits", baseDocument: base(), changes: [{ op: "replace", blockId: "a", block: { id: "a", type: "paragraph", content: "AI edit" } }, { op: "replace", blockId: "b", block: { id: "b", type: "paragraph", content: "Second AI edit" } }] });
const decision = { acceptedBy: "human", acceptedAt: "2026-10-06T20:00:00.000Z", source: { agentId: "mock-agent", runId: "mock-run", generatedAt: "2026-10-06T19:00:00.000Z" } };
function host() {
  let current = { revision: "1", document: base() }, counter = 1;
  const history: ReviewedCommitRequest[] = [], receipts = new Map<string, ReviewedCommitResult>();
  const provider: DurableReviewProvider = {
    read: async () => structuredClone(current),
    commit: async request => {
      if (request.expectedRevision !== current.revision) return { status: "conflict", operationId: request.operationId };
      if (receipts.has(request.operationId)) return receipts.get(request.operationId)!;
      current = { revision: String(++counter), document: structuredClone(request.document) };
      history.push(structuredClone(request));
      const receipt: ReviewedCommitResult = { status: "committed", operationId: request.operationId, snapshot: structuredClone(current) }; receipts.set(request.operationId, receipt); return receipt;
    },
    lookupOperation: async id => receipts.get(id) ?? { status: "unknown", operationId: id }
  };
  let ids = 0;
  return { provider, history, get: () => current, humanEdit: () => { current = { revision: String(++counter), document: createEditorDocument([{ id: "a", type: "paragraph", content: "New human edit" }, { id: "b", type: "paragraph", content: "Keep me" }]) }; }, coordinator: () => createDurableReviewCoordinator(provider, { operationId: () => `operation-${++ids}` }) };
}
describe("durable explicit review", () => {
  it("persists selected changes and provenance atomically; Undo creates its own CAS history record", async () => {
    const server = host(), review = server.coordinator();
    expect((await review.accept(proposal(), decision, { changeIndexes: [0] })).status).toBe("committed");
    expect(server.get().document.blocks.map(b => b.content)).toEqual(["AI edit", "Keep me"]);
    expect(server.history[0]!.acceptedChange!.provenance.acceptedBy).toBe("human");
    expect((await review.undo()).status).toBe("committed");
    expect(server.get().document).toEqual(base());
    expect(server.history[1]).toMatchObject({ kind: "undo", undoOperationId: "operation-1" });
  });
  it("does not overwrite human changes before acceptance or Undo", async () => {
    const server = host(), review = server.coordinator(); server.humanEdit();
    expect((await review.accept(proposal(), decision)).status).toBe("stale"); expect(server.history).toHaveLength(0);
    const second = host(), another = second.coordinator(); await another.accept(proposal(), decision); second.humanEdit();
    expect((await another.undo()).status).toBe("stale"); expect(second.history).toHaveLength(1);
  });
  it("resolves a lost acknowledgement without a second commit and then permits Undo", async () => {
    const server = host(), commit = server.provider.commit;
    server.provider.commit = async (...args) => { await commit(...args); throw new Error("Acknowledgement lost"); };
    const review = server.coordinator();
    expect((await review.accept(proposal(), decision)).status).toBe("unknown");
    await expect(review.accept(proposal(), decision)).rejects.toThrow(/pending\/unknown/);
    expect((await review.reconcile()).status).toBe("committed");
    expect(server.history).toHaveLength(1); expect(review.getState().status).toBe("idle");
  });
  it("does not invent success from an absent or mismatched receipt", async () => {
    const server = host(); server.provider.commit = async () => { throw new Error("Transport lost"); };
    const review = server.coordinator(); await review.accept(proposal(), decision);
    expect((await review.reconcile()).status).toBe("unknown");
    server.provider.lookupOperation = async () => ({ status: "denied", operationId: "another-operation" });
    expect((await review.reconcile()).status).toBe("unknown"); expect(review.getState().status).toBe("unknown");
  });
  it("rejects permissions before writing and respects server CAS denial", async () => {
    const server = host(); server.provider.authorize = async () => false;
    expect((await server.coordinator().accept(proposal(), decision)).status).toBe("denied"); expect(server.history).toHaveLength(0);
    server.provider.authorize = async () => { server.humanEdit(); return true; };
    expect((await server.coordinator().accept(proposal(), decision)).status).toBe("conflict"); expect(server.history).toHaveLength(0);
  });
  it("cancels while awaiting authorization and blocks repeated clicks", async () => {
    const server = host(); let allow!: (value: boolean) => void;
    server.provider.authorize = () => new Promise(resolve => { allow = resolve; });
    const review = server.coordinator(), pending = review.accept(proposal(), decision);
    await Promise.resolve(); await Promise.resolve();
    await expect(review.accept(proposal(), decision)).rejects.toThrow(/pending/);
    review.cancel(); allow(true);
    expect((await pending).status).toBe("cancelled"); expect(server.history).toHaveLength(0);
  });
  it("copies the approved payload before asynchronous host work and rejects malformed subsets", async () => {
    const server = host(), review = server.coordinator(), group = proposal();
    const pending = review.accept(group, decision); group.changes[0]!.block.content = "Mutated caller";
    expect((await pending).status).toBe("committed"); expect(server.get().document.blocks[0]!.content).toBe("AI edit");
    expect(() => review.accept(proposal(), decision, { changeIndexes: [0, 0] })).toThrow();
  });
  it("keeps the internal Undo receipt separate from the returned mutable receipt", async () => {
    const server = host(), review = server.coordinator(), result = await review.accept(proposal(), decision);
    server.humanEdit();
    if (result.status !== "committed") throw new Error("Expected commit");
    result.snapshot.revision = server.get().revision;
    expect((await review.undo()).status).toBe("stale"); expect(server.history).toHaveLength(1);
  });
  it("compares distinct Unicode JSON keys with a total order", async () => {
    const server = host(), original = server.provider.commit;
    const group = proposal(); (group.changes[0]!.block as { props?: Record<string, unknown> }).props = { "é": 1, "é": 2 };
    server.provider.commit = async (...args) => {
      const receipt = await original(...args);
      if (receipt.status === "committed") receipt.snapshot.document.blocks[0]!.props = { "é": 2, "é": 1 };
      return receipt;
    };
    expect((await server.coordinator().accept(group, decision)).status).toBe("committed");
  });
});
