import type { EditorDocument, EditorProviders, JsonValue } from "@hello-ai-company/editor-core";

/** A row id is meaningful only inside its database. No host account or credentials enter this identity. */
export type NotesTarget = { kind: "page"; pageId: string } | { kind: "row"; databaseId: string; rowId: string };
export type NotesScope = { actorId: string; workspaceId: string };
export type NotesPersistenceMode = "local-only" | "offline-queued" | "remote-committed" | "test-only";
export type NotesDocumentPanel = "outline" | "tasks" | "media" | "search" | "comments" | "history" | "info";
export type NotesInspectorPanel = "insert" | "style" | "info";
export type NotesWorkspaceConfig = {
  version: 1;
  title?: string;
  navigation?: readonly ("tree" | "library" | "favorites" | "recent" | "trash")[];
  documentPanels?: readonly NotesDocumentPanel[];
  inspectorPanels?: readonly NotesInspectorPanel[];
  defaultDocumentPanel?: NotesDocumentPanel;
  defaultInspectorPanel?: NotesInspectorPanel;
  theme?: "light" | "dark" | "system";
  density?: "comfortable" | "compact";
  locale?: string;
  navigationWidth?: number;
  inspectorWidth?: number;
  featureIds?: readonly string[];
};
/** UI config expresses presentation, never grants a mutation capability. */
export type NotesPageSummary = {
  id: string; title: string; parentId: string | null; position: number;
  icon?: string; cover?: string; favorite?: boolean; deletedAt?: string | null;
  updatedAt?: string; category?: string; tags?: readonly string[];
};
export type NotesCatalogPage = { pages: readonly NotesPageSummary[]; nextCursor: string | null; hasMore: boolean; total?: number };
export type NotesWorkspaceSnapshot = NotesCatalogPage & { scope: NotesScope; revision: string; complete: boolean };
export type NotesDocumentSnapshot = {
  scope: NotesScope; target: NotesTarget; revision: string; contentRevision: string; document: EditorDocument; title: string;
  metadata: Record<string, JsonValue>;
  /** Exact supported+bound+authorized operations. Missing means unavailable, not optimistic permission. */
  capabilities: readonly NotesCommandKind[];
  /** Every advertised operation states its actual persistence. Neither a UI label nor a Promise is proof of a remote commit. */
  capabilitySemantics: Partial<Record<NotesCommandKind, NotesPersistenceMode>>;
  /** Host-owned opaque sidecar handle. Raw legacy archive stays outside editor/AI/public projections. */
  legacyArchiveRef?: string;
};
export type NotesCommand =
  | { kind: "document.save"; document: EditorDocument; title: string }
  | { kind: "page.create"; expectedWorkspaceRevision: string; parentId: string | null; title: string }
  | { kind: "page.rename"; expectedWorkspaceRevision: string; title: string }
  | { kind: "page.move"; parentId: string | null; position: number; expectedWorkspaceRevision: string }
  | { kind: "page.duplicate"; expectedWorkspaceRevision: string; parentId: string | null; title: string }
  | { kind: "page.trash"; expectedWorkspaceRevision: string }
  | { kind: "page.restore"; expectedWorkspaceRevision: string }
  | { kind: "page.delete-permanently"; expectedWorkspaceRevision: string; confirmation: "delete-permanently" }
  | { kind: "metadata.patch"; fields: Record<string, JsonValue>; expectedWorkspaceRevision?: string }
  | { kind: "comment.add"; blockId: string; text: string }
  | { kind: "comment.update"; commentId: string; text?: string; resolved?: boolean }
  | { kind: "comment.delete"; commentId: string }
  | { kind: "history.save"; name?: string }
  | { kind: "history.restore"; versionId: string; expectedVersionRevision: string }
  | { kind: "history.rename"; versionId: string; name: string }
  | { kind: "history.delete"; versionId: string }
  | { kind: "property.patch"; propertyId: string; value: JsonValue }
  | { kind: "schema.create-property"; databaseId: string; definition: Record<string, JsonValue>; expectedSchemaRevision: string }
  | { kind: "schema.update-property"; databaseId: string; propertyId: string; fields: Record<string, JsonValue>; expectedSchemaRevision: string }
  | { kind: "schema.delete-property"; databaseId: string; propertyId: string; expectedSchemaRevision: string }
  | { kind: "schema.reorder-properties"; databaseId: string; propertyIds: string[]; expectedSchemaRevision: string }
  | { kind: "database.action"; databaseId: string; rowId: string; actionId: string }
  | { kind: "template.save"; templateId: string; title: string; document: EditorDocument }
  | { kind: "template.apply"; templateId: string; expectedTemplateRevision: string; afterDocument: EditorDocument }
  | { kind: "template.delete"; templateId: string }
  | { kind: "media.attach"; blockId: string; assetId: string; presentation: "compact" | "card" }
  | { kind: "media.detach"; blockId: string; assetId: string }
  | { kind: "shared.save"; sharedId: string; expectedSharedRevision: string; document: EditorDocument };
