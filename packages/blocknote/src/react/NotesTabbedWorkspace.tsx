import { useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { EditorBlock, EditorDocument } from "@hello-ai-company/editor-core";
import type { NotesCommand, NotesCommandOutcome, NotesDocumentSnapshot, NotesRecovery, NotesTarget, NotesWorkspaceConfig, NotesWorkspaceHost } from "../notes/contracts.js";
import { createOpenEditorNotesPreset } from "../notes/preset.js";
import { createNotesLayout, loadNotesLayout, notesLayoutPanes, notesLayoutStorageKey, notesTargetKey, openNotesTab, parseNotesLayout, repairNotesLayout, saveNotesLayout, type NotesLayoutScope, type NotesLayoutState, type NotesLayoutStorage } from "../notes/layoutState.js";
import { NotesWorkspace, type NotesWorkspacePreset, type NotesWorkspaceProps } from "./NotesWorkspace.js";
import { NotesWorkspaceTabs, type NotesNavigationIntent } from "./NotesWorkspaceTabs.js";

type PresetOptions = Parameters<typeof createOpenEditorNotesPreset>[0];
export type NotesResourceLeaveContext = { target: NotesTarget; preset: NotesWorkspacePreset; signal: AbortSignal };
export type NotesTabbedWorkspaceOptions = {
  host: NotesWorkspaceHost; config?: NotesWorkspaceConfig;
  features?: PresetOptions["features"]; databaseViewConfig?: PresetOptions["databaseViewConfig"];
  resolveSharedController?: PresetOptions["resolveSharedController"]; timeoutMs?: number;
  initialTarget?: NotesTarget; initialLayout?: NotesLayoutState;
  layoutStorage?: NotesLayoutStorage;
  /** Host supplies legacy key explicitly. Migration only copies; original bytes are retained. */
  legacyTabs?: { key: string; title?: (pageId: string) => string };
  recoveries?: readonly NotesRecovery[];
  /** Required for documents containing nested DB/shared writers. Must wait for row/widget
   * readiness and flush captured pending input without silently accepting partial saves. */
  beforeResourceLeave?(context: NotesResourceLeaveContext): Promise<boolean>;
};
export type NotesTabbedWorkspaceState = {
  layout: NotesLayoutState; status: "loading" | "ready" | "saving" | "invalid" | "error";
  persistence: "memory-only" | "host-storage"; message: string; invalidOriginal?: string;
};
export type NotesTabbedWorkspaceSession = {
  getState(): NotesTabbedWorkspaceState; subscribe(listener: () => void): () => void;
  initialize(): Promise<void>;
  getPreset(target: NotesTarget): NotesWorkspacePreset;
  open(target: NotesTarget, signal?: AbortSignal): Promise<boolean>;
  prepareNavigation(target: NotesTarget, intent: NotesNavigationIntent, signal: AbortSignal): Promise<boolean>;
  beforeClose(target: NotesTarget, signal: AbortSignal): Promise<boolean>;
  setLayout(layout: NotesLayoutState): Promise<boolean>;
  repairLayout(): Promise<boolean>;
  execute(target: NotesTarget, command: NotesCommand): Promise<NotesCommandOutcome>;
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
    const preset = createOpenEditorNotesPreset({ host: options.host, config: options.config, features: options.features, databaseViewConfig: options.databaseViewConfig, resolveSharedController: options.resolveSharedController, timeoutMs: options.timeoutMs, recovery, onNavigate: destination => api.open(destination) });
    cache.set(key, preset); return preset;
  };
  const ready = async (target: NotesTarget, signal?: AbortSignal): Promise<boolean> => {
    const controller = getPreset(target).controller, current = controller.getState();
    if (signal?.aborted || disposed) return false;
    if (current.snapshot) return notesTargetKey(current.snapshot.target) === notesTargetKey(target) && current.snapshot.scope.actorId === scope.actorId && current.snapshot.scope.workspaceId === scope.workspaceId;
    if (current.recovery) return false;
    const cancel = () => controller.cancel(); signal?.addEventListener("abort", cancel, { once: true });
    try { return await controller.open(target) && !signal?.aborted && !disposed; }
    finally { signal?.removeEventListener("abort", cancel); }
  };
  const guard = async (target: NotesTarget, signal: AbortSignal): Promise<boolean> => {
    if (signal.aborted || disposed) return false;
    const preset = getPreset(target), controller = preset.controller;
    if (!await ready(target, signal)) return false;
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
      return !signal.aborted && !disposed && !after.composing && !after.pendingEditors && !after.manualSaveRequired && !after.dirty && !after.recovery && after.status === "ready" && notesTargetKey(after.snapshot!.target) === targetScopeKey(target);
    } catch { return false; }
    finally { signal.removeEventListener("abort", cancel); }
  };
  type Activity = { layout: NotesLayoutState; writers: readonly { preset: NotesWorkspacePreset; state: ReturnType<NotesWorkspacePreset["controller"]["getState"]> }[] };
  const captureActivity = (layout: NotesLayoutState): Activity => ({ layout, writers: notesLayoutPanes(layout).map(pane => { const preset = getPreset(pane.tab.target); return { preset, state: preset.controller.getState() }; }) });
  const unchanged = (activity: Activity): boolean => !disposed && state.layout === activity.layout && activity.writers.every(writer => writer.preset.controller.getState() === writer.state);
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
      const captured = state.layout, abort = signal ?? new AbortController().signal;
      for (const pane of notesLayoutPanes(captured)) if (!await guard(pane.tab.target, abort)) return false;
      const activity = captureActivity(captured);
      if (!await ready(target, abort) || abort.aborted || !unchanged(activity)) { update({ message: "ノートを開けません。元の表示と入力は保持しています" }); return false; }
      const snapshot = getPreset(target).controller.getState().snapshot!;
      const next = openNotesTab(captured, { id: targetScopeKey(target), target, title: snapshot.title, pinned: false });
      return persist(next, activity);
    },
    async prepareNavigation(target, _intent, signal) {
      if (busy || disposed || state.status === "invalid") return false;
      const captured = state.layout;
      for (const pane of notesLayoutPanes(captured)) if (!await guard(pane.tab.target, signal)) return false;
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
      for (const tab of state.layout.tabs) if (!retained.has(targetScopeKey(tab.target)) && !await guard(tab.target, abort.signal)) return false;
      for (const pane of notesLayoutPanes(state.layout)) if (!nextIds.has(targetScopeKey(pane.tab.target)) && !await guard(pane.tab.target, abort.signal)) return false;
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
    dispose() { disposed = true; for (const preset of cache.values()) preset.dispose(); cache.clear(); listeners.clear(); }
  };
  return api;
}

