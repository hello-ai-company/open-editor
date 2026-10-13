import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type CSSProperties } from "react";
import type { NotesCommand, NotesCommandOutcome, NotesDocumentSnapshot, NotesInspectorPanel, NotesPanelSnapshot, NotesTarget, NotesWorkspaceSnapshot } from "../notes/contracts.js";
import { createDocumentIndex } from "../index/documentIndex.js";
import type { createOpenEditorNotesPreset } from "../notes/preset.js";
import { NotesNavigation, NotesLibrary, NotesPageHub, type NotesNavigationMode } from "./NotesNavigation.js";
import { NotesDocumentSidebar, type NotesDocumentSidebarProps } from "./NotesDocumentSidebar.js";
import { NotesInspector } from "./NotesInspector.js";
import { notesTargetKey, notesPanelIdentity, type NotesEditorBridge, type NotesPanelDataState } from "./notesWorkspacePanels.js";
import { NotesBlockNoteDocument, type NotesDocumentRenderer } from "./NotesBlockNoteDocument.js";
import { NotesContentTools, type NotesContentToolsProps } from "./NotesContentTools.js";
import { NotesConflictReview } from "./NotesConflictReview.js";
import type { NotesInsertionHost } from "./NotesInsertDialog.js";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";
import { NotesDatabaseExplorer, type NotesDatabaseExplorerProps } from "./NotesDatabaseExplorer.js";
import { NotesAssistancePanel, type NotesAssistanceService } from "./NotesAssistancePanel.js";
import { NotesRelatedPages } from "./NotesRelatedPages.js";
import { NotesPageHeader } from "./NotesPageHeader.js";
import { NotesIcon, notesMetadataField, type NotesPageAppearanceOptions } from "./notesPresentation.js";
import { createPortal } from "react-dom";
import { NotesProposalSignal } from "./NotesProposalSignal.js";
import type { NotesSaveActionHandler } from "./notesSaveAction.js";
import { NotesFeedbackProvider, NotesDocumentFeedback, type NotesFeedbackMessage } from "./NotesFeedback.js";
import { notesNativeLinkCompositionSignal } from "./notesLinkPolicy.js";

export type NotesWorkspacePreset = ReturnType<typeof createOpenEditorNotesPreset>;
export type NotesWorkspaceProps = {
  preset: NotesWorkspacePreset;
  initialTarget?: NotesTarget;
  onNavigate?(target: NotesTarget): Promise<boolean>;
  onCommand?(target: NotesTarget, command: NotesCommand): Promise<NotesCommandOutcome>;
  renderDocument?: NotesDocumentRenderer;
  /** Observe only toolbar Save and Ctrl/Cmd+S. Does not intercept autosaves or change persistence. */
  onSaveAction?: NotesSaveActionHandler;
  /** Optional independently imported Canvas/Present/Site integration wraps this writer. */
  renderModes?(context: { target: NotesTarget; document: ReactNode; preset: NotesWorkspacePreset; documentTools?: ReactNode }): ReactNode;
  /** A shared navigation surface belongs to this workspace; never a second writer. */
  navigationMount?: HTMLElement | null;
  hideNavigation?: boolean;
  /** Keep page navigation in a drawer when the host already owns an application sidebar. */
  navigationPresentation?: "sidebar" | "drawer";
  /** Presentation only: does not change document persistence or navigation guards. */
  workspaceFeedback?: NotesFeedbackMessage;
  proposal?: ReactNode;
  assistance?: { search?: NotesAssistanceService; askPage?: NotesAssistanceService };
  databaseNavigation?: Pick<NotesDatabaseExplorerProps, "databases" | "host">;
  pageAppearance?: NotesPageAppearanceOptions;
  coediting?: import("./NotesBlockNoteDocument.js").NotesCoeditingOptions;
  /** Open the existing host proposal review; does not generate or apply. */
  selectionProposal?: import("./notesSelection.js").NotesSelectionProposalEntry;
  selectionAI?: import("./notesSelection.js").NotesSelectionAIService;
  insertion?: NotesInsertionHost;
  documentOptions?: Pick<NotesDocumentSidebarProps, "categoryOptions" | "privacyOptions" | "dictionaryEntries">;
  /** Authorized host routes (Home/Inbox etc.) may add navigation without duplicating Notes editing UI. */
  navigationExtras?: ReactNode;
  className?: string;
  contentTools?: Omit<NotesContentToolsProps, "controller" | "panels" | "onRefreshPanels">;
};
/** Public Notes shell. Host supplies authorized records and canonical receipts; this component
 * owns both sidebar families, guarded navigation and the single active document writer. */
