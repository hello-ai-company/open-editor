import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { BlockNoteViewRaw, useCreateBlockNote } from "@blocknote/react";
import type { BlockNoteEditor } from "@blocknote/core";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { NotesInsertDialog, notesSupportedPickerInsertKinds, type NotesInsertEditor, type NotesInsertRequest, type NotesInsertionHost } from "./NotesInsertDialog.js";
import type { NotesScopedMediaHost } from "./NotesContentTools.js";
import { EditorDraftLifecycleProvider } from "../document/draftLifecycle.js";
import { notesSafeAssetUrl } from "./NotesContentTools.js";
import { notesTargetKey } from "./notesWorkspacePanels.js";
import { fromBlockNote } from "../adapter/fromBlockNote.js";
import { toBlockNoteForSchema } from "../adapter/toBlockNote.js";
import { createDocumentIndex } from "../index/documentIndex.js";
import { createDocumentColumns } from "../document/columns.js";
import type { NotesWorkspacePreset } from "./NotesWorkspace.js";
import { NOTES_INSERT_CATALOG, NOTES_STYLE_CATALOG, type NotesEditorBridge, type NotesInsertKind, type NotesStyleKind } from "./notesWorkspacePanels.js";

export type NotesDocumentRenderer = (context: { editor: BlockNoteEditor<any, any, any>; editable: boolean; bridge: NotesEditorBridge }) => ReactNode;
export type NotesBlockNoteDocumentProps = { preset: NotesWorkspacePreset; onBridge(bridge: NotesEditorBridge): void; render?: NotesDocumentRenderer; insertion?: NotesInsertionHost; media?: NotesScopedMediaHost };
const INSERT_TYPES: Partial<Record<NotesInsertKind, string>> = { text: "paragraph", code: "codeBlock", equation: "mathBlock", mermaid: "diagram", whiteboard: "oeNotesDrawing", htmlEmbed: "oeHtmlWidget", divider: "divider", pageBreak: "oePageBreak", tableInsert: "table" };
const FORMAT_TYPES: Partial<Record<NotesStyleKind, string>> = { heading: "heading", quote: "quote", bullet: "bulletListItem", numbered: "numberedListItem", checklist: "checkListItem", callout: "callout" };

/** Standard BlockNote writer used by NotesWorkspace. A host may provide its visual BlockNoteView
 * (e.g. Mantine) without reimplementing sidebar actions, draft orchestration or navigation. */
