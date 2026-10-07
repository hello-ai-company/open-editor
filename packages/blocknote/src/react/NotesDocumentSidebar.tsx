import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { JsonValue } from "@hello-ai-company/editor-core";
import type { NotesCommand, NotesDocumentPanel, NotesPanelSnapshot, NotesWorkspaceController } from "../notes/contracts.js";
import { DocumentOutline } from "./outline.js";
import { createDocumentOutline } from "../index/outline.js";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";
import { NotesPanelStatus, notesBlockById, notesIsComposing, notesPanelIdentity, useNotesController, useNotesComposition, useLocalNotesDraft, useNotesEntries, useNotesPanelCommands, type NotesEditorBridge, type NotesPanelDataState } from "./notesWorkspacePanels.js";

const LABELS: Record<NotesDocumentPanel, string> = { outline: "見出し", tasks: "タスク", media: "メディア", search: "本文検索", comments: "コメント", history: "履歴", info: "情報" };
export type NotesDocumentSidebarProps = {
  controller: NotesWorkspaceController;
  bridge: NotesEditorBridge;
  panels?: NotesPanelSnapshot;
  panelState?: NotesPanelDataState;
  panelError?: string;
  onRefreshPanels?(): void;
  tabs?: readonly NotesDocumentPanel[];
  initialTab?: NotesDocumentPanel;
  categoryOptions?: readonly { value: string; label: string }[];
  privacyOptions?: readonly { value: string; label: string }[];
  className?: string;
};

export function NotesDocumentSidebar(props: NotesDocumentSidebarProps) {
  const state = useNotesController(props.controller);
  return <DocumentPanel key={notesPanelIdentity(props.controller, state.snapshot)} {...props} />;
}

