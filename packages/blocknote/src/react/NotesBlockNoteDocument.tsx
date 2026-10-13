import { createNotesTextAlignmentPolicy, notesTextAlignmentAccessAllowed, notesTextAlignmentItemAllowed, type NotesTextAlignmentAccess } from "./notesTextAlignmentPolicy.js";
import { createNotesInlineColorPolicy, notesInlineColorSelectionAllowed } from "./notesInlineColorPolicy.js";
import { createNotesLinkBlockPolicy } from "./notesLinkBlockPolicy.js";
import { notesLinkValidator, notesSafeInsertionLink, guardNotesLinkCommands, guardNotesLinkShortcut, createNotesLinkInputComposition, notesNativeLinkCompositionSignal, notesLinkSelectionAllowed, notesLinkBlocksHaveHardBreaks } from "./notesLinkPolicy.js";
import { notesFormattingSelectionAvailable } from "./notesFormattingSelection.js";
import { NotesFormattingToolbarController, NotesLinkToolbarController } from "./NotesFormattingToolbar.js";
import { NotesPlusMenu } from "./NotesPlusMenu.js";
import { NotesSlashMenuController } from "./NotesInsertionCommands.js";
import { NotesInsertChoiceDialog } from "./NotesInsertChoiceDialog.js";
import { useNotesFeedback } from "./NotesFeedback.js";
import { closeHistory } from "@tiptap/pm/history";
import { notesDropAnchor, subscribeNotesToolDrags, currentNotesToolDrag, consumeNotesToolDrag, NOTES_TOOL_DRAG_MIME, type NotesInsertionAnchor } from "./notesToolDrag.js";
import { notesPanelIdentity } from "./notesWorkspacePanels.js";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, useCallback } from "react";
import { DocumentSideMenuController } from "./DocumentSideMenuController.js";
import { BlockNoteViewRaw, useCreateBlockNote, getFormattingToolbarItems } from "@blocknote/react";
import { FormattingToolbarExtension, LinkToolbarExtension, SuggestionMenu } from "@blocknote/core/extensions";
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
import { HTML_WIDGET_PRESETS } from "../document/htmlWidget.js";
import type { NotesWorkspacePreset } from "./NotesWorkspace.js";
import { NOTES_INSERT_CATALOG, NOTES_STYLE_CATALOG, type NotesEditorBridge, type NotesInsertOptions, type NotesInsertKind, type NotesStyleKind } from "./notesWorkspacePanels.js";
import { NotesSelectionTools } from "./NotesSelectionTools.js";
import type { NotesSelectionAIService, NotesTextSelection } from "./notesSelection.js";
import { notesMoveBlock, type NotesBlockMove } from "./notesMoveBlock.js";
import { createDocumentCoeditingSession, type DocumentCoeditingPort, type DocumentCoeditingIdentity, type DocumentCoeditingPolicy } from "../document/coediting.js";
import { notesDocumentEditingAvailable } from "../notes/editingAvailability.js";
import { createNotesSearchPlugin } from "./notesSearch.js";

export type NotesDocumentRenderer = (context: { editor: BlockNoteEditor<any, any, any>; editable: boolean; bridge: NotesEditorBridge; sideMenu?: ReactNode; /** Disable the native slashMenu before mounting this shared controller. */ slashMenu?: ReactNode; /** Disable native formattingToolbar and mount this shared controller. */ formattingToolbar?: ReactNode; /** Disable native linkToolbar and mount this shared controller. */ linkToolbar?: ReactNode }) => ReactNode;
export type NotesCoeditingOptions = { paneId: string; autoPolicy?(identity: DocumentCoeditingIdentity): DocumentCoeditingPolicy | undefined; onReady?(port: DocumentCoeditingPort | undefined): void };
export type NotesBlockNoteDocumentProps = { preset: NotesWorkspacePreset; onBridge(bridge: NotesEditorBridge): void; render?: NotesDocumentRenderer; insertion?: NotesInsertionHost; media?: NotesScopedMediaHost; selectionAI?: NotesSelectionAIService; selectionProposal?: import("./notesSelection.js").NotesSelectionProposalEntry; coediting?: NotesCoeditingOptions };
const INSERT_TYPES: Partial<Record<NotesInsertKind, string>> = { text: "paragraph", code: "codeBlock", equation: "mathBlock", mermaid: "diagram", whiteboard: "oeNotesDrawing", htmlEmbed: "oeHtmlWidget", divider: "divider", pageBreak: "oePageBreak", tableInsert: "table" };
const FORMAT_TYPES: Partial<Record<NotesStyleKind, string>> = { heading: "heading", quote: "quote", bullet: "bulletListItem", numbered: "numberedListItem", checklist: "checkListItem", callout: "callout" };

/** Standard BlockNote writer used by NotesWorkspace. A host may provide its visual BlockNoteView
 * (e.g. Mantine) without reimplementing sidebar actions, draft orchestration or navigation. */
