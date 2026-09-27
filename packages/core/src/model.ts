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

// ponytail: validator ceilings keep untrusted documents bounded; raise them only when real documents need it.
const MAX_MODEL_BLOCKS = 20_000;
const MAX_MODEL_BLOCK_DEPTH = 128;
const MAX_MODEL_JSON_NODES = 50_000;
const MAX_MODEL_JSON_DEPTH = 128;

type ModelValidationBudget = { blocks: number; jsonNodes: number };

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
  if (!isEditorDocument({ schemaVersion, blocks })) {
    throw new TypeError("Editor document blocks must be valid JSON data within the supported size limits.");
  }
  return {
    schemaVersion,
    blocks: blocks.map(cloneEditorBlockUnchecked)
  };
}

export function cloneEditorBlocks(blocks: EditorBlock[]): EditorBlock[] {
  if (!isEditorDocument({ schemaVersion: EDITOR_DOCUMENT_SCHEMA_VERSION, blocks })) {
    throw new TypeError("Editor document blocks must be valid JSON data within the supported size limits.");
  }
  return blocks.map(cloneEditorBlockUnchecked);
}

export function cloneEditorBlock(block: EditorBlock): EditorBlock {
  if (!isEditorBlock(block)) {
    throw new TypeError("Editor block must be valid JSON data within the supported size limits.");
  }
  return cloneEditorBlockUnchecked(block);
}

function cloneEditorBlockUnchecked(block: EditorBlock): EditorBlock {
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
    cloned.children = block.children.map(cloneEditorBlockUnchecked);
  }
  return cloned;
}

export function isEditorBlock(value: unknown): value is EditorBlock {
  return isEditorBlockWithin(value, { blocks: 0, jsonNodes: 0 });
}

export function isJsonValue(value: unknown): value is JsonValue {
  return isJsonValueWithin(value, { blocks: 0, jsonNodes: 0 });
}

export function isEditorDocument(value: unknown): value is EditorDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const document = value as Record<string, unknown>;
  if (!isSupportedSchemaVersion(document.schemaVersion)) return false;
  if (!Array.isArray(document.blocks)) return false;
  const budget: ModelValidationBudget = { blocks: 0, jsonNodes: 0 };
  for (const block of document.blocks) {
    if (!isEditorBlockWithin(block, budget)) return false;
  }
  return true;
}

function isEditorBlockWithin(value: unknown, budget: ModelValidationBudget): value is EditorBlock {
  const active = new WeakSet<object>();
  const pending: Array<{ value: unknown; depth: number; leave?: true }> = [{ value, depth: 0 }];
  let queuedBlocks = 1;
  while (pending.length > 0) {
    const item = pending.pop();
    if (!item) continue;
    if (item.leave) {
      active.delete(item.value as object);
      continue;
    }
    queuedBlocks -= 1;
    budget.blocks += 1;
    if (budget.blocks > MAX_MODEL_BLOCKS || item.depth > MAX_MODEL_BLOCK_DEPTH) return false;
    if (!isPlainObject(item.value)) return false;
    const block = item.value as Record<string, unknown>;
    if (typeof block.id !== "string" || block.id.length === 0) return false;
    if (typeof block.type !== "string" || block.type.length === 0) return false;
    if (active.has(block)) return false;
    active.add(block);
    pending.push({ value: block, depth: item.depth, leave: true });
    if (block.props !== undefined
      && !(isPlainObject(block.props) && isJsonValueWithin(block.props, budget))) return false;
    if (block.content !== undefined && !isJsonValueWithin(block.content, budget)) return false;
    if (block.children !== undefined) {
      if (!Array.isArray(block.children)) return false;
      if (budget.blocks + queuedBlocks + block.children.length > MAX_MODEL_BLOCKS) return false;
      for (let index = block.children.length - 1; index >= 0; index -= 1) {
        pending.push({ value: block.children[index], depth: item.depth + 1 });
        queuedBlocks += 1;
      }
    }
  }
  return true;
}

function isJsonValueWithin(value: unknown, budget: ModelValidationBudget): value is JsonValue {
  const active = new WeakSet<object>();
  const pending: Array<{ value: unknown; depth: number; leave?: true }> = [{ value, depth: 0 }];
  let queuedNodes = 1;
  while (pending.length > 0) {
    const item = pending.pop();
    if (!item) continue;
    if (item.leave) {
      active.delete(item.value as object);
      continue;
    }
    queuedNodes -= 1;
    budget.jsonNodes += 1;
    if (budget.jsonNodes > MAX_MODEL_JSON_NODES || item.depth > MAX_MODEL_JSON_DEPTH) return false;
    if (item.value === null || typeof item.value === "string" || typeof item.value === "boolean") continue;
    if (typeof item.value === "number") {
      if (!Number.isFinite(item.value)) return false;
      continue;
    }
    if (!isPlainObject(item.value) && !Array.isArray(item.value)) return false;
    const object = item.value as object;
    if (active.has(object)) return false;
    active.add(object);
    pending.push({ value: object, depth: item.depth, leave: true });
    if (Array.isArray(item.value)) {
      if (budget.jsonNodes + queuedNodes + item.value.length > MAX_MODEL_JSON_NODES) return false;
      for (let index = item.value.length - 1; index >= 0; index -= 1) {
        pending.push({ value: item.value[index], depth: item.depth + 1 });
        queuedNodes += 1;
      }
    } else {
      for (const key in item.value) {
        if (!Object.hasOwn(item.value, key)) continue;
        if (budget.jsonNodes + queuedNodes + 1 > MAX_MODEL_JSON_NODES) return false;
        pending.push({ value: item.value[key], depth: item.depth + 1 });
        queuedNodes += 1;
      }
    }
  }
  return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
