import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { createNoteOrganizationSession, organizationEqual, type OrganizationSnapshot } from "@hello-ai-company/editor-ai";
import { createOpenEditorBlockNoteSchema, fromBlockNote, toBlockNoteForSchema } from "@hello-ai-company/editor-blocknote";
import { NoteOrganizationCard } from "@hello-ai-company/editor-blocknote/react";
import { createSyntheticOrganizationHost, syntheticNoteOrganizationAgent, type SyntheticFault } from "./syntheticNoteOrganization";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@hello-ai-company/editor-blocknote/power.css";
import "./noteOrganization.css";

const readSignal = () => new AbortController().signal;
export function NoteOrganizationWorkbench() {
  const [adapter] = useState(() => createSyntheticOrganizationHost());
  const [saved, setSaved] = useState<OrganizationSnapshot>(), [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; void adapter.initialize().then(() => adapter.host.read("note", readSignal())).then(s => { if (active) setSaved(s); }).catch(() => { if (active) setError("合成データを開けません。既存文書は保持されています。"); }); return () => { active = false; }; }, [adapter]);
  const changeNote = async (id: string) => { if (busy) return; setBusy(true); try { setSaved(await adapter.host.read(id, readSignal())); setError(""); } catch { setError("ノートを開けません"); } finally { setBusy(false); } };
  return <main className="organization-workbench">
    <header><a href="?">通常のDocumentに戻る</a><h1>自由に書いて、あとで整える</h1><p>OpenEditorの合成デモ · 実AI・外部送信なし。保存先はこのブラウザの専用IndexedDBです。</p></header>
    {error ? <p role="alert">{error}</p> : null}
    {saved ? <OrganizationNote key={saved.documentId} initial={saved} adapter={adapter} onNavigate={changeNote} navigationBusy={busy} /> : <p role="status">合成ノートを開いています…</p>}
  </main>;
}
function OrganizationNote({ initial, adapter, onNavigate, navigationBusy }: { initial: OrganizationSnapshot; adapter: ReturnType<typeof createSyntheticOrganizationHost>; onNavigate(id: string): Promise<void>; navigationBusy: boolean }) {
  const [saved, setSaved] = useState(initial), [notice, setNotice] = useState("保存済み"), [dirty, setDirty] = useState(false), [history, setHistory] = useState(0), [fault, setFault] = useState<SyntheticFault>("none"), [titleDraft, setTitleDraft] = useState(initial.title), [controlBusy, setControlBusy] = useState(false), [authorizationDraft, setAuthorizationDraft] = useState<boolean>();
  const controlLatch = useRef(false), titleDirty = useRef(false), viewportEpoch = useRef(0);
  const [hasTitleDraft, setHasTitleDraft] = useState(false);
  const base = useRef(initial), dirtyRef = useRef(false), generation = useRef(0), applying = useRef(false), composing = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), pending = useRef<Promise<boolean> | undefined>(undefined), wrapper = useRef<HTMLDivElement>(null);
  const schema = useMemo(() => createOpenEditorBlockNoteSchema(), []);
  const editor = useCreateBlockNote({ schema, initialContent: toBlockNoteForSchema(initial.document, schema) as never });
  const session = useMemo(() => createNoteOrganizationSession({ host: adapter.host, agent: syntheticNoteOrganizationAgent, idleMs: 1400 }), [adapter]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const life = useMemo(() => ({ generation: 0 }), [session]);
  const acceptSaved = (next: OrganizationSnapshot) => { base.current = next; setSaved(next); if (!titleDirty.current) setTitleDraft(next.title); session.update(next, !dirtyRef.current && !titleDirty.current && !composing.current); };
  const save = async (): Promise<boolean> => {
    if (pending.current) return pending.current;
    if (!dirtyRef.current) return true;
    const captured = generation.current, document = fromBlockNote(editor.document as never);
    const work = (async () => {
      try {
        const next = await adapter.edit(base.current, { document }); base.current = next; setSaved(next);
        if (captured === generation.current) { dirtyRef.current = false; setDirty(false); setNotice("保存済み"); session.update(next, !titleDirty.current && !composing.current); }
        else { setNotice("続きの入力を保存中"); session.update({ ...next, document: fromBlockNote(editor.document as never), revision: `draft-${generation.current}` }, false); }
        return true;
      } catch { setNotice("保存競合・切断です。入力は画面に保持しています。JSONで原文を退避できます。"); return false; }
      finally { pending.current = undefined; if (dirtyRef.current && captured !== generation.current) { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { void saveRef.current(); }, 250); } }
    })(); pending.current = work;
    return work;
  };
  const saveRef = useRef(save); saveRef.current = save;
  useEffect(() => editor.onChange((_e, context) => {
    if (applying.current || !context.getChanges().length) return;
    generation.current++; dirtyRef.current = true; setDirty(true); setNotice("入力を保持中");
    session.update({ ...base.current, revision: `draft-${generation.current}`, document: fromBlockNote(editor.document as never) }, false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void saveRef.current(); }, 250);
  }), [editor, session]);
  const sync = async (replaceBody = true) => {
    const captured = generation.current;
    const next = await adapter.host.read(base.current.documentId, readSignal());
    if (captured !== generation.current || dirtyRef.current || titleDirty.current || composing.current) { setNotice("続きの入力を保持しています。保存状態を確認してください。"); return; }
    if (!replaceBody && !organizationEqual(fromBlockNote(editor.document as never), next.document)) { session.update(base.current, false); throw new Error("canonical_body_conflict"); }
    if (replaceBody && !organizationEqual(fromBlockNote(editor.document as never), next.document)) {
      // Structural edits keep IDs and exact content. Preserve the public ProseMirror selection coordinates,
      // DOM focus and window scroll; reject replacement if the input epoch changes before this synchronous step.
      const pm = editor.prosemirrorView, selection = pm.state.selection, focused = pm.hasFocus(), scroll = { x: window.scrollX, y: window.scrollY };
      const inputEpoch = generation.current, scrollEpoch = viewportEpoch.current;
      const readCaretTop = () => {
        const selected = window.getSelection();
        if (!selected?.focusNode || !pm.dom.contains(selected.focusNode)) return undefined;
        const range = document.createRange(); range.setStart(selected.focusNode, selected.focusOffset); range.collapse(true);
        return range.getBoundingClientRect().top;
      };
      const caretTop = focused ? readCaretTop() : undefined;
      applying.current = true;
      try {
        const old = fromBlockNote(editor.document as never);
        const structural = old.blocks.length === next.document.blocks.length && old.blocks.every((b, i) => b.id === next.document.blocks[i]!.id && organizationEqual(b.content, next.document.blocks[i]!.content) && organizationEqual(b.children, next.document.blocks[i]!.children));
        if (!structural) throw new Error("body_not_structural");
        editor.transact(tr => {
          for (const b of next.document.blocks) {
            const previous = old.blocks.find(p => p.id === b.id)!;
            if (previous.type !== b.type || !organizationEqual(previous.props, b.props)) editor.updateBlock(b.id, { type: b.type, props: b.props } as never);
          }
          tr.setSelection(selection.map(tr.doc, tr.mapping));
          // AI history belongs to the atomic host receipt, not 500 separate local formatting undo items.
          tr.setMeta("addToHistory", false);
        });
        if (focused) pm.focus(); window.scrollTo(scroll.x, scroll.y);
        const mappedSelection = pm.state.selection;
        const preserveViewport = () => {
          if (!wrapper.current?.isConnected || generation.current !== inputEpoch || viewportEpoch.current !== scrollEpoch || composing.current || !pm.hasFocus() || !pm.state.selection.eq(mappedSelection)) return;
          if (scroll.y === 0) { window.scrollTo(scroll.x, scroll.y); return; }
          const nextTop = readCaretTop();
          if (caretTop !== undefined && nextTop !== undefined) window.scrollBy(0, nextTop - caretTop);
        };
        preserveViewport();
        // React node views settle after dispatch. Keep the focus endpoint stable after layout,
        // unless the person has typed, changed selection, touched or scrolled in the meantime.
        requestAnimationFrame(() => requestAnimationFrame(preserveViewport));
      } finally { applying.current = false; }
    }
    acceptSaved(next); setNotice("保存済み"); setHistory((await adapter.history()).length);
  };
  const syncRef = useRef(sync); syncRef.current = sync;
  useEffect(() => {
    if (state.status === "applied") void syncRef.current().then(() => adapter.clearRecovery(base.current.documentId)).catch(() => setNotice("保存済みデータとの同期を確認してください。原文は保存履歴にあります。"));
  }, [state.status, adapter]);
  useEffect(() => {
    const epoch = ++life.generation;
    session.setActive(false); session.update(base.current, false);
    void adapter.recovery(initial.documentId).then(async ticket => {
      if (epoch !== life.generation) return;
      if (!ticket) {
        session.update(base.current, !dirtyRef.current && !titleDirty.current && !composing.current);
        const history = await adapter.lastUndo(initial.documentId); if (epoch !== life.generation) return;
        if (history) session.restoreUndo(history.request, history.receipt);
        setHistory((await adapter.history()).length); session.setActive(true); return;
      }
      // An operation ticket survives reload. A dedicated temporary recovery coordinator only queries it.
      const recovered = createNoteOrganizationSession({ host: adapter.host, agent: syntheticNoteOrganizationAgent, recovery: ticket });
      try { recovered.update(base.current); await recovered.reconcile(); if (recovered.getRecovery()) { session.setActive(false); setNotice("保存結果を照会できません。再読込前に原文を退避してください。"); } else { await syncRef.current(); await adapter.clearRecovery(initial.documentId); const history = await adapter.lastUndo(initial.documentId); if (history) session.restoreUndo(history.request, history.receipt); session.update(base.current, !dirtyRef.current && !titleDirty.current && !composing.current); session.setActive(true); } }
      finally { recovered.dispose(); }
    }).catch(() => { session.setActive(false); setNotice("保存状態を確認できないため整理を停止しました"); });
    const start = () => { composing.current = true; session.compositionStart(); }, end = () => { composing.current = false; session.compositionEnd(); if (!dirtyRef.current && !titleDirty.current) session.update(base.current); };
    const element = wrapper.current; element?.addEventListener("compositionstart", start, true); element?.addEventListener("compositionend", end, true);
    const visibility = () => session.setActive(!document.hidden); document.addEventListener("visibilitychange", visibility);
    const viewportIntent = () => { viewportEpoch.current++; };
    document.addEventListener("keydown", viewportIntent, true);
    window.addEventListener("wheel", viewportIntent, { passive: true }); window.addEventListener("pointerdown", viewportIntent, { passive: true }); window.addEventListener("touchstart", viewportIntent, { passive: true });
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirtyRef.current || titleDirty.current || pending.current || session.getRecovery()) { event.preventDefault(); event.returnValue = ""; } };
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey && editor.prosemirrorView.hasFocus() && !dirtyRef.current && !titleDirty.current && session.getSnapshot().canUndo) { event.preventDefault(); event.stopPropagation(); void session.undo(); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void saveRef.current(); } };
    window.addEventListener("beforeunload", beforeUnload); document.addEventListener("keydown", shortcut, true);
    return () => { session.setActive(false); if (timer.current) clearTimeout(timer.current); element?.removeEventListener("compositionstart", start, true); element?.removeEventListener("compositionend", end, true); document.removeEventListener("visibilitychange", visibility); document.removeEventListener("keydown", viewportIntent, true); window.removeEventListener("wheel", viewportIntent); window.removeEventListener("pointerdown", viewportIntent); window.removeEventListener("touchstart", viewportIntent); window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("keydown", shortcut, true); queueMicrotask(() => { if (epoch === life.generation) session.dispose(); }); };
  }, [adapter, session, initial.documentId, life]);
  const control = async (patch: Parameters<typeof adapter.edit>[1]) => {
    if (controlLatch.current || session.getRecovery()) return;
    controlLatch.current = true; setControlBusy(true);
    if (patch.autoOrganize !== undefined) setAuthorizationDraft(patch.autoOrganize);
    try {
      await session.stop(); if (!await save()) return;
      const next = await adapter.edit(base.current, titleDirty.current ? { ...patch, title: titleDraft } : patch);
      if (titleDirty.current) { titleDirty.current = false; setHasTitleDraft(false); }
      acceptSaved(next); await session.reconnect();
    } catch { setNotice("変更を保存できません。現在の入力と許可を保持しています。"); }
    finally { controlLatch.current = false; setControlBusy(false); setAuthorizationDraft(undefined); }
  };
  const exportOriginal = () => {
    const blob = new Blob([JSON.stringify({ snapshot: base.current, manualTitleDraft: titleDirty.current ? titleDraft : undefined, draft: fromBlockNote(editor.document as never), recovery: session.getRecovery() }, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "synthetic-note-original.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const navigate = async (id: string) => { await session.stop(); if (await save()) await onNavigate(id); };
  const pendingUI = state.status === "applying" || state.status === "unknown" || dirty || navigationBusy || controlBusy;
  return <>
    <nav aria-label="合成ページツリー"><label>ノート<select aria-label="合成ノート" value={saved.documentId} disabled={pendingUI || hasTitleDraft} onChange={e => { void navigate(e.target.value); }}>{saved.pages.map(p => <option key={p.id} value={p.id}>{p.parentId ? "↳ " : ""}{p.title}</option>)}</select></label><span data-testid="organization-parent">親：{saved.pages.find(p => p.id === saved.parentId)?.title ?? "トップレベル"}</span></nav>
    <div className="organization-note-controls"><label>タイトル<input aria-label="ノートタイトル" maxLength={120} value={titleDraft} disabled={pendingUI} onCompositionStart={() => { composing.current = true; session.compositionStart(); }} onCompositionEnd={() => { composing.current = false; session.compositionEnd(); }} onChange={e => { setTitleDraft(e.target.value); titleDirty.current = true; setHasTitleDraft(true); generation.current++; session.update({ ...base.current, revision: `title-draft-${generation.current}` }, false); }} /></label><button type="button" disabled={pendingUI || !hasTitleDraft} onClick={() => { void control({ title: titleDraft }); }}>手動タイトルを保存</button>{hasTitleDraft ? <button type="button" disabled={pendingUI} onClick={() => { generation.current++; titleDirty.current = false; setHasTitleDraft(false); setTitleDraft(base.current.title); session.update(base.current, !dirtyRef.current && !composing.current); }}>タイトル編集をキャンセル</button> : null}<label><input type="checkbox" aria-label="親ページを固定" checked={saved.parentPinned} disabled={pendingUI} onChange={e => { void control({ parentPinned: e.target.checked }); }} />親ページを固定</label><span>{saved.titleManual ? "手動タイトルを保持" : "原文からタイトルを抽出"}</span></div>
    <NoteOrganizationCard authorized={authorizationDraft ?? saved.autoOrganize} status={state.status} notice={state.notice} composing={state.composing} canUndo={state.canUndo && !dirty} pending={state.status === "applying" || dirty || navigationBusy || controlBusy} ambiguousParent={state.plan ? saved.pages.find(p => p.id === state.plan!.parentId)?.title ?? "トップレベル" : undefined}
      onAuthorize={value => { void control({ autoOrganize: value }); }} onStop={() => { void session.stop(); }}
      onUndo={() => { void session.undo(); }} onReconnect={() => { void sync(false).then(() => session.reconnect()).catch(() => setNotice("再接続できません")); }}
      onReconcile={() => { void session.reconcile().then(() => { if (!session.getRecovery()) { void sync().then(() => adapter.clearRecovery(saved.documentId)); } }); }}
      onChooseParent={use => { void session.confirmPlacement(use ? state.plan!.parentId : saved.parentId); }} />
    <div className="organization-save"><p role="status" data-testid="organization-save">{notice} · 原文付き保存履歴 {history} 件</p><button type="button" disabled={!dirty} onClick={() => { void save(); }}>原文を保存 ⌘S</button><button type="button" onClick={exportOriginal}>原文をJSON退避</button></div>
    <div ref={wrapper} className="organization-body"><BlockNoteView editor={editor} theme="light" /></div>
    <details className="organization-faults"><summary>合成の保存失敗を試す</summary><label>保存障害<select aria-label="合成保存障害" value={fault} onChange={e => { const next = e.target.value as SyntheticFault; setFault(next); adapter.setFault(next); }}><option value="none">なし</option><option value="move-failure">移動処理の失敗（全体ロールバック）</option><option value="lost-ack">保存後の応答喪失</option><option value="offline">切断</option></select></label><p>実サービスには接続しません。ブラウザのサイトデータ削除でこの合成ノートも削除されます。</p></details>
  </>;
}
