import type {
  CanvasBlockElementRef,
  CanvasBreakpoint,
  CanvasColumnsNode,
  CanvasGridNode,
  CanvasGroupElement,
  CanvasLayoutNode,
  CanvasLayoutSpec,
  CanvasStackNode,
  ResponsiveValue
} from "./index.js";

type GapNode = CanvasStackNode | CanvasGridNode | CanvasColumnsNode;
type ChildContainer = CanvasStackNode | CanvasGridNode | CanvasGroupElement;

function isGapNode(node: CanvasLayoutNode): node is GapNode {
  return node.type === "stack" || node.type === "grid" || node.type === "columns";
}

function isChildContainer(node: CanvasLayoutNode): node is ChildContainer {
  return node.type === "stack" || node.type === "grid" || node.type === "section" || node.type === "frame";
}

function childrenOf(node: CanvasLayoutNode): CanvasLayoutNode[] {
  if (node.type === "stack" || node.type === "grid" || node.type === "section" || node.type === "frame") return node.children;
  if (node.type === "columns") return node.columns.flat();
  if (node.type === "absolute") return node.items.map(({ element }) => element);
  return [];
}

export function findCanvasNode(root: CanvasLayoutNode, nodeId: string): CanvasLayoutNode | undefined {
  return flattenCanvasNodes(root).find((node) => node.id === nodeId);
}

export function flattenCanvasNodes(root: CanvasLayoutNode): CanvasLayoutNode[] {
  const nodes: CanvasLayoutNode[] = [];
  const pending = [root];
  const visited = new WeakSet<object>();
  while (pending.length > 0) {
    if (nodes.length >= 1000) break;
    const current = pending.pop();
    if (!current) continue;
    if (visited.has(current)) continue;
    visited.add(current);
    nodes.push(current);
    const children = childrenOf(current);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child) pending.push(child);
    }
  }
  return nodes;
}

export function resolveResponsiveValue<T>(
  value: ResponsiveValue<T> | undefined,
  breakpoint: CanvasBreakpoint
): T | undefined {
  if (!value) return undefined;
  if (breakpoint === "mobile") return value.mobile;
  if (breakpoint === "tablet") return value.tablet ?? value.mobile;
  return value.desktop ?? value.tablet ?? value.mobile;
}

function changeSiblingOrder(
  root: CanvasLayoutNode,
  nodeId: string,
  change: (siblings: CanvasLayoutNode[], index: number) => CanvasLayoutNode[] | undefined
): { root: CanvasLayoutNode; changed: boolean } {
  function visit(node: CanvasLayoutNode): { node: CanvasLayoutNode; changed: boolean } {
    if (node.type === "stack" || node.type === "grid" || node.type === "section" || node.type === "frame") {
      const index = node.children.findIndex((child) => child.id === nodeId);
      if (index >= 0) {
        const children = change(node.children, index);
        return children ? { node: { ...node, children }, changed: true } : { node, changed: false };
      }
      for (let childIndex = 0; childIndex < node.children.length; childIndex += 1) {
        const child = node.children[childIndex];
        if (!child) continue;
        const result = visit(child);
        if (result.changed) {
          const children = [...node.children];
          children[childIndex] = result.node;
          return { node: { ...node, children }, changed: true };
        }
      }
    } else if (node.type === "columns") {
      for (let columnIndex = 0; columnIndex < node.columns.length; columnIndex += 1) {
        const column = node.columns[columnIndex];
        if (!column) continue;
        const index = column.findIndex((child) => child.id === nodeId);
        if (index >= 0) {
          const nextColumn = change(column, index);
          if (!nextColumn) return { node, changed: false };
          const columns = [...node.columns];
          columns[columnIndex] = nextColumn;
          return { node: { ...node, columns }, changed: true };
        }
        for (let childIndex = 0; childIndex < column.length; childIndex += 1) {
          const child = column[childIndex];
          if (!child) continue;
          const result = visit(child);
          if (result.changed) {
            const nextColumn = [...column];
            nextColumn[childIndex] = result.node;
            const columns = [...node.columns];
            columns[columnIndex] = nextColumn;
            return { node: { ...node, columns }, changed: true };
          }
        }
      }
    } else if (node.type === "absolute") {
      const index = node.items.findIndex(({ element }) => element.id === nodeId);
      if (index >= 0) {
        const asNodes: CanvasLayoutNode[] = node.items.map(({ element }) => element);
        const nextNodes = change(asNodes, index);
        if (!nextNodes) return { node, changed: false };
        const rectById = new Map(node.items.map(({ element, rect }) => [element.id, rect]));
        const fallbackRect = node.items[index]!.rect;
        const items = nextNodes.map((element) => ({
          element: element as CanvasBlockElementRef,
          rect: rectById.get(element.id) ?? fallbackRect
        }));
        return { node: { ...node, items }, changed: true };
      }
    }
    return { node, changed: false };
  }

  const result = visit(root);
  return { root: result.node, changed: result.changed };
}

