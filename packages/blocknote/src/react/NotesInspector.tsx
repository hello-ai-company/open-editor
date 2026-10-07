import { useEffect, useId, useRef, useState } from "react";
import type { NotesInspectorPanel, NotesWorkspaceController } from "../notes/contracts.js";
import { NOTES_INSERT_CATALOG, NOTES_STYLE_CATALOG, NotesPanelStatus, notesAvailableCatalog, notesIsComposing, notesPanelIdentity, useNotesController, type NotesEditorBridge, type NotesInsertKind, type NotesStyleKind } from "./notesWorkspacePanels.js";

export type NotesInspectorProps = { controller: NotesWorkspaceController; bridge: NotesEditorBridge; tabs?: readonly NotesInspectorPanel[]; initialTab?: NotesInspectorPanel; className?: string };
const LABELS: Record<NotesInspectorPanel, string> = { insert: "挿入", style: "書式", info: "情報" };
export function NotesInspector(props: NotesInspectorProps) {
  const state = useNotesController(props.controller);
  return <InspectorPanel key={notesPanelIdentity(props.controller, state.snapshot)} {...props} />;
}
function InspectorPanel(props: NotesInspectorProps) {
  const state = useNotesController(props.controller), uid = useId(), tabs = props.tabs ?? ["insert", "style", "info"];
  const [tab, setTab] = useState<NotesInspectorPanel>(() => props.initialTab && tabs.includes(props.initialTab) ? props.initialTab : tabs[0] ?? "insert");
  const selected = tabs.includes(tab) ? tab : tabs[0];
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const flight = useRef<AbortController | null>(null), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; flight.current?.abort(); }; }, []);
  const insert = notesAvailableCatalog(NOTES_INSERT_CATALOG, props.bridge.supportedInsertActions, props.bridge.installedBlockTypes);
  const styles = notesAvailableCatalog(NOTES_STYLE_CATALOG, props.bridge.supportedStyleActions, props.bridge.installedBlockTypes);
  const editable = props.bridge.editable && !props.bridge.composing && !state.composing && state.status === "ready" && !!state.snapshot && !busy;
  const run = (kind: NotesInsertKind | NotesStyleKind, type: "insert" | "style") => {
    if (!editable || flight.current) return;
    // Revalidate against this render's installed catalog, even when invoked programmatically.
    if (!(type === "insert" ? insert : styles).some(item => item.kind === kind)) return;
    const abort = new AbortController(); flight.current = abort; setBusy(true); setMessage("");
    void Promise.resolve().then(() => { if (!abort.signal.aborted) return type === "insert" ? props.bridge.insert(kind as NotesInsertKind, abort.signal) : props.bridge.format(kind as NotesStyleKind, abort.signal); }).then(() => { if (mounted.current && !abort.signal.aborted) setMessage("本文に反映しました。保存状態を確認してください"); }).catch(() => { if (mounted.current && !abort.signal.aborted) setMessage("本文を変更できませんでした"); }).finally(() => { if (flight.current === abort) { flight.current = null; if (mounted.current) setBusy(false); } });
  };
  return <aside className={["oe-notes-inspector", props.className].filter(Boolean).join(" ")} aria-label="編集のツール">
    <header><h2>編集</h2></header><div className="oe-notes-tabs" role="tablist" aria-label="編集のツール">{tabs.map((id, index) => <button type="button" key={id} role="tab" id={`${uid}-tab-${id}`} aria-controls={`${uid}-panel-${id}`} aria-selected={selected === id} tabIndex={selected === id ? 0 : -1} data-notes-tab-index={index} onClick={() => setTab(id)} onKeyDown={event => {
      if (notesIsComposing(event)) return;
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % tabs.length : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index + tabs.length - 1) % tabs.length : undefined;
      if (next === undefined) return; event.preventDefault(); setTab(tabs[next]!); event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-notes-tab-index="${next}"]`)?.focus();
    }}>{LABELS[id]}</button>)}</div>
    {selected ? <section className="oe-notes-panel" role="tabpanel" id={`${uid}-panel-${selected}`} aria-labelledby={`${uid}-tab-${selected}`} tabIndex={0}>
      {selected === "insert" ? <><h3>挿入</h3>{insert.length ? <div className="oe-notes-catalog">{insert.map(item => <button type="button" key={item.kind} disabled={!editable} onMouseDown={event => event.preventDefault()} onClick={() => run(item.kind, "insert")}>{item.label}</button>)}</div> : <p>挿入ツールが接続されていません</p>}<p>選択位置に挿入します。HTML の JavaScript は実行されません。</p></> : null}
      {selected === "style" ? <><h3>選択した本文の書式</h3>{styles.length ? <div className="oe-notes-catalog">{styles.map(item => <button type="button" key={item.kind} disabled={!editable} onMouseDown={event => event.preventDefault()} onClick={() => run(item.kind, "style")}>{item.label}</button>)}</div> : <p>書式ツールが接続されていません</p>}</> : null}
      {selected === "info" ? <><h3>現在の文書</h3><dl><dt>タイトル</dt><dd>{state.draftTitle ?? state.snapshot?.title ?? "—"}</dd><dt>ブロック</dt><dd>{props.bridge.index.size()}</dd><dt>状態</dt><dd>{!props.bridge.editable ? "読み取り専用" : state.dirty ? "未保存の変更" : state.status === "ready" ? "保存を確認済み" : state.message || state.status}</dd></dl></> : null}
    </section> : null}
    {busy ? <button type="button" onClick={() => { flight.current?.abort(); flight.current = null; setBusy(false); setMessage("操作を中断しました。本文と保存状態を確認してください"); }}>挿入・書式をキャンセル</button> : null}
    <NotesPanelStatus controller={props.controller} message={message} />
  </aside>;
}
