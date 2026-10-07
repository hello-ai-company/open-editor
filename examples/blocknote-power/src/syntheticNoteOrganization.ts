import { createOrganizationRequest, parseOrganizationRecovery, parseOrganizationSnapshot, organizationEqual, organizationUndoMatches, validateOrganizationRequest,
  type OrganizationSnapshot, type OrganizationRequest, type OrganizationReceipt, type OrganizationCommitResult, type NoteOrganizationHost, type NoteOrganizationAgent, type OrganizationRecovery, type AgentNoteAssistance, type AgentLinkEdit } from "@hello-ai-company/editor-ai";
import type { EditorDocument } from "@hello-ai-company/editor-core";

type Workspace = { hierarchy: number; notes: Record<string, Omit<OrganizationSnapshot, "pages" | "root" | "hierarchyRevision">>; receipts: Record<string, { request: OrganizationRequest; receipt: OrganizationReceipt }>; tickets: Record<string, OrganizationRecovery>; fenced: Record<string, true>; approvals?: Record<string, OrganizationRequest> };
export type SyntheticFault = "none" | "move-failure" | "lost-ack" | "offline";
const paragraph = (id: string, value: string) => ({ id, type: "paragraph", props: { backgroundColor: "default", textColor: "default", textAlignment: "left" }, content: [{ type: "text", text: value, styles: {} }] });
export function createSyntheticOrganizationSeed(assistance?: AgentNoteAssistance): Workspace {
  const notes: Workspace["notes"] = {};
  for (const [id, title, body] of [["note", "自由メモ", "旅の準備\n持ち物は3点。パスポートは不要ではない。\n天気は未確認。"], ["travel", "旅", "旅の記録"], ["work", "仕事", "仕事の記録"], ["another", "別の自由メモ", "仕事の予定\n予算は未定。"]]) {
    notes[id!] = { documentId: id!, revision: "r1", pinRevision: "p1", document: { schemaVersion: 1, blocks: body!.split("\n").map((s, i) => paragraph(`${id}-${i}`, s)) }, title: title!, parentId: null, titleManual: false, parentPinned: false, autoOrganize: false };
  }
  if (assistance) {
    for (const n of Object.values(notes)) n.assistance = structuredClone(assistance);
    notes.note!.document.blocks.push(paragraph("note-url", "参考 https://example.com/guide と [旅]。外部ページは未確認。"));
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
  if (request.authorization === "approved" && (!state.approvals || !Object.hasOwn(state.approvals, request.operationId) || !organizationEqual(state.approvals[request.operationId], request))) return refuse("rejected");
  if (request.kind === "undo") {
    const history = Object.hasOwn(state.receipts, request.undoOperationId!) ? state.receipts[request.undoOperationId!] : undefined;
    if (!history || history.request.kind !== "organize" || !organizationUndoMatches(history.receipt.snapshot, before) || !organizationEqual(request.after, { document: history.request.before.document, title: history.request.before.title, parentId: history.request.before.parentId })) return refuse("rejected");
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
export function createSyntheticOrganizationHost(databaseName = "open-editor.synthetic-organization.v1", assistance?: AgentNoteAssistance) {
  let connection: Promise<IDBDatabase> | undefined, fault: SyntheticFault = "none";
  const selections = new Map<string, AgentNoteAssistance["selection"]>(); let selectionEpoch = 0;
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
      const r = store.get("tree"); r.onsuccess = () => { try { const state: Workspace = r.result ?? createSyntheticOrganizationSeed(assistance); for (const n of Object.values(state.notes)) { const selection = selections.get(n.documentId); if (n.assistance && selection) n.assistance.selection = structuredClone(selection); } result = fn(state); if (write) store.put(state, "tree"); } catch (e) { error = e; tx.abort(); } };
    });
  };
  const host: NoteOrganizationHost = {
    read: (id, signal) => transact(false, state => snapshot(state, id), signal),
    beforeSubmit: ticket => transact(true, state => { state.tickets[ticket.request.before.documentId] = structuredClone(ticket); }),
    approveProposal: (request, signal) => transact(true, state => {
      if (request.authorization !== "approved") throw new Error("synthetic_approval_required");
      validateOrganizationRequest(request, snapshot(state, request.before.documentId));
      state.approvals ??= {};
      if (Object.hasOwn(state.approvals, request.operationId) && !organizationEqual(state.approvals[request.operationId], request)) throw new Error("synthetic_approval_payload_conflict");
      state.approvals[request.operationId] = structuredClone(request);
    }, signal),
    commit: async (request, signal) => {
      const result = await transact(true, state => applySyntheticOrganization(state, request, fault), signal);
      if (fault === "lost-ack" && result.status === "committed") throw new Error("synthetic_ack_lost");
      return result;
    },
    lookupOperation: (operationId, signal) => transact(true, state => { if (Object.hasOwn(state.receipts, operationId)) return { status: "committed" as const, receipt: structuredClone(state.receipts[operationId]!.receipt) };
      state.fenced ??= {}; state.fenced[operationId] = true; return { status: "not-found" as const, terminal: true as const, operationId }; }, signal)
  };
  return { host,
    captureSelection(id: string, blockIds: string[]) { const next = { revision: `selection-${++selectionEpoch}-${crypto.randomUUID()}`, blockIds: [...blockIds] }; selections.set(id, next); return next; },
    setFault(value: SyntheticFault) { fault = value; },
    initialize: () => transact(true, () => undefined),
    recovery: (id: string) => transact(false, state => state.tickets[id]),
    lastUndo: (id: string) => transact(false, state => Object.values(state.receipts).find(r => r.request.kind === "organize" && r.receipt.snapshot.documentId === id && organizationUndoMatches(r.receipt.snapshot, snapshot(state, id)))),
    history: () => transact(false, state => Object.values(state.receipts).map(r => structuredClone(r.request))),
    lastApplied: (id: string) => transact(false, state => Object.values(state.receipts).find(r => r.receipt.snapshot.documentId === id && organizationUndoMatches(r.receipt.snapshot, snapshot(state, id)))),
    clearRecovery: (id: string) => transact(true, state => { delete state.tickets[id]; }),
    edit: (base: OrganizationSnapshot, patch: { document?: EditorDocument; title?: string; parentPinned?: boolean; autoOrganize?: boolean; assistance?: AgentNoteAssistance }) => transact(true, state => {
      const old = snapshot(state, base.documentId), expected = structuredClone(base); if (old.assistance && expected.assistance) expected.assistance.selection = old.assistance.selection;
      if (!organizationEqual(old, expected)) throw new Error("synthetic_edit_conflict");
      const note = state.notes[base.documentId]!;
      if (patch.document) { note.document = structuredClone(patch.document); note.revision = `r${Number(note.revision.slice(1)) + 1}`; }
      if (patch.title !== undefined) { note.title = patch.title.trim() || "自由メモ"; note.titleManual = true; state.hierarchy++; note.pinRevision = `p${Number(note.pinRevision.slice(1)) + 1}`; }
      if (patch.parentPinned !== undefined || patch.autoOrganize !== undefined) { if (patch.parentPinned !== undefined) note.parentPinned = patch.parentPinned; if (patch.autoOrganize !== undefined) note.autoOrganize = patch.autoOrganize; note.pinRevision = `p${Number(note.pinRevision.slice(1)) + 1}`; }
      if (patch.assistance && note.assistance) { note.assistance = { ...structuredClone(patch.assistance), selection: note.assistance.selection }; note.pinRevision = `p${Number(note.pinRevision.slice(1)) + 1}`; }
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
    if (s.assistance) return prepareCapabilityAwarePlan(s);
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

/** Restrained intent fixture: a short opening line, explicit list cues, URLs already in the note, exact [page] references. */
export function prepareCapabilityAwarePlan(s: OrganizationSnapshot) {
  const a = s.assistance!; const allowed = (op: string) => a.capabilities.operations.includes(op as never) && (op.startsWith("link.") ? a.proposalsAllowed || a.autoLinks : a.proposalsAllowed || s.autoOrganize);
  const inSelection = (id: string) => !a.selection.blockIds.length || a.selection.blockIds.includes(id);
  const plain = (b: EditorDocument["blocks"][number]) => Array.isArray(b.content) && b.content.every(c => c && typeof c === "object" && !Array.isArray(c) && c.type === "text" && typeof c.text === "string") ? b.content.map(c => (c as { text: string }).text).join("") : "";
  const first = s.document.blocks[0], opening = first ? plain(first).trim() : "";
  const formats: { blockId: string; type: "heading" | "bulletListItem"; level?: 1 | 2 | 3 }[] = [];
  if (first?.type === "paragraph" && !first.children?.length && opening.length > 0 && opening.length <= 60 && !/[。！？.!?]|https?:/.test(opening) && allowed("heading") && inSelection(first.id)) formats.push({ blockId: first.id, type: "heading", level: 2 });
  for (const b of s.document.blocks.slice(1)) if (formats.length < 4 && allowed("bulletListItem") && inSelection(b.id) && b.type === "paragraph" && !b.children?.length && /^[-・]\s*\S/.test(plain(b))) formats.push({ blockId: b.id, type: "bulletListItem" });
  const links: AgentLinkEdit[] = []; const seen = new Set<string>();
  const own = s.pages.find(p => p.id === s.documentId)!;
  for (const b of s.document.blocks) {
    if (!inSelection(b.id) || b.children?.length || !["paragraph", "heading", "bulletListItem", "numberedListItem"].includes(b.type) || !Array.isArray(b.content)) continue;
    for (let index = 0; index < b.content.length && links.length < 4; index++) {
      const c = b.content[index]; if (!c || typeof c !== "object" || Array.isArray(c)) continue;
      if (c.type === "text" && typeof c.text === "string" && allowed("link.add")) {
        const m = /https?:\/\/[^\s<>"'）)。、]+/.exec(c.text);
        if (m) { try { const u = new URL(m[0]); if (!u.username && !u.password) links.push({ blockId: b.id, index, action: "add", start: m.index, end: m.index + m[0].length, href: m[0] }); } catch { /* no invented correction */ } }
        else {
          const p = a.proposalsAllowed ? s.pages.find(p => p.id !== s.documentId && p.editable && p.scope === own.scope && p.sharing === own.sharing && c.text!.toString().includes(`[${p.title}]`)) : undefined;
          if (p) { const start = c.text.indexOf(`[${p.title}]`) + 1; links.push({ blockId: b.id, index, action: "add", start, end: start + p.title.length, href: `oe-page:${p.id}` }); }
        }
      } else if (c.type === "link" && typeof c.href === "string") {
        try {
          const href = c.href.startsWith("oe-page:") ? c.href : new URL(c.href).href;
          if (seen.has(href) && allowed("link.remove") && a.proposalsAllowed) links.push({ blockId: b.id, index, action: "remove" });
          else if (href !== c.href && allowed("link.edit")) links.push({ blockId: b.id, index, action: "edit", href });
          else if (href.startsWith("oe-page:") && allowed("link.edit") && a.proposalsAllowed) {
            const p = s.pages.find(p => p.id === href.slice(8)); const content = c.content;
            if (p && Array.isArray(content) && content.length === 1 && content[0] && typeof content[0] === "object" && !Array.isArray(content[0]) && content[0].type === "text" && content[0].text !== p.title) links.push({ blockId: b.id, index, action: "edit", href, label: p.title });
          }
          seen.add(href);
        } catch { /* unsafe links are preserved, never followed */ }
      }
    }
  }
  const title = !a.selection.blockIds.length && allowed("title") && !s.titleManual && opening && opening.length <= 80 ? opening : s.title;
  const all = s.document.blocks.map(plain).join("\n"), candidates = s.pages.filter(p => p.id !== s.documentId && p.editable && p.scope === own.scope && p.sharing === own.sharing && ["旅", "仕事"].includes(p.title) && all.includes(p.title));
  const parentId = !a.selection.blockIds.length && allowed("placement") && !s.parentPinned ? candidates[0]?.id ?? s.parentId : s.parentId;
  return { documentId: s.documentId, revision: s.revision, hierarchyRevision: s.hierarchyRevision, pinRevision: s.pinRevision, formats, title, parentId, placement: candidates.length > 1 ? "ambiguous" as const : "certain" as const,
    assistance: { capabilityRevision: a.capabilities.revision, selectionRevision: a.selection.revision, reason: links.length ? "原文中のURL・ページ参照を使いやすくします。参照先は未確認です。削除しても表示文は保持します。" : "短い冒頭を見出しにし、明示された箇条書きだけ整えます。文章の意味や事実は変えません。", links } };
}