export function reorderCanvasNode(
  spec: CanvasLayoutSpec,
  nodeId: string,
  direction: -1 | 1
): CanvasLayoutSpec | null {
  if (nodeId === spec.root.id) return null;
  const result = changeSiblingOrder(spec.root, nodeId, (siblings, index) => {
    const target = index + direction;
    if (target < 0 || target >= siblings.length) return undefined;
    const next = [...siblings];
    [next[index], next[target]] = [next[target]!, next[index]!];
    return next;
  });
  return result.changed ? { ...spec, root: result.root } : null;
}

function allLayoutIds(root: CanvasLayoutNode): Set<string> {
  return new Set(flattenCanvasNodes(root).map(({ id }) => id));
}

function nextLayoutId(source: string, used: Set<string>): string {
  const base = source.slice(0, 240);
  let suffix = 1;
  let id = `${base}:copy:${suffix}`;
  while (used.has(id)) {
    suffix += 1;
    id = `${base}:copy:${suffix}`;
  }
  used.add(id);
  return id;
}

function cloneWithFreshIds(node: CanvasLayoutNode, used: Set<string>): CanvasLayoutNode {
  const id = nextLayoutId(node.id, used);
  if (node.type === "stack" || node.type === "grid" || node.type === "section" || node.type === "frame") {
    return { ...node, id, children: node.children.map((child) => cloneWithFreshIds(child, used)) };
  }
  if (node.type === "columns") {
    return { ...node, id, columns: node.columns.map((column) => column.map((child) => cloneWithFreshIds(child, used))) };
  }
  if (node.type === "absolute") {
    return {
      ...node,
      id,
      items: node.items.map((item) => ({
        ...item,
        element: cloneWithFreshIds(item.element, used) as typeof item.element
      }))
    };
  }
  return { ...node, id };
}

export function duplicateCanvasNode(spec: CanvasLayoutSpec, nodeId: string): CanvasLayoutSpec | null {
  if (nodeId === spec.root.id || !findCanvasNode(spec.root, nodeId)) return null;
  const used = allLayoutIds(spec.root);
  const source = findCanvasNode(spec.root, nodeId);
  if (!source) return null;
  const copy = cloneWithFreshIds(source, used);
  const result = changeSiblingOrder(spec.root, nodeId, (siblings, index) => {
    const next = [...siblings];
    next.splice(index + 1, 0, copy);
    return next;
  });
  return result.changed ? { ...spec, root: result.root } : null;
}

function containsNode(root: CanvasLayoutNode, nodeId: string): boolean {
  return flattenCanvasNodes(root).some(({ id }) => id === nodeId);
}

function removeNode(root: CanvasLayoutNode, nodeId: string): { root: CanvasLayoutNode; removed?: CanvasLayoutNode } {
  if (root.type === "stack" || root.type === "grid" || root.type === "section" || root.type === "frame") {
    const index = root.children.findIndex((child) => child.id === nodeId);
    if (index >= 0) {
      const children = [...root.children];
      const [removed] = children.splice(index, 1);
      return { root: { ...root, children }, removed };
    }
    for (let childIndex = 0; childIndex < root.children.length; childIndex += 1) {
      const child = root.children[childIndex];
      if (!child) continue;
      const result = removeNode(child, nodeId);
      if (result.removed) {
        const children = [...root.children];
        children[childIndex] = result.root;
        return { root: { ...root, children }, removed: result.removed };
      }
    }
  } else if (root.type === "columns") {
    for (let columnIndex = 0; columnIndex < root.columns.length; columnIndex += 1) {
      const column = root.columns[columnIndex];
      if (!column) continue;
      const index = column.findIndex((child) => child.id === nodeId);
      if (index >= 0) {
        const nextColumn = [...column];
        const [removed] = nextColumn.splice(index, 1);
        const columns = [...root.columns];
        columns[columnIndex] = nextColumn;
        return { root: { ...root, columns }, removed };
      }
      for (let childIndex = 0; childIndex < column.length; childIndex += 1) {
        const child = column[childIndex];
        if (!child) continue;
        const result = removeNode(child, nodeId);
        if (result.removed) {
          const nextColumn = [...column];
          nextColumn[childIndex] = result.root;
          const columns = [...root.columns];
          columns[columnIndex] = nextColumn;
          return { root: { ...root, columns }, removed: result.removed };
        }
      }
    }
  } else if (root.type === "absolute") {
    const index = root.items.findIndex(({ element }) => element.id === nodeId);
    if (index >= 0) {
      const items = [...root.items];
      const [removed] = items.splice(index, 1);
      return { root: { ...root, items }, removed: removed?.element };
    }
  }
  return { root };
}

