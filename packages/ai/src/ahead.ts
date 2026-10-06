import type { EditorDocument } from "@hello-ai-company/editor-core";
import { parseAgentDescriptor, parseAgentRequest, parseAgentRunEvent, type AgentAdapter } from "./agent.js";
import { acceptSuggestionGroup, parseSuggestionGroup, type SuggestionGroup } from "./suggestions.js";
import { AIContractValidationError, parseEditorDocument, requireString } from "./validation.js";

export type AheadPhase = "outline" | "research" | "draft";
export type AheadStatus = "idle" | "working" | "waiting" | "paused" | "stopping" | "cancelled" | "limit" | "failed" | "blocked";
export type AheadProposal = Readonly<{
  group: SuggestionGroup;
  phase: AheadPhase;
  runId: string;
  generatedAt: string;
  revision: number;
}>;
export type AheadSnapshot = Readonly<{
  status: AheadStatus;
  goal: string;
  direction: string;
  directions: readonly string[];
  revision: number;
  runsUsed: number;
  maxRuns: number;
  phase: AheadPhase;
  prepared: readonly AheadPhase[];
  proposals: readonly AheadProposal[];
  message: string;
  canUndo: boolean;
}>;

/** A synchronous, host-owned compare-and-swap. Return true only after committing.
 * Remote hosts must perform their own durable approval/CAS before exposing a local
 * commit; an async writer is deliberately not accepted by this contract.
 */
export type AheadDocumentWriter = (expected: EditorDocument, next: EditorDocument) => boolean;

export interface AheadSession {
  getSnapshot(): AheadSnapshot;
  subscribe(listener: () => void): () => void;
  start(goal: string): void;
  refine(direction: string): void;
  updateDocument(document: EditorDocument): void;
  pause(): Promise<void>;
  resume(): void;
  cancel(): Promise<void>;
  reject(proposalId: string): void;
  adopt(proposalId: string, indices: readonly number[], current: EditorDocument, writer: AheadDocumentWriter, actorId: string): void;
  undo(current: EditorDocument, writer: AheadDocumentWriter): void;
  dispose(): void;
}

const PHASES: readonly AheadPhase[] = ["outline", "research", "draft"];
type ActiveRun = {
  id: string;
  revision: number;
  base: EditorDocument;
  interrupted: boolean;
  cancellation?: Promise<void>;
};

/** Bounded look-ahead orchestration; never executes tools, persists, or writes by itself.
 * The supplied adapter owns model execution, authorization and billing. cancel()
 * must resolve only when that execution has stopped. Missing acknowledgement blocks
 * further execution. Document edits invalidate proposals, not the human document.
 */
