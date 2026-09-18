import type { EditorDocument, JsonValue } from "./model.js";

/**
 * Optional seams the host may implement. Every provider is optional so a
 * consumer can mount a read-only document with zero integrations.
 *
 * Contracts stay host-neutral: edit/transform, persistence, comments,
 * versions, assets, pages, and a generic native host protocol.
 */

export type AIEditAction = "improve" | "shorten" | "expand" | "rewrite" | "custom";

export type AIEditRequest = {
  prompt: string;
  selectionText?: string;
  action?: AIEditAction;
  instruction?: string;
};

export type AIProvider = {
  edit?(request: AIEditRequest): Promise<string>;
};

/**
 * Portable property kinds for typed metadata (Phase 4F-3B).
 * Unsupported host types normalize to `"unknown"` (display-only).
 */
export type DatabasePropertyType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "url"
  | "select"
  | "status"
  | "unknown";

export type DatabasePropertyOption = {
  value: string;
  label?: string;
};

/**
 * Host-owned property metadata. Identity is `id` (not display `name`).
 * Additive — legacy hosts may omit entirely and keep `schema: Record<string, string>`.
 */
export type DatabasePropertyDefinition = {
  id: string;
  name: string;
  type: DatabasePropertyType;
  readOnly?: boolean;
  options?: readonly DatabasePropertyOption[];
  /** Original host type when normalized to `unknown`. */
  rawType?: string;
};

/**
 * Explicit advertisement of advanced query features.
 * Absence or `false` is fail-closed — do not assume `listRows` understands filters/sorts.
 */
export type DatabaseQueryCapabilities = {
  propertyFilters?: boolean;
  propertySort?: boolean;
};

/**
 * AND-only structured filters (Phase 4F-3B).
 * Discriminated by `propertyType` + `operator` so value types stay sound.
 * No OR groups / nested boolean trees in this phase.
 */
export type DatabaseFilter =
  | {
      propertyId: string;
      propertyType: "text" | "url";
      operator: "contains" | "equals" | "notEquals";
      value: string;
    }
  | {
      propertyId: string;
      propertyType: "number";
      operator: "equals" | "gt" | "gte" | "lt" | "lte";
      value: number;
    }
  | {
      propertyId: string;
      propertyType: "boolean";
      operator: "is";
      value: boolean;
    }
  | {
      propertyId: string;
      propertyType: "date";
      operator: "on" | "before" | "after";
      value: string;
    }
  | {
      propertyId: string;
      propertyType: "select" | "status";
      operator: "equals" | "notEquals";
      value: string;
    }
  | {
      propertyId: string;
      propertyType:
        | "text"
        | "number"
        | "boolean"
        | "date"
        | "url"
        | "select"
        | "status";
      operator: "isEmpty" | "isNotEmpty";
    };

/** Single property sort — mutually exclusive with legacy sortBy when set. */
export type DatabasePropertySort = {
  propertyId: string;
  direction: "asc" | "desc";
};

export type DatabaseListOptions = {
  limit?: number;
  cursor?: string;
  /** Free-text search — may coexist with structured `filters` (host executes both). */
  query?: string;
  /**
   * Legacy sort. When `propertySort` is set, hosts should treat property sort
   * as the active sort and ignore a conflicting legacy claim from the client.
   * OpenEditor's runtime sends exactly one of: propertySort XOR (sortBy+direction).
   */
  sortBy?: "position" | "title";
  direction?: "asc" | "desc";
  /** Structured AND filters — only when host advertises `queryCapabilities.propertyFilters`. */
  filters?: readonly DatabaseFilter[];
  /** Property sort — only when host advertises `queryCapabilities.propertySort`. */
  propertySort?: DatabasePropertySort;
  includeTrashed?: boolean;
  trashedOnly?: boolean;
};

export type DatabaseRowItem = {
  rowKey: string;
  sortOrder: number;
  deletedAt?: string | null;
  row: Record<string, JsonValue>;
};

