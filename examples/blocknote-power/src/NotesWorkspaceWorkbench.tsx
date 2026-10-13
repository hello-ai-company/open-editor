import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { createNotesLayout, openNotesTab, createNotesIndexedDBLayoutStorage, notesTargetKey, type NotesPageStyle, type NotesTarget } from "@hello-ai-company/editor-blocknote/notes";
import { NotesTabbedWorkspace, NotesWorkspaceModes, createNotesCanvasController, type NotesCanvasController, type NotesCanvasRecovery, type NotesWorkspacePreset, type NotesWorkspaceRenderers } from "@hello-ai-company/editor-blocknote/react";
import { createMathPowerFeature } from "@hello-ai-company/editor-blocknote/math";
import { createDiagramPowerFeature } from "@hello-ai-company/editor-blocknote/diagram";
import { CanvasEditor, type CanvasEditorViewState } from "@hello-ai-company/editor-canvas/react";
import { createMagicLayoutSpec, createPresentationSlides, validateCanvasLayoutSpec, type CanvasLayoutSpec } from "@hello-ai-company/editor-canvas";
import { inspectOpenEditorPublication, renderOpenEditorSite } from "@hello-ai-company/editor-publish";
import type { EditorBlock, JsonValue } from "@hello-ai-company/editor-core";
import { createSyntheticNotesWorkspaceHost } from "./syntheticNotesWorkspace";
import { SyntheticNotesReview } from "./SyntheticNotesReview";
import { syntheticParityPropertyOptions, syntheticParityAssistance } from "./syntheticNotesParity";
import { SyntheticNotesRowTools } from "./SyntheticNotesRowTools";
import { syntheticDesignAppearance, syntheticDesignAI } from "./syntheticNotesDesign";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@hello-ai-company/editor-blocknote/power.css";

const renderers: NotesWorkspaceRenderers = {
  validatePublication: inspectOpenEditorPublication,
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
    return renderOpenEditorSite(document, { requireCompleteDocument: true, title, canvasSpec: draft.layout as unknown as CanvasLayoutSpec, canvasRenderState: { hiddenNodeIds: view.hiddenNodeIds, alignmentByNodeId: view.alignmentByNodeId } });
  },
  presentation(document, draft, title) {
    return createPresentationSlides(document).map(slide => {
      const selected = { schemaVersion: 1, blocks: document.blocks.filter(block => slide.blockIds.includes(block.id)) };
      return renderOpenEditorSite(selected, { requireCompleteDocument: true, title, canvasSpec: { ...createMagicLayoutSpec(selected, "presentation"), theme: draft.theme } });
    });
  }
};
function hasNestedWriter(blocks: readonly EditorBlock[]): boolean {
  return blocks.some(block => ["databaseView", "pageTransclusion", "oeNotesSyncedBlock"].includes(block.type) || (block.children && hasNestedWriter(block.children)));
}

/** Each tab renders this child against its own writer; no active global controller leaks into another pane. */
function ModeSurface({ preset, target, document, readSchema, canvasController, documentTools, baseline, advanced }: {
  preset: NotesWorkspacePreset; target: NotesTarget; document: ReactNode; canvasController?: NotesCanvasController; documentTools?: ReactNode;
  baseline?: boolean; advanced?: boolean;
  readSchema: ReturnType<typeof createSyntheticNotesWorkspaceHost>["readSchema"];
}) {
  const controller = preset.controller;
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  if (!state.snapshot) return <>{document}</>;
  if (target.kind === "row" && !canvasController) return <><SyntheticNotesRowTools preset={preset} readSchema={readSchema} propertyOptions={advanced ? syntheticParityPropertyOptions : undefined} />{document}</>;
  return <>{!baseline ? <><SyntheticNotesRowTools preset={preset} readSchema={readSchema} propertyOptions={advanced ? syntheticParityPropertyOptions : undefined} />{advanced ? <SyntheticNotesReview preset={preset} /> : null}<p className="notes-local-preview-status">Canvas・タブ配置はこのブラウザの合成領域に保存されます。</p></> : null}
    <NotesWorkspaceModes documentTools={documentTools} canvasController={canvasController} scope={preset.host.scope} target={target} document={state.draft ?? state.snapshot.document} documentRevision={state.snapshot.contentRevision} title={state.draftTitle ?? state.snapshot.title} composing={state.composing} pendingEditors={state.pendingEditors} manualSaveRequired={state.manualSaveRequired} language={baseline ? "en" : "ja"} classic={preset.config.appearance === "classic"} renderers={renderers} beforeModeChange={async () => {
      if (!await preset.beforeTableLeave()) return false;
      const before = controller.getState();
      if (!before.snapshot || before.status !== "ready" || before.composing || before.pendingEditors || before.manualSaveRequired || before.recovery || hasNestedWriter((before.draft ?? before.snapshot.document).blocks)) return false;
      await controller.save();
      const latest = controller.getState();
      return latest.status === "ready" && !latest.dirty && !latest.composing && !latest.pendingEditors && !latest.manualSaveRequired && !latest.recovery ? latest.snapshot!.contentRevision : false;
    }}>{document}</NotesWorkspaceModes>
  </>;
}

