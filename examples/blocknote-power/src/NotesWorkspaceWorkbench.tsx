import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { createNotesLayout, openNotesTab, type NotesTarget } from "@hello-ai-company/editor-blocknote/notes";
import { NotesTabbedWorkspace, NotesWorkspaceModes, type NotesWorkspacePreset, type NotesWorkspaceRenderers } from "@hello-ai-company/editor-blocknote/react";
import { createMathPowerFeature } from "@hello-ai-company/editor-blocknote/math";
import { createDiagramPowerFeature } from "@hello-ai-company/editor-blocknote/diagram";
import { CanvasEditor, type CanvasEditorViewState } from "@hello-ai-company/editor-canvas/react";
import { createMagicLayoutSpec, createPresentationSlides, validateCanvasLayoutSpec, type CanvasLayoutSpec } from "@hello-ai-company/editor-canvas";
import { renderOpenEditorSite } from "@hello-ai-company/editor-publish";
import type { EditorBlock, JsonValue } from "@hello-ai-company/editor-core";
import { createSyntheticNotesWorkspaceHost } from "./syntheticNotesWorkspace";
import { SyntheticNotesRowTools } from "./SyntheticNotesRowTools";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@hello-ai-company/editor-blocknote/power.css";

const renderers: NotesWorkspaceRenderers = {
  createLayout(document, options) {
    const layout = { ...createMagicLayoutSpec(document, options.template), theme: options.theme };
    return { layout: layout as unknown as JsonValue, view: { selectedNodeId: layout.root.id, hiddenNodeIds: [], lockedNodeIds: [], alignmentByNodeId: {}, breakpoint: "desktop" }, theme: options.theme };
  },
  validateLayout(layout, document) { return validateCanvasLayoutSpec(layout as unknown as CanvasLayoutSpec, document).map(issue => issue.message); },
  canvas({ document, draft, readOnly, onChange }) {
    return <div inert={readOnly || undefined}><CanvasEditor document={document} spec={draft.layout as unknown as CanvasLayoutSpec} viewState={draft.view as Partial<CanvasEditorViewState>} onViewStateChange={view => onChange({ ...draft, view: view as unknown as JsonValue })} onLayoutChange={layout => onChange({ ...draft, layout: layout as unknown as JsonValue, theme: typeof layout.theme === "string" ? layout.theme : draft.theme })} /></div>;
  },
  site(document, draft, title) {
    const view = draft.view as Partial<CanvasEditorViewState>;
    return renderOpenEditorSite(document, { title, canvasSpec: draft.layout as unknown as CanvasLayoutSpec, canvasRenderState: { hiddenNodeIds: view.hiddenNodeIds, alignmentByNodeId: view.alignmentByNodeId } });
  },
  presentation(document, draft, title) {
    return createPresentationSlides(document).map(slide => {
      const selected = { schemaVersion: 1, blocks: document.blocks.filter(block => slide.blockIds.includes(block.id)) };
      return renderOpenEditorSite(selected, { title, canvasSpec: { ...createMagicLayoutSpec(selected, "presentation"), theme: draft.theme } });
    });
  }
};
function hasNestedWriter(blocks: readonly EditorBlock[]): boolean {
  return blocks.some(block => ["databaseView", "pageTransclusion", "oeNotesSyncedBlock"].includes(block.type) || (block.children && hasNestedWriter(block.children)));
}

/** Each tab renders this child against its own writer; no active global controller leaks into another pane. */
function ModeSurface({ preset, target, document, readSchema }: {
  preset: NotesWorkspacePreset; target: NotesTarget; document: ReactNode;
  readSchema: ReturnType<typeof createSyntheticNotesWorkspaceHost>["readSchema"];
}) {
  const controller = preset.controller;
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  if (!state.snapshot) return <>{document}</>;
  return <><SyntheticNotesRowTools preset={preset} readSchema={readSchema} /><p className="notes-local-preview-status">Canvasの変更はこの表示内のみ。タブ切替・再読込後の復元は未接続です。</p>
    <NotesWorkspaceModes scope={preset.host.scope} target={target} document={state.draft ?? state.snapshot.document} documentRevision={state.snapshot.contentRevision} title={state.draftTitle ?? state.snapshot.title} composing={state.composing} pendingEditors={state.pendingEditors} manualSaveRequired={state.manualSaveRequired} language="ja" renderers={renderers} beforeModeChange={async () => {
      const before = controller.getState();
      if (!before.snapshot || before.status !== "ready" || before.composing || before.pendingEditors || before.manualSaveRequired || before.recovery || hasNestedWriter((before.draft ?? before.snapshot.document).blocks)) return false;
      await controller.save();
      const latest = controller.getState();
      return latest.status === "ready" && !latest.dirty && !latest.composing && !latest.pendingEditors && !latest.manualSaveRequired && !latest.recovery ? latest.snapshot!.contentRevision : false;
    }}>{document}</NotesWorkspaceModes>
  </>;
}

export function NotesWorkspaceWorkbench() {
  const [adapter] = useState(() => createSyntheticNotesWorkspaceHost());
  const [features] = useState(() => [createMathPowerFeature(), createDiagramPowerFeature()]);
  const [initialLayout] = useState(() => openNotesTab(openNotesTab(createNotesLayout(adapter.host.scope), { id: "synthetic-row", target: { kind: "row", databaseId: "synthetic-db", rowId: "row-1" }, title: "行のノート", pinned: false }), { id: "synthetic-welcome", target: { kind: "page", pageId: "welcome" }, title: "移管の合成ノート", pinned: false }));
  const [ready, setReady] = useState(false), [failure, setFailure] = useState("");
  useEffect(() => { let live = true; void adapter.initialize().then(() => { if (live) setReady(true); }).catch(() => { if (live) setFailure("合成workspaceを開けませんでした"); }); return () => { live = false; }; }, [adapter]);
  return <><div className="notes-migration-demo-bar"><a href="?">Documentに戻る</a><span>合成データ · 外部送信なし · 本文保存はtest-only</span><label>合成保存障害<select aria-label="合成workspace保存障害" onChange={event => adapter.setFault(event.target.value as "none" | "lost-ack" | "denied" | "offline")}><option value="none">なし</option><option value="lost-ack">保存後の応答喪失</option><option value="denied">権限拒否</option><option value="offline">切断</option></select></label></div>
    {failure ? <p role="alert">{failure}</p> : ready ? <NotesTabbedWorkspace host={adapter.host} config={{ version: 1, title: "OpenEditor Notes", locale: "ja", theme: "light" }} features={features} initialLayout={initialLayout} documentOptions={{ categoryOptions: [{ value: "note", label: "ノート" }, { value: "task", label: "タスク" }], privacyOptions: [{ value: "private", label: "自分のみ" }] }} renderDocument={({ editor, editable }) => <BlockNoteView editor={editor} editable={editable} theme="light" />} renderModes={({ target, document, preset }) => <ModeSurface preset={preset} target={target} document={document} readSchema={adapter.readSchema} />} renderPreview={({ document, snapshot }) => <iframe title={snapshot.title + " 読み取り専用プレビュー"} sandbox="" srcDoc={renderOpenEditorSite(document, { title: snapshot.title })} style={{ width: "100%", minHeight: 400, border: 0 }} />} /> : <p role="status">合成workspaceを読み込んでいます</p>}
  </>;
}
