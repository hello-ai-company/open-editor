import { describe, expect, it, vi } from "vitest";
import { createReviewedDatabaseViewConfigProvider, type DatabaseViewConfigOperation, type DatabaseViewConfigReceipt, type DatabaseViewConfigReceiptPort } from "../src/workspace/databaseViewReceipts.js";
import { createDefaultDatabaseViewConfig, createDatabaseViewConfigWriter, persistDatabaseViewConfigIfAuthoritative } from "../src/workspace/databaseViewConfig.js";
const scope = { actorId: "synthetic", workspaceId: "views" };
const config = () => createDefaultDatabaseViewConfig({ databaseId: "db", viewId: "view", viewType: "map" });
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { resolve, promise }; };
function fixture() {
  let serial = 0, revision: string | null = null; const receipts = new Map<string, DatabaseViewConfigReceipt>();
  const commit = vi.fn<DatabaseViewConfigReceiptPort["commit"]>(async request => {
    if (request.expectedRevision !== revision) return { ...request, status: "conflict" };
    const receipt: DatabaseViewConfigReceipt = { scope, databaseId: request.databaseId, viewId: request.viewId, operationId: request.operationId, status: "committed", previousRevision: revision, revision: `r${++serial}`, receiptId: `receipt${serial}`, config: structuredClone(request.config) };
    revision = receipt.revision; receipts.set(request.operationId, receipt); return receipt;
  });
  const lookup = vi.fn<DatabaseViewConfigReceiptPort["lookup"]>(async request => receipts.get(request.operationId) ?? { ...request, status: "not-found", terminal: true });
  const before = vi.fn<DatabaseViewConfigReceiptPort["beforeSubmit"]>(async () => {});
  const port: DatabaseViewConfigReceiptPort = { scope, read: async request => ({ ...request, revision, config: revision ? config() : null }), commit, lookup, beforeSubmit: before };
  let id = 0; const make = (recoveries?: readonly DatabaseViewConfigOperation[]) => createReviewedDatabaseViewConfigProvider(port, { singleWriter: true, operationId: () => `op${++id}`, ...(recoveries ? { recoveries } : {}) });
  return { port, commit, before, lookup, receipts, make };
}
describe("opt-in scoped view settings receipt adapter", () => {
  it("isolates independent readers: A success cannot silently rebase B stale input", async () => {
    const f = fixture(), a = createReviewedDatabaseViewConfigProvider(f.port);
    const [one, two] = await Promise.all([a.provider.loadVersioned!("db", "view"), a.provider.loadVersioned!("db", "view")]);
    expect(one.version.readId).not.toBe(two.version.readId);
    await a.provider.saveVersioned!({ ...config(), query: "A" }, one.version);
    await expect(a.provider.saveVersioned!({ ...config(), query: "B" }, two.version)).rejects.toThrow(/conflict/);
    expect(f.commit.mock.calls[1]![0].expectedRevision).toBeNull();
    await a.provider.saveVersioned!({ ...config(), query: "A2" }, one.version);
    expect(f.commit.mock.calls[2]![0].expectedRevision).toBe("r1");
    await expect(a.provider.save!(config())).rejects.toThrow(/per-reader/);
    a.dispose();
  });
  it("queued independent writer failure stays visible and cannot clear retained input", async () => {
    const f = fixture(), a = createReviewedDatabaseViewConfigProvider(f.port);
    const [one,two] = await Promise.all([a.provider.loadVersioned!("db","view"),a.provider.loadVersioned!("db","view")]);
    const gate = deferred<void>(); f.before.mockImplementationOnce(() => gate.promise); f.commit.mockRejectedValueOnce(new Error("lost ACK"));
    const errorsA: (string | null)[] = [], errorsB: (string | null)[] = [];
    const writerA = createDatabaseViewConfigWriter(a.provider, e => errorsA.push(e), { version: () => one.version });
    const writerB = createDatabaseViewConfigWriter(a.provider, e => errorsB.push(e), { version: () => two.version });
    const first = persistDatabaseViewConfigIfAuthoritative("ready", writerA, {...config(),query:"A"});
    const second = persistDatabaseViewConfigIfAuthoritative("ready", writerB, {...config(),query:"B"});
    await vi.waitFor(() => expect(f.before).toHaveBeenCalled()); gate.resolve();
    expect(await first).toBe(false); expect(await second).toBe(false);
    expect(errorsA).toEqual(["lost ACK"]); expect(errorsB[0]).toMatch(/previous/);
    expect(a.getRecoveries()[0]?.config.query).toBe("A"); expect(f.commit).toHaveBeenCalledTimes(1);
    expect(await persistDatabaseViewConfigIfAuthoritative("ready",writerA,{...config(),query:"A"})).toBe(false);
    expect(f.lookup).toHaveBeenCalledTimes(1); expect(f.commit).toHaveBeenCalledTimes(1); a.dispose();
  });
  it("rejects foreign, forged and terminal reader versions without a submission", async () => {
    const f = fixture(), a = createReviewedDatabaseViewConfigProvider(f.port), b = createReviewedDatabaseViewConfigProvider(f.port);
    const original = await a.provider.loadVersioned!("db","view");
    await b.provider.loadVersioned!("db","view");
    await expect(a.provider.saveVersioned!(config(),{...original.version,revision:"forged"})).rejects.toThrow(/revision/);
    // Read IDs belong to an adapter instance, not a public global sequence.
    await expect(b.provider.saveVersioned!(config(),original.version)).rejects.toThrow(/revision/);
    expect(f.commit).not.toHaveBeenCalled(); a.dispose(); b.dispose();
  });
  it("coalesces concurrent reads so a later stale read cannot reopen a terminal gate", async () => {
    const f = fixture(), a = f.make(), gate = deferred<Awaited<ReturnType<DatabaseViewConfigReceiptPort['read']>>>(), read = vi.spyOn(f.port, "read").mockImplementationOnce(() => gate.promise);
    const first = a.provider.load!("db", "view"), second = a.provider.load!("db", "view"); await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1)); gate.resolve({ scope, databaseId: "db", viewId: "view", revision: null, config: null }); await Promise.all([first, second]);
    f.commit.mockImplementationOnce(async r => ({ scope, databaseId: "db", viewId: "view", operationId: r.operationId, status: "conflict" })); await expect(a.provider.save!(config())).rejects.toThrow(); await expect(a.provider.save!(config())).rejects.toThrow(/revision/); expect(f.commit).toHaveBeenCalledTimes(1); expect(read).toHaveBeenCalledTimes(1); a.dispose();
  });
  it("load result is detached for every coalesced reader", async () => { const f = fixture(), a = f.make(); f.port.read = async r => ({ ...r, revision: "r1", config: config() }); const [one,two] = await Promise.all([a.provider.load!("db","view"),a.provider.load!("db","view")]); (one as ReturnType<typeof config>).query = "external"; expect((two as ReturnType<typeof config>).query).toBe(""); a.dispose(); });

  it("requires an authoritative read and prepares a durable ticket before CAS commit", async () => { const f = fixture(), a = f.make(); await expect(a.provider.save!(config())).rejects.toThrow(/revision/); expect(f.commit).not.toHaveBeenCalled(); await a.provider.load!("db", "view"); await a.provider.save!(config()); expect(f.before).toHaveBeenCalledTimes(1); expect(f.commit.mock.calls[0]![0].expectedRevision).toBeNull(); expect(a.getRecoveries()).toEqual([]); a.dispose(); });
  it("failed ticket never submits", async () => { const f = fixture(), a = f.make(); await a.provider.load!("db", "view"); f.before.mockRejectedValueOnce(new Error("disk failed")); await expect(a.provider.save!(config())).rejects.toThrow(/disk/); expect(f.commit).not.toHaveBeenCalled(); expect(a.getRecoveries()).toEqual([]); a.dispose(); });
  it("lost ACK Retry is GET lookup, never resend, then advances expected revision", async () => { const f = fixture(), a = f.make(); await a.provider.load!("db", "view"); const real = f.commit.getMockImplementation()!; f.commit.mockImplementationOnce(async (request, signal) => { await real(request, signal); throw new Error("lost ACK"); }); await expect(a.provider.save!(config())).rejects.toThrow(/lost/); expect(a.getRecoveries()).toHaveLength(1); await a.provider.save!(config()); expect(f.lookup).toHaveBeenCalledTimes(1); expect(f.commit).toHaveBeenCalledTimes(1); await a.provider.save!({ ...config(), query: "next" }); expect(f.commit.mock.calls[1]![0].expectedRevision).toBe("r1"); a.dispose(); });
  it("different input remains fenced while operation outcome is unknown", async () => { const f = fixture(), a = f.make(); await a.provider.load!("db", "view"); f.commit.mockRejectedValueOnce(new Error("lost")); await expect(a.provider.save!(config())).rejects.toThrow(); await expect(a.provider.save!({ ...config(), query: "human" })).rejects.toThrow(/previous/); await expect(a.provider.load!("db", "view")).rejects.toThrow(/retained/); expect(f.commit).toHaveBeenCalledTimes(1); a.dispose(); });
  it("restored recovery reconciles before UI load without submission", async () => { const f = fixture(), a = f.make(); await a.provider.load!("db", "view"); const real = f.commit.getMockImplementation()!; f.commit.mockImplementationOnce(async (r, s) => { await real(r, s); throw new Error("lost"); }); await expect(a.provider.save!(config())).rejects.toThrow(); const recovery = a.getRecoveries(); a.dispose(); const b = f.make(recovery); expect((await b.reconcile("db", "view")).status).toBe("committed"); expect(f.commit).toHaveBeenCalledTimes(1); expect(b.getRecoveries()).toEqual([]); b.dispose(); });
  it.each(["scope", "view", "operation", "config", "revision", "previous", "receipt"])("retains recovery on mismatched %s evidence", async field => { const f = fixture(), a = f.make(); await a.provider.load!("db", "view"); const real = f.commit.getMockImplementation()!; f.commit.mockImplementationOnce(async (r, s) => { const valid = await real(r, s); if (valid.status !== "committed") throw new Error(); return { ...valid, ...(field === "scope" ? { scope: { ...scope, actorId: "foreign" } } : field === "view" ? { viewId: "foreign" } : field === "operation" ? { operationId: "other" } : field === "config" ? { config: { ...r.config, query: "unreviewed" } } : field === "revision" ? { revision: r.expectedRevision ?? "" } : field === "previous" ? { previousRevision: "other" } : { receiptId: "" }) }; }); await expect(a.provider.save!(config())).rejects.toThrow(); expect(a.getRecoveries()).toHaveLength(1); a.dispose(); });
  it.each(["conflict", "denied", "rejected", "not-found"] as const)("terminal %s clears ticket but requires fresh read before another save", async status => { const f = fixture(), a = f.make(); await a.provider.load!("db", "view"); f.commit.mockImplementationOnce(async r => ({ scope, databaseId: "db", viewId: "view", operationId: r.operationId, status, ...(status === "not-found" ? { terminal: true as const } : {}) } as DatabaseViewConfigReceipt)); await expect(a.provider.save!(config())).rejects.toThrow(); expect(a.getRecoveries()).toEqual([]); await expect(a.provider.save!(config())).rejects.toThrow(/revision/); expect(f.commit).toHaveBeenCalledTimes(1); a.dispose(); });
  it("concurrent save, read and reconcile cannot replace an in-flight ticket", async () => { const f = fixture(), a = f.make(); await a.provider.load!("db", "view"); const gate = deferred<void>(); f.before.mockImplementationOnce(() => gate.promise); const first = a.provider.save!(config()); await vi.waitFor(() => expect(f.before).toHaveBeenCalled()); await expect(a.provider.save!(config())).rejects.toThrow(/running/); await expect(a.reconcile("db", "view")).rejects.toThrow(/idle/); await expect(a.provider.load!("db", "view")).rejects.toThrow(/retained/); gate.resolve(); await first; expect(f.commit).toHaveBeenCalledTimes(1); a.dispose(); });
  it("dispose while ticket waits prevents submission", async () => { const f = fixture(), a = f.make(); await a.provider.load!("db", "view"); const gate = deferred<void>(); f.before.mockImplementationOnce(() => gate.promise); const first = a.provider.save!(config()); await vi.waitFor(() => expect(f.before).toHaveBeenCalled()); a.dispose(); gate.resolve(); await expect(first).rejects.toThrow(); expect(f.commit).not.toHaveBeenCalled(); });
  it("host/provider mutation cannot alter retained ticket", async () => { const f = fixture(), a = f.make(); await a.provider.load!("db", "view"); f.commit.mockImplementationOnce(async request => { request.config.query = "host mutation"; throw new Error("lost"); }); const value = config(); await expect(a.provider.save!(value)).rejects.toThrow(); value.query = "human mutation"; const recovery = a.getRecoveries(); expect(recovery[0]?.config.query).toBe(""); recovery[0]!.config.query = "external"; expect(a.getRecoveries()[0]?.config.query).toBe(""); a.dispose(); });
});
