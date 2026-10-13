import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type CSSProperties } from "react";
import type { EditorBlock, EditorDocument } from "@hello-ai-company/editor-core";
import type { NotesCommand, NotesCommandOutcome, NotesDocumentSnapshot, NotesRecovery, NotesTarget, NotesWorkspaceConfig, NotesWorkspaceHost } from "../notes/contracts.js";
import { createOpenEditorNotesPreset } from "../notes/preset.js";
import { createNotesLayout, loadNotesLayout, notesLayoutPanes, notesLayoutStorageKey, notesTargetKey, openNotesTab, parseNotesLayout, repairNotesLayout, saveNotesLayout, type NotesLayoutScope, type NotesLayoutState, type NotesLayoutStorage } from "../notes/layoutState.js";
import { NotesWorkspace, type NotesWorkspacePreset, type NotesWorkspaceProps } from "./NotesWorkspace.js";
import { NotesWorkspaceTabs, type NotesNavigationIntent } from "./NotesWorkspaceTabs.js";
import type { NotesCanvasController } from "./NotesWorkspaceModes.js";
import type { NotesFeedbackMessage } from "./NotesFeedback.js";

type PresetOptions = Parameters<typeof createOpenEditorNotesPreset>[0];
export type NotesResourceLeaveContext = { target: NotesTarget; preset: NotesWorkspacePreset; signal: AbortSignal };
export type NotesTabbedWorkspaceOptions = {
  dictionary?: PresetOptions["dictionary"];
  host: NotesWorkspaceHost; config?: NotesWorkspaceConfig;
  features?: PresetOptions["features"]; databaseViewConfig?: PresetOptions["databaseViewConfig"];
  databasePresentation?: PresetOptions["databasePresentation"];
  tableEditing?: PresetOptions["tableEditing"];
  resolveSharedController?: PresetOptions["resolveSharedController"]; timeoutMs?: number;
  initialTarget?: NotesTarget; initialLayout?: NotesLayoutState;
  layoutStorage?: NotesLayoutStorage;
  /** Host supplies legacy key explicitly. Migration only copies; original bytes are retained. */
  legacyTabs?: { key: string; title?: (pageId: string) => string };
  recoveries?: readonly NotesRecovery[];
  /** Called once per loaded target. Return undefined when this target has no Canvas
   * entitlement (for example a DB row). Session owns disposal of returned controllers. */
  createCanvasController?(context: { target: NotesTarget; preset: NotesWorkspacePreset }): NotesCanvasController | undefined;
  /** Required for documents containing nested DB/shared writers. Must wait for row/widget
   * readiness and flush captured pending input without silently accepting partial saves. */
  beforeResourceLeave?(context: NotesResourceLeaveContext): Promise<boolean>;
};
export type NotesTabbedWorkspaceState = {
  layout: NotesLayoutState; status: "loading" | "ready" | "saving" | "invalid" | "error";
  persistence: "memory-only" | "host-storage"; message: string; invalidOriginal?: string;
  /** Notices remain pending until the exact clean writer is refreshed. */
  staleTargets?: readonly NotesTarget[];
};
export type NotesTabbedWorkspaceSession = {
  getState(): NotesTabbedWorkspaceState; subscribe(listener: () => void): () => void;
  initialize(): Promise<void>;
  getPreset(target: NotesTarget): NotesWorkspacePreset;
  getCanvasController(target: NotesTarget): NotesCanvasController | undefined;
  open(target: NotesTarget, signal?: AbortSignal): Promise<boolean>;
  prepareNavigation(target: NotesTarget, intent: NotesNavigationIntent, signal: AbortSignal): Promise<boolean>;
  beforeClose(target: NotesTarget, signal: AbortSignal): Promise<boolean>;
  setLayout(layout: NotesLayoutState): Promise<boolean>;
  repairLayout(): Promise<boolean>;
  execute(target: NotesTarget, command: NotesCommand): Promise<NotesCommandOutcome>;
  refreshTarget(target: NotesTarget): Promise<boolean>;
  dispose(): void;
};

