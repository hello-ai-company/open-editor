import { DocumentSideMenuController } from "@hello-ai-company/editor-blocknote/react";
// Local synthetic browser fixture. No external service, credentials or user data.
import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { createReactBlockSpec } from "@blocknote/react";
import "@blocknote/mantine/style.css";
import "@hello-ai-company/editor-blocknote/power.css";
import { createRoot } from "react-dom/client";
import { createEditorDocument, type DatabaseProvider } from "@hello-ai-company/editor-core";
import { createOpenEditorPowerPreset, createDocumentWorkspaceFeature, createDatabaseRuntimeStore, toBlockNoteForSchema, fromBlockNote } from "@hello-ai-company/editor-blocknote";
import { createNotesDocumentWidgetsFeature, createLegacyNotesEditingFeature, createNotesSharedBlockController, createEmptyNotesDrawing, NotesDrawingWidget } from "@hello-ai-company/editor-blocknote/notes";
import { createMathPowerFeature } from "@hello-ai-company/editor-blocknote/math";
import { createDiagramPowerFeature } from "@hello-ai-company/editor-blocknote/diagram";

let sharedBody = "Synthetic shared text", sharedRevision = "shared1", sharedWrites = 0, opened = 0;
const shared = createNotesSharedBlockController({
  scope: { workspaceId: "isolated-widget-fixture", actorId: "fixture-only" },
  read: async sharedId => ({ sharedId, revision: sharedRevision, body: sharedBody, writable: true, persistence: "test-only" }),
  beforeSubmit: async () => undefined,
  commit: async request => {
    if (request.expectedRevision !== sharedRevision || request.change.kind !== "patch" || typeof request.change.fields.body !== "string") return { status: "denied", resourceId: request.resourceId, operationId: request.operationId };
    sharedBody = request.change.fields.body; sharedRevision = "shared" + (++sharedWrites + 1);
    return { status: "committed", resourceId: request.resourceId, operationId: request.operationId, snapshot: { revision: sharedRevision, value: { body: sharedBody } } };
  },
  lookupOperation: async (resourceId, operationId) => ({ status: "unknown", resourceId, operationId })
}, "synthetic-shared");
const database: DatabaseProvider = {
  getDatabase: async () => ({ id: "fixture-db", title: "Synthetic DB", propertyDefinitions: [{ id: "title", name: "Title", type: "text" }] }),
  listRows: async () => ({ databaseId: "fixture-db", rows: [{ title: "Synthetic row" }], items: [{ rowKey: "row", sortOrder: 0, row: { title: "Synthetic row" } }], schema: { title: "string" }, config: {}, pagination: { limit: 20, total: 1, hasMore: false, nextCursor: null } })
};
const store = createDatabaseRuntimeStore({ provider: database });
// Mimics a host-owned wire/schema wrapper which does not set selectable:false.
const hostDrawing = createReactBlockSpec({ type: "hostDrawing", propSchema: { payload: { default: createEmptyNotesDrawing() } }, content: "none" }, { render: ({ block, editor }) => <NotesDrawingWidget source={block.props.payload} readOnly={!editor.isEditable} onChange={payload => editor.updateBlock(block, { props: { payload } })} /> })();
const preset = createOpenEditorPowerPreset({
  features: [createDocumentWorkspaceFeature(), createNotesDocumentWidgetsFeature({ resolveSharedController: id => id === "synthetic-shared" ? shared : undefined }), createLegacyNotesEditingFeature(), createMathPowerFeature(), createDiagramPowerFeature(), { id: "synthetic-host-drawing", blockSpecs: { hostDrawing } }],
  pageCardRuntime: { resolve: () => ({ title: "Synthetic referenced page", preview: "No remote resource" }), onOpen: () => { opened++; } },
  childPageRuntime: { resolve: () => ({ title: "Synthetic child page" }), onOpen: () => { opened++; } },
  pageTransclusionRuntime: { loadCurrentProjection: async pageId => ({ pageId, title: "Synthetic transclusion", document: createEditorDocument([{ id: "projected", type: "paragraph", content: "Read-only synthetic projection" }]) }) },
  databaseViewRuntime: { database, store, onOpenRow: () => { opened++; } }
});
const options = preset.editorOptions();
const document = createEditorDocument([
  { id: "before", type: "paragraph", content: "Outside editable paragraph" },
  { id: "columns", type: "oeColumns", props: { gap: 16 }, children: [
    { id: "left", type: "oeColumn", props: { width: 1 }, children: [{ id: "left-text", type: "paragraph", content: "Left column text" }] },
    { id: "right", type: "oeColumn", props: { width: 1 }, children: [{ id: "right-text", type: "paragraph", content: "Right column text" }] }
  ] },
  { id: "native-board", type: "oeNotesDrawing" },
  { id: "host-board", type: "hostDrawing" },
  { id: "legacy-board", type: "oeLegacyNotesDrawing", props: { payload: "[]", width: 640, height: 360 } },
  { id: "html", type: "oeHtmlWidget", props: { html: "<p>Synthetic preview</p>", css: "", javascript: "preservedButNeverExecuted()" } },
  { id: "local-shared", type: "oeNotesSyncedBlock", props: { sharedId: "", body: "Synthetic local shared text" } },
  { id: "host-shared", type: "oeNotesSyncedBlock", props: { sharedId: "synthetic-shared", body: "" } },
  { id: "legacy-link", type: "oeLegacyNotesLink", props: { title: "Synthetic link", url: "", description: "Synthetic description" } },
  { id: "legacy-page", type: "oeLegacyNotesPageLink", props: { pageId: "fixture-page", title: "Synthetic page link" } },
  { id: "legacy-asset", type: "oeLegacyNotesAsset", props: { name: "Synthetic asset", caption: "Synthetic caption", url: "", kind: "file" } },
  { id: "card", type: "pageCard", props: { pageId: "fixture-page", titleHint: "Synthetic referenced page" } },
  { id: "child", type: "childPage", props: { pageId: "fixture-child", titleHint: "Synthetic child page" } },
  { id: "projection", type: "pageTransclusion", props: { pageId: "fixture-page" } },
  { id: "db", type: "databaseView", props: { databaseId: "fixture-db", viewId: "main", viewType: "table", titleHint: "Synthetic DB" } },
  { id: "status", type: "status", props: { state: "todo" } },
  { id: "math", type: "mathBlock", content: "E=mc^2" },
  { id: "diagram", type: "diagram", content: "flowchart LR\n A-->B" },
  { id: "code", type: "codeBlock", props: { language: "javascript" }, content: "const synthetic = true;" },
  { id: "after", type: "paragraph", content: "Trailing editable paragraph" }
]);
const editor = BlockNoteEditor.create({ ...options, initialContent: toBlockNoteForSchema(document, options.schema) as never });
const readOnly = new URLSearchParams(location.search).has("readonly");
if (readOnly) editor.isEditable = false;
const savedKey = "openeditor-columns30-synthetic-only";
Object.assign(window, { widgetFixture: { editor, read: () => ({ document: fromBlockNote(editor.document), sharedBody, sharedWrites, opened }),
  saveSynthetic: () => localStorage.setItem(savedKey, JSON.stringify(fromBlockNote(editor.document))),
  restoreSynthetic: () => { const saved = localStorage.getItem(savedKey); if (saved) editor.replaceBlocks(editor.document, toBlockNoteForSchema(JSON.parse(saved), options.schema) as never); }
} });
createRoot(window.document.getElementById("root")!).render(<main style={{ width: "min(960px,100%)", margin: "auto", boxSizing: "border-box", padding: 20 }}><p>Isolated synthetic widget fixture · no external services</p><BlockNoteView editor={editor} theme="light" editable={!readOnly} sideMenu={false}><DocumentSideMenuController /></BlockNoteView></main>);