export function NotesWorkspaceWorkbench() {
  const advanced = new URLSearchParams(location.search).has("parity");
  const design = new URLSearchParams(location.search).get("parity") === "design";
  const reviewedViews = new URLSearchParams(location.search).get("parity") === "database15";
  const databaseViews = reviewedViews || new URLSearchParams(location.search).get("parity") === "database";
  const legacyValues = new URLSearchParams(location.search).get("parity") === "legacy";
  const relations = new URLSearchParams(location.search).get("parity") === "relations17";
  const baseline = new URLSearchParams(location.search).has("baseline");
  const referenceFrame = new URLSearchParams(location.search).get("hostFrame") === "reference";
  const [adapter] = useState(() => createSyntheticNotesWorkspaceHost(relations ? "open-editor.synthetic-notes-workspace.parity17-v1" : reviewedViews ? "open-editor.synthetic-notes-workspace.parity15-v1" : design ? "open-editor.synthetic-notes-workspace.parity14-v1" : databaseViews ? "open-editor.synthetic-notes-workspace.parity13-v1" : legacyValues ? "open-editor.synthetic-notes-workspace.parity12-legacy-v1" : advanced ? "open-editor.synthetic-notes-workspace.parity12-v1" : baseline ? "open-editor.synthetic-notes-workspace.css-baseline9-v2" : undefined, { baseline, advanced, legacyValues, databaseViews, reviewedViews, relations }));
  const [layoutStorage] = useState(() => createNotesIndexedDBLayoutStorage({ scope: adapter.host.scope, databaseName: relations ? "open-editor.synthetic-notes-layout.parity17-v1" : reviewedViews ? "open-editor.synthetic-notes-layout.parity15-v1" : design ? "open-editor.synthetic-notes-layout.parity14-v1" : databaseViews ? "open-editor.synthetic-notes-layout.parity13-v1" : legacyValues ? "open-editor.synthetic-notes-layout.parity12-legacy-v1" : advanced ? "open-editor.synthetic-notes-layout.parity12-v1" : baseline ? "open-editor.synthetic-notes-layout.css-baseline9-v2" : "open-editor.synthetic-notes-layout.v1" }));
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; queueMicrotask(() => { if (!mounted.current) layoutStorage.close(); }); }; }, [layoutStorage]);
  const [canvasRecoveries, setCanvasRecoveries] = useState<NotesCanvasRecovery[]>([]);
  const [features] = useState(() => [createMathPowerFeature(), createDiagramPowerFeature()]);
  const [initialLayout] = useState(() => baseline ? openNotesTab(openNotesTab(createNotesLayout(adapter.host.scope), { id: "baseline-strategy", target: { kind: "page", pageId: "projects" }, title: "Personal AI Platform strategy", pinned: false }), { id: "synthetic-baseline", target: { kind: "page", pageId: "00000000-0000-4000-8000-000000000011" }, title: "Synthetic integration note", pinned: false }) : openNotesTab(openNotesTab(createNotesLayout(adapter.host.scope), { id: "synthetic-row", target: { kind: "row", databaseId: "synthetic-db", rowId: "row-1" }, title: "行のノート", pinned: false }), { id: "synthetic-welcome", target: { kind: "page", pageId: databaseViews ? "database-views" : "welcome" }, title: databaseViews ? "全11ビューの合成ノート" : "移管の合成ノート", pinned: false }));
  const [ready, setReady] = useState(false), [failure, setFailure] = useState("");
  useEffect(() => { let live = true; void adapter.initialize().then(() => adapter.readCanvasRecoveries()).then(recoveries => { if (live) { setCanvasRecoveries(recoveries); setReady(true); } }).catch(() => { if (live) setFailure("合成workspaceを開けませんでした"); }); return () => { live = false; }; }, [adapter]);
  return <div className={referenceFrame ? "notes-baseline-host" : "notes-standalone-host"} data-synthetic-host-reserve={referenceFrame ? 268 : 0}><div className="notes-migration-demo-bar"><a href="?">Documentに戻る</a><span>合成データ · 外部送信なし · 本文保存はtest-only</span><label>合成保存障害<select aria-label="合成workspace保存障害" onChange={event => adapter.setFault(event.target.value as "none" | "lost-ack" | "denied" | "offline")}><option value="none">なし</option><option value="lost-ack">保存後の応答喪失</option><option value="denied">権限拒否</option><option value="offline">切断</option></select></label>{databaseViews ? <label>表示設定の合成障害<select aria-label="合成DB表示設定の保存障害" onChange={event => adapter.setViewFault(event.target.value as "none" | "delay" | "reject" | "lost-ack")}><option value="none">なし</option><option value="delay">保存を遅延</option><option value="reject">保存を拒否</option>{reviewedViews ? <option value="lost-ack">保存後の応答喪失</option> : null}</select></label> : null}</div>
    {failure ? <p role="alert">{failure}</p> : ready ? <NotesTabbedWorkspace databasePresentation={adapter.databaseViews?.presentation} databaseViewConfig={adapter.databaseViews?.databaseViewConfig} beforeResourceLeave={adapter.databaseViews?.beforeResourceLeave} insertion={adapter.databaseViews?.insertion} assistance={advanced ? { search: syntheticParityAssistance, askPage: syntheticParityAssistance } : undefined} databaseNavigation={advanced ? { databases: [{ id: "synthetic-db", title: "合成DB" }], host: adapter.databaseNavigationHost } : undefined} host={adapter.host} layoutStorage={layoutStorage} createCanvasController={({ preset, target }) => databaseViews && target.kind === "row" ? undefined : createNotesCanvasController({ scope: adapter.host.scope, target, documentRevision: preset.controller.getState().snapshot!.contentRevision, host: adapter.canvasHost, recovery: canvasRecoveries.find(item => notesTargetKey(item.request.target) === notesTargetKey(target)), validate: layout => renderers.validateLayout(layout, preset.controller.getState().draft ?? preset.controller.getState().snapshot!.document) })} config={{ version: 1, title: "OpenEditor Notes", locale: baseline ? "en" : "ja", theme: "light", appearance: new URLSearchParams(location.search).has("classic") ? "classic" : "default", pageStyle: (new URLSearchParams(location.search).get("pageStyle") ?? "clean") as NotesPageStyle }} features={features} selectionAI={design ? syntheticDesignAI : undefined} pageAppearance={design ? syntheticDesignAppearance : { fields: { icon: "icon", tags: "tags", style: "style", cover: "cover" } }} initialLayout={initialLayout} documentOptions={{ dictionaryEntries: advanced ? [{ id: "term-notes", term: "共同編集", definition: "合成の辞書項目。人間とエージェントの編集を確認します。" }] : undefined, categoryOptions: [{ value: "note", label: "ノート" }, { value: "task", label: "タスク" }], privacyOptions: [{ value: "private", label: "自分のみ" }] }} renderDocument={({ editor, editable, sideMenu, slashMenu, formattingToolbar }) => <BlockNoteView editor={editor} editable={editable} sideMenu={false} slashMenu={false} formattingToolbar={false} theme="light">{sideMenu}{slashMenu}{formattingToolbar}</BlockNoteView>} renderModes={({ target, document, preset, canvasController, documentTools }) => <ModeSurface advanced={advanced} baseline={baseline} documentTools={documentTools} canvasController={canvasController} preset={preset} target={target} document={document} readSchema={adapter.readSchema} />} renderPreview={({ document, snapshot }) => <iframe title={snapshot.title + " 読み取り専用プレビュー"} sandbox="" srcDoc={renderOpenEditorSite(document, { title: snapshot.title })} style={{ width: "100%", minHeight: 400, border: 0 }} />} /> : <p role="status">合成workspaceを読み込んでいます</p>}
  </div>;
}