function targetScopeKey(target: NotesTarget): string { return notesTargetKey(target); }
function nestedWriters(blocks: readonly EditorBlock[]): boolean {
  return blocks.some(block => ["databaseView", "pageTransclusion", "syncedBlock", "oeNotesSyncedBlock", "notes:database", "notes:database_view", "notes:synced_block"].includes(block.type) || (block.children && nestedWriters(block.children)));
}
function immutableLayout(layout: NotesLayoutState): NotesLayoutState {
  for (const tab of layout.tabs) { Object.freeze(tab.target); Object.freeze(tab); }
  Object.freeze(layout.tabs); Object.freeze(layout.scope); Object.freeze(layout.split.tabIds); Object.freeze(layout.split);
  return Object.freeze(layout);
}
/** Scope lives in the host instance. Each target has one cached writer, independent of panes.
 * Closing/navigation never projects a save until its controller has a canonical receipt. */
export function createNotesTabbedWorkspaceSession(options: NotesTabbedWorkspaceOptions): NotesTabbedWorkspaceSession {
  const scope: NotesLayoutScope = { ...options.host.scope };
  const initial = options.initialLayout ? parseNotesLayout(options.initialLayout, scope) : createNotesLayout(scope);
  const cache = new Map<string, NotesWorkspacePreset>(), listeners = new Set<() => void>();
  const invalidations = new Map<string, { target: NotesTarget; generation: number }>();
  let noticeGeneration = 0, unsubscribeResources: (() => void) | undefined;
  const canvases = new Map<string, NotesCanvasController | undefined>();
  let state: NotesTabbedWorkspaceState = Object.freeze({ layout: immutableLayout(initial), status: "loading", persistence: options.layoutStorage ? "host-storage" : "memory-only", message: "" });
  let disposed = false, busy = false, initialized: Promise<void> | undefined;
  const layoutKey = notesLayoutStorageKey(scope);
  let persistedOriginal: string | null = null;
  const initialStorage: NotesLayoutStorage | undefined = options.layoutStorage && {
    read: async key => { const original = await options.layoutStorage!.read(key); if (key === layoutKey) persistedOriginal = original; return original; },
    write: async (key, value, expected) => { await options.layoutStorage!.write(key, value, expected); if (key === layoutKey) persistedOriginal = value; }
  };
  const scopedStorage: NotesLayoutStorage | undefined = options.layoutStorage && {
    read: key => options.layoutStorage!.read(key),
    write: async (key, value, _expected) => { await options.layoutStorage!.write(key, value, persistedOriginal); if (key === layoutKey) persistedOriginal = value; }
  };
  const update = (patch: Partial<NotesTabbedWorkspaceState>) => { if (disposed) return; state = Object.freeze({ ...state, ...patch, ...(patch.layout ? { layout: immutableLayout(patch.layout) } : {}) }); for (const listener of listeners) { try { listener(); } catch { /* Observers cannot change persistence outcomes. */ } } };
  const getPreset = (target: NotesTarget): NotesWorkspacePreset => {
    if (disposed) throw new Error("Notes tab session disposed");
    const key = targetScopeKey(target), existing = cache.get(key);
    if (existing) return existing;
    const recovery = options.recoveries?.find(item => notesTargetKey(item.request.target) === key);
    const preset = createOpenEditorNotesPreset({ host: options.host, config: options.config, dictionary: options.dictionary, features: options.features, databaseViewConfig: options.databaseViewConfig, databasePresentation: options.databasePresentation, tableEditing: options.tableEditing, resolveSharedController: options.resolveSharedController, timeoutMs: options.timeoutMs, recovery, onNavigate: destination => api.open(destination) });
    cache.set(key, preset); return preset;
  };
  const ready = async (target: NotesTarget, signal?: AbortSignal): Promise<boolean> => {
    const controller = getPreset(target).controller, current = controller.getState();
    if (signal?.aborted || disposed) return false;
    if (current.snapshot && invalidations.has(targetScopeKey(target))) return api.refreshTarget(target);
    if (current.snapshot) return notesTargetKey(current.snapshot.target) === notesTargetKey(target) && current.snapshot.scope.actorId === scope.actorId && current.snapshot.scope.workspaceId === scope.workspaceId;
    if (current.recovery) return false;
    const cancel = () => controller.cancel(); signal?.addEventListener("abort", cancel, { once: true });
    try {
      const key = targetScopeKey(target), notice = invalidations.get(key);
      const opened = await controller.open(target) && !signal?.aborted && !disposed;
      if (opened && notice && invalidations.get(key) === notice) { invalidations.delete(key); update({ staleTargets: [...invalidations.values()].map(item => ({ ...item.target })) }); }
      return opened && !invalidations.has(key);
    }
    finally { signal?.removeEventListener("abort", cancel); }
  };
  const getCanvasController = (target: NotesTarget): NotesCanvasController | undefined => {
    const key = targetScopeKey(target), existing = canvases.get(key);
    if (canvases.has(key) || !options.createCanvasController) return existing;
    const preset = getPreset(target);
    if (!preset.controller.getState().snapshot) return undefined;
    const canvas = options.createCanvasController({ target, preset });
    if (!canvas) { canvases.set(key, undefined); return undefined; }
    const identity = canvas.identity;
    if (!identity || identity.scope.actorId !== scope.actorId || identity.scope.workspaceId !== scope.workspaceId || notesTargetKey(identity.target) !== key) { canvas.dispose(); throw new Error("Canvas controller scope mismatch"); }
    canvases.set(key, canvas); return canvas;
  };
  const guard = async (target: NotesTarget, signal: AbortSignal): Promise<boolean> => {
    if (signal.aborted || disposed) return false;
    const preset = getPreset(target), controller = preset.controller;
    if (!await ready(target, signal)) return false;
    if (controller.flushSourceDrafts && !await controller.flushSourceDrafts()) return false;
    // Drain all table journals before any other writer can reject the navigation.
    if (!await preset.beforeTableLeave(signal)) return false;
    const tablesCurrent = preset.captureTableLeaveGuard();
    const captured = controller.getState();
    if (captured.composing || captured.pendingEditors || captured.manualSaveRequired || captured.recovery || ["unknown", "saving", "loading", "conflict", "denied", "error"].includes(captured.status)) return false;
    if (options.beforeResourceLeave) {
      try { if (!await options.beforeResourceLeave({ target, preset, signal })) return false; } catch { return false; }
    } else if (nestedWriters((captured.draft ?? captured.snapshot!.document).blocks)) return false;
    if (signal.aborted || disposed) return false;
    const cancel = () => controller.cancel(); signal.addEventListener("abort", cancel, { once: true });
    try {
      const before = controller.getState();
      if (before.composing || before.pendingEditors || before.manualSaveRequired || before.recovery) return false;
      if (before.dirty) {
        const result = await controller.save();
        if (result?.status !== "committed") return false;
      }
      const after = controller.getState();
      if (signal.aborted || disposed || after.composing || after.pendingEditors || after.manualSaveRequired || after.dirty || after.recovery || after.status !== "ready" || notesTargetKey(after.snapshot!.target) !== targetScopeKey(target)) return false;
      const canvas = getCanvasController(target);
      if (canvas) {
        canvas.setDocumentRevision(after.snapshot!.contentRevision);
        const cancelCanvas = () => canvas.cancel(); signal.addEventListener("abort", cancelCanvas, { once: true });
        try {
          let cs = canvas.getState();
          if (cs.recovery || ["saving", "loading", "conflict", "denied", "invalid", "error"].includes(cs.status)) return false;
          if (!cs.snapshot && !cs.dirty && !await canvas.read()) return false;
          cs = canvas.getState();
          if (cs.dirty && cs.snapshot?.documentRevision !== after.snapshot!.contentRevision) {
            // Only rebase after this exact writer saved its body; never use remote
            // freshness as permission to overwrite a concurrent Canvas change.
            if (!before.dirty || before.snapshot!.contentRevision === after.snapshot!.contentRevision || !await canvas.rebaseDocumentRevision?.(after.snapshot!.contentRevision)) return false;
          }
          if (canvas.getState().dirty && !await canvas.save()) return false;
          cs = canvas.getState();
          if (cs.dirty || cs.recovery || !["ready", "empty"].includes(cs.status)) return false;
          // Input resumed while Canvas persistence awaited: keep the source writer mounted.
          if (controller.getState() !== after) return false;
        } finally { signal.removeEventListener("abort", cancelCanvas); }
      }
      return !signal.aborted && !disposed && tablesCurrent();
    } catch { return false; }
    finally { signal.removeEventListener("abort", cancel); }
  };
  const guardAll = async (targets: readonly NotesTarget[], signal: AbortSignal): Promise<boolean> => {
    const originalLayout = state.layout;
    const checked: { preset: NotesWorkspacePreset; state: ReturnType<NotesWorkspacePreset["controller"]["getState"]>; canvas?: NotesCanvasController; canvasState?: ReturnType<NotesCanvasController["getState"]>; tablesCurrent: () => boolean }[] = [];
    for (const target of targets.filter((item, index, all) => all.findIndex(other => targetScopeKey(other) === targetScopeKey(item)) === index)) {
      if (!await guard(target, signal)) return false;
      const preset = getPreset(target), canvas = getCanvasController(target);
      checked.push({ preset, state: preset.controller.getState(), canvas, canvasState: canvas?.getState(), tablesCurrent: preset.captureTableLeaveGuard() });
    }
    return !signal.aborted && !disposed && state.layout === originalLayout && checked.every(item => item.preset.controller.getState() === item.state && item.canvas?.getState() === item.canvasState && item.tablesCurrent());
  };
  type Activity = { layout: NotesLayoutState; tableGeneration?: number; writers: readonly { preset: NotesWorkspacePreset; state: ReturnType<NotesWorkspacePreset["controller"]["getState"]>; canvas?: NotesCanvasController; canvasState?: ReturnType<NotesCanvasController["getState"]> }[] };
  const captureActivity = (layout: NotesLayoutState): Activity => ({ layout, tableGeneration: options.tableEditing?.getGeneration(), writers: notesLayoutPanes(layout).map(pane => { const preset = getPreset(pane.tab.target), canvas = getCanvasController(pane.tab.target); return { preset, state: preset.controller.getState(), canvas, canvasState: canvas?.getState() }; }) });
  const unchanged = (activity: Activity): boolean => !disposed && state.layout === activity.layout && (!options.tableEditing || activity.tableGeneration !== undefined && activity.tableGeneration >= 0 && options.tableEditing.getGeneration() === activity.tableGeneration) && activity.writers.every(writer => writer.preset.controller.getState() === writer.state && writer.canvas?.getState() === writer.canvasState);
  let prepared: Activity | undefined;
  const persist = async (next: NotesLayoutState, activity = captureActivity(state.layout)): Promise<boolean> => {
    if (disposed || busy || state.status === "invalid") return false;
    if (!unchanged(activity)) { update({ message: "入力が再開されたため切り替えを停止しました。元の表示と入力を保持しています" }); return false; }
    const checked = parseNotesLayout(next, scope); busy = true; update({ status: "saving", message: "表示状態を保存中" });
    let restoring = false;
    try {
      if (scopedStorage) await saveNotesLayout(scopedStorage, checked);
      if (disposed) return false;
      if (!unchanged(activity)) {
        // Storage can finish after new input/IME starts. Restore only our exact layout write,
        // with CAS fencing concurrent actors; never switch/unmount the resumed source writer.
        if (scopedStorage) { restoring = true; await saveNotesLayout(scopedStorage, activity.layout); }
        update({ status: "ready", message: "入力が再開されたため表示状態を戻しました。原文と入力は保持しています" });
        return false;
      }
      update({ layout: checked, status: "ready", message: options.layoutStorage ? "表示状態を保存しました" : "表示状態はメモリ内のみ・再読込で復元されません" });
      return true;
    } catch { update({ status: "error", message: restoring ? "表示保存状態は未確認です。表示の復元が競合しました。元のタブと入力を保持しています。再読込前に入力を退避してください" : "表示保存状態は未確認です。元のタブと入力を保持しています" }); return false; }
    finally { busy = false; }
  };
  const api: NotesTabbedWorkspaceSession = {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getPreset,
    getCanvasController,
    initialize() {
      if (initialized) return initialized;
      initialized = (async () => {
        if (initialStorage) {
          const loaded = await loadNotesLayout(initialStorage, scope, options.legacyTabs);
          if (disposed) return;
          if (loaded.status === "invalid") { update({ status: "invalid", invalidOriginal: loaded.original, message: loaded.message }); return; }
          if (loaded.status === "unavailable") { update({ status: "error", message: loaded.message }); return; }
          if (loaded.status !== "empty" || !options.initialLayout) update({ layout: loaded.layout });
        }
        update({ status: "ready", message: options.layoutStorage ? "" : "表示状態はメモリ内のみ・再読込で復元されません" });
        if (!state.layout.tabs.length && options.initialTarget) { await api.open(options.initialTarget); return; }
        for (const pane of notesLayoutPanes(state.layout)) await ready(pane.tab.target);
        update({});
      })().catch(() => update({ status: "error", message: "ワークスペースを開けません。原本と入力は保持しています" }));
      return initialized;
    },
    async open(target, signal) {
      if (disposed || busy || state.status === "invalid" || state.status === "loading") return false;
      if (signal?.aborted) return false;
      const active = state.layout.tabs.find(tab => tab.id === state.layout.activeTabId);
      // Navigation to the active resource is not a refresh or a leave operation.
      // Explicit refreshTarget retains its canonical revision checks.
      if (active && targetScopeKey(active.target) === targetScopeKey(target)) return true;
      const captured = state.layout, abort = signal ?? new AbortController().signal;
      if (!await guardAll(notesLayoutPanes(captured).map(pane => pane.tab.target), abort)) return false;
      const activity = captureActivity(captured);
      if (!await ready(target, abort) || abort.aborted || !unchanged(activity)) { update({ message: "ノートを開けません。元の表示と入力は保持しています" }); return false; }
      const snapshot = getPreset(target).controller.getState().snapshot!;
      const next = openNotesTab(captured, { id: targetScopeKey(target), target, title: snapshot.title, pinned: false });
      return persist(next, activity);
    },
    async prepareNavigation(target, _intent, signal) {
      if (busy || disposed || state.status === "invalid") return false;
      const captured = state.layout;
      if (!await guardAll(notesLayoutPanes(captured).map(pane => pane.tab.target), signal)) return false;
      const activity = captureActivity(captured);
      const allowed = await ready(target, signal) && !signal.aborted && unchanged(activity);
      prepared = allowed ? activity : undefined;
      return allowed;
    },
    beforeClose: guard,
    async setLayout(next) {
      if (disposed || busy) return false;
      const checked = parseNotesLayout(next, scope), nextIds = new Set(notesLayoutPanes(checked).map(pane => targetScopeKey(pane.tab.target))), abort = new AbortController();
      const previousPreparation = prepared; prepared = undefined;
      if (previousPreparation && !unchanged(previousPreparation)) return false;
      const retained = new Set(checked.tabs.map(tab => targetScopeKey(tab.target)));
      const leaving = [...state.layout.tabs.filter(tab => !retained.has(targetScopeKey(tab.target))), ...notesLayoutPanes(state.layout).filter(pane => !nextIds.has(targetScopeKey(pane.tab.target))).map(pane => pane.tab)];
      if (!await guardAll(leaving.map(tab => tab.target), abort.signal)) return false;
      const activity = captureActivity(state.layout);
      for (const pane of notesLayoutPanes(checked)) if (!await ready(pane.tab.target, abort.signal)) return false;
      if (!unchanged(activity)) return false;
      return persist(checked, activity);
    },
    async repairLayout() {
      if (!scopedStorage || disposed || busy || state.status !== "invalid" || state.invalidOriginal === undefined) return false;
      const original = state.invalidOriginal, next = options.initialLayout ? parseNotesLayout(options.initialLayout, scope) : createNotesLayout(scope); busy = true;
      try { await repairNotesLayout(scopedStorage, next, original); update({ layout: next, status: "ready", invalidOriginal: undefined, message: "元の表示データを退避して修復しました" }); return true; }
      catch { update({ message: "表示データが変更されたため修復を停止しました。原本は保持しています" }); return false; }
      finally { busy = false; }
    },
    async execute(target, command) {
      const abort = new AbortController();
      const cancelled = (): NotesCommandOutcome => ({ status: "cancelled", target, operationId: `ui-cancelled-${globalThis.crypto.randomUUID()}` });
      // A receipt must remain reachable from an active target tab even if the requesting
      // sidebar unmounts. Never submit a hidden target operation from another tab's controller.
      try {
        if (disposed || busy || !await api.open(target, abort.signal) || !await guard(target, abort.signal)) return cancelled();
        const preset = getPreset(target), snapshot = preset.controller.getState().snapshot;
        const active = state.layout.tabs.find(tab => tab.id === state.layout.activeTabId);
        if (!active || notesTargetKey(active.target) !== notesTargetKey(target) || !snapshot || notesTargetKey(snapshot.target) !== notesTargetKey(target)) return cancelled();
        return await preset.controller.execute(command);
      }
      catch { return cancelled(); }
    },
    async refreshTarget(target) {
      if (disposed || busy) return false;
      const key = targetScopeKey(target), preset = cache.get(key), notice = invalidations.get(key);
      if (!preset?.controller.refresh) return false;
      // A refresh must not invalidate an independent unsaved Canvas.
      const canvas = canvases.get(key), hadCanvas = canvases.has(key), canvasState = canvas?.getState();
      if (canvasState && (canvasState.dirty || canvasState.recovery || !["ready", "empty"].includes(canvasState.status))) return false;
      if (!await preset.controller.refresh({ isCurrent: () => !disposed && canvases.has(key) === hadCanvas && canvases.get(key) === canvas && canvas?.getState() === canvasState && invalidations.get(key) === notice }) || disposed || canvases.has(key) !== hadCanvas || canvases.get(key) !== canvas || canvas?.getState() !== canvasState) return false;
      if (invalidations.get(key) !== notice) return false;
      invalidations.delete(key);
      if (notice) preset.databaseStore.invalidateReads();
      update({ staleTargets: [...invalidations.values()].map(item => ({ ...item.target })), message: invalidations.size ? "更新通知を保持しています。未確定入力を確認してください" : "" });
      return true;
    },
    dispose() { disposed = true; unsubscribeResources?.(); invalidations.clear(); for (const canvas of canvases.values()) canvas?.dispose(); canvases.clear(); for (const preset of cache.values()) preset.dispose(); cache.clear(); listeners.clear(); }
  };
  unsubscribeResources = options.host.subscribeResourceChanges?.(notice => {
    try {
      if (disposed || notice.scope.actorId !== scope.actorId || notice.scope.workspaceId !== scope.workspaceId) return;
      const t = notice.target;
      if (!t || (t.kind === "page" ? typeof t.pageId !== "string" || !t.pageId || t.pageId.length > 512 : t.kind !== "row" || typeof t.databaseId !== "string" || !t.databaseId || typeof t.rowId !== "string" || !t.rowId || t.databaseId.length > 512 || t.rowId.length > 512)) return;
      const target = t.kind === "page" ? { kind: "page" as const, pageId: t.pageId } : { kind: "row" as const, databaseId: t.databaseId, rowId: t.rowId };
      const key = targetScopeKey(target); invalidations.set(key, { target, generation: ++noticeGeneration });
      update({ staleTargets: [...invalidations.values()].map(item => ({ ...item.target })), message: "保存済みデータの更新通知があります。未確定入力は保持しています" });
      if (cache.has(key)) void api.refreshTarget(target).catch(() => { /* Keep stale notice for explicit retry. */ });
    } catch { /* Malformed read notice cannot change the writer or receipt. */ }
  });
  return api;
}

