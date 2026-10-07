export {
  BlockNoteAdapterError,
  type BlockNoteAdapterErrorCode
} from "./adapter/errors.js";
export {
  blockNoteBlockToEditorBlock,
  fromBlockNote
} from "./adapter/fromBlockNote.js";
export {
  knownBlockTypesFromSchema,
  toBlockNote,
  toBlockNoteForSchema
} from "./adapter/toBlockNote.js";
export {
  decodeUnknownEnvelope,
  encodeUnknownEnvelope
} from "./adapter/envelope.js";

export {
  createBatchedChangeSink,
  type BatchPolicy,
  type OpenEditorBlockChange,
  type OpenEditorChangeBatch,
  type OpenEditorChangeSink,
  type OpenEditorChangeSource
} from "./bridge/batchedSink.js";
export { createPendingAwareSink } from "./bridge/pendingAwareSink.js";
export {
  createBlockChangeBridge,
  type BlockChangeBridge,
  type BlockChangeBridgeOptions
} from "./bridge/createBlockChangeBridge.js";

export {
  createBlockActionCommands,
  createBlockReferenceCommands,
  createCommandRegistry,
  createDefaultPowerCommands,
  type CommandGroup,
  type CommandRegistry,
  type CommandSurface,
  type EditorCommand,
  type EditorCommandContext,
  type EditorCommandId,
  type PaletteItem,
  type SlashItem
} from "./commands/registry.js";
export {
  filterAndRankCommands,
  scoreCommand,
  loadRecentCommandIds,
  rememberCommandId,
  type CommandMatchOptions
} from "./commands/match.js";

export {
  createMemoryCommentsSeam,
  createMemoryFileSeam,
  createNoopCollabSeam,
  type PowerSeams
} from "./seams/types.js";

export {
  createCalloutBlockSpec,
  calloutVariants,
  type CalloutVariant
} from "./schema/callout.js";
export {
  createStatusBlockSpec,
  statusStates,
  type StatusState
} from "./schema/status.js";
export { createUnknownEnvelopeBlockSpec } from "./schema/unknownBlock.js";
export {
  createOpenEditorBlockNoteSchema,
  createPowerEditorOptions,
  createPowerSchema,
  createPowerSchemaWithExtras,
  DEFAULT_POWER_TABLE_OPTIONS,
  type AdditionalInlineContentSpecs,
  type CreateOpenEditorBlockNoteSchemaOptions,
  type OpenEditorBlockNoteSchema,
  type PowerEditorOptions
} from "./schema/createOpenEditorBlockNoteSchema.js";

export {
  createDocumentIndex,
  type DocumentIndex,
  type DocumentIndexEntry,
  type DocumentIndexQueryOptions,
  type DocumentIndexSnapshotBlock
} from "./index/documentIndex.js";
export {
  createDocumentOutline,
  flattenOutline,
  type OutlineNode
} from "./index/outline.js";
export {
  textFromBlock,
  textFromContent,
  headingLevelFromBlock
} from "./index/textFromBlock.js";

export {
  BLOCK_REFERENCE_TYPE,
  applyBlockReferenceLabel,
  bindBlockReferenceRuntimeToIndex,
  createBlockReferenceInlineContentSpec,
  createBlockReferenceDom,
  createBlockReferenceResolverFromIndex,
  formatBlockReferenceLabel,
  type BlockReferenceProps,
  type BlockReferenceResolver,
  type BlockReferenceRuntime,
  type BlockReferenceSpecOptions
} from "./references/blockReference.js";

export {
  composePowerFeatures,
  type ComposedPowerFeatures,
  type MergeFeatureBlockSpecs,
  type MergeFeatureInlineSpecs,
  type MergeFeatureStyleSpecs,
  type OpenEditorPowerFeature
} from "./features/types.js";
export {
  createOpenEditorPowerFeatureRegistry,
  type OpenEditorPowerFeatureRegistry
} from "./features/registry.js";
export {
  createOpenEditorPowerPreset,
  type OpenEditorPowerPreset,
  type OpenEditorPowerPresetOptions,
  type ReferenceSpecs,
  type WorkspaceBlockSpecs,
  type WorkspaceInlineSpecs
} from "./features/compose.js";