export type NotesTabbedWorkspaceProps = NotesTabbedWorkspaceOptions & {
  renderDocument?: NotesWorkspaceProps["renderDocument"];
  renderModes?: NotesWorkspaceProps["renderModes"];
  renderPreview?(context: { target: NotesTarget; snapshot: NotesDocumentSnapshot; document: EditorDocument }): ReactNode;
  proposal?: NotesWorkspaceProps["proposal"];
  navigationExtras?: NotesWorkspaceProps["navigationExtras"];
  contentTools?: NotesWorkspaceProps["contentTools"];
  insertion?: NotesWorkspaceProps["insertion"];
  documentOptions?: NotesWorkspaceProps["documentOptions"];
  className?: string;
};

export function NotesTabbedWorkspace(props: NotesTabbedWorkspaceProps) {
  // Host must keep one stable scoped adapter instance per mounted workspace.
  const session = useMemo(() => createNotesTabbedWorkspaceSession(props), [props.host]);
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState);
  const lifetime = useRef({ session, active: true }); lifetime.current = { session, active: true };
  useEffect(() => {
    lifetime.current = { session, active: true }; void session.initialize();
    return () => { lifetime.current = { session, active: false }; queueMicrotask(() => { if (!lifetime.current.active || lifetime.current.session !== session) session.dispose(); }); };
  }, [session]);
  return <section className={["oe-notes-tabbed-workspace", props.className].filter(Boolean).join(" ")} aria-label="Notes workspace" data-layout-persistence={state.persistence}>
    <p role={state.status === "error" || state.status === "invalid" ? "alert" : "status"}>{state.message}</p>
    {state.status === "invalid" ? <button type="button" onClick={() => void session.repairLayout()}>元の表示データを保持して修復</button> : null}
    {state.status !== "loading" && state.status !== "invalid" ? <div inert={state.status === "saving" ? true : undefined}><NotesWorkspaceTabs layout={state.layout} onChange={next => { void session.setLayout(next); }} beforeClose={session.beforeClose} onNavigate={(target, context) => session.prepareNavigation(target, context.intent, context.signal)} language={props.config?.locale?.startsWith("ja") ? "ja" : "en"} renderPane={({ tab, readOnly }) => readOnly ? <NotesReadonlyPane session={session} target={tab.target} render={props.renderPreview} /> : <NotesWorkspace preset={session.getPreset(tab.target)} renderDocument={props.renderDocument} renderModes={props.renderModes} proposal={props.proposal} navigationExtras={props.navigationExtras} contentTools={props.contentTools} insertion={props.insertion} documentOptions={props.documentOptions} onNavigate={target => session.open(target)} onCommand={session.execute} />} /></div> : null}
    {state.status === "ready" && !state.layout.tabs.length ? <NotesWorkspace preset={session.getPreset({ kind: "page", pageId: "__workspace_catalog__" })} renderDocument={props.renderDocument} onNavigate={target => session.open(target)} onCommand={session.execute} navigationExtras={props.navigationExtras} contentTools={props.contentTools} insertion={props.insertion} documentOptions={props.documentOptions} /> : null}
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
