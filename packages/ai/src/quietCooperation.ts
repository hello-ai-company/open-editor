import { createEditorDocument, type EditorDocument } from "@hello-ai-company/editor-core";
import { parseSuggestionGroup, type SuggestionGroup } from "./suggestions.js";
import { cloneJsonValue, requireExactKeys, requireRecord, requireString, requireStringArray } from "./validation.js";

/** Host-curated context only. Archives, database rows and credentials do not belong here. */
export type QuietPreparationContext = { documentId: string; revision: string; secretaryId: string; instruction: string; selectionBlockIds: string[] };
export function parseQuietPreparationContext(value: unknown): QuietPreparationContext {
  const context = requireRecord(cloneJsonValue(value, "context"), "context");
  requireExactKeys(context, ["documentId", "revision", "secretaryId", "instruction", "selectionBlockIds"], "context");
  return { documentId: requireString(context.documentId, "documentId", 512), revision: requireString(context.revision, "revision", 512), secretaryId: requireString(context.secretaryId, "secretaryId", 256), instruction: requireString(context.instruction, "instruction", 2000), selectionBlockIds: requireStringArray(context.selectionBlockIds, "selectionBlockIds") };
}

export type QuietCooperationStatus = "off" | "idle" | "preparing" | "ready" | "stopping" | "blocked" | "limit";
export type QuietProposal = { runId: string; agentId: string; purpose: string; hypothesis: string; group: SuggestionGroup; context?: QuietPreparationContext };
export type QuietCooperationSnapshot = { status: QuietCooperationStatus; enabled: boolean; composing: boolean; runsUsed: number; proposal?: QuietProposal; message: string };
export type QuietCooperationProvider = {
  prepare(request: { runId: string; agentId: string; purpose: string; document: EditorDocument; context?: QuietPreparationContext; signal: AbortSignal }): Promise<{ hypothesis: string; group: unknown }>;
  /** Resolve only when execution has stopped. A missing acknowledgement blocks another run. */
  cancel(runId: string): Promise<void>;
};
export type QuietCooperationSession = {
  getSnapshot(): QuietCooperationSnapshot;
  subscribe(listener: () => void): () => void;
  enable(): void;
  stop(): Promise<void>;
  updateDocument(document: EditorDocument): void;
  updateContext(context: QuietPreparationContext): void;
  /** False during reconnect, pending/unknown writes, or before canonical data is loaded. */
  setReady(ready: boolean): void;
  setActive(active: boolean): void;
  compositionStart(): void;
  compositionEnd(): void;
  dismiss(): void;
  /** A detached candidate for explicit review; this API never writes a document. */
  takeForReview(): QuietProposal | undefined;
  dispose(): void;
};
function key(value: unknown): string {
  const normalize = (item: unknown): unknown => Array.isArray(item) ? item.map(normalize) : item && typeof item === "object" ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, entry]) => [name, normalize(entry)])) : item;
  return JSON.stringify(normalize(value));
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { for (const nested of Object.values(value)) freeze(nested); Object.freeze(value); }
  return value;
}

