import { createOrganizationRequest, parseOrganizationRecovery, parseOrganizationSnapshot, organizationEqual, validateOrganizationRequest,
  type OrganizationSnapshot, type OrganizationRequest, type OrganizationReceipt, type OrganizationCommitResult, type NoteOrganizationHost, type NoteOrganizationAgent, type OrganizationRecovery } from "@hello-ai-company/editor-ai";
import type { EditorDocument } from "@hello-ai-company/editor-core";

type Workspace = { hierarchy: number; notes: Record<string, Omit<OrganizationSnapshot, "pages" | "root" | "hierarchyRevision">>; receipts: Record<string, { request: OrganizationRequest; receipt: OrganizationReceipt }>; tickets: Record<string, OrganizationRecovery>; fenced: Record<string, true> };
export type SyntheticFault = "none" | "move-failure" | "lost-ack" | "offline";
const paragraph = (id: string, value: string) => ({ id, type: "paragraph", props: { backgroundColor: "default", textColor: "default", textAlignment: "left" }, content: [{ type: "text", text: value, styles: {} }] });
export function createSyntheticOrganizationSeed(): Workspace {
  const notes: Workspace["notes"] = {};
  for (const [id, title, body] of [["note", "自由メモ", "旅の準備\n持ち物は3点。パスポートは不要ではない。\n天気は未確認。"], ["travel", "旅", "旅の記録"], ["work", "仕事", "仕事の記録"], ["another", "別の自由メモ", "仕事の予定\n予算は未定。"]]) {
    notes[id!] = { documentId: id!, revision: "r1", pinRevision: "p1", document: { schemaVersion: 1, blocks: body!.split("\n").map((s, i) => paragraph(`${id}-${i}`, s)) }, title: title!, parentId: null, titleManual: false, parentPinned: false, autoOrganize: false };
  }
  return { hierarchy: 1, notes, receipts: {}, tickets: {}, fenced: {} };
}
function snapshot(state: Workspace, id: string): OrganizationSnapshot {
  const note = Object.hasOwn(state.notes, id) ? state.notes[id] : undefined; if (!note) throw new Error("missing_synthetic_note");
  return parseOrganizationSnapshot({ ...note, hierarchyRevision: `h${state.hierarchy}`, root: { scope: "synthetic", sharing: "private", editable: true }, pages: Object.values(state.notes).map(n => ({ id: n.documentId, parentId: n.parentId, title: n.title, scope: "synthetic", sharing: "private", editable: true })) });
}
/** All mutation is synchronous inside ONE host storage transaction. Exported for synthetic failure tests. */
export function applySyntheticOrganization(state: Workspace, request: OrganizationRequest, fault: SyntheticFault = "none"): OrganizationCommitResult {
  request = parseOrganizationRecovery({ version: 1, request }).request;
  if (state.fenced && Object.hasOwn(state.fenced, request.operationId)) return { status: "rejected" };
  const prior = Object.hasOwn(state.receipts, request.operationId) ? state.receipts[request.operationId] : undefined;
  if (prior) { if (!organizationEqual(prior.request, request)) return { status: "rejected" }; return { status: "committed", receipt: structuredClone(prior.receipt) }; }
  const refuse = (status: "conflict" | "rejected"): OrganizationCommitResult => { state.fenced ??= {}; state.fenced[request.operationId] = true; return { status }; };
  const before = snapshot(state, request.before.documentId);
  try { validateOrganizationRequest(request, before); } catch { return refuse("conflict"); }
  if (request.kind === "undo") {
    const history = Object.hasOwn(state.receipts, request.undoOperationId!) ? state.receipts[request.undoOperationId!] : undefined;
    if (!history || history.request.kind !== "organize" || !organizationEqual(history.receipt.snapshot, before) || !organizationEqual(request.after, { document: history.request.before.document, title: history.request.before.title, parentId: history.request.before.parentId })) return refuse("rejected");
  }
  if (fault === "move-failure") throw new Error("synthetic_move_failed_before_transaction_commit");
  const note = state.notes[before.documentId]!;
  note.document = structuredClone(request.after.document); note.title = request.after.title; note.parentId = request.after.parentId;
  note.revision = `r${Number(note.revision.slice(1)) + 1}`;
  if (before.title !== note.title || before.parentId !== note.parentId) state.hierarchy++;
  const receipt = { operationId: request.operationId, snapshot: snapshot(state, before.documentId), historyId: `history:${request.operationId}` };
  state.receipts[request.operationId] = { request: structuredClone(request), receipt: structuredClone(receipt) };
  return { status: "committed", receipt };
}

