import type { JsonValue } from "@hello-ai-company/editor-core";
import { copyLegacyNotesJson } from "../document/legacyNotes.js";
import { createRevisionedNotesResourceEditor, type NotesResourceRecovery, type RevisionedNotesResourceEditor, type NotesResourceRequest, type NotesResourceResult } from "../workspace/revisionedNotesResource.js";
import type { NotesScope, NotesTarget } from "./contracts.js";
import { notesPropertyAuthority, parseNotesDatabasePropertyDefinition, validateNotesDatabasePropertyValue, type NotesDatabasePropertyDefinition, type NotesDatabaseSchemaSnapshot } from "./propertyCatalog.js";

export type NotesTableQuery = { query: string; trashed: boolean; sortBy: "position" | "title"; direction: "asc" | "desc"; limit: number };
export type NotesTableBinding = { scope: NotesScope; parentTarget: NotesTarget; databaseId: string; viewId: string; query: NotesTableQuery };
export type NotesTableRow = { id: string; title: string; sortOrder: number; deleted: boolean; values: Record<string, JsonValue> };
export type NotesTableSnapshot = { scope: NotesScope; parentTarget: NotesTarget; databaseId: string; revision: string; schema: NotesDatabaseSchemaSnapshot; capabilities: readonly string[] };
/** Local port identity proof after the host has checked the wire rows envelope.
 * This does not add a field to the HTTP request or response. */