export type DatabaseRowsPage = {
  databaseId: string;
  rows: Array<Record<string, JsonValue>>;
  items: DatabaseRowItem[];
  schema: Record<string, string>;
  config: Record<string, JsonValue>;
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
    total: number;
  };
};

/**
 * Host-neutral database descriptor. Rows are never stored in EditorDocument —
 * they come from DatabaseProvider.listRows / getRow.
 *
 * Phase 4F-3B adds optional typed metadata. The opaque `properties` bag is
 * left untouched for host use — do not reinterpret it as property definitions.
 */
export type EditorDatabase = {
  id: string;
  title: string;
  /** Opaque host bag — not property definitions. */
  properties?: Record<string, JsonValue>;
  /** Typed property metadata (additive). Identity is `propertyDefinitions[].id`. */
  propertyDefinitions?: readonly DatabasePropertyDefinition[];
  /** Explicit advanced query capabilities (fail-closed when absent). */
  queryCapabilities?: DatabaseQueryCapabilities;
  views?: ReadonlyArray<{
    id: string;
    title?: string;
    viewType?: string;
  }>;
};

export type DatabaseProvider = {
  /** Optional metadata lookup — does not embed rows into the document. */
  getDatabase?(databaseId: string): Promise<EditorDatabase | null>;
  listRows?(databaseId: string, options?: DatabaseListOptions): Promise<DatabaseRowsPage>;
  getRow?(databaseId: string, rowKey: string): Promise<{ databaseId: string; row: Record<string, JsonValue> }>;
  createRow?(databaseId: string, row: Record<string, JsonValue>, options?: { rowKey?: string; sortOrder?: number }): Promise<JsonValue>;
  updateRow?(databaseId: string, rowKey: string, row: Record<string, JsonValue>, sortOrder?: number): Promise<JsonValue>;
  deleteRow?(databaseId: string, rowKey: string): Promise<JsonValue>;
  restoreRow?(databaseId: string, rowKey: string): Promise<JsonValue>;
  reorderRows?(databaseId: string, rowKeys: string[]): Promise<JsonValue>;
};

export type EditorComment = {
  id: string;
  blockId: string;
  text: string;
  createdAt: string;
  resolved?: boolean;
};

export type CommentsProvider = {
  list?(documentId: string): Promise<EditorComment[]>;
  add?(documentId: string, blockId: string, text: string): Promise<EditorComment | void>;
  update?(documentId: string, commentId: string, update: { text?: string; resolved?: boolean }): Promise<EditorComment | void>;
  delete?(documentId: string, commentId: string): Promise<void>;
};

export type EditorVersionSnapshot = {
  id: string;
  name?: string;
  title?: string;
  createdAt: string;
  document: EditorDocument;
};

export type VersionProvider = {
  list?(documentId: string): Promise<EditorVersionSnapshot[]>;
  save?(documentId: string, snapshot: Omit<EditorVersionSnapshot, "id" | "createdAt"> & { id?: string; createdAt?: string }): Promise<EditorVersionSnapshot | void>;
  restore?(documentId: string, versionId: string): Promise<EditorVersionSnapshot | void>;
  rename?(documentId: string, versionId: string, name: string): Promise<void>;
  delete?(documentId: string, versionId: string): Promise<void>;
};

export type EditorAssetKind = "image" | "video" | "audio" | "pdf" | "file";

export type EditorAsset = {
  url: string;
  attachmentId?: string;
  name: string;
  mimeType: string;
  size?: number;
  kind?: EditorAssetKind;
};

export type EditorUploadFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type AssetUploadScope = {
  documentId?: string;
  blockId?: string;
};

export type AssetProvider = {
  upload?(file: EditorUploadFile, scope?: AssetUploadScope): Promise<EditorAsset>;
  insertCloud?(asset: EditorAsset): void;
};

export type ImageSearchResult = {
  id: string;
  title: string;
  url: string;
  keywords?: string;
};

