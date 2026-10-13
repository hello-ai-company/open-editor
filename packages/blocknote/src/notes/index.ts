export type * from "./contracts.js";
export * from "./propertyCatalog.js";
export * from "./tableEditing.js";
export { createNotesIndexedDBLayoutStorage } from "./indexedDBLayoutStorage.js";
export * from "./legacyEditing.js";
export * from "./documentWidgets.js";
export { createNotesLayout, parseNotesLayout, openNotesTab, closeNotesTab, splitNotesTab, notesLayoutPanes, notesDropZone, notesTargetKey, notesLayoutStorageKey, loadNotesLayout, saveNotesLayout } from "./layoutState.js";
export type { NotesLayoutScope, NotesWorkspaceTab, NotesLayoutState, NotesLayoutStorage, NotesLayoutLoad, NotesSplitAxis, NotesDropZone } from "./layoutState.js";
export { createNotesWorkspaceController, parseNotesDocumentSnapshot, parseNotesCommand, NOTES_COMMAND_KINDS } from "./controller.js";
export { createOpenEditorNotesPreset, notesEditorDictionary, parseNotesWorkspaceConfig, DEFAULT_NOTES_WORKSPACE_CONFIG } from "./preset.js";
export { createLegacyNotesEditingFeature } from "./legacyEditingFeature.js";

export { parseNotesHtmlRawSource, parseNotesHtmlSourceDraft, notesHtmlSourceDraftKey, sameNotesHtmlSourceDraft } from "./htmlSourceDraft.js";
export type { NotesHtmlSourceDraft, NotesHtmlSourceDraftJournal, NotesHtmlSourceDraftState } from "./htmlSourceDraft.js";

export { notesDocumentEditingAvailable } from "./editingAvailability.js";