export function NotesBlockNoteDocument(props: NotesBlockNoteDocumentProps) {
  const { controller } = props.preset;
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const initial = useRef(state.draft ?? state.snapshot!.document);
  const editor = useCreateBlockNote({ ...props.preset.editorOptions(), initialContent: toBlockNoteForSchema(initial.current, props.preset.schema) as never }) as BlockNoteEditor<any, any, any>;
  const projectedDocument = useRef(JSON.stringify(fromBlockNote(editor.document as never)));
  const appliedDocument = useRef(JSON.stringify(initial.current));
  const applying = useRef(false), index = useMemo(() => { const next = createDocumentIndex(); next.replaceFromBlocks(initial.current.blocks); return next; }, []);
  const [insertRequest, setInsertRequest] = useState<NotesInsertRequest | null>(null);
  const insertionPending = useRef<{ resolve(): void; reject(error: Error): void } | null>(null);
  const selectionGeneration = useRef(0);
  useEffect(() => editor.onSelectionChange(() => { selectionGeneration.current++; }), [editor]);
  useEffect(() => () => { insertionPending.current?.reject(new Error("Insertion cancelled")); insertionPending.current = null; }, []);
  const stateRef = useRef(state); stateRef.current = state;
  const editable = state.snapshot?.capabilities.includes("document.save") === true && state.status === "ready";
  useEffect(() => { editor.isEditable = editable; }, [editor, editable]);
  useEffect(() => editor.onChange(() => {
    if (applying.current) return;
    const next = fromBlockNote(editor.document as never), encoded = JSON.stringify(next);
    if (encoded === projectedDocument.current) return;
    projectedDocument.current = encoded; appliedDocument.current = encoded;
    index.replaceFromBlocks(next.blocks); controller.setDraft(next);
  }), [editor, index, controller]);
  useEffect(() => {
    const next = state.draft ?? state.snapshot?.document;
    if (!next || state.composing || appliedDocument.current === JSON.stringify(next)) return;
    applying.current = true;
    try { editor.replaceBlocks(editor.document, toBlockNoteForSchema(next, props.preset.schema) as never); appliedDocument.current = JSON.stringify(next); projectedDocument.current = JSON.stringify(fromBlockNote(editor.document as never)); index.replaceFromBlocks(next.blocks); }
    finally { applying.current = false; }
  }, [state.draft, state.snapshot?.revision, state.composing, editor, index]);
  const pickerEditor = useMemo<NotesInsertEditor>(() => ({
    installedBlockTypes: Object.keys(props.preset.schema.blockSchema),
    getSelectedBlockId: () => editor.getTextCursorPosition().block.id,
    getSelectionFingerprint: () => JSON.stringify([selectionGeneration.current, editor.getSelection()?.blocks.map(block => block.id), editor.getTextCursorPosition().block.id]),
    getSelectedText: () => editor.getSelectedText(),
    insertBlocks(blocks, afterBlockId, signal) { if (signal.aborted || stateRef.current.status !== "ready" || stateRef.current.composing || !editor.getBlock(afterBlockId)) throw new Error("Insertion changed"); editor.insertBlocks(toBlockNoteForSchema(createEditorDocument([...blocks]), props.preset.schema) as never, afterBlockId, "after"); },
    insertLink(href, label, signal) { if (signal.aborted || stateRef.current.status !== "ready" || stateRef.current.composing) throw new Error("Insertion changed"); editor.insertInlineContent([{ type: "link", href, content: [{ type: "text", text: label, styles: {} }] }] as never); }
  }), [editor, props.preset]);
  const bridge = useMemo<NotesEditorBridge>(() => {
    const types = Object.keys(props.preset.schema.blockSchema);
    const insertKinds = NOTES_INSERT_CATALOG.filter(entry => entry.kind === "columns" ? types.includes("oeColumns") && types.includes("oeColumn") : !!INSERT_TYPES[entry.kind] && types.includes(INSERT_TYPES[entry.kind]!)).map(entry => entry.kind);
    const pickers = notesSupportedPickerInsertKinds({ controller, host: props.preset.host, editor: pickerEditor, insertion: props.insertion, media: props.media });
    insertKinds.push(...pickers);
    const formatKinds = NOTES_STYLE_CATALOG.filter(entry => !FORMAT_TYPES[entry.kind] || types.includes(FORMAT_TYPES[entry.kind]!)).map(entry => entry.kind);
    const assert = (signal?: AbortSignal) => { if (signal?.aborted || !stateRef.current.snapshot?.capabilities.includes("document.save") || stateRef.current.status !== "ready" || stateRef.current.composing) throw new Error("Editing unavailable"); };
    const selected = () => editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block];
    return {
      index, installedBlockTypes: types, supportedInsertActions: insertKinds, supportedStyleActions: formatKinds,
      getSelectedBlockId() { return editor.getTextCursorPosition().block.id; },
      contentCodecs: {
        async parse(format, source, signal) { assert(signal); const blocks = format === "markdown" ? await editor.tryParseMarkdownToBlocks(source) : format === "html" ? await editor.tryParseHTMLToBlocks(source) : undefined; assert(signal); if (!blocks) throw new Error("Use the public JSON codec"); return fromBlockNote(blocks as never); },
        async serialize(format, document, signal) { if (signal.aborted) throw new Error("Cancelled"); const blocks = toBlockNoteForSchema(document, props.preset.schema) as never; const result = format === "markdown" ? await editor.blocksToMarkdownLossy(blocks) : format === "html" ? await editor.blocksToFullHTML(blocks) : undefined; if (signal.aborted || result === undefined) throw new Error("Export unavailable"); return result; }
      },
      async acceptAsset(asset, scope, signal, presentation = "compact") {
        assert(signal); const snapshot = stateRef.current.snapshot!;
        if (scope.scope.actorId !== snapshot.scope.actorId || scope.scope.workspaceId !== snapshot.scope.workspaceId || notesTargetKey(scope.target) !== notesTargetKey(snapshot.target) || !editor.getBlock(scope.blockId) || !notesSafeAssetUrl(asset.url)) throw new Error("Asset scope changed");
        const type = asset.kind === "image" || asset.kind === "video" || asset.kind === "audio" ? asset.kind : "file";
        if (!types.includes(type)) throw new Error("Asset type unavailable");
        editor.insertBlocks([{ type, props: { url: asset.url, name: asset.name, showPreview: presentation === "card" } }] as never, scope.blockId, "after");
      },
      get editable() { return stateRef.current.snapshot?.capabilities.includes("document.save") === true && stateRef.current.status === "ready"; },
      get composing() { return stateRef.current.composing; },
      focusBlock(id) { editor.setTextCursorPosition(id, "start"); editor.focus(); },
      toggleTask(id) { assert(); const block = editor.getBlock(id); if (!block || block.type !== "checkListItem") throw new Error("Not a checklist"); editor.updateBlock(block, { props: { checked: !block.props.checked } } as never); },
      async insert(kind, signal): Promise<void> {
        assert(signal); if (!insertKinds.includes(kind)) throw new Error("Insertion unavailable");
        if (pickers.includes(kind as never)) {
          if (insertionPending.current) throw new Error("An insertion is already open");
          return await new Promise<void>((resolve, reject) => { insertionPending.current = { resolve, reject }; setInsertRequest({ id: crypto.randomUUID(), kind: kind as NotesInsertRequest["kind"], signal }); });
        }
        const cursor = editor.getTextCursorPosition().block;
        if (kind === "columns") { const columns = createDocumentColumns([[{ id: crypto.randomUUID(), type: "paragraph", content: "" }], [{ id: crypto.randomUUID(), type: "paragraph", content: "" }]]); editor.insertBlocks(toBlockNoteForSchema(createEditorDocument([columns]), props.preset.schema) as never, cursor, "after"); return; }
        const type = INSERT_TYPES[kind]!;
        const propsFor = kind === "gallery" ? { viewType: "gallery" } : kind === "kanban" ? { viewType: "board" } : kind === "collection" ? { viewType: "table" } : {};
        const block = type === "table" ? { type, content: { type: "tableContent", rows: [{ cells: [[], []] }, { cells: [[], []] }] } } : { type, props: propsFor };
        editor.insertBlocks([block] as never, cursor, "after");
      },
      format(kind, signal) {
        assert(signal); if (!formatKinds.includes(kind)) throw new Error("Formatting unavailable");
        const blocks = selected(), type = FORMAT_TYPES[kind];
        if (type) { editor.updateBlock(blocks[0]!, { type, ...(kind === "heading" ? { props: { level: 2 } } : {}) } as never); return; }
        if (kind.startsWith("align")) { const alignment = kind === "alignLeft" ? "left" : kind === "alignCenter" ? "center" : "right"; blocks.forEach(block => editor.updateBlock(block, { props: { textAlignment: alignment } } as never)); return; }
        if (kind === "indent") { editor.nestBlock(); return; } if (kind === "outdent") { editor.unnestBlock(); return; }
        const styles: Partial<Record<NotesStyleKind, Record<string, string>>> = { fontSans: { fontFamily: "sans" }, fontSerif: { fontFamily: "serif" }, fontMono: { fontFamily: "mono" }, textSmall: { fontSize: "small" }, textLarge: { fontSize: "large" } };
        if (styles[kind]) { editor.addStyles(styles[kind]!); return; }
        if (kind === "clearFormatting") { editor.removeStyles(editor.getActiveStyles()); return; }
        const all = editor.document, first = blocks[0]!, position = all.findIndex(block => block.id === first.id);
        if (position < 0) throw new Error("Select a top-level block to move it");
        const destination = kind === "moveUp" ? position - 1 : kind === "moveDown" ? position + 1 : kind === "moveTop" ? 0 : all.length - 1;
        if (destination < 0 || destination >= all.length || destination === position) return;
        const moved = [...all]; moved.splice(position, 1); moved.splice(destination, 0, first);
        editor.replaceBlocks(all, moved as never); editor.setTextCursorPosition(first.id);
      }
    };
  }, [editor, index, props.preset, props.insertion, props.media, pickerEditor]);
  useEffect(() => { props.onBridge(bridge); }, [bridge, props.onBridge]);
  return <EditorDraftLifecycleProvider controller={controller}><div className="oe-notes-blocknote-document" onCompositionStart={() => controller.setComposing(true)} onCompositionEnd={() => controller.setComposing(false)}>{props.render ? props.render({ editor, editable, bridge }) : <BlockNoteViewRaw editor={editor} editable={editable} />}</div><NotesInsertDialog request={insertRequest} controller={controller} host={props.preset.host} editor={pickerEditor} insertion={props.insertion} media={props.media} onClose={result => { const pending = insertionPending.current; insertionPending.current = null; setInsertRequest(null); if (result.status === "inserted") pending?.resolve(); else pending?.reject(new Error("Insertion cancelled")); }} /></EditorDraftLifecycleProvider>;
}
