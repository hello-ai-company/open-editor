import { copyLegacyNotesJson } from "../document/legacyNotes.js";
import type { NotesScope } from "../notes/contracts.js";
import { isDatabaseViewType } from "./types.js";
import type { DatabaseViewConfig, DatabaseViewConfigIdentity, DatabaseViewConfigProvider, DatabaseViewConfigWriteVersion } from "./databaseViewConfig.js";

export type DatabaseViewConfigReadRequest = { scope: NotesScope; databaseId: string; viewId: string };
export type DatabaseViewConfigReadSnapshot = DatabaseViewConfigReadRequest & { revision: string | null; config: unknown | null };
export type DatabaseViewConfigOperation = DatabaseViewConfigReadRequest & { operationId: string; expectedRevision: string | null; config: DatabaseViewConfig };
export type DatabaseViewConfigReceipt = DatabaseViewConfigReadRequest & { operationId: string } & (
  | { status: "committed"; previousRevision: string | null; revision: string; config: DatabaseViewConfig; receiptId: string }
  | { status: "pending" | "unknown" | "conflict" | "denied" | "rejected" }
  | { status: "not-found"; terminal: true }
);
/** Separate presentation transaction. Host reauthorizes and CASes its own view resource,
 * stores exact payload+receipt atomically and fences every terminal failure. No body/row writes. */
export type DatabaseViewConfigReceiptPort = {
  scope: NotesScope;
  read(request: DatabaseViewConfigReadRequest, signal: AbortSignal): Promise<DatabaseViewConfigReadSnapshot>;
  beforeSubmit(operation: DatabaseViewConfigOperation, signal: AbortSignal): Promise<void>;
  commit(operation: DatabaseViewConfigOperation, signal: AbortSignal): Promise<DatabaseViewConfigReceipt>;
  lookup(request: DatabaseViewConfigReadRequest & { operationId: string }, signal: AbortSignal): Promise<DatabaseViewConfigReceipt>;
  list?(request: { scope: NotesScope; databaseId: string }, signal: AbortSignal): Promise<readonly DatabaseViewConfigIdentity[]>;
};
const copy = <T,>(value: T): T => copyLegacyNotesJson(value) as T;
const boundedId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 512;
const same = (a: unknown, b: unknown): boolean => {
  const sorted = (v: unknown): unknown => Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sorted(v)])) : v;
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
};
const configChecked = (value: DatabaseViewConfig): DatabaseViewConfig => {
  const config = copy(value);
  const allowed = ["schemaVersion", "databaseId", "viewId", "viewType", "query", "sortBy", "direction", "filters", "propertySort", "board", "calendar", "timeline", "gantt", "chart", "feed", "dashboard"];
  if (!config || Object.keys(config).some(key => !allowed.includes(key)) || config.schemaVersion !== 1 || !boundedId(config.databaseId) || !boundedId(config.viewId) || !isDatabaseViewType(config.viewType) || typeof config.query !== "string" || config.query.length > 500 || !["position", "title"].includes(config.sortBy) || !["asc", "desc"].includes(config.direction) || !Array.isArray(config.filters) || config.filters.length > 20) throw new Error("Invalid reviewed database view config");
  return config;
};

/** Opt-in adapter for existing load/save UI. An unresolved save is reconciled by lookup
 * on explicit Retry; it is never resent. Supply durable recoveries before mounting UI. */