export function NotesWorkspace(props: NotesWorkspaceProps) {
  const { preset } = props, { controller, host, config } = preset;
  const nativeLinkComposition = useMemo(() => notesNativeLinkCompositionSignal(controller), [controller]);
  const composingNativeLink = useSyncExternalStore(nativeLinkComposition.subscribe, nativeLinkComposition.getSnapshot, nativeLinkComposition.getSnapshot);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const [workspace, setWorkspace] = useState<NotesWorkspaceSnapshot>();
  const [capabilities, setCapabilities] = useState<Record<string, NotesDocumentSnapshot>>({}), [loadingMore, setLoadingMore] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const catalogEpoch = useRef(0), searchAbort = useRef<AbortController | undefined>(undefined);
  const [panels, setPanels] = useState<NotesPanelSnapshot>(), [panelState, setPanelState] = useState<NotesPanelDataState>("unavailable");
  const [boundBridge, setBridge] = useState<{ key: string; bridge: NotesEditorBridge }>();
  const [relationsOpen, setRelationsOpen] = useState<string>();
  const [bodyView, setBodyView] = useState<"body" | "children">("body");
  const [mode, setMode] = useState<NotesNavigationMode>("pages"), [leftOpen, setLeftOpen] = useState(false), [rightOpen, setRightOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [narrowTools, setNarrowTools] = useState(() => typeof window !== "undefined" && window.innerWidth <= 1120);
  const [railExpanded, setRailExpanded] = useState(false);
  const toolTabs = config.inspectorPanels ?? ["insert", "style", "info"], railMode = classicRailMode(config.appearance, narrowTools);
  const [activeTool, setActiveTool] = useState<NotesInspectorPanel>(config.defaultInspectorPanel ?? toolTabs[0] ?? "insert");
  const selectedTool = toolTabs.includes(activeTool) ? activeTool : toolTabs[0];
  const toolId = useId(), toolRail = useRef<HTMLDivElement>(null), railOpener = useRef<HTMLButtonElement>(null);

  const [recent, setRecent] = useState<string[]>([]), [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const saveStatus = useRef<HTMLSpanElement>(null), saveAction = useRef<AbortController | undefined>(undefined), savePending = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => { saveAction.current?.abort(); saveAction.current = undefined; savePending.current = undefined; }, [controller]);
  const save = async (source: "toolbar" | "shortcut", trigger: HTMLElement, keyboard: boolean) => {
    const before = controller.getState(), snapshot = before.snapshot;
    if (savePending.current || !snapshot || before.composing || nativeLinkComposition.getSnapshot() || before.recovery || before.status !== "ready" || !before.dirty && !before.manualSaveRequired) return;
    saveAction.current?.abort();
    const action = new AbortController(); saveAction.current = action; savePending.current = action;
    const nativeLinkGeneration = nativeLinkComposition.getGeneration();
    const sessionId = String(controller.getDraftSessionId?.() ?? "unversioned");
    const identity = Object.freeze({ scope: Object.freeze({ ...snapshot.scope }), target: Object.freeze({ ...snapshot.target }), revision: snapshot.revision, contentRevision: snapshot.contentRevision, sessionId });
    let operationId: string | undefined, invalidated = false;
    const sameOwner = () => { const live = controller.getState().snapshot; return !!live && live.scope.actorId === identity.scope.actorId && live.scope.workspaceId === identity.scope.workspaceId && notesTargetKey(live.target) === notesTargetKey(identity.target) && String(controller.getDraftSessionId?.() ?? "unversioned") === sessionId; };
    const unsubscribeController = controller.subscribe(() => {
      const live = controller.getState(), request = live.recovery?.request;
      if (!sameOwner() || live.composing || live.pendingEditors || live.draft !== before.draft && live.status === "saving") invalidated = true;
      if (request) {
        if (request.command.kind !== "document.save" || request.expectedRevision !== identity.revision || request.expectedContentRevision !== identity.contentRevision || request.scope.actorId !== identity.scope.actorId || request.scope.workspaceId !== identity.scope.workspaceId || notesTargetKey(request.target) !== notesTargetKey(identity.target) || operationId && operationId !== request.operationId) invalidated = true;
        else operationId = request.operationId;
      }
      if (invalidated) action.abort();
    });
    const unsubscribeLinkComposition = nativeLinkComposition.subscribe(() => { if (nativeLinkComposition.getSnapshot()) { invalidated = true; action.abort(); } });
    const unsubscribe = () => { unsubscribeController(); unsubscribeLinkComposition(); };
    action.signal.addEventListener("abort", unsubscribe, { once: true });
    let finished: ReturnType<NotesSaveActionHandler> = undefined;
    try { if (workspaceRoot.current && saveStatus.current) finished = props.onSaveAction?.(Object.freeze({ source, trigger, keyboard, workspace: workspaceRoot.current, statusTarget: saveStatus.current, identity, signal: action.signal })); } catch { action.abort(); /* Release observer listeners without cancelling persistence. */ }
    let outcome: NotesCommandOutcome | undefined;
    try {
      if (!nativeLinkComposition.getSnapshot()) outcome = await controller.save({ explicit: true });
      if (mounted.current && saveAction.current === action && sameOwner()) {
        if (outcome?.status === "committed") setSaveError("");
        else if (outcome && ["rejected", "not-found"].includes(outcome.status)) setSaveError("保存を確認できませんでした。入力を保持しています");
      }
    } catch { if (mounted.current && saveAction.current === action && sameOwner()) setSaveError("保存を確認できませんでした。入力を保持しています"); }
    if (savePending.current === action) savePending.current = undefined;
    unsubscribe(); action.signal.removeEventListener("abort", unsubscribe);
    const settled = controller.getState();
    const isCurrent = () => {
      const live = controller.getState();
      return !action.signal.aborted && !invalidated && mounted.current && saveAction.current === action && sameOwner() && live === settled && live.status === "ready" && !live.composing && nativeLinkComposition.getGeneration() === nativeLinkGeneration && !nativeLinkComposition.getSnapshot() && !live.pendingEditors && !live.recovery && !live.manualSaveRequired && !!operationId && outcome?.operationId === operationId
        && (outcome.status !== "committed" || !live.dirty && live.snapshot?.revision === outcome.snapshot.revision && live.snapshot?.contentRevision === outcome.snapshot.contentRevision);
    };
    try { finished?.({ outcome, isCurrent }); } catch { action.abort(); /* Host presentation cannot change the saved result. */ }
  };
  const [headerFeedback, setHeaderFeedback] = useState("");
  const onHeaderFeedback = useCallback((message: string) => setHeaderFeedback(message), []);
  const [refresh, setRefresh] = useState(0), operation = useRef(false), mounted = useRef(true);
  const classic = config.appearance === "classic", ja = config.locale?.startsWith("ja") ?? true, breakpoint = classic ? 840 : 1100;
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.innerWidth <= breakpoint);
  const [navigationNarrow, setNavigationNarrow] = useState(compact);
  // Split panes can be narrow inside a wide owner with a shared, visible sidebar.
  const navigationCompact = (classic ? navigationNarrow : compact) || props.navigationPresentation === "drawer";
  const workspaceRoot = useRef<HTMLElement>(null);
  const [mobile, setMobile] = useState(false);
  const [drawerBounds, setDrawerBounds] = useState({ left: 12, width: 320, top: 76 });
  const drawerStyle = { "--oe-notes-drawer-left": `${drawerBounds.left}px`, "--oe-notes-drawer-width": `${drawerBounds.width}px`, "--oe-notes-drawer-top": `${drawerBounds.top}px` } as CSSProperties;
  const leftPanel = useRef<HTMLDivElement>(null), rightPanel = useRef<HTMLDivElement>(null), leftTrigger = useRef<HTMLButtonElement>(null), rightTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!railMode || !rightOpen) return;
    const doc = workspaceRoot.current?.ownerDocument;
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || rightPanel.current?.contains(target) || toolRail.current?.contains(target)) return;
      // A picker owns its modal input until confirmation/cancellation. An ordinary
      // body click closes the nonmodal tools without taking focus from that input.
      if (target instanceof Element && target.closest(".oe-notes-dialog-backdrop,.oe-notes-overlay-layer,[role=dialog][aria-modal=true]")) return;
      setRightOpen(false); setRailExpanded(false);
    };
    doc?.addEventListener("pointerdown", outside, true);
    return () => doc?.removeEventListener("pointerdown", outside, true);
  }, [railMode, rightOpen]);
  useDialogFocusTrap(navigationCompact && leftOpen, leftPanel); useDialogFocusTrap(!railMode && compact && rightOpen, rightPanel);
  useEffect(() => {
    if (railMode || !classic || !compact || !rightOpen || !rightPanel.current) return;
    // The classic rail stays inside the document grid so its writer remains mounted.
    // Make the surrounding content inert, never the ancestor of the active drawer.
    const restored: { node: HTMLElement; inert: boolean }[] = [];
    let child: HTMLElement = rightPanel.current;
    while (child.parentElement) {
      const parent = child.parentElement;
      for (const sibling of parent.children) if (sibling !== child && sibling instanceof HTMLElement) {
        restored.push({ node: sibling, inert: sibling.inert }); sibling.inert = true;
      }
      if (parent.classList.contains("oe-notes-workspace-document")) break;
      child = parent;
    }
    return () => { for (const item of restored) item.node.inert = item.inert; };
  }, [classic, compact, rightOpen, railMode]);
  useEffect(() => {
    const root = workspaceRoot.current, owner = classic ? root?.closest<HTMLElement>(".oe-notes-tabbed-workspace") ?? root : root;
    const update = () => {
      const rect = owner?.getBoundingClientRect(), width = owner?.clientWidth ?? window.innerWidth, bodyWidth = root?.clientWidth ?? width;
      setNavigationNarrow(width <= breakpoint); setCompact(width <= breakpoint || classic && bodyWidth < 500); setMobile(width <= 720 || bodyWidth < 500); setNarrowTools(width <= 1120 || bodyWidth < 650);
      const anchor = toolRail.current?.getBoundingClientRect(), start = Math.max(12, rect?.left ? rect.left + 12 : 12);
      const drawerWidth = Math.max(1, Math.min(320, width - 24, window.innerWidth - 24));
      const left = railMode && anchor ? Math.max(12, Math.min(window.innerWidth - drawerWidth - 12, anchor.left - drawerWidth - 8)) : start;
      const top = Math.max(12, Math.min(window.innerHeight - 100, Math.max(76, (rect?.top ?? 0) + 12)));
      setDrawerBounds(before => before.left === left && before.width === drawerWidth && before.top === top ? before : { left, width: drawerWidth, top });
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : undefined;
    if (root) observer?.observe(root); if (owner && owner !== root) observer?.observe(owner);
    window.addEventListener("resize", update); if (leftOpen || rightOpen) window.addEventListener("scroll", update, true); update();
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [breakpoint, classic, leftOpen, rightOpen, railMode]);
  const collapseRail = () => { setRailExpanded(false); if (railMode) { setRightOpen(false); railOpener.current?.focus({ preventScroll: true }); return; } if (rightPanel.current?.contains(globalThis.document.activeElement)) rightTrigger.current?.focus({ preventScroll: true }); };
  const closePanels = () => { if (leftOpen) leftTrigger.current?.focus({ preventScroll: true }); if (rightOpen) { (railMode ? railOpener.current : rightTrigger.current)?.focus({ preventScroll: true }); if (compact && narrowTools) setRailExpanded(false); } if (classic && narrowTools && !compact) collapseRail(); setLeftOpen(false); setRightOpen(false); };
  const targetKey = state.snapshot ? notesTargetKey(state.snapshot.target) : "empty";
  const relationsKey = JSON.stringify([state.snapshot?.scope, state.snapshot?.target]);
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
    if (notesTargetKey(target) === targetKey) {
      if (classic && mode === "library") setMode("pages");
      setLeftOpen(false); setRightOpen(false);
      return true;
    }
    if (!await props.preset.beforeTableLeave()) return false;
    const success = await (props.onNavigate ? props.onNavigate(target) : controller.open(target));
    if (success && mounted.current) { if (target.kind === "page") setRecent(ids => [target.pageId, ...ids.filter(id => id !== target.pageId)].slice(0, 30)); if (classic && mode === "library") setMode("pages"); setLeftOpen(false); setRightOpen(false); setError(""); }
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
  const feedbackMessage = error || saveError || (state.status === "ready" ? headerFeedback || state.message : state.message || headerFeedback);
  const blocked = state.composing || composingNativeLink || ["loading", "saving", "unknown"].includes(state.status);
  const contentTools = bridge ? <NotesContentTools classic={classic} language={ja ? "ja" : "en"} controller={controller} panels={panels} onRefreshPanels={refreshPanels} codecs={bridge.contentCodecs} mediaBlockId={bridge.getSelectedBlockId?.()} onAssetAccepted={bridge.acceptAsset} {...props.contentTools} /> : null;
  const pageStyleKey = props.pageAppearance?.fields?.style;
  const pageStyle = pageStyleKey && typeof state.snapshot?.metadata[pageStyleKey] === "string" ? state.snapshot.metadata[pageStyleKey] as string : config.pageStyle ?? "clean";
  const inspector = bridge ? <><NotesInspector controller={controller} bridge={bridge} tabs={config.inspectorPanels} initialTab={config.defaultInspectorPanel} activePanel={railMode ? selectedTool : undefined} hideTabs={railMode} classic={classic} onPanelChange={panel => { if (panel) setActiveTool(panel); setRailExpanded(true); if (railMode) setRightOpen(true); }} language={ja ? "ja" : "en"} pageAppearance={props.pageAppearance} pageStyle={pageStyle} infoTools={contentTools} onFocusMode={() => setFocusMode(value => !value)} />{!classic ? contentTools : null}</> : null;
  const labels = { insert: ja ? "挿入" : "Insert", style: ja ? "書式" : "Style", info: ja ? "情報" : "Info" };
  const openTool = (panel: NotesInspectorPanel, button: HTMLButtonElement) => { railOpener.current = button; setLeftOpen(false); setActiveTool(panel); setRightOpen(true); setRailExpanded(true); };
  const tools = !toolTabs.length ? null : railMode ? <div className="oe-notes-tools-owner">
    <div className="oe-notes-tools-icons" ref={toolRail} role="tablist" aria-orientation="vertical" aria-label={ja ? "編集ツール" : "Document tools"}>{toolTabs.map((panel, index) => <button type="button" role="tab" key={panel} aria-label={labels[panel]} title={labels[panel]} aria-selected={rightOpen && selectedTool === panel} aria-controls={toolId} tabIndex={selectedTool === panel ? 0 : -1} onClick={event => openTool(panel, event.currentTarget)} onKeyDown={event => {
      if (event.nativeEvent.isComposing) return; const next = event.key === "Home" ? 0 : event.key === "End" ? toolTabs.length - 1 : event.key === "ArrowDown" || event.key === "ArrowRight" ? (index + 1) % toolTabs.length : event.key === "ArrowUp" || event.key === "ArrowLeft" ? (index + toolTabs.length - 1) % toolTabs.length : undefined;
      if (next === undefined) return; event.preventDefault(); const button = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]; if (button) { openTool(toolTabs[next]!, button); button.focus({ preventScroll: true }); }
    }}><NotesIcon name={panel} /></button>)}</div>
    <div id={toolId} className="oe-notes-workspace-right oe-notes-tools-overlay" ref={rightPanel} style={drawerStyle} hidden={!rightOpen} data-open={rightOpen} data-narrow="false" data-expanded="true" role="dialog" aria-label={selectedTool ? labels[selectedTool] : undefined}>
      <header className="oe-notes-tools-overlay-heading"><strong>{selectedTool ? labels[selectedTool] : ""}</strong><button type="button" aria-label={ja ? "ツールを閉じる" : "Close tools"} onClick={closePanels}>×</button></header>{inspector}
    </div>
  </div> : <div className="oe-notes-workspace-right" ref={rightPanel} style={drawerStyle} data-open={rightOpen} data-narrow={narrowTools} data-expanded={railExpanded} inert={navigationCompact && leftOpen || undefined} role={compact && rightOpen ? "dialog" : undefined} aria-modal={compact && rightOpen || undefined} aria-label={compact && rightOpen ? "編集ツール" : undefined}>{compact && (!classic || rightOpen) ? <button type="button" onClick={closePanels}>閉じる</button> : classic && narrowTools && railExpanded ? <button type="button" className="oe-notes-rail-close" aria-label={ja ? "ツールを閉じる" : "Close tools"} onClick={collapseRail}>×</button> : null}{inspector}</div>;
  // The writer subscribes to its own controller. Shell-only changes must not render the rich editor again.
  const hasDocument = Boolean(state.snapshot);
  const body = useMemo(() => hasDocument ? <NotesBlockNoteDocument key={targetKey} preset={preset} onBridge={onBridge} render={props.renderDocument} insertion={props.insertion} media={props.contentTools?.media} selectionAI={props.selectionAI} selectionProposal={props.selectionProposal} coediting={props.coediting} /> : <p role="status">一覧からノートを選択してください</p>, [hasDocument, targetKey, preset, onBridge, props.renderDocument, props.insertion, props.contentTools?.media, props.selectionAI, props.selectionProposal, props.coediting]);
  const document = state.snapshot && props.renderModes ? props.renderModes({ target: state.snapshot.target, document: body, preset, documentTools: classic ? tools : undefined }) : classic ? <div className="oe-notes-editor-surface" data-tools={Boolean(tools)}><div className="oe-notes-document-cell">{body}</div>{tools}</div> : body;
  const getSnapshot = (id: string) => state.snapshot?.target.kind === "page" && state.snapshot.target.pageId === id ? state.snapshot : capabilities[id];
  const iconField = notesMetadataField(props.pageAppearance?.fields?.icon);
  const presentedWorkspace = useMemo(() => workspace && iconField ? { ...workspace, pages: workspace.pages.map(page => {
    const snapshot = getSnapshot(page.id);
    return snapshot?.scope.actorId === workspace.scope.actorId && snapshot.scope.workspaceId === workspace.scope.workspaceId && snapshot.target.kind === "page" && snapshot.target.pageId === page.id && typeof snapshot.metadata[iconField] === "string" ? { ...page, icon: snapshot.metadata[iconField] as string } : page;
  }) } : workspace, [workspace, iconField, state.snapshot, capabilities]);
  const pageOperations = presentedWorkspace ? { workspace: presentedWorkspace, activePageId: state.snapshot?.target.kind === "page" ? state.snapshot.target.pageId : undefined, status: state.status, message: state.message, getCapabilities: (id: string) => getSnapshot(id)?.capabilities ?? [], getPersistence: (id: string, kind: NotesCommand["kind"]) => getSnapshot(id)?.capabilitySemantics[kind], onOpen: open, onCommand: command, onCancel: controller.cancel, onReconcile: controller.reconcile, onWorkspaceChanged: refreshPanels } : undefined;
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
  const navigation = <div className="oe-notes-workspace-left" ref={leftPanel} style={drawerStyle} data-compact={navigationCompact} data-open={leftOpen} inert={!railMode && compact && rightOpen || undefined} role={navigationCompact && leftOpen ? "dialog" : undefined} aria-modal={navigationCompact && leftOpen || undefined} aria-label={navigationCompact && leftOpen ? "ノートを選択" : undefined}>
        {navigationCompact ? <button type="button" onClick={closePanels}>閉じる</button> : null}
        {props.navigationExtras}
        {props.assistance && state.snapshot ? <div className="oe-notes-assistance-tools">{(["search", "ask-page"] as const).map(kind => <details key={kind}><summary>{ja ? kind === "search" ? "検索アシスタント" : "このページに質問" : kind === "search" ? "Search assistant" : "Ask this page"}</summary><NotesAssistancePanel controller={controller} scope={host.scope} kind={kind} service={kind === "search" ? props.assistance?.search : props.assistance?.askPage} onOpen={open} language={ja ? "ja" : "en"} /></details>)}</div> : null}
        {pageOperations ? <NotesNavigation {...pageOperations} mode={mode} onModeChange={setMode} bodyView={bodyView} onBodyViewChange={setBodyView} classic={classic} language={ja ? "ja" : "en"} recentPageIds={recent} sections={config.navigation} onSearch={search} onLoadMore={loadMore} loadingMore={loadingMore} onPreview={async (target, signal) => { const snapshot = await host.readDocument(target, signal), indexed = createDocumentIndex(); indexed.replaceFromBlocks(snapshot.document.blocks); const page = presentedWorkspace!.pages.find(item => target.kind === "page" && item.id === target.pageId); if (!page) throw new Error("Unavailable"); return { page, content: <div>{indexed.list().map(entry => <p key={entry.blockId}>{entry.text}</p>)}</div> }; }} documentContent={bridge ? <NotesDocumentSidebar classic={classic} language={ja ? "ja" : "en"} controller={controller} bridge={bridge} panels={panels} panelState={panelState} onRefreshPanels={refreshPanels} tabs={config.documentPanels} initialTab={config.defaultDocumentPanel} {...props.documentOptions} /> : <p>文書を開いてください</p>} /> : <p role="status">{host.readWorkspace ? "ノート一覧を読み込み中" : "一覧プロバイダーが未接続です"}</p>}
        {props.databaseNavigation && mode === "pages" ? <NotesDatabaseExplorer {...props.databaseNavigation} scope={host.scope} blocked={blocked || state.pendingEditors} onOpen={open} /> : null}
      </div>;
  return <NotesFeedbackProvider ownerRef={workspaceRoot} identity={notesPanelIdentity(controller, state.snapshot)} message={props.workspaceFeedback} inputRect={bridge?.getInputBounds} persistent={error || saveError || ["saving", "unknown", "error", "conflict", "denied"].includes(state.status) ? <div className="oe-notes-feedback-recovery" role={["saving", "unknown"].includes(state.status) ? "status" : "alert"}><p>{feedbackMessage || "保存状態を確認してください"}</p>{state.status === "saving" ? <button type="button" onClick={() => controller.cancel()}>操作を中断</button> : null}{state.status === "unknown" ? <button type="button" onClick={() => void controller.reconcile().then(result => { if (result.status === "committed") setSaveError(""); }).catch(() => setError("結果の照会を確認できませんでした"))}>保存結果を照会</button> : null}</div> : undefined}><main onPointerDownCapture={event => { event.currentTarget.dataset.focusInput = "pointer"; }} onKeyDownCapture={event => { if (["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) event.currentTarget.dataset.focusInput = "keyboard"; }} ref={workspaceRoot} data-compact={compact} className={["oe-notes-workspace", classic ? "oe-notes-classic" : undefined, props.className].filter(Boolean).join(" ")} data-page-style={["clean", "editorial", "journal", "mono", "compact", "midnight", "paperback", "postcard", "studio", "blueprint", "gallery", "minimal"].includes(pageStyle) ? pageStyle : config.pageStyle ?? "clean"} data-navigation-external={Boolean(props.navigationMount || props.hideNavigation)} data-navigation-mode={mode} data-focus-mode={focusMode} data-mobile={mobile} data-density={config.density} data-theme={config.theme} style={{ "--oe-notes-left-width": `${config.navigationWidth ?? (classic ? 300 : 252)}px`, "--oe-notes-right-width": `${config.inspectorWidth ?? (classic ? 188 : 280)}px` } as CSSProperties} onKeyDown={event => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void save("shortcut", event.target instanceof HTMLElement ? event.target : event.currentTarget, true); }
    if (event.key === "Escape" && !event.defaultPrevented) closePanels();
  }}>
    <header className="oe-notes-workspace-header" hidden={classic && mode === "library"} inert={navigationCompact && leftOpen || !railMode && compact && rightOpen || undefined}><strong hidden={classic}>{classic ? (ja ? "ノート" : "Note") : config.title ?? "Notes"}</strong><button type="button" hidden={props.hideNavigation || classic && !navigationCompact} ref={leftTrigger} aria-expanded={leftOpen} onClick={() => { setRightOpen(false); setLeftOpen(value => !value); }}>ノート</button><span ref={saveStatus} tabIndex={-1} role="status">{state.status === "unknown" ? "保存結果は未確認" : state.dirty || state.pendingEditors || state.manualSaveRequired ? "未保存の入力" : state.snapshot ? "保存を確認済み" : "ノートを選択"}</span><button type="button" disabled={blocked || !state.dirty && !state.manualSaveRequired || state.pendingEditors} onClick={event => void save("toolbar", event.currentTarget, event.detail === 0)}>保存</button><button type="button" hidden={railMode || classic && !compact && !narrowTools} ref={rightTrigger} aria-expanded={classic && narrowTools && !compact ? railExpanded : rightOpen} onClick={() => { setLeftOpen(false); if (classic && narrowTools && !compact) { setRightOpen(false); setRailExpanded(value => !value); } else { setRailExpanded(true); setRightOpen(value => !value); } }}>編集ツール</button>{focusMode ? <button type="button" onClick={() => setFocusMode(false)}>{ja ? "集中モードを終了" : "Exit focus mode"}</button> : null}</header>
    {(navigationCompact && leftOpen || !railMode && compact && rightOpen) ? <div className="oe-notes-drawer-backdrop" aria-hidden="true" onClick={closePanels} /> : null}
    <div className="oe-notes-workspace-grid">
      {!props.hideNavigation ? (props.navigationMount ? createPortal(navigation, props.navigationMount) : navigation) : null}
      {classic && mode === "library" && pageOperations ? <NotesLibrary {...pageOperations} classic language={ja ? "ja" : "en"} hasMore={workspace?.hasMore} onLoadMore={loadMore} loadingMore={loadingMore} getPresentation={page => { const meta = getSnapshot(page.id)?.metadata; return { summary: typeof meta?.summary === "string" ? meta.summary : undefined, workspace: typeof meta?.workspace === "string" ? meta.workspace : undefined, privacy: typeof meta?.privacy === "string" ? meta.privacy : undefined }; }} /> : null}
      <section hidden={classic && mode === "library"} className="oe-notes-workspace-document" aria-label="ノート本文" inert={navigationCompact && leftOpen || compact && !classic && rightOpen || undefined}>
        {classic && state.snapshot ? <NotesPageHeader key={targetKey} controller={controller} onFeedbackChange={onHeaderFeedback} appearance={props.pageAppearance} language={ja ? "ja" : "en"} pages={workspace?.pages} onShowPages={() => { setMode("pages"); if (navigationCompact) setLeftOpen(true); }} onOpen={pageId => open({ kind: "page", pageId })} /> : state.snapshot ? <div className="oe-notes-document-header"><label>タイトル<input value={state.draftTitle ?? state.snapshot.title} disabled={blocked || !state.snapshot.capabilities.includes("document.save")} onCompositionStart={() => controller.setComposing(true)} onCompositionEnd={() => controller.setComposing(false)} onChange={event => controller.setDraft(state.draft ?? state.snapshot!.document, event.target.value)} /></label><small>{state.snapshot.capabilitySemantics["document.save"] ?? "読み取り専用"}</small></div> : null}
        <NotesDocumentFeedback state={state} onBackup={() => downloadDraft(controller.getState())} />
        <div hidden={classic && bodyView === "children"}>{document}</div>
        {classic && bodyView === "children" && pageOperations && state.snapshot?.target.kind === "page" ? <NotesPageHub {...pageOperations} pageId={state.snapshot.target.pageId} /> : null}
        {props.proposal ? <NotesProposalSignal key={targetKey}>{props.proposal}</NotesProposalSignal> : null}
        <NotesConflictReview controller={controller} />
        {pageOperations && state.snapshot?.target.kind === "page" ? <details key={relationsKey} className="oe-notes-page-hub-wrap" onToggle={event => { const live = controller.getState().snapshot; if (JSON.stringify([live?.scope, live?.target]) === relationsKey) setRelationsOpen(event.currentTarget.open ? relationsKey : undefined); }}><summary>{ja ? "子ページと関連ページ" : "Children and related pages"}</summary><NotesPageHub {...pageOperations} pageId={state.snapshot.target.pageId} onShowPages={() => { setMode("pages"); setLeftOpen(true); }} />{relationsOpen === relationsKey ? <NotesRelatedPages controller={controller} host={host} workspace={workspace!} onOpen={open} language={ja ? "ja" : "en"} /> : null}</details> : null}
      </section>
      {!classic ? tools : null}
    </div>
  </main></NotesFeedbackProvider>;
}
function downloadDraft(state: ReturnType<NotesWorkspacePreset["controller"]["getState"]>) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, target: state.snapshot?.target, draft: state.draft, title: state.draftTitle, localDrafts: state.localDrafts, ...(state.sourceDrafts ? { retainedSourceDrafts: state.sourceDrafts.records } : {}) }, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "notes-draft.json"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function classicRailMode(appearance: string | undefined, narrow: boolean): boolean { return appearance === "classic" && narrow; }
