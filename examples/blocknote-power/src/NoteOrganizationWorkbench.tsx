import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { createNoteOrganizationSession, organizationEqual, parseAgentEditorCapabilities, AGENT_EDITOR_OPERATIONS, type OrganizationSnapshot, type AgentNoteAssistance } from "@hello-ai-company/editor-ai";
import { createOpenEditorBlockNoteSchema, describeOpenEditorAgentSchema, fromBlockNote, toBlockNoteForSchema } from "@hello-ai-company/editor-blocknote";
import { OrganizationIcon, OrganizationReviewRail, useOrganizationViewport, organizationDialogKeys } from "./OrganizationReviewRail";
import { createSyntheticOrganizationHost, syntheticNoteOrganizationAgent, type SyntheticFault } from "./syntheticNoteOrganization";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@hello-ai-company/editor-blocknote/power.css";
import "./noteOrganization.css";

const readSignal = () => new AbortController().signal;
export function NoteOrganizationWorkbench() {
  const viewport = useOrganizationViewport();
  const [adapter] = useState(() => createSyntheticOrganizationHost("open-editor.synthetic-organization.v2", {
    capabilities: parseAgentEditorCapabilities({ ...describeOpenEditorAgentSchema(createOpenEditorBlockNoteSchema()), revision: "capabilities-1", operations: [...AGENT_EDITOR_OPERATIONS] }),
    selection: { revision: "selection-0", blockIds: [] }, proposalsAllowed: false, autoLinks: false
  }));
  const [saved, setSaved] = useState<OrganizationSnapshot>(), [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigationLatch = useRef(false);
  useEffect(() => { let active = true; void adapter.initialize().then(() => adapter.host.read("note", readSignal())).then(s => { if (active) setSaved(s); }).catch(() => { if (active) setError("合成データを開けません。既存文書は保持されています。"); }); return () => { active = false; }; }, [adapter]);
  const changeNote = async (id: string, canLeave: () => boolean) => { if (navigationLatch.current) return; navigationLatch.current = true; setBusy(true); try { const next = await adapter.host.read(id, readSignal()); if (!canLeave()) { setError("続きの入力を保持しました。保存後にもう一度移動してください。"); return; } setSaved(next); setError(""); } catch { setError("ノートを開けません"); } finally { navigationLatch.current = false; setBusy(false); } };
  return <main className="organization-workbench">
    <header className="organization-top" data-compact={viewport.width <= 1100 || viewport.height <= 560} style={{ top: viewport.top }}><a href="?" aria-label="通常のDocumentに戻る"><OrganizationIcon name="arrow" /><span>OpenEditor</span><span className="organization-mode">Document</span></a><span className="organization-synthetic-badge">合成デモ · 外部送信なし</span></header>
    {error ? <p role="alert">{error}</p> : null}
    {saved ? <OrganizationNote key={saved.documentId} initial={saved} adapter={adapter} onNavigate={changeNote} navigationBusy={busy} /> : <p role="status">合成ノートを開いています…</p>}
  </main>;
}
function OrganizationNote({ initial, adapter, onNavigate, navigationBusy }: { initial: OrganizationSnapshot; adapter: ReturnType<typeof createSyntheticOrganizationHost>; onNavigate(id: string, canLeave: () => boolean): Promise<void>; navigationBusy: boolean }) {
  const [saved, setSaved] = useState(initial), [notice, setNotice] = useState("保存済み"), [dirty, setDirty] = useState(false), [history, setHistory] = useState(0), [fault, setFault] = useState<SyntheticFault>("none"), [titleDraft, setTitleDraft] = useState(initial.title), [controlBusy, setControlBusy] = useState(false), [authorizationDraft, setAuthorizationDraft] = useState<boolean>();
  const controlLatch = useRef(false), titleDirty = useRef(false), viewportEpoch = useRef(0);
  const [assistanceDraft, setAssistanceDraft] = useState<AgentNoteAssistance>();
  const [hasTitleDraft, setHasTitleDraft] = useState(false), [saveIssue, setSaveIssue] = useState("");
  const base = useRef(initial), dirtyRef = useRef(false), generation = useRef(0), applying = useRef(false), composing = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), pending = useRef<Promise<boolean> | undefined>(undefined), wrapper = useRef<HTMLDivElement>(null);
  const schema = useMemo(() => createOpenEditorBlockNoteSchema(), []);
  const editor = useCreateBlockNote({ schema, initialContent: toBlockNoteForSchema(initial.document, schema) as never });
  const session = useMemo(() => createNoteOrganizationSession({ host: adapter.host, agent: syntheticNoteOrganizationAgent, idleMs: 1400 }), [adapter]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const settings = useRef<HTMLDialogElement>(null), settingsTrigger = useRef<HTMLButtonElement>(null), settingsReturnFocus = useRef<HTMLElement | null>(null);
  const viewport = useOrganizationViewport();
  const compactChrome = viewport.width <= 1100 || viewport.height <= 560;
  useEffect(() => { if (!compactChrome) return; const pm = editor.prosemirrorView, margin = pm.props.scrollMargin, threshold = pm.props.scrollThreshold; pm.setProps({ scrollMargin: { top: 84, bottom: 24, left: 12, right: 12 }, scrollThreshold: { top: 80, bottom: 20, left: 0, right: 0 } }); return () => { if (!pm.isDestroyed) pm.setProps({ scrollMargin: margin, scrollThreshold: threshold }); }; }, [editor, compactChrome]);
  const openSettings = (editTitle = false) => { settingsReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : settingsTrigger.current; settings.current?.showModal(); if (editTitle) settings.current?.querySelector<HTMLInputElement>('input[aria-label="ノートタイトル"]')?.focus({ preventScroll: true }); };
  const life = useMemo(() => ({ generation: 0 }), [session]);
  const acceptSaved = (next: OrganizationSnapshot) => { base.current = next; setSaved(next); if (!titleDirty.current) setTitleDraft(next.title); session.update(next, !dirtyRef.current && !titleDirty.current && !composing.current); };
  const captureScope = (canonical = base.current.document) => {
    type IdBlock = { id: string; children?: readonly IdBlock[] };
    const collect = (blocks: readonly IdBlock[], ids = new Set<string>()): Set<string> => { for (const b of blocks) { ids.add(b.id); if (b.children) collect(b.children, ids); } return ids; };
    const ids = collect(canonical.blocks), visibleIds = collect(editor.document);
    const selected = editor.prosemirrorView.state.selection;
    return adapter.captureSelection(base.current.documentId, selected.empty ? [] : (editor.getSelection()?.blocks.map(b => b.id).filter(id => ids.has(id) && visibleIds.has(id)) ?? []));
  };
  useEffect(() => editor.onSelectionChange(() => {
    if (applying.current || !base.current.assistance) return;
    const selection = captureScope();
    base.current = { ...base.current, assistance: { ...base.current.assistance, selection } };
    setSaved(base.current);
    session.update(base.current, !dirtyRef.current && !titleDirty.current && !composing.current);
  }), [adapter, editor, session]);
  const save = async (): Promise<boolean> => {
    if (pending.current) return pending.current;
    if (!dirtyRef.current) return true;
    const captured = generation.current, document = fromBlockNote(editor.document as never);
    const work = (async () => {
      try {
        let next = await adapter.edit(base.current, { document }); setSaveIssue("");
        if (next.assistance) next = { ...next, assistance: { ...next.assistance, selection: captureScope(next.document) } };
        base.current = next; setSaved(next);
        if (captured === generation.current) { dirtyRef.current = false; setDirty(false); setNotice("保存済み"); session.update(next, !titleDirty.current && !composing.current); }
        else { setNotice("続きの入力を保存中"); session.update({ ...next, document: fromBlockNote(editor.document as never), revision: `draft-${generation.current}` }, false); }
        return true;
      } catch { setSaveIssue("保存を確認できません。現在の入力を保持しています。設定から原文を退避できます。"); setNotice("保存競合・切断です。入力は画面に保持しています。JSONで原文を退避できます。"); return false; }
      finally { pending.current = undefined; if (dirtyRef.current && captured !== generation.current) { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { void saveRef.current(); }, 250); } }
    })(); pending.current = work;
    return work;
  };
  const saveRef = useRef(save); saveRef.current = save;
  useEffect(() => editor.onChange((_e, context) => {
    if (applying.current || !context.getChanges().length) return;
    generation.current++; dirtyRef.current = true; setDirty(true); setNotice("入力を保持中");
    if (base.current.assistance) {
      const selection = captureScope();
      // capture only canonical IDs during a draft; new/removed IDs are captured again after the human save.
      base.current = { ...base.current, assistance: { ...base.current.assistance, selection } };
    }
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
      try {
        const old = fromBlockNote(editor.document as never);
        const structural = old.blocks.length === next.document.blocks.length && old.blocks.every((b, i) => b.id === next.document.blocks[i]!.id && organizationEqual(b.children, next.document.blocks[i]!.children));
        if (!structural) throw new Error("body_not_structural");
        const changedContent = old.blocks.some((b, i) => !organizationEqual(b.content, next.document.blocks[i]!.content));
        if (changedContent && !await adapter.lastApplied(next.documentId)) throw new Error("content_without_atomic_receipt");
        if (captured !== generation.current || dirtyRef.current || titleDirty.current || composing.current) throw new Error("input_changed_before_link_sync");
        const visibleText = (value: unknown): string => Array.isArray(value) ? value.map(visibleText).join("") : value && typeof value === "object" ? ("text" in value ? String(value.text) : "content" in value ? visibleText(value.content) : JSON.stringify(value)) : String(value ?? "");
        const sameText = old.blocks.every((b, i) => visibleText(b.content) === visibleText(next.document.blocks[i]!.content));
        const bookmark = selection.getBookmark();
        if (!pm.state.selection.eq(selection)) throw new Error("selection_changed_before_sync");
        applying.current = true;
        editor.transact(tr => {
          for (const b of next.document.blocks) {
            const previous = old.blocks.find(p => p.id === b.id)!;
            if (previous.type !== b.type || !organizationEqual(previous.props, b.props) || !organizationEqual(previous.content, b.content)) editor.updateBlock(b.id, { type: b.type, props: b.props, ...(organizationEqual(previous.content, b.content) ? {} : { content: b.content }) } as never);
          }
          tr.setSelection(sameText ? bookmark.resolve(tr.doc) : selection.map(tr.doc, tr.mapping));
          // AI history belongs to the atomic host receipt, not 500 separate local formatting undo items.
          tr.setMeta("addToHistory", false);
        });
        if (focused) pm.focus(); window.scrollTo(scroll.x, scroll.y);
        const mappedSelection = pm.state.selection;
        const preserveViewport = () => {
          if (!wrapper.current?.isConnected || generation.current !== inputEpoch || viewportEpoch.current !== scrollEpoch || composing.current || !pm.hasFocus() || !pm.state.selection.eq(mappedSelection)) return;
          if (scroll.y === 0) { window.scrollTo(scroll.x, scroll.y); return; }
          const nextTop = readCaretTop();
          if (caretTop !== undefined && nextTop !== undefined) {
            const desiredY = window.scrollY + nextTop - caretTop;
            window.scrollBy(0, nextTop - caretTop);
            // A short editor has a minimum height. Its caret can move within that height while
            // the document bottom stays fixed, clamping scroll at the review panel. Reserve only
            // the missing bounded space below the note, then restore the same visible endpoint.
            const missing = desiredY - window.scrollY;
            const main = wrapper.current.closest<HTMLElement>(".organization-workbench");
            if (missing > 0.5 && main) {
              const oldReserve = Number.parseFloat(main.style.getPropertyValue("--oe-viewport-reserve")) || 0;
              main.style.setProperty("--oe-viewport-reserve", `${Math.min(1000, oldReserve + missing + 1)}px`);
              window.scrollTo(scroll.x, desiredY);
            }
          }
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
    const main = wrapper.current?.closest<HTMLElement>(".organization-workbench");
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
    const pageLink = (event: MouseEvent) => { const target = event.target instanceof Element ? event.target.closest("a[href^='oe-page:']") : null; if (!target) return; event.preventDefault(); const id = target.getAttribute("href")!.slice(8); if (base.current.pages.some(p => p.id === id)) void navigateRef.current(id); };
    element?.addEventListener("click", pageLink);
    const viewportIntent = () => { viewportEpoch.current++; };
    document.addEventListener("keydown", viewportIntent, true);
    window.addEventListener("wheel", viewportIntent, { passive: true }); window.addEventListener("pointerdown", viewportIntent, { passive: true }); window.addEventListener("touchstart", viewportIntent, { passive: true });
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirtyRef.current || titleDirty.current || pending.current || session.getRecovery()) { event.preventDefault(); event.returnValue = ""; } };
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey && editor.prosemirrorView.hasFocus() && !dirtyRef.current && !titleDirty.current && session.getSnapshot().canUndo) { event.preventDefault(); event.stopPropagation(); void session.undo(); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void saveRef.current(); } };
    window.addEventListener("beforeunload", beforeUnload); document.addEventListener("keydown", shortcut, true);
    return () => { main?.style.removeProperty("--oe-viewport-reserve"); session.setActive(false); if (timer.current) clearTimeout(timer.current); element?.removeEventListener("compositionstart", start, true); element?.removeEventListener("compositionend", end, true); element?.removeEventListener("click", pageLink); document.removeEventListener("visibilitychange", visibility); document.removeEventListener("keydown", viewportIntent, true); window.removeEventListener("wheel", viewportIntent); window.removeEventListener("pointerdown", viewportIntent); window.removeEventListener("touchstart", viewportIntent); window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("keydown", shortcut, true); queueMicrotask(() => { if (epoch === life.generation) session.dispose(); }); };
  }, [adapter, session, initial.documentId, life]);
  const control = async (patch: Parameters<typeof adapter.edit>[1]) => {
    if (controlLatch.current || session.getRecovery()) return;
    controlLatch.current = true; setControlBusy(true);
    if (patch.autoOrganize !== undefined) setAuthorizationDraft(patch.autoOrganize);
    if (patch.assistance) setAssistanceDraft(patch.assistance);
    try {
      await session.stop(); if (!await save()) return;
      const next = await adapter.edit(base.current, titleDirty.current ? { ...patch, title: titleDraft } : patch);
      if (titleDirty.current) { titleDirty.current = false; setHasTitleDraft(false); }
      acceptSaved(next); await session.reconnect();
    } catch { setNotice("変更を保存できません。現在の入力と許可を保持しています。"); }
    finally { controlLatch.current = false; setControlBusy(false); setAuthorizationDraft(undefined); setAssistanceDraft(undefined); }
  };
  const exportOriginal = () => {
    const blob = new Blob([JSON.stringify({ snapshot: base.current, manualTitleDraft: titleDirty.current ? titleDraft : undefined, draft: fromBlockNote(editor.document as never), recovery: session.getRecovery() }, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "synthetic-note-original.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const navigate = async (id: string) => {
    if (titleDirty.current || controlLatch.current || composing.current || session.getRecovery() || session.getSnapshot().status === "applying") { setNotice("現在の入力と保存状態を確認してから移動してください"); return; }
    const captured = generation.current;
    const canLeave = () => captured === generation.current && !dirtyRef.current && !titleDirty.current && !composing.current && !pending.current && !controlLatch.current && !session.getRecovery() && session.getSnapshot().status !== "applying";
    await session.stop(); if (!await save() || !canLeave()) { setNotice("続きの入力を保持しました。保存後にもう一度移動してください。"); return; }
    await onNavigate(id, canLeave);
  };
  const navigateRef = useRef(navigate); navigateRef.current = navigate;
  const pendingUI = state.status === "applying" || state.status === "unknown" || dirty || navigationBusy || controlBusy;
  return <>
    <div className="organization-toolbar">
      <nav aria-label="合成ページツリー"><select aria-label="合成ノート" value={saved.documentId} disabled={pendingUI || hasTitleDraft} onChange={e => { void navigate(e.target.value); }}>{saved.pages.map(p => <option key={p.id} value={p.id}>{p.parentId ? "↳ " : ""}{p.title === "Untitled" ? "無題のノート" : p.title}</option>)}</select><span data-testid="organization-parent">{saved.pages.find(p => p.id === saved.parentId)?.title ?? "マイノート"}</span></nav>
      <div className="organization-toolbar-actions"><span className="organization-save-state" data-save-state={saveIssue || state.status === "unknown" ? "uncertain" : dirty || hasTitleDraft || state.status === "applying" ? "pending" : "saved"} role="status" data-testid="organization-save">{notice}</span><button type="button" className="organization-icon-button" aria-label="本文・リンク・タイトル・配置をUndo" title="元に戻す" disabled={!state.canUndo || pendingUI || state.composing} onMouseDown={e => e.preventDefault()} onClick={() => { void session.undo(); }}><OrganizationIcon name="undo" /></button><button type="button" ref={settingsTrigger} className="organization-icon-button" aria-label="ノートと提案の設定" title="ノートと提案の設定" disabled={state.composing} onClick={() => openSettings()}><OrganizationIcon name="settings" /></button></div>
    </div>
    <div className="organization-layout"><section className="organization-writing" aria-label="文書編集"><div className="organization-page-heading"><div><span className="organization-eyebrow">MY NOTE</span><h1>{saved.title === "Untitled" ? "無題のノート" : saved.title}</h1></div><button type="button" className="organization-icon-button" aria-label="タイトルを編集" disabled={state.composing} onClick={() => openSettings(true)}><OrganizationIcon name="edit" /></button></div><div ref={wrapper} className="organization-body"><BlockNoteView editor={editor} theme="light" /></div></section></div>
    <OrganizationReviewRail state={state} saved={saved} saveIssue={saveIssue} busy={pendingUI || hasTitleDraft} writing={dirty || hasTitleDraft} onApprove={parent => { const focusedRail = !!document.activeElement?.closest(".organization-rail"), inputEpoch = generation.current, focusEpoch = viewportEpoch.current; const submit = state.plan?.assistance ? session.approveProposal(parent) : state.plan ? session.confirmPlacement(parent === undefined ? state.plan.parentId : parent) : Promise.resolve(); void submit.then(() => { if (focusedRail && wrapper.current?.isConnected && generation.current === inputEpoch && viewportEpoch.current === focusEpoch && !composing.current && document.activeElement === document.body) editor.prosemirrorView.focus(); }); }} onDismiss={() => { const focusedRail = !!document.activeElement?.closest(".organization-rail"); session.dismiss(); if (focusedRail) editor.prosemirrorView.focus(); }} onUndo={() => { void session.undo(); }} onEnable={() => { if (saved.assistance) void control({ assistance: { ...saved.assistance, proposalsAllowed: true } }); }} onSettings={() => openSettings()} onStop={() => { void session.stop(); }} onReconnect={() => { void sync(false).then(() => session.reconnect()).catch(() => setNotice("再開前の保存確認が必要です")); }} onReconcile={() => { void session.reconcile().then(() => { if (!session.getRecovery()) void sync().then(() => adapter.clearRecovery(saved.documentId)); }); }} />
    {saveIssue ? <span className="organization-sr-only" role="alert">{saveIssue}</span> : null}
    <dialog ref={settings} className="organization-settings" aria-label="ノートと提案の設定" style={{ margin: 0, left: viewport.left + Math.max(12, (viewport.width - 560) / 2), top: viewport.top + 16, width: Math.min(560, viewport.width - 24), maxHeight: viewport.height - 32 }} onKeyDown={organizationDialogKeys} onCancel={e => { if (composing.current) e.preventDefault(); }} onClose={() => { (settingsReturnFocus.current?.isConnected ? settingsReturnFocus.current : settingsTrigger.current)?.focus({ preventScroll: true }); }}>
      <div className="organization-settings-heading"><div><span className="organization-eyebrow">PREFERENCES</span><h2>ノートと提案</h2></div><button type="button" className="organization-icon-button" aria-label="設定を閉じる" disabled={state.composing} onClick={() => settings.current?.close()}><OrganizationIcon name="close" /></button></div>
      <div className="organization-settings-content"><h3>ノートの情報</h3>
    <div className="organization-note-controls"><label>タイトル<input aria-label="ノートタイトル" maxLength={120} value={titleDraft} disabled={pendingUI} onCompositionStart={() => { composing.current = true; session.compositionStart(); }} onCompositionEnd={() => { composing.current = false; session.compositionEnd(); }} onChange={e => { setTitleDraft(e.target.value); titleDirty.current = true; setHasTitleDraft(true); generation.current++; session.update({ ...base.current, revision: `title-draft-${generation.current}` }, false); }} /></label><button type="button" disabled={pendingUI || !hasTitleDraft} onClick={() => { void control({ title: titleDraft }); }}>手動タイトルを保存</button>{hasTitleDraft ? <button type="button" disabled={pendingUI} onClick={() => { generation.current++; titleDirty.current = false; setHasTitleDraft(false); setTitleDraft(base.current.title); session.update(base.current, !dirtyRef.current && !composing.current); }}>タイトル編集をキャンセル</button> : null}<label><input type="checkbox" aria-label="親ページを固定" checked={saved.parentPinned} disabled={pendingUI} onChange={e => { void control({ parentPinned: e.target.checked }); }} />親ページを固定</label><span>{saved.titleManual ? "手動タイトルを保持" : "原文からタイトルを抽出"}</span></div>
    <section className="organization-assistance" aria-label="控えめな提案とリンク整理">
      <label><input type="checkbox" checked={(assistanceDraft ?? saved.assistance)?.proposalsAllowed ?? false} disabled={pendingUI || state.status === "unknown"} onChange={e => { if (saved.assistance) void control({ assistance: { ...saved.assistance, proposalsAllowed: e.target.checked } }); }} />このノートで控えめな提案を受け取る</label>
      <label><input type="checkbox" checked={(assistanceDraft ?? saved.assistance)?.autoLinks ?? false} disabled={pendingUI || state.status === "unknown"} onChange={e => { if (saved.assistance) void control({ assistance: { ...saved.assistance, autoLinks: e.target.checked } }); }} />原文のURLをリンクにする自動適用を許可</label>
      <p>URLの追加・修正・削除は原文と権限を確認します。参照先を自動で開くことはありません。内部参照・削除・意味が変わる修正は確認が必要です。</p>



    </section>

      <section className="organization-assistance" aria-label="このノートの自動整理"><label><input type="checkbox" checked={authorizationDraft ?? saved.autoOrganize} disabled={pendingUI || state.status === "unknown"} onChange={e => { void control({ autoOrganize: e.target.checked }); }} />このノートの本文整理・タイトル・配置の自動適用を許可</label><p>自動適用は、提案を受け取る許可とは別です。タイトルや配置を手動で固定した内容は保持します。</p></section>
      <div className="organization-save"><span>原文付き保存履歴 {history} 件</span><button type="button" disabled={!dirty} onClick={() => { void save(); }}>原文を保存 ⌘S</button><button type="button" onClick={exportOriginal}>原文をJSON退避</button></div>
      <details className="organization-diagnostics"><summary>デモの検証と機能情報</summary>
    <details className="organization-faults"><summary>合成の保存失敗を試す</summary><label>保存障害<select aria-label="合成保存障害" value={fault} onChange={e => { const next = e.target.value as SyntheticFault; setFault(next); adapter.setFault(next); }}><option value="none">なし</option><option value="move-failure">移動処理の失敗（全体ロールバック）</option><option value="lost-ack">保存後の応答喪失</option><option value="offline">切断</option></select></label><p>実サービスには接続しません。ブラウザのサイトデータ削除でこの合成ノートも削除されます。</p></details>
    <details className="organization-capabilities"><summary>このホストで使える機能</summary><p>スキーマに存在するブロック：{saved.assistance?.capabilities.blockTypes.join("、")}</p><p>実行を許可した操作：{saved.assistance?.capabilities.operations.join("、") || "なし"}</p><p>DB・カラム・HTML・Canvasはこの合成ノートでは実行に接続していません。</p><label>合成ホストの操作<select aria-label="合成ホストの操作" disabled={pendingUI} value={saved.assistance?.capabilities.operations.length === 0 ? "denied" : saved.assistance?.capabilities.operations.includes("link.add") ? "all" : "structure"} onChange={e => { if (saved.assistance) void control({ assistance: { ...saved.assistance, capabilities: { ...saved.assistance.capabilities, revision: crypto.randomUUID(), operations: e.target.value === "denied" ? [] : AGENT_EDITOR_OPERATIONS.filter(op => e.target.value === "all" || !op.startsWith("link.")) } } }); }}><option value="all">本文整理とリンク</option><option value="structure">リンク操作を無効化</option><option value="denied">操作権限なし</option></select></label></details>

      </details><p className="organization-local-note">合成ノートをこのブラウザに保存します。実AI・外部サービスには接続しません。</p></div>
    </dialog>
  </>;
}
