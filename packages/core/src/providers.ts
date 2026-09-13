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

export type DatabaseListOptions = {
  limit?: number;
  cursor?: string;
  query?: string;
  sortBy?: "position" | "title";
  direction?: "asc" | "desc";
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

export type DatabaseProvider = {
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

export type EditorPageLink = {
  id: string;
  title: string;
  preview?: string;
  imageUrl?: string;
  imageAlt?: string;
};

export type CreatedChildPage = {
  id: string;
  title: string;
  preview?: string;
  imageUrl?: string;
  imageAlt?: string;
};

export type PageProvider = {
  listLinks?(excludePageId?: string): Promise<EditorPageLink[]>;
  createChildPage?(): CreatedChildPage | void;
  openPage?(pageId: string): void;
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
  nativeBridge?: NativeBridge;
};