export type NotesTabbedWorkspaceProps = NotesTabbedWorkspaceOptions & {
  renderDocument?: NotesWorkspaceProps["renderDocument"];
  renderModes?(context: Parameters<NonNullable<NotesWorkspaceProps["renderModes"]>>[0] & { canvasController?: NotesCanvasController }): ReactNode;
  renderPreview?(context: { target: NotesTarget; snapshot: NotesDocumentSnapshot; document: EditorDocument }): ReactNode;
  proposal?: NotesWorkspaceProps["proposal"];
  assistance?: NotesWorkspaceProps["assistance"];
  databaseNavigation?: NotesWorkspaceProps["databaseNavigation"];
  pageAppearance?: NotesWorkspaceProps["pageAppearance"];
  selectionAI?: NotesWorkspaceProps["selectionAI"];
  selectionProposal?: NotesWorkspaceProps["selectionProposal"];
  /** Per writable pane; duplicate-target readonly panes never receive a port. */
  coediting?(context: { paneId: string; target: NotesTarget }): NotesWorkspaceProps["coediting"];
  navigationExtras?: NotesWorkspaceProps["navigationExtras"];
  navigationPresentation?: NotesWorkspaceProps["navigationPresentation"];
  contentTools?: NotesWorkspaceProps["contentTools"];
  insertion?: NotesWorkspaceProps["insertion"];
  documentOptions?: NotesWorkspaceProps["documentOptions"];
  className?: string;
};

