/**
 * Additive `./react` entry — React hooks, palette, outline, navigation, actions.
 */
export {
  createCalloutBlockSpec,
  calloutVariants,
  type CalloutVariant
} from "../schema/callout.js";
export {
  createStatusBlockSpec,
  statusStates,
  type StatusState
} from "../schema/status.js";
export {
  createOpenEditorBlockNoteSchema,
  createPowerEditorOptions,
  createPowerSchema,
  DEFAULT_POWER_TABLE_OPTIONS,
  type AdditionalInlineContentSpecs,
  type CreateOpenEditorBlockNoteSchemaOptions,
  type OpenEditorBlockNoteSchema,
  type PowerEditorOptions
} from "../schema/createOpenEditorBlockNoteSchema.js";
export {
  getPowerSlashItems,
  PowerCommandPalette,
  useOpenEditorBlockChanges,
  usePowerCommandPaletteShortcut,
  type PowerCommandPaletteProps,
  type UseOpenEditorBlockChangesOptions
} from "./powerUi.js";
export {
  DocumentOutline,
  QuickNav,
  useDocumentOutline,
  useQuickNavShortcut,
  jumpToBlock,
  type DocumentOutlineProps,
  type QuickNavProps,
  type UseDocumentOutlineOptions
} from "./outline.js";
export {
  BlockActionMenu,
  POWER_FORMATTING_ACTIONS,
  type BlockActionMenuProps,
  type PowerFormattingAction
} from "./blockActions.js";
export {
  createOpenEditorPowerPreset,
  type OpenEditorPowerPreset,
  type OpenEditorPowerPresetOptions,
  type ReferenceSpecs,
  type WorkspaceBlockSpecs,
  type WorkspaceInlineSpecs
} from "../features/compose.js";
export {
  createDocumentIndex,
  type DocumentIndex,
  type DocumentIndexEntry
} from "../index/documentIndex.js";
export {
  createDocumentOutline,
  type OutlineNode
} from "../index/outline.js";
export {
  applyWorkspacePickerKey,
  BacklinksPanel,
  listOutgoingPageLinks,
  PageMentionPicker,
  WorkspacePagePicker,
  usePageLinks,
  useWorkspacePageSearch,
  type BacklinksPanelProps,
  type OutgoingPageLink,
  type PageMentionPickerProps,
  type UsePageLinksOptions,
  type UseWorkspacePageSearchOptions,
  type WorkspacePagePickerMode,
  type WorkspacePagePickerProps
} from "./workspaceUi.js";
export {
  createPageMentionSuggestionGetItems,
  insertStructuredPageMention,
  type CreatePageMentionSuggestionOptions,
  type PageMentionSuggestionItem
} from "./pageMentionSuggestion.js";
export {
  DatabaseViewPicker,
  type DatabaseViewPick,
  type DatabaseViewPickerProps
} from "./databaseViewPicker.js";
export {
  createRelationIndex,
  type RelationIndex
} from "../workspace/relationIndex.js";
export {
  createPageRuntimeStore,
  createPageRuntimesFromStore,
  type PageRuntimeStore,
  type PageSnapshot
} from "../workspace/pageRuntimeStore.js";
export { QuietCooperationCard, type QuietCooperationCardProps } from "./QuietCooperationCard.js";
export { NotesPropertyEditor, type NotesPropertyEditorProps } from "./NotesPropertyEditor.js";
export { NoteOrganizationCard, type NoteOrganizationCardProps } from "./NoteOrganizationCard.js";
export { NotesWorkspace, type NotesWorkspaceProps, type NotesWorkspacePreset } from "./NotesWorkspace.js";
export { NotesConflictReview } from "./NotesConflictReview.js";
export { NotesTabbedWorkspace, createNotesTabbedWorkspaceSession, type NotesTabbedWorkspaceProps, type NotesTabbedWorkspaceOptions, type NotesTabbedWorkspaceSession, type NotesTabbedWorkspaceState, type NotesResourceLeaveContext } from "./NotesTabbedWorkspace.js";
export { NotesContentTools, notesSafeAssetUrl, type NotesContentToolsProps, type NotesContentCodecs, type NotesContentFormat, type NotesMediaScope, type NotesScopedMediaHost } from "./NotesContentTools.js";
export { NotesDatabaseProperties, type NotesDatabasePropertiesProps } from "./NotesDatabaseProperties.js";
export { NotesDatabaseSchema, type NotesDatabaseSchemaProps } from "./NotesDatabaseSchema.js";
export * from "./NotesWorkspaceModes.js";
export { NotesWorkspaceTabs, type NotesWorkspaceTabsProps, type NotesNavigationIntent } from "./NotesWorkspaceTabs.js";
export { NotesBlockNoteDocument, type NotesBlockNoteDocumentProps, type NotesDocumentRenderer } from "./NotesBlockNoteDocument.js";
export { NotesNavigation, NotesLibrary, NotesPageHub, NotesPageActions, canMoveNotesPage, type NotesNavigationProps } from "./NotesNavigation.js";
export { NotesDocumentSidebar, type NotesDocumentSidebarProps } from "./NotesDocumentSidebar.js";
export { NotesInspector, type NotesInspectorProps } from "./NotesInspector.js";
export { NotesRowDetail, type NotesRowDetailProps, type NotesRowProperty } from "./NotesRowDetail.js";
export { NotesProposalRail, type NotesProposalRailProps } from "./NotesProposalRail.js";
export { NOTES_INSERT_CATALOG, NOTES_STYLE_CATALOG, notesAvailableCatalog, type NotesEditorBridge, type NotesInsertKind, type NotesStyleKind } from "./notesWorkspacePanels.js";

export { NotesInsertDialog, notesSupportedPickerInsertKinds, notesSafeInsertionLink, type NotesInsertDialogProps, type NotesInsertRequest, type NotesInsertEditor, type NotesInsertionHost, type NotesPickerInsertKind } from "./NotesInsertDialog.js";
