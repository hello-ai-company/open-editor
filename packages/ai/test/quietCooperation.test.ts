import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createQuietCooperationSession, type QuietCooperationProvider } from "../src/quietCooperation.js";
const doc = (text = "Human writing") => createEditorDocument([{ id: "p", type: "paragraph", content: text }]);
const result = (document: ReturnType<typeof doc>) => ({ hypothesis: "A next paragraph might help. Does that match?", group: { schemaVersion: 1, id: crypto.randomUUID(), title: "Hypothesis", baseDocument: document, changes: [{ op: "insert", block: { id: crypto.randomUUID(), type: "paragraph", content: "Proposed" } }] } });
function setup(provider?: QuietCooperationProvider, extra: Record<string, number> = {}) {
  vi.useFakeTimers();
  const mock = provider ?? { prepare: vi.fn(async request => result(request.document)), cancel: vi.fn(async () => {}) };
  const session = createQuietCooperationSession({ provider: mock, document: doc(), agentId: "mock-agent", purpose: "Offer a next paragraph for human review", idleMs: 1000, ...extra });
  return { session, provider: mock };
}
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
describe("quiet cooperation", () => {
  it("keeps a ready proposal on repeated active and enable notifications", async () => {
    const { session, provider } = setup(); session.enable(); await vi.advanceTimersByTimeAsync(1000);
    const ready = session.getSnapshot(); session.setActive(true); session.enable();
    await vi.advanceTimersByTimeAsync(5000); expect(session.getSnapshot()).toBe(ready);
    expect(provider.prepare).toHaveBeenCalledTimes(1); expect(ready.enabled).toBe(true); session.dispose();
  });
  it("keeps failed cancellation blocked through further stop, visibility and composition events", async () => {
    const provider = { prepare: vi.fn(() => new Promise<ReturnType<typeof result>>(() => {})), cancel: vi.fn(async () => { throw new Error("lost acknowledgement"); }) };
    const { session } = setup(provider); session.enable(); await vi.advanceTimersByTimeAsync(1000); await session.stop();
    expect(session.getSnapshot().enabled).toBe(false); expect(session.getSnapshot().status).toBe("blocked");
    await session.stop(); session.setActive(false); session.compositionStart(); session.compositionEnd(); session.setActive(true); session.enable();
    await vi.advanceTimersByTimeAsync(3000); expect(session.getSnapshot().status).toBe("blocked");
    expect(session.getSnapshot().message).toContain("could not be confirmed"); expect(provider.cancel).toHaveBeenCalledTimes(1); expect(provider.prepare).toHaveBeenCalledTimes(1); session.dispose();
  });
  it("exposes opt-in state and retains verified failure information after a stop acknowledgement", async () => {
    const provider = { prepare: vi.fn(async () => { throw new Error("provider failed"); }), cancel: vi.fn(async () => {}) };
    const { session } = setup(provider); expect(session.getSnapshot().enabled).toBe(false); session.enable(); expect(session.getSnapshot().enabled).toBe(true);
    await vi.advanceTimersByTimeAsync(1000); expect(session.getSnapshot().enabled).toBe(false); expect(session.getSnapshot().status).toBe("off"); expect(session.getSnapshot().message).toContain("could not be verified"); session.dispose();
  });
  it("requires opt-in and a complete idle window, never writes before permission", async () => {
    const { session, provider } = setup(); await vi.advanceTimersByTimeAsync(2000); expect(provider.prepare).not.toHaveBeenCalled();
    session.enable(); await vi.advanceTimersByTimeAsync(700); session.updateDocument(doc("Still typing")); await vi.advanceTimersByTimeAsync(999); expect(provider.prepare).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(provider.prepare).toHaveBeenCalledTimes(1); expect(session.getSnapshot().status).toBe("ready");
    expect(session.getSnapshot().proposal!.group.baseDocument).toEqual(doc("Still typing"));
    const proposal = session.takeForReview()!; proposal.group.baseDocument.blocks[0]!.content = "Mutated caller";
    expect(session.getSnapshot().proposal).toBeUndefined(); session.dispose();
  });
  it("reports opt-in immediately even when preparation is suppressed", async () => {
    const { session, provider } = setup(); session.setActive(false); session.enable();
    expect(session.getSnapshot().enabled).toBe(true); await vi.advanceTimersByTimeAsync(2000); expect(provider.prepare).not.toHaveBeenCalled();
    session.setActive(true); session.compositionStart(); await session.stop(); session.enable(); expect(session.getSnapshot().enabled).toBe(true);
    await vi.advanceTimersByTimeAsync(2000); expect(provider.prepare).not.toHaveBeenCalled(); session.dispose();
  });
  it("suppresses proposals during IME composition and waits after composition end", async () => {
    const { session, provider } = setup(); session.compositionStart(); session.enable(); session.updateDocument(doc("変換中"));
    await vi.advanceTimersByTimeAsync(3000); expect(provider.prepare).not.toHaveBeenCalled(); expect(session.takeForReview()).toBeUndefined();
    session.compositionEnd(); await vi.advanceTimersByTimeAsync(999); expect(provider.prepare).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(session.getSnapshot().status).toBe("ready"); session.dispose();
  });
  it("respects rejection until a new human document change", async () => {
    const { session, provider } = setup(); session.enable(); await vi.advanceTimersByTimeAsync(1000); session.dismiss();
    await vi.advanceTimersByTimeAsync(5000); expect(provider.prepare).toHaveBeenCalledTimes(1);
    session.setActive(false); session.setActive(true); await vi.advanceTimersByTimeAsync(1500); expect(provider.prepare).toHaveBeenCalledTimes(1);
    session.updateDocument(doc("New human intent")); await vi.advanceTimersByTimeAsync(1000); expect(provider.prepare).toHaveBeenCalledTimes(2); session.dispose();
  });
  it("invalidates ready proposals immediately when the human edits", async () => {
    const { session } = setup(); session.enable(); await vi.advanceTimersByTimeAsync(1000); session.updateDocument(doc("Changed"));
    expect(session.getSnapshot().proposal).toBeUndefined(); expect(session.takeForReview()).toBeUndefined(); session.dispose();
  });
  it("waits for cancellation acknowledgement and ignores a late result", async () => {
    let resolveRun!: (value: ReturnType<typeof result>) => void, acknowledge!: () => void;
    const provider = { prepare: vi.fn(() => new Promise<ReturnType<typeof result>>(resolve => { resolveRun = resolve; })), cancel: vi.fn(() => new Promise<void>(resolve => { acknowledge = resolve; })) };
    const { session } = setup(provider); session.enable(); await vi.advanceTimersByTimeAsync(1000); session.updateDocument(doc("Human intervention"));
    await vi.advanceTimersByTimeAsync(1000); expect(provider.prepare).toHaveBeenCalledTimes(1); expect(session.getSnapshot().status).toBe("stopping");
    resolveRun(result(doc())); acknowledge(); await vi.advanceTimersByTimeAsync(0);
    expect(session.getSnapshot().proposal).toBeUndefined(); expect(session.getSnapshot().status).toBe("idle"); session.dispose();
  });
  it("blocks future runs when cancellation cannot be confirmed", async () => {
    const provider = { prepare: vi.fn(() => new Promise<ReturnType<typeof result>>(() => {})), cancel: vi.fn(() => new Promise<void>(() => {})) };
    const { session } = setup(provider, { cancellationTimeoutMs: 1000 }); session.enable(); await vi.advanceTimersByTimeAsync(1000); const stopped = session.stop();
    await vi.advanceTimersByTimeAsync(1000); await stopped; expect(session.getSnapshot().status).toBe("blocked"); session.enable(); session.updateDocument(doc("New text")); await vi.advanceTimersByTimeAsync(3000); expect(provider.prepare).toHaveBeenCalledTimes(1); session.dispose();
  });
  it("stops preparation while inactive and on bounded run timeout", async () => {
    const { session, provider } = setup(); session.enable(); session.setActive(false); await vi.advanceTimersByTimeAsync(2000); expect(provider.prepare).not.toHaveBeenCalled();
    session.setActive(true); await vi.advanceTimersByTimeAsync(1000); expect(provider.prepare).toHaveBeenCalledTimes(1); session.dispose();
    const hung = { prepare: vi.fn(() => new Promise<ReturnType<typeof result>>(() => {})), cancel: vi.fn(async () => {}) }, second = setup(hung, { runTimeoutMs: 1000 });
    second.session.enable(); await vi.advanceTimersByTimeAsync(2000); expect(hung.cancel).toHaveBeenCalledTimes(1); expect(second.session.getSnapshot().status).toBe("off"); second.session.dispose();
  });
  it("bounds context and execution; rejects schema downgrades", async () => {
    const { session, provider } = setup(undefined, { maxRuns: 1 }); session.enable(); await vi.advanceTimersByTimeAsync(1000); session.updateDocument(doc("Next")); await vi.advanceTimersByTimeAsync(2000); expect(session.getSnapshot().status).toBe("limit"); expect(provider.prepare).toHaveBeenCalledTimes(1); session.dispose();
    const large = setup(undefined, { maxContextBytes: 1000 }); large.session.updateDocument(doc("x".repeat(2000))); large.session.enable(); await vi.advanceTimersByTimeAsync(1000); expect(large.provider.prepare).not.toHaveBeenCalled(); expect(large.session.getSnapshot().status).toBe("blocked"); large.session.dispose();
    expect(() => createQuietCooperationSession({ provider, document: { ...doc(), schemaVersion: 2 }, agentId: "agent", purpose: "purpose" })).toThrow();
  });
});