/** Quiet idle-time hypotheses. Explicit opt-in, bounded preparation, no writing or tool execution. */
export function createQuietCooperationSession(options: {
  provider: QuietCooperationProvider;
  document: EditorDocument;
  agentId: string;
  purpose: string;
  context?: QuietPreparationContext;
  ready?: boolean;
  idleMs?: number;
  maxRuns?: number;
  maxContextBytes?: number;
  cancellationTimeoutMs?: number;
  runTimeoutMs?: number;
}): QuietCooperationSession {
  for (const [name, value, min, max] of [
    ["idleMs", options.idleMs ?? 1200, 500, 5000], ["maxRuns", options.maxRuns ?? 6, 1, 12],
    ["maxContextBytes", options.maxContextBytes ?? 16000, 1000, 64000], ["cancellationTimeoutMs", options.cancellationTimeoutMs ?? 5000, 1000, 30000], ["runTimeoutMs", options.runTimeoutMs ?? 30000, 1000, 120000]
  ] as const) if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
  if (!options.agentId.trim() || options.agentId.length > 256 || !options.purpose.trim() || options.purpose.length > 2000) throw new Error("Agent and purpose must be bounded and explicit");
  let document = createEditorDocument(options.document.blocks, options.document.schemaVersion), documentKey = key(document), enabled = false, active = true, composing = false, disposed = false, runsUsed = 0;
  let context = options.context === undefined ? undefined : parseQuietPreparationContext(options.context), ready = options.ready ?? true;
  let contextKey = key(context);
  let timer: ReturnType<typeof setTimeout> | undefined, proposal: QuietProposal | undefined, dismissedKey: string | undefined;
  let running: { runId: string; controller: AbortController; cancelled: boolean; cancellation?: Promise<void> } | undefined;
  let status: QuietCooperationStatus = "off", message = "", snapshot: QuietCooperationSnapshot;
  const listeners = new Set<() => void>();
  const emit = (): void => { snapshot = freeze(structuredClone({ status, enabled, composing, runsUsed, ...(proposal ? { proposal } : {}), message })); if (!disposed) for (const listener of listeners) listener(); };
  const clear = (): void => { clearTimeout(timer); timer = undefined; };
  const schedule = (): void => {
    clear();
    if (disposed || !enabled || !active || !ready || composing || running || proposal || status === "blocked" || dismissedKey === documentKey + contextKey) return;
    if (runsUsed >= (options.maxRuns ?? 6)) { status = "limit"; message = "Preparation limit reached"; emit(); return; }
    status = "idle"; message = ""; emit();
    timer = setTimeout(() => { timer = undefined; void prepare(); }, options.idleMs ?? 1200);
  };
  const interrupt = async (): Promise<void> => {
    clear(); proposal = undefined;
    if (status === "blocked") { emit(); return; }
    const run = running;
    if (!run) { status = enabled ? "idle" : "off"; emit(); return; }
    run.cancelled = true; run.controller.abort(); status = "stopping"; emit();
    run.cancellation ??= (async () => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([Promise.resolve().then(() => options.provider.cancel(run.runId)), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Cancellation acknowledgement missing")), options.cancellationTimeoutMs ?? 5000); })]);
        if (running === run) running = undefined;
        if ((status as QuietCooperationStatus) !== "blocked") { status = enabled ? "idle" : "off"; if (enabled) message = ""; emit(); schedule(); }
      } catch { enabled = false; status = "blocked"; message = "Cancellation could not be confirmed; no new preparation will start"; emit(); }
      finally { clearTimeout(timeout); }
    })();
    await run.cancellation;
  };
  const prepare = async (): Promise<void> => {
    if (!enabled || !active || !ready || composing || disposed || running || status === "blocked") return;
    const base = createEditorDocument(document.blocks, document.schemaVersion), baseKey = documentKey;
    const baseContext = context === undefined ? undefined : structuredClone(context), baseContextKey = contextKey;
    if (new TextEncoder().encode(JSON.stringify({ document: base, context: baseContext })).byteLength > (options.maxContextBytes ?? 16000)) { enabled = false; status = "blocked"; message = "Context exceeds the preparation budget; nothing was sent"; emit(); return; }
    const run = { runId: crypto.randomUUID(), controller: new AbortController(), cancelled: false };
    running = run; runsUsed++; status = "preparing"; emit();
    // A synchronous UI listener may stop immediately after the state announcement.
    if (disposed || run.cancelled || !enabled || running !== run) return;
    const watchdog = setTimeout(() => { if (running === run && !run.cancelled) { enabled = false; message = "Preparation timed out; the document is unchanged"; void interrupt(); } }, options.runTimeoutMs ?? 30000);
    try {
      const purpose = baseContext?.instruction ?? options.purpose;
      const result = await options.provider.prepare({ runId: run.runId, agentId: options.agentId, purpose, document: base, ...(baseContext ? { context: structuredClone(baseContext) } : {}), signal: run.controller.signal });
      if (disposed || run.cancelled || !enabled || !active || !ready || composing || running !== run || baseKey !== documentKey || baseContextKey !== contextKey) return;
      if (!result || typeof result.hypothesis !== "string" || !result.hypothesis.trim() || result.hypothesis.length > 1000) throw new Error("Invalid hypothesis");
      const group = parseSuggestionGroup(result.group);
      if (key(group.baseDocument) !== baseKey) throw new Error("Proposal base mismatch");
      proposal = { runId: run.runId, agentId: options.agentId, purpose, hypothesis: result.hypothesis, group, ...(baseContext ? { context: baseContext } : {}) };
      running = undefined; status = "ready"; message = "Hypothesis ready for your review"; emit();
    } catch {
      if (run.cancelled || disposed || running !== run) return;
      enabled = false; message = "Preparation could not be verified; the document is unchanged";
      await interrupt();
    } finally { clearTimeout(watchdog); }
  };
  emit();
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    enable: () => { if (disposed || enabled || status === "blocked") return; enabled = true; dismissedKey = undefined; if (status === "off") status = "idle"; emit(); schedule(); },
    stop: async () => { enabled = false; if (status !== "blocked") message = ""; await interrupt(); },
    updateDocument: next => {
      if (disposed) return;
      const safe = createEditorDocument(next.blocks, next.schemaVersion), nextKey = key(safe);
      if (nextKey === documentKey) return;
      document = safe; documentKey = nextKey; proposal = undefined; dismissedKey = undefined;
      if (!running && status !== "blocked") { status = enabled ? "idle" : "off"; emit(); }
      if (running) void interrupt(); else schedule();
    },
    setActive: value => { if (active === value) return; active = value; if (!active) void interrupt(); else schedule(); },
    setReady: value => { if (ready === value || disposed) return; ready = value; if (!ready) void interrupt(); else schedule(); },
    updateContext: value => {
      if (disposed) return;
      const next = parseQuietPreparationContext(value), nextKey = key(next);
      if (nextKey === contextKey) return;
      context = next; contextKey = nextKey; dismissedKey = undefined;
      void interrupt().then(schedule);
    },
    compositionStart: () => { composing = true; void interrupt(); },
    compositionEnd: () => { composing = false; emit(); schedule(); },
    dismiss: () => { dismissedKey = documentKey + contextKey; proposal = undefined; clear(); if (!running && status !== "blocked") status = enabled ? "idle" : "off"; emit(); },
    takeForReview: () => {
      if (status !== "ready" || !proposal || composing || !active || !ready || !enabled) return undefined;
      const selected = structuredClone(proposal); dismissedKey = documentKey + contextKey; proposal = undefined; status = "idle"; emit(); return selected;
    },
    dispose: () => { disposed = true; enabled = false; listeners.clear(); void interrupt(); }
  };
}
