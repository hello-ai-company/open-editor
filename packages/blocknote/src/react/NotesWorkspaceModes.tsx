import { Component, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { EditorDocument, JsonValue } from "@hello-ai-company/editor-core";
import { copyLegacyNotesJson } from "../document/legacyNotes.js";
import { notesLayoutStorageKey, notesTargetKey, type NotesLayoutScope } from "../notes/layoutState.js";
import type { NotesTarget } from "../notes/contracts.js";

export type NotesWorkspaceMode = "document" | "canvas" | "present" | "site";
export type NotesCanvasTemplate = "landing-page" | "report" | "presentation";
export type NotesCanvasTheme = "minimal" | "editorial" | "modern" | "premium" | "playful" | "technical";
export type NotesCanvasDraft = { layout: JsonValue; view: JsonValue; theme: NotesCanvasTheme };
export type NotesCanvasSnapshot = {
  scope: NotesLayoutScope; target: NotesTarget; revision: string; documentRevision: string;
  layout: JsonValue | null; view: JsonValue; theme: NotesCanvasTheme;
  capabilities: readonly ("canvas.save" | "canvas.repair")[];
};
export type NotesCanvasRequest = {
  operationId: string; scope: NotesLayoutScope; target: NotesTarget;
  expectedRevision: string; expectedDocumentRevision: string; draft: NotesCanvasDraft;
  /** Explicit user action; host archives original invalid payload before replacing it. */
  repair: boolean;
};
export type NotesCanvasResult = { operationId: string; scope: NotesLayoutScope; target: NotesTarget } & (
  | { status: "committed"; snapshot: NotesCanvasSnapshot }
  | { status: "unknown" | "pending" | "conflict" | "denied" | "rejected" }
  | { status: "not-found"; terminal: true }
);
export type NotesCanvasRecovery = { version: 1; request: NotesCanvasRequest };
export type NotesCanvasHost = {
  read(scope: NotesLayoutScope, target: NotesTarget, signal: AbortSignal): Promise<NotesCanvasSnapshot>;
  /** Reauthorize scope/target, compare BOTH revisions, append history, preserve unknown fields,
   * atomically store canonical layout+receipt. Reusing an id with different bytes is rejected. */
  commit(request: NotesCanvasRequest, signal: AbortSignal): Promise<NotesCanvasResult>;
  /** Read-only authoritative lookup. terminal not-found fences any delayed write with this id. */
  lookup(scope: NotesLayoutScope, target: NotesTarget, operationId: string, signal: AbortSignal): Promise<NotesCanvasResult>;
  /** Durable host-owned scoped journal BEFORE submission; failure prevents commit. */
  beforeSubmit(recovery: NotesCanvasRecovery, signal: AbortSignal): Promise<void>;
};
export type NotesCanvasState = {
  status: "empty" | "loading" | "ready" | "local" | "saving" | "unknown" | "conflict" | "denied" | "invalid" | "error";
  snapshot?: NotesCanvasSnapshot; draft?: NotesCanvasDraft; dirty: boolean;
  recovery?: NotesCanvasRecovery; message: string;
};
export type NotesCanvasController = {
  getState(): NotesCanvasState; subscribe(listener: () => void): () => void;
  read(): Promise<boolean>; edit(draft: NotesCanvasDraft, options?: { repair?: boolean }): void;
  setDocumentRevision(revision: string): void; save(): Promise<boolean>; reconcile(): Promise<boolean>;
  cancel(): void; dispose(): void;
};
const themes: readonly NotesCanvasTheme[] = ["minimal", "editorial", "modern", "premium", "playful", "technical"];
const templates: readonly NotesCanvasTemplate[] = ["landing-page", "report", "presentation"];
const modes: readonly NotesWorkspaceMode[] = ["document", "canvas", "present", "site"];
const sameScope = (a: NotesLayoutScope, b: NotesLayoutScope) => a.actorId === b.actorId && a.workspaceId === b.workspaceId;
function detached<T>(value: T): T { return copyLegacyNotesJson(value) as unknown as T; }
function frozen<T>(value: T): T { if (value && typeof value === "object") { Object.freeze(value); for (const item of Object.values(value)) frozen(item); } return value; }
function sameJson(left: JsonValue, right: JsonValue): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => sameJson(item, right[index]!));
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameJson(left[key]!, right[key]!));
}
function checkedDraft(value: NotesCanvasDraft): NotesCanvasDraft {
  const draft = detached(value);
  if (!draft || !themes.includes(draft.theme) || draft.layout === null || draft.layout === undefined || draft.view === undefined || Object.keys(draft).some(key => !["layout", "view", "theme"].includes(key))) throw new Error("Invalid Canvas draft");
  return frozen(draft);
}
export function createNotesCanvasController(options: {
  scope: NotesLayoutScope; target: NotesTarget; documentRevision: string;
  host?: NotesCanvasHost; snapshot?: NotesCanvasSnapshot; recovery?: NotesCanvasRecovery;
  validate(layout: JsonValue): readonly string[];
  operationId?: () => string; timeoutMs?: number;
}): NotesCanvasController {
  const scope = frozen(detached(options.scope)), target = frozen(detached(options.target));
  notesLayoutStorageKey(scope);
  if (!target || (target.kind !== "page" && target.kind !== "row") || (target.kind === "page" ? typeof target.pageId !== "string" || !target.pageId : typeof target.databaseId !== "string" || !target.databaseId || typeof target.rowId !== "string" || !target.rowId) || !options.documentRevision) throw new Error("Canvas scope required");
  let documentRevision = options.documentRevision, disposed = false, flight: AbortController | undefined, repair = false, generation = 0;
  const listeners = new Set<() => void>();
  let state: NotesCanvasState = frozen({ status: "empty", dirty: false, message: "" });
  function update(next: NotesCanvasState): void { if (disposed) return; state = frozen(next); for (const listener of listeners) { try { listener(); } catch { /* Observers cannot change persistence outcomes. */ } } }
  function checkSnapshot(value: NotesCanvasSnapshot): NotesCanvasSnapshot {
    const snapshot = detached(value);
    if (!snapshot || !sameScope(snapshot.scope, scope) || notesTargetKey(snapshot.target) !== notesTargetKey(target) || typeof snapshot.revision !== "string" || !snapshot.revision || typeof snapshot.documentRevision !== "string" || !snapshot.documentRevision || !themes.includes(snapshot.theme) || !Array.isArray(snapshot.capabilities) || snapshot.capabilities.some(item => !["canvas.save", "canvas.repair"].includes(item)) || snapshot.layout === undefined || snapshot.view === undefined) throw new Error("Canvas snapshot identity mismatch");
    return frozen(snapshot);
  }
  function invalid(snapshot: NotesCanvasSnapshot): boolean { try { return snapshot.layout !== null && options.validate(snapshot.layout).length > 0; } catch { return true; } }
  function accept(result: NotesCanvasResult, request: NotesCanvasRequest): boolean {
    const receipt = detached(result);
    if (!receipt || receipt.operationId !== request.operationId || !sameScope(receipt.scope, scope) || notesTargetKey(receipt.target) !== notesTargetKey(target)) throw new Error("Canvas receipt identity mismatch");
    if (receipt.status === "committed") {
      const snapshot = checkSnapshot(receipt.snapshot);
      if (snapshot.documentRevision !== request.expectedDocumentRevision || snapshot.revision === request.expectedRevision || snapshot.layout === null || invalid(snapshot)) throw new Error("Invalid canonical Canvas receipt");
      if (!sameJson(snapshot.layout, request.draft.layout) || !sameJson(snapshot.view, request.draft.view) || snapshot.theme !== request.draft.theme) throw new Error("Canvas receipt did not persist the exact reviewed layout/view/theme");
      const unchanged = JSON.stringify(state.draft) === JSON.stringify(request.draft);
      update({ status: "ready", snapshot, draft: unchanged ? checkedDraft({ layout: snapshot.layout, view: snapshot.view, theme: snapshot.theme }) : state.draft, dirty: !unchanged, message: "Canvas saved" });
      repair = false; return !state.dirty;
    }
    if (receipt.status === "unknown" || receipt.status === "pending") { update({ ...state, status: "unknown", message: "Canvas save outcome unknown; query before retrying" }); return false; }
    if (receipt.status === "not-found" && receipt.terminal !== true) throw new Error("Non-terminal Canvas lookup");
    if (!["not-found", "conflict", "denied", "rejected"].includes(receipt.status)) throw new Error("Invalid Canvas receipt status");
    update({ ...state, status: receipt.status === "not-found" ? "ready" : receipt.status === "rejected" ? "error" : receipt.status, recovery: undefined, message: receipt.status === "not-found" ? "Save did not commit; draft retained" : "Canvas change not committed; draft retained" });
    return false;
  }
  async function bounded<T>(work: Promise<T>, abort: AbortController): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    try { return await Promise.race([work, new Promise<T>((_resolve, reject) => {
      onAbort = () => reject(new Error("Canvas cancelled or unconfirmed"));
      abort.signal.addEventListener("abort", onAbort, { once: true });
      if (abort.signal.aborted) onAbort();
      timer = setTimeout(() => { abort.abort(); reject(new Error("Canvas timeout")); }, options.timeoutMs ?? 15_000);
    })]); }
    finally { if (timer) clearTimeout(timer); if (onAbort) abort.signal.removeEventListener("abort", onAbort); }
  }
  if (options.snapshot) {
    const snapshot = checkSnapshot(options.snapshot);
    state = frozen({ status: invalid(snapshot) ? "invalid" : "ready", snapshot, ...(snapshot.layout !== null && !invalid(snapshot) ? { draft: checkedDraft({ layout: snapshot.layout, view: snapshot.view, theme: snapshot.theme }) } : {}), dirty: false, message: invalid(snapshot) ? "Invalid layout retained; explicit repair required" : "" });
  }
  if (options.recovery) {
    const recovery = detached(options.recovery), request = recovery.request;
    if (recovery.version !== 1 || !sameScope(request.scope, scope) || notesTargetKey(request.target) !== notesTargetKey(target) || typeof request.operationId !== "string" || !request.operationId || typeof request.expectedRevision !== "string" || !request.expectedRevision || typeof request.expectedDocumentRevision !== "string" || !request.expectedDocumentRevision || typeof request.repair !== "boolean") throw new Error("Canvas recovery scope mismatch");
    state = frozen({ ...state, status: "unknown", draft: checkedDraft(request.draft), recovery, dirty: true, message: "Recovered uncertain Canvas operation; query before retrying" }); repair = request.repair;
  }
  const controller: NotesCanvasController = {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async read() {
      if (disposed || flight || state.dirty || state.recovery) return false;
      if (!options.host) return true;
      const abort = new AbortController(); flight = abort; update({ ...state, status: "loading", message: "" });
      try {
        const snapshot = checkSnapshot(await bounded(options.host.read(scope, target, abort.signal), abort));
        if (disposed || abort.signal.aborted) { update({ ...state, status: state.snapshot ? (invalid(state.snapshot) ? "invalid" : "ready") : "empty", message: "Canvas read cancelled; content retained" }); return false; }
        const bad = invalid(snapshot);
        update({ status: bad ? "invalid" : "ready", snapshot, ...(snapshot.layout !== null && !bad ? { draft: checkedDraft({ layout: snapshot.layout, view: snapshot.view, theme: snapshot.theme }) } : {}), dirty: false, message: bad ? "Invalid saved layout retained; explicit repair required" : "" });
        return true;
      } catch { update({ ...state, status: "error", message: "Canvas read failed; existing content retained" }); return false; }
      finally { if (flight === abort) flight = undefined; }
    },
    edit(value, opts) {
      if (disposed || state.recovery || ["loading", "conflict", "denied", "error"].includes(state.status)) throw new Error("Canvas editor unavailable");
      const draft = checkedDraft(value);
      if (options.validate(draft.layout).length) throw new Error("Canvas layout invalid");
      if (state.status === "invalid" && (!opts?.repair || !state.snapshot?.capabilities.includes("canvas.repair"))) throw new Error("Explicit authorized repair required");
      if (options.host && !state.snapshot?.capabilities.includes("canvas.save")) throw new Error("Canvas mutation capability unavailable");
      repair = repair || Boolean(opts?.repair); generation++;
      update({ ...state, status: options.host ? "ready" : "local", draft, dirty: true, message: options.host ? "Unsaved Canvas draft" : "Local Canvas draft; not persisted" });
    },
    setDocumentRevision(revision) { if (!revision) throw new Error("Document revision required"); documentRevision = revision; generation++; },
    async save() {
      if (disposed || flight || state.recovery || ["loading", "invalid", "conflict", "denied", "error"].includes(state.status)) return false;
      if (!state.dirty) return true;
      if (!options.host || !state.snapshot || !state.draft) { update({ ...state, status: "local", message: "Local Canvas draft; not persisted" }); return false; }
      if (state.snapshot.documentRevision !== documentRevision) { update({ ...state, status: "conflict", message: "Document revision changed; Canvas draft retained" }); return false; }
      const request: NotesCanvasRequest = frozen({ operationId: options.operationId?.() ?? globalThis.crypto.randomUUID(), scope, target, expectedRevision: state.snapshot.revision, expectedDocumentRevision: documentRevision, draft: state.draft, repair });
      if (!request.operationId || request.operationId.length > 512) throw new Error("Canvas operation ID required");
      const recovery: NotesCanvasRecovery = frozen({ version: 1, request });
      const abort = new AbortController(), epoch = generation; flight = abort;
      let submitted = false;
      update({ ...state, status: "saving", message: "Saving Canvas" });
      try {
        await bounded(options.host.beforeSubmit(recovery, abort.signal), abort);
        if (disposed || abort.signal.aborted || generation !== epoch) { update({ ...state, status: "ready", message: "Canvas submission cancelled; draft retained" }); return false; }
        update({ ...state, recovery }); submitted = true;
        return accept(await bounded(options.host.commit(request, abort.signal), abort), request);
      } catch { update({ ...state, status: submitted ? "unknown" : "ready", ...(submitted ? { recovery } : {}), message: submitted ? "Canvas save outcome unknown; query before retrying" : abort.signal.aborted ? "Canvas submission cancelled; draft retained" : "Canvas journal failed; no submission" }); return false; }
      finally { if (flight === abort) flight = undefined; }
    },
    async reconcile() {
      if (disposed || flight || !state.recovery || !options.host) return false;
      const request = state.recovery.request, abort = new AbortController(); flight = abort;
      try { return accept(await bounded(options.host.lookup(scope, target, request.operationId, abort.signal), abort), request); }
      catch { update({ ...state, status: "unknown", message: "Canvas receipt lookup failed; draft retained" }); return false; }
      finally { if (flight === abort) flight = undefined; }
    },
    cancel() { flight?.abort(); },
    dispose() { disposed = true; flight?.abort(); listeners.clear(); }
  };
  return controller;
}