export function NotesTabbedWorkspace(props: NotesTabbedWorkspaceProps) {
  // Host must keep one stable scoped adapter instance per mounted workspace.
  const session = useMemo(() => createNotesTabbedWorkspaceSession(props), [props.host]);
  const [navigationMount, setNavigationMount] = useState<HTMLDivElement | null>(null);
  const classic = props.config?.appearance === "classic";
  const [navigationDrawer, setNavigationDrawer] = useState(props.navigationPresentation === "drawer");
  useEffect(() => setNavigationDrawer(props.navigationPresentation === "drawer"), [props.navigationPresentation, props.host]);
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState);
  const activeTab = state.layout.tabs.find(tab => tab.id === state.layout.activeTabId);
  // Only explicitly confirmed layout successes expire. Warnings, memory-only storage,
  // stale resources and errors remain discoverable until the owning state changes.
  const layoutSuccess = state.status === "ready" && state.persistence === "host-storage" && !state.staleTargets?.length && ["表示状態を保存しました", "元の表示データを退避して修復しました"].includes(state.message);
  const workspaceFeedback: NotesFeedbackMessage | undefined = state.message ? { text: state.message, tone: state.status === "error" || state.status === "invalid" ? "error" : layoutSuccess ? "success" : "notice", persistent: !layoutSuccess } : undefined;
  const paneFeedback = state.status !== "loading" && state.status !== "invalid" && state.layout.tabs.length > 0;
  const activeController = activeTab ? session.getPreset(activeTab.target).controller : undefined;
  const styleField = props.pageAppearance?.fields?.style;
  const readActivePageStyle = useCallback(() => { const value = styleField ? activeController?.getState().snapshot?.metadata[styleField] : undefined; return typeof value === "string" && ["clean", "editorial", "journal", "mono", "compact", "midnight", "paperback", "postcard", "studio", "blueprint", "gallery", "minimal"].includes(value) ? value : props.config?.pageStyle ?? "clean"; }, [activeController, styleField, props.config?.pageStyle]);
  const activePageStyle = useSyncExternalStore(activeController?.subscribe ?? noSubscribe, readActivePageStyle, readActivePageStyle);
  const lifetime = useRef({ session, active: true }); lifetime.current = { session, active: true };
  useEffect(() => {
    lifetime.current = { session, active: true }; void session.initialize();
    return () => { lifetime.current = { session, active: false }; queueMicrotask(() => { if (!lifetime.current.active || lifetime.current.session !== session) session.dispose(); }); };
  }, [session]);
  return <section onPointerDownCapture={event => { event.currentTarget.dataset.focusInput = "pointer"; }} onKeyDownCapture={event => { if (["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) event.currentTarget.dataset.focusInput = "keyboard"; }} className={["oe-notes-tabbed-workspace", classic ? "oe-notes-classic" : undefined, props.className].filter(Boolean).join(" ")} style={classic && props.config?.navigationWidth ? { "--oe-notes-classic-left-width": `${props.config.navigationWidth}px` } as CSSProperties : undefined} aria-label="Notes workspace" data-page-style={activePageStyle} data-layout-persistence={state.persistence} data-navigation-presentation={navigationDrawer ? "drawer" : "sidebar"}>
    {!paneFeedback && !(state.status === "ready" && !state.layout.tabs.length) && state.message ? <div className="oe-notes-layout-feedback" role={state.status === "error" || state.status === "invalid" ? "alert" : "status"}><p>{state.message}</p>{state.status === "invalid" ? <button type="button" onClick={() => void session.repairLayout()}>元の表示データを保持して修復</button> : null}</div> : null}
    <div className={classic ? "oe-notes-classic-layout" : undefined}>
    {classic ? <div className="oe-notes-classic-navigation" ref={setNavigationMount} /> : null}
    <div className={classic ? "oe-notes-classic-detail" : undefined}>
    {classic ? <header className="oe-notes-detail-header"><button type="button" className="oe-notes-navigation-toggle" aria-label={props.config?.locale?.startsWith("ja") ? navigationDrawer ? "ページ一覧を固定" : "ページ一覧を折り畳む" : navigationDrawer ? "Pin pages sidebar" : "Collapse pages sidebar"} aria-pressed={!navigationDrawer} onClick={() => setNavigationDrawer(value => !value)}><span aria-hidden="true">▤</span>{props.config?.locale?.startsWith("ja") ? "ページ一覧" : "Pages"}</button></header> : null}
    {state.status !== "loading" && state.status !== "invalid" ? <div inert={state.status === "saving" ? true : undefined}><NotesWorkspaceTabs layout={state.layout} onChange={next => { void session.setLayout(next); }} beforeClose={session.beforeClose} onNavigate={(target, context) => session.prepareNavigation(target, context.intent, context.signal)} language={props.config?.locale?.startsWith("ja") ? "ja" : "en"} renderPane={({ tab, readOnly }) => readOnly ? <NotesReadonlyPane session={session} target={tab.target} render={props.renderPreview} /> : <NotesWorkspace workspaceFeedback={tab.id === state.layout.activeTabId ? workspaceFeedback : undefined} navigationPresentation={navigationDrawer ? "drawer" : "sidebar"} hideNavigation={classic && tab.id !== state.layout.activeTabId} navigationMount={classic && tab.id === state.layout.activeTabId ? navigationMount : undefined} preset={session.getPreset(tab.target)} renderDocument={props.renderDocument} renderModes={props.renderModes ? context => props.renderModes!({ ...context, canvasController: session.getCanvasController(tab.target) }) : undefined} databaseNavigation={props.databaseNavigation} assistance={props.assistance} proposal={props.proposal} pageAppearance={props.pageAppearance} selectionAI={props.selectionAI} selectionProposal={props.selectionProposal} coediting={props.coediting?.({ paneId: tab.id, target: tab.target })} navigationExtras={props.navigationExtras} contentTools={props.contentTools} insertion={props.insertion} documentOptions={props.documentOptions} onNavigate={target => session.open(target)} onCommand={session.execute} />} /></div> : null}
    {state.status === "ready" && !state.layout.tabs.length ? <NotesWorkspace workspaceFeedback={workspaceFeedback} preset={session.getPreset({ kind: "page", pageId: "__workspace_catalog__" })} renderDocument={props.renderDocument} onNavigate={target => session.open(target)} onCommand={session.execute} navigationExtras={props.navigationExtras} contentTools={props.contentTools} insertion={props.insertion} documentOptions={props.documentOptions} /> : null}
    </div></div>
  </section>;
}

function NotesReadonlyPane(props: { session: NotesTabbedWorkspaceSession; target: NotesTarget; render?: NotesTabbedWorkspaceProps["renderPreview"] }) {
  const controller = props.session.getPreset(props.target).controller;
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  if (!state.snapshot) return <p role="status">読み取り専用プレビューを読み込めません。保存結果が不明な場合は元のタブで照会してください。</p>;
  const document = state.draft ?? state.snapshot.document;
  if (props.render) { try { return <>{props.render({ target: props.target, snapshot: state.snapshot, document })}</>; } catch { return <p role="alert">プレビューを表示できません。原本と入力は保持しています。</p>; } }
  return <article className="oe-notes-readonly-preview" aria-label="読み取り専用"><h2>{state.draftTitle ?? state.snapshot.title}</h2><StaticBlocks blocks={document.blocks} /></article>;
}
function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map(item => item && typeof item === "object" && "text" in item && typeof item.text === "string" ? item.text : item && typeof item === "object" && "content" in item ? text(item.content) : "").join("");
}
function StaticBlocks({ blocks }: { blocks: readonly EditorBlock[] }) {
  return <>{blocks.map(block => <section key={block.id} data-block-type={block.type}>{block.type === "heading" ? <h3>{text(block.content)}</h3> : block.type === "codeBlock" ? <pre>{text(block.content)}</pre> : block.type === "checkListItem" ? <p>{block.props?.checked ? "☑ " : "☐ "}{text(block.content)}</p> : <p>{text(block.content) || `[${block.type}]`}</p>}{block.children ? <StaticBlocks blocks={block.children} /> : null}</section>)}</>;
}

const noSubscribe = () => () => {};
