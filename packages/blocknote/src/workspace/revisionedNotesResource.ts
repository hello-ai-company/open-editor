import type { JsonValue } from "@hello-ai-company/editor-core";
import { copyLegacyNotesJson } from "../document/legacyNotes.js";

export type NotesResourceSnapshot = { revision: string; value: JsonValue };
export type NotesResourceChange = { kind: "patch"; fields: Record<string, JsonValue> } | { kind: "create"; value: JsonValue } | { kind: "delete" };
export type NotesResourceRequest = { resourceId: string; operationId: string; expectedRevision: string; change: NotesResourceChange };
export type NotesResourceResult = { status: "committed"; resourceId: string; operationId: string; snapshot: NotesResourceSnapshot } | { status: "conflict" | "denied" | "unknown"; resourceId: string; operationId: string };
export type NotesResourceOutcome = NotesResourceResult | { status: "cancelled"; resourceId: string; operationId: string };
/** The host atomically authorizes, CASes, patches only named fields and stores an idempotent receipt.
 * DB rows remain provider-owned. Do not implement patch as replacement of a cached full row.
 */
export type RevisionedNotesResourceProvider = {
  commit(request: NotesResourceRequest, signal: AbortSignal): Promise<NotesResourceResult>;
  lookupOperation(resourceId: string, operationId: string): Promise<NotesResourceResult>;
};
export type NotesResourceRecovery = { version: 1; request: NotesResourceRequest };
export type RevisionedNotesResourceEditor = {
  subscribe(listener: () => void): () => void;
  getState(): { status: "idle" | "pending" | "unknown"; operationId?: string };
  commit(expectedRevision: string, change: NotesResourceChange): Promise<NotesResourceOutcome>;
  cancel(): void;
  reconcile(): Promise<NotesResourceResult>;
  getRecovery(): NotesResourceRecovery | undefined;
};
const reserved = new Set(["__proto__", "constructor", "prototype"]);
function equal(a: unknown, b: unknown): boolean {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, sort(x)])) : v;
  return JSON.stringify(sort(a)) === JSON.stringify(sort(b));
}
function text(value: unknown): string { if (typeof value !== "string" || !value || value.length > 512) throw new Error("Invalid resource identity/revision"); return value; }
function request(value: unknown): NotesResourceRequest {
  const raw = copyLegacyNotesJson(value) as unknown as NotesResourceRequest;
  if (!raw || Array.isArray(raw) || Object.keys(raw).some(k => !["resourceId", "operationId", "expectedRevision", "change"].includes(k))) throw new Error("Invalid resource request");
  text(raw.resourceId); text(raw.operationId); text(raw.expectedRevision);
  const c = raw.change;
  if (!c || Array.isArray(c) || typeof c !== "object") throw new Error("Invalid change");
  if (c.kind === "patch") {
    if (Object.keys(c).some(k => k !== "kind" && k !== "fields") || !c.fields || typeof c.fields !== "object" || Array.isArray(c.fields) || !Object.keys(c.fields).length || Object.keys(c.fields).length > 64 || Object.keys(c.fields).some(k => !k || k.length > 128 || reserved.has(k))) throw new Error("Invalid field patch");
  } else if (c.kind === "create") {
    if (!Object.hasOwn(c, "value") || Object.keys(c).some(k => k !== "kind" && k !== "value")) throw new Error("Invalid create");
  } else if (c.kind !== "delete" || Object.keys(c).some(k => k !== "kind")) throw new Error("Invalid change kind");
  return raw;
}
/** Single-flight writes with bounded waiting and durable recovery across reconnect/reload.
 * Recovery tickets are host-private bookkeeping, never evidence of permission or success.
 */
