import { createEditorDocument, type EditorDocument } from "@hello-ai-company/editor-core";
import { acceptSuggestionGroup, parseSuggestionGroup, type AcceptSuggestionDecision, type AcceptedSuggestionChange } from "./suggestions.js";

export type ReviewedDocumentSnapshot = { revision: string; document: EditorDocument };
export type ReviewedCommitRequest = {
  operationId: string;
  expectedRevision: string;
  beforeDocument: EditorDocument;
  document: EditorDocument;
  kind: "accept" | "undo";
  acceptedChange?: AcceptedSuggestionChange;
  undoOperationId?: string;
};
export type ReviewedCommitReceipt = { status: "committed"; operationId: string; snapshot: ReviewedDocumentSnapshot };
export type ReviewedCommitResult = ReviewedCommitReceipt | { status: "conflict" | "denied"; operationId: string };
/** Commit must atomically persist document, CAS revision, history/provenance and idempotency receipt.
 * Server authorization is mandatory. A browser authorization hook is only an early UI check.
 */
export type DurableReviewProvider = {
  read(signal: AbortSignal): Promise<ReviewedDocumentSnapshot>;
  commit(request: ReviewedCommitRequest, signal: AbortSignal): Promise<ReviewedCommitResult>;
  lookupOperation(operationId: string): Promise<ReviewedCommitResult | { status: "unknown"; operationId: string }>;
  authorize?(request: ReviewedCommitRequest, signal: AbortSignal): Promise<boolean>;
};
export type DurableReviewOutcome = ReviewedCommitResult | { status: "stale" | "cancelled" | "unknown"; operationId: string };
export type DurableReviewState = { status: "idle" | "pending" | "unknown"; operationId?: string };
export type DurableReviewCoordinator = {
  getState(): DurableReviewState;
  accept(group: unknown, decision: AcceptSuggestionDecision, options?: { changeIndexes?: readonly number[]; expectedRevision?: string }): Promise<DurableReviewOutcome>;
  undo(): Promise<DurableReviewOutcome>;
  cancel(): void;
  reconcile(): Promise<DurableReviewOutcome>;
};
function equal(a: unknown, b: unknown): boolean {
  const sort = (value: unknown): unknown => Array.isArray(value) ? value.map(sort) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k,v]) => [k, sort(v)])) : value;
  return JSON.stringify(sort(a)) === JSON.stringify(sort(b));
}
function snapshot(value: ReviewedDocumentSnapshot): ReviewedDocumentSnapshot {
  if (!value || typeof value.revision !== "string" || !value.revision || value.revision.length > 512) throw new Error("Host revision is required");
  return { revision: value.revision, document: createEditorDocument(value.document.blocks, value.document.schemaVersion) };
}

