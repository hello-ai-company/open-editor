import { useRef, useState, useSyncExternalStore } from "react";
import { notesTargetKey } from "@hello-ai-company/editor-blocknote/notes";
import { createEditorDocument, type EditorDocument } from "@hello-ai-company/editor-core";
import { NotesProposalRail, type NotesWorkspacePreset } from "@hello-ai-company/editor-blocknote/react";

type Review = { scope: string; target: string; before: EditorDocument; after: EditorDocument; title: string; beforeRevision: string; acceptedRevision?: string };
/** Explicit synthetic-only review of the existing Notes writer. No provider, new journal or second writer. */
export function SyntheticNotesReview({ preset }: { preset: NotesWorkspacePreset }) {
  const controller = preset.controller, state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const [review, setReview] = useState<Review>(), [notice, setNotice] = useState("合成の提案です。実AIは使用しません。"), pendingAction = useRef<"accept" | "undo" | undefined>(undefined);
  const ready = state.status === "ready" && !state.dirty && !state.composing && !state.pendingEditors && !state.recovery && !state.manualSaveRequired;
  const bound = !!review && review.scope === JSON.stringify(state.snapshot?.scope) && review.target === (state.snapshot && notesTargetKey(state.snapshot.target));
  const same = (document: EditorDocument) => JSON.stringify(state.snapshot?.document) === JSON.stringify(document);
  const approve = ready && bound && !!review && !review.acceptedRevision && state.snapshot?.revision === review.beforeRevision && same(review.before);
  const undo = ready && bound && !!review?.acceptedRevision && state.snapshot?.revision === review.acceptedRevision && same(review.after);
  const settle = (action: "accept" | "undo", value: Review) => {
    const latest = controller.getState();
    if (latest.status !== "ready" || latest.dirty || !latest.snapshot || JSON.stringify(latest.snapshot.scope) !== value.scope || notesTargetKey(latest.snapshot.target) !== value.target) { setNotice("保存結果と後の入力を確認してください。再送しません。"); return; }
    if (JSON.stringify(latest.snapshot.document) !== JSON.stringify(action === "accept" ? value.after : value.before)) { setNotice("本文が変わりました。後の入力を保持しています。"); return; }
    if (action === "accept") { setReview({ ...value, acceptedRevision: latest.snapshot.revision }); setNotice("採用の保存を確認しました。"); }
    else { setReview(undefined); setNotice("原文へ戻した保存を確認しました。"); }
    pendingAction.current = undefined;
  };
  const write = async (action: "accept" | "undo") => {
    if (!review || !(action === "accept" ? approve : undo)) return;
    const latest = controller.getState(), expected = action === "accept" ? review.beforeRevision : review.acceptedRevision;
    if (!latest.snapshot || latest.status !== "ready" || latest.dirty || latest.composing || latest.pendingEditors || latest.snapshot.revision !== expected || JSON.stringify(latest.snapshot.scope) !== review.scope || notesTargetKey(latest.snapshot.target) !== review.target) return;
    pendingAction.current = action;
    controller.setDraft(action === "accept" ? review.after : review.before, review.title);
    await controller.save({ explicit: true }); settle(action, review);
  };
  return <NotesProposalRail status={state.status === "unknown" ? "unknown" : state.status === "saving" ? "saving" : review && !review.acceptedRevision ? "review" : "off"} title="合成の追記案" summary="現在の文書に一文を追記します。" notice={notice} pending={state.pendingEditors} composing={state.composing} canApprove={approve} canUndo={Boolean(review?.acceptedRevision)} comparison={review ? { before: "現在の本文をそのまま保持", after: "合成の提案を確認しました。" } : undefined} onEnable={ready ? () => {
    const before = structuredClone(controller.getState().snapshot!);
    const after = createEditorDocument([...before.document.blocks, { id: crypto.randomUUID(), type: "paragraph", content: "合成の提案を確認しました。" }]);
    setReview({ scope: JSON.stringify(before.scope), target: notesTargetKey(before.target), before: before.document, after, title: before.title, beforeRevision: before.revision }); setNotice("採用するまで本文は変更しません。");
  } : undefined} onReject={() => { if (!ready || review?.acceptedRevision) return; setReview(undefined); setNotice("提案を見送りました。本文は変更していません。"); }} onApprove={() => write("accept")} onUndo={undo ? () => write("undo") : undefined} onReconcile={async () => { await controller.reconcile(); if (review && pendingAction.current) settle(pendingAction.current, review); }} />;
}