export type NotesCommandKind = NotesCommand["kind"];
export type NotesCommandRequest = {
  operationId: string; scope: NotesScope; target: NotesTarget; expectedRevision: string; expectedContentRevision: string; expectedPersistence: NotesPersistenceMode; command: NotesCommand;
};
/** Canonical host read evidence, never a client-provided success flag. Partial collections cannot prove deletion. */
export type NotesMutationEvidence =
  | { kind: "page.create" | "page.move" | "page.duplicate" | "page.trash" | "page.restore" | "page.delete-permanently"; workspaceRevision: string; page: NotesPageSummary | null; createdDocument?: EditorDocument }
  | { kind: "comment.add" | "comment.update" | "comment.delete"; revision: string; commentId: string; comment: NotesCommentRecord | null }
  | { kind: "history.save" | "history.restore" | "history.rename" | "history.delete"; revision: string; versionId: string; version: NotesHistoryRecord | null }
  | { kind: "schema.create-property" | "schema.update-property" | "schema.delete-property" | "schema.reorder-properties"; databaseId: string; revision: string; properties: readonly Record<string, JsonValue>[]; complete: true }
  | { kind: "database.action"; databaseId: string; rowId: string; actionId: string; revision: string; result: JsonValue }
  | { kind: "template.save" | "template.apply" | "template.delete"; templateId: string; revision: string; template: NotesTemplateRecord | null }
  | { kind: "media.attach" | "media.detach"; blockId: string; assetId: string; revision: string; attachment: NotesAttachmentRecord | null; presentation?: "compact" | "card" }
  | { kind: "shared.save"; sharedId: string; revision: string; document: EditorDocument };
export type NotesCommandResult =
  | { status: "committed"; operationId: string; target: NotesTarget; snapshot: NotesDocumentSnapshot; historyId: string; persistence: NotesPersistenceMode; evidence?: NotesMutationEvidence }
  | { status: "denied" | "conflict" | "rejected"; operationId: string; target: NotesTarget }
  | { status: "not-found"; operationId: string; target: NotesTarget; terminal: true }
  | { status: "pending" | "unknown"; operationId: string; target: NotesTarget };
