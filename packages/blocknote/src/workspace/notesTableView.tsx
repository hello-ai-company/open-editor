import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactElement, type KeyboardEvent } from "react";
import type { JsonValue } from "@hello-ai-company/editor-core";
import { useEditorLocalDraft } from "../document/draftLifecycle.js";
import { isNotesTablePropertyEditable, notesTableBindingKey, type NotesTableBinding, type NotesTableController, type NotesTableEditingRegistry, type NotesTableInputDraft } from "../notes/tableEditing.js";
import type { NotesDatabasePropertyDefinition } from "../notes/propertyCatalog.js";
import { NotesFeedbackControl, useNotesFeedback } from "../react/NotesFeedback.js";
import { NotesIcon } from "../react/notesPresentation.js";

/** Mounts only in the actual databaseView body. Port absence leaves the old read path intact. */
export function NotesRevisionedTable(props: {
  registry: NotesTableEditingRegistry; binding: NotesTableBinding; blockId: string;
  fallback: ReactElement; editingBlocked?: boolean; onOpenRow?(rowKey: string): void;
}): ReactElement {
  const origin = notesTableBindingKey(props.binding), [review, setReview] = useState<{ origin: string; binding: NotesTableBinding }>();
  const binding = review?.origin === origin ? review.binding : props.binding;
  const key = notesTableBindingKey(binding), [connection, setConnection] = useState<{ key: string; controller?: NotesTableController; error?: string }>();
  useEffect(() => {
    let live = true;
    void props.registry.connect(binding).then(controller => { if (live) setConnection({ key, controller }); }).catch(() => { if (live) setConnection({ key, error: "Table editing is unavailable. Retained input has not been discarded." }); });
    return () => { live = false; };
  }, [props.registry, key]);
  if (connection?.key !== key) return <p role="status">Loading table…</p>;
  if (connection.error) return <><p role="alert">{connection.error}</p>{props.fallback}</>;
  const finishReview = async () => {
    if (!await props.registry.beforeLeave(binding.parentTarget, new AbortController().signal)) return false;
    const current = props.registry.captureLeaveGuard(binding.parentTarget);
    const primary = await props.registry.connect(props.binding);
    if (primary && !await primary.refresh() || !current()) return false;
    setReview(saved => saved?.origin === origin && notesTableBindingKey(saved.binding) === key ? undefined : saved);
    return true;
  };
  return connection.controller ? <>
    {key !== origin ? <p role="status">Reviewing input from the previous table view. Current view settings are unchanged.</p> : null}
    <TableInput key={key} {...props} binding={binding} controller={connection.controller} onReviewRetained={saved => setReview({ origin, binding: saved })} onFinishReview={key !== origin ? finishReview : undefined} />
  </> : props.fallback;
}