export function createRevisionedNotesResourceEditor(provider: RevisionedNotesResourceProvider, options: { resourceId: string; timeoutMs?: number; recovery?: NotesResourceRecovery; operationId?: () => string; beforeSubmit?: (recovery: NotesResourceRecovery, signal: AbortSignal) => Promise<void> }): RevisionedNotesResourceEditor {
  const resourceId = text(options.resourceId), timeoutMs = options.timeoutMs ?? 10000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) throw new Error("Invalid write timeout");
  let status: "idle" | "pending" | "unknown" = "idle", unresolved: NotesResourceRequest | undefined, controller: AbortController | undefined;
  const listeners = new Set<() => void>();
  const notify = (): void => { for (const listener of listeners) { try { listener(); } catch { /* UI observers cannot change a persistence outcome. */ } } };
  if (options.recovery) {
    const recovery = copyLegacyNotesJson(options.recovery) as unknown as NotesResourceRecovery;
    if (recovery.version !== 1 || Object.keys(recovery).some(k => k !== "version" && k !== "request")) throw new Error("Invalid recovery version");
    unresolved = request(recovery.request);
    if (unresolved.resourceId !== resourceId) throw new Error("Recovery resource mismatch"); status = "unknown";
  }
  const unknown = (): NotesResourceResult => ({ status: "unknown", resourceId, operationId: unresolved!.operationId });
  const settle = (result: NotesResourceResult): NotesResourceResult => {
    const safe = copyLegacyNotesJson(result) as unknown as NotesResourceResult;
    if (!safe || safe.resourceId !== resourceId || safe.operationId !== unresolved!.operationId || !["committed", "conflict", "denied", "unknown"].includes(safe.status)) throw new Error("Mismatched resource receipt");
    if (safe.status === "committed") {
      text(safe.snapshot.revision);
      if (safe.snapshot.revision === unresolved!.expectedRevision || !Object.hasOwn(safe.snapshot, "value")) throw new Error("Invalid committed revision");
      const change = unresolved!.change, value = safe.snapshot.value;
      if (change.kind === "patch" && (!value || typeof value !== "object" || Array.isArray(value) || Object.entries(change.fields).some(([key, field]) => !Object.hasOwn(value, key) || !equal(value[key], field)))) throw new Error("Receipt did not persist the reviewed fields");
      if (change.kind === "create" && !equal(change.value, value) || change.kind === "delete" && value !== null) throw new Error("Receipt did not persist the reviewed creation/deletion");
    }
    if (safe.status !== "unknown") { unresolved = undefined; controller = undefined; status = "idle"; }
    return safe;
  };
  const bounded = async (work: Promise<NotesResourceResult>): Promise<NotesResourceResult> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Unconfirmed write")), timeoutMs); })]); }
    finally { clearTimeout(timer); }
  };
  return {
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getState: () => ({ status, ...(unresolved ? { operationId: unresolved.operationId } : {}) }),
    getRecovery: () => unresolved ? { version: 1, request: structuredClone(unresolved) } : undefined,
    commit: async (expectedRevision, change) => {
      if (status !== "idle") throw new Error("Reconcile pending/unknown operation first");
      unresolved = request({ resourceId, operationId: (options.operationId ?? (() => crypto.randomUUID()))(), expectedRevision, change });
      const localController = new AbortController(); controller = localController; status = "pending"; notify();
      let submitted = false;
      const approved = structuredClone(unresolved);
      try { return settle(await bounded(Promise.resolve().then(async () => {
        if (options.beforeSubmit) await options.beforeSubmit({ version: 1, request: structuredClone(approved) }, localController.signal);
        if (localController.signal.aborted) throw new Error("Cancelled before submission");
        submitted = true; return provider.commit(structuredClone(approved), localController.signal);
      }))); }
      catch {
        controller?.abort();
        if (!submitted) { const operationId = unresolved!.operationId; unresolved = undefined; controller = undefined; status = "idle"; return { status: "cancelled", resourceId, operationId }; }
        return unknown();
      }
      finally { if (unresolved) status = "unknown"; notify(); }
    },
    cancel: () => controller?.abort(),
    reconcile: async () => {
      if (status !== "unknown" || !unresolved) throw new Error("No unknown operation to reconcile");
      status = "pending"; notify();
      try { return settle(await bounded(Promise.resolve().then(() => provider.lookupOperation(resourceId, unresolved!.operationId)))); }
      catch { return unknown(); }
      finally { if (unresolved) status = "unknown"; notify(); }
    }
  };
}

export type NotesWritableProperty = { type: "text" | "number" | "boolean" | "date" | "url" | "email" | "phone" | "select" | "status" | "multi_select" | "relation"; optionIds?: readonly string[] };
/** Computed, file/user/location/audit properties require a host editor and remain read-only here. */
export function validateNotesPropertyValue(definition: NotesWritableProperty, value: unknown): JsonValue {
  const allowedTypes = ["text", "number", "boolean", "date", "url", "email", "phone", "select", "status", "multi_select", "relation"];
  if (!definition || !allowedTypes.includes(definition.type)) throw new Error("Property is read-only; host editor is required");
  const safe = copyLegacyNotesJson(value);
  if (safe === null) return safe;
  switch (definition.type) {
    case "number": if (typeof safe === "number") return safe; break;
    case "boolean": if (typeof safe === "boolean") return safe; break;
    case "relation": if (Array.isArray(safe) && safe.length <= 100 && safe.every(v => typeof v === "string" && v.length > 0 && v.length <= 512) && new Set(safe).size === safe.length) return safe; break;
    case "multi_select": if (Array.isArray(safe) && safe.length <= 100 && new Set(safe).size === safe.length && definition.optionIds && safe.every(v => typeof v === "string" && definition.optionIds!.includes(v))) return safe; break;
    case "select": case "status": if (typeof safe === "string" && definition.optionIds?.includes(safe)) return safe; break;
    case "text": case "phone": if (typeof safe === "string" && safe.length <= 4000) return safe; break;
    case "email": if (typeof safe === "string" && safe.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safe)) return safe; break;
    case "url": if (typeof safe === "string" && safe.length <= 4000) { try { const url = new URL(safe); if (url.protocol === "https:" || url.protocol === "http:") return safe; } catch { /* invalid URL */ } } break;
    case "date": if (typeof safe === "string" && /^\d{4}-\d{2}-\d{2}$/.test(safe) && !Number.isNaN(Date.parse(safe)) && new Date(safe).toISOString().slice(0,10) === safe) return safe; break;
  }
  throw new Error("Unsupported or invalid property value; host validation is required");
}
