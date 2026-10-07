import { createEditorDocument, isEditorDocument, type EditorBlock, type EditorDocument } from "@hello-ai-company/editor-core";

export const DOCUMENT_COLUMNS_TYPE = "oeColumns" as const;
export const DOCUMENT_COLUMN_TYPE = "oeColumn" as const;
export const MAX_DOCUMENT_COLUMNS = 6;
export type DocumentColumnsAction =
  | { type: "width"; columnId: string; width: number }
  | { type: "reorder"; groupId: string; columnId: string; index: number }
  | { type: "move"; blockId: string; columnId: string; index: number }
  | { type: "remove-column"; groupId: string; columnId: string; destinationId: string }
  | { type: "unwrap"; groupId: string };

export function validateDocumentColumns(document: unknown): string[] {
  if (!isEditorDocument(document)) return ["Invalid document"];
  const issues: string[] = [], ids = new Set<string>();
  const visit = (block: EditorBlock, parent?: EditorBlock): void => {
    if (ids.has(block.id)) issues.push(`Duplicate block ID: ${block.id}`);
    ids.add(block.id);
    if (block.type === DOCUMENT_COLUMNS_TYPE) {
      if (!block.children || block.children.length < 2 || block.children.length > MAX_DOCUMENT_COLUMNS) issues.push(`Columns ${block.id} must contain 2..${MAX_DOCUMENT_COLUMNS} columns`);
      if (block.children?.some(child => child.type !== DOCUMENT_COLUMN_TYPE)) issues.push(`Columns ${block.id} contains a non-column`);
      const gap = block.props?.gap ?? 16;
      if (typeof gap !== "number" || !Number.isFinite(gap) || gap < 0 || gap > 64) issues.push(`Invalid column gap: ${block.id}`);
    }
    if (block.type === DOCUMENT_COLUMN_TYPE) {
      if (parent?.type !== DOCUMENT_COLUMNS_TYPE) issues.push(`Orphan column: ${block.id}`);
      const width = block.props?.width ?? 1;
      if (typeof width !== "number" || !Number.isFinite(width) || width < 0.1 || width > 10) issues.push(`Invalid column width: ${block.id}`);
    }
    for (const child of block.children ?? []) visit(child, block);
  };
  for (const root of document.blocks) visit(root);
  return issues;
}

export function createDocumentColumns(
  columns: readonly (readonly EditorBlock[])[],
  options: { id?: string; widths?: readonly number[]; idFactory?: () => string } = {}
): EditorBlock {
  const id = options.idFactory ?? (() => crypto.randomUUID());
  if (options.widths && options.widths.length !== columns.length) throw new TypeError("Every column needs one width");
  const group: EditorBlock = { id: options.id ?? id(), type: DOCUMENT_COLUMNS_TYPE, props: { gap: 16 }, children: columns.map((children, index) => ({
    id: id(), type: DOCUMENT_COLUMN_TYPE, props: { width: options.widths?.[index] ?? 1 }, children: [...children]
  })) };
  const document = createEditorDocument([group]);
  const issues = validateDocumentColumns(document);
  if (issues.length) throw new TypeError(issues.join("; "));
  return document.blocks[0]!;
}

/** Pure, detached structural edit. Invalid edits never return a partial tree. */
export function updateDocumentColumns(document: EditorDocument, action: DocumentColumnsAction): EditorDocument {
  const before = validateDocumentColumns(document);
  if (before.length) throw new TypeError(before.join("; "));
  const next = createEditorDocument(document.blocks);
  function locate(id: string, siblings = next.blocks): { block: EditorBlock; siblings: EditorBlock[]; index: number } {
    for (let index = 0; index < siblings.length; index++) {
      const block = siblings[index]!;
      if (block.id === id) return { block, siblings, index };
      if (block.children) {
        try { return locate(id, block.children); } catch { /* Search the next branch. */ }
      }
    }
    throw new TypeError(`Block unavailable: ${id}`);
  }
  if (action.type === "width") {
    const column = locate(action.columnId).block;
    if (column.type !== DOCUMENT_COLUMN_TYPE) throw new TypeError("Width target must be a column");
    column.props = { ...column.props, width: action.width };
  } else if (action.type === "move") {
    const source = locate(action.blockId), destination = locate(action.columnId).block;
    if (destination.type !== DOCUMENT_COLUMN_TYPE || source.block.type === DOCUMENT_COLUMN_TYPE) throw new TypeError("Invalid move target or source");
    const contains = (block: EditorBlock): boolean => block.id === destination.id || Boolean(block.children?.some(contains));
    if (contains(source.block)) throw new TypeError("Move would create a cycle");
    destination.children ??= [];
    const count = destination.children.length - (source.siblings === destination.children ? 1 : 0);
    if (!Number.isInteger(action.index) || action.index < 0 || action.index > count) throw new TypeError("Invalid move index");
    source.siblings.splice(source.index, 1);
    destination.children.splice(action.index, 0, source.block);
  } else {
    const group = locate(action.groupId);
    if (group.block.type !== DOCUMENT_COLUMNS_TYPE) throw new TypeError("Target must be columns");
    const columns = group.block.children!;
    if (action.type === "unwrap") group.siblings.splice(group.index, 1, ...columns.flatMap(column => column.children ?? []));
    else {
      const index = columns.findIndex(column => column.id === action.columnId);
      if (index < 0) throw new TypeError("Column unavailable");
      if (action.type === "reorder") {
        if (!Number.isInteger(action.index) || action.index < 0 || action.index >= columns.length) throw new TypeError("Invalid column index");
        columns.splice(action.index, 0, columns.splice(index, 1)[0]!);
      } else {
        const destination = columns.find(column => column.id === action.destinationId);
        if (columns.length <= 2 || !destination || destination.id === action.columnId) throw new TypeError("Keep at least two columns and select another destination");
        destination.children = [...(destination.children ?? []), ...(columns[index]!.children ?? [])];
        columns.splice(index, 1);
      }
    }
  }
  const after = validateDocumentColumns(next);
  if (after.length) throw new TypeError(after.join("; "));
  return next;
}