export function createReviewedDatabaseViewConfigProvider(port: DatabaseViewConfigReceiptPort, options: { recoveries?: readonly DatabaseViewConfigOperation[]; operationId?: () => string; timeoutMs?: number; singleWriter?: boolean } = {}): {
  provider: DatabaseViewConfigProvider;
  getRecoveries(): readonly DatabaseViewConfigOperation[];
  reconcile(databaseId: string, viewId: string): Promise<DatabaseViewConfigReceipt>;
  dispose(): void;
} {
  const scope = copy(port.scope), known = new Map<string, string | null>(), pending = new Map<string, DatabaseViewConfigOperation>(), flights = new Set<string>(), controllers = new Set<AbortController>();
  if (!boundedId(scope.actorId) || !boundedId(scope.workspaceId)) throw new Error("Invalid view receipt scope");
  const timeoutMs = options.timeoutMs ?? 10000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) throw new Error("Invalid view receipt timeout");
  const loadFlights = new Map<string, Promise<DatabaseViewConfigReadSnapshot>>();
  const readers = new Map<string, { key: string; originalRevision: string | null; revision: string | null; valid: boolean }>();
  const owners = new Map<string, string>();
  const epochs = new Map<string, number>();
  const bump = (key: string) => { const generation = (epochs.get(key) ?? 0) + 1; epochs.set(key, generation); return generation; };
  let disposed = false;
  const usedOperationIds = new Set<string>();
  const identity = (databaseId: string, viewId: string): DatabaseViewConfigReadRequest => {
    if (!boundedId(databaseId) || !boundedId(viewId)) throw new Error("Invalid database view identity");
    return { scope: copy(scope), databaseId, viewId };
  };
  const key = (databaseId: string, viewId: string) => JSON.stringify([databaseId, viewId]);
  const matches = (value: DatabaseViewConfigReadRequest, request: DatabaseViewConfigReadRequest): boolean => same(value.scope, scope) && value.databaseId === request.databaseId && value.viewId === request.viewId;
  for (const raw of options.recoveries ?? []) {
    const recovery = copy(raw), config = configChecked(recovery.config), request = identity(config.databaseId, config.viewId);
    if (!matches(recovery, request) || !boundedId(recovery.operationId) || recovery.expectedRevision !== null && !boundedId(recovery.expectedRevision) || pending.has(key(config.databaseId, config.viewId))) throw new Error("Invalid scoped view recovery");
    if (usedOperationIds.has(recovery.operationId)) throw new Error("Duplicate view recovery operation ID");
    usedOperationIds.add(recovery.operationId); pending.set(key(config.databaseId, config.viewId), recovery);
  }
  const bounded = async <T,>(work: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    if (disposed) throw new Error("View receipt adapter disposed");
    const controller = new AbortController(); controllers.add(controller);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([Promise.resolve().then(() => { if (controller.signal.aborted) throw new Error("View operation cancelled"); return work(controller.signal); }), new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(new Error("View operation unconfirmed")), { once: true });
        timer = setTimeout(() => controller.abort(), timeoutMs);
      })]);
    } finally { if (timer) clearTimeout(timer); controllers.delete(controller); }
  };
  const settle = (raw: DatabaseViewConfigReceipt, operation: DatabaseViewConfigOperation): DatabaseViewConfigReceipt => {
    const result = copy(raw), k = key(operation.databaseId, operation.viewId);
    if (disposed || !matches(result, operation) || result.operationId !== operation.operationId) throw new Error("Mismatched database view receipt");
    if (result.status === "committed") {
      if (result.previousRevision !== operation.expectedRevision || !boundedId(result.revision) || result.revision === operation.expectedRevision || !boundedId(result.receiptId) || !same(configChecked(result.config), operation.config)) throw new Error("View receipt does not prove the reviewed config");
      const reader = readers.get(owners.get(k) ?? "");
      if (reader) reader.revision = result.revision;
      bump(k); known.set(k, result.revision); pending.delete(k); owners.delete(k);
    } else if (["conflict", "denied", "rejected"].includes(result.status) || result.status === "not-found" && result.terminal === true) {
      const reader = readers.get(owners.get(k) ?? ""); if (reader) reader.valid = false;
      bump(k); pending.delete(k); known.delete(k); owners.delete(k);
    }
    else if (!["pending", "unknown"].includes(result.status)) throw new Error("Unfenced database view outcome");
    return result;
  };
  const requireCommit = (result: DatabaseViewConfigReceipt): void => { if (result.status !== "committed") throw new Error(`Database view save ${result.status}; retained input requires review`); };
  const lookup = async (operation: DatabaseViewConfigOperation): Promise<DatabaseViewConfigReceipt> => settle(await bounded(signal => port.lookup({ ...identity(operation.databaseId, operation.viewId), operationId: operation.operationId }, signal)), operation);
  const loadSnapshot = async (databaseId: string, viewId: string): Promise<DatabaseViewConfigReadSnapshot> => {
      const request = identity(databaseId, viewId), k = key(databaseId, viewId);
      if (pending.has(k) || flights.has(k)) throw new Error("Resolve the retained view operation before loading settings");
      const existing = loadFlights.get(k); if (existing) return existing.then(copy);
      const generation = bump(k); known.delete(k);
      const work = Promise.resolve().then(async () => {
        const snapshot = copy(await bounded(signal => port.read(request, signal)));
        if (disposed || epochs.get(k) !== generation || pending.has(k) || !matches(snapshot, request) || snapshot.config === null && snapshot.revision !== null || snapshot.config !== null && !boundedId(snapshot.revision)) throw new Error("Invalid authoritative view snapshot");
        if (snapshot.config !== null) {
          const config = snapshot.config as DatabaseViewConfig;
          if (!config || config.databaseId !== databaseId || config.viewId !== viewId) throw new Error("Foreign saved view config");
        }
        known.set(k, snapshot.revision); return snapshot;
      });
      loadFlights.set(k, work);
      try { return copy(await work); } finally { if (loadFlights.get(k) === work) loadFlights.delete(k); }
  };
  const save = async (value: DatabaseViewConfig, version?: DatabaseViewConfigWriteVersion): Promise<void> => {
      const config = configChecked(value), request = identity(config.databaseId, config.viewId), k = key(config.databaseId, config.viewId);
      if (disposed || flights.has(k)) throw new Error("View operation already running or disposed");
      const reader = version && readers.get(version.readId);
      if (version ? !reader || !reader.valid || reader.key !== k || reader.originalRevision !== version.revision : !options.singleWriter) throw new Error("An authoritative per-reader view revision is required");
      flights.add(k);
      try {
        const existing = pending.get(k);
        if (existing) { if (owners.get(k) !== version?.readId || !same(existing.config, config)) throw new Error("Resolve previous view operation before a different save"); requireCommit(await lookup(existing)); return; }
        if (!reader && !known.has(k)) throw new Error("Authoritative view revision must be loaded before save");
        const operation: DatabaseViewConfigOperation = { ...request, operationId: (options.operationId ?? (() => crypto.randomUUID()))(), expectedRevision: reader ? reader.revision : known.get(k)!, config };
        if (!boundedId(operation.operationId) || usedOperationIds.has(operation.operationId)) throw new Error("Invalid or reused view operation ID");
        usedOperationIds.add(operation.operationId);
        bump(k); pending.set(k, copy(operation));
        if (version) owners.set(k, version.readId);
        try { await bounded(signal => port.beforeSubmit(copy(operation), signal)); }
        catch (error) { pending.delete(k); owners.delete(k); throw error; }
        if (disposed) throw new Error("View adapter disposed before submission");
        requireCommit(settle(await bounded(signal => port.commit(copy(operation), signal)), operation));
      } finally { flights.delete(k); }
  };
  const provider: DatabaseViewConfigProvider = {
    load: (databaseId, viewId) => loadSnapshot(databaseId, viewId).then(snapshot => copy(snapshot.config)),
    async loadVersioned(databaseId, viewId) {
      const snapshot = await loadSnapshot(databaseId, viewId), readId = `reader-${crypto.randomUUID()}`;
      readers.set(readId, { key: key(databaseId, viewId), originalRevision: snapshot.revision, revision: snapshot.revision, valid: true });
      return { config: copy(snapshot.config), version: { readId, revision: snapshot.revision } };
    },
    save: value => save(value),
    saveVersioned: (value, version) => save(value, version),
    ...(port.list ? { list: (databaseId: string) => { if (!boundedId(databaseId)) return Promise.reject(new Error("Invalid database identity")); return bounded(signal => port.list!({ scope: copy(scope), databaseId }, signal)).then(copy); } } : {})
  };
  return {
    provider,
    getRecoveries: () => [...pending.values()].map(copy),
    async reconcile(databaseId, viewId) {
      const k = key(databaseId, viewId), operation = pending.get(k);
      if (!operation || flights.has(k) || disposed) throw new Error("No idle retained view operation to reconcile");
      flights.add(k); try { return await lookup(operation); } finally { flights.delete(k); }
    },
    dispose() { disposed = true; for (const k of epochs.keys()) bump(k); loadFlights.clear(); readers.clear(); owners.clear(); for (const controller of controllers) controller.abort(); controllers.clear(); }
  };
}