function DocumentPanel(props: NotesDocumentSidebarProps) {
  const ops = useNotesPanelCommands(props.controller), entries = useNotesEntries(props.bridge.index), uid = useId();
  const tabs = props.tabs ?? (Object.keys(LABELS) as NotesDocumentPanel[]);
  const [tab, setTab] = useState<NotesDocumentPanel>(() => props.initialTab && tabs.includes(props.initialTab) ? props.initialTab : tabs[0] ?? "outline");
  const [query, setQuery] = useState("");
  const commentLocal = useLocalNotesDraft<{ baseRevision: string; command: { kind: "comment.add"; blockId: string; text: string }; presentation: { text: string; blockId: string } }>(props.controller, "oe.sidebar.comment");
  const historyLocal = useLocalNotesDraft<{ baseRevision: string; command: { kind: "history.rename"; versionId: string; name: string }; presentation: { name: string } }>(props.controller, "oe.sidebar.history-name");
  const comment = commentLocal.value?.presentation.text ?? "", commentBlock = commentLocal.value?.presentation.blockId ?? "";
  const renameId = historyLocal.value?.command.versionId ?? null, rename = historyLocal.value?.presentation.name ?? "";
  const setCommentDraft = (text: string, blockId: string) => commentLocal.set({ baseRevision: commentLocal.value?.baseRevision ?? ops.state.snapshot!.revision, command: { kind: "comment.add", blockId, text: text.trim() }, presentation: { text, blockId } });
  const setRename = (name: string, versionId = renameId!) => historyLocal.set({ baseRevision: historyLocal.value?.baseRevision ?? ops.state.snapshot!.revision, command: { kind: "history.rename", versionId, name: name.trim() }, presentation: { name } });
  const composition = useNotesComposition(props.controller, `${tab}:${renameId ?? ""}`);
  const [confirmation, setConfirmation] = useState<{ command: NotesCommand; label: string } | null>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap(!!confirmation, confirmationRef);
  const selected = tabs.includes(tab) ? tab : tabs[0];
  const [infoVisited, setInfoVisited] = useState(selected === "info");
  useEffect(() => { if (selected === "info") setInfoVisited(true); }, [selected]);
  const snapshot = ops.state.snapshot, blocks = (ops.state.draft ?? snapshot?.document)?.blocks ?? [];
  const tasks = entries.filter(entry => entry.type === "checkListItem" || entry.type === "checklist");
  const media = entries.filter(entry => ["image", "video", "audio", "file", "asset"].includes(entry.type));
  const [localError, setLocalError] = useState("");
  const localBusy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (command: NotesCommand, options?: { localDraftId?: string }): Promise<boolean> => { const committed = await ops.execute(command, options); if (committed && mounted.current) { try { props.onRefreshPanels?.(); } catch { setLocalError("保存済みです。表示を再読み込みしてください"); } } return committed; };
  const tabKeys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (notesIsComposing(event)) return;
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault(); setTab(tabs[next]!); event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-notes-tab-index="${next}"]`)?.focus();
  };
  const data = (children: ReactNode) => props.panelState === "loading" ? <p role="status">読み込んでいます</p> : props.panelState === "error" ? <div><p role="alert">{props.panelError ?? "読み込めませんでした"}</p><button type="button" disabled={!props.onRefreshPanels} onClick={props.onRefreshPanels}>再読み込み</button></div> : !props.panels || props.panelState === "unavailable" ? <p>この機能はホストに接続されていません</p> : children;
  return <aside className={["oe-notes-document-sidebar", props.className].filter(Boolean).join(" ")} aria-label="文書のツール">
    <header><h2>文書</h2><span>{snapshot?.title ?? "文書を選択してください"}</span></header>
    <div className="oe-notes-tabs" role="tablist" aria-label="文書のツール">
      {tabs.map((id, index) => <button type="button" key={id} role="tab" id={`${uid}-tab-${id}`} aria-controls={`${uid}-panel-${id}`} aria-selected={selected === id} tabIndex={selected === id ? 0 : -1} data-notes-tab-index={index} onKeyDown={event => tabKeys(event, index)} onClick={() => setTab(id)}>{LABELS[id]}{id === "comments" && props.panels?.comments?.some(item => !item.resolved) ? <span aria-label="未解決のコメント"> {props.panels.comments.filter(item => !item.resolved).length}</span> : null}</button>)}
    </div>
    {selected ? <section className="oe-notes-panel" role="tabpanel" id={`${uid}-panel-${selected}`} aria-labelledby={`${uid}-tab-${selected}`} tabIndex={0}>
      {selected === "outline" ? <DocumentOutline nodes={createDocumentOutline(props.bridge.index)} onJump={props.bridge.focusBlock} /> : null}
      {selected === "tasks" ? <><h3>タスク ({tasks.length})</h3>{tasks.length ? <ul>{tasks.map(entry => {
        const checked = notesBlockById(blocks, entry.blockId)?.props?.checked === true;
        return <li key={entry.blockId}><button type="button" onClick={() => props.bridge.focusBlock(entry.blockId)}>{entry.text || "空のタスク"}</button><button type="button" aria-label={`${entry.text || "タスク"}を${checked ? "未完了" : "完了"}にする`} aria-pressed={checked} disabled={!props.bridge.editable || !!props.bridge.composing || ops.state.status !== "ready" || !props.bridge.toggleTask} onClick={() => {
          if (localBusy.current) return; localBusy.current = true; setLocalError("");
          void Promise.resolve().then(() => props.bridge.toggleTask?.(entry.blockId)).catch(() => { if (mounted.current) setLocalError("タスクを変更できませんでした"); }).finally(() => { localBusy.current = false; });
        }}>{checked ? "✓" : "○"}</button></li>;
      })}</ul> : <p>タスクはありません</p>}</> : null}
      {selected === "media" ? <><h3>メディア ({media.length})</h3>{media.length ? <ul>{media.map(entry => <li key={entry.blockId}><button type="button" onClick={() => props.bridge.focusBlock(entry.blockId)}>{entry.text || entry.type}</button></li>)}</ul> : <p>メディアはありません</p>}{data(<ul>{props.panels?.attachments?.map(asset => <li key={asset.id}>{asset.blockId ? <button type="button" onClick={() => props.bridge.focusBlock(asset.blockId!)}>{asset.name}</button> : <span>{asset.name}</span>}<small>{asset.mimeType}</small></li>)}</ul>)}</> : null}
      {selected === "search" ? <><label>本文検索<input type="search" value={query} aria-label="本文検索" onChange={event => setQuery(event.target.value)} /></label>{query.trim() ? <ul>{entries.filter(entry => entry.text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(entry => <li key={entry.blockId}><button type="button" onClick={() => props.bridge.focusBlock(entry.blockId)}><small>{entry.type}</small> {entry.text || entry.blockId}</button></li>)}</ul> : <p>検索語を入力してください</p>}</> : null}
      {selected === "comments" ? data(<><h3>コメント</h3><form onSubmit={event => { event.preventDefault(); if (!props.bridge.composing && comment.trim() && entries.some(entry => entry.blockId === commentBlock)) void run({ kind: "comment.add", blockId: commentBlock, text: comment.trim() }, { localDraftId: commentLocal.id }); }}>
        <label>対象ブロック<select aria-label="コメントの対象ブロック" value={commentBlock} disabled={!ops.canEdit("comment.add")} onChange={event => setCommentDraft(comment, event.target.value)}><option value="">選択してください</option>{entries.map(entry => <option key={entry.blockId} value={entry.blockId}>{entry.text || entry.type}</option>)}</select></label>
        <label>コメント<textarea aria-label="コメント本文" value={comment} disabled={!ops.canEdit("comment.add")} onChange={event => setCommentDraft(event.target.value, commentBlock)} {...composition} /></label>
        <button type="submit" disabled={!ops.available("comment.add", commentLocal.id) || !comment.trim() || !entries.some(entry => entry.blockId === commentBlock)}>コメントを追加</button>
        <button type="button" disabled={ops.busy || ops.state.status === "saving" || ops.state.status === "unknown"} onClick={() => commentLocal.set(undefined)}>入力を取り消す</button>
      </form>{props.panels?.comments?.length ? props.panels.comments.map(item => <article key={item.id}><button type="button" onClick={() => props.bridge.focusBlock(item.blockId)}>{item.text}</button><small>{item.authorLabel} {item.createdAt}</small><button type="button" disabled={!ops.available("comment.update")} onClick={() => void run({ kind: "comment.update", commentId: item.id, resolved: !item.resolved })}>{item.resolved ? "再開する" : "解決する"}</button><button type="button" disabled={!ops.available("comment.delete")} onClick={() => setConfirmation({ label: "このコメントを削除しますか", command: { kind: "comment.delete", commentId: item.id } })}>コメントを削除</button></article>) : <p>コメントはありません</p>}</>) : null}
      {selected === "history" ? data(<><h3>履歴</h3><button type="button" disabled={!ops.available("history.save")} onClick={() => void run({ kind: "history.save" })}>現在の版を保存</button>{props.panels?.history?.length ? props.panels.history.map(item => <article key={item.id}><strong>{item.name || "名前のない版"}</strong><small>{item.authorLabel} {item.createdAt}</small>{renameId === item.id ? <form onSubmit={event => { event.preventDefault(); if (!props.bridge.composing && rename.trim()) void run({ kind: "history.rename", versionId: item.id, name: rename.trim() }, { localDraftId: historyLocal.id }); }} onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event) && !ops.busy && ops.state.status !== "saving" && ops.state.status !== "unknown") { event.stopPropagation(); historyLocal.set(undefined); } }}><input autoFocus aria-label="版の名前" value={rename} disabled={ops.busy} onChange={event => setRename(event.target.value)} {...composition} /><button type="submit" disabled={!ops.available("history.rename", historyLocal.id) || !rename.trim()}>名前を保存</button><button type="button" disabled={ops.busy || ops.state.status === "saving" || ops.state.status === "unknown"} onClick={() => historyLocal.set(undefined)}>キャンセル</button></form> : <button type="button" disabled={!ops.available("history.rename", historyLocal.id) || !!renameId} onClick={() => setRename(item.name ?? "", item.id)}>名前を変更</button>}<button type="button" disabled={!ops.available("history.restore")} onClick={() => setConfirmation({ label: "現在の本文をこの版で置き換えますか", command: { kind: "history.restore", versionId: item.id, expectedVersionRevision: item.revision } })}>この版を復元</button><button type="button" disabled={!ops.available("history.delete")} onClick={() => setConfirmation({ label: "この履歴を削除しますか", command: { kind: "history.delete", versionId: item.id } })}>履歴を削除</button></article>) : <p>履歴はありません</p>}</>) : null}
      {(infoVisited || selected === "info") && snapshot ? <div hidden={selected !== "info"}><NotesMetadataDraft active={selected === "info"} metadata={snapshot.metadata} revision={snapshot.revision} controller={props.controller} bridge={props.bridge} categoryOptions={props.categoryOptions} privacyOptions={props.privacyOptions} /></div> : null}
    </section> : null}
    {localError ? <p role="alert">{localError}</p> : null}
    <NotesPanelStatus controller={props.controller} message={ops.message} />
    {confirmation ? <div className="oe-notes-confirmation" role="alertdialog" aria-modal="true" aria-labelledby={`${uid}-confirm`} tabIndex={-1} ref={confirmationRef} onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event) && !ops.busy) { event.preventDefault(); setConfirmation(null); } }}><p id={`${uid}-confirm`}>{confirmation.label}</p><button type="button" disabled={ops.busy} onClick={() => setConfirmation(null)}>キャンセル</button><button type="button" disabled={!ops.available(confirmation.command.kind)} onClick={() => void run(confirmation.command).then(ok => { if (ok && mounted.current) setConfirmation(null); })}>確認して実行</button></div> : null}
  </aside>;
}

type MetadataLocalDraft = { baseRevision: string; command: { kind: "metadata.patch"; fields: Record<string, JsonValue> }; presentation: { category: string; privacy: string; tags: string; baseMetadata: Record<string, JsonValue> } };
function NotesMetadataDraft(props: Pick<NotesDocumentSidebarProps, "controller" | "bridge" | "categoryOptions" | "privacyOptions"> & { active: boolean; metadata: Record<string, JsonValue>; revision: string }) {
  const composition = useNotesComposition(props.controller, props.active), ops = useNotesPanelCommands(props.controller), local = useLocalNotesDraft<MetadataLocalDraft>(props.controller, "oe.sidebar.metadata");
  const category = local.value?.presentation.category ?? String(props.metadata.category ?? ""), privacy = local.value?.presentation.privacy ?? String(props.metadata.privacy ?? "");
  const tags = local.value?.presentation.tags ?? (Array.isArray(props.metadata.tags) ? props.metadata.tags.filter(tag => typeof tag === "string").join(", ") : "");
  const [suggested, setSuggested] = useState<Record<string, JsonValue> | null>(null), [classifyBusy, setClassifyBusy] = useState(false), [error, setError] = useState("");
  const classifyAbort = useRef<AbortController | null>(null), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; classifyAbort.current?.abort(); }; }, []);
  const fields = local.value?.command.fields ?? {}, stale = !!local.value && local.value.baseRevision !== props.revision;
  const change = (next: { category: string; privacy: string; tags: string }) => {
    const baseMetadata = local.value?.presentation.baseMetadata ?? props.metadata, fields: Record<string, JsonValue> = {};
    const baseTags = Array.isArray(baseMetadata.tags) ? baseMetadata.tags.filter(tag => typeof tag === "string").join(", ") : "";
    if (next.tags !== baseTags) fields.tags = next.tags.split(",").map(tag => tag.trim()).filter(Boolean);
    if (props.categoryOptions && next.category !== String(baseMetadata.category ?? "")) fields.category = next.category;
    if (props.privacyOptions && next.privacy !== String(baseMetadata.privacy ?? "")) fields.privacy = next.privacy;
    local.set({ baseRevision: local.value?.baseRevision ?? props.revision, command: { kind: "metadata.patch", fields }, presentation: { ...next, baseMetadata } });
  };
  const canCancel = !ops.busy && ops.state.status !== "saving" && ops.state.status !== "unknown";
  const cancel = () => { if (canCancel) { local.set(undefined); setSuggested(null); } };
  return <div className="oe-notes-metadata"><h3>情報</h3><dl>{["createdAt", "updatedAt", "createdBy", "updatedBy"].map(field => <div key={field}><dt>{field}</dt><dd>{typeof props.metadata[field] === "string" ? String(props.metadata[field]) : "—"}</dd></div>)}</dl><form onSubmit={event => { event.preventDefault(); if (!stale && Object.keys(fields).length && !props.bridge.composing) void ops.execute({ kind: "metadata.patch", fields }, { localDraftId: local.id }); }} onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event) && canCancel) { event.stopPropagation(); cancel(); } }}>
    {props.categoryOptions ? <label>分類<select aria-label="分類" value={category} disabled={!ops.canEdit("metadata.patch")} onChange={event => change({ category: event.target.value, privacy, tags })}>{!props.categoryOptions.some(option => option.value === category) ? <option value={category}>{category || "未分類"}</option> : null}{props.categoryOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : <p>分類: {category || "未分類"}</p>}
    {props.privacyOptions ? <label>公開範囲<select aria-label="公開範囲" value={privacy} disabled={!ops.canEdit("metadata.patch")} onChange={event => change({ category, privacy: event.target.value, tags })}>{!props.privacyOptions.some(option => option.value === privacy) ? <option value={privacy}>{privacy || "未設定"}</option> : null}{props.privacyOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : <p>公開範囲: {privacy || "未設定"}</p>}
    <label>タグ (カンマ区切り)<input aria-label="タグ" value={tags} disabled={!ops.canEdit("metadata.patch")} onChange={event => change({ category, privacy, tags: event.target.value })} {...composition} /></label>{stale ? <p role="status">別の変更を検出しました。入力を保持しています。キャンセルして最新値を確認してください</p> : null}<button type="submit" disabled={!ops.available("metadata.patch", local.id) || stale || !Object.keys(fields).length}>情報を確認して保存</button>
    <button type="button" disabled={!canCancel} onClick={cancel}>キャンセル</button>
  </form>
  {props.bridge.classify ? <><button type="button" disabled={classifyBusy || !ops.available("metadata.patch") || stale} onClick={() => { if (classifyAbort.current) return; const abort = new AbortController(); classifyAbort.current = abort; setClassifyBusy(true); setError(""); void props.bridge.classify!(abort.signal).then(fields => { if (mounted.current && !abort.signal.aborted && fields) setSuggested(fields); }).catch(() => { if (mounted.current && !abort.signal.aborted) setError("分類案を取得できませんでした"); }).finally(() => { if (classifyAbort.current === abort) { classifyAbort.current = null; if (mounted.current) setClassifyBusy(false); } }); }}>分類案を確認する</button>{classifyBusy ? <button type="button" onClick={() => { classifyAbort.current?.abort(); classifyAbort.current = null; setClassifyBusy(false); }}>分類をキャンセル</button> : null}{suggested ? <div><pre>{JSON.stringify(suggested, null, 2)}</pre><button type="button" disabled={!ops.available("metadata.patch") || stale} onClick={() => void ops.execute({ kind: "metadata.patch", fields: suggested }).then(ok => { if (ok && mounted.current) setSuggested(null); })}>この分類案を保存</button><button type="button" onClick={() => setSuggested(null)}>見送る</button></div> : null}</> : null}
  {error ? <p role="alert">{error}</p> : null}<NotesPanelStatus controller={props.controller} message={ops.message} />
  </div>;
}
