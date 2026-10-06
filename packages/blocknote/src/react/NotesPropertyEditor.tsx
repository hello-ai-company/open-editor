import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { JsonValue } from "@hello-ai-company/editor-core";
import { validateNotesPropertyValue, type NotesWritableProperty, type NotesResourceResult, type RevisionedNotesResourceEditor } from "../workspace/revisionedNotesResource.js";

export type NotesPropertyEditorProps = { propertyId: string; definition: NotesWritableProperty; value: JsonValue; revision: string; editor: RevisionedNotesResourceEditor; onCommitted(result: Extract<NotesResourceResult, { status: "committed" }>): void; onCancel?(): void };
/** Small explicit typed JSON editor for host-owned complex row values. No optimistic persistence. */
export function NotesPropertyEditor(props: NotesPropertyEditorProps) {
  const identity = useMemo(() => crypto.randomUUID(), [props.editor]);
  return <PropertyDraft key={JSON.stringify([identity, props.propertyId, props.definition])} {...props} />;
}
function PropertyDraft({ propertyId, definition, value, revision, editor, onCommitted, onCancel }: NotesPropertyEditorProps) {
  const [draft, setDraft] = useState(() => JSON.stringify(value)), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const [baseRevision, setBaseRevision] = useState(revision), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const status = useSyncExternalStore(editor.subscribe, () => editor.getState().status), stale = baseRevision !== revision;
  const resolve = async (reconcile: boolean): Promise<void> => {
    if (busy || editor.getState().status === "pending") return;
    setBusy(true); setMessage("");
    try {
      const result = reconcile ? await editor.reconcile() : await editor.commit(baseRevision, { kind: "patch", fields: { [propertyId]: validateNotesPropertyValue(definition, JSON.parse(draft)) } });
      if (!mounted.current) return;
      if (result.status === "committed") { setMessage("保存を確認しました"); onCommitted(result); }
      else setMessage(result.status === "unknown" ? "保存結果が不明です。再送せず結果を照会してください" : "保存できませんでした。最新データを確認してください");
    } catch (error) { if (mounted.current) setMessage(error instanceof Error ? error.message : "入力を確認してください"); }
    finally { if (mounted.current) setBusy(false); }
  };
  const reset = (): void => { if (busy || editor.getState().status !== "idle") return; setDraft(JSON.stringify(value)); setBaseRevision(revision); setMessage(""); };
  return <form className="oe-notes-property-editor" aria-label={`${propertyId}の編集`} onSubmit={event => { event.preventDefault(); if (!stale && editor.getState().status === "idle") void resolve(false); }} onKeyDown={event => { if (event.key === "Escape" && !busy && editor.getState().status === "idle") { event.stopPropagation(); reset(); onCancel?.(); } }}>
    <label>{propertyId} ({definition.type})<textarea aria-label={`${propertyId}のJSON値`} value={draft} disabled={busy || status !== "idle"} onChange={event => setDraft(event.target.value)} /></label>
    {stale ? <p role="status">別の変更を検出しました。入力を保持しています。最新値を確認してください</p> : null}
    <button type="submit" disabled={busy || stale || status !== "idle"}>確認して保存</button>
    <button type="button" disabled={busy || status !== "idle"} onClick={reset}>最新値に戻す</button>
    <button type="button" disabled={busy || status !== "unknown"} onClick={() => void resolve(true)}>保存結果を照会</button>
    <p role="status">{message}</p>
  </form>;
}
