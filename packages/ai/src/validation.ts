import type { EditorBlock, EditorDocument, EditorBlockProps, JsonValue } from "@hello-ai-company/editor-core";

export class AIContractValidationError extends Error {
  readonly code = "INVALID_AI_CONTRACT";

  constructor(message: string) {
    super(message);
    this.name = "AIContractValidationError";
  }
}

export const MAX_BLOCK_ID_LENGTH = 128;
const MAX_STRING_LENGTH = 500_000;
const MAX_JSON_NODES = 50_000;
const MAX_JSON_DEPTH = 128;
const MAX_DOCUMENT_BLOCKS = 20_000;
const FORBIDDEN_JSON_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export type ValidationBudget = {
  nodes: number;
  jsonStringChars: number;
  textChars: number;
};

export function createValidationBudget(): ValidationBudget {
  return { nodes: 0, jsonStringChars: 0, textChars: 0 };
}

export function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainRecord(value)) throw new AIContractValidationError(`${label} must be a plain object.`);
  if (Reflect.ownKeys(value).some((key) => typeof key === "symbol")) {
    throw new AIContractValidationError(`${label} must not contain symbol keys.`);
  }
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!descriptor.enumerable || !("value" in descriptor)) {
      throw new AIContractValidationError(`${label}.${key} must be an enumerable data property.`);
    }
  }
  return value;
}

export function requireExactKeys(record: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(record).find((key) => !allowedSet.has(key));
  if (unexpected !== undefined) throw new AIContractValidationError(`${label} contains unsupported field '${unexpected}'.`);
}

export function requireString(value: unknown, label: string, maxLength = 4_096, budget?: ValidationBudget): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength || value.trim() !== value) {
    throw new AIContractValidationError(`${label} must be a non-empty trimmed string of at most ${maxLength} characters.`);
  }
  if (budget) addTextChars(budget, value.length, label);
  return value;
}

export function requireText(value: unknown, label: string, maxLength = MAX_STRING_LENGTH, budget?: ValidationBudget): string {
  if (typeof value !== "string" || value.length > maxLength) {
    throw new AIContractValidationError(`${label} must be a string of at most ${maxLength} characters.`);
  }
  if (budget) addTextChars(budget, value.length, label);
  return value;
}

export function requireId(value: unknown, label: string, budget?: ValidationBudget): string {
  const id = requireString(value, label, MAX_BLOCK_ID_LENGTH, budget);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)) {
    throw new AIContractValidationError(`${label} contains unsupported characters.`);
  }
  return id;
}

export function requireTimestamp(value: unknown, label: string): string {
  const timestamp = requireString(value, label, 32);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(timestamp)) {
    throw new AIContractValidationError(`${label} must be an ISO UTC timestamp.`);
  }
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== timestamp) {
    throw new AIContractValidationError(`${label} must be a valid ISO UTC timestamp.`);
  }
  return timestamp;
}

export function requireStringArray(value: unknown, label: string, maxItems = 64): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new AIContractValidationError(`${label} must be an array with at most ${maxItems} items.`);
  }
  return value.map((item, index) => requireString(item, `${label}[${index}]`, 256));
}

export function cloneJsonValue(value: unknown, label: string, budget = createValidationBudget()): JsonValue {
  return cloneJsonValueWithBudget(value, label, budget);
}

