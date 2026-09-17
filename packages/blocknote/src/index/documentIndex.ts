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
  /** Monotonic revision — bumps on every structural/content change. */
  getRevision: () => number;
  /** Subscribe to revision bumps (for React external-store patterns). */
  subscribe: (listener: () => void) => () => void;
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

  score -= entry.order * 0.001;
  return score;
}

function collectDescendantIds(
  byId: Map<string, MutableEntry>,
  rootId: string
): Set<string> {
  const ids = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const entry of byId.values()) {
      if (entry.parentId && ids.has(entry.parentId) && !ids.has(entry.blockId)) {
        ids.add(entry.blockId);
        grew = true;
      }
    }
  }
  return ids;
}

/**
 * Resolve insertion order from sibling/parent anchors (preferred) or indexHint.
 */
function resolveInsertOrder(
  byId: Map<string, MutableEntry>,
  ordered: MutableEntry[],
  change: {
    parentId?: string | null;
    prevSiblingId?: string | null;
    nextSiblingId?: string | null;
    indexHint?: number;
  }
): number {
  if (change.prevSiblingId) {
    const prev = byId.get(change.prevSiblingId);
    if (prev) {
      // After prev and its entire descendant subtree
      const subtree = collectDescendantIds(byId, prev.blockId);
      let maxOrder = prev.order;
      for (const id of subtree) {
        const entry = byId.get(id);
        if (entry && entry.order > maxOrder) maxOrder = entry.order;
      }
      return maxOrder + 1;
    }
  }

  if (change.nextSiblingId) {
    const next = byId.get(change.nextSiblingId);
    if (next) return next.order;
  }

  if (change.parentId) {
    const parent = byId.get(change.parentId);
    if (parent) {
      const subtree = collectDescendantIds(byId, parent.blockId);
      let maxOrder = parent.order;
      for (const id of subtree) {
        const entry = byId.get(id);
        if (entry && entry.order > maxOrder) maxOrder = entry.order;
      }
      return maxOrder + 1;
    }
  }

  if (typeof change.indexHint === "number") {
    return change.indexHint;
  }

  return ordered.length;
}

/**
 * Per-editor in-memory document index for outline, quick nav, and references.
 * No global singleton — create one instance per editor.
 */
export function createDocumentIndex(): DocumentIndex {
  const byId = new Map<string, MutableEntry>();
  let ordered: MutableEntry[] = [];
  let revision = 0;
  const listeners = new Set<() => void>();

  function notify(): void {
    revision += 1;
    for (const listener of listeners) listener();
  }

  function reindexOrders(): void {
    ordered.sort((a, b) => a.order - b.order);
    ordered.forEach((entry, index) => {
      entry.order = index;
    });
  }

  function rebuildOrdered(): void {
    ordered = [...byId.values()].sort((a, b) => a.order - b.order);
  }

  function shiftOrdersFrom(hint: number, delta: number): void {
    for (const entry of byId.values()) {
      if (entry.order >= hint) entry.order += delta;
    }
  }

  function upsertBlockTree(
    block: EditorBlock,
    parentId: string | null,
    startOrder: number
  ): number {
    // Remove existing subtree if re-inserting
    if (byId.has(block.id)) {
      removeSubtree(block.id);
    }

    const flat: MutableEntry[] = [];
    flattenBlocks([block], parentId, { value: startOrder }, flat);
    const span = flat.length;
    shiftOrdersFrom(startOrder, span);
    for (const entry of flat) {
      byId.set(entry.blockId, entry);
    }
    return span;
  }

  function removeSubtree(rootId: string): number {
    const ids = collectDescendantIds(byId, rootId);
    let removed = 0;
    for (const id of ids) {
      if (byId.delete(id)) removed += 1;
    }
    return removed;
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
      notify();
    },

    applyChanges(changes) {
      if (changes.length === 0) return;
      let needsRebuild = false;
      let contentOnly = false;

      for (const change of changes) {
        if (change.type === "delete") {
          removeSubtree(change.blockId);
          needsRebuild = true;
          continue;
        }

        if (change.type === "insert") {
          const hint = resolveInsertOrder(byId, ordered, change);
          const parentId = change.parentId ?? null;
          upsertBlockTree(change.block, parentId, hint);
          needsRebuild = true;
          continue;
        }

        if (change.type === "update") {
          const existing = byId.get(change.blockId);
          if (!existing) {
            const hint = ordered.length;
            upsertBlockTree(change.block, null, hint);
            needsRebuild = true;
          } else {
            existing.type = change.block.type;
            existing.text = textFromBlock(change.block);
            existing.headingLevel = headingLevelFromBlock(change.block);
            // Nested children may have changed structurally — sync shallow children ids
            if (change.block.children && change.block.children.length > 0) {
              // Keep parent row; ensure children present (insert-only heal)
              for (const child of change.block.children) {
                if (!byId.has(child.id)) {
                  const childOrder = resolveInsertOrder(byId, ordered, {
                    parentId: change.blockId,
                    prevSiblingId: null,
                    nextSiblingId: null
                  });
                  upsertBlockTree(child, change.blockId, childOrder);
                  needsRebuild = true;
                } else {
                  const childEntry = byId.get(child.id);
                  if (childEntry) {
                    childEntry.type = child.type;
                    childEntry.text = textFromBlock(child);
                    childEntry.headingLevel = headingLevelFromBlock(child);
                    childEntry.parentId = change.blockId;
                    contentOnly = true;
                  }
                }
              }
            }
            contentOnly = true;
          }
          continue;
        }

        if (change.type === "move") {
          const existing = byId.get(change.blockId);
          const parentId =
            change.currentParentId !== undefined
              ? change.currentParentId
              : (change.parentId ?? null);

          if (!existing) {
            const hint = resolveInsertOrder(byId, ordered, {
              ...change,
              parentId
            });
            upsertBlockTree(change.block, parentId, hint);
            needsRebuild = true;
            continue;
          }

          // Lift subtree, reinsert at new anchor
          const subtreeIds = collectDescendantIds(byId, change.blockId);
          const subtreeEntries = ordered
            .filter((entry) => subtreeIds.has(entry.blockId))
            .map((entry) => ({ ...entry }));

          for (const id of subtreeIds) {
            byId.delete(id);
          }
          rebuildOrdered();
          reindexOrders();

          const hint = resolveInsertOrder(byId, ordered, {
            ...change,
            parentId
          });
          shiftOrdersFrom(hint, subtreeEntries.length);

          // Reassign orders contiguously at hint; fix root parent
          subtreeEntries.sort((a, b) => a.order - b.order);
          subtreeEntries.forEach((entry, offset) => {
            const next: MutableEntry = {
              ...entry,
              order: hint + offset,
              parentId:
                entry.blockId === change.blockId ? parentId : entry.parentId,
              type:
                entry.blockId === change.blockId
                  ? change.block.type
                  : entry.type,
              text:
                entry.blockId === change.blockId
                  ? textFromBlock(change.block)
                  : entry.text,
              headingLevel:
                entry.blockId === change.blockId
                  ? headingLevelFromBlock(change.block)
                  : entry.headingLevel
            };
            byId.set(next.blockId, next);
          });
          needsRebuild = true;
        }
      }

      if (needsRebuild) {
        rebuildOrdered();
        reindexOrders();
        notify();
      } else if (contentOnly) {
        notify();
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

  return index;
}