export {
  CHILD_PAGE_TYPE,
  DATABASE_RELATION_TYPE,
  DATABASE_VIEW_TYPE,
  DATABASE_VIEW_TYPES,
  PAGE_CARD_TYPE,
  PAGE_TRANSCLUSION_TYPE,
  PAGE_MENTION_TYPE,
  applyPageMentionLabel,
  createChildPageBlockSpec,
  createDatabaseRelationInlineContentSpec,
  createDatabaseRuntimeStore,
  createDatabaseViewBlockSpec,
  createDatabaseViewRuntimeFromStore,
  createPageCardBlockSpec,
  createPageTransclusionBlockSpec,
  createPageMentionDom,
  createPageMentionInlineContentSpec,
  createPageMentionResolverFromLinks,
  createPageRuntimeStore,
  createPageRuntimesFromStore,
  createPageSearchEngine,
  createRelationIndex,
  createWorkspaceContentCommands,
  databaseViewInstanceKey,
  databaseViewKey,
  encodeDatabaseKeyParts,
  extractRelationEdges,
  formatPageMentionLabel,
  isCreatablePropertyKind,
  isDatabaseViewType,
  isEditablePropertyKind,
  normalizeDatabasePropertyType,
  resolveChildPageDisplay,
  resolvePageCardDisplay,
  loadPageTransclusion,
  MAX_PAGE_TRANSCLUSION_DEPTH,
  MAX_PAGE_TRANSCLUSION_CHARACTERS,
  type PageTransclusionContent,
  type PageTransclusionRuntime,
  type PageTransclusionSource,
  type ProjectedBlock,
  snapshotToResolveResult,
  buildCreateRowPayload,
  buildTypedCreateRowPayload,
  buildDatabaseQueryKey,
  catchStoreMutation,
  creatablePropertyIds,
  creatableSchemaKeys,
  encodePropertySortSelectValue,
  formatDatabaseCellDisplay,
  formatSelectDisplay,
  hasExplicitPropertyDefinitions,
  metadataAllowsRowMutations,
  hostSupportsPropertyFilters,
  hostSupportsPropertySort,
  isCreatableResolvedProperty,
  isEditableResolvedProperty,
  isIsoDateString,
  listOptionsFromState,
  parseEditedCellValue,
  parseNumberDraft,
  parseSortSelectValue,
  propertyDefinitionMap,
  resolveCreateRowPayload,
  resolveDatabasePropertyDefinitions,
  resolveDatabaseRowSecondaryText,
  resolveDatabaseRowTitle,
  resolveDatabaseViewRenderer,
  cloneDatabaseRowRecord,
  safeResolveFeedRowMedia,
  safeResolveMapLocation,
  safeResolveRowMedia,
  validateDatabaseFilter,
  validateDatabaseFilters,
  validateMapLocation,
  validatePropertySort,
  valuesEqualForEdit,
  projectEquirectangular,
  buildMapRowPresentations,
  buildDashboardCategoricalSummary,
  buildDashboardDateSummary,
  buildDashboardNumericSummary,
  buildDashboardOverview,
  listDashboardCategoricalProperties,
  listDashboardDateProperties,
  listDashboardNumericProperties,
  resolveDashboardCategoricalProperty,
  resolveDashboardDateProperty,
  resolveDashboardNumericProperty,
  type ChildPageDisplay,
  type ChildPageRuntime,
  type DatabaseAnyRowMediaRequest,
  type DatabaseFeedRowMediaRequest,
  type DatabaseMapLocation,
  type DatabaseMapLocationRequest,
  type DatabaseRowMedia,
  type DatabaseRowMediaRequest,
  type DatabaseRowMediaViewType,
  type DatabaseRowOpenRequest,
  type DatabaseRuntimeStore,
  type DatabaseViewRenderer,
  type DatabaseViewConfig,
  type DatabaseViewConfigIdentity,
  type DatabaseViewConfigProvider,
  type DatabaseViewConfigHydrationState,
  type DatabaseViewInitialQueryState,
  type DatabaseViewRendererContext,
  type DatabaseViewRendererMap,
  type DatabaseViewRuntime,
  type DatabaseViewSnapshot,
  type DatabaseViewType,
  type DashboardCategoricalBucket,
  type DashboardDateSummary,
  type DashboardNumericSummary,
  type DashboardOverview,
  type MapLocationStatus,
  type MapPinProjection,
  type MapRowPresentation,
  type NormalizedPropertyKind,
  type PageCardDisplay,
  type PageCardRuntime,
  type PageMentionResolver,
  type PageMentionRuntime,
  type PageMentionSpecOptions,
  type PageRuntimeStore,
  type PageRuntimeStoreOptions,
  type PageSearchEngine,
  type PageSearchEngineOptions,
  type PageSearchRequest,
  type PageSearchResult,
  type PageSnapshot,
  type PageSnapshotStatus,
  type RelationIndex,
  type ResolvedPropertyDefinition
} from "./workspace/index.js";

