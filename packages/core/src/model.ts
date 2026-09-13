/**
 * Provider-neutral editor document model.
 *
 * This module is a seam only: it describes typed block trees without host
 * workspace, privacy, source, or server metadata.
 */

export const EDITOR_DOCUMENT_SCHEMA_VERSION = 1;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { readonly [key: string]: JsonValue };

export type EditorBlockProps = Record<string, JsonValue>;

/**
 * Minimal extensible block. Unknown `type` values and extra `props` keys are
 * first-class so a newer producer can round-trip through an older consumer.
 */
export type EditorBlock = {
  id: string;
  type: string;
  props?: EditorBlockProps;
  content?: JsonValue;
  children?: EditorBlock[];
};

export type EditorDocument = {
  schemaVersion: number;
  blocks: EditorBlock[];
};

/**
 * Phase 2 contract: only the positive integer `1` is a supported schemaVersion.
 * Rejects `-1`, `0`, `1.5`, `2`, and any non-integer numeric value.
 */
export function isSupportedSchemaVersion(value: unknown): value is number {
  return typeof value === "number"
    && Number.isInteger(value)
    && Number.isFinite(value)
    && value > 0
    && value === EDITOR_DOCUMENT_SCHEMA_VERSION;
}

export function createEditorDocument(blocks: EditorBlock[], schemaVersion = EDITOR_DOCUMENT_SCHEMA_VERSION): EditorDocument {
  if (!isSupportedSchemaVersion(schemaVersion)) {
    throw new Error("Editor document schemaVersion must be the positive integer 1.");
  }
  return {
    schemaVersion,
    blocks: cloneEditorBlocks(blocks)
  };
}

export function cloneEditorBlocks(blocks: EditorBlock[]): EditorBlock[] {
  return blocks.map(cloneEditorBlock);
}

export function cloneEditorBlock(block: EditorBlock): EditorBlock {
  const cloned: EditorBlock = {
    id: block.id,
    type: block.type
  };
  if (block.props !== undefined) {
    cloned.props = cloneJsonValue(block.props);
  }
  if (block.content !== undefined) {
    cloned.content = cloneJsonValue(block.content);
  }
  if (block.children !== undefined) {
    cloned.children = cloneEditorBlocks(block.children);
  }
  return cloned;
}

export function isEditorBlock(value: unknown): value is EditorBlock {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const block = value as Record<string, unknown>;
  if (typeof block.id !== "string" || block.id.length === 0) return false;
  if (typeof block.type !== "string" || block.type.length === 0) return false;
  if (block.props !== undefined && !(isPlainObject(block.props) && isJsonValue(block.props))) return false;
  if (block.content !== undefined && !isJsonValue(block.content)) return false;
  if (block.children !== undefined) {
    if (!Array.isArray(block.children) || !block.children.every(isEditorBlock)) return false;
  }
  return true;
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  const kind = typeof value;
  if (kind === "string" || kind === "boolean") return true;
  if (kind === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!isPlainObject(value)) return false;
  return Object.values(value).every(isJsonValue);
}

export function isEditorDocument(value: unknown): value is EditorDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const document = value as Record<string, unknown>;
  if (!isSupportedSchemaVersion(document.schemaVersion)) return false;
  if (!Array.isArray(document.blocks) || !document.blocks.every(isEditorBlock)) return false;
  return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
