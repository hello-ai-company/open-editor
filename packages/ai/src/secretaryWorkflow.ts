import { createEditorDocument, type EditorDocument } from "@hello-ai-company/editor-core";
import { createQuietCooperationSession, parseQuietPreparationContext, type QuietCooperationProvider, type QuietPreparationContext } from "./quietCooperation.js";
import { createDurableReviewCoordinator, type DurableReviewOutcome, type DurableReviewProvider } from "./durableReview.js";
import type { AcceptSuggestionDecision } from "./suggestions.js";

export type SecretaryWriteVerification = { outcome: DurableReviewOutcome; verification: "verified" | "superseded" | "unavailable" | "not-committed" };
function same(a: unknown, b: unknown): boolean {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, sort(x)])) : v;
  return JSON.stringify(sort(a)) === JSON.stringify(sort(b));
}
/** Secretary instruction → assigned agent preparation → explicit approval → CAS → read verification.
 * Provider-neutral; host owns authorization, real model quality, UI and canonical refresh.
 * After any write the preparation barrier stays closed until host refresh() confirms ready data.
 */
export function createSecretaryWorkflow(options: {
  provider: QuietCooperationProvider; writer: DurableReviewProvider;
  document: EditorDocument; context: QuietPreparationContext; agentId: string;
  idleMs?: number; maxRuns?: number; verificationTimeoutMs?: number;
}) {
  let context = parseQuietPreparationContext(options.context);
  let disposed = false, generation = 0;
  const assertOpen = (): void => { if (disposed) throw new Error("Secretary workflow is disposed"); };
  const timeoutMs = options.verificationTimeoutMs ?? 5000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) throw new Error("Invalid verification timeout");
  const quiet = createQuietCooperationSession({ ...options, purpose: context.instruction, ready: false });
  const review = createDurableReviewCoordinator(options.writer);
  const verify = async (outcome: DurableReviewOutcome, epoch: number): Promise<SecretaryWriteVerification> => {
    if (outcome.status !== "committed") return { outcome, verification: "not-committed" };
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const current = await Promise.race([Promise.resolve().then(() => options.writer.read(controller.signal)), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Verification timed out")); }, timeoutMs); })]);
      const safe = createEditorDocument(current.document.blocks, current.document.schemaVersion);
      if (disposed || generation !== epoch) return { outcome, verification: "unavailable" };
      return { outcome, verification: current.revision === outcome.snapshot.revision && same(safe, outcome.snapshot.document) ? "verified" : "superseded" };
    } catch { return { outcome, verification: "unavailable" }; }
    finally { clearTimeout(timer); }
  };
  return {
    quiet,
    getWriteState: review.getState,
    refresh: (document: EditorDocument, nextContext: QuietPreparationContext, ready: boolean): void => {
      assertOpen(); generation++;
      const next = parseQuietPreparationContext(nextContext);
      if (!ready || !same(context, next)) review.cancel();
      context = next; quiet.setReady(false); quiet.updateContext(next); quiet.updateDocument(document);
      quiet.setReady(ready && review.getState().status === "idle");
    },
    approve: async (decision: AcceptSuggestionDecision, changeIndexes?: readonly number[]): Promise<SecretaryWriteVerification> => {
      assertOpen();
      const proposal = quiet.takeForReview();
      if (!proposal?.context || !same(proposal.context, context)) throw new Error("No current context-bound proposal to approve");
      if (decision.source.agentId !== proposal.agentId || decision.source.runId !== proposal.runId) throw new Error("Approval must name the assigned agent and run");
      quiet.setReady(false);
      const epoch = generation;
      return verify(await review.accept(proposal.group, decision, { expectedRevision: proposal.context.revision, ...(changeIndexes ? { changeIndexes } : {}) }), epoch);
    },
    undo: async (): Promise<SecretaryWriteVerification> => { assertOpen(); quiet.setReady(false); const epoch = generation; return verify(await review.undo(), epoch); },
    reconcile: async (): Promise<SecretaryWriteVerification> => { assertOpen(); const epoch = generation; return verify(await review.reconcile(), epoch); },
    stop: async (): Promise<void> => { generation++; quiet.setReady(false); review.cancel(); await quiet.stop(); },
    dispose: (): void => { disposed = true; generation++; review.cancel(); quiet.dispose(); }
  };
}
