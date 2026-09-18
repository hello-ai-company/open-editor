import type {
  EditorBlock,
  RelationEdge,
  RelationKind
} from "@hello-ai-company/editor-core";
import { withRelationEdgeId } from "@hello-ai-company/editor-core";
import type { OpenEditorBlockChange } from "../bridge/batchedSink.js";
import {
  BLOCK_REFERENCE_TYPE
} from "../references/blockReference.js";
import {
  CHILD_PAGE_TYPE,
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
  listOutgoingTo: (
    targetType: RelationEdge["targetType"],
    targetId: string
  ) => RelationEdge[];
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
          kind: "database-relation"
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

  function removeSubtreeEdges(root: EditorBlock | { id: string }): void {
    const ids = new Set<string>();
    if ("type" in root) {
      collectBlockIds(root as EditorBlock, ids);
    } else {
      ids.add(root.id);
      // Best-effort: drop known edges keyed by this block and descendants tracked
      for (const [blockId] of blockToEdgeIds) {
        if (blockId === root.id) ids.add(blockId);
      }
    }
    for (const blockId of ids) clearBlockEdges(blockId);
  }

  function upsertBlockEdges(block: EditorBlock): void {
    const next: RelationEdge[] = [];
    extractFromBlock(documentId, block, next);
    // Clear previous edges for this subtree, then write fresh
    const ids = new Set<string>();
    collectBlockIds(block, ids);
    for (const id of ids) clearBlockEdges(id);

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

  return {
    replaceFromBlocks(nextDocumentId, blocks) {
      documentId = nextDocumentId;
      byEdgeId.clear();
      blockToEdgeIds.clear();
      for (const block of blocks) {
        const edges: RelationEdge[] = [];
        extractFromBlock(documentId, block, edges);
        for (const edge of edges) {
          const edgeId = edge.edgeId!;
          byEdgeId.set(edgeId, edge);
          const blockId = edge.sourceBlockId ?? "";
          if (blockId) {
            let set = blockToEdgeIds.get(blockId);
            if (!set) {
              set = new Set();
              blockToEdgeIds.set(blockId, set);
            }
            set.add(edgeId);
          }
        }
      }
      notify();
    },

    applyChanges(nextDocumentId, changes) {
      if (changes.length === 0) return;
      if (nextDocumentId) documentId = nextDocumentId;
      for (const change of changes) {
        if (change.type === "delete") {
          clearBlockEdges(change.blockId);
          if (change.block) removeSubtreeEdges(change.block);
          continue;
        }
        if (
          change.type === "insert" ||
          change.type === "update" ||
          change.type === "move"
        ) {
          upsertBlockEdges(change.block);
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

    listOutgoingTo(targetType, targetId) {
      return [...byEdgeId.values()].filter(
        (edge) =>
          edge.targetType === targetType && edge.targetId === targetId
      );
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
