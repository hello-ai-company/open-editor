import type { EditorBlock } from "@hello-ai-company/editor-core";
import { blockNoteBlockToEditorBlock } from "../adapter/fromBlockNote.js";
import type { BlockLike } from "../types.js";
import {
  createBatchedChangeSink,
  type BatchPolicy,
  type OpenEditorBlockChange,
  type OpenEditorChangeBatch,
  type OpenEditorChangeSink,
  type OpenEditorChangeSource
} from "./batchedSink.js";

type BnChangeSource = { type?: string } | undefined;

type BnBlockChange = {
  type: "insert" | "delete" | "update" | "move";
  block: BlockLike;
  prevBlock?: BlockLike;
  source?: BnChangeSource;
  prevParent?: BlockLike;
  currentParent?: BlockLike;
};

type BlockNoteEditorLike = {
  onChange: (
    callback: (
      editor: unknown,
      ctx: { getChanges: () => BnBlockChange[] }
    ) => void,
    includeUpdatesFromRemote?: boolean
  ) => () => void;
};

export type BlockChangeBridgeOptions = {
  includeUpdatesFromRemote?: boolean;
  sink?: OpenEditorChangeSink;
  batch?: BatchPolicy;
  toEditorBlock?: (bnBlock: unknown) => EditorBlock;
  mapSource?: (source: unknown) => OpenEditorChangeSource;
  onBatch?: (batch: OpenEditorChangeBatch) => void;
  onDebugSkip?: (reason: "empty-changes" | "filtered-remote") => void;
};

export type BlockChangeBridge = {
  attach(editor: BlockNoteEditorLike): () => void;
  flush(): OpenEditorChangeBatch | null;
  clear(): void;
  readonly pendingCount: number;
  readonly seq: number;
};

function defaultMapSource(source: unknown): OpenEditorChangeSource {
  if (!source || typeof source !== "object") return "unknown";
  const type = (source as { type?: unknown }).type;
  switch (type) {
    case "local":
    case "paste":
    case "drop":
    case "undo":
    case "redo":
    case "undo-redo":
    case "yjs-remote":
      return type;
    default:
      return "unknown";
  }
}

function mapOne(
  change: BnBlockChange,
  toEditorBlock: (bnBlock: unknown) => EditorBlock,
  mapSource: (source: unknown) => OpenEditorChangeSource
): OpenEditorBlockChange {
  const source = mapSource(change.source);
  const block = toEditorBlock(change.block);
  const blockId = block.id;

  if (change.type === "insert" || change.type === "delete") {
    return {
      type: change.type,
      blockId,
      block,
      source
    };
  }

  if (change.type === "update") {
    return {
      type: "update",
      blockId,
      block,
      prevBlock: change.prevBlock
        ? toEditorBlock(change.prevBlock)
        : block,
      source
    };
  }

  return {
    type: "move",
    blockId,
    block,
    prevBlock: change.prevBlock ? toEditorBlock(change.prevBlock) : block,
    source,
    prevParentId: change.prevParent?.id ?? null,
    currentParentId: change.currentParent?.id ?? null
  };
}

/**
 * Incremental change bridge: onChange → getChanges() → map affected blocks → batched sink.
 * Never reads editor.document or serializes full documents on the hot path.
 */
export function createBlockChangeBridge(
  options: BlockChangeBridgeOptions
): BlockChangeBridge {
  const includeUpdatesFromRemote = options.includeUpdatesFromRemote ?? true;
  const toEditorBlock =
    options.toEditorBlock ??
    ((bnBlock: unknown) => blockNoteBlockToEditorBlock(bnBlock as BlockLike));
  const mapSource = options.mapSource ?? defaultMapSource;

  let lastSeq = 0;
  const ownedSink =
    options.sink ??
    createBatchedChangeSink((batch) => {
      lastSeq = batch.seq;
      options.onBatch?.(batch);
    }, options.batch);

  const bridge: BlockChangeBridge = {
    get pendingCount() {
      return ownedSink.pendingCount;
    },
    get seq() {
      return lastSeq;
    },
    attach(editor) {
      return editor.onChange((_ed, { getChanges }) => {
        const changes = getChanges();
        if (changes.length === 0) {
          options.onDebugSkip?.("empty-changes");
          return;
        }

        const filtered = includeUpdatesFromRemote
          ? changes
          : changes.filter((change) => mapSource(change.source) !== "yjs-remote");

        if (filtered.length === 0) {
          options.onDebugSkip?.("filtered-remote");
          return;
        }

        const mapped = filtered.map((change) =>
          mapOne(change, toEditorBlock, mapSource)
        );
        ownedSink.enqueue(mapped);
      }, includeUpdatesFromRemote);
    },
    flush() {
      const batch = ownedSink.flush();
      if (batch) lastSeq = batch.seq;
      return batch;
    },
    clear() {
      ownedSink.clear();
    }
  };

  return bridge;
}