export type NotesDraftBackup = { scope: NotesScope; target: NotesTarget; revision: string; contentRevision: string; document: EditorDocument; title: string };
export type NotesLocalDrafts = Readonly<Record<string, JsonValue>>;
export type NotesRecovery = { version: 1; request: NotesCommandRequest; originalDraft?: NotesDraftBackup; mergeSourceDraft?: NotesDraftBackup; localDrafts?: NotesLocalDrafts; localDraftVersions?: Readonly<Record<string, string>>; localDraftRef?: { id: string; version: string } };
export type NotesCommandOutcome = NotesCommandResult | { status: "cancelled"; operationId: string; target: NotesTarget };
export type NotesCommentRecord = { id: string; blockId: string; text: string; resolved: boolean; createdAt: string; authorLabel?: string };
export type NotesHistoryRecord = { id: string; revision: string; name?: string; createdAt: string; authorLabel?: string; document?: EditorDocument; title?: string };
export type NotesTemplateRecord = { id: string; revision: string; title: string; document: EditorDocument };
export type NotesAttachmentRecord = { id: string; blockId?: string; name: string; url?: string; mimeType?: string; size?: number };
export type NotesPanelSnapshot = { revision: string; comments?: readonly NotesCommentRecord[]; history?: readonly NotesHistoryRecord[]; templates?: readonly NotesTemplateRecord[]; attachments?: readonly NotesAttachmentRecord[] };
export type NotesWorkspaceHost = {
  /** Instance/journal identity, not credentials. Authentication remains in the host closure. */
  scope: NotesScope;
  providers?: EditorProviders;
  readDocument(target: NotesTarget, signal: AbortSignal): Promise<NotesDocumentSnapshot>;
  /** Reads return only authorized data; missing and inaccessible may both return null. */
  readWorkspace?(signal: AbortSignal, options?: { cursor?: string; parentId?: string | null; limit?: number }): Promise<NotesWorkspaceSnapshot>;
  searchWorkspace?(query: string, signal: AbortSignal, options?: { cursor?: string; limit?: number }): Promise<NotesCatalogPage>;
  readPanels?(target: NotesTarget, signal: AbortSignal): Promise<NotesPanelSnapshot>;
  subscribe?(listener: () => void): () => void;
  /** Host atomically reauthorizes, compares all expected revisions, preserves legacy unknown fields,
   * applies only named fields, appends history and stores the exact idempotent operation receipt.
   * A repeated id with a different payload must be rejected. All final failures fence delayed writes.
   * Even raw/archive-only writes advance revision. Config and receipt tickets are never permission. */
  commit(request: NotesCommandRequest, signal: AbortSignal): Promise<NotesCommandResult>;
  /** Authoritative lookup; terminal not-found must fence this operation from ever committing later. */
  lookupOperation(target: NotesTarget, operationId: string, signal: AbortSignal): Promise<NotesCommandResult>;
  /** Persist BEFORE submission. A failure prevents submission; host owns recovery retention. */
  beforeSubmit(recovery: NotesRecovery, signal: AbortSignal): Promise<void>;
  /** Optional explicitly invoked draft backup, actor/workspace+target scoped. Never a canonical commit or mutation grant. */
  persistDraft?(scope: NotesScope, target: NotesTarget, drafts: NotesLocalDrafts, signal: AbortSignal): Promise<void>;
};
export type NotesWorkspaceState = {
  status: "empty" | "ready" | "loading" | "saving" | "unknown" | "conflict" | "denied" | "error";
  snapshot?: NotesDocumentSnapshot; draft?: EditorDocument; draftTitle?: string;
  dirty: boolean; composing: boolean; message: string; recovery?: NotesRecovery;
  localDrafts: NotesLocalDrafts;
  pendingEditors: boolean;
  lastPersistence?: NotesPersistenceMode;
  latest?: NotesDocumentSnapshot;
  originalDraft?: NotesDraftBackup;
  mergeSourceDraft?: NotesDraftBackup;
  /** A reviewed merge is prepared, never automatically submitted. */
  manualSaveRequired?: boolean;
};
export type NotesWorkspaceController = {
  getState(): NotesWorkspaceState;
  subscribe(listener: () => void): () => void;
  open(target: NotesTarget): Promise<boolean>;
  setDraft(document: EditorDocument, title?: string): void;
  /** Cache editor-local input before unmount. Only explicit Cancel or a matching committed operation clears it. */
  setLocalDraft(id: string, value: JsonValue | undefined): void;
  persistLocalDrafts(): Promise<boolean>;
  setComposing(composing: boolean): void;
  save(options?: { explicit?: boolean }): Promise<NotesCommandOutcome | undefined>;
  readLatest(): Promise<NotesDocumentSnapshot | undefined>;
  acceptMergedDraft(latestRevision: string, document: EditorDocument, title: string): Promise<boolean>;
  execute(command: NotesCommand, options?: { localDraftId?: string }): Promise<NotesCommandOutcome>;
  cancel(): void;
  reconcile(): Promise<NotesCommandResult>;
  getRecovery(): NotesRecovery | undefined;
  dispose(): void;
};