export { toPartialBlockCopy } from "./commands/blockCopy.js";

export { createDocumentColumns, updateDocumentColumns, validateDocumentColumns, DOCUMENT_COLUMNS_TYPE, DOCUMENT_COLUMN_TYPE, MAX_DOCUMENT_COLUMNS, type DocumentColumnsAction } from "./document/columns.js";
export { createHtmlWidgetPreview, parseHtmlWidgetSource, sanitizeWidgetMarkup, HTML_WIDGET_TYPE, HTML_WIDGET_PRESETS, MAX_WIDGET_SOURCE_CHARACTERS, type HtmlWidgetSource } from "./document/htmlWidget.js";
export { createDocumentWorkspaceFeature, createDocumentColumnsBlockSpec, createDocumentColumnBlockSpec, createHtmlWidgetBlockSpec, applyDocumentColumnsAction, DocumentColumnsGuard } from "./document/workspaceFeature.js";

export {
  createOpenEditorDictionary,
  defaultOpenEditorDictionary,
  type OpenEditorDictionary
} from "./dictionary.js";

export {
  getPowerSlashItems,
  PowerCommandPalette,
  useOpenEditorBlockChanges,
  usePowerCommandPaletteShortcut,
  type PowerCommandPaletteProps,
  type UseOpenEditorBlockChangesOptions
} from "./react/powerUi.js";

export {
  ENVELOPE_ENCODING_VERSION,
  POWER_BLOCK_TYPES,
  UNKNOWN_ENVELOPE_TYPE,
  type BlockLike,
  type FromBlockNoteOptions,
  type OpenEditorPartialBlock,
  type ToBlockNoteOptions
} from "./types.js";
export { importLegacyNotesBlocks, exportLegacyNotesBlocks, type LegacyNotesArchive, type LegacyNotesImport } from "./document/legacyNotes.js";
export { createDocumentTypographyFeature, createDocumentPageBreakBlockSpec } from "./document/typography.js";
export { applyNotesMetadataEdits, type NotesMetadataEdit } from "./document/notesMetadata.js";
export { createRevisionedNotesResourceEditor, validateNotesPropertyValue, type RevisionedNotesResourceEditor, type RevisionedNotesResourceProvider, type NotesResourceSnapshot, type NotesResourceChange, type NotesResourceRequest, type NotesResourceResult, type NotesResourceOutcome, type NotesResourceRecovery, type NotesWritableProperty } from "./workspace/revisionedNotesResource.js";
export { describeOpenEditorAgentSchema } from "./features/agentSchema.js";
export * from "./notes/index.js";
