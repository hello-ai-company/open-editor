import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type CSSProperties } from "react";
import type { NotesCommand, NotesCommandOutcome, NotesDocumentSnapshot, NotesPanelSnapshot, NotesTarget, NotesWorkspaceSnapshot } from "../notes/contracts.js";
import { createDocumentIndex } from "../index/documentIndex.js";
import type { createOpenEditorNotesPreset } from "../notes/preset.js";
import { NotesNavigation, NotesPageHub, type NotesNavigationMode } from "./NotesNavigation.js";
import { NotesDocumentSidebar, type NotesDocumentSidebarProps } from "./NotesDocumentSidebar.js";
import { NotesInspector } from "./NotesInspector.js";
import { notesTargetKey, type NotesEditorBridge, type NotesPanelDataState } from "./notesWorkspacePanels.js";
import { NotesBlockNoteDocument, type NotesDocumentRenderer } from "./NotesBlockNoteDocument.js";
import { NotesContentTools, type NotesContentToolsProps } from "./NotesContentTools.js";
import { NotesConflictReview } from "./NotesConflictReview.js";
import type { NotesInsertionHost } from "./NotesInsertDialog.js";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";

export type NotesWorkspacePreset = ReturnType<typeof createOpenEditorNotesPreset>;
export type NotesWorkspaceProps = {
  preset: NotesWorkspacePreset;
  initialTarget?: NotesTarget;
  onNavigate?(target: NotesTarget): Promise<boolean>;
  onCommand?(target: NotesTarget, command: NotesCommand): Promise<NotesCommandOutcome>;
  renderDocument?: NotesDocumentRenderer;
  /** Optional independently imported Canvas/Present/Site integration wraps this writer. */
  renderModes?(context: { target: NotesTarget; document: ReactNode; preset: NotesWorkspacePreset }): ReactNode;
  proposal?: ReactNode;
  insertion?: NotesInsertionHost;
  documentOptions?: Pick<NotesDocumentSidebarProps, "categoryOptions" | "privacyOptions">;
  /** Authorized host routes (Home/Inbox etc.) may add navigation without duplicating Notes editing UI. */
  navigationExtras?: ReactNode;
  className?: string;
  contentTools?: Omit<NotesContentToolsProps, "controller" | "panels" | "onRefreshPanels">;
};
/** Public Notes shell. Host supplies authorized records and canonical receipts; this component
 * owns both sidebar families, guarded navigation and the single active document writer. */