function addToContainer(root: CanvasLayoutNode, containerId: string, child: CanvasLayoutNode): { root: CanvasLayoutNode; added: boolean } {
  if (root.id === containerId) {
    if (isChildContainer(root)) return { root: { ...root, children: [...root.children, child] }, added: true };
    if (root.type === "columns" && root.columns.length > 0) {
      const columns = [...root.columns];
      columns[0] = [...(columns[0] ?? []), child];
      return { root: { ...root, columns }, added: true };
    }
    return { root, added: false };
  }
  if (root.type === "stack" || root.type === "grid" || root.type === "section" || root.type === "frame") {
    for (let index = 0; index < root.children.length; index += 1) {
      const childNode = root.children[index];
      if (!childNode) continue;
      const result = addToContainer(childNode, containerId, child);
      if (result.added) {
        const children = [...root.children];
        children[index] = result.root;
        return { root: { ...root, children }, added: true };
      }
    }
  } else if (root.type === "columns") {
    for (let columnIndex = 0; columnIndex < root.columns.length; columnIndex += 1) {
      const column = root.columns[columnIndex];
      if (!column) continue;
      for (let childIndex = 0; childIndex < column.length; childIndex += 1) {
        const childNode = column[childIndex];
        if (!childNode) continue;
        const result = addToContainer(childNode, containerId, child);
        if (result.added) {
          const nextColumn = [...column];
          nextColumn[childIndex] = result.root;
          const columns = [...root.columns];
          columns[columnIndex] = nextColumn;
          return { root: { ...root, columns }, added: true };
        }
      }
    }
  }
  return { root, added: false };
}

export function moveCanvasNode(
  spec: CanvasLayoutSpec,
  nodeId: string,
  targetContainerId: string
): CanvasLayoutSpec | null {
  if (nodeId === spec.root.id || nodeId === targetContainerId || containsNode(findCanvasNode(spec.root, nodeId) ?? spec.root, targetContainerId)) return null;
  if (!findCanvasNode(spec.root, targetContainerId)) return null;
  const { root: withoutNode, removed } = removeNode(spec.root, nodeId);
  if (!removed) return null;
  const result = addToContainer(withoutNode, targetContainerId, removed);
  return result.added ? { ...spec, root: result.root } : null;
}

export function setCanvasNodeGap(
  spec: CanvasLayoutSpec,
  nodeId: string,
  breakpoint: CanvasBreakpoint,
  gap: number
): CanvasLayoutSpec | null {
  if (!Number.isFinite(gap) || gap < 0 || gap > 256) return null;
  let changed = false;
  function visit(node: CanvasLayoutNode): CanvasLayoutNode {
    if (node.id === nodeId && isGapNode(node)) {
      const responsive: ResponsiveValue<number> = { ...(node.gap ?? { mobile: 16 }), [breakpoint]: gap };
      changed = true;
      return { ...node, gap: responsive };
    }
    if (node.type === "stack" || node.type === "grid" || node.type === "section" || node.type === "frame") {
      const children = node.children.map(visit);
      return changed ? { ...node, children } : node;
    }
    if (node.type === "columns") {
      const columns = node.columns.map((column) => column.map(visit));
      return changed ? { ...node, columns } : node;
    }
    if (node.type === "absolute") {
      const items = node.items.map((item) => ({ ...item, element: visit(item.element) as typeof item.element }));
      return changed ? { ...node, items } : node;
    }
    return node;
  }
  const root = visit(spec.root);
  return changed ? { ...spec, root } : null;
}

export function getCanvasGapNode(root: CanvasLayoutNode, nodeId: string): GapNode | undefined {
  const pending: Array<{ node: CanvasLayoutNode; nearest?: GapNode }> = [{ node: root }];
  const visited = new WeakSet<object>();
  let count = 0;
  while (pending.length > 0 && count < 1000) {
    const current = pending.pop();
    if (!current || visited.has(current.node)) continue;
    visited.add(current.node);
    count += 1;
    if (current.node.id === nodeId) return isGapNode(current.node) ? current.node : current.nearest;
    const nearest = isGapNode(current.node) ? current.node : current.nearest;
    for (const child of childrenOf(current.node)) pending.push({ node: child, nearest });
  }
  return undefined;
}
