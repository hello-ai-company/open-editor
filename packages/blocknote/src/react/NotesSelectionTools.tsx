import { NotesIcon } from "./notesPresentation.js";
import { NotesSelectionActionsContext, notesSelectionToolbarButtons } from "./NotesFormattingToolbar.js";
import { notesRequestInsertion } from "./NotesInsertionCommands.js";
import { NotesPlusMenu } from "./NotesPlusMenu.js";
import { NotesFloatingSurface } from "./NotesFloatingSurface.js";
import { NotesFeedbackControl, useNotesFeedback } from "./NotesFeedback.js";
import { useEffect, useRef, useState, useSyncExternalStore, useId, type ReactNode } from "react";
import type { NotesWorkspaceController } from "../notes/contracts.js";
import type { NotesSelectionAction, NotesSelectionAIRequest, NotesSelectionAIService, NotesSelectionProposalEntry, NotesTextSelection } from "./notesSelection.js";
import { NotesOverlayPortal } from "./NotesOverlayPortal.js";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";
import { NotesPanelStatus, notesIsComposing, notesTargetKey, useLocalNotesDraft, useNotesComposition, useNotesController, useNotesPanelCommands, type NotesEditorBridge } from "./notesWorkspacePanels.js";

type SelectionDraft = { kind: "selection"; mode: "ai" | "comment"; selection: NotesTextSelection; baseRevision: string; command: { kind: "comment.add"; blockId: string; text: string }; instruction: string; action: NotesSelectionAction; proposal: string; text: string; providerId: string };
const providers = new WeakMap<NotesSelectionAIService, string>();
function providerIdentity(service?: NotesSelectionAIService): string { if (!service) return ""; if (!providers.has(service)) providers.set(service, crypto.randomUUID()); return providers.get(service)!; }
function validDraft(value: SelectionDraft | undefined): boolean {
  if (!value || typeof value !== "object" || value.kind !== "selection" || !["ai", "comment"].includes(value.mode) || !value.selection || typeof value.selection !== "object") return false;
  const s = value.selection;
  return typeof s.id === "string" && typeof s.blockId === "string" && typeof s.text === "string" && s.text.length > 0 && s.text.length <= 50000 && typeof s.revision === "string" && typeof s.contentRevision === "string" && !!s.scope && typeof s.scope.actorId === "string" && typeof s.scope.workspaceId === "string" && !!s.target && ["page", "row"].includes(s.target.kind) && value.baseRevision === s.revision && typeof value.providerId === "string" && value.providerId.length <= 128 && typeof value.instruction === "string" && value.instruction.length <= 4000 && ["improve", "shorten", "expand", "rewrite"].includes(value.action) && typeof value.proposal === "string" && value.proposal.length <= 50000 && typeof value.text === "string" && value.text.length <= 10000 && value.command?.kind === "comment.add" && value.command.blockId === s.blockId && value.command.text === value.text;
}
const actions: Record<NotesSelectionAction, [string, string]> = { improve: ["Improve writing", "読みやすくする"], shorten: ["Make concise", "短くする"], expand: ["Expand", "詳しくする"], rewrite: ["Change tone", "トーンを変える"] };
const noopSubscribe = () => () => {}, zero = () => 0;
export function NotesSelectionTools({ controller, bridge, service, proposalEntry, children, integrated = false, language = "ja" }: { controller: NotesWorkspaceController; bridge: NotesEditorBridge; service?: NotesSelectionAIService; proposalEntry?: NotesSelectionProposalEntry; children?: ReactNode; integrated?: boolean; language?: "ja" | "en" }) {
  const controlsId = useId();
  const findControls = () => [...document.querySelectorAll<HTMLElement>("[data-notes-selection-controls]")].find(element => element.dataset.notesSelectionControls === controlsId && (element.getBoundingClientRect().width > 0 || (element.querySelector("button")?.getBoundingClientRect().width ?? 0) > 0));
  const state = useNotesController(controller), draft = useLocalNotesDraft<SelectionDraft>(controller, "oe.text.selection"), ops = useNotesPanelCommands(controller);
  const selectionVersion = useSyncExternalStore(bridge.subscribeSelection ?? noopSubscribe, bridge.getSelectionVersion ?? zero, zero);
  useEffect(() => { if (!(bridge.hasFormattingSelection?.() ?? bridge.hasTextSelection?.())) setDismissedVersion(undefined); }, [bridge, selectionVersion]);
  const feedback = useNotesFeedback(), sourceAnchor = useRef<HTMLSpanElement>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | number>();
  const selectionIdentity = bridge.getSelectionIdentity?.() ?? selectionVersion;
  const toolbarRoot = () => [...document.querySelectorAll<HTMLElement>("[data-notes-selection-toolbar]")].find(element => element.dataset.notesSelectionToolbar === controlsId) ?? findControls();
  const dismissToolbar = () => { setDismissedVersion(selectionIdentity); bridge.focusEditor?.(); };
  const ja = language === "ja", [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [undoId, setUndoId] = useState<string>();
  const root = useRef<HTMLDivElement>(null), flight = useRef<AbortController | null>(null), live = useRef(true);
  const invalid = draft.value !== undefined && !validDraft(draft.value), value = !invalid ? draft.value : undefined, current = !!value && (value.mode === "comment" || value.providerId === providerIdentity(service)) && !!bridge.isSelectionCurrent?.(value.selection), otherInput = Object.keys(state.localDrafts).some(key => key !== draft.id);
  const safe = current && state.snapshot?.capabilities.includes("document.save") === true && state.status === "ready" && !state.composing && !state.recovery && !state.manualSaveRequired && !otherInput;
  const [unavailable, setUnavailable] = useState<"ai" | "comment">(), [insertSelection, setInsertSelection] = useState<NotesTextSelection>();
  const entryFlight = useRef<AbortController | null>(null), insertFlight = useRef<AbortController | null>(null);
  const binding = useRef(proposalEntry); binding.current = proposalEntry;
  const serviceBinding = useRef(service); serviceBinding.current = service;
  const entryBusy = useRef(false);
  const availabilityReason = (mode: "ai" | "comment") => {
    if (mode === "ai") return ja ? "このホストでは選択文のAI編集サービスと提案レビューの入口が未接続です。本文は変更されていません。" : "Selection AI and the host proposal review entry are not connected. The document is unchanged.";
    const latest = controller.getState();
    if (!latest.snapshot?.capabilities.includes("comment.add") || !latest.snapshot.capabilitySemantics["comment.add"]) return ja ? "このホストではコメントの保存権限または保存先が提供されていません。" : "This host has not provided comment permission or persistence.";
    return latest.dirty ? (ja ? "本文の保存が完了してからコメントできます。入力は保持されています。" : "Save the document before commenting. Your input is retained.") : (ja ? "選択元のブロックにコメントを保存します" : "Save a comment on the source block");
  };
  const entryCurrent = (selection: NotesTextSelection) => { const latest = controller.getState(); return live.current && bridge.commandsAvailable !== false && bridge.isSelectionCurrent?.(selection) === true && latest.status === "ready" && !latest.composing && !latest.pendingEditors && !latest.recovery && !latest.manualSaveRequired && latest.snapshot?.capabilities.includes("document.save") === true; };
  useEffect(() => { return () => { entryFlight.current?.abort(); entryBusy.current = false; }; }, [controller, bridge, proposalEntry, service]);
  useEffect(() => () => { insertFlight.current?.abort(); }, [controller, bridge]);
  useEffect(() => { if (state.composing || state.status !== "ready" || state.pendingEditors || state.recovery || state.manualSaveRequired) { entryFlight.current?.abort(); insertFlight.current?.abort(); setInsertSelection(undefined); } }, [state.composing, state.status, state.pendingEditors, state.recovery, state.manualSaveRequired]);
  const composition = useNotesComposition(controller, open);
  useDialogFocusTrap(open || !!unavailable, root);
  useEffect(() => { live.current = true; return () => { live.current = false; flight.current?.abort(); }; }, [controller, bridge]);
  useEffect(() => { flight.current?.abort(); flight.current = null; setBusy(false); }, [service, bridge, controller, safe, open]);
  const start = (mode: SelectionDraft["mode"]) => {
    if (value) { setOpen(true); return; }
    const latest = controller.getState();
    if (!latest.snapshot?.capabilities.includes("document.save")) { setMessage(ja ? "この文書を編集する権限を確認してください" : "Check permission to edit this document"); return; }
    if (mode === "ai" && !service) {
      if (!proposalEntry) { setUnavailable("ai"); return; }
      if (entryBusy.current || latest.pendingEditors || latest.composing || latest.status !== "ready" || latest.recovery || latest.manualSaveRequired || !draft.isCurrent()) return;
      const selection = bridge.captureSelection?.(); if (!selection || !entryCurrent(selection)) { setMessage(ja ? "同じブロック内の文章を選択してください" : "Select text within a single block"); return; }
      entryFlight.current?.abort();
      const abort = new AbortController(), entry = proposalEntry; entryFlight.current = abort; entryBusy.current = true;
      const isCurrent = () => !abort.signal.aborted && binding.current === entry && !serviceBinding.current && entryCurrent(selection);
      try { const result = entry.open({ selection, signal: abort.signal, isCurrent }); Promise.resolve(result).catch(() => { if (isCurrent()) setMessage(ja ? "提案レビューを開けませんでした。本文は保持しています" : "Could not open proposal review. The document is retained."); }).finally(() => { if (entryFlight.current === abort) { entryBusy.current = false; } }); } catch { entryFlight.current = null; entryBusy.current = false; setMessage(ja ? "提案レビューを開けませんでした。本文は保持しています" : "Could not open proposal review. The document is retained."); }
      return;
    }
    if (mode === "comment" && (latest.dirty || !latest.snapshot?.capabilities.includes("comment.add") || !latest.snapshot.capabilitySemantics["comment.add"])) { setUnavailable("comment"); return; }
    if (latest.pendingEditors || latest.composing || latest.status !== "ready" || latest.recovery || latest.manualSaveRequired || !draft.isCurrent()) return;
    const selection = bridge.captureSelection?.(); if (!selection) { setMessage(ja ? "同じブロック内の文章を選択してください" : "Select text within a single block"); return; }
    if (!draft.compareSet({ kind: "selection", mode, selection, baseRevision: selection.revision, command: { kind: "comment.add", blockId: selection.blockId, text: "" }, instruction: "", action: "improve", proposal: "", text: "", providerId: providerIdentity(service) })) { setMessage(ja ? "新しい入力を保持しています" : "Newer input is retained"); return; } setMessage(""); setOpen(true);
  };
  const restoreEditorFocus = () => {
    const before = document.activeElement, owner = sourceAnchor.current, snapshot = controller.getState().snapshot;
    requestAnimationFrame(() => {
      const latest = controller.getState(), active = document.activeElement;
      if (live.current && !latest.composing && owner?.isConnected && latest.snapshot === snapshot && (active === document.body || active === before)) bridge.focusEditor?.();
    });
  };
  const closeUnavailable = () => { setUnavailable(undefined); restoreEditorFocus(); };
  const close = () => { flight.current?.abort(); flight.current = null; setBusy(false); setOpen(false); restoreEditorFocus(); };
  const update = (patch: Partial<SelectionDraft>) => { if (value && !busy && !ops.busy) draft.compareSet({ ...value, ...patch }); };
  const run = async () => {
    const latest = controller.getState();
    if (!value || !safe || !service || busy || flight.current || !draft.isCurrent() || !bridge.isSelectionCurrent?.(value.selection) || latest.composing || latest.status !== "ready" || latest.recovery || latest.manualSaveRequired || !latest.snapshot?.capabilities.includes("document.save") || Object.keys(latest.localDrafts).some(key => key !== draft.id)) return;
    const abort = new AbortController(), captured = value, capturedVersion = JSON.stringify(value); flight.current = abort; setBusy(true); setMessage("");
    const selection = value.selection, request: NotesSelectionAIRequest = { requestId: crypto.randomUUID(), scope: selection.scope, target: selection.target, revision: selection.revision, contentRevision: selection.contentRevision, selection: { id: selection.id, blockId: selection.blockId, text: selection.text }, action: value.action, instruction: value.instruction, signal: abort.signal };
    try {
      const result = await service.run(request);
      if (abort.signal.aborted || !live.current || flight.current !== abort) return;
      if (result.requestId !== request.requestId || result.selectionId !== selection.id || result.scope.actorId !== selection.scope.actorId || result.scope.workspaceId !== selection.scope.workspaceId || notesTargetKey(result.target) !== notesTargetKey(selection.target) || result.revision !== selection.revision || result.contentRevision !== selection.contentRevision || typeof result.text !== "string" || !result.text.trim() || result.text.length > 50000) throw new Error("Mismatched result");
      const latest = controller.getState();
      if (!bridge.isSelectionCurrent?.(selection) || JSON.stringify(latest.localDrafts[draft.id]) !== capturedVersion || latest.composing || latest.status !== "ready" || latest.recovery || latest.manualSaveRequired || !latest.snapshot?.capabilities.includes("document.save") || Object.keys(latest.localDrafts).some(key => key !== draft.id)) throw new Error("Selection changed");
      draft.compareSet({ ...captured, proposal: result.text });
    } catch { if (live.current && !abort.signal.aborted) setMessage(ja ? "提案を確認できませんでした。入力を保持しています" : "Could not verify the suggestion. Your input is retained."); }
    finally { if (flight.current === abort) { flight.current = null; if (live.current) setBusy(false); } }
  };
  useEffect(() => {
    if (!open && message && feedback) feedback.announce(message, "error");
  }, [feedback, message, open]);
  useEffect(() => {
    const keyboard = (event: globalThis.KeyboardEvent) => {
      if (open || unavailable || insertSelection || controller.getState().composing || event.isComposing || event.keyCode === 229 || event.defaultPrevented) return;
      const owner = sourceAnchor.current?.closest(".oe-notes-workspace") ?? sourceAnchor.current?.parentElement;
      const within = !!owner?.contains(document.activeElement) || !!toolbarRoot()?.contains(document.activeElement);
      if (!within || !(bridge.hasFormattingSelection?.() ?? bridge.hasTextSelection?.())) return;
      // Escape belongs to an open color/type/link menu before it belongs to the bar.
      if (document.activeElement instanceof Element && document.activeElement.closest('[role="menu"],[role="dialog"],[role="listbox"],.bn-menu-dropdown,.bn-popover-content')) return;
      if (event.key === "Escape") { event.preventDefault(); setDismissedVersion(selectionIdentity); if (toolbarRoot()?.contains(document.activeElement)) bridge.focusEditor?.(); }
      if (event.key === "F8") { event.preventDefault(); event.stopPropagation(); setDismissedVersion(undefined); bridge.showSelectionToolbar?.(); requestAnimationFrame(() => { const root = toolbarRoot(); if (root) notesSelectionToolbarButtons(root)[0]?.focus({ preventScroll: true }); }); }
    };
    document.addEventListener("keydown", keyboard, true);
    return () => document.removeEventListener("keydown", keyboard, true);
  }, [controller, bridge, open, unavailable, insertSelection, selectionIdentity, controlsId]);
  if (invalid) return <>{children}<NotesFeedbackControl id="invalid-selection"><div role="status">{ja ? "保持した選択編集の入力を確認できません" : "Retained selection input could not be verified"}<button type="button" disabled={state.composing || state.status !== "ready"} onClick={() => draft.compareSet(undefined)}>{ja ? "キャンセル" : "Cancel"}</button></div></NotesFeedbackControl></>;
  const visible = !open && !unavailable && !insertSelection && !!bridge.hasTextSelection?.() && dismissedVersion !== selectionIdentity;
  const undo = () => {
    if (!undoId) return;
    let undone = false;
    try { undone = bridge.undoSelection?.(undoId) === true; } catch { /* Stale writer remains unchanged. */ }
    if (undone) { setUndoId(undefined); if (feedback) feedback.announce(ja ? "AI置換を取り消しました。未保存です" : "AI replacement undone. Unsaved.", "success"); else setMessage(ja ? "置換を取り消しました。保存状態を確認してください" : "Replacement undone. Check the save state."); }
    else setMessage(ja ? "置換後に変更されています。取り消せません" : "The document changed after replacement; Undo is unavailable.");
  };
  const aiConnected = !!service || !!proposalEntry;
  const commentConnected = !!state.snapshot?.capabilities.includes("comment.add") && !!state.snapshot.capabilitySemantics["comment.add"];
  const blocked = !bridge.captureSelection || bridge.commandsAvailable === false || state.composing || state.pendingEditors || state.status !== "ready" || !!state.recovery || state.manualSaveRequired === true;
  const aiLabel = aiConnected ? (ja ? "選択文をAIで編集" : "Edit selection with AI") : (ja ? "AI編集の接続状態" : "AI editing connection status");
  const commentLabel = commentConnected && !state.dirty ? (ja ? "選択文にコメント" : "Comment on selection") : (ja ? "コメントの利用状態" : "Comment availability");
  const aiTitle = aiConnected ? (!service && proposalEntry ? (ja ? "AI提案をレビュー" : "Review AI proposals") : aiLabel) : availabilityReason("ai");
  const commentTitle = availabilityReason("comment");
  const controls = <div className="oe-notes-selection-tools" data-notes-selection-controls={controlsId} role={integrated ? "group" : "toolbar"} aria-label={ja ? "選択文の操作（F8で移動）" : "Selection actions (F8 to focus)"} onKeyDown={event => {
      if (integrated || notesIsComposing(event)) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dismissToolbar(); }
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { const buttons = notesSelectionToolbarButtons(event.currentTarget), index = buttons.indexOf(document.activeElement as HTMLButtonElement); event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length; buttons[next]?.focus({ preventScroll: true }); }
    }}>
    <button type="button" className="oe-notes-selection-icon" aria-label={aiLabel} disabled={blocked} data-availability={aiConnected ? "ready" : "unavailable"} title={aiTitle} onPointerDown={event => { if (event.pointerType === "touch") event.preventDefault(); }} onMouseDown={event => event.preventDefault()} onClick={() => start("ai")}><NotesIcon name="ai" />{!aiConnected ? <span className="oe-notes-availability-dot" aria-hidden="true" /> : null}</button>
    <button type="button" className="oe-notes-selection-icon" aria-label={commentLabel} disabled={blocked} data-availability={!commentConnected ? "unavailable" : state.dirty ? "save-first" : "ready"} title={commentTitle} onPointerDown={event => { if (event.pointerType === "touch") event.preventDefault(); }} onMouseDown={event => event.preventDefault()} onClick={() => start("comment")}><NotesIcon name="comment" />{!commentConnected || state.dirty ? <span className="oe-notes-availability-dot" aria-hidden="true" /> : null}</button>
    {bridge.requestInsert && bridge.supportedInsertActions.length ? <button type="button" className="oe-notes-selection-icon" aria-label={ja ? "選択元の下に挿入" : "Insert below selection"} title={ja ? "選択元の下に挿入" : "Insert below selection"} disabled={blocked} onMouseDown={event => event.preventDefault()} onClick={() => { const selection = bridge.captureSelection?.(); if (selection && entryCurrent(selection)) setInsertSelection(selection); }}><NotesIcon name="plus" /></button> : null}
  </div>;
  return <><span ref={sourceAnchor} hidden />
    {visible && !integrated ? <NotesFloatingSurface ownerRef={sourceAnchor} placement="selection" selectionRect={bridge.getSelectionBounds} version={selectionVersion} className="oe-notes-floating-selection">{controls}</NotesFloatingSurface> : null}
    <NotesSelectionActionsContext.Provider value={{ id: controlsId, integrated, controls: integrated && visible ? controls : null, language, suppressed: open || !!unavailable || !!insertSelection || dismissedVersion !== undefined && dismissedVersion === selectionIdentity, canFormatItem: key => bridge.supportedNativeFormattingItems === undefined || bridge.supportedNativeFormattingItems.includes(key), canFormat: () => { const latest = controller.getState(); return bridge.editable && latest.snapshot?.capabilities.includes("document.save") === true && bridge.commandsAvailable !== false && latest.status === "ready" && !latest.composing && !latest.pendingEditors && !latest.recovery && !latest.manualSaveRequired; }, dismiss: dismissToolbar }}>{children}</NotesSelectionActionsContext.Provider>
    {unavailable ? <NotesOverlayPortal anchor={sourceAnchor.current} onDismiss={closeUnavailable}><div ref={root} className="oe-notes-selection-dialog" role="dialog" aria-modal="true" aria-label={ja ? "接続状態" : "Connection status"} tabIndex={-1} onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event)) { event.preventDefault(); event.stopPropagation(); closeUnavailable(); } }}><header><h2>{unavailable === "ai" ? ja ? "AIで編集" : "Edit with AI" : ja ? "コメント" : "Comment"}</h2><button type="button" onClick={closeUnavailable}>{ja ? "閉じる" : "Close"}</button></header><p role="status">{availabilityReason(unavailable)}</p></div></NotesOverlayPortal> : null}
    {insertSelection ? <NotesPlusMenu bridge={bridge} language={language} anchor={sourceAnchor.current} cancel={() => { setInsertSelection(undefined); restoreEditorFocus(); }} choose={kind => {
      const selection = insertSelection; if (!entryCurrent(selection) || insertFlight.current) return;
      const abort = new AbortController(); insertFlight.current = abort; setInsertSelection(undefined);
      void Promise.resolve().then(() => { if (!entryCurrent(selection) || abort.signal.aborted) throw new Error("Selection changed"); return notesRequestInsertion(bridge, kind, abort.signal, { anchor: { blockId: selection.blockId, placement: "after" } }); }).catch(() => { if (!abort.signal.aborted && live.current) setMessage(ja ? "挿入を完了できませんでした。本文は保持しています" : "Could not complete insertion. The document is retained."); }).finally(() => { if (insertFlight.current === abort) insertFlight.current = null; });
    }} /> : null}
    {!open && (value || undoId) ? <NotesFeedbackControl id="selection-input">{value ? <button type="button" className="oe-notes-ambient-action" onClick={() => setOpen(true)}>{ja ? "保持した入力を開く" : "Resume retained input"}</button> : null}{undoId ? <button type="button" className="oe-notes-ambient-action" disabled={state.composing || state.pendingEditors || state.status !== "ready"} onClick={undo}>{ja ? "AI置換を取り消す" : "Undo AI replacement"}</button> : null}</NotesFeedbackControl> : null}
    {open && value ? <NotesOverlayPortal anchor={sourceAnchor.current} onDismiss={close}><div ref={root} className="oe-notes-selection-dialog" role="dialog" aria-modal="true" aria-label={value.mode === "ai" ? ja ? "選択範囲のAI編集" : "Agent selection editing" : ja ? "選択範囲へのコメント" : "Comment on selection"} tabIndex={-1} onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event)) { event.stopPropagation(); event.preventDefault(); close(); } }}>
      <header><h2>{value.mode === "ai" ? ja ? "選択範囲をエージェントで編集" : "Edit selection with an agent" : ja ? "選択範囲へのコメント" : "Comment on selection"}</h2><button type="button" onClick={close}>{ja ? "閉じる" : "Close"}</button></header>
      <section className="oe-notes-selection-source"><strong>{ja ? "選択した原文" : "Selected source"}</strong><blockquote>{value.selection.text}</blockquote></section>
      {!current ? <p role="status">{ja ? "選択範囲または版が変わりました。入力を保持しています" : "The selection or revision changed. Your input is retained."}</p> : null}
      {value.mode === "ai" ? <><div className="oe-notes-selection-actions">{(Object.keys(actions) as NotesSelectionAction[]).map(action => <button type="button" key={action} aria-pressed={value.action === action} disabled={busy || !!value.proposal} onClick={() => update({ action })}>{actions[action][ja ? 1 : 0]}</button>)}</div><label>{ja ? "追加指示（任意）" : "Additional instruction (optional)"}<textarea aria-label={ja ? "追加指示" : "Additional instruction"} maxLength={4000} value={value.instruction} disabled={busy || ops.busy} {...composition} onChange={event => update({ instruction: event.target.value })} /></label>{value.proposal ? <><section className="oe-notes-selection-proposal"><strong>{ja ? "エージェントの提案" : "Agent suggestion"}</strong><p>{value.proposal}</p></section><button type="button" disabled={busy || state.composing} onClick={() => update({ proposal: "" })}>{ja ? "提案を拒否" : "Reject suggestion"}</button><button type="button" disabled={!safe || !bridge.replaceSelection || busy} onClick={() => { try { if (!draft.isCurrent()) throw new Error("Input changed"); bridge.replaceSelection!(value.selection, value.proposal, draft.id, JSON.stringify(value)); draft.compareSet(undefined); setUndoId(value.selection.id); close(); if (feedback) feedback.announce(ja ? "下書きに反映しました。未保存です" : "Applied to draft. Unsaved.", "success"); else setMessage(ja ? "本文の下書きに反映しました。保存状態を確認してください" : "Applied to the document draft. Check the save state."); } catch { setMessage(ja ? "元の選択範囲が変わりました。入力を保持しています" : "The original selection changed. Your input is retained."); } }}>{ja ? "選択範囲を置換" : "Replace selection"}</button></> : <button type="button" disabled={!safe || !service || busy} onClick={() => void run()}>{busy ? ja ? "編集中…" : "Editing…" : ja ? "エージェントに編集させる" : "Ask agent to edit"}</button>}</> : <form onSubmit={async event => { event.preventDefault(); if (!value.text.trim() || !safe || !ops.available("comment.add", draft.id) || !draft.isCurrent() || !bridge.isSelectionCurrent?.(value.selection)) return; if (await ops.execute(value.command, { localDraftId: draft.id })) close(); }}><p>{ja ? "選択元のブロックに保存します（文字範囲の固定アンカーではありません）" : "Saved on the source block; this is not a fixed character-range anchor."}</p><label>{ja ? "コメント" : "Comment"}<textarea aria-label={ja ? "コメント" : "Comment"} maxLength={10000} value={value.text} disabled={ops.busy} {...composition} onChange={event => update({ text: event.target.value, command: { kind: "comment.add", blockId: value.selection.blockId, text: event.target.value } })} /></label><button type="submit" disabled={!safe || !value.text.trim() || !ops.available("comment.add", draft.id)}>{ja ? "コメントを追加" : "Add comment"}</button></form>}
      {busy ? <button type="button" onClick={() => { flight.current?.abort(); flight.current = null; setBusy(false); }}>{ja ? "生成を中断" : "Stop generation"}</button> : null}<footer><button type="button" disabled={ops.busy || state.composing} onClick={() => { if (draft.compareSet(undefined)) close(); else setMessage(ja ? "新しい入力を保持しています" : "Newer input is retained"); }}>{ja ? "キャンセル" : "Cancel"}</button></footer><NotesPanelStatus controller={controller} message={message || ops.message} />
    </div></NotesOverlayPortal> : message && !feedback ? <p className="oe-notes-selection-status" role="status">{message}</p> : null}
  </>;
}