export function NotesWorkspace(props: NotesWorkspaceProps) {
  const { preset } = props, { controller, host, config } = preset;
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const [workspace, setWorkspace] = useState<NotesWorkspaceSnapshot>();
  const [capabilities, setCapabilities] = useState<Record<string, NotesDocumentSnapshot>>({}), [loadingMore, setLoadingMore] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const catalogEpoch = useRef(0), searchAbort = useRef<AbortController | undefined>(undefined);
  const [panels, setPanels] = useState<NotesPanelSnapshot>(), [panelState, setPanelState] = useState<NotesPanelDataState>("unavailable");
  const [boundBridge, setBridge] = useState<{ key: string; bridge: NotesEditorBridge }>();
  const [mode, setMode] = useState<NotesNavigationMode>("pages"), [leftOpen, setLeftOpen] = useState(false), [rightOpen, setRightOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]), [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0), operation = useRef(false), mounted = useRef(true);
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.innerWidth <= 1100);
  const workspaceRoot = useRef<HTMLElement>(null);
  const leftPanel = useRef<HTMLDivElement>(null), rightPanel = useRef<HTMLDivElement>(null), leftTrigger = useRef<HTMLButtonElement>(null), rightTrigger = useRef<HTMLButtonElement>(null);
  useDialogFocusTrap(compact && leftOpen, leftPanel); useDialogFocusTrap(compact && rightOpen, rightPanel);
  useEffect(() => { const update = () => setCompact((workspaceRoot.current?.getBoundingClientRect().width ?? window.innerWidth) <= 1100); const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : undefined; if (workspaceRoot.current) observer?.observe(workspaceRoot.current); window.addEventListener("resize", update); update(); return () => { observer?.disconnect(); window.removeEventListener("resize", update); }; }, []);
  const closePanels = () => { if (leftOpen) leftTrigger.current?.focus({ preventScroll: true }); if (rightOpen) rightTrigger.current?.focus({ preventScroll: true }); setLeftOpen(false); setRightOpen(false); };
  const targetKey = state.snapshot ? notesTargetKey(state.snapshot.target) : "empty";
  const bridge = boundBridge?.key === targetKey ? boundBridge.bridge : undefined;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (props.initialTarget) void controller.open(props.initialTarget).catch(() => { if (mounted.current) setError("文書を開けませんでした"); }); }, [controller]);
  useEffect(() => host.subscribe?.(() => setRefresh(value => value + 1)), [host]);
  useEffect(() => {
    if (!host.readWorkspace) return;
    searchAbort.current?.abort(); const abort = new AbortController(); searchAbort.current = abort; let live = true; const captured = ++catalogEpoch.current;
    void (async () => {
      const base = await host.readWorkspace!(abort.signal);
      if (base.scope.actorId !== host.scope.actorId || base.scope.workspaceId !== host.scope.workspaceId) throw new Error("Catalog scope changed");
      const result = catalogQuery && host.searchWorkspace ? await host.searchWorkspace(catalogQuery, abort.signal) : undefined;
      if (live && !abort.signal.aborted && captured === catalogEpoch.current) setWorkspace(result ? { ...base, ...result, complete: false } : base);
    })().catch(() => { if (live && !abort.signal.aborted) setError("一覧を読み込めませんでした。本文は保持しています"); });
    return () => { live = false; abort.abort(); };
  }, [host, refresh, state.snapshot?.revision, catalogQuery]);
  useEffect(() => {
    if (!workspace) return;
    const abort = new AbortController(); let live = true;
    void Promise.allSettled(workspace.pages.slice(0, 100).map(async page => [page.id, await host.readDocument({ kind: "page", pageId: page.id }, abort.signal)] as const)).then(results => {
      if (!live) return; const next: Record<string, NotesDocumentSnapshot> = {};
      for (const result of results) if (result.status === "fulfilled" && result.value[1].scope.actorId === host.scope.actorId && result.value[1].scope.workspaceId === host.scope.workspaceId) next[result.value[0]] = result.value[1];
      setCapabilities(next);
    });
    return () => { live = false; abort.abort(); };
  }, [host, workspace]);
  useEffect(() => {
    setPanels(undefined);
    if (!state.snapshot || !host.readPanels) { setPanelState("unavailable"); return; }
    const abort = new AbortController(); let live = true; const target = state.snapshot.target;
    setPanelState("loading");
    void host.readPanels(target, abort.signal).then(next => { if (live) { setPanels(next); setPanelState("ready"); } }).catch(() => { if (live) setPanelState("error"); });
    return () => { live = false; abort.abort(); };
  }, [host, targetKey, refresh]);
  const refreshPanels = useCallback(() => setRefresh(value => value + 1), []);
  const onBridge = useCallback((value: NotesEditorBridge) => setBridge({ key: targetKey, bridge: value }), [targetKey]);
  const open = async (target: NotesTarget) => {
    const success = await (props.onNavigate ? props.onNavigate(target) : controller.open(target));
    if (success && mounted.current) { if (target.kind === "page") setRecent(ids => [target.pageId, ...ids.filter(id => id !== target.pageId)].slice(0, 30)); setLeftOpen(false); setRightOpen(false); setError(""); }
    return success;
  };
  const command = async (target: NotesTarget, change: NotesCommand) => {
    if (props.onCommand) return props.onCommand(target, change);
    const cancelled: NotesCommandOutcome = { status: "cancelled", target, operationId: crypto.randomUUID() };
    if (operation.current) return cancelled;
    operation.current = true;
    try {
      if (!controller.getState().snapshot || notesTargetKey(controller.getState().snapshot!.target) !== notesTargetKey(target)) {
        if (!await controller.open(target)) return cancelled;
      }
      const current = controller.getState();
      if (current.composing || current.dirty || current.pendingEditors || current.status !== "ready" || !current.snapshot?.capabilities.includes(change.kind)) return cancelled;
      const outcome = await controller.execute(change);
      if (outcome.status === "committed" && mounted.current) refreshPanels();
      return outcome;
    } finally { operation.current = false; }
  };
  const blocked = state.composing || ["loading", "saving", "unknown"].includes(state.status);
  const body = state.snapshot ? <NotesBlockNoteDocument key={targetKey} preset={preset} onBridge={onBridge} render={props.renderDocument} insertion={props.insertion} media={props.contentTools?.media} /> : <p role="status">一覧からノートを選択してください</p>;
  const document = state.snapshot && props.renderModes ? props.renderModes({ target: state.snapshot.target, document: body, preset }) : body;
  const getSnapshot = (id: string) => state.snapshot?.target.kind === "page" && state.snapshot.target.pageId === id ? state.snapshot : capabilities[id];
  const pageOperations = workspace ? { workspace, activePageId: state.snapshot?.target.kind === "page" ? state.snapshot.target.pageId : undefined, status: state.status, message: state.message, getCapabilities: (id: string) => getSnapshot(id)?.capabilities ?? [], getPersistence: (id: string, kind: NotesCommand["kind"]) => getSnapshot(id)?.capabilitySemantics[kind], onOpen: open, onCommand: command, onCancel: controller.cancel, onReconcile: controller.reconcile, onWorkspaceChanged: refreshPanels } : undefined;
  const search = host.searchWorkspace ? async (query: string) => { setCatalogQuery(query.trim()); } : undefined;
  const loadMore = async () => {
    if (loadingMore || !workspace?.hasMore || !workspace.nextCursor || !host.readWorkspace) return;
    const captured = workspace, epoch = catalogEpoch.current, abort = new AbortController(); setLoadingMore(true);
    try {
      const page = catalogQuery && host.searchWorkspace ? { ...captured, ...await host.searchWorkspace(catalogQuery, abort.signal, { cursor: captured.nextCursor! }), complete: false } : await host.readWorkspace(abort.signal, { cursor: captured.nextCursor! });
      if (mounted.current && epoch === catalogEpoch.current && page.scope.actorId === host.scope.actorId && page.scope.workspaceId === host.scope.workspaceId) setWorkspace(current => current?.revision === captured.revision && page.revision === captured.revision ? { ...page, pages: [...current.pages, ...page.pages.filter(item => !current.pages.some(old => old.id === item.id))], complete: !catalogQuery && !page.hasMore } : current);
    } catch { if (mounted.current) setError("続きの一覧を読み込めませんでした"); }
    finally { if (mounted.current) setLoadingMore(false); }
  };
  return <main ref={workspaceRoot} data-compact={compact} className={["oe-notes-workspace", props.className].filter(Boolean).join(" ")} data-density={config.density} data-theme={config.theme} style={{ "--oe-notes-left-width": `${config.navigationWidth ?? 252}px`, "--oe-notes-right-width": `${config.inspectorWidth ?? 280}px` } as CSSProperties} onKeyDown={event => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void controller.save({ explicit: true }).catch(() => setError("入力は保持しています。保存結果を確認してください")); }
    if (event.key === "Escape" && !event.defaultPrevented) closePanels();
  }}>
    <header className="oe-notes-workspace-header" inert={compact && (leftOpen || rightOpen) || undefined}><strong>{config.title ?? "Notes"}</strong><button type="button" ref={leftTrigger} aria-expanded={leftOpen} onClick={() => { setRightOpen(false); setLeftOpen(value => !value); }}>ノート</button><span role="status">{state.status === "unknown" ? "保存結果は未確認" : state.dirty || state.pendingEditors ? "未保存の入力" : state.snapshot ? "保存を確認済み" : "ノートを選択"}</span><button type="button" disabled={blocked || !state.dirty || state.pendingEditors} onClick={() => void controller.save({ explicit: true }).catch(() => setError("保存できませんでした"))}>保存</button><button type="button" ref={rightTrigger} aria-expanded={rightOpen} onClick={() => { setLeftOpen(false); setRightOpen(value => !value); }}>編集ツール</button></header>
    {error ? <p role="alert">{error}</p> : null}
    {compact && (leftOpen || rightOpen) ? <div className="oe-notes-drawer-backdrop" aria-hidden="true" onClick={closePanels} /> : null}
    <div className="oe-notes-workspace-grid">
      <div className="oe-notes-workspace-left" ref={leftPanel} data-open={leftOpen} inert={compact && rightOpen || undefined} role={compact && leftOpen ? "dialog" : undefined} aria-modal={compact && leftOpen || undefined} aria-label={compact && leftOpen ? "ノートを選択" : undefined}>
        {compact ? <button type="button" onClick={closePanels}>閉じる</button> : null}
        {props.navigationExtras}
        {pageOperations ? <NotesNavigation {...pageOperations} mode={mode} onModeChange={setMode} recentPageIds={recent} sections={config.navigation} onSearch={search} onLoadMore={loadMore} loadingMore={loadingMore} onPreview={async (target, signal) => { const snapshot = await host.readDocument(target, signal), indexed = createDocumentIndex(); indexed.replaceFromBlocks(snapshot.document.blocks); const page = workspace!.pages.find(item => target.kind === "page" && item.id === target.pageId); if (!page) throw new Error("Unavailable"); return { page, content: <div>{indexed.list().map(entry => <p key={entry.blockId}>{entry.text}</p>)}</div> }; }} documentContent={bridge ? <NotesDocumentSidebar controller={controller} bridge={bridge} panels={panels} panelState={panelState} onRefreshPanels={refreshPanels} tabs={config.documentPanels} initialTab={config.defaultDocumentPanel} {...props.documentOptions} /> : <p>文書を開いてください</p>} /> : <p role="status">{host.readWorkspace ? "ノート一覧を読み込み中" : "一覧プロバイダーが未接続です"}</p>}
      </div>
      <section className="oe-notes-workspace-document" aria-label="ノート本文" inert={compact && (leftOpen || rightOpen) || undefined}>
        {state.snapshot ? <div className="oe-notes-document-header"><label>タイトル<input value={state.draftTitle ?? state.snapshot.title} disabled={blocked || !state.snapshot.capabilities.includes("document.save")} onCompositionStart={() => controller.setComposing(true)} onCompositionEnd={() => controller.setComposing(false)} onChange={event => controller.setDraft(state.draft ?? state.snapshot!.document, event.target.value)} /></label><small>{state.snapshot.capabilitySemantics["document.save"] ?? "読み取り専用"}</small></div> : null}
        {state.message || state.pendingEditors ? <div className="oe-notes-save-feedback" role={state.status === "error" || state.status === "conflict" ? "alert" : "status"}>{state.message}{state.status === "unknown" ? <button type="button" onClick={() => void controller.reconcile().catch(() => setError("結果の照会を確認できませんでした"))}>保存結果を照会</button> : null}{state.dirty || state.pendingEditors ? <button type="button" onClick={() => downloadDraft(controller.getState())}>入力を退避</button> : null}</div> : null}
        {document}
        <NotesConflictReview controller={controller} />
        {pageOperations && state.snapshot?.target.kind === "page" ? <details className="oe-notes-page-hub-wrap"><summary>子ページと関連ページ</summary><NotesPageHub {...pageOperations} pageId={state.snapshot.target.pageId} onShowPages={() => { setMode("pages"); setLeftOpen(true); }} /></details> : null}
      </section>
      <div className="oe-notes-workspace-right" ref={rightPanel} data-open={rightOpen} inert={compact && leftOpen || undefined} role={compact && rightOpen ? "dialog" : undefined} aria-modal={compact && rightOpen || undefined} aria-label={compact && rightOpen ? "編集ツール" : undefined}>{compact ? <button type="button" onClick={closePanels}>閉じる</button> : null}{bridge ? <><NotesInspector controller={controller} bridge={bridge} tabs={config.inspectorPanels} initialTab={config.defaultInspectorPanel} /><NotesContentTools controller={controller} panels={panels} onRefreshPanels={refreshPanels} codecs={bridge.contentCodecs} mediaBlockId={bridge.getSelectedBlockId?.()} onAssetAccepted={bridge.acceptAsset} {...props.contentTools} /></> : null}{props.proposal}</div>
    </div>
  </main>;
}
function downloadDraft(state: ReturnType<NotesWorkspacePreset["controller"]["getState"]>) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, target: state.snapshot?.target, draft: state.draft, title: state.draftTitle, localDrafts: state.localDrafts }, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "notes-draft.json"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