export type NotesWorkspaceRenderers = {
  createLayout(document: EditorDocument, options: { template: NotesCanvasTemplate; theme: NotesCanvasTheme }): NotesCanvasDraft;
  validateLayout(layout: JsonValue, document: EditorDocument): readonly string[];
  canvas(context: { document: EditorDocument; draft: NotesCanvasDraft; readOnly: boolean; onChange(draft: NotesCanvasDraft): void }): ReactNode;
  /** Static trusted exporter output only. Embedded user HTML never gets script permission. */
  site?(document: EditorDocument, draft: NotesCanvasDraft, title: string): string;
  presentation?(document: EditorDocument, draft: NotesCanvasDraft, title: string): readonly string[];
};
export type NotesWorkspaceModesProps = {
  scope: NotesLayoutScope; target: NotesTarget; document: EditorDocument; documentRevision: string; title: string;
  composing?: boolean;
  pendingEditors?: boolean; manualSaveRequired?: boolean;
  /** Flush sole document writer plus nested rows/widgets. Return current document revision or false. */
  beforeModeChange(): Promise<string | false>;
  renderers?: NotesWorkspaceRenderers; canvasHost?: NotesCanvasHost;
  canvasSnapshot?: NotesCanvasSnapshot; canvasRecovery?: NotesCanvasRecovery;
  language?: "en" | "ja"; children: ReactNode;
  onModeChange?(mode: NotesWorkspaceMode): void;
};