export type NotesTableRowsPage = { binding: NotesTableBinding; revision: string; rows: NotesTableRow[]; total: number; nextCursor: string | null };
export type NotesTableReceipt = NotesResourceResult & { proof: { scope: NotesScope; parentTarget: NotesTarget; databaseId: string; previousRevision?: string; historyId?: string } };
export type NotesTableEditingPort = {
  binding: NotesTableBinding; resourceId: string;
  read(signal: AbortSignal): Promise<NotesTableSnapshot>;
  rows(cursor: string | undefined, signal: AbortSignal): Promise<NotesTableRowsPage>;
  /** Host exposes the already validated durable receipt proof; transport request shape is unchanged. */
  provider: {
    commit(request: NotesResourceRequest, signal: AbortSignal): Promise<NotesTableReceipt>;
    lookupOperation(resourceId: string, operationId: string): Promise<NotesTableReceipt>;
  };
  beforeSubmit(ticket: NotesResourceRecovery, signal: AbortSignal): Promise<void>;
  /** Restore local ticket bookkeeping before GET lookup; never submit a transport operation. */
  beforeLookup?(ticket: NotesResourceRecovery, signal: AbortSignal): Promise<void>;
  recovery?: NotesResourceRecovery;
  releaseTerminal?(ticket: NotesResourceRecovery, signal: AbortSignal): Promise<void>;
};
export type NotesTableInputDraft = {
  version: 1; binding: NotesTableBinding; expectedRevision: string; expectedSchemaRevision: string;
  mode: "create" | "cell"; rowKey: string; propertyId?: string; rawInput: string; originalValue?: JsonValue; updatedAt: number;
  /** Exact previously reviewed operation. Hydration may only look it up, never resend it. */
  submitted?: NotesResourceRecovery;
};
export type NotesTableDraftJournal = {
  version: 1; compareAndSwap: true;
  read(binding: NotesTableBinding): Promise<NotesTableInputDraft[]>;
  list(scope: NotesScope, parentTarget: NotesTarget): Promise<NotesTableInputDraft[]>;
  put(draft: NotesTableInputDraft, expected: NotesTableInputDraft | undefined): Promise<void>;
  remove(draft: NotesTableInputDraft): Promise<void>;
};
export type NotesTableEditingHost = {
  version: 1; scope: NotesScope; journal: NotesTableDraftJournal;
  resolvePort(binding: NotesTableBinding): Promise<NotesTableEditingPort | undefined>;
};
export type NotesTableEditingState = {
  status: "loading" | "ready" | "error"; snapshot?: NotesTableSnapshot; rows: readonly NotesTableRow[];
  total: number; nextCursor: string | null; drafts: readonly NotesTableInputDraft[];
  otherDrafts: readonly NotesTableInputDraft[]; composing: boolean; composingOwners: readonly string[]; pending: boolean; unknown: boolean; journalError: boolean; message: string;
};
export type NotesTableController = {
  binding: Readonly<NotesTableBinding>; subscribe(listener: () => void): () => void; getState(): NotesTableEditingState;
  beginCreate(): Promise<void>; beginCell(rowKey: string, propertyId: string): Promise<void>; setRaw(rawInput: string, compositionOwner?: string): void;
  setComposing(owner: string, composing: boolean): void; persistInput(): Promise<void>; retryInputStorage(): Promise<boolean>;
  submit(): Promise<boolean>; reconcile(): Promise<boolean>; refresh(): Promise<boolean>; loadMore(): Promise<boolean>;
  /** Explicit discard requires the original journal record, and never cancels an unknown receipt. */
  discardInput(): Promise<boolean>; cancel(): void;
};
export type NotesTableEditingRegistry = {
  readonly version: 1;
  readonly scope: Readonly<NotesScope>;
  connect(binding: NotesTableBinding): Promise<NotesTableController | undefined>;
  beforeLeave(target: NotesTarget, signal: AbortSignal): Promise<boolean>;
  /** Capture immediately after successful beforeLeave. Check again after other
   * asynchronous nested writers and immediately before committing navigation. */
  captureLeaveGuard(target: NotesTarget): () => boolean;
  /** Input/registration/composition epoch for an enclosing layout transaction.
   * Negative after disposal or a host owner change. Never write authority. */
  getGeneration(): number;
  dispose(): void;
};
const copy = <T,>(value: T): T => copyLegacyNotesJson(value) as T;
const stable = (v: unknown): unknown => Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, stable(x)])) : v;
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const id = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 512;
const reserved = new Set(["__proto__", "constructor", "prototype"]);
function frozen<T>(value: T): T { if (value && typeof value === "object") { for (const child of Object.values(value)) frozen(child); Object.freeze(value); } return value; }
export function notesTableBindingKey(value: NotesTableBinding): string {
  const b = copy(value), q = b.query, t = b.parentTarget;
  if (!id(b.scope?.actorId) || !id(b.scope?.workspaceId) || !id(b.databaseId) || !id(b.viewId) || !t || !(t.kind === "page" && id(t.pageId) || t.kind === "row" && id(t.databaseId) && id(t.rowId)) || !q || typeof q.query !== "string" || q.query.length > 500 || typeof q.trashed !== "boolean" || !["position", "title"].includes(q.sortBy) || !["asc", "desc"].includes(q.direction) || !Number.isInteger(q.limit) || q.limit < 1 || q.limit > 50) throw new Error("Invalid table binding");
  if (Object.keys(b).sort().join() !== "databaseId,parentTarget,query,scope,viewId" || Object.keys(b.scope).sort().join() !== "actorId,workspaceId" || Object.keys(t).sort().join() !== (t.kind === "page" ? "kind,pageId" : "databaseId,kind,rowId") || Object.keys(q).sort().join() !== "direction,limit,query,sortBy,trashed") throw new Error("Unsupported table binding");
  return JSON.stringify(stable(b));
}
/** Raw future definitions stay read-only. Hosted, computed, compound and audit values are not coerced. */
export function isNotesTablePropertyEditable(def: NotesDatabasePropertyDefinition): boolean {
  return !reserved.has(def.id) && def.id.length <= 128 && notesPropertyAuthority(def) === "editable" && ["text", "number", "checkbox", "date", "url", "email", "phone", "select", "status"].includes(def.type);
}
export function parseNotesTableCellInput(def: NotesDatabasePropertyDefinition, raw: string): JsonValue {
  if (!isNotesTablePropertyEditable(def) || typeof raw !== "string" || raw.length > 4000) throw new Error("This property is read-only or the input is too long");
  let value: JsonValue = raw;
  if (def.type === "number") {
    const trimmed = raw.trim();
    if (!trimmed) value = null;
    else { if (!/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed) || !Number.isFinite(Number(trimmed))) throw new Error("Enter a finite number; original input is retained"); value = Number(trimmed); }
  } else if (def.type === "checkbox") {
    if (!["true", "false", ""].includes(raw)) throw new Error("Choose Yes, No or Unset");
    value = raw === "" ? null : raw === "true";
  } else if (["date", "url", "email", "select", "status"].includes(def.type) && raw === "") value = null;
  return validateNotesDatabasePropertyValue(def, value);
}
export function parseNotesTableInputDraft(value: unknown, binding: NotesTableBinding): NotesTableInputDraft {
  const d = copy(value) as NotesTableInputDraft;
  if (!d || d.version !== 1 || notesTableBindingKey(d.binding) !== notesTableBindingKey(binding) || !id(d.expectedRevision) || !id(d.expectedSchemaRevision) || !id(d.rowKey) || !["create", "cell"].includes(d.mode) || d.mode === "cell" && !id(d.propertyId) || d.mode === "create" && d.propertyId !== undefined || typeof d.rawInput !== "string" || d.rawInput.length > 50000 || !Number.isFinite(d.updatedAt) || Object.keys(d).some(k => !["version", "binding", "expectedRevision", "expectedSchemaRevision", "mode", "rowKey", "propertyId", "rawInput", "originalValue", "updatedAt", "submitted"].includes(k))) throw new Error("Foreign or unsupported input journal; original retained");
  if (d.submitted && (d.submitted.version !== 1 || d.submitted.request.resourceId !== "notes-db-edit:" + binding.databaseId || d.submitted.request.expectedRevision !== d.expectedRevision || !id(d.submitted.request.operationId))) throw new Error("Foreign retained operation; input retained");
  if (d.submitted) {
    const change = d.submitted.request.change;
    if (change.kind !== "patch" || Object.keys(change.fields).join() !== "command") throw new Error("Unsupported retained row command");
    const command = change.fields.command;
    if (!command || typeof command !== "object" || Array.isArray(command) || command.kind !== (d.mode === "cell" ? "row.patch" : "row.create") || command.rowKey !== d.rowKey || Object.keys(command).sort().join() !== "fields,kind,rowKey" || !command.fields || typeof command.fields !== "object" || Array.isArray(command.fields) || !Object.keys(command.fields).length || Object.keys(command.fields).some(k => reserved.has(k))) throw new Error("Retained operation does not match original input");
    if (d.mode === "cell" && Object.keys(command.fields).join() !== d.propertyId) throw new Error("Retained cell names another property");
    if (d.mode === "create") {
      const raw: unknown = JSON.parse(d.rawInput);
      if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).sort().join() !== Object.keys(command.fields).sort().join()) throw new Error("Retained creation does not match original input");
    }
  }
  return d;
}
function checkedSnapshot(value: NotesTableSnapshot, binding: NotesTableBinding): NotesTableSnapshot {
  if (!equal(value.scope, binding.scope) || !equal(value.parentTarget, binding.parentTarget) || value.databaseId !== binding.databaseId || !id(value.revision) || !id(value.schema?.revision) || !Array.isArray(value.schema.properties) || value.schema.properties.length > 64 || !Array.isArray(value.capabilities) || value.capabilities.some(v => typeof v !== "string")) throw new Error("Foreign or unsupported table snapshot");
  const properties = value.schema.properties.map(parseNotesDatabasePropertyDefinition);
  if (new Set(properties.map(p => p.id)).size !== properties.length) throw new Error("Duplicate table property identity");
  return frozen(copy({ scope: value.scope, parentTarget: value.parentTarget, databaseId: value.databaseId, revision: value.revision, schema: { revision: value.schema.revision, properties }, capabilities: value.capabilities }));
}
/** One host/session registry owns the sole resource editor across all views and queries. */
export function createNotesTableEditingRegistry(host: NotesTableEditingHost): NotesTableEditingRegistry {
  const scope = frozen(copy(host.scope));
  if (host.version !== 1 || host.journal.version !== 1 || host.journal.compareAndSwap !== true || !id(scope.actorId) || !id(scope.workspaceId)) throw new Error("Versioned durable table port is required");
  type Internal = NotesTableController & { port: NotesTableEditingPort; applyReceipt(): Promise<boolean>; setSubmitted(ticket: NotesResourceRecovery): Promise<void> };
  type Group = { editor: RevisionedNotesResourceEditor; owner?: Internal; flight: boolean; port: NotesTableEditingPort; inputOwner?: Internal; makeEditor(recovery?: NotesResourceRecovery): RevisionedNotesResourceEditor; unlisten: () => void; listeners: Set<() => void> };
  const connections = new Map<string, { binding: NotesTableBinding; promise: Promise<Internal | undefined> }>(), groups = new Map<string, Group>();
  let disposed = false, leaving = false, epoch = 0;
  const cleanLeaves = new Map<string, { epoch: number }>();
  const assertHost = () => { if (disposed || !equal(host.scope, scope)) throw new Error("Table owner changed; input retained"); };
  const connect = async (input: NotesTableBinding): Promise<Internal | undefined> => {
    assertHost(); const binding = frozen(copy(input)), key = notesTableBindingKey(binding);
    if (!equal(binding.scope, scope)) throw new Error("Foreign table scope");
    const existing = connections.get(key); if (existing) return existing.promise;
    const promise = (async () => {
      const port = await host.resolvePort(copy(binding)); assertHost();
      if (!port) return undefined;
      const resourceId = "notes-db-edit:" + binding.databaseId;
      const assertPort = () => { assertHost(); if (notesTableBindingKey(port.binding) !== key || port.resourceId !== resourceId) throw new Error("Table port changed; original input retained"); };
      assertPort();
      let state: NotesTableEditingState = frozen({ status: "loading", rows: [], total: 0, nextCursor: null, drafts: [], otherDrafts: [], composing: false, composingOwners: [], pending: false, unknown: false, journalError: false, message: "" });
      const listeners = new Set<() => void>(), composers = new Set<string>();
      let durable: NotesTableInputDraft | undefined, queue: Promise<void> = Promise.resolve(), reading = false, generation = 0;
      let group: Group, api: Internal, terminal = false;
      const update = (patch: Partial<NotesTableEditingState>) => { if (patch.drafts && !equal(patch.drafts, state.drafts) || patch.composing !== undefined && patch.composing !== state.composing || patch.composingOwners && !equal(patch.composingOwners, state.composingOwners)) epoch++; state = frozen({ ...state, ...patch }); for (const fn of listeners) { try { fn(); } catch { /* UI cannot alter write outcomes. */ } } };
      const resourceState = () => { const s = group.editor.getState(); update({ pending: group.flight || s.status === "pending", unknown: s.status === "unknown" }); };
      const fail = (message: string, journalError = state.journalError) => { update({ message, journalError }); };
      const persist = (draft: NotesTableInputDraft): Promise<void> => {
        queue = queue.catch(() => undefined).then(async () => {
          assertPort(); await host.journal.put(copy(draft), durable ? copy(durable) : undefined); assertPort(); durable = copy(draft); update({ journalError: false });
        }).catch(error => { fail("Input storage failed. Original input remains here; sending and navigation are blocked.", true); throw error; });
        // Input changes intentionally start storage without losing rejection observability at flush.
        void queue.catch(() => undefined); return queue;
      };
      const freshRows = async (snapshot: NotesTableSnapshot, cursor?: string) => {
        assertPort(); const rows = await port.rows(cursor, new AbortController().signal); assertPort();
        if (notesTableBindingKey(rows.binding) !== key) throw new Error("Foreign rows query identity; input retained");
        if (rows.revision !== snapshot.revision || !Array.isArray(rows.rows) || rows.rows.length > binding.query.limit || !Number.isInteger(rows.total) || rows.total < 0 || rows.total > 1000 || !(rows.nextCursor === null || id(rows.nextCursor)) || rows.rows.some(r => !id(r.id) || typeof r.title !== "string" || typeof r.deleted !== "boolean" || !Number.isFinite(r.sortOrder) || !r.values || Array.isArray(r.values) || typeof r.values !== "object") || new Set(rows.rows.map(r => r.id)).size !== rows.rows.length) throw new Error("Rows changed or are unsupported; input retained");
        return { rows: frozen(copy(rows.rows)), total: rows.total, nextCursor: rows.nextCursor };
      };
      const allDrafts = await host.journal.list(copy(scope), copy(binding.parentTarget)); assertPort();
      const otherDrafts = allDrafts.map(d => {
        if (!equal(d.binding.scope, scope) || !equal(d.binding.parentTarget, binding.parentTarget)) throw new Error("Foreign journal scope");
        return parseNotesTableInputDraft(d, d.binding);
      }).filter(d => d.binding.databaseId === binding.databaseId && notesTableBindingKey(d.binding) !== key);
      const drafts = await host.journal.read(copy(binding)); assertPort();
      if (drafts.length > 64) throw new Error("Too many retained inputs; host review required");
      const retained = drafts.map(d => parseNotesTableInputDraft(d, binding));
      const rawTicket = retained.find(d => d.submitted)?.submitted;
      if (retained.some(d => d.submitted && !equal(d.submitted, rawTicket)) || port.recovery && rawTicket && !equal(port.recovery, rawTicket)) throw new Error("Different retained operations require host review; raw input retained");
      durable = retained[0] ? copy(retained[0]) : undefined; update({ drafts: frozen(retained), otherDrafts: frozen(otherDrafts) });
      group = groups.get(resourceId)!;
      if (!group) {
        const recovery = port.recovery ?? rawTicket;
        const groupPort = port;
        const checkedReceipt = (result: NotesTableReceipt, request: NotesResourceRequest, owner: NotesTableEditingPort): NotesResourceResult => {
          const proof = result.proof;
          if (result.resourceId !== resourceId || result.operationId !== request.operationId || !proof || !equal(proof.scope, scope) || !equal(proof.parentTarget, owner.binding.parentTarget) || proof.databaseId !== binding.databaseId) throw new Error("Foreign receipt; original ticket retained");
          if (result.status === "committed") {
            const value = result.snapshot.value;
            if (proof.previousRevision !== request.expectedRevision || !id(proof.historyId) || !value || typeof value !== "object" || Array.isArray(value) || !equal(value.scope, scope) || !equal(value.parentTarget, owner.binding.parentTarget) || value.databaseId !== binding.databaseId || value.revision !== result.snapshot.revision) throw new Error("Incomplete durable receipt proof; ticket retained");
          }
          return result;
        };
        const makeEditor = (retainedRecovery?: NotesResourceRecovery) => createRevisionedNotesResourceEditor({
          commit: async (request, signal) => { assertHost(); const owner = group.owner; if (!owner) throw new Error("No captured table writer"); const result = await owner.port.provider.commit(request, signal); assertHost(); return checkedReceipt(result, request, owner.port); },
          lookupOperation: async (resource, operation) => { assertHost(); const owner = group.owner?.port ?? groupPort, request = group.editor.getRecovery()?.request; if (!request || request.operationId !== operation) throw new Error("Missing captured lookup ticket"); const result = await owner.provider.lookupOperation(resource, operation); assertHost(); return checkedReceipt(result, request, owner); }
        }, { resourceId, recovery: retainedRecovery, beforeSubmit: async (ticket, signal) => {
          const owner = group.owner; if (!owner) throw new Error("No captured input");
          const d = owner.getState().drafts[0]; if (!d || d.submitted || ticket.request.expectedRevision !== d.expectedRevision) throw new Error("Input changed before ticket storage");
          // Durable raw input + exact submitted ticket precede the host ticket and transport.
          signal.throwIfAborted(); await owner.setSubmitted(ticket); assertHost(); signal.throwIfAborted();
          if (group.owner !== owner || !equal(owner.getState().drafts[0]?.submitted, ticket)) throw new Error("Input owner changed before ticket persistence");
          await owner.port.beforeSubmit(copy(ticket), signal); assertHost(); signal.throwIfAborted();
        } });
        const editor = makeEditor(recovery);
        group = { editor, flight: false, port, makeEditor, listeners: new Set(), unlisten: () => undefined };
        group.unlisten = editor.subscribe(() => { for (const fn of group.listeners) fn(); }); groups.set(resourceId, group);
      } else if ((port.recovery || rawTicket) && !equal(port.recovery ?? rawTicket, group.editor.getRecovery())) throw new Error("A different table operation is retained; review required");
      const assertEditable = () => { assertPort(); if (state.status !== "ready" || !state.snapshot || binding.query.trashed || group.flight || group.editor.getState().status !== "idle" || state.drafts.length > 1 || state.journalError || group.inputOwner && group.inputOwner !== api) throw new Error("Table is not ready; retained input must be resolved"); };
      const begin = async (d: NotesTableInputDraft) => {
        assertEditable(); if (state.drafts.length) throw new Error("Finish or explicitly discard the retained input first");
        group.inputOwner = api;
        try {
          const all = await host.journal.list(copy(scope), copy(binding.parentTarget)); assertPort();
          const others = all.map(input => { if (!equal(input.binding.scope, scope) || !equal(input.binding.parentTarget, binding.parentTarget)) throw new Error("Foreign journal scope"); return parseNotesTableInputDraft(input, input.binding); }).filter(input => input.binding.databaseId === binding.databaseId);
          if (others.length) { update({ otherDrafts: frozen(others) }); throw new Error("Input in another view/query is retained. Return to its original view before editing."); }
          assertEditable(); if (state.drafts.length) throw new Error("Finish or explicitly discard the retained input first"); generation++; update({ drafts: [frozen(d)], otherDrafts: [], message: "Input retained; not sent" }); void persist(d);
        } catch (error) { if (!state.drafts.length && group.inputOwner === api) group.inputOwner = undefined; throw error; }
      };
      const command = (d: NotesTableInputDraft, snapshot: NotesTableSnapshot) => {
        const definition = (property: string) => { const def = snapshot.schema.properties.find(p => p.id === property); if (!def || !isNotesTablePropertyEditable(def)) throw new Error("Property changed or is read-only; input retained"); return def; };
        let fields: Record<string, JsonValue>;
        if (d.mode === "cell") fields = { [d.propertyId!]: parseNotesTableCellInput(definition(d.propertyId!), d.rawInput) };
        else {
          const raw: unknown = JSON.parse(d.rawInput);
          if (!raw || typeof raw !== "object" || Array.isArray(raw) || !Object.keys(raw).length || Object.keys(raw).length > 64) throw new Error("Enter at least one reviewed property");
          fields = Object.fromEntries(Object.entries(raw).map(([property, value]) => { if (typeof value !== "string") throw new Error("Unsupported create input"); return [property, parseNotesTableCellInput(definition(property), value)]; }));
        }
        return { kind: d.mode === "create" ? "row.create" : "row.patch", rowKey: d.rowKey, fields };
      };
      const refresh = async (): Promise<boolean> => {
        if (reading) return false; reading = true; const captured = generation;
        try {
          assertPort(); const snapshot = checkedSnapshot(await port.read(new AbortController().signal), binding); const rows = await freshRows(snapshot);
          const retained = await host.journal.list(copy(scope), copy(binding.parentTarget)); assertPort();
          const others = retained.map(d => { if (!equal(d.binding.scope, scope) || !equal(d.binding.parentTarget, binding.parentTarget)) throw new Error("Foreign input scope"); return parseNotesTableInputDraft(d, d.binding); }).filter(d => d.binding.databaseId === binding.databaseId && notesTableBindingKey(d.binding) !== key);
          if (captured !== generation) return false; update({ status: "ready", snapshot, ...rows, otherDrafts: frozen(others) }); return true;
        }
        catch { update({ status: state.snapshot ? "ready" : "error", message: "Rows could not refresh. Original input is retained." }); return false; }
        finally { reading = false; }
      };
      const applyReceipt = async (): Promise<boolean> => {
        const d = state.drafts[0]; if (!d?.submitted) return true;
        // Keep successful input/ticket through a failed refresh; never create a new operation from it.
        if (!await refresh()) return false;
        if (state.drafts[0] !== d || !equal(durable, d)) return false;
        try { await host.journal.remove(copy(d)); assertPort(); durable = undefined; generation++; update({ drafts: state.drafts.slice(1), journalError: false, message: "Saved and refreshed" }); if (group.inputOwner === api) group.inputOwner = undefined; return true; }
        catch { fail("Saved; input cleanup failed. Keep this input and query the same operation before leaving.", true); return false; }
      };
      let confirmed = false;
      api = {
        binding, port, subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, getState: () => state,
        async beginCreate() { const snapshot = state.snapshot; if (!snapshot?.capabilities.includes("row.create")) throw new Error("Row creation is unavailable"); await begin({ version: 1, binding, expectedRevision: snapshot.revision, expectedSchemaRevision: snapshot.schema.revision, mode: "create", rowKey: crypto.randomUUID(), rawInput: "{}", updatedAt: Date.now() }); },
        async beginCell(rowKey, propertyId) {
          const snapshot = state.snapshot, row = state.rows.find(r => r.id === rowKey), def = snapshot?.schema.properties.find(p => p.id === propertyId);
          if (!snapshot?.capabilities.includes("row.patch") || !row || row.deleted || !def || !isNotesTablePropertyEditable(def)) throw new Error("Cell editing is unavailable");
          const originalValue = row.values[propertyId];
          if (originalValue !== undefined && originalValue !== null) { try { validateNotesDatabasePropertyValue(def, originalValue); } catch { throw new Error("Unsupported existing value remains read-only"); } }
          await begin({ version: 1, binding, expectedRevision: snapshot.revision, expectedSchemaRevision: snapshot.schema.revision, mode: "cell", rowKey, propertyId, rawInput: originalValue === null || originalValue === undefined ? "" : String(originalValue), ...(originalValue === undefined ? {} : { originalValue: copy(originalValue) }), updatedAt: Date.now() });
        },
        setRaw(rawInput, compositionOwner) { assertPort(); const d = state.drafts[0]; if (!d || state.drafts.length !== 1 || d.submitted || group.flight || group.editor.getState().status !== "idle" || typeof rawInput !== "string" || rawInput.length > 50000) throw new Error("Original table input is retained"); if (state.composing && compositionOwner !== undefined && !composers.has(compositionOwner)) throw new Error("Input is composing in another table surface"); if (rawInput === d.rawInput) return; const next = frozen({ ...copy(d), rawInput, updatedAt: Math.max(Date.now(), d.updatedAt + 1) }); generation++; update({ drafts: [next], message: "Input retained; not sent" }); void persist(next); },
        setComposing(owner, composing) { if (disposed) return; if (composing) composers.add(owner); else composers.delete(owner); update({ composing: composers.size > 0, composingOwners: [...composers] }); },
        async persistInput() { assertPort(); await queue; if (state.journalError) throw new Error("Input journal failed"); },
        async retryInputStorage() { try { const d = state.drafts[0]; if (d) await persist(d); else await queue; return !state.journalError; } catch { return false; } },
        async setSubmitted(ticket: NotesResourceRecovery) { const d = state.drafts[0]; if (!d || d.submitted || state.composing) throw new Error("Input changed before submission"); const next = frozen({ ...copy(d), submitted: copy(ticket) }); update({ drafts: [next] }); await persist(next); },
        async submit() {
          if (group.flight) return false;
          try { assertEditable(); } catch { return false; }
          const d = state.drafts[0]; if (!d || d.submitted || state.composing) return false;
          group.flight = true; group.owner = api; for (const fn of group.listeners) fn();
          try {
            await api.persistInput(); if (state.drafts[0] !== d || state.composing) throw new Error("Input changed; submit after review");
            const snapshot = checkedSnapshot(await port.read(new AbortController().signal), binding); assertPort();
            if (state.drafts[0] !== d || state.composing || snapshot.revision !== d.expectedRevision || snapshot.schema.revision !== d.expectedSchemaRevision) throw new Error("Database or schema changed. Original input is retained; no automatic rebase or send.");
            const reviewed = command(d, snapshot);
            if (!snapshot.capabilities.includes(reviewed.kind)) throw new Error("Current permission does not allow this row operation");
            const result = await group.editor.commit(d.expectedRevision, { kind: "patch", fields: { command: reviewed as JsonValue } });
            if (result.status === "committed") { confirmed = true; return await applyReceipt(); }
            terminal = result.status === "conflict" || result.status === "denied";
            // The host may have durably stored the ticket before rejecting/aborting
            // beforeSubmit. Keep any captured submitted ID for GET-only fencing.
            fail(result.status === "unknown" ? "Save result unknown. Query this operation; do not resend." : "Save " + result.status + ". Original input is retained; review required."); return false;
          } catch (error) { fail(error instanceof Error ? error.message : "Save unavailable; original input retained"); return false; }
          finally { group.flight = false; for (const fn of group.listeners) fn(); }
        },
        async reconcile() {
          if (group.flight) return false;
          if (group.owner && group.owner !== api) { fail("Original operation belongs to another table view. Its input is retained."); return false; }
          if (confirmed) return applyReceipt();
          if (group.editor.getState().status === "idle" && state.drafts[0]?.submitted && !terminal) {
            group.owner = api; group.unlisten(); group.editor = group.makeEditor(state.drafts[0].submitted);
            group.unlisten = group.editor.subscribe(() => { for (const fn of group.listeners) fn(); });
          }
          if (group.editor.getState().status !== "unknown") return false;
          if (state.drafts[0]?.submitted && !equal(state.drafts[0].submitted, group.editor.getRecovery())) { fail("Retained operation changed; original input requires review."); return false; }
          group.flight = true; group.owner ??= api; for (const fn of group.listeners) fn();
          try {
            await api.persistInput(); const ticket = group.editor.getRecovery()!;
            if (port.beforeLookup) await port.beforeLookup(copy(ticket), new AbortController().signal);
            const result = await group.editor.reconcile();
            if (result.status === "committed") { confirmed = true; return await applyReceipt(); }
            terminal = result.status === "conflict" || result.status === "denied";
            fail("Save " + result.status + ". Original input remains retained; no resend."); return false;
          } catch { fail("Save lookup failed; original operation and input retained."); return false; }
          finally { group.flight = false; for (const fn of group.listeners) fn(); }
        },
        refresh, applyReceipt,
        async loadMore() { if (reading || !state.nextCursor || !state.snapshot || state.drafts.length || group.flight || group.editor.getState().status !== "idle") return false; reading = true; try { const rows = await freshRows(state.snapshot, state.nextCursor); if (rows.rows.some(r => state.rows.some(old => old.id === r.id))) throw new Error("Duplicate page rows"); update({ ...rows, rows: [...state.rows, ...rows.rows] }); return true; } catch { fail("More rows unavailable; existing rows retained."); return false; } finally { reading = false; } },
        async discardInput() { assertPort(); if (state.composing || group.flight || group.editor.getState().status !== "idle" || confirmed || state.drafts.length !== 1 || state.drafts[0]?.submitted && (!terminal || !port.releaseTerminal)) return false; try { await api.persistInput(); const d = state.drafts[0]; if (!d) return true; if (d.submitted) await port.releaseTerminal!(copy(d.submitted), new AbortController().signal); await host.journal.remove(copy(d)); durable = undefined; generation++; update({ drafts: [], message: "Input explicitly discarded" }); if (group.inputOwner === api) group.inputOwner = undefined; return true; } catch { fail("Discard unavailable; original input retained.", true); return false; } },
        cancel: () => { if (group.owner === api) group.editor.cancel(); }
      };
      if (retained.length && !group.inputOwner) group.inputOwner = api;
      group.listeners.add(resourceState); resourceState();
      await refresh(); assertPort();
      if (retained.some(d => d.submitted)) { group.owner ??= api; await api.reconcile(); }
      assertPort();
      return api;
    })();
    connections.set(key, { binding, promise }); epoch++; return promise;
  };
  return {
    version: 1, scope, connect,
    getGeneration: () => disposed || !equal(host.scope, scope) ? -1 : epoch,
    captureLeaveGuard(target) {
      const key = JSON.stringify(stable(target)), clean = cleanLeaves.get(key);
      return () => Boolean(clean && cleanLeaves.get(key)?.epoch === clean.epoch && clean.epoch === epoch && !disposed && equal(host.scope, scope));
    },
    async beforeLeave(target, signal) {
      const key = JSON.stringify(stable(target)); cleanLeaves.delete(key);
      if (leaving || disposed || signal.aborted) return false; leaving = true; const capturedEpoch = epoch;
      try {
        const active = [...connections.values()].filter(c => equal(c.binding.parentTarget, target));
        const connected = await Promise.allSettled(active.map(c => c.promise));
        const writers = connected.flatMap(result => result.status === "fulfilled" && result.value ? [result.value] : []);
        // Persist every writer before evaluating any blocker; no partial navigation or auto-save.
        const flushed = await Promise.allSettled(writers.map(writer => writer.persistInput()));
        if (connected.some(result => result.status === "rejected") || flushed.some(result => result.status === "rejected") || signal.aborted) return false;
        const looked = new Set<string>();
        for (const writer of writers) { signal.throwIfAborted(); if (writer.getState().unknown && !looked.has(writer.port.resourceId)) { looked.add(writer.port.resourceId); await writer.reconcile(); } }
        const stored = await host.journal.list(copy(scope), copy(target));
        if (stored.some(d => { parseNotesTableInputDraft(d, d.binding); return !equal(d.binding.scope, scope) || !equal(d.binding.parentTarget, target); })) return false;
        const clean = !disposed && equal(host.scope, scope) && !signal.aborted && epoch === capturedEpoch && !stored.length && writers.every(w => { const s = w.getState(); return !s.drafts.length && !s.composing && !s.pending && !s.unknown && !s.journalError; });
        if (clean) cleanLeaves.set(key, { epoch });
        return clean;
      } catch { return false; }
      finally { leaving = false; }
    },
    dispose() { disposed = true; for (const group of groups.values()) { group.editor.cancel(); group.unlisten(); group.listeners.clear(); } }
  };
}