export function createAheadSession(options: {
  adapter: AgentAdapter;
  document: EditorDocument;
  maxRuns?: number;
  maxPending?: number;
  debounceMs?: number;
  runTimeoutMs?: number;
  cancellationTimeoutMs?: number;
  maxRequestBytes?: number;
  maxProposalBytes?: number;
}): AheadSession {
  const maxRuns = boundedInteger(options.maxRuns ?? 6, 1, 12, "maxRuns");
  const maxPending = boundedInteger(options.maxPending ?? 2, 1, 3, "maxPending");
  const debounceMs = boundedInteger(options.debounceMs ?? 500, 0, 5000, "debounceMs");
  const runTimeoutMs = boundedInteger(options.runTimeoutMs ?? 30000, 1000, 120000, "runTimeoutMs");
  const cancellationTimeoutMs = boundedInteger(options.cancellationTimeoutMs ?? 10000, 1000, 30000, "cancellationTimeoutMs");
  const maxRequestBytes = boundedInteger(options.maxRequestBytes ?? 16000, 1000, 64000, "maxRequestBytes");
  const maxProposalBytes = boundedInteger(options.maxProposalBytes ?? 64000, 1000, 256000, "maxProposalBytes");
  const descriptor = parseAgentDescriptor(options.adapter.descriptor);
  let document = parseEditorDocument(options.document);
  let documentKey = fingerprint(document);
  let revision = 0;
  let goal = "";
  let direction = "";
  let directions: string[] = [];
  const seenProposalIds = new Set<string>();
  let runsUsed = 0;
  let phaseIndex = 0;
  let prepared: AheadPhase[] = [];
  let proposals: AheadProposal[] = [];
  let status: AheadStatus = "idle";
  let message = "";
  let intended = false;
  let disposed = false;
  let cancellationRequested = false;
  let stopSerial = 0;
  let active: ActiveRun | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let undoReceipt: { before: EditorDocument; afterKey: string } | undefined;
  const listeners = new Set<() => void>();
  const sessionId = crypto.randomUUID();
  let runSerial = 0;
  let snapshot: AheadSnapshot;

  function emit() {
    snapshot = deepFreeze(structuredClone({ status, goal, direction, directions, revision, runsUsed, maxRuns,
      phase: PHASES[phaseIndex % PHASES.length]!, prepared, proposals, message,
      canUndo: Boolean(undoReceipt && undoReceipt.afterKey === documentKey) }));
    if (!disposed) for (const listener of listeners) listener();
  }
  function clearTimer() { clearTimeout(timer); timer = undefined; }
  function schedule() {
    clearTimer();
    if (disposed || !intended || active) return;
    if (runsUsed >= maxRuns) { status = "limit"; message = "Execution limit reached."; emit(); return; }
    if (proposals.length >= maxPending) { status = "waiting"; message = "Ready for your review."; emit(); return; }
    status = "working";
    emit();
    timer = setTimeout(() => { timer = undefined; void execute(); }, debounceMs);
  }
  async function interrupt(finalStatus: AheadStatus): Promise<void> {
    const serial = ++stopSerial;
    clearTimer();
    const run = active;
    if (!run) { status = cancellationRequested ? "cancelled" : finalStatus; emit(); return; }
    run.interrupted = true;
    status = "stopping"; emit();
    if (!run.cancellation) {
      run.cancellation = (async () => {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            Promise.resolve().then(() => options.adapter.cancel(run.id)),
            new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Cancellation was not acknowledged.")), cancellationTimeoutMs); })
          ]);
          if (active === run) active = undefined;
        } catch {
          intended = false;
          status = "blocked";
          message = "Cancellation could not be confirmed. No further execution will start.";
          throw new AIContractValidationError(message);
        } finally { clearTimeout(timeout); emit(); }
      })();
    }
    try { await run.cancellation; }
    catch { return; }
    if (disposed || snapshot.status === "blocked" || serial !== stopSerial) return;
    status = cancellationRequested ? "cancelled" : finalStatus;
    emit();
    if (intended) schedule();
  }
  function fail(text: string) { intended = false; status = "failed"; message = text; clearTimer(); emit(); }
  async function execute() {
    if (disposed || !intended || active || runsUsed >= maxRuns || proposals.length >= maxPending) return;
    const phase = PHASES[phaseIndex % PHASES.length]!;
    const run: ActiveRun = { id: `${sessionId}.${++runSerial}`, revision, base: structuredClone(document), interrupted: false };
    // Quoted document text cannot become task instructions, capabilities or consent.
    let request;
    try {
      request = parseAgentRequest({ runId: run.id, instruction: directions.length ? `${goal}\nUser directions:\n${directions.map((value, index) => `${index + 1}. ${value}`).join("\n")}` : goal,
        context: [{ id: "current-document", kind: "document", trust: "untrusted", text: JSON.stringify(run.base) }],
        metadata: { phase, documentRevision: revision, preparedPhases: prepared, remainingRuns: maxRuns - runsUsed - 1,
          reviewRequired: true, toolsAllowed: false, direction, directions, previousProposalTitles: proposals.map(item => item.group.title) } });
      if (new TextEncoder().encode(JSON.stringify(request)).byteLength > maxRequestBytes) {
        throw new AIContractValidationError("The document exceeds this adapter's context limit; nothing was sent.");
      }
    } catch (error) { fail(error instanceof Error ? error.message : "Context validation failed."); return; }
    active = run;
    runsUsed++;
    message = "Preparing the next proposal.";
    emit();
    // A synchronous subscriber can stop or edit while the new run is announced.
    // Never invoke execution after that stop, even before the first event arrives.
    if (disposed || run.interrupted || active !== run || !intended) return;
    const watchdog = setTimeout(() => {
      if (active !== run || run.interrupted) return;
      intended = false;
      message = "Execution timed out. Review or resume explicitly.";
      void interrupt("failed");
    }, runTimeoutMs);
    let group: SuggestionGroup | undefined;
    let generatedAt = "";
    let lastSequence = -1;
    let completed = false;
    let count = 0;
    try {
      for await (const raw of options.adapter.start(request)) {
        if (disposed || run.interrupted || active !== run) return;
        if (++count > 256) throw new AIContractValidationError("Too many agent events.");
        const event = parseAgentRunEvent(raw);
        if (event.runId !== run.id || event.sequence <= lastSequence) throw new AIContractValidationError("Agent event identity or order did not match.");
        lastSequence = event.sequence;
        if (event.type === "error") throw new AIContractValidationError("The agent could not complete this run.");
        if (event.type === "message") { message = event.message; emit(); }
        if (event.type === "suggestion") {
          if (group) throw new AIContractValidationError("Only one proposal group is allowed per run.");
          group = parseSuggestionGroup(event.payload);
          if (new TextEncoder().encode(JSON.stringify(group)).byteLength > maxProposalBytes) throw new AIContractValidationError("Proposal exceeds the review size limit.");
          if (fingerprint(group.baseDocument) !== fingerprint(run.base)) throw new AIContractValidationError("Proposal base did not match the requested document.");
          generatedAt = event.occurredAt;
        }
        if (event.type === "status") {
          if (event.status === "failed" || event.status === "cancelled") throw new AIContractValidationError("The agent did not complete this run.");
          if (event.status === "completed") { completed = true; break; }
        }
      }
      if (disposed || run.interrupted || active !== run) return;
      if (!completed || !group) throw new AIContractValidationError("The agent ended without a completed, validated proposal.");
      if (seenProposalIds.has(group.id)) throw new AIContractValidationError("Duplicate proposal identity.");
      if (revision !== run.revision) return;
      seenProposalIds.add(group.id);
      proposals = [...proposals, { group, phase, runId: run.id, generatedAt, revision }];
      prepared = [...new Set([...prepared, phase])];
      phaseIndex++;
      active = undefined;
      schedule();
    } catch {
      if (disposed || run.interrupted || active !== run) return;
      intended = false;
      message = "The run could not be verified. No proposal from it was applied.";
      await interrupt("failed");
    } finally { clearTimeout(watchdog); }
  }
  function setDocument(value: EditorDocument) {
    const parsed = parseEditorDocument(value);
    const key = fingerprint(parsed);
    if (key === documentKey) return false;
    document = parsed; documentKey = key; revision++;
    proposals = []; prepared = []; phaseIndex = 0;
    message = "Document changed; preparing from the current version.";
    emit();
    return true;
  }
  function requireUsable() { if (disposed) throw new AIContractValidationError("Session is disposed."); }
  emit();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    start(value) {
      requireUsable();
      if (active || intended || proposals.length || status === "blocked") throw new AIContractValidationError("Stop and resolve the current work before starting another goal.");
      goal = requireString(value, "goal", 4000);
      stopSerial++; cancellationRequested = false;
      runsUsed = 0; phaseIndex = 0; prepared = []; direction = ""; directions = []; message = ""; seenProposalIds.clear();
      intended = true; schedule();
    },
    refine(value) {
      requireUsable();
      if (!goal || cancellationRequested || status === "blocked") throw new AIContractValidationError("This session cannot accept a new direction.");
      direction = requireString(value, "direction", 3000);
      directions = [...directions, direction];
      while (directions.length > 5 || directions.join("\n").length > 3000) directions.shift();
      proposals = []; prepared = []; phaseIndex = 0;
      message = "Direction changed; preparing a new plan within the existing limit.";
      emit();
      if (active && !active.interrupted) void interrupt(intended ? "working" : "paused");
      else schedule();
    },
    updateDocument(value) {
      requireUsable();
      if (!setDocument(value)) return;
      if (active && !active.interrupted) void interrupt(intended ? "working" : "paused");
      else schedule();
    },
    async pause() {
      requireUsable(); intended = false;
      if (status === "blocked" || cancellationRequested) return;
      await interrupt("paused");
    },
    resume() {
      requireUsable();
      if (active || status === "blocked" || cancellationRequested || status === "idle" || runsUsed >= maxRuns || !goal) throw new AIContractValidationError("This session cannot resume.");
      intended = true; schedule();
    },
    async cancel() {
      requireUsable(); intended = false; cancellationRequested = true; proposals = []; prepared = [];
      if (status === "blocked") { emit(); return; }
      await interrupt("cancelled");
    },
    reject(id) {
      requireUsable();
      if (!proposals.some(item => item.group.id === id)) throw new AIContractValidationError("Proposal is unavailable.");
      proposals = proposals.filter(item => item.group.id !== id); schedule(); emit();
    },
    adopt(id, indices, current, writer, actorId) {
      requireUsable();
      const proposal = proposals.find(item => item.group.id === id);
      if (!proposal || proposal.revision !== revision) throw new AIContractValidationError("Proposal is no longer current.");
      if (!indices.length || new Set(indices).size !== indices.length || indices.some(index => !Number.isInteger(index) || index < 0 || index >= proposal.group.changes.length)) throw new AIContractValidationError("Select valid, unique changes.");
      const selected = parseSuggestionGroup({ ...proposal.group, changes: indices.map(index => proposal.group.changes[index]) });
      const result = acceptSuggestionGroup(selected, current, { acceptedBy: actorId, acceptedAt: new Date().toISOString(),
        source: { agentId: descriptor.id, runId: proposal.runId, generatedAt: proposal.generatedAt } });
      if (result.status !== "accepted" || fingerprint(parseEditorDocument(current)) !== documentKey) throw new AIContractValidationError("Human edits changed the document. Prepare a fresh proposal.");
      const before = parseEditorDocument(current);
      if (writer(structuredClone(before), structuredClone(result.document)) !== true) throw new AIContractValidationError("The host did not commit the reviewed change.");
      setDocument(result.document);
      // Adoption advances the work rather than endlessly regenerating the outline.
      phaseIndex = Math.min(PHASES.indexOf(proposal.phase) + 1, PHASES.length - 1);
      prepared = [proposal.phase];
      undoReceipt = { before, afterKey: documentKey };
      if (active && !active.interrupted) void interrupt(intended ? "working" : "paused");
      else schedule();
      emit();
    },
    undo(current, writer) {
      requireUsable();
      if (!undoReceipt || fingerprint(parseEditorDocument(current)) !== undoReceipt.afterKey) throw new AIContractValidationError("Later edits prevent this undo; your document is kept.");
      const restored = structuredClone(undoReceipt.before);
      if (writer(parseEditorDocument(current), restored) !== true) throw new AIContractValidationError("The host did not commit undo.");
      undoReceipt = undefined; setDocument(restored);
      if (active && !active.interrupted) void interrupt(intended ? "working" : "paused");
      else schedule();
      emit();
    },
    dispose() {
      if (disposed) return;
      intended = false; clearTimer(); listeners.clear();
      void interrupt("cancelled"); disposed = true;
    }
  };
}

function boundedInteger(value: number, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new AIContractValidationError(`${label} must be between ${min} and ${max}.`);
  return value;
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
/** Called only after bounded document validation; object key order is not an edit. */
function fingerprint(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(",")}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => `${JSON.stringify(key)}:${fingerprint(child)}`).join(",")}}`;
}
