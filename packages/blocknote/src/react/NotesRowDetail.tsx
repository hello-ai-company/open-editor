import { useEffect, useRef, useState, type ReactNode } from "react";
import type { JsonValue } from "@hello-ai-company/editor-core";
import type { NotesTarget, NotesWorkspaceController } from "../notes/contracts.js";
import { validateNotesPropertyValue, type NotesWritableProperty } from "../workspace/revisionedNotesResource.js";
import { NotesDocumentSidebar, type NotesDocumentSidebarProps } from "./NotesDocumentSidebar.js";
import { NotesInspector } from "./NotesInspector.js";
import { NotesPanelStatus, notesIsComposing, notesPanelIdentity, notesTargetKey, useNotesController, useNotesComposition, useLocalNotesDraft, useNotesPanelCommands, type NotesEditorBridge } from "./notesWorkspacePanels.js";

export type NotesRowProperty = { id: string; label: string; value: JsonValue; definition?: NotesWritableProperty; readOnly?: boolean; renderEditor?: ReactNode };
export type NotesRowDetailProps = {
  target: Extract<NotesTarget, { kind: "row" }>;
  /** Must be a distinct controller from the parent page; snapshot target is checked again. */
  controller: NotesWorkspaceController;
  parentController?: NotesWorkspaceController;
  bridge: NotesEditorBridge;
  properties: readonly NotesRowProperty[];
  editor: ReactNode;
  panels?: NotesDocumentSidebarProps["panels"];
  panelState?: NotesDocumentSidebarProps["panelState"];
  panelError?: string;
  onRefreshPanels?(): void;
  onBack(): void;
  onPrevious?(): void;
  onNext?(): void;
  presentation?: "drawer" | "page";
  onPresentationChange?(presentation: "drawer" | "page"): void;
};
export function NotesRowDetail(props: NotesRowDetailProps) {
  const state = useNotesController(props.controller);
  if (props.controller === props.parentController || !state.snapshot || notesTargetKey(state.snapshot.target) !== notesTargetKey(props.target)) return <section className="oe-notes-row-detail" role="status">行のデータと編集先を確認しています</section>;
  return <RowDetail key={notesPanelIdentity(props.controller, state.snapshot)} {...props} />;
}
function RowDetail(props: NotesRowDetailProps) {
  const state = useNotesController(props.controller), [showDocumentTools, setShowDocumentTools] = useState(false), [showInspector, setShowInspector] = useState(false), [message, setMessage] = useState("");
  const busy = state.status === "saving" || state.status === "unknown", mounted = useRef(true), flight = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const leave = () => { if (!busy && !state.dirty && !state.composing && !state.pendingEditors) props.onBack(); else setMessage("行の変更と保存結果を確認してから戻ってください"); };
  return <section className="oe-notes-row-detail" aria-label="データベース行の詳細" data-presentation={props.presentation ?? "drawer"} onKeyDown={event => {
    if (notesIsComposing(event)) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); if (!flight.current && !busy) { flight.current = true; void props.controller.save({ explicit: true }).catch(() => { if (mounted.current) setMessage("行を保存できませんでした"); }).finally(() => { flight.current = false; }); } }
    if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); leave(); }
  }}>
    <header className="oe-notes-row-header"><button type="button" disabled={state.pendingEditors} onClick={leave}>戻る</button><strong>{state.draftTitle ?? state.snapshot?.title}</strong><button type="button" disabled={busy || state.dirty || state.composing || state.pendingEditors || !props.onPrevious} onClick={props.onPrevious}>前の行</button><button type="button" disabled={busy || state.dirty || state.composing || state.pendingEditors || !props.onNext} onClick={props.onNext}>次の行</button>{props.onPresentationChange ? <button type="button" disabled={busy || state.pendingEditors || state.composing} onClick={() => props.onPresentationChange?.(props.presentation === "page" ? "drawer" : "page")}>{props.presentation === "page" ? "パネルで表示" : "ページで表示"}</button> : null}</header>
    <div className="oe-notes-row-properties" aria-label="行のプロパティ">{props.properties.map(property => <RowProperty key={property.id} controller={props.controller} property={property} />)}</div>
    <div className="oe-notes-row-actions"><button type="button" aria-expanded={showDocumentTools} onClick={() => setShowDocumentTools(value => !value)}>文書のツール</button><button type="button" aria-expanded={showInspector} onClick={() => setShowInspector(value => !value)}>編集のツール</button><button type="button" disabled={!state.dirty || busy || state.composing || !state.snapshot?.capabilities.includes("document.save")} onClick={() => { if (flight.current) return; flight.current = true; void props.controller.save({ explicit: true }).catch(() => { if (mounted.current) setMessage("行を保存できませんでした"); }).finally(() => { flight.current = false; }); }}>行を保存</button></div>
    <div className="oe-notes-row-workspace">{showDocumentTools ? <NotesDocumentSidebar controller={props.controller} bridge={props.bridge} panels={props.panels} panelState={props.panelState} panelError={props.panelError} onRefreshPanels={props.onRefreshPanels} /> : null}<div className="oe-notes-row-editor">{props.editor}</div>{showInspector ? <NotesInspector controller={props.controller} bridge={props.bridge} /> : null}</div>
    <NotesPanelStatus controller={props.controller} message={message} />
  </section>;
}
type RowPropertyDraft = { kind: "property"; propertyId: string; baseRevision: string; source: string; schemaFingerprint: string };
function RowProperty({ controller, property }: { controller: NotesWorkspaceController; property: NotesRowProperty }) {
  const ops = useNotesPanelCommands(controller), local = useLocalNotesDraft<RowPropertyDraft>(controller, `oe.row-property:${property.id}`), [error, setError] = useState("");
  const values = ops.state.snapshot?.metadata.properties;
  const value = values && typeof values === "object" && !Array.isArray(values) && Object.hasOwn(values, property.id) ? values[property.id]! : property.value;
  const editing = !!local.value, draft = local.value?.source ?? JSON.stringify(value), schemaFingerprint = JSON.stringify(property.definition ?? null);
  const composition = useNotesComposition(controller, editing);
  const editable = !property.readOnly && !!property.definition && ops.available("property.patch", local.id), stale = !!local.value && (local.value.baseRevision !== ops.state.snapshot?.revision || local.value.schemaFingerprint !== schemaFingerprint);
  const cancel = () => { if (!ops.busy && ops.state.status !== "saving" && ops.state.status !== "unknown") { local.set(undefined); setError(""); } };
  return <div className="oe-notes-row-property"><strong>{property.label}</strong>{property.renderEditor ?? (editing ? <form onSubmit={event => { event.preventDefault(); if (!editable || stale) return; try { const value = validateNotesPropertyValue(property.definition!, JSON.parse(draft)); void ops.execute({ kind: "property.patch", propertyId: property.id, value }, { localDraftId: local.id }); } catch { setError("このプロパティの値を確認してください"); } }} onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event) && !ops.busy) { event.stopPropagation(); cancel(); } }}><label>{property.label}<textarea aria-label={`${property.label}のJSON値`} value={draft} disabled={ops.busy || ops.state.status !== "ready"} onChange={event => { if (local.value) local.set({ ...local.value, source: event.target.value }); }} {...composition} /></label>{stale ? <p role="status">別の値またはスキーマの変更を検出しました。入力を保持しています</p> : null}<button type="submit" disabled={!editable || stale}>値を確認して保存</button><button type="button" disabled={ops.busy || ops.state.status === "saving" || ops.state.status === "unknown"} onClick={cancel}>キャンセル</button></form> : <><span>{typeof value === "string" ? value : JSON.stringify(value)}</span><button type="button" disabled={!editable} onClick={() => { local.set({ kind: "property", propertyId: property.id, baseRevision: ops.state.snapshot!.revision, source: JSON.stringify(value), schemaFingerprint }); setError(""); }}>プロパティを編集</button></>)}{error ? <p role="alert">{error}</p> : null}<NotesPanelStatus controller={controller} message={ops.message} /></div>;
}
