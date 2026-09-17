import {
  createEditorDocument,
  type EditorBlock,
  type EditorDocument
} from "@hello-ai-company/editor-core";
import {
  blockLikeToEditorBlockIdentity,
  decodeUnknownEnvelope
} from "./envelope.js";
import { BlockNoteAdapterError } from "./errors.js";
import {
  UNKNOWN_ENVELOPE_TYPE,
  type BlockLike,
  type FromBlockNoteOptions
} from "../types.js";

function mapBlock(
  block: BlockLike,
  options: Required<Pick<FromBlockNoteOptions, "unwrapUnknownEnvelope" | "unknownEnvelopeType">>,
  path: string
): EditorBlock {
  if (options.unwrapUnknownEnvelope && block.type === options.unknownEnvelopeType) {
    return decodeUnknownEnvelope(block, options.unknownEnvelopeType, path);
  }
  return blockLikeToEditorBlockIdentity(block, path);
}

/**
 * BlockNote editor.document (or any Block[]) → portable EditorDocument.
 */
export function fromBlockNote(
  blocks: readonly BlockLike[],
  options?: FromBlockNoteOptions
): EditorDocument {
  if (!Array.isArray(blocks)) {
    throw new BlockNoteAdapterError("INVALID_BLOCKNOTE_BLOCK", "fromBlockNote expects a block array");
  }

  const opts = {
    unwrapUnknownEnvelope: options?.unwrapUnknownEnvelope ?? true,
    unknownEnvelopeType: options?.unknownEnvelopeType ?? UNKNOWN_ENVELOPE_TYPE
  };

  const mapped = blocks.map((block, index) => mapBlock(block, opts, `blocks[${index}]`));
  return createEditorDocument(mapped);
}

/**
 * Convert a single BlockNote block to EditorBlock (hot-path friendly).
 */
export function blockNoteBlockToEditorBlock(
  block: BlockLike,
  options?: FromBlockNoteOptions
): EditorBlock {
  const opts = {
    unwrapUnknownEnvelope: options?.unwrapUnknownEnvelope ?? true,
    unknownEnvelopeType: options?.unknownEnvelopeType ?? UNKNOWN_ENVELOPE_TYPE
  };
  return mapBlock(block, opts, "block");
}
