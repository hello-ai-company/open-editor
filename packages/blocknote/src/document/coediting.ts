import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node, Slice } from "@tiptap/pm/model";

export type DocumentCoeditingIdentity = { actorId: string; workspaceId: string; documentKey: string; paneId: string; sessionId: string; revision: string; contentRevision: string };
export type DocumentCoeditingPolicy = { id: string; version: string; identity: Omit<DocumentCoeditingIdentity, "revision" | "contentRevision">; action: "wording" | "continuation"; maxSourceChars: number; maxOutputChars: number };
export type DocumentCoeditingAccess = { autoPolicy?: DocumentCoeditingPolicy; identity: DocumentCoeditingIdentity; available: boolean; composing: boolean; blockedReason?: string };
export type DocumentCoeditingRange = { blockId: string; from: number; to: number };
/** Writer-issued, session-local ticket. Offsets use UTF-16 within one text block. */
export type DocumentCoeditingTicket = Readonly<DocumentCoeditingRange & { id: string; writerId: string; identity: DocumentCoeditingIdentity; draftEpoch: number; requestEpoch: number; source: string; sourceHash: string; policy?: Readonly<{ id: string; version: string }> }>;
export type DocumentCoeditingProposal = Readonly<{ id: string; ticketId: string; text: string; outputHash: string; sourceHash: string }>;
export type DocumentCoeditingReview = Readonly<{ kind: "undo-conflict"; operationId: string; blockId: string; before: string; agent: string; current?: string }>;
export type DocumentCoeditingResult = { applied: true; operationId: string } | { applied: false; reason: string; review?: DocumentCoeditingReview };
export type DocumentCoeditingState = Readonly<{ active: boolean; draftEpoch: number; requestEpoch: number; ghost?: DocumentCoeditingProposal; undoIds: readonly string[]; reviewIds: readonly string[] }>;
export type DocumentCoeditingPort = {
  read(): DocumentCoeditingState; subscribe(listener: () => void): () => void;
  capture(range?: DocumentCoeditingRange): Promise<DocumentCoeditingTicket | undefined>;
  offer(ticket: DocumentCoeditingTicket, text: string): Promise<DocumentCoeditingProposal | undefined>;
  apply(proposal: DocumentCoeditingProposal, options: { mode: "reviewed" } | { mode: "auto-safe"; policyId: string; policyVersion: string }): DocumentCoeditingResult;
  undo(operationId: string): DocumentCoeditingResult;
  dismiss(): void; stop(): void; resume(): void;
};
export type DocumentCoeditingEditor = { readonly prosemirrorState: EditorState; readonly prosemirrorView: EditorView; isEditable: boolean; transact<T>(work: (transaction: Transaction) => T): T };
export type DocumentCoeditingOptions = { access(): DocumentCoeditingAccess; onApplied?(event: { operationId: string; kind: "apply" | "undo"; policyId?: string }): void; recentInputMs?: number; now?(): number; id?(): string };
const textKinds = new Set(["paragraph", "heading", "quote", "bulletListItem", "numberedListItem", "checkListItem"]);
const encode = (value: unknown) => JSON.stringify(value);
const hash = async (text: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, "0")).join("");
const overlaps = (a: { from: number; to: number }, b: { from: number; to: number }) => a.from <= b.to && a.to >= b.from;
const owner = (doc: Node, pos: number) => { const resolved = doc.resolve(pos); for (let depth = resolved.depth; depth > 0; depth--) if (typeof resolved.node(depth).attrs.id === "string") return resolved.node(depth).attrs.id as string; return undefined; };
function resolveRange(state: EditorState, range?: DocumentCoeditingRange) {
  let from = state.selection.from, to = state.selection.to;
  if (range) {
    if (!Number.isInteger(range.from) || !Number.isInteger(range.to) || range.from < 0 || range.to < range.from) return;
    let found: { from: number; node: Node } | undefined;
    state.doc.descendants((node, position) => { if (found) return false; if (node.attrs.id !== range.blockId) return true; if (node.isTextblock) found = { from: position + 1, node }; else node.descendants((child, offset) => { if (found) return false; if (child.isTextblock) { found = { from: position + offset + 2, node: child }; return false; } return true; }); return false; });
    if (!found || range.to > found.node.content.size) return; from = found.from + range.from; to = found.from + range.to;
  }
  const start = state.doc.resolve(from), end = state.doc.resolve(to), blockId = owner(state.doc, from);
  if (!blockId || !start.sameParent(end) || !textKinds.has(start.parent.type.name) || to - from > 2000) return;
  // Do not silently flatten links, mentions, assets, tables or other inline atoms.
  let plain = true; state.doc.nodesBetween(from, to, node => { if (node.isInline && !node.isText) plain = false; }); if (!plain) return;
  const source = state.doc.textBetween(from, to), text = start.parent.textContent;
  const bisects = (offset: number) => offset > 0 && /[\uD800-\uDBFF]/.test(text[offset - 1]!) && /[\uDC00-\uDFFF]/.test(text[offset] ?? "");
  if (bisects(start.parentOffset) || bisects(end.parentOffset)) return;
  return { from, to, blockId, offsetFrom: start.parentOffset, offsetTo: end.parentOffset, source, slice: state.doc.slice(from, to) };
}

