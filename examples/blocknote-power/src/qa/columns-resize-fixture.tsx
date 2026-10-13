// Isolated synthetic writer and localStorage codec round trip. No canonical host/API.
import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { createRoot } from "react-dom/client";
import "@blocknote/mantine/style.css";
import "@hello-ai-company/editor-blocknote/power.css";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createOpenEditorPowerPreset, createDocumentWorkspaceFeature, createDocumentColumns, toBlockNoteForSchema, fromBlockNote } from "@hello-ai-company/editor-blocknote";
import { DocumentSideMenuController } from "@hello-ai-company/editor-blocknote/react";
const query = new URLSearchParams(location.search), count = Math.max(2, Math.min(6, Number(query.get("count") || 2)));
const nested = createDocumentColumns([[{ id: "nested-text-a", type: "paragraph", content: "Nested left" }], [{ id: "nested-text-b", type: "paragraph", content: "Nested right" }]], { id: "nested", idFactory: (() => { let n = 0; return () => "nested-col-" + n++; })() });
const group = createDocumentColumns(Array.from({ length: count }, (_, i) => [{ id: `text-${i}`, type: "paragraph", content: `Column ${i + 1} body that remains editable.` }, ...(i === 0 && query.has("nested") ? [nested] : [])]), { id: "columns", widths: query.has("nested") ? [3, 1, ...Array(count - 2).fill(1)] : undefined, idFactory: (() => { let n = 0; return () => "col-" + n++; })() });
const document = createEditorDocument([{ id: "before", type: "paragraph", content: "Before the columns" }, group, { id: "after", type: "paragraph", content: "After the columns" }]);
const preset = createOpenEditorPowerPreset({ features: [createDocumentWorkspaceFeature()] }), options = preset.editorOptions();
const savedKey = "openeditor-columns32-synthetic-only", stored = query.has("restore") ? localStorage.getItem(savedKey) : null;
const editor = BlockNoteEditor.create({ ...options, initialContent: toBlockNoteForSchema(stored ? JSON.parse(stored) : document, options.schema) as never });
const readOnly = query.has("readonly"); editor.isEditable = !readOnly;
Object.assign(window, { resizeFixture: { editor, read: () => fromBlockNote(editor.document), save: () => localStorage.setItem(savedKey, JSON.stringify(fromBlockNote(editor.document))) } });
createRoot(window.document.getElementById("root")!).render(<main className={query.has("edge") ? "resize-edge" : undefined} style={{ width: "min(1200px,100%)", margin: "auto", padding: 16, boxSizing: "border-box" }}><p>Synthetic columns · no remote services</p><button onClick={() => editor.undo()}>Undo</button><button onClick={() => editor.redo()}>Redo</button><button onClick={() => window.localStorage.setItem(savedKey, JSON.stringify(fromBlockNote(editor.document)))}>Save synthetic</button><BlockNoteView editor={editor} editable={!readOnly} sideMenu={false}><DocumentSideMenuController /></BlockNoteView><style>{`.resize-edge {width:100%!important;margin:0!important;padding:8px!important}.resize-edge .bn-editor {padding-inline:4px!important}`}</style></main>);
