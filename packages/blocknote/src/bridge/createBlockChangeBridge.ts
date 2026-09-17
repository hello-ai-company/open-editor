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
      editor: BlockNoteEditorLike,
      ctx: { getChanges: () => BnBlockChange[] }
    ) => void,
    includeUpdatesFromRemote?: boolean
  ) => () => void;
  getParentBlock?: (block: BlockLike | string) => BlockLike | undefined;
  getPrevBlock?: (block: BlockLike | string) => BlockLike | undefined;
  getNextBlock?: (block: BlockLike | string) => BlockLike | undefined;
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

function blockIdOf(block: BlockLike | undefined): string | null {
  if (!block || typeof block !== "object") return null;
  const id = (block as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

/**
 * Enrich insert/delete/move with parent + sibling anchors via BlockNote editor APIs.
 * getChanges() itself does not include indexHint/parentId for insert/delete.
 */
function resolveAnchors(
  editor: BlockNoteEditorLike | undefined,
  block: BlockLike,
  fallbackParentId?: string | null
): {
  parentId: string | null;
  prevSiblingId: string | null;
  nextSiblingId: string | null;
} {
  const parent =
    editor?.getParentBlock?.(block) ??
    (fallbackParentId !== undefined ? undefined : undefined);
  const parentId =
    blockIdOf(parent as BlockLike | undefined) ??
    (fallbackParentId !== undefined ? fallbackParentId : null);
  const prevSiblingId = blockIdOf(editor?.getPrevBlock?.(block));
  const nextSiblingId = blockIdOf(editor?.getNextBlock?.(block));
  return { parentId, prevSiblingId, nextSiblingId };
}

function mapOne(
  change: BnBlockChange,
  toEditorBlock: (bnBlock: unknown) => EditorBlock,
  mapSource: (source: unknown) => OpenEditorChangeSource,
  editor?: BlockNoteEditorLike
): OpenEditorBlockChange {
  const source = mapSource(change.source);
  const block = toEditorBlock(change.block);
  const blockId = block.id;

  if (change.type === "insert" || change.type === "delete") {
    // For delete, sibling/parent APIs may already exclude the block — still try.
    const anchors = resolveAnchors(editor, change.block);
    return {
      type: change.type,
      blockId,
      block,
      source,
      parentId: anchors.parentId,
      prevSiblingId: anchors.prevSiblingId,
      nextSiblingId: anchors.nextSiblingId
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

  const anchors = resolveAnchors(
    editor,
    change.block,
    change.currentParent ? blockIdOf(change.currentParent) : null
  );

  return {
    type: "move",
    blockId,
    block,
    prevBlock: change.prevBlock ? toEditorBlock(change.prevBlock) : block,
    source,
    prevParentId: change.prevParent ? blockIdOf(change.prevParent) : null,
    currentParentId:
      change.currentParent != null
        ? blockIdOf(change.currentParent)
        : anchors.parentId,
    parentId: anchors.parentId,
    prevSiblingId: anchors.prevSiblingId,
    nextSiblingId: anchors.nextSiblingId
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
      return editor.onChange((ed, { getChanges }) => {
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
          mapOne(change, toEditorBlock, mapSource, ed)
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
