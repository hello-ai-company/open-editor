import type { EditorBlock } from "@hello-ai-company/editor-core";
import type { OpenEditorBlockChange } from "../bridge/batchedSink.js";
import {
  headingLevelFromBlock,
  textFromBlock
} from "./textFromBlock.js";

export type DocumentIndexEntry = {
  blockId: string;
  type: string;
  text: string;
  headingLevel?: number;
  /** Document order (depth-first). Lower = earlier. */
  order: number;
  parentId: string | null;
};

export type DocumentIndexSnapshotBlock = EditorBlock;

export type DocumentIndexQueryOptions = {
  query: string;
  /** Limit results — default 50 */
  limit?: number;
  /** Prefer headings in ranking — default true */
  preferHeadings?: boolean;
  types?: readonly string[];
};

export type DocumentIndex = {
  /** Replace index from a full block tree (initial load / rare rebuild). */
  replaceFromBlocks: (blocks: readonly DocumentIndexSnapshotBlock[]) => void;
  /** Apply incremental OpenEditor changes — hot path. */
  applyChanges: (changes: readonly OpenEditorBlockChange[]) => void;
  getById: (blockId: string) => DocumentIndexEntry | undefined;
  /** Entries in document order. */
  list: () => readonly DocumentIndexEntry[];
  query: (options: DocumentIndexQueryOptions) => DocumentIndexEntry[];
  size: () => number;
};

type MutableEntry = DocumentIndexEntry;

function flattenBlocks(
  blocks: readonly EditorBlock[],
  parentId: string | null,
  startOrder: { value: number },
  out: MutableEntry[]
): void {
  for (const block of blocks) {
    const entry: MutableEntry = {
      blockId: block.id,
      type: block.type,
      text: textFromBlock(block),
      headingLevel: headingLevelFromBlock(block),
      order: startOrder.value,
      parentId
    };
    startOrder.value += 1;
    out.push(entry);
    if (block.children && block.children.length > 0) {
      flattenBlocks(block.children, block.id, startOrder, out);
    }
  }
}

function entryFromBlock(
  block: EditorBlock,
  order: number,
  parentId: string | null
): MutableEntry {
  return {
    blockId: block.id,
    type: block.type,
    text: textFromBlock(block),
    headingLevel: headingLevelFromBlock(block),
    order,
    parentId
  };
}

function scoreEntry(
  entry: DocumentIndexEntry,
  query: string,
  preferHeadings: boolean
): number {
  const q = query.toLowerCase().trim();
  if (!q) {
    return preferHeadings && entry.headingLevel !== undefined
      ? 1000 - (entry.headingLevel ?? 6) * 10 - entry.order * 0.001
      : 100 - entry.order * 0.001;
  }

  const title = entry.text.toLowerCase();
  const type = entry.type.toLowerCase();
  let score = 0;

  if (title === q) score += 200;
  else if (title.startsWith(q)) score += 120;
  else if (title.includes(q)) score += 80;

  const tokens = q.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (title.includes(token)) score += 15;
    if (type.includes(token)) score += 25;
  }

  if (preferHeadings && entry.headingLevel !== undefined) {
    score += 40 - entry.headingLevel * 4;
  }

  // Prefer earlier document order as a mild tie-break
  score -= entry.order * 0.001;
  return score;
}

/**
 * Per-editor in-memory document index for outline, quick nav, and references.
 * No global singleton — create one instance per editor.
 */
export function createDocumentIndex(): DocumentIndex {
  const byId = new Map<string, MutableEntry>();
  let ordered: MutableEntry[] = [];

  function reindexOrders(): void {
    ordered.sort((a, b) => a.order - b.order);
    ordered.forEach((entry, index) => {
      entry.order = index;
    });
  }

  function rebuildOrdered(): void {
    ordered = [...byId.values()].sort((a, b) => a.order - b.order);
  }

  const index: DocumentIndex = {
    replaceFromBlocks(blocks) {
      byId.clear();
      const flat: MutableEntry[] = [];
      flattenBlocks(blocks, null, { value: 0 }, flat);
      for (const entry of flat) {
        byId.set(entry.blockId, entry);
      }
      ordered = flat;
    },

    applyChanges(changes) {
      if (changes.length === 0) return;
      let needsRebuild = false;

      for (const change of changes) {
        if (change.type === "delete") {
          byId.delete(change.blockId);
          needsRebuild = true;
          continue;
        }

        if (change.type === "insert") {
          const hint =
            typeof change.indexHint === "number"
              ? change.indexHint
              : ordered.length;
          const parentId = change.parentId ?? null;
          // Shift orders at/after insertion point
          for (const entry of byId.values()) {
            if (entry.order >= hint) entry.order += 1;
          }
          const entry = entryFromBlock(change.block, hint, parentId);
          byId.set(entry.blockId, entry);
          needsRebuild = true;
          continue;
        }

        if (change.type === "update") {
          const existing = byId.get(change.blockId);
          if (!existing) {
            const entry = entryFromBlock(
              change.block,
              ordered.length,
              null
            );
            byId.set(entry.blockId, entry);
            needsRebuild = true;
          } else {
            existing.type = change.block.type;
            existing.text = textFromBlock(change.block);
            existing.headingLevel = headingLevelFromBlock(change.block);
          }
          continue;
        }

        if (change.type === "move") {
          const existing = byId.get(change.blockId);
          if (existing) {
            existing.parentId = change.currentParentId ?? null;
            existing.type = change.block.type;
            existing.text = textFromBlock(change.block);
            existing.headingLevel = headingLevelFromBlock(change.block);
            // Place near end of siblings if we lack precise order — rebuild later
            existing.order = ordered.length + 1;
            needsRebuild = true;
          } else {
            const entry = entryFromBlock(
              change.block,
              ordered.length,
              change.currentParentId ?? null
            );
            byId.set(entry.blockId, entry);
            needsRebuild = true;
          }
        }
      }

      if (needsRebuild) {
        rebuildOrdered();
        reindexOrders();
      }
    },

    getById(blockId) {
      return byId.get(blockId);
    },

    list() {
      return ordered;
    },

    query(options) {
      const limit = options.limit ?? 50;
      const preferHeadings = options.preferHeadings ?? true;
      const typeFilter = options.types ? new Set(options.types) : null;
      const scored: Array<{ entry: DocumentIndexEntry; score: number }> = [];

      for (const entry of ordered) {
        if (typeFilter && !typeFilter.has(entry.type)) continue;
        const score = scoreEntry(entry, options.query, preferHeadings);
        if (!options.query.trim() || score > 0) {
          scored.push({ entry, score });
        }
      }

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, limit).map((item) => item.entry);
    },

    size() {
      return byId.size;
    }
  };

  return index;
}
