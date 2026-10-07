import { useRef, useState, useSyncExternalStore } from "react";
import { deserializeEditorDocument, serializeEditorDocument } from "@hello-ai-company/editor-core";
import type { NotesWorkspaceController } from "../notes/contracts.js";

/** Manual recovery keeps both originals. Fresh canonical read and user-reviewed merge are
 * separate actions; preparing a merge never submits or silently overwrites concurrent content. */
export function NotesConflictReview({ controller }: { controller: NotesWorkspaceController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const [busy, setBusy] = useState(false), [source, setSource] = useState(""), [title, setTitle] = useState(""), [message, setMessage] = useState("");
  const flight = useRef(false);
  if (!["conflict", "denied"].includes(state.status) && !state.manualSaveRequired) return null;
  return <section className="oe-notes-conflict-review" aria-label="保存競合の確認"><h3>入力を保持しています</h3><p>最新の内容と比較し、残す内容を確認してください。統合を準備した後も、明示的な保存が必要です。</p>
    {state.manualSaveRequired ? <p role="status">統合案は未保存です。「保存」で確認した内容を送信します。変更前の入力は保存確認まで保持しています。</p> : <button type="button" disabled={busy || state.composing} onClick={async () => { if (flight.current) return; flight.current = true; setBusy(true); try { const latest = await controller.readLatest(); if (latest) { const current = controller.getState(); setSource(serializeEditorDocument(current.draft ?? current.snapshot!.document)); setTitle(current.draftTitle ?? current.snapshot!.title); setMessage(""); } else setMessage("最新の内容を確認できませんでした"); } finally { flight.current = false; setBusy(false); } }}>最新と比較する</button>}
    {state.latest ? <><div className="oe-notes-conflict-comparison"><details><summary>保持している入力</summary><pre>{serializeEditorDocument(state.draft ?? state.snapshot!.document)}</pre></details><details><summary>最新の保存内容 · {state.latest.title}</summary><pre>{serializeEditorDocument(state.latest.document)}</pre></details></div><label>統合後のタイトル<input value={title} disabled={busy} onChange={event => setTitle(event.target.value)} /></label><label>確認して残す本文JSON<textarea value={source} disabled={busy} onChange={event => setSource(event.target.value)} /></label><button type="button" disabled={busy || state.composing} onClick={async () => { if (flight.current || !state.latest) return; flight.current = true; setBusy(true); try { const merged = deserializeEditorDocument(source); const accepted = await controller.acceptMergedDraft(state.latest.revision, merged, title); setMessage(accepted ? "統合案を準備しました。保存するまで原本を変更しません" : "内容が変わったため統合を準備できませんでした。入力は保持しています"); } catch { setMessage("本文JSONを確認してください。入力は保持しています"); } finally { flight.current = false; setBusy(false); } }}>確認した統合案を準備</button></> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