/** One in-flight review. Unknown acknowledgements are reconciled, never blindly retried. */
export function createDurableReviewCoordinator(provider: DurableReviewProvider, options: { operationId?: () => string; timeoutMs?: number } = {}): DurableReviewCoordinator {
  const timeoutMs = options.timeoutMs ?? 10000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) throw new Error("Invalid review timeout");
  const bounded = async <T>(work: () => Promise<T>, abort?: AbortController): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([Promise.resolve().then(work), new Promise<never>((_, reject) => { timer = setTimeout(() => { abort?.abort(); reject(new Error("Review acknowledgement timed out")); }, timeoutMs); })]); }
    finally { clearTimeout(timer); }
  };
  let state: DurableReviewState = { status: "idle" }, controller: AbortController | undefined;
  let unresolved: ReviewedCommitRequest | undefined, lastAccepted: { request: ReviewedCommitRequest; receipt: ReviewedCommitReceipt } | undefined;
  const idFactory = options.operationId ?? (() => crypto.randomUUID());
  const settle = (request: ReviewedCommitRequest, result: ReviewedCommitResult): ReviewedCommitResult => {
    if (result.operationId !== request.operationId || !["committed", "conflict", "denied"].includes(result.status)) throw new Error("Invalid host operation receipt");
    if (result.status === "committed") {
      const committed = snapshot(result.snapshot);
      if (committed.revision === request.expectedRevision || !equal(committed.document, request.document)) throw new Error("Host receipt does not match the reviewed commit");
      const receipt: ReviewedCommitReceipt = { status: "committed", operationId: result.operationId, snapshot: committed };
      lastAccepted = request.kind === "accept" ? { request, receipt: structuredClone(receipt) } : undefined;
      state = { status: "idle" }; unresolved = undefined; controller = undefined;
      return receipt;
    }
    state = { status: "idle" }; unresolved = undefined; controller = undefined;
    return { status: result.status, operationId: result.operationId };
  };
  const execute = async (prepare: (current: ReviewedDocumentSnapshot, operationId: string) => ReviewedCommitRequest | undefined): Promise<DurableReviewOutcome> => {
    if (state.status !== "idle") throw new Error("Resolve the pending/unknown review before starting another");
    const operationId = idFactory();
    if (!operationId || operationId.length > 512) throw new Error("Invalid review operation id");
    const localController = new AbortController(); controller = localController; state = { status: "pending", operationId };
    let submitted = false, request: ReviewedCommitRequest | undefined;
    try {
      const current = snapshot(await bounded(() => provider.read(localController.signal), localController));
      if (localController.signal.aborted) { state = { status: "idle" }; return { status: "cancelled", operationId }; }
      request = prepare(current, operationId);
      if (!request) { state = { status: "idle" }; return { status: "stale", operationId }; }
      // A provider receives a detached request so it cannot modify the coordinator's approved data.
      if (provider.authorize && !await bounded(() => provider.authorize!(structuredClone(request!), localController.signal), localController)) { state = { status: "idle" }; return { status: "denied", operationId }; }
      if (localController.signal.aborted) { state = { status: "idle" }; return { status: "cancelled", operationId }; }
      unresolved = request; submitted = true;
      return settle(request, await bounded(() => provider.commit(structuredClone(request!), localController.signal), localController));
    } catch (error) {
      if (submitted) { state = { status: "unknown", operationId }; return { status: "unknown", operationId }; }
      state = { status: "idle" }; controller = undefined;
      if (localController.signal.aborted) return { status: "cancelled", operationId };
      throw error;
    } finally { if (state.status === "idle") controller = undefined; }
  };
  return {
    getState: () => ({ ...state }),
    accept: (payload, decision, acceptance) => {
      // Parse/copy before asynchronous work: callers cannot mutate an approval while waiting.
      let group = parseSuggestionGroup(payload);
      const acceptedDecision = structuredClone(decision);
      const expectedRevision = acceptance?.expectedRevision;
      if (expectedRevision !== undefined && (typeof expectedRevision !== "string" || !expectedRevision || expectedRevision.length > 512)) throw new Error("Invalid proposal revision");
      if (acceptance?.changeIndexes) {
        const indexes = [...acceptance.changeIndexes];
        if (!indexes.length || new Set(indexes).size !== indexes.length || indexes.some(index => !Number.isInteger(index) || index < 0 || index >= group.changes.length)) throw new Error("Invalid partial acceptance indexes");
        // Keep original dependency order and validate the subset against its complete base.
        const selected = new Set(indexes);
        group = parseSuggestionGroup({ ...group, changes: group.changes.filter((_, index) => selected.has(index)) });
      }
      return execute((current, operationId) => {
        if (expectedRevision !== undefined && current.revision !== expectedRevision) return undefined;
        const result = acceptSuggestionGroup(group, current.document, acceptedDecision);
        if (result.status === "stale") return undefined;
        return { operationId, expectedRevision: current.revision, beforeDocument: current.document, document: result.document, kind: "accept", acceptedChange: result.acceptedChange };
      });
    },
    undo: () => {
      const accepted = lastAccepted;
      if (!accepted) throw new Error("No committed reviewed change to undo");
      return execute((current, operationId) => current.revision !== accepted.receipt.snapshot.revision || !equal(current.document, accepted.request.document) ? undefined : {
        operationId, expectedRevision: current.revision, beforeDocument: current.document, document: createEditorDocument(accepted.request.beforeDocument.blocks), kind: "undo", undoOperationId: accepted.request.operationId
      });
    },
    cancel: () => controller?.abort(),
    reconcile: async () => {
      if (state.status !== "unknown" || !unresolved) throw new Error("No unknown operation to reconcile");
      const request = unresolved;
      // Prevent two concurrent lookups from clearing or settling a different operation.
      state = { status: "pending", operationId: request.operationId };
      try {
        const result = await bounded(() => provider.lookupOperation(request.operationId));
        if (result.status === "unknown") return { status: "unknown", operationId: request.operationId };
        return settle(request, result);
      } catch { return { status: "unknown", operationId: request.operationId }; }
      finally { if (unresolved) state = { status: "unknown", operationId: request.operationId }; }
    }
  };
}