function cloneJsonValueWithBudget(value: unknown, label: string, budget: ValidationBudget): JsonValue {
  const active = new WeakSet<object>();

  function visit(input: unknown, path: string, depth: number): JsonValue {
    addJsonNode(budget, label);
    if (depth > MAX_JSON_DEPTH) throw new AIContractValidationError(`${path} exceeds the JSON nesting limit.`);

    if (input === null || typeof input === "boolean") return input;
    if (typeof input === "number") {
      if (!Number.isFinite(input)) throw new AIContractValidationError(`${path} must contain only finite numbers.`);
      return input;
    }
    if (typeof input === "string") {
      if (input.length > MAX_STRING_LENGTH) {
        throw new AIContractValidationError(`${path} exceeds the JSON string size limit.`);
      }
      addJsonStringChars(budget, input.length, path);
      return input;
    }
    if (typeof input !== "object" || input === null) {
      throw new AIContractValidationError(`${path} is not JSON-compatible.`);
    }
    if (active.has(input)) throw new AIContractValidationError(`${path} contains a cycle.`);
    active.add(input);
    try {
      if (Array.isArray(input)) {
        const descriptors = Object.getOwnPropertyDescriptors(input);
        const keys = Reflect.ownKeys(input).filter((key) => key !== "length");
        if (keys.some((key) => typeof key !== "string" || !/^\d+$/.test(key))) {
          throw new AIContractValidationError(`${path} must be a dense JSON array.`);
        }
        if (keys.length !== input.length) throw new AIContractValidationError(`${path} must not contain sparse array slots.`);
        const cloned: JsonValue[] = [];
        for (let index = 0; index < input.length; index += 1) {
          const descriptor = descriptors[String(index)];
          if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
            throw new AIContractValidationError(`${path}[${index}] must be an enumerable data value.`);
          }
          cloned.push(visit(descriptor.value, `${path}[${index}]`, depth + 1));
        }
        return cloned;
      }
      if (!isPlainRecord(input)) throw new AIContractValidationError(`${path} must contain only plain objects.`);
      const descriptors = Object.getOwnPropertyDescriptors(input);
      const keys = Reflect.ownKeys(input);
      if (keys.some((key) => typeof key === "symbol")) throw new AIContractValidationError(`${path} must not contain symbol keys.`);
      const cloned: Record<string, JsonValue> = {};
      for (const key of keys as string[]) {
        const descriptor = descriptors[key];
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
          throw new AIContractValidationError(`${path}.${key} must be an enumerable data value.`);
        }
        if (FORBIDDEN_JSON_KEYS.has(key)) throw new AIContractValidationError(`${path} contains forbidden key '${key}'.`);
        addJsonStringChars(budget, key.length, `${path}.${key}`);
        cloned[key] = visit(descriptor.value, `${path}.${key}`, depth + 1);
      }
      return cloned;
    } finally {
      active.delete(input);
    }
  }

  return visit(value, label, 0);
}

export function parseEditorDocument(value: unknown, label = "document", budget = createValidationBudget()): EditorDocument {
  const blockIds = new Set<string>();
  const blockObjects = new WeakSet<object>();
  let blockCount = 0;

  function parseBlock(input: unknown, path: string, depth: number): EditorBlock {
    if (depth > MAX_JSON_DEPTH) throw new AIContractValidationError(`${path} exceeds the document nesting limit.`);
    const record = requireRecord(input, path);
    requireExactKeys(record, ["id", "type", "props", "content", "children"], path);
    addJsonNode(budget, label);
    const id = requireId(record.id, `${path}.id`, budget);
    if (blockIds.has(id)) throw new AIContractValidationError(`${path}.id duplicates block id '${id}'.`);
    blockIds.add(id);
    if (blockObjects.has(input as object)) throw new AIContractValidationError(`${path} reuses a block object.`);
    blockObjects.add(input as object);
    blockCount += 1;
    if (blockCount > MAX_DOCUMENT_BLOCKS) throw new AIContractValidationError(`${label} exceeds the block count limit.`);

    const type = requireString(record.type, `${path}.type`, 256, budget);
    const parsed: EditorBlock = { id, type };
    if (record.props !== undefined) {
      const props = cloneJsonValueWithBudget(record.props, `${path}.props`, budget);
      if (!isPlainRecord(props)) throw new AIContractValidationError(`${path}.props must be a JSON object.`);
      parsed.props = props as EditorBlockProps;
    }
    if (record.content !== undefined) parsed.content = cloneJsonValueWithBudget(record.content, `${path}.content`, budget);
    if (record.children !== undefined) {
      if (!Array.isArray(record.children)) throw new AIContractValidationError(`${path}.children must be an array.`);
      parsed.children = record.children.map((child, index) => parseBlock(child, `${path}.children[${index}]`, depth + 1));
    }
    return parsed;
  }

  const document = requireRecord(value, label);
  requireExactKeys(document, ["schemaVersion", "blocks"], label);
  if (document.schemaVersion !== 1) throw new AIContractValidationError(`${label}.schemaVersion must be 1.`);
  if (!Array.isArray(document.blocks)) throw new AIContractValidationError(`${label}.blocks must be an array.`);
  return {
    schemaVersion: 1,
    blocks: document.blocks.map((block, index) => parseBlock(block, `${label}.blocks[${index}]`, 0))
  };
}

function addJsonNode(budget: ValidationBudget, label: string): void {
  budget.nodes += 1;
  if (budget.nodes > MAX_JSON_NODES) throw new AIContractValidationError(`${label} exceeds the JSON value size limit.`);
}

function addJsonStringChars(budget: ValidationBudget, count: number, label: string): void {
  budget.jsonStringChars += count;
  if (budget.jsonStringChars > MAX_STRING_LENGTH) {
    throw new AIContractValidationError(`${label} exceeds the JSON string size limit.`);
  }
  addTextChars(budget, count, label);
}

function addTextChars(budget: ValidationBudget, count: number, label: string): void {
  budget.textChars += count;
  if (budget.textChars > MAX_STRING_LENGTH) {
    throw new AIContractValidationError(`${label} exceeds the aggregate text size limit.`);
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
