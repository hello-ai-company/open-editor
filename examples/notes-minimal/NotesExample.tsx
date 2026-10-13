import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createNotesIndexedDBLayoutStorage, createNotesLayout, openNotesTab, notesTargetKey, type NotesRecovery, type NotesTarget, type NotesWorkspaceHost } from "@hello-ai-company/editor-blocknote/notes";
import { createNotesCanvasController, NotesTabbedWorkspace, NotesWorkspaceModes, type NotesCanvasController, type NotesCanvasHost, type NotesCanvasRecovery, type NotesWorkspacePreset, type NotesWorkspaceRenderers, type NotesDocumentRenderer } from "@hello-ai-company/editor-blocknote/react";
import "@hello-ai-company/editor-blocknote/power.css";

/** One stable authorized host instance per mounted scope. All authentication,
 * remote persistence, exact receipt tickets and asset/DB providers belong to the host. */
export function NotesExample(props: { host: NotesWorkspaceHost; initialTarget: NotesTarget; canvasHost: NotesCanvasHost; renderers: NotesWorkspaceRenderers; renderDocument: NotesDocumentRenderer; recoveries?: readonly NotesRecovery[]; canvasRecoveries?: readonly NotesCanvasRecovery[] }) {
  const [storage] = useState(() => createNotesIndexedDBLayoutStorage({ scope: props.host.scope }));
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; queueMicrotask(() => { if (!live.current) storage.close(); }); }; }, [storage]);
  const [layout] = useState(() => openNotesTab(createNotesLayout(props.host.scope), { id: "initial", target: props.initialTarget, title: "Note", pinned: false }));
  return <NotesTabbedWorkspace host={props.host} recoveries={props.recoveries} initialLayout={layout} layoutStorage={storage} config={{ version: 1, appearance: "classic", theme: "light", pageStyle: "clean" }} renderDocument={props.renderDocument}
    createCanvasController={({ target, preset }) => createNotesCanvasController({ scope: props.host.scope, target, documentRevision: preset.controller.getState().snapshot!.contentRevision, host: props.canvasHost, recovery: props.canvasRecoveries?.find(item => notesTargetKey(item.request.target) === notesTargetKey(target)), validate: layout => props.renderers.validateLayout(layout, preset.controller.getState().draft ?? preset.controller.getState().snapshot!.document) })}
    renderModes={({ target, document, preset, canvasController, documentTools }) => <Modes target={target} preset={preset} canvas={canvasController!} renderers={props.renderers} tools={documentTools}>{document}</Modes>} />;
}
function Modes({ target, preset, canvas, renderers, tools, children }: { target: NotesTarget; preset: NotesWorkspacePreset; canvas: NotesCanvasController; renderers: NotesWorkspaceRenderers; tools?: ReactNode; children: ReactNode }) {
  const controller = preset.controller, state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  if (!state.snapshot) return children;
  return <NotesWorkspaceModes scope={preset.host.scope} target={target} canvasController={canvas} documentTools={tools} document={state.draft ?? state.snapshot.document} documentRevision={state.snapshot.contentRevision} title={state.snapshot.title} renderers={renderers} composing={state.composing} pendingEditors={state.pendingEditors} manualSaveRequired={state.manualSaveRequired}
    beforeModeChange={async () => { await controller.save(); const next = controller.getState(); return next.status === "ready" && !next.dirty && !next.pendingEditors && !next.composing && !next.manualSaveRequired && !next.recovery ? next.snapshot!.contentRevision : false; }}>{children}</NotesWorkspaceModes>;
}