type Tracked = { from: number; to: number; blockId: string; valid: boolean };
type Capture = Tracked & { ticket?: DocumentCoeditingTicket; identity: string; slice: string; requestEpoch: number };
type Applied = Tracked & { id: string; identity: string; before: Slice; beforeText: string; agentText: string; after: string; suggestionKey: string };
/** Public ProseMirror plugin + BlockNote transact only. No DOM mutation, provider,
 * canonical transport, second body writer or implicit application policy. */
export function createDocumentCoeditingSession(editor: DocumentCoeditingEditor, options: DocumentCoeditingOptions) {
  const id = options.id ?? (() => crypto.randomUUID()), now = options.now ?? Date.now;
  const writerId = id(), key = new PluginKey<{ epoch: number }>("openeditor-coediting");
  const captures = new Map<string, Capture>(), undos = new Map<string, Applied>(), suppressed = new Set<string>(), listeners = new Set<() => void>();
  let active = true, disposed = false, requestEpoch = 0, epoch = 0, offerEpoch = 0, ghost: { proposal: DocumentCoeditingProposal; capture: Capture } | undefined;
  let notificationQueued = false;
  let recent: { from: number; to: number; at: number }[] = [], composing = false, inputPending = false, snapshot: DocumentCoeditingState;
  const identityKey = (value: DocumentCoeditingIdentity, canonical = true) => encode(canonical ? value : { ...value, revision: undefined, contentRevision: undefined });
  const emit = () => { snapshot = Object.freeze({ active: active && !disposed, draftEpoch: epoch, requestEpoch, ...(ghost ? { ghost: ghost.proposal } : {}), undoIds: Object.freeze([...undos.values()].filter(v => v.valid).map(v => v.id)), reviewIds: Object.freeze([...undos.values()].filter(v => !v.valid).map(v => v.id)) }); if (!notificationQueued) { notificationQueued = true; queueMicrotask(() => { notificationQueued = false; for (const listener of listeners) { try { listener(); } catch { /* Observers cannot change editing outcomes. */ } } }); } };
  const clearGhost = () => { ghost = undefined; };
  const suppress = (value: string) => { suppressed.add(value); if (suppressed.size > 100) suppressed.delete(suppressed.values().next().value!); };
  const allowed = () => { const access = options.access(); return !disposed && editor.isEditable && access.available && !access.composing && !composing && !inputPending && !editor.prosemirrorView.composing; };
  const current = (capture: Capture) => capture.valid && capture.requestEpoch === requestEpoch && identityKey(options.access().identity) === capture.identity && owner(editor.prosemirrorState.doc, capture.from) === capture.blockId && encode(editor.prosemirrorState.doc.slice(capture.from, capture.to).toJSON()) === capture.slice;
  const invalidateComposition = () => { requestEpoch++; captures.clear(); clearGhost(); emit(); };
  const plugin = new Plugin<{ epoch: number }>({ key,
    state: { init: () => ({ epoch: 0 }), apply(tr, value) {
      if (!tr.docChanged) { if (tr.getMeta(key)) emit(); return value; }
      inputPending = false; epoch++; const agent = Boolean(tr.getMeta(key)?.agent);
      const tracked: Tracked[] = [...captures.values(), ...undos.values()];
      for (const map of tr.mapping.maps) {
        for (const entry of tracked) { map.forEach((from, to) => { if (overlaps(entry, { from, to })) entry.valid = false; }); entry.from = map.map(entry.from, 1); entry.to = map.map(entry.to, -1); }
        recent = recent.map(r => ({ ...r, from: map.map(r.from, 1), to: map.map(r.to, -1) }));
        if (!agent) map.forEach((_a, _b, from, to) => recent.push({ from, to, at: now() }));
      }
      for (const capture of captures.values()) if (capture.valid && (owner(tr.doc, capture.from) !== capture.blockId || encode(tr.doc.slice(capture.from, capture.to).toJSON()) !== capture.slice)) capture.valid = false;
      for (const entry of undos.values()) if (entry.valid && (owner(tr.doc, entry.from) !== entry.blockId || encode(tr.doc.slice(entry.from, entry.to).toJSON()) !== entry.after)) entry.valid = false;
      recent = recent.filter(r => now() - r.at < (options.recentInputMs ?? 1500)).slice(-32);
      if (ghost && !ghost.capture.valid) clearGhost();
      emit(); return { epoch: value.epoch + 1 };
    } },
    props: { decorations(state) {
      if (!ghost || !active || !allowed() || !current(ghost.capture)) return DecorationSet.empty;
      // Inline wording before a focused caret could reflow its row or shift
      // following text. Keep the proposal on the public port for host review,
      // but show inline only outside active typing, or after the current caret.
      const view = editor.prosemirrorView;
      if (view.hasFocus()) {
        let caret = state.selection.to;
        const native = view.dom?.ownerDocument.getSelection();
        if (native?.focusNode && view.dom.contains(native.focusNode)) { try { caret = Math.max(caret, view.posAtDOM(native.focusNode, native.focusOffset)); } catch { return DecorationSet.empty; } }
        if (ghost.capture.to <= caret && !(ghost.capture.from === ghost.capture.to && ghost.capture.to === caret && caret === state.selection.to)) return DecorationSet.empty;
      }
      const proposal = ghost.proposal;
      return DecorationSet.create(state.doc, [Decoration.widget(ghost.capture.to, view => {
        const element = view.dom.ownerDocument.createElement("span"); element.className = "oe-document-coediting-ghost"; element.textContent = proposal.text; element.setAttribute("aria-hidden", "true"); element.contentEditable = "false"; return element;
      }, { key: ghost.proposal.id, side: 1, ignoreSelection: true })]);
    }, handleDOMEvents: {
      focus: () => { queueMicrotask(() => { if (!disposed) refresh(); }); return false; },
      blur: () => { queueMicrotask(() => { if (!disposed) refresh(); }); return false; },
      beforeinput: view => {
        // Fence the interval before native input reaches the public PM document.
        // No native event is canceled, reimplemented or sent to a provider.
        inputPending = true;
        view.dom.ownerDocument.defaultView?.requestAnimationFrame(() => { inputPending = false; if (!disposed) refresh(); });
        return false;
      },
      compositionstart: () => { composing = true; invalidateComposition(); return false; },
      compositionend: () => { composing = false; invalidateComposition(); return false; }
    } },
    view: () => ({ destroy() { disposed = true; captures.clear(); undos.clear(); clearGhost(); emit(); listeners.clear(); } })
  });
  const refresh = () => { if (!disposed) editor.transact(tr => tr.setMeta(key, { refresh: true }).setMeta("addToHistory", false)); };
  const failure = (reason: string): DocumentCoeditingResult => ({ applied: false, reason });
  const port: DocumentCoeditingPort = {
    read: () => snapshot, subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async capture(range) {
      if (!active || !allowed()) return;
      const resolved = resolveRange(editor.prosemirrorState, range); if (!resolved) return;
      const captureEpoch = epoch, access = options.access(), captureId = id(), capture: Capture = { ...resolved, valid: true, identity: identityKey(access.identity), slice: encode(resolved.slice.toJSON()), requestEpoch };
      const capturedPolicy = access.autoPolicy ? { id: access.autoPolicy.id, version: access.autoPolicy.version } : undefined;
      captures.clear(); clearGhost(); captures.set(captureId, capture); refresh();
      const sourceHash = await hash(capture.slice);
      if (!active || !allowed() || captures.get(captureId) !== capture || !current(capture)) return;
      const ticket = Object.freeze({ id: captureId, writerId, identity: Object.freeze({ ...access.identity }), draftEpoch: captureEpoch, requestEpoch, blockId: resolved.blockId, from: resolved.offsetFrom, to: resolved.offsetTo, source: resolved.source, sourceHash, ...(capturedPolicy ? { policy: Object.freeze(capturedPolicy) } : {}) });
      capture.ticket = ticket; return ticket;
    },
    async offer(ticket, text) {
      const capture = captures.get(ticket.id);
      if (!capture?.ticket || encode(ticket) !== encode(capture.ticket) || !active || !allowed() || !current(capture) || typeof text !== "string" || !text || text.length > 2000 || /[\r\n]/.test(text)) return;
      const offerRun = ++offerEpoch, outputHash = await hash(text), suggestionKey = ticket.sourceHash + outputHash;
      if (offerRun !== offerEpoch || suppressed.has(suggestionKey) || !active || !allowed() || captures.get(ticket.id) !== capture || !current(capture)) return;
      const proposal = Object.freeze({ id: id(), ticketId: ticket.id, text, outputHash, sourceHash: ticket.sourceHash }); ghost = { proposal, capture }; refresh(); return proposal;
    },
    apply(proposal, applyOptions) {
      if (!active || !allowed()) return failure(options.access().blockedReason ?? "Editing or composition is blocked");
      if (!ghost || encode(proposal) !== encode(ghost.proposal) || !current(ghost.capture)) return failure("Proposal or source range changed");
      const capture = ghost.capture, state = editor.prosemirrorState;
      if (applyOptions.mode === "auto-safe") {
        const policy = options.access().autoPolicy;
        if (!policy || !applyOptions.policyId?.trim() || policy.id !== applyOptions.policyId || policy.version !== applyOptions.policyVersion || capture.ticket?.policy?.id !== policy.id || capture.ticket.policy.version !== policy.version || identityKey({ ...policy.identity, revision: "", contentRevision: "" }, false) !== identityKey(options.access().identity, false)) return failure("Explicit matching document/session auto-safe policy required");
        if (![policy.maxSourceChars, policy.maxOutputChars].every(n => Number.isInteger(n) && n > 0 && n <= 2000) || capture.ticket.source.length > policy.maxSourceChars || proposal.text.length > policy.maxOutputChars || policy.action === "continuation" && capture.from !== capture.to || policy.action === "wording" && capture.from === capture.to || !["wording", "continuation"].includes(policy.action)) return failure("Suggestion exceeds the scoped policy bounds");
        const view = editor.prosemirrorView, native = view.dom?.ownerDocument.getSelection();
        let nativeRange: { from: number; to: number } | undefined;
        if (view.hasFocus() && native?.anchorNode && native.focusNode && view.dom.contains(native.anchorNode) && view.dom.contains(native.focusNode)) {
          try { const anchor = view.posAtDOM(native.anchorNode, native.anchorOffset), head = view.posAtDOM(native.focusNode, native.focusOffset); nativeRange = { from: Math.min(anchor, head), to: Math.max(anchor, head) }; }
          catch { return failure("Native input range is unsettled"); }
        }
        if (view.hasFocus() && (overlaps(capture, state.selection) || nativeRange && overlaps(capture, nativeRange)) || recent.some(r => now() - r.at < (options.recentInputMs ?? 1500) && overlaps(capture, r))) return failure("Active or recent human input is protected");
      } else if (applyOptions.mode !== "reviewed") return failure("Application mode required");
      const operationId = id(), before = state.doc.slice(capture.from, capture.to), suggestionKey = proposal.sourceHash + proposal.outputHash;
      const applied: Applied = { from: capture.from, to: capture.from + proposal.text.length, blockId: capture.blockId, valid: true, id: operationId, identity: identityKey(options.access().identity, false), before, beforeText: capture.ticket!.source, agentText: proposal.text, after: "", suggestionKey };
      captures.clear(); clearGhost();
      editor.transact(tr => tr.insertText(proposal.text, capture.from, capture.to).setMeta(key, { agent: true, operationId, kind: "apply" }).setMeta("addToHistory", false));
      applied.after = encode(editor.prosemirrorState.doc.slice(applied.from, applied.to).toJSON()); undos.set(operationId, applied); if (undos.size > 20) undos.delete(undos.keys().next().value!); emit(); refresh();
      options.onApplied?.({ operationId, kind: "apply", ...(applyOptions.mode === "auto-safe" ? { policyId: applyOptions.policyId } : {}) });
      return { applied: true, operationId };
    },
    undo(operationId) {
      const entry = undos.get(operationId), state = editor.prosemirrorState;
      if (!allowed() || !entry || identityKey(options.access().identity, false) !== entry.identity) return failure("Editing session changed or input is protected");
      if (!entry.valid || owner(state.doc, entry.from) !== entry.blockId || encode(state.doc.slice(entry.from, entry.to).toJSON()) !== entry.after) {
        const currentText = owner(state.doc, entry.from) === entry.blockId && owner(state.doc, entry.to) === entry.blockId ? state.doc.textBetween(entry.from, entry.to).slice(0, 2000) : undefined;
        return { applied: false, reason: "AI range changed; review a diff instead of replacing the document", review: Object.freeze({ kind: "undo-conflict", operationId, blockId: entry.blockId, before: entry.beforeText, agent: entry.agentText, ...(currentText !== undefined ? { current: currentText } : {}) }) };
      }
      undos.delete(operationId); suppress(entry.suggestionKey); clearGhost(); captures.clear(); requestEpoch++;
      editor.transact(tr => tr.replace(entry.from, entry.to, entry.before).setMeta(key, { agent: true, operationId, kind: "undo" }).setMeta("addToHistory", false));
      emit(); refresh(); options.onApplied?.({ operationId, kind: "undo" }); return { applied: true, operationId };
    },
    dismiss() { if (ghost) suppress(ghost.proposal.sourceHash + ghost.proposal.outputHash); clearGhost(); captures.clear(); requestEpoch++; refresh(); emit(); },
    stop() { active = false; requestEpoch++; captures.clear(); clearGhost(); refresh(); emit(); },
    resume() { if (disposed) return; active = true; requestEpoch++; captures.clear(); clearGhost(); refresh(); emit(); }
  };
  emit();
  const extension = createExtension({ key: "openeditor-document-coediting", prosemirrorPlugins: [plugin] });
  return { port, plugin, extension, syncAccess() {
    for (const capture of captures.values()) if (identityKey(options.access().identity) !== capture.identity) capture.valid = false;
    if (ghost && (!allowed() || !current(ghost.capture))) clearGhost();
    refresh(); emit();
  }, dispose() { disposed = true; active = false; requestEpoch++; captures.clear(); clearGhost(); undos.clear(); emit(); listeners.clear(); } };
}