export function NotesBlockNoteDocument(props: NotesBlockNoteDocumentProps) {
  const { controller } = props.preset;
  const [formattingReady, setFormattingReady] = useState(false);
  const onFormattingReady = useCallback((ready: boolean) => setFormattingReady(ready), []);
  const formattingToolbar = <NotesFormattingToolbarController onReady={onFormattingReady} />;
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const initial = useRef(state.draft ?? state.snapshot!.document);
  // useCreateBlockNote consumes initialContent only when this writer mounts.
  // Controller updates must not repeatedly convert that discarded initial value.
  const [initialContent] = useState(() => toBlockNoteForSchema(initial.current, props.preset.schema));
  const linkPolicy = useRef({ insertion: props.insertion }); linkPolicy.current = { insertion: props.insertion };
  const editorOptions = props.preset.editorOptions();
  const [restrictNativeLinks] = useState(() => props.insertion?.pickerInsertKinds !== undefined || !!props.insertion?.isValidLink || props.insertion?.linkBlockTypes !== undefined || props.insertion?.allowLinkHardBreaks === false);
  const editor = useCreateBlockNote({ ...editorOptions, ...(restrictNativeLinks ? { links: { ...editorOptions.links, isValidLink: notesLinkValidator(() => ({ insertion: linkPolicy.current.insertion, scope: controller.getState().snapshot?.scope }), editorOptions.links?.isValidLink) } } : {}), initialContent: initialContent as never }) as BlockNoteEditor<any, any, any>;
  const linkToolbar = editor.getExtension(LinkToolbarExtension) ? <NotesLinkToolbarController /> : undefined;
  // The picker has its own safe, scoped validation, including explicit internal
  // page links for SDK hosts. Capture the native implementation before public
  // ingress guards are installed; the local draft writer remains unchanged.
  const createPickerLink = useMemo(() => editor.createLink?.bind(editor), [editor]);
  const pickerLinkValidator = useMemo(() => notesLinkValidator(() => ({ insertion: linkPolicy.current.insertion, scope: controller.getState().snapshot?.scope }), notesSafeInsertionLink), [editor, controller]);
  const projectedDocument = useRef<string | undefined>(undefined);
  const appliedDocument = useRef<string | undefined>(undefined);
  if (projectedDocument.current === undefined) projectedDocument.current = JSON.stringify(fromBlockNote(editor.document as never));
  if (appliedDocument.current === undefined) appliedDocument.current = JSON.stringify(initial.current);
  const feedback = useNotesFeedback();
  const applying = useRef(false), index = useMemo(() => { const next = createDocumentIndex(); next.replaceFromBlocks(initial.current.blocks); return next; }, []);
  const searchIdentity = () => { const snapshot = controller.getState().snapshot; return JSON.stringify([snapshot?.scope, snapshot?.target, snapshot?.revision, snapshot?.contentRevision]); };
  const appliedSearchIdentity = useRef(searchIdentity());
  const renderedSearchIdentity = searchIdentity();
  const search = useMemo(() => createNotesSearchPlugin(), [editor]);
  useEffect(() => {
    editor._tiptapEditor.registerPlugin(search.plugin);
    const dom = editor._tiptapEditor.view.dom;
    const blurSearch = () => { if (search.key.getState(editor._tiptapEditor.state)?.query) editor.getExtension(FormattingToolbarExtension)?.store.setState(false); };
    dom?.addEventListener("blur", blurSearch);
    return () => { dom?.removeEventListener("blur", blurSearch); editor._tiptapEditor.unregisterPlugin(search.key); };
  }, [editor, search]);
  const root = useRef<HTMLDivElement>(null), dropFlight = useRef<AbortController | null>(null);
  const linkCompositionSignal = useMemo(() => notesNativeLinkCompositionSignal(controller), [controller]);
  const linkInputComposition = useMemo(() => createNotesLinkInputComposition(() => root.current, () => JSON.stringify([searchIdentity(), linkPolicy.current.insertion?.scope]), linkCompositionSignal.notify), [controller, linkCompositionSignal]);
  useEffect(() => restrictNativeLinks ? linkCompositionSignal.register(() => linkInputComposition.composing) : undefined, [linkCompositionSignal, linkInputComposition, restrictNativeLinks]);
  const renderedLinkInputIdentity = JSON.stringify([renderedSearchIdentity, props.insertion?.scope]);
  useEffect(() => { linkInputComposition.clear(); return () => linkInputComposition.clear(); }, [linkInputComposition, renderedLinkInputIdentity]);
  const [dropAnchor, setDropAnchor] = useState<NotesInsertionAnchor>(), [dropMessage, setDropMessage] = useState("");
  const insertionLocation = useRef<{ identity: string; anchor: NotesInsertionAnchor } | undefined>(undefined);
  const bodyIntent = useRef(false), resultTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [insertedId, setInsertedId] = useState<string>();
  const insertionIdentity = () => JSON.stringify([notesPanelIdentity(controller, controller.getState().snapshot), controller.getDraftSessionId?.()]);
  const renderedInsertionIdentity = insertionIdentity();
  useEffect(() => { insertionLocation.current = undefined; bodyIntent.current = false; setDropAnchor(undefined); setInsertedId(undefined); clearTimeout(resultTimer.current); }, [renderedInsertionIdentity]);
  const rememberCaret = () => {
    if (!bodyIntent.current || controller.getState().composing) return;
    try { const id = editor.getTextCursorPosition().block.id; if (editor.getBlock(id)) insertionLocation.current = { identity: insertionIdentity(), anchor: { blockId: id, placement: "after" } }; } catch { /* No actual caret. */ }
  };
  const insertionAnchor = (): NotesInsertionAnchor | undefined => {
    const value = insertionLocation.current;
    return value?.identity === insertionIdentity() && editor.getBlock(value.anchor.blockId) ? { ...value.anchor } : undefined;
  };
  const emptyToReplace = useRef<{ id: string; identity: string } | undefined>(undefined);
  const publishInsertion = (ids: readonly string[]) => {
    if (!ids.length || ids.some(id => !editor.getBlock(id))) throw new Error("Insertion was not confirmed");
    const replace = emptyToReplace.current; emptyToReplace.current = undefined;
    if (replace && replace.identity === insertionIdentity() && !ids.includes(replace.id)) {
      const old = editor.getBlock(replace.id);
      if (old?.type === "paragraph" && Array.isArray(old.content) && old.content.length === 0 && !old.children?.length) editor.removeBlocks([old]);
    }
    // The same local body writer as onChange; never another persistence path.
    const next = fromBlockNote(editor.document as never), encoded = JSON.stringify(next);
    projectedDocument.current = encoded; appliedDocument.current = encoded; index.replaceFromBlocks(next.blocks); controller.setDraft(next);
    const id = ids[0]!;
    insertionLocation.current = { identity: insertionIdentity(), anchor: { blockId: id, placement: "after" } };
    setDropAnchor(undefined); setInsertedId(id); clearTimeout(resultTimer.current);
    resultTimer.current = setTimeout(() => setInsertedId(undefined), 3000);
    const resultIdentity = insertionIdentity();
    requestAnimationFrame(() => {
      if (!lifetime.current || resultIdentity !== insertionIdentity() || !editor.getBlock(id)) return;
      const element = [...(root.current?.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]") ?? [])].find(node => node.dataset.id === id);
      element?.scrollIntoView({ block: "nearest", behavior: "instant" });
      try { const block = editor.getBlock(id); const firstText = block?.content !== undefined ? id : block?.children?.flatMap(column => column.children ?? []).find(child => child.content !== undefined)?.id;
        if (firstText) { editor.setTextCursorPosition(firstText, "start"); editor.focus(); } } catch { /* Non-text widgets stay visible without a fake caret. */ }
    });
  };
  useEffect(() => () => clearTimeout(resultTimer.current), []);
  useEffect(() => subscribeNotesToolDrags(() => { if (!currentNotesToolDrag(notesPanelIdentity(controller, controller.getState().snapshot))) setDropAnchor(undefined); }), [controller]);
  useEffect(() => () => { dropFlight.current?.abort(); }, []);
  const separateHistory = () => editor.prosemirrorView.dispatch(closeHistory(editor.prosemirrorState.tr));
  const [insertRequest, setInsertRequest] = useState<NotesInsertRequest | null>(null);
  const [plusBlock, setPlusBlock] = useState<{ id: string; identity: string }>();
  useEffect(() => setPlusBlock(undefined), [renderedInsertionIdentity]);
  const [choice, setChoice] = useState<{ kind: "htmlEmbed" | "tableInsert" } | null>(null);
  const choicePending = useRef<{ resolve(options: NotesInsertOptions): void; reject(error: Error): void } | null>(null);
  const closeChoice = (options?: NotesInsertOptions) => { const pending = choicePending.current; choicePending.current = null; setChoice(null); if (options) pending?.resolve(options); else { emptyToReplace.current = undefined; setDropAnchor(undefined); pending?.reject(new Error("Insertion cancelled")); } };
  useEffect(() => () => { choicePending.current?.reject(new Error("Insertion cancelled")); choicePending.current = null; }, []);
  const insertionPending = useRef<{ resolve(): void; reject(error: Error): void } | null>(null);
  const selectionGeneration = useRef(0);
  const lifetime = useRef(true), activeBridge = useRef<NotesEditorBridge | undefined>(undefined);
  useEffect(() => { lifetime.current = true; return () => { lifetime.current = false; }; }, []);
  const selectionListeners = useRef(new Set<() => void>());
  useEffect(() => editor.onSelectionChange(() => { selectionGeneration.current++; rememberCaret(); for (const listener of selectionListeners.current) listener(); }), [editor]);
  useEffect(() => () => { insertionPending.current?.reject(new Error("Insertion cancelled")); insertionPending.current = null; }, []);
  const stateRef = useRef(state); stateRef.current = state;
  const editable = notesDocumentEditingAvailable(state);
  useEffect(() => { editor.isEditable = editable; }, [editor, editable]);
  useEffect(() => {
    if (!restrictNativeLinks) return;
    const readPolicy = () => ({ insertion: linkPolicy.current.insertion, scope: controller.getState().snapshot?.scope });
    const blockPolicy = createNotesLinkBlockPolicy(readPolicy);
    editor._tiptapEditor.registerPlugin(blockPolicy);
    const linkCommandsAvailable = () => {
      const live = controller.getState(), insertion = linkPolicy.current.insertion, scope = live.snapshot?.scope;
      const selectedBlocks = editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block];
      return lifetime.current && !linkInputComposition.composing && notesLinkSelectionAllowed(insertion, selectedBlocks.map(block => block.type), notesLinkBlocksHaveHardBreaks(selectedBlocks)) && appliedSearchIdentity.current === searchIdentity() && !!scope && !!insertion && scope.actorId === insertion.scope.actorId && scope.workspaceId === insertion.scope.workspaceId && (insertion.pickerInsertKinds === undefined || insertion.pickerInsertKinds.includes("link")) && live.status === "ready" && notesDocumentEditingAvailable(live) && !live.composing && !live.pendingEditors && !live.recovery && !live.manualSaveRequired;
    };
    const restore = guardNotesLinkCommands(editor,
      notesLinkValidator(() => ({ insertion: linkPolicy.current.insertion, scope: controller.getState().snapshot?.scope }), editorOptions.links?.isValidLink),
      linkCommandsAvailable, text => linkPolicy.current.insertion?.allowLinkHardBreaks !== false || !/[\r\n]/.test(text));
    const restoreShortcut = guardNotesLinkShortcut(editor._tiptapEditor.view.dom, linkCommandsAvailable);
    return () => { restoreShortcut(); restore(); editor._tiptapEditor.unregisterPlugin(blockPolicy.spec.key!); };
  }, [editor, controller, restrictNativeLinks, linkInputComposition]);
  const textAlignmentAccess = (): NotesTextAlignmentAccess => {
    const live = controller.getState();
    let selected: NotesTextAlignmentAccess["selected"] = [];
    try { selected = editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block]; } catch { /* Missing/stale native selection fails closed. */ }
    return { insertion: linkPolicy.current.insertion, scope: live.snapshot?.scope, selected, applying: applying.current,
      available: lifetime.current && activeBridge.current?.commandsAvailable === true && !linkInputComposition.composing
        && appliedSearchIdentity.current === searchIdentity() && appliedDocument.current === JSON.stringify(live.draft ?? live.snapshot?.document) };
  };
  const textAlignmentContext = () => linkPolicy.current.insertion?.nativeFormattingItems === undefined || notesTextAlignmentAccessAllowed(textAlignmentAccess());
  useEffect(() => {
    const policy = createNotesTextAlignmentPolicy(textAlignmentAccess);
    editor._tiptapEditor.registerPlugin(policy);
    return () => { editor._tiptapEditor.unregisterPlugin(policy.spec.key!); };
  }, [editor, controller, linkInputComposition]);
  useEffect(() => {
    const policy = createNotesInlineColorPolicy(() => ({ insertion: linkPolicy.current.insertion, scope: controller.getState().snapshot?.scope }));
    editor._tiptapEditor.registerPlugin(policy);
    return () => { editor._tiptapEditor.unregisterPlugin(policy.spec.key!); };
  }, [editor, controller]);
  useEffect(() => editor.onChange(() => {
    if (applying.current) return;
    const next = fromBlockNote(editor.document as never), encoded = JSON.stringify(next);
    if (encoded === projectedDocument.current) return;
    projectedDocument.current = encoded; appliedDocument.current = encoded;
    index.replaceFromBlocks(next.blocks); controller.setDraft(next);
  }), [editor, index, controller]);
  useEffect(() => {
    const next = state.draft ?? state.snapshot?.document;
    if (!next || state.composing) return;
    if (appliedDocument.current === JSON.stringify(next)) { appliedSearchIdentity.current = renderedSearchIdentity; return; }
    applying.current = true;
    try { editor.replaceBlocks(editor.document, toBlockNoteForSchema(next, props.preset.schema) as never); appliedDocument.current = JSON.stringify(next); projectedDocument.current = JSON.stringify(fromBlockNote(editor.document as never)); index.replaceFromBlocks(next.blocks); appliedSearchIdentity.current = renderedSearchIdentity; }
    finally { applying.current = false; }
  }, [state.draft, renderedSearchIdentity, state.composing, editor, index]);
  const coeditingOptions = useRef(props.coediting); coeditingOptions.current = props.coediting;
  const coeditingCallback = useRef(props.coediting?.onReady); coeditingCallback.current = props.coediting?.onReady;
  const coediting = useMemo(() => props.coediting ? createDocumentCoeditingSession(editor, {
    access() {
      const live = controller.getState(), snapshot = live.snapshot;
      const identity = { actorId: snapshot?.scope.actorId ?? "", workspaceId: snapshot?.scope.workspaceId ?? "", documentKey: snapshot ? notesTargetKey(snapshot.target) : "", paneId: props.coediting!.paneId, sessionId: String(controller.getDraftSessionId?.() ?? "unversioned"), revision: snapshot?.revision ?? "", contentRevision: snapshot?.contentRevision ?? "" };
      return { identity, autoPolicy: coeditingOptions.current?.autoPolicy?.(identity), available: lifetime.current && live.status === "ready" && notesDocumentEditingAvailable(live) && !live.recovery && !live.pendingEditors && !live.manualSaveRequired, composing: live.composing, blockedReason: "Review the current save, recovery or retained input before applying a suggestion" };
    },
    onApplied() {
      // Synchronous publication through the same local body writer. The existing
      // onChange listener may already have published this exact value (a no-op).
      const next = fromBlockNote(editor.document as never), encoded = JSON.stringify(next);
      projectedDocument.current = encoded; appliedDocument.current = encoded; index.replaceFromBlocks(next.blocks); controller.setDraft(next);
    }
  }) : undefined, [editor, controller, index, props.coediting?.paneId, Boolean(props.coediting)]);
  useEffect(() => {
    if (!coediting) return;
    editor.registerExtension(coediting.extension); coeditingCallback.current?.(coediting.port);
    return () => { coeditingCallback.current?.(undefined); coediting.dispose(); editor.unregisterExtension("openeditor-document-coediting"); };
  }, [editor, coediting]);
  useEffect(() => { coediting?.syncAccess(); }, [coediting, state.snapshot, state.status, state.composing, state.pendingEditors, state.manualSaveRequired]);
  const pickerEditor = useMemo<NotesInsertEditor>(() => ({
    installedBlockTypes: Object.keys(props.preset.schema.blockSchema),
    getSelectedBlockId: () => editor.getTextCursorPosition().block.id,
    getSelectionFingerprint: () => JSON.stringify([selectionGeneration.current, editor.getSelection()?.blocks.map(block => block.id), editor.getTextCursorPosition().block.id]),
    getSelectedText: () => editor.getSelectedText(),
    getSelectedBlockTypes: () => (editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block]).map(block => block.type),
    getSelectedBlocksHaveHardBreaks: () => notesLinkBlocksHaveHardBreaks(editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block]),
    insertBlocks(blocks, afterBlockId, signal, placement = "after") { if (signal.aborted || stateRef.current.status !== "ready" || stateRef.current.composing || stateRef.current.pendingEditors || stateRef.current.recovery || stateRef.current.manualSaveRequired || !editor.getBlock(afterBlockId)) throw new Error("Insertion changed"); separateHistory(); const inserted = editor.insertBlocks(toBlockNoteForSchema(createEditorDocument([...blocks]), props.preset.schema) as never, afterBlockId, placement); publishInsertion(inserted.map(block => block.id)); separateHistory(); },
    insertLink(href, label, signal) {
      const live = controller.getState(), insertion = linkPolicy.current.insertion;
      const selectedBlocks = editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block];
      if (!lifetime.current || signal.aborted || appliedSearchIdentity.current !== searchIdentity() || live.status !== "ready" || !notesDocumentEditingAvailable(live) || live.composing || live.pendingEditors || live.recovery || live.manualSaveRequired || !pickerLinkValidator(href) || !label.length || insertion?.allowLinkHardBreaks === false && /[\r\n]/.test(label) || !notesLinkSelectionAllowed(insertion, selectedBlocks.map(block => block.type), notesLinkBlocksHaveHardBreaks(selectedBlocks))) throw new Error("Insertion changed");
      separateHistory(); createPickerLink(href, label === editor.getSelectedText() ? undefined : label); separateHistory(); publishInsertion([editor.getTextCursorPosition().block.id]);
    }
  }), [editor, props.preset]);
  const bridge: NotesEditorBridge = useMemo<NotesEditorBridge>(() => {
    const types = Object.keys(props.preset.schema.blockSchema);
    const insertKinds = NOTES_INSERT_CATALOG.filter(entry => entry.kind === "columns" ? types.includes("oeColumns") && types.includes("oeColumn") : !!INSERT_TYPES[entry.kind] && types.includes(INSERT_TYPES[entry.kind]!)).map(entry => entry.kind);
    const pickerKinds = () => notesSupportedPickerInsertKinds({ controller, host: props.preset.host, editor: pickerEditor, insertion: props.insertion, media: props.media });
    const availableInsertKinds = () => {
      const restriction = props.insertion?.localInsertKinds, snapshot = controller.getState().snapshot;
      const sameHost = snapshot?.scope.actorId === props.insertion?.scope.actorId && snapshot?.scope.workspaceId === props.insertion?.scope.workspaceId;
      return [...(restriction === undefined ? insertKinds : sameHost ? insertKinds.filter(kind => restriction.includes(kind)) : []), ...pickerKinds()];
    };
    const formatKinds = NOTES_STYLE_CATALOG.filter(entry => !FORMAT_TYPES[entry.kind] || types.includes(FORMAT_TYPES[entry.kind]!)).map(entry => entry.kind);
    const sameInsertionHost = () => { const scope = controller.getState().snapshot?.scope; return !!scope && scope.actorId === props.insertion?.scope.actorId && scope.workspaceId === props.insertion?.scope.workspaceId; };
    const availableFormatKinds = () => { const allowed = props.insertion?.localStyleKinds; const available = allowed === undefined ? formatKinds : sameInsertionHost() ? formatKinds.filter(kind => allowed.includes(kind)) : []; return available.filter(kind => !kind.startsWith("align") || textAlignmentContext()); };
    const assert = (signal?: AbortSignal) => { const live = controller.getState(); if (!lifetime.current || activeBridge.current !== bridge || signal?.aborted || !live.snapshot?.capabilities.includes("document.save") || live.status !== "ready" || live.composing || live.recovery || live.manualSaveRequired) throw new Error("Editing unavailable"); };
    const selected = () => editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block];
    const captures = new Map<string, { selection: NotesTextSelection; fingerprint: string; document: string }>();
    let undo: { id: string; identity: string; before: ReturnType<typeof fromBlockNote>; after: string } | undefined;
    const identity = () => { const snapshot = controller.getState().snapshot; return JSON.stringify([snapshot?.scope, snapshot?.target, snapshot?.revision, snapshot?.contentRevision]); };
    const documentKey = () => { const live = controller.getState(); return JSON.stringify(live.draft ?? live.snapshot?.document); };
    const rangeKey = () => JSON.stringify([selectionGeneration.current, editor.getSelectedText(), selected().map(block => block.id)]);
    const isSelectionCurrent = (selection: NotesTextSelection): boolean => {
      try {
        const captured = captures.get(selection.id), latest = controller.getState().snapshot;
        return lifetime.current && activeBridge.current === bridge && !!captured && !!latest && JSON.stringify(captured.selection) === JSON.stringify(selection) && latest.revision === selection.revision && latest.contentRevision === selection.contentRevision && latest.scope.actorId === selection.scope.actorId && latest.scope.workspaceId === selection.scope.workspaceId && notesTargetKey(latest.target) === notesTargetKey(selection.target) && captured.fingerprint === rangeKey() && captured.document === documentKey();
      } catch { return false; }
    };
    return {
      index, coediting: coediting?.port, installedBlockTypes: types, get supportedInsertActions() { return availableInsertKinds(); }, get supportedStyleActions() { return availableFormatKinds(); },
      get supportedNativeFormattingItems() {
        const allowed = props.insertion?.nativeFormattingItems, blockTypes = props.insertion?.nativeFormattingBlockTypes;
        const linkContext = notesLinkSelectionAllowed(props.insertion, selected().map(block => block.type), notesLinkBlocksHaveHardBreaks(selected()));
        const colorContext = appliedSearchIdentity.current === searchIdentity() && notesInlineColorSelectionAllowed(props.insertion, selected().map(block => block.type), notesLinkBlocksHaveHardBreaks(selected()));
        if (allowed === undefined) return linkContext && colorContext ? undefined : [...getFormattingToolbarItems().map(item => String(item.key)).filter(key => (key !== "createLinkButton" || linkContext) && (key !== "colorStyleButton" || colorContext)), "blockColors"];
        return sameInsertionHost() && (!blockTypes || selected().every(block => blockTypes.includes(block.type))) ? allowed.filter(key => (key !== "createLinkButton" || linkContext) && (key !== "colorStyleButton" || colorContext) && notesTextAlignmentItemAllowed(key, textAlignmentContext())) : [];
      },
      getSelectedBlockId() { return editor.getTextCursorPosition().block.id; },
      subscribeSelection(listener) { selectionListeners.current.add(listener); return () => { selectionListeners.current.delete(listener); }; },
      getSelectionVersion: () => selectionGeneration.current,
      hasFormattingSelection() { try { return notesFormattingSelectionAvailable(editor._tiptapEditor.state); } catch { return false; } },
      hasTextSelection() { try { return selected().length === 1 && !!editor.getSelectedText().trim(); } catch { return false; } },
      focusEditor() { editor.focus(); },
      showSelectionToolbar() { if (bridge.commandsAvailable && !controller.getState().composing && bridge.hasFormattingSelection?.()) editor.getExtension(FormattingToolbarExtension)?.store.setState(true); },
      getSelectionIdentity() {
        try { const range = editor._tiptapEditor.state.selection; return range.empty ? undefined : JSON.stringify([selected().map(block => block.id), range.from, range.to]); } catch { return undefined; }
      },
      getInputBounds() {
        try {
          const view = editor._tiptapEditor.view;
          if (!view.hasFocus()) return undefined;
          const point = view.coordsAtPos(view.state.selection.head);
          return { left: point.left, top: point.top, right: Math.max(point.left + 2, point.right), bottom: point.bottom };
        } catch { return undefined; }
      },
      getSelectionBounds() {
        try {
          const view = editor._tiptapEditor.view, range = view.state.selection;
          if (range.empty || selected().length !== 1) return undefined;
          const start = view.coordsAtPos(range.from), end = view.coordsAtPos(range.to);
          return { left: Math.min(start.left, end.left), top: start.top, right: Math.max(start.right, end.right), bottom: end.bottom };
        } catch { return undefined; }
      },
      captureSelection() {
        try {
          assert(); const latest = controller.getState(), snapshot = latest.snapshot!, blocks = selected(), text = editor.getSelectedText();
          if (latest.pendingEditors || latest.recovery || latest.manualSaveRequired || blocks.length !== 1 || !text.trim() || text.length > 50000 || !Array.isArray(blocks[0]!.content)) return undefined;
          const selection: NotesTextSelection = { id: crypto.randomUUID(), scope: snapshot.scope, target: snapshot.target, revision: snapshot.revision, contentRevision: snapshot.contentRevision, blockId: blocks[0]!.id, text };
          captures.clear(); captures.set(selection.id, { selection, fingerprint: rangeKey(), document: documentKey() }); return selection;
        } catch { return undefined; }
      },
      isSelectionCurrent,
      replaceSelection(selection, text, localDraftId, expectedLocalDraft) {
        assert(); const latest = controller.getState(), retained = latest.localDrafts[localDraftId];
        if (!isSelectionCurrent(selection) || !text.trim() || text.length > 50000 || latest.recovery || latest.manualSaveRequired || Object.keys(latest.localDrafts).some(key => key !== localDraftId) || !retained || typeof retained !== "object" || Array.isArray(retained) || retained.kind !== "selection" || JSON.stringify(retained) !== expectedLocalDraft || JSON.stringify(retained.selection) !== JSON.stringify(selection) || retained.proposal !== text) throw new Error("Selection changed");
        const before = latest.draft ?? latest.snapshot!.document, beforeIdentity = identity();
        editor.insertInlineContent(text, { updateSelection: true });
        // Publish synchronously through the existing body writer, never a second save path.
        const next = fromBlockNote(editor.document as never); projectedDocument.current = JSON.stringify(next); appliedDocument.current = projectedDocument.current; index.replaceFromBlocks(next.blocks); controller.setDraft(next);
        undo = { id: selection.id, identity: beforeIdentity, before, after: JSON.stringify(next) }; captures.clear();
      },
      undoSelection(id) {
        assert(); const latest = controller.getState();
        if (!undo || undo.id !== id || identity() !== undo.identity || latest.pendingEditors || latest.recovery || latest.manualSaveRequired || JSON.stringify(latest.draft ?? latest.snapshot?.document) !== undo.after) return false;
        controller.setDraft(undo.before); undo = undefined; return true;
      },
      contentCodecs: {
        async parse(format, source, signal) { assert(signal); const blocks = format === "markdown" ? await editor.tryParseMarkdownToBlocks(source) : format === "html" ? await editor.tryParseHTMLToBlocks(source) : undefined; assert(signal); if (!blocks) throw new Error("Use the public JSON codec"); return fromBlockNote(blocks as never); },
        async serialize(format, document, signal) { if (signal.aborted) throw new Error("Cancelled"); const blocks = toBlockNoteForSchema(document, props.preset.schema) as never; const result = format === "markdown" ? await editor.blocksToMarkdownLossy(blocks) : format === "html" ? await editor.blocksToFullHTML(blocks) : undefined; if (signal.aborted || result === undefined) throw new Error("Export unavailable"); return result; }
      },
      async acceptAsset(asset, scope, signal, presentation = "compact") {
        assert(signal); const snapshot = stateRef.current.snapshot!;
        if (scope.scope.actorId !== snapshot.scope.actorId || scope.scope.workspaceId !== snapshot.scope.workspaceId || notesTargetKey(scope.target) !== notesTargetKey(snapshot.target) || !editor.getBlock(scope.blockId) || !notesSafeAssetUrl(asset.url)) throw new Error("Asset scope changed");
        const type = asset.kind === "image" || asset.kind === "video" || asset.kind === "audio" ? asset.kind : "file";
        if (!types.includes(type)) throw new Error("Asset type unavailable");
        separateHistory(); const inserted = editor.insertBlocks([{ type, props: { url: asset.url, name: asset.name, showPreview: presentation === "card" } }] as never, scope.blockId, scope.placement ?? "after"); publishInsertion(inserted.map(block => block.id)); separateHistory();
      },
      get editable() { return notesDocumentEditingAvailable(controller.getState()); },
      get composing() { return stateRef.current.composing; },
      get commandsAvailable(): boolean { const live = controller.getState(); return lifetime.current && activeBridge.current === bridge && notesDocumentEditingAvailable(live) && live.status === "ready" && !live.composing && !live.pendingEditors && !live.recovery && !live.manualSaveRequired; },
      focusBlock(id) { editor.setTextCursorPosition(id, "start"); editor.focus(); },
      setSearchQuery(query) {
        if (!lifetime.current || activeBridge.current !== bridge || appliedSearchIdentity.current !== searchIdentity()) return { count: 0, capped: false };
        const tiptap = editor._tiptapEditor, current = search.key.getState(tiptap.state);
        if (current && current.query !== query.trim()) tiptap.view.dispatch(tiptap.state.tr.setMeta(search.key, query).setMeta("addToHistory", false));
        const result = search.key.getState(tiptap.state);
        if (result?.query) editor.getExtension(FormattingToolbarExtension)?.store.setState(false);
        return { count: result?.ranges.length ?? 0, capped: result?.capped ?? false };
      },
      focusSearchMatch(index) {
        if (!lifetime.current || activeBridge.current !== bridge || appliedSearchIdentity.current !== searchIdentity() || controller.getState().composing) return false;
        const tiptap = editor._tiptapEditor, selection = search.selection(tiptap.state, index);
        if (!selection) return false;
        tiptap.view.dispatch(tiptap.state.tr.setSelection(selection).setMeta("addToHistory", false).scrollIntoView()); editor.focus(); return true;
      },
      toggleTask(id) { assert(); const block = editor.getBlock(id); if (!block || block.type !== "checkListItem") throw new Error("Not a checklist"); editor.updateBlock(block, { props: { checked: !block.props.checked } } as never); },
      async requestInsert(kind, signal, options): Promise<void> {
        assert(signal);
        if (choicePending.current || insertionPending.current || controller.getState().pendingEditors) throw new Error("Finish the current input first");
        if (!availableInsertKinds().includes(kind)) throw new Error("Insertion unavailable");
        const anchor = options?.anchor ?? insertionAnchor();
        if (!anchor || !editor.getBlock(anchor.blockId)) throw new Error("本文の挿入位置をクリックしてから、もう一度挿入してください");
        const capturedIdentity = insertionIdentity(), capturedDocument = JSON.stringify(editor.document);
        let chosen = options;
        if (kind === "htmlEmbed" && !options?.html || kind === "tableInsert" && !options?.table) {
          setDropAnchor(anchor);
          const cancel = () => closeChoice();
          try {
            signal.addEventListener("abort", cancel, { once: true });
            chosen = { ...options, ...await new Promise<NotesInsertOptions>((resolve, reject) => { choicePending.current = { resolve, reject }; setChoice({ kind: kind as "htmlEmbed" | "tableInsert" }); }) };
          } finally { signal.removeEventListener("abort", cancel); }
        }
        assert(signal);
        if (capturedIdentity !== insertionIdentity() || capturedDocument !== JSON.stringify(editor.document)) { setDropAnchor(undefined); throw new Error("Insertion changed"); }
        return bridge.insert(kind, signal, { ...chosen, anchor });
      },
      async insert(kind, signal, options): Promise<void> {
        assert(signal); if (insertionPending.current || controller.getState().pendingEditors) throw new Error("Finish the current input first"); if (!availableInsertKinds().includes(kind)) throw new Error("Insertion unavailable");
        const anchor = options?.anchor ?? insertionAnchor();
        if (!anchor) throw new Error("本文の挿入位置をクリックしてから、もう一度挿入してください");
        const cursor = editor.getBlock(anchor.blockId);
        if (!cursor || anchor && !["before", "after"].includes(anchor.placement)) throw new Error("Drop location changed");
        const placement = anchor?.placement ?? "after";
        emptyToReplace.current = undefined;
        if (options?.replaceEmptyBlockId === cursor.id && cursor.type === "paragraph" && Array.isArray(cursor.content) && cursor.content.length === 0 && !cursor.children?.length) emptyToReplace.current = { id: cursor.id, identity: insertionIdentity() };
        if (pickerKinds().includes(kind as never)) {
          if (anchor) { if (kind !== "link" || !editor.getSelectedText().length) editor.setTextCursorPosition(cursor.id, placement === "before" ? "start" : "end"); setDropAnchor(anchor); }
          if (insertionPending.current) throw new Error("An insertion is already open");
          return await new Promise<void>((resolve, reject) => { insertionPending.current = { resolve, reject }; setInsertRequest({ id: crypto.randomUUID(), kind: kind as NotesInsertRequest["kind"], signal, ...(anchor ? { anchor } : {}) }); });
        }
        separateHistory();
        if (kind === "columns") { const columns = createDocumentColumns([[{ id: crypto.randomUUID(), type: "paragraph", content: "" }], [{ id: crypto.randomUUID(), type: "paragraph", content: "" }]]); const inserted = editor.insertBlocks(toBlockNoteForSchema(createEditorDocument([columns]), props.preset.schema) as never, cursor, placement); publishInsertion(inserted.map(block => block.id)); separateHistory(); return; }
        const type = INSERT_TYPES[kind]!;
        const propsFor = kind === "htmlEmbed" ? { title: "HTML widget", ...(options?.html?.empty ? HTML_WIDGET_PRESETS[0]! : HTML_WIDGET_PRESETS.find(preset => preset.id === "modern")!).source } : {};
        const rows = options?.table?.rows ?? 2, columns = options?.table?.columns ?? 2;
        if (type === "table" && ![rows, columns].every(value => Number.isInteger(value) && value >= 1 && value <= 5)) throw new Error("Table size must be between 1 and 5");
        const block = type === "table" ? { type, content: { type: "tableContent", rows: Array.from({ length: rows }, () => ({ cells: Array.from({ length: columns }, () => []) })) } } : { type, props: propsFor };
        const inserted = editor.insertBlocks([block] as never, cursor, placement); publishInsertion(inserted.map(block => block.id)); separateHistory();
      },
      format(kind, signal) {
        assert(signal); if (!availableFormatKinds().includes(kind)) throw new Error("Formatting unavailable");
        const blocks = selected(), type = FORMAT_TYPES[kind];
        if (type) { editor.updateBlock(blocks[0]!, { type, ...(kind === "heading" ? { props: { level: 2 } } : {}) } as never); return; }
        if (kind.startsWith("align")) {
          const alignment = kind === "alignLeft" ? "left" : kind === "alignCenter" ? "center" : "right";
          separateHistory();
          try { editor.transact(transaction => {
            const before = transaction.doc;
            blocks.forEach(block => editor.updateBlock(block, { props: { textAlignment: alignment } } as never));
            if (transaction.doc.eq(before)) transaction.setMeta("addToHistory", false);
          }); } finally { separateHistory(); }
          return;
        }
        if (kind === "indent") { editor.nestBlock(); return; } if (kind === "outdent") { editor.unnestBlock(); return; }
        const styles: Partial<Record<NotesStyleKind, Record<string, string>>> = { fontSans: { fontFamily: "sans" }, fontSerif: { fontFamily: "serif" }, fontMono: { fontFamily: "mono" }, textSmall: { fontSize: "small" }, textLarge: { fontSize: "large" } };
        if (styles[kind]) { editor.addStyles(styles[kind]!); return; }
        if (kind === "clearFormatting") { editor.removeStyles(editor.getActiveStyles()); return; }
        const live = controller.getState();
        if (appliedSearchIdentity.current !== searchIdentity() || JSON.stringify(live.draft ?? live.snapshot?.document) !== appliedDocument.current) throw new Error("Document changed");
        const all = editor.document, first = blocks[0]!;
        const moved = notesMoveBlock(all, first.id, kind as NotesBlockMove);
        if (moved === all) return;
        editor.replaceBlocks(all, moved as never); editor.setTextCursorPosition(first.id);
      }
    };
  }, [coediting, editor, index, props.preset, props.insertion, props.media, pickerEditor, search]);
  activeBridge.current = bridge;
  useEffect(() => { props.onBridge(bridge); }, [bridge, props.onBridge]);
  const slashReady = useRef(false), plusAnchor = useRef<{ blockId: string; placement: "after" } | undefined>(undefined);
  const onSlashReady = useMemo(() => (ready: boolean) => { slashReady.current = ready; }, []);
  useEffect(() => {
    const menu = editor.getExtension(SuggestionMenu);
    return menu?.store.subscribe(({ currentVal }) => { if (!currentVal?.show) { plusAnchor.current = undefined; if (!choicePending.current && !insertionPending.current) setDropAnchor(undefined); } });
  }, [editor]);
  const onAdd = (blockId: string) => {
    if (!bridge.editable || bridge.composing || bridge.commandsAvailable === false || choicePending.current || insertionPending.current) return;
    const block = editor.getBlock(blockId); if (!block) return;
    const anchor: NotesInsertionAnchor = { blockId, placement: "after" };
    insertionLocation.current = { identity: insertionIdentity(), anchor };
    if (!slashReady.current) {
      const empty = Array.isArray(block.content) && block.content.length === 0;
      const target = empty ? block : editor.insertBlocks([{ type: "paragraph" }], block, "after")[0]!;
      editor.setTextCursorPosition(target); editor.focus(); editor.getExtension(SuggestionMenu)?.openSuggestionMenu("/"); return;
    }
    if (!Array.isArray(block.content)) { setDropAnchor(anchor); setPlusBlock({ id: blockId, identity: insertionIdentity() }); return; }
    plusAnchor.current = { blockId, placement: "after" };
    setDropAnchor(anchor); try { editor.setTextCursorPosition(blockId, "end"); } catch { /* Non-text + keeps its explicit block anchor. */ } editor.focus();
    editor.getExtension(FormattingToolbarExtension)?.store.setState(false);
    editor.getExtension(SuggestionMenu)?.openSuggestionMenu("/", { ignoreQueryLength: true });
  };
  const sideMenu = <DocumentSideMenuController onAdd={onAdd} canAdd={bridge.commandsAvailable} />;
  const slashMenu = <NotesSlashMenuController bridge={bridge} onReady={onSlashReady} getPlusAnchor={() => plusAnchor.current} language={(!props.preset.config.locale || props.preset.config.locale.toLowerCase().startsWith("ja")) ? "ja" : "en"} onError={message => feedback ? feedback.announce(message, "error") : setDropMessage(message)} />;
  const acceptsDrop = () => {
    const live = controller.getState();
    return !!currentNotesToolDrag(notesPanelIdentity(controller, live.snapshot)) && bridge.editable && !live.composing && !live.pendingEditors && !live.recovery && !live.manualSaveRequired && !dropFlight.current && !insertionPending.current;
  };
  return <EditorDraftLifecycleProvider controller={controller}><div ref={root} className="oe-notes-blocknote-document" data-notes-restricted-links={restrictNativeLinks || undefined} data-notes-restricted-colors={props.insertion?.nativeFormattingItems?.includes("colorStyleButton") || undefined} onPointerMoveCapture={event => {
    if (!root.current || stateRef.current.composing || event.target instanceof Element && event.target.closest("button,input,textarea,select,summary,.oe-document-columns-menu-panel")) return;
    const anchor = notesDropAnchor(root.current, event.target, event.clientX, event.clientY);
    if (anchor) { insertionLocation.current = { identity: insertionIdentity(), anchor };  }
  }} onPointerDownCapture={event => {
    if (event.target instanceof Element && !event.target.closest("button,input,textarea,select,summary")) { bodyIntent.current = true; }
  }} onKeyDownCapture={event => {
    if (restrictNativeLinks && event.key === "Enter" && linkInputComposition.accepts(event.target) && (linkInputComposition.composing || event.nativeEvent.isComposing || event.keyCode === 229)) { event.stopPropagation(); return; }
    if (event.target instanceof Element && event.target.closest(".bn-editor") && !event.target.closest("input,textarea,select,button,summary")) { bodyIntent.current = true; rememberCaret(); setDropAnchor(undefined); }
  }} onSubmitCapture={event => {
    if (restrictNativeLinks && linkInputComposition.composing && event.target instanceof Element && event.target.closest(".bn-popover-content.bn-form-popover")) { event.preventDefault(); event.stopPropagation(); }
  }} onBlurCapture={event => {
    if (restrictNativeLinks) linkInputComposition.blur(event.target);
  }} onDragOverCapture={event => {
    if (!event.dataTransfer.types.includes(NOTES_TOOL_DRAG_MIME)) return;
    event.preventDefault(); event.stopPropagation();
    if (!acceptsDrop() || !root.current) { event.dataTransfer.dropEffect = "none"; setDropAnchor(undefined); return; }
    event.dataTransfer.dropEffect = "copy";
    const next = notesDropAnchor(root.current, event.target, event.clientX, event.clientY);
    setDropAnchor(old => old?.blockId === next?.blockId && old?.placement === next?.placement ? old : next);
  }} onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropAnchor(undefined); }} onDropCapture={event => {
    if (!event.dataTransfer.types.includes(NOTES_TOOL_DRAG_MIME)) return;
    event.preventDefault(); event.stopPropagation(); setDropAnchor(undefined);
    if (!acceptsDrop() || !root.current) return;
    const live = controller.getState(), kind = consumeNotesToolDrag(event.dataTransfer.getData(NOTES_TOOL_DRAG_MIME), notesPanelIdentity(controller, live.snapshot));
    const anchor = notesDropAnchor(root.current, event.target, event.clientX, event.clientY);
    if (!kind || !anchor || !bridge.supportedInsertActions.includes(kind)) return;
    const abort = new AbortController(); dropFlight.current = abort; setDropMessage("");
    void Promise.resolve().then(() => bridge.insert(kind, abort.signal, { anchor })).then(() => { if (lifetime.current && !abort.signal.aborted) feedback ? feedback.announce("本文に挿入しました。未保存です", "success") : setDropMessage("挿入しました。保存状態を確認してください"); }).catch(error => { if (lifetime.current && !abort.signal.aborted) error instanceof Error && error.message === "Insertion cancelled" ? setDropMessage("") : feedback ? feedback.announce("挿入を完了できませんでした。本文は保持しています", "error") : setDropMessage("挿入を完了できませんでした。本文は保持しています"); }).finally(() => { if (dropFlight.current === abort) dropFlight.current = null; });
  }} onCompositionStart={event => { if (restrictNativeLinks && linkInputComposition.start(event.target)) { event.stopPropagation(); return; } controller.setComposing(true); }} onCompositionEnd={event => { if (restrictNativeLinks && linkInputComposition.end(event.target)) { event.stopPropagation(); return; } controller.setComposing(false); }}>{dropAnchor ? <div className="oe-notes-drop-indicator" aria-hidden="true" data-drop-block={dropAnchor.blockId} data-placement={dropAnchor.placement} style={(() => { const block = [...(root.current?.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]") ?? [])].find(item => item.dataset.id === dropAnchor.blockId); const rect = block?.getBoundingClientRect(), owner = root.current?.getBoundingClientRect(); return rect && owner ? { top: (dropAnchor.placement === "before" ? rect.top : rect.bottom) - owner.top, left: rect.left - owner.left, width: rect.width, right: "auto" } : { display: "none" }; })()} /> : null}{insertedId ? <div className="oe-notes-insert-result" data-inserted-block={insertedId} aria-hidden="true" style={(() => {
    const block = [...(root.current?.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]") ?? [])].find(item => item.dataset.id === insertedId), rect = block?.getBoundingClientRect(), owner = root.current?.getBoundingClientRect();
    return rect && owner ? { top: rect.top - owner.top, left: rect.left - owner.left, width: rect.width, height: Math.max(28, rect.height) } : { display: "none" };
  })()} /> : null}<NotesSelectionTools controller={controller} bridge={bridge} service={props.selectionAI} proposalEntry={props.selectionProposal} integrated={formattingReady} language={(!props.preset.config.locale || props.preset.config.locale.toLowerCase().startsWith("ja")) ? "ja" : "en"}>{props.render ? props.render({ editor, editable, bridge, sideMenu, slashMenu, formattingToolbar, linkToolbar }) : <BlockNoteViewRaw editor={editor} editable={editable} sideMenu={false} slashMenu={false} formattingToolbar={false} linkToolbar={false}>{sideMenu}{slashMenu}{formattingToolbar}{linkToolbar}</BlockNoteViewRaw>}</NotesSelectionTools></div>{dropMessage ? <p className="oe-notes-drop-status" role="status">{dropMessage}</p> : null}{plusBlock ? <NotesPlusMenu bridge={bridge} language={(!props.preset.config.locale || props.preset.config.locale.toLowerCase().startsWith("ja")) ? "ja" : "en"} anchor={root.current} cancel={() => { setPlusBlock(undefined); setDropAnchor(undefined); }} choose={kind => {
    const captured = plusBlock;
    if (dropFlight.current || captured.identity !== insertionIdentity() || !editor.getBlock(captured.id) || bridge.commandsAvailable === false) return;
    setPlusBlock(undefined); const abort = new AbortController(); dropFlight.current = abort;
    void Promise.resolve().then(() => bridge.requestInsert!(kind, abort.signal, { anchor: { blockId: captured.id, placement: "after" } })).catch(error => { if (lifetime.current && !abort.signal.aborted && !(error instanceof Error && error.message === "Insertion cancelled")) feedback ? feedback.announce("挿入を完了できませんでした。本文は保持しています", "error") : setDropMessage("挿入を完了できませんでした。本文は保持しています"); }).finally(() => { if (dropFlight.current === abort) dropFlight.current = null; });
  }} /> : null}{choice ? <NotesInsertChoiceDialog kind={choice.kind} anchor={root.current} editable={editable && !state.composing} choose={closeChoice} cancel={() => closeChoice()} /> : null}<NotesInsertDialog request={insertRequest} controller={controller} host={props.preset.host} editor={pickerEditor} insertion={props.insertion} media={props.media} onClose={result => { const pending = insertionPending.current; insertionPending.current = null; setInsertRequest(null); if (result.status === "inserted") pending?.resolve(); else { emptyToReplace.current = undefined; setDropAnchor(undefined); pending?.reject(new Error("Insertion cancelled")); } }} /></EditorDraftLifecycleProvider>;
}