export function NotesWorkspaceModes(props: NotesWorkspaceModesProps) {
  const { scope, target, document, title, language = "en", renderers } = props, ja = language === "ja";
  const [mode, setMode] = useState<NotesWorkspaceMode>("document"), [template, setTemplate] = useState<NotesCanvasTemplate>("landing-page"), [theme, setTheme] = useState<NotesCanvasTheme>("modern");
  const [width, setWidth] = useState<390 | 768 | 1440>(1440), [slide, setSlide] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(""), [creating, setCreating] = useState(false);
  const latest = useRef(props), epoch = useRef(0), flight = useRef(false), mounted = useRef(true), region = useRef<HTMLDivElement>(null), id = useId();
  if (latest.current.composing !== props.composing || latest.current.pendingEditors !== props.pendingEditors || latest.current.manualSaveRequired !== props.manualSaveRequired) epoch.current++;
  latest.current = props;
  const key = JSON.stringify([scope.actorId, scope.workspaceId, notesTargetKey(target)]);
  const setup = useMemo(() => {
    const options = { scope, target, documentRevision: props.documentRevision, validate: (layout: JsonValue) => latest.current.renderers?.validateLayout(layout, latest.current.document) ?? ["Canvas renderer unavailable"] };
    try { return { controller: createNotesCanvasController({ ...options, host: props.canvasHost, snapshot: props.canvasSnapshot, recovery: props.canvasRecovery }), failed: false }; }
    catch { return { controller: createNotesCanvasController(options), failed: true }; }
  }, [key, props.canvasHost]);
  const controller = setup.controller;
  const activeController = useRef(controller); activeController.current = controller;
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  useEffect(() => { mounted.current = true; epoch.current++; setMode("document"); setCreating(false); setError(""); void controller.read(); return () => { mounted.current = false; queueMicrotask(() => { if (!mounted.current || activeController.current !== controller) controller.dispose(); }); }; }, [controller]);
  useEffect(() => controller.setDocumentRevision(props.documentRevision), [controller, props.documentRevision]);
  async function run(next: NotesWorkspaceMode, create = false) {
    if (flight.current || props.composing || props.pendingEditors || props.manualSaveRequired) { setError(ja ? "入力の確定と明示保存を待ってください。" : "Finish composing and explicitly save pending editors before switching modes."); return; }
    flight.current = true; setBusy(true); setError(""); const captured = epoch.current, selectedController = controller;
    try {
      const revision = await props.beforeModeChange();
      if (!revision || epoch.current !== captured || !mounted.current || latest.current.composing || latest.current.pendingEditors || latest.current.manualSaveRequired) { if (mounted.current) setError(ja ? "編集を保持しています。切り替えは完了していません。" : "Edits retained; mode change did not complete."); return; }
      selectedController.setDocumentRevision(revision);
      if (next !== "document" && !renderers) throw new Error("Canvas renderers unavailable");
      if (create && renderers) {
        selectedController.edit(renderers.createLayout(latest.current.document, { template, theme }), { repair: state.status === "invalid" });
        setCreating(false);
      } else if (selectedController.getState().dirty && mode === "canvas" && props.canvasHost && !(await selectedController.save())) { setError(ja ? "Canvasの保存が確定していません。" : "Canvas save is not confirmed."); return; }
      if (!mounted.current || epoch.current !== captured || latest.current.composing || latest.current.pendingEditors || latest.current.manualSaveRequired) return;
      setMode(next); props.onModeChange?.(next);
    } catch { if (mounted.current) setError(ja ? "モードを切り替えられません。元の内容は保持されています。" : "Mode change failed; original content is retained."); }
    finally { flight.current = false; if (mounted.current) setBusy(false); }
  }
  let canvas: ReactNode = null, html = "", slides: readonly string[] = [], renderError = false;
  try {
    if (state.draft && renderers && mode === "canvas") canvas = renderers.canvas({ document, draft: state.draft, readOnly: Boolean(busy || state.recovery || !["ready", "local"].includes(state.status)), onChange: draft => { try { controller.edit(draft); } catch { setError(ja ? "変更を適用できません。元の内容は保持されています。" : "Change unavailable; original content retained."); } } });
    if (state.draft && renderers && mode === "site") html = renderers.site?.(document, state.draft, title) ?? "";
    if (state.draft && renderers && mode === "present") slides = renderers.presentation?.(document, state.draft, title) ?? [];
  } catch { renderError = true; }
  return <section className="oe-notes-modes" aria-busy={busy}>
    <div role="tablist" aria-label={ja ? "文書の表示モード" : "Document mode"}>
      {modes.map(item => <button type="button" role="tab" key={item} aria-selected={mode === item} aria-controls={`${id}-${item}`} disabled={busy || Boolean(props.composing || props.pendingEditors || props.manualSaveRequired) || (item !== "document" && (!renderers || setup.failed))} onClick={() => void run(item)} onKeyDown={event => {
        if (event.nativeEvent.isComposing || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault();
        const buttons = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")), index = buttons.indexOf(event.currentTarget);
        buttons[event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }}>{item === "document" ? "Document" : item === "canvas" ? "Canvas" : item === "present" ? "Present" : "Site"}</button>)}
    </div>
    <p role="status">{state.status === "local" ? (ja ? "ローカル下書き・未保存" : "Local draft, not persisted") : state.message}</p>
    {setup.failed ? <p role="alert">{ja ? "Canvasの保存データまたは復旧スコープを確認できません。原本は保持しています。" : "Canvas saved data or recovery scope is invalid. Original data is retained."}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {renderError ? <p role="alert">{ja ? "表示処理に失敗しました。元の内容は保持されています。" : "Renderer failed; original content retained."}</p> : null}
    {state.status === "invalid" ? <p role="alert">{ja ? "保存されたレイアウトは無効です。明示的な修復まで保持します。" : "Invalid saved layout is retained until explicit repair."}</p> : null}
    {state.recovery ? <button type="button" disabled={busy} onClick={() => void controller.reconcile()}>{ja ? "保存結果を照会" : "Query save receipt"}</button> : null}
    {state.status === "saving" || state.status === "loading" ? <button type="button" onClick={() => controller.cancel()}>{ja ? "Canvas操作をキャンセル" : "Cancel Canvas action"}</button> : null}
    {state.dirty && !state.recovery ? <button type="button" disabled={busy || Boolean(props.composing || props.pendingEditors || props.manualSaveRequired) || !props.canvasHost} onClick={() => void run(mode)}>{ja ? "Canvasを保存" : "Save Canvas"}</button> : null}
    {renderers ? <button type="button" disabled={setup.failed || busy || Boolean(props.composing || props.pendingEditors || props.manualSaveRequired) || Boolean(state.recovery) || (state.dirty && state.status !== "invalid")} onClick={() => setCreating(true)}>{state.status === "invalid" ? (ja ? "レイアウトを修復" : "Repair layout") : (ja ? "レイアウトを作成" : "Create layout")}</button> : null}
    {creating ? <form onSubmit={event => { event.preventDefault(); void run("canvas", true); }}>
      <label>{ja ? "テンプレート" : "Template"}<select value={template} onChange={event => setTemplate(event.target.value as NotesCanvasTemplate)}>{templates.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>{ja ? "テーマ" : "Theme"}<select value={theme} onChange={event => setTheme(event.target.value as NotesCanvasTheme)}>{themes.map(item => <option key={item}>{item}</option>)}</select></label>
      <button type="submit" disabled={busy}>{state.status === "invalid" ? (ja ? "原本を保持して修復" : "Repair and preserve original") : (ja ? "作成" : "Create")}</button>
      <button type="button" disabled={busy} onClick={() => setCreating(false)}>{ja ? "キャンセル" : "Cancel"}</button>
    </form> : null}
    <div role="tabpanel" id={`${id}-document`} hidden={mode !== "document"}>{props.children}</div>
    {mode === "canvas" ? <div role="tabpanel" id={`${id}-canvas`}><NotesModeRenderBoundary resetKey={controller} fallback={ja ? "Canvasの表示処理に失敗しました。原本と入力は保持しています。" : "Canvas renderer failed; original data and input are retained."}>{canvas ?? <p>{ja ? "Canvasレイアウトを作成してください。" : "Create a Canvas layout."}</p>}</NotesModeRenderBoundary></div> : null}
    {mode === "site" ? <div role="tabpanel" id={`${id}-site`}>
      <div role="group" aria-label={ja ? "プレビュー幅" : "Preview width"}>{([390, 768, 1440] as const).map(item => <button type="button" key={item} aria-pressed={width === item} onClick={() => setWidth(item)}>{item}px</button>)}</div>
      {html ? <iframe title={`${title} ${ja ? "サイトプレビュー" : "site preview"}`} sandbox="" srcDoc={html} style={{ width: `min(${width}px, 100%)`, minHeight: 400, border: 0 }} /> : <p>{ja ? "サイトプレビューを表示できません。" : "Site preview unavailable."}</p>}
    </div> : null}
    {mode === "present" ? <div role="tabpanel" id={`${id}-present`} ref={region} onKeyDown={event => { if (event.nativeEvent.isComposing || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return; if (event.key === "ArrowLeft") { event.preventDefault(); setSlide(index => Math.max(0, index - 1)); } if (event.key === "ArrowRight") { event.preventDefault(); setSlide(index => Math.min(Math.max(0, slides.length - 1), index + 1)); } }}>
      <button type="button" disabled={slide <= 0} onClick={() => setSlide(index => Math.max(0, index - 1))}>{ja ? "前へ" : "Previous"}</button>
      <span aria-live="polite">{slides.length ? Math.min(slide + 1, slides.length) : 0} / {slides.length}</span>
      <button type="button" disabled={slide >= slides.length - 1} onClick={() => setSlide(index => Math.min(slides.length - 1, index + 1))}>{ja ? "次へ" : "Next"}</button>
      <button type="button" onClick={() => { if (globalThis.document.fullscreenElement) void globalThis.document.exitFullscreen().catch(() => setError("Fullscreen unavailable")); else if (region.current?.requestFullscreen) void region.current.requestFullscreen().catch(() => setError("Fullscreen unavailable")); else setError(ja ? "全画面表示に対応していません。" : "Fullscreen unavailable."); }}>{ja ? "全画面表示" : "Fullscreen"}</button>
      {slides.length ? <iframe title={`${title} ${ja ? "プレゼンテーション" : "presentation"}`} srcDoc={slides[Math.min(slide, slides.length - 1)]} sandbox="" style={{ width: "100%", minHeight: 400, border: 0 }} /> : <p>{ja ? "プレゼンテーションを表示できません。" : "Presentation unavailable."}</p>}
    </div> : null}
  </section>;
}

class NotesModeRenderBoundary extends Component<{ children: ReactNode; resetKey: unknown; fallback: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  componentDidUpdate(previous: Readonly<{ children: ReactNode; resetKey: unknown; fallback: string }>): void { if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false }); }
  render(): ReactNode { return this.state.failed ? <div role="alert"><p>{this.props.fallback}</p><button type="button" onClick={() => this.setState({ failed: false })}>Retry renderer</button></div> : this.props.children; }
}
