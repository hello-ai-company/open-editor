import type { DocumentIndex, DocumentIndexEntry } from "./documentIndex.js";

export type OutlineNode = {
  blockId: string;
  title: string;
  level: number;
  children: OutlineNode[];
};

/**
 * Build a nested heading outline from a DocumentIndex snapshot.
 * Pure function — no React, no editor access.
 */
export function createDocumentOutline(index: DocumentIndex): OutlineNode[] {
  const headings = index
    .list()
    .filter((entry): entry is DocumentIndexEntry & { headingLevel: number } => {
      return entry.headingLevel !== undefined;
    });

  const roots: OutlineNode[] = [];
  const stack: OutlineNode[] = [];

  for (const entry of headings) {
    const node: OutlineNode = {
      blockId: entry.blockId,
      title: entry.text.trim() || "Untitled heading",
      level: entry.headingLevel,
      children: []
    };

    while (stack.length > 0) {
      const parent = stack[stack.length - 1];
      if (!parent || parent.level < node.level) break;
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1]!.children.push(node);
    }
    stack.push(node);
  }

  return roots;
}

/** Flatten outline for keyboard navigation / active-heading scan. */
export function flattenOutline(nodes: readonly OutlineNode[]): OutlineNode[] {
  const out: OutlineNode[] = [];
  const walk = (list: readonly OutlineNode[]) => {
    for (const node of list) {
      out.push(node);
      if (node.children.length > 0) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}