export type ImageSearchProvider = {
  search?(query: string, page?: number, perPage?: number): Promise<{
    configured: boolean;
    page: number;
    perPage: number;
    total: number;
    hasMore: boolean;
    results: ImageSearchResult[];
  }>;
};

/** Host-stable page identity — UUID, slug, local key, or remote id. */
export type PageId = string;

export type EditorPageLink = {
  id: PageId;
  title: string;
  preview?: string;
  imageUrl?: string;
  imageAlt?: string;
};

export type CreatedChildPage = {
  id: PageId;
  title: string;
  preview?: string;
  imageUrl?: string;
  imageAlt?: string;
};

export type CreateChildPageOptions = {
  parentPageId?: PageId;
  title?: string;
};

export type CreatePageOptions = {
  title?: string;
};

export type PageSearchOptions = {
  excludePageId?: PageId;
  limit?: number;
};

/**
 * Host-owned page workspace seam.
 * OpenEditor stores page *references*; the host owns page entities.
 *
 * `createChildPage()` with no args remains supported for older hosts.
 */
export type PageProvider = {
  listLinks?(excludePageId?: PageId): Promise<EditorPageLink[]>;
  searchPages?(query: string, options?: PageSearchOptions): Promise<EditorPageLink[]>;
  getPage?(pageId: PageId): Promise<EditorPageLink | null>;
  createPage?(options?: CreatePageOptions): CreatedChildPage | EditorPageLink | void | Promise<CreatedChildPage | EditorPageLink | void>;
  createChildPage?(options?: CreateChildPageOptions): CreatedChildPage | void | Promise<CreatedChildPage | void>;
  openPage?(pageId: PageId): void;
};

export type BacklinkItem = {
  sourceDocumentId: string;
  sourceBlockId?: string;
  sourceTitle?: string;
  kind: string;
};

/**
 * Workspace-wide incoming relations. A single editor only knows outgoing
 * edges from its document — backlinks must come from the host.
 *
 * Discriminated on `targetType`. A database-row query always requires
 * both `targetDatabaseId` and `targetId` (row keys are database-scoped).
 */
export type BacklinkQuery =
  | {
      targetType: "page" | "block" | "database";
      targetId: string;
      limit?: number;
    }
  | {
      targetType: "database-row";
      targetDatabaseId: string;
      targetId: string;
      limit?: number;
    };

export type BacklinkProvider = {
  listBacklinks?(query: BacklinkQuery): Promise<BacklinkItem[]>;
};

export type NativeBridgeStats = {
  characters?: number;
  words?: number;
  blocks?: number;
  headings?: number;
  tasks?: number;
  completedTasks?: number;
  media?: number;
  tables?: number;
  links?: number;
  readingMinutes?: number;
};

export type NativeHostRequest = {
  id: string;
  method: string;
  payload?: JsonValue;
};

export type NativeHostResponse = {
  id: string;
  ok: boolean;
  payload?: JsonValue;
  error?: string;
};

/**
 * Minimal generic host protocol. Host-specific transport (network proxy,
 * document chrome, workforce actions) maps onto hostRequest / hostResponse.
 */
export type NativeBridge = {
  ready?(documentId: string): void;
  change?(payload: { dirty: boolean; stats?: NativeBridgeStats }): void;
  commit?(payload: Record<string, JsonValue>): void;
  error?(message: string): void;
  hostRequest?(request: NativeHostRequest): void;
  hostResponse?(response: NativeHostResponse): void;
};

export type EditorProviders = {
  ai?: AIProvider;
  database?: DatabaseProvider;
  comments?: CommentsProvider;
  versions?: VersionProvider;
  assets?: AssetProvider;
  imageSearch?: ImageSearchProvider;
  pages?: PageProvider;
  /** Optional host seam for workspace-wide incoming relations. */
  backlinks?: BacklinkProvider;
  nativeBridge?: NativeBridge;
};