/** A synthetic-only IndexedDB adapter. Contains no PersonalAI URLs, credentials or provider calls. */
export function createSyntheticOrganizationHost(databaseName = "open-editor.synthetic-organization.v1") {
  let connection: Promise<IDBDatabase> | undefined, fault: SyntheticFault = "none";
  const open = () => connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(databaseName, 1); r.onupgradeneeded = () => r.result.createObjectStore("workspace");
    r.onerror = () => { connection = undefined; reject(new Error("synthetic_storage_unavailable")); };
    r.onblocked = () => { connection = undefined; reject(new Error("synthetic_storage_blocked")); };
    r.onsuccess = () => { r.result.onversionchange = () => { r.result.close(); connection = undefined; }; resolve(r.result); };
  });
  const transact = async <T>(write: boolean, fn: (state: Workspace) => T, signal?: AbortSignal): Promise<T> => {
    const db = await open(); if (signal?.aborted) throw new Error("cancelled");
    if (fault === "offline") throw new Error("synthetic_offline");
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction("workspace", write ? "readwrite" : "readonly", write ? { durability: "strict" } : undefined), store = tx.objectStore("workspace");
      let result: T, error: unknown;
      const abort = () => { try { tx.abort(); } catch { /* already committed */ } };
      signal?.addEventListener("abort", abort, { once: true });
      tx.oncomplete = () => { signal?.removeEventListener("abort", abort); resolve(result); };
      tx.onabort = tx.onerror = () => { signal?.removeEventListener("abort", abort); reject(error ?? new Error("synthetic_transaction_aborted")); };
      const r = store.get("tree"); r.onsuccess = () => { try { const state = r.result ?? createSyntheticOrganizationSeed(); result = fn(state); if (write) store.put(state, "tree"); } catch (e) { error = e; tx.abort(); } };
    });
  };
  const host: NoteOrganizationHost = {
    read: (id, signal) => transact(false, state => snapshot(state, id), signal),
    beforeSubmit: ticket => transact(true, state => { state.tickets[ticket.request.before.documentId] = structuredClone(ticket); }),
    commit: async (request, signal) => {
      const result = await transact(true, state => applySyntheticOrganization(state, request, fault), signal);
      if (fault === "lost-ack" && result.status === "committed") throw new Error("synthetic_ack_lost");
      return result;
    },
    lookupOperation: (operationId, signal) => transact(true, state => { if (Object.hasOwn(state.receipts, operationId)) return { status: "committed" as const, receipt: structuredClone(state.receipts[operationId]!.receipt) };
      state.fenced ??= {}; state.fenced[operationId] = true; return { status: "not-found" as const, terminal: true as const, operationId }; }, signal)
  };
  return { host,
    setFault(value: SyntheticFault) { fault = value; },
    initialize: () => transact(true, () => undefined),
    recovery: (id: string) => transact(false, state => state.tickets[id]),
    lastUndo: (id: string) => transact(false, state => Object.values(state.receipts).find(r => r.request.kind === "organize" && r.receipt.snapshot.documentId === id && organizationEqual(r.receipt.snapshot, snapshot(state, id)))),
    history: () => transact(false, state => Object.values(state.receipts).map(r => structuredClone(r.request))),
    clearRecovery: (id: string) => transact(true, state => { delete state.tickets[id]; }),
    edit: (base: OrganizationSnapshot, patch: { document?: EditorDocument; title?: string; parentPinned?: boolean; autoOrganize?: boolean }) => transact(true, state => {
      const old = snapshot(state, base.documentId); if (!organizationEqual(old, base)) throw new Error("synthetic_edit_conflict");
      const note = state.notes[base.documentId]!;
      if (patch.document) { note.document = structuredClone(patch.document); note.revision = `r${Number(note.revision.slice(1)) + 1}`; }
      if (patch.title !== undefined) { note.title = patch.title.trim() || "自由メモ"; note.titleManual = true; state.hierarchy++; note.pinRevision = `p${Number(note.pinRevision.slice(1)) + 1}`; }
      if (patch.parentPinned !== undefined || patch.autoOrganize !== undefined) { if (patch.parentPinned !== undefined) note.parentPinned = patch.parentPinned; if (patch.autoOrganize !== undefined) note.autoOrganize = patch.autoOrganize; note.pinRevision = `p${Number(note.pinRevision.slice(1)) + 1}`; }
      // Validate before persisting any human edit too.
      return snapshot(state, base.documentId);
    })
  };
}

/** Deliberately limited deterministic fixture, visibly labelled synthetic in the UI. */
export const syntheticNoteOrganizationAgent: NoteOrganizationAgent = {
  cancel: async () => {},
  prepare: async ({ snapshot: s, signal }) => {
    if (signal.aborted) throw new Error("cancelled");
    const plain = (b: EditorDocument["blocks"][number]) => Array.isArray(b.content) ? b.content.map(c => c && typeof c === "object" && "text" in c ? String(c.text) : "").join("") : typeof b.content === "string" ? b.content : "";
    const first = s.document.blocks.find(b => b.type === "paragraph" && plain(b).trim());
    const title = s.titleManual ? s.title : (first ? plain(first).trim().slice(0, 80) : s.title);
    const all = s.document.blocks.map(plain).join("\n"), candidates = s.pages.filter(p => p.id !== s.documentId && ["旅", "仕事"].includes(p.title) && all.includes(p.title));
    const parentId = s.parentPinned ? s.parentId : candidates[0]?.id ?? null;
    const plan = { documentId: s.documentId, revision: s.revision, hierarchyRevision: s.hierarchyRevision, pinRevision: s.pinRevision,
      title, parentId, placement: candidates.length > 1 ? "ambiguous" as const : "certain" as const,
      formats: s.document.blocks.filter(b => b.type === "paragraph" && plain(b).trim() && !b.children?.length).map(b => b === first ? { blockId: b.id, type: "heading" as const, level: 2 as const } : { blockId: b.id, type: "bulletListItem" as const }) };
    // The same reusable validator is used by the fixture and untrusted external agents.
    return createOrganizationRequest(s, plan, "validation-only").plan!;
  }
};
