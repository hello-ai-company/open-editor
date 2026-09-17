import {
  isEditorDocument,
  type EditorBlock,
  type EditorDocument
} from "@hello-ai-company/editor-core";
import { BlockNoteAdapterError } from "./errors.js";
import { encodeUnknownEnvelope, propsAreAllScalar } from "./envelope.js";
import {
  UNKNOWN_ENVELOPE_TYPE,
  type OpenEditorPartialBlock,
  type ToBlockNoteOptions
} from "../types.js";

function toKnownSet(known: ToBlockNoteOptions["knownBlockTypes"]): ReadonlySet<string> {
  return known instanceof Set ? known : new Set(known);
}

function mapBlock(
  block: EditorBlock,
  known: ReadonlySet<string>,
  options: {
    wrapUnknownAsEnvelope: boolean;
    unknownEnvelopeType: string;
    idPolicy: "preserve" | "regenerate-missing";
  },
  path: string
): OpenEditorPartialBlock {
  let id = block.id;
  if (typeof id !== "string" || id.length === 0) {
    if (options.idPolicy === "regenerate-missing") {
      id = `oe-${Math.random().toString(36).slice(2, 10)}`;
    } else {
      throw new BlockNoteAdapterError("MISSING_BLOCK_ID", "Block id is required", path);
    }
  }

  const isKnown = known.has(block.type);
  const scalarOk = propsAreAllScalar(block.props as Record<string, unknown> | undefined);

  if (!isKnown || !scalarOk) {
    if (!options.wrapUnknownAsEnvelope) {
      throw new BlockNoteAdapterError(
        "INVALID_EDITOR_DOCUMENT",
        `Block type "${block.type}" is not known or has non-scalar props`,
        path
      );
    }
    return encodeUnknownEnvelope(
      { ...block, id },
      options.unknownEnvelopeType,
      path
    );
  }

  const partial: OpenEditorPartialBlock = {
    id,
    type: block.type
  };

  if (block.props !== undefined && Object.keys(block.props).length > 0) {
    partial.props = block.props as Record<string, boolean | number | string>;
  }
  if (block.content !== undefined) {
    partial.content = block.content;
  }
  if (block.children !== undefined && block.children.length > 0) {
    partial.children = block.children.map((child, index) =>
      mapBlock(child, known, options, `${path}.children[${index}]`)
    );
  }

  return partial;
}

/**
 * EditorDocument → PartialBlock[] suitable for initialContent / replaceBlocks.
 */
export function toBlockNote(
  document: EditorDocument,
  options: ToBlockNoteOptions
): OpenEditorPartialBlock[] {
  if (!isEditorDocument(document)) {
    throw new BlockNoteAdapterError(
      "INVALID_EDITOR_DOCUMENT",
      "toBlockNote expects a valid EditorDocument (schemaVersion 1)"
    );
  }

  const known = toKnownSet(options.knownBlockTypes);
  const opts = {
    wrapUnknownAsEnvelope: options.wrapUnknownAsEnvelope ?? true,
    unknownEnvelopeType: options.unknownEnvelopeType ?? UNKNOWN_ENVELOPE_TYPE,
    idPolicy: options.idPolicy ?? "preserve"
  };

  return document.blocks.map((block, index) =>
    mapBlock(block, known, opts, `blocks[${index}]`)
  );
}

export function knownBlockTypesFromSchema(schema: {
  blockSchema: Record<string, unknown>;
}): ReadonlySet<string> {
  return new Set(Object.keys(schema.blockSchema));
}

export function toBlockNoteForSchema(
  document: EditorDocument,
  schema: { blockSchema: Record<string, unknown> },
  options?: Omit<ToBlockNoteOptions, "knownBlockTypes">
): OpenEditorPartialBlock[] {
  return toBlockNote(document, {
    ...options,
    knownBlockTypes: knownBlockTypesFromSchema(schema)
  });
}
