import type {
  EditorBlock,
  RelationEdge,
  RelationKind,
  RelationTargetQuery
} from "@hello-ai-company/editor-core";
import { withRelationEdgeId } from "@hello-ai-company/editor-core";
import type { OpenEditorBlockChange } from "../bridge/batchedSink.js";
import { BLOCK_REFERENCE_TYPE } from "../references/blockReference.js";
import {
  CHILD_PAGE_TYPE,
  DATABASE_RELATION_TYPE,
  DATABASE_VIEW_TYPE,
  PAGE_CARD_TYPE,
  PAGE_MENTION_TYPE
} from "./types.js";

export type RelationIndex = {
  replaceFromBlocks: (
    documentId: string,
    blocks: readonly EditorBlock[]
  ) => void;
  applyChanges: (
    documentId: string,
    changes: readonly OpenEditorBlockChange[]
  ) => void;
  list: () => readonly RelationEdge[];
  listByKind: (kind: RelationKind) => RelationEdge[];
  /**
   * Outgoing edges matching a typed target.
   * `database-row` queries must include `targetDatabaseId`.
   */
  listOutgoingTo: (target: RelationTargetQuery) => RelationEdge[];
  size: () => number;
  getRevision: () => number;
  subscribe: (listener: () => void) => () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readProp(props: unknown, key: string): string {
  if (!isRecord(props)) return "";
  const value = props[key];
  return typeof value === "string" ? value : "";
}

function extractFromInlineContent(
  documentId: string,
  blockId: string,
  content: unknown,
  out: RelationEdge[]
): void {
  if (!Array.isArray(content)) return;
  for (const node of content) {
    if (!isRecord(node)) continue;
    const type = typeof node.type === "string" ? node.type : "";
    const props = node.props;
    if (type === PAGE_MENTION_TYPE) {
      const pageId = readProp(props, "pageId");
      if (pageId) {
        out.push(
          withRelationEdgeId({
            sourceDocumentId: documentId,
            sourceBlockId: blockId,
            targetType: "page",
            targetId: pageId,
            kind: "page-reference"
          })
        );
      }
    }
    if (type === BLOCK_REFERENCE_TYPE) {
      const blockRefId = readProp(props, "blockId");
      if (blockRefId) {
        out.push(
          withRelationEdgeId({
            sourceDocumentId: documentId,
            sourceBlockId: blockId,
            targetType: "block",
            targetId: blockRefId,
            kind: "block-reference"
          })
        );
      }
    }
    if (type === DATABASE_RELATION_TYPE) {
      const databaseId = readProp(props, "databaseId");
      const rowId = readProp(props, "rowId");
      if (databaseId && rowId) {
        out.push(
          withRelationEdgeId({
            sourceDocumentId: documentId,
            sourceBlockId: blockId,
            targetType: "database-row",
            targetId: rowId,
            targetDatabaseId: databaseId,
            kind: "database-row-relation"
          })
        );
      }
    }
    if (node.content !== undefined) {
      extractFromInlineContent(documentId, blockId, node.content, out);
    }
  }
}

function extractFromBlock(
  documentId: string,
  block: EditorBlock,
  out: RelationEdge[]
): void {
  if (block.type === PAGE_CARD_TYPE) {
    const pageId = readProp(block.props, "pageId");
    if (pageId) {
      out.push(
        withRelationEdgeId({
          sourceDocumentId: documentId,
          sourceBlockId: block.id,
          targetType: "page",
          targetId: pageId,
          kind: "page-reference"
        })
      );
    }
  } else if (block.type === CHILD_PAGE_TYPE) {
    const pageId = readProp(block.props, "pageId");
    if (pageId) {
      out.push(
        withRelationEdgeId({
          sourceDocumentId: documentId,
          sourceBlockId: block.id,
          targetType: "page",
          targetId: pageId,
          kind: "child-page"
        })
      );
    }
  } else if (block.type === DATABASE_VIEW_TYPE) {
    const databaseId = readProp(block.props, "databaseId");
    if (databaseId) {
      out.push(
        withRelationEdgeId({
          sourceDocumentId: documentId,
          sourceBlockId: block.id,
          targetType: "database",
          targetId: databaseId,
          kind: "database-view-reference"
        })
      );
    }
  }

  if (block.content !== undefined) {
    extractFromInlineContent(documentId, block.id, block.content, out);
  }
  if (block.children) {
    for (const child of block.children) {
      extractFromBlock(documentId, child, out);
    }
  }
}

function collectBlockIds(block: EditorBlock, out: Set<string>): void {
  out.add(block.id);
  if (block.children) {
    for (const child of block.children) collectBlockIds(child, out);
  }
}

/**
 * Outgoing relation index for one editor document.
 * Incremental via OpenEditorBlockChange; never scans the whole workspace.
 */
export function createRelationIndex(): RelationIndex {
  const byEdgeId = new Map<string, RelationEdge>();
  const blockToEdgeIds = new Map<string, Set<string>>();
  let documentId = "";
  let revision = 0;
  const listeners = new Set<() => void>();

  function notify(): void {
    revision += 1;
    for (const listener of listeners) listener();
  }

  function clearBlockEdges(blockId: string): void {
    const ids = blockToEdgeIds.get(blockId);
    if (!ids) return;
    for (const edgeId of ids) byEdgeId.delete(edgeId);
    blockToEdgeIds.delete(blockId);
  }

  function removeSubtreeEdges(root: EditorBlock): void {
    const ids = new Set<string>();
    collectBlockIds(root, ids);
    for (const blockId of ids) clearBlockEdges(blockId);
  }

  function addSubtreeEdges(block: EditorBlock): void {
    const next: RelationEdge[] = [];
    extractFromBlock(documentId, block, next);
    for (const edge of next) {
      const edgeId = edge.edgeId!;
      byEdgeId.set(edgeId, edge);
      const blockId = edge.sourceBlockId ?? block.id;
      let set = blockToEdgeIds.get(blockId);
      if (!set) {
        set = new Set();
        blockToEdgeIds.set(blockId, set);
      }
      set.add(edgeId);
    }
  }

  function upsertBlockEdges(
    block: EditorBlock,
    prevBlock?: EditorBlock
  ): void {
    // Clear edges belonging to the *previous* subtree first so nested children
    // that disappear on update do not leave stale relations behind.
    if (prevBlock) {
      removeSubtreeEdges(prevBlock);
    } else {
      removeSubtreeEdges(block);
    }
    addSubtreeEdges(block);
  }

  return {
    replaceFromBlocks(nextDocumentId, blocks) {
      documentId = nextDocumentId;
      byEdgeId.clear();
      blockToEdgeIds.clear();
      for (const block of blocks) {
        addSubtreeEdges(block);
      }
      notify();
    },

    applyChanges(nextDocumentId, changes) {
      if (changes.length === 0) return;
      if (nextDocumentId) documentId = nextDocumentId;
      for (const change of changes) {
        if (change.type === "delete") {
          if (change.block) {
            removeSubtreeEdges(change.block);
          } else {
            clearBlockEdges(change.blockId);
          }
          continue;
        }
        if (change.type === "insert") {
          addSubtreeEdges(change.block);
          continue;
        }
        if (change.type === "update") {
          upsertBlockEdges(change.block, change.prevBlock);
          continue;
        }
        if (change.type === "move") {
          // Contents unchanged; still refresh in case nested refs moved with ids.
          upsertBlockEdges(change.block, change.prevBlock);
        }
      }
      notify();
    },

    list() {
      return [...byEdgeId.values()];
    },

    listByKind(kind) {
      return [...byEdgeId.values()].filter((edge) => edge.kind === kind);
    },

    listOutgoingTo(target) {
      return [...byEdgeId.values()].filter((edge) => {
        if (
          edge.targetType !== target.targetType ||
          edge.targetId !== target.targetId
        ) {
          return false;
        }
        if (target.targetType === "database-row") {
          return (
            edge.targetType === "database-row" &&
            edge.targetDatabaseId === target.targetDatabaseId
          );
        }
        return true;
      });
    },

    size() {
      return byEdgeId.size;
    },

    getRevision() {
      return revision;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

/** Pure helper for tests / adapters — extract edges without an index instance. */
export function extractRelationEdges(
  documentId: string,
  blocks: readonly EditorBlock[]
): RelationEdge[] {
  const out: RelationEdge[] = [];
  for (const block of blocks) extractFromBlock(documentId, block, out);
  return out;
}
