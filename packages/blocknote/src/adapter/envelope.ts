import {
  isJsonValue,
  type EditorBlock,
  type EditorBlockProps,
  type JsonValue
} from "@hello-ai-company/editor-core";
import { BlockNoteAdapterError } from "./errors.js";
import {
  ENVELOPE_ENCODING_VERSION,
  UNKNOWN_ENVELOPE_TYPE,
  type BlockLike,
  type OpenEditorPartialBlock
} from "../types.js";

export type EnvelopeProps = {
  originalType: string;
  propsJson: string;
  contentJson: string;
  encodingVersion: string;
};

export function isScalarProp(value: unknown): value is boolean | number | string {
  const kind = typeof value;
  return kind === "boolean" || kind === "string" || (kind === "number" && Number.isFinite(value));
}

export function propsAreAllScalar(
  props: Record<string, unknown> | undefined
): props is Record<string, boolean | number | string> | undefined {
  if (props === undefined) return true;
  return Object.values(props).every(isScalarProp);
}

function encodeJsonField(value: JsonValue | undefined): string {
  if (value === undefined) return "";
  return JSON.stringify(value);
}

function decodeJsonField(raw: string, path: string): JsonValue | undefined {
  if (raw === "") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new BlockNoteAdapterError("ENVELOPE_CORRUPT", "Envelope JSON field is not valid JSON", path);
  }
  if (!isJsonValue(parsed)) {
    throw new BlockNoteAdapterError("ENVELOPE_CORRUPT", "Envelope JSON field is not JsonValue", path);
  }
  return parsed;
}

function omitUndefinedObjectProperties(value: unknown, seen = new WeakMap<object, object>()): unknown {
  if (Array.isArray(value)) {
    const previous = seen.get(value);
    if (previous) return previous;
    const result: unknown[] = [];
    seen.set(value, result);
    for (const item of value) result.push(omitUndefinedObjectProperties(item, seen));
    return result;
  }
  if (!value || typeof value !== "object") return value;
  const previous = seen.get(value);
  if (previous) return previous;
  const result = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>;
  seen.set(value, result);
  for (const key of Object.keys(value)) {
    const entry = (value as Record<string, unknown>)[key];
    if (entry !== undefined) result[key] = omitUndefinedObjectProperties(entry, seen);
  }
  return result;
}

export function encodeUnknownEnvelope(
  block: EditorBlock,
  envelopeType: string = UNKNOWN_ENVELOPE_TYPE,
  path = "blocks"
): OpenEditorPartialBlock {
  if (!block.id) {
    throw new BlockNoteAdapterError("MISSING_BLOCK_ID", "Block id is required", path);
  }

  const children = block.children?.map((child, index) =>
    encodeUnknownEnvelope(child, envelopeType, `${path}.children[${index}]`)
  );

  const partial: OpenEditorPartialBlock = {
    id: block.id,
    type: envelopeType,
    props: {
      originalType: block.type,
      propsJson: encodeJsonField(block.props),
      contentJson: encodeJsonField(block.content),
      encodingVersion: ENVELOPE_ENCODING_VERSION
    },
    content: undefined
  };

  if (children && children.length > 0) {
    partial.children = children;
  }

  return partial;
}

export function decodeUnknownEnvelope(
  block: BlockLike,
  envelopeType: string = UNKNOWN_ENVELOPE_TYPE,
  path = "blocks"
): EditorBlock {
  if (typeof block.id !== "string" || block.id.length === 0) {
    throw new BlockNoteAdapterError("MISSING_BLOCK_ID", "Block id is required", path);
  }
  if (block.type !== envelopeType) {
    throw new BlockNoteAdapterError(
      "ENVELOPE_CORRUPT",
      `Expected envelope type ${envelopeType}, got ${block.type}`,
      path
    );
  }

  const props = block.props ?? {};
  const originalType = props.originalType;
  if (typeof originalType !== "string" || originalType.length === 0) {
    throw new BlockNoteAdapterError("ENVELOPE_CORRUPT", "Envelope missing originalType", path);
  }

  const encodingVersion = props.encodingVersion;
  if (encodingVersion !== undefined && encodingVersion !== ENVELOPE_ENCODING_VERSION) {
    throw new BlockNoteAdapterError(
      "ENVELOPE_CORRUPT",
      `Unsupported envelope encodingVersion: ${String(encodingVersion)}`,
      path
    );
  }

  const propsJson = typeof props.propsJson === "string" ? props.propsJson : "";
  const contentJson = typeof props.contentJson === "string" ? props.contentJson : "";

  const restoredProps = decodeJsonField(propsJson, `${path}.props.propsJson`);
  const restoredContent = decodeJsonField(contentJson, `${path}.props.contentJson`);

  const children = block.children?.map((child, index) => {
    const childPath = `${path}.children[${index}]`;
    if (child.type === envelopeType) {
      return decodeUnknownEnvelope(child, envelopeType, childPath);
    }
    return blockLikeToEditorBlockIdentity(child, childPath);
  });

  const restored: EditorBlock = {
    id: block.id,
    type: originalType
  };

  if (restoredProps !== undefined) {
    if (
      typeof restoredProps !== "object" ||
      restoredProps === null ||
      Array.isArray(restoredProps)
    ) {
      throw new BlockNoteAdapterError("ENVELOPE_CORRUPT", "Envelope propsJson must be an object", path);
    }
    restored.props = restoredProps as EditorBlockProps;
  }
  if (restoredContent !== undefined) {
    restored.content = restoredContent;
  }
  if (children && children.length > 0) {
    restored.children = children;
  }

  return restored;
}

export function blockLikeToEditorBlockIdentity(block: BlockLike, path: string): EditorBlock {
  if (typeof block.id !== "string" || block.id.length === 0) {
    throw new BlockNoteAdapterError("MISSING_BLOCK_ID", "Block id is required", path);
  }
  if (typeof block.type !== "string" || block.type.length === 0) {
    throw new BlockNoteAdapterError("INVALID_BLOCKNOTE_BLOCK", "Block type is required", path);
  }

  const result: EditorBlock = {
    id: block.id,
    type: block.type
  };

  if (block.props !== undefined) {
    if (!isJsonValue(block.props) || Array.isArray(block.props) || block.props === null) {
      throw new BlockNoteAdapterError("NON_JSON_VALUE", "Block props must be a JSON object", path);
    }
    const entries = Object.entries(block.props);
    if (entries.length > 0) {
      result.props = block.props as EditorBlockProps;
    }
  }

  if (block.content !== undefined) {
    const content = isJsonValue(block.content)
      ? block.content
      : omitUndefinedObjectProperties(block.content);
    if (!isJsonValue(content)) {
      throw new BlockNoteAdapterError("NON_JSON_VALUE", "Block content must be JsonValue", path);
    }
    result.content = content;
  }

  if (block.children !== undefined && block.children.length > 0) {
    result.children = block.children.map((child, index) =>
      blockLikeToEditorBlockIdentity(child, `${path}.children[${index}]`)
    );
  }

  return result;
}