function display(value: JsonValue | undefined, def: NotesDatabasePropertyDefinition): string {
  if (value === null || value === undefined) return "—";
  if (def.type === "checkbox" && typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && ["select", "status"].includes(def.type)) return def.options?.find(o => o.id === value)?.label ?? value;
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
function exportInput(drafts: readonly NotesTableInputDraft[]) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, drafts }, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "notes-table-input.json"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function RawField({ def, value, disabled, onChange, onComposition, onKeyDown }: {
  def: NotesDatabasePropertyDefinition; value: string; disabled: boolean;
  onChange(value: string): void; onComposition(composing: boolean): void; onKeyDown(event: KeyboardEvent): void;
}) {
  const common = { "aria-label": `Edit ${def.name}`, disabled, value, onChange: (event: { target: { value: string } }) => onChange(event.target.value), onKeyDown };
  if (def.type === "checkbox") return <select {...common}><option value="">Unset</option><option value="true">Yes</option><option value="false">No</option></select>;
  if (["select", "status"].includes(def.type)) return <select {...common}><option value="">Unset</option>{def.options?.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select>;
  // Text controls preserve invalid and partial input, including dates and numbers, verbatim.
  return <input {...common} onInput={event => onChange(event.currentTarget.value)} type="text" inputMode={def.type === "number" ? "decimal" : def.type === "email" ? "email" : def.type === "url" ? "url" : def.type === "phone" ? "tel" : "text"} maxLength={4000} onCompositionStart={() => onComposition(true)} onCompositionEnd={event => { onChange(event.currentTarget.value); onComposition(false); }} />;
}
function TableInput(props: Parameters<typeof NotesRevisionedTable>[0] & { controller: NotesTableController; onReviewRetained(binding: NotesTableBinding): void; onFinishReview?(): Promise<boolean> }) {
  const { controller } = props, state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const composer = useId(), marker = useEditorLocalDraft(props.blockId, "notes-table-input:" + composer), markerRef = useRef(marker);
  markerRef.current = marker;
  const feedback = useNotesFeedback(), [error, setError] = useState(""), [hidden, setHidden] = useState(false), [confirmDiscard, setConfirmDiscard] = useState(false);
  const surface = useRef<HTMLDivElement>(null), focusInput = useRef(false);
  const mounted = useRef(true), busy = state.pending || state.unknown || state.journalError || state.composing || Boolean(props.editingBlocked) || !marker.available;
  // IME and storage failure block submit/leave, never the current raw input.
  const inputBlocked = state.pending || state.unknown || Boolean(props.editingBlocked) || !marker.available || state.composing && !state.composingOwners.includes(composer);
  const draft = state.drafts[0], defs = state.snapshot?.schema.properties ?? [], stale = Boolean(draft && state.snapshot && (draft.expectedRevision !== state.snapshot.revision || draft.expectedSchemaRevision !== state.snapshot.schema.revision));
  const writable = state.status === "ready" && !props.binding.query.trashed;
  useEffect(() => { if (draft && !hidden && focusInput.current) { const input = surface.current?.querySelector<HTMLInputElement | HTMLSelectElement>(".oe-notes-table-cell-input input, .oe-notes-table-cell-input select, [data-table-new-row] input, [data-table-new-row] select"); if (input) { focusInput.current = false; input.focus(); } } }, [draft?.rowKey, draft?.propertyId, hidden]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { const s = controller.getState(); if (s.drafts.length || s.otherDrafts.length || s.pending || s.unknown || s.composing || s.journalError) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [controller]);
  useEffect(() => {
    mounted.current = true;
    const syncMarker = () => {
      const s = controller.getState(), next = s.drafts.length || s.pending || s.unknown || s.journalError || s.composing ? { databaseId: props.binding.databaseId, retained: true } : undefined;
      try { if (JSON.stringify(markerRef.current.value) !== JSON.stringify(next)) markerRef.current.set(next); } catch { /* Registry retains raw input and independently blocks leave. */ }
    };
    syncMarker(); const unsubscribe = controller.subscribe(syncMarker);
    return () => { mounted.current = false; unsubscribe(); controller.setComposing(composer, false); try { markerRef.current.set(undefined); } catch { /* Source cache belongs to its old owner. */ } };
  }, [controller, composer]);
  const run = async (operation: () => Promise<unknown>, success?: string) => {
    try { marker.assertCurrent(); const result = await operation(); if (!mounted.current) return; if (result === false) setError(controller.getState().message || "Original input is retained; review required."); else { setError(""); if (success) feedback?.announce(success, "success"); } }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Original input is retained."); }
  };
  const setRaw = (raw: string) => { if (!mounted.current) return; try { marker.assertCurrent(); controller.setRaw(raw, composer); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Input retained"); } };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.nativeEvent.isComposing || controller.getState().composing || event.keyCode === 229) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setHidden(true); }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.stopPropagation(); void run(() => controller.submit(), "Saved table change"); }
  };
  const fields = (() => { if (draft?.mode !== "create") return {}; try { const raw: unknown = JSON.parse(draft.rawInput); return raw && typeof raw === "object" && !Array.isArray(raw) && Object.values(raw).every(v => typeof v === "string") ? raw as Record<string, string> : undefined; } catch { return undefined; } })();
  const actions = <span className="oe-notes-table-input-actions"><button type="button" disabled={busy || stale || Boolean(draft?.submitted)} onClick={() => void run(() => controller.submit(), "Saved table change")}><NotesIcon name="save" />Save</button><button type="button" disabled={state.composing} onClick={() => setHidden(true)} title="Close controls and retain input">Close</button></span>;
  const retained = Boolean(draft || state.otherDrafts.length || state.unknown || state.journalError);
  return <div ref={surface} className="oe-notes-table-editor" data-database-id={props.binding.databaseId} data-notes-table-editing="1" contentEditable={false}>
    <div className="oe-notes-table-toolbar">
      <button type="button" disabled={!writable || busy || Boolean(draft) || !state.snapshot?.capabilities.includes("row.create")} onClick={() => { focusInput.current = true; setHidden(false); void run(() => controller.beginCreate()); }}><NotesIcon name="plus" />New row</button>
      <button type="button" disabled={state.pending || state.composing} onClick={() => void run(() => controller.refresh())}><NotesIcon name="refresh" />Refresh table</button>
      {props.onFinishReview ? <button type="button" disabled={busy || Boolean(draft)} onClick={() => void run(props.onFinishReview!)}>Return to current view</button> : null}
    </div>
    {retained ? <NotesFeedbackControl id={"table-input:" + composer}><span role="status">{state.unknown ? "Save result unknown" : stale ? "Database changed; original input retained" : "Table input retained"}</span>{draft && hidden ? <button type="button" onClick={() => { focusInput.current = true; setHidden(false); }}>Resume input</button> : null}<button type="button" onClick={() => exportInput([...state.drafts, ...state.otherDrafts])}>Export input</button>{draft?.submitted || state.unknown ? <button type="button" disabled={state.pending || state.composing} onClick={() => void run(() => controller.reconcile(), "Save result verified")}>Check save result</button> : null}{state.journalError ? <button type="button" disabled={state.pending || state.composing} onClick={() => void run(() => controller.retryInputStorage())}>Retry input storage</button> : null}{draft ? <button type="button" disabled={state.pending || state.unknown || state.composing} onClick={() => setConfirmDiscard(true)}>Discard input…</button> : null}</NotesFeedbackControl> : null}
    {error ? <NotesFeedbackControl id={"table-error:" + composer}><span role="alert">{error}</span><button type="button" aria-label="Close table notice" onClick={() => setError("")}>×</button></NotesFeedbackControl> : null}
    {confirmDiscard ? <div role="group" aria-label="Discard retained table input?" className="oe-notes-table-confirm"><span>Discard this retained input?</span><button type="button" disabled={state.pending || state.unknown || state.composing} onClick={() => void run(async () => { const ok = await controller.discardInput(); if (ok && mounted.current) { setConfirmDiscard(false); setHidden(false); } return ok; })}>Discard input</button><button type="button" onClick={() => setConfirmDiscard(false)}>Cancel</button></div> : null}
    {state.otherDrafts.length ? <details><summary>Input retained in another view or query</summary>{state.otherDrafts.map((d, i) => <div key={i}><pre>{d.binding.viewId}: {d.rawInput}</pre><button type="button" disabled={busy || Boolean(draft)} onClick={() => props.onReviewRetained(d.binding)}>Review retained input</button></div>)}</details> : null}
    {draft && !hidden && (stale || state.drafts.length > 1 || draft.mode === "create" && (fields === undefined || Object.keys(fields).some(id => !defs.some(def => def.id === id && isNotesTablePropertyEditable(def)))) || draft.mode === "cell" && (!defs.some(d => d.id === draft.propertyId && isNotesTablePropertyEditable(d)) || !state.rows.some(r => r.id === draft.rowKey))) ? <details open><summary>Original input retained for review</summary><pre>{draft.rawInput}</pre></details> : null}
    <div className="oe-database-view__table-wrap"><table className="oe-database-view__table"><thead><tr>{defs.map(def => <th key={def.id} scope="col">{def.name}</th>)}<th scope="col">Actions</th></tr></thead><tbody>
      {draft?.mode === "create" && !hidden && fields ? <tr data-table-new-row="1">{defs.map(def => <td key={def.id}>{isNotesTablePropertyEditable(def) ? <RawField def={def} value={fields[def.id] ?? ""} disabled={inputBlocked || stale || Boolean(draft.submitted)} onChange={value => setRaw(JSON.stringify({ ...fields, [def.id]: value }))} onComposition={value => { if (mounted.current) controller.setComposing(composer, value); }} onKeyDown={onKeyDown} /> : <span title="Read-only property">—</span>}</td>)}<td>{actions}</td></tr> : null}
      {state.rows.map(row => <tr key={row.id} data-row-key={row.id}>{defs.map(def => <td key={def.id}>{draft?.mode === "cell" && draft.rowKey === row.id && draft.propertyId === def.id && !hidden ? <div className="oe-notes-table-cell-input"><RawField def={def} value={draft.rawInput} disabled={inputBlocked || stale || Boolean(draft.submitted) || !isNotesTablePropertyEditable(def)} onChange={setRaw} onComposition={value => { if (mounted.current) controller.setComposing(composer, value); }} onKeyDown={onKeyDown} />{actions}</div> : <button type="button" className="oe-notes-table-cell" disabled={!writable || busy || Boolean(draft) || row.deleted || !isNotesTablePropertyEditable(def) || !state.snapshot?.capabilities.includes("row.patch")} aria-label={`Edit ${def.name} in ${row.title || row.id}`} onClick={() => { focusInput.current = true; setHidden(false); void run(() => controller.beginCell(row.id, def.id)); }}>{display(row.values[def.id], def)}</button>}</td>)}<td>{props.onOpenRow ? <button type="button" onClick={() => props.onOpenRow?.(row.id)}>Open row</button> : null}</td></tr>)}
      {!state.rows.length && !draft ? <tr><td colSpan={defs.length + 1}>{state.status === "loading" ? "Loading rows…" : "No rows"}</td></tr> : null}
    </tbody></table></div>
    {state.nextCursor ? <button type="button" disabled={busy || Boolean(draft)} onClick={() => void run(() => controller.loadMore())}>Load more rows</button> : null}
  </div>;
}
