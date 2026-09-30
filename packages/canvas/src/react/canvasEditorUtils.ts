import type {
  CanvasBlockElementRef,
  CanvasBreakpoint,
  CanvasLayoutNode,
  CanvasLayoutSpec,
  CanvasRect,
  ResponsiveValue
} from "../index.js";
import { flattenCanvasNodes } from "../layoutOperations.js";

export type AbsoluteItem = {
  element: CanvasBlockElementRef;
  rect: ResponsiveValue<CanvasRect>;
};

export function findAbsoluteItem(root: CanvasLayoutNode, nodeId: string): AbsoluteItem | undefined {
  for (const node of flattenCanvasNodes(root)) {
    if (node.type === "absolute") {
      const item = node.items.find(({ element }) => element.id === nodeId);
      if (item) return item;
    }
  }
  return undefined;
}

export function nodeLabel(node: CanvasLayoutNode): string {
  if ("blockId" in node && node.blockId) return `${node.type} · ${node.blockId} · ${node.id}`;
  return `${node.type} · ${node.id}`;
}

export function updateAbsoluteItemRect(
  spec: CanvasLayoutSpec,
  nodeId: string,
  breakpoint: CanvasBreakpoint,
  rect: CanvasRect
): CanvasLayoutSpec | null {
  const width = Math.min(100, Math.max(1, Number.isFinite(rect.width) ? rect.width : 1));
  const height = Math.min(100, Math.max(1, Number.isFinite(rect.height) ? rect.height : 1));
  const nextRect = {
    x: Math.min(100 - width, Math.max(0, Number.isFinite(rect.x) ? rect.x : 0)),
    y: Math.min(100 - height, Math.max(0, Number.isFinite(rect.y) ? rect.y : 0)),
    width,
    height
  };

  function visit(node: CanvasLayoutNode): { node: CanvasLayoutNode; changed: boolean } {
    if (node.type === "absolute") {
      const index = node.items.findIndex(({ element }) => element.id === nodeId);
      if (index >= 0) {
        const items = [...node.items];
        const item = items[index]!;
        items[index] = { ...item, rect: { ...item.rect, [breakpoint]: nextRect } };
        return { node: { ...node, items }, changed: true };
      }
      return { node, changed: false };
    }
    if (node.type === "stack" || node.type === "grid" || node.type === "section" || node.type === "frame") {
      const children = node.children.map(visit);
      return children.some(({ changed }) => changed)
        ? { node: { ...node, children: children.map(({ node: child }) => child) }, changed: true }
        : { node, changed: false };
    }
    if (node.type === "columns") {
      let changed = false;
      const columns = node.columns.map((column) => column.map((child) => {
        const result = visit(child);
        changed ||= result.changed;
        return result.node;
      }));
      return changed ? { node: { ...node, columns }, changed: true } : { node, changed: false };
    }
    return { node, changed: false };
  }

  const result = visit(spec.root);
  return result.changed ? { ...spec, root: result.node } : null;
}
