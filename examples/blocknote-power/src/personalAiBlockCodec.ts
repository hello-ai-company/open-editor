import { isEditorDocument, type EditorBlock, type EditorDocument } from "@hello-ai-company/editor-core";
import type { DocumentScope } from "./documentStore";
export type MemoryRef = { memory_id: string; version: number };
export type ServerBlock = { id: string; document_id: string; workspace_id?: string; parent_block_id: string | null; type: string; position: string; version: number; content: Record<string, unknown>; properties: { metadata?: Record<string, unknown>; [key: string]: unknown }; [key: string]: unknown };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mapping: Record<string, string> = { paragraph: "paragraph", heading: "heading", bulletListItem: "bullet_list", numberedListItem: "numbered_list", checkListItem: "checklist", quote: "quote", codeBlock: "code", toggleListItem: "toggle", divider: "divider" };
const reverse = Object.fromEntries(Object.entries(mapping).map(([a, b]) => [b, a]));
export const revisionToken = (blocks: ServerBlock[]) => blocks.map(b => `${b.id}:${b.version}`).sort().join("|");
/** Preserve neutral blocks and host source fields without duplicating child trees. */
export function encodeBlocks(document: EditorDocument, id: string, scope: DocumentScope, previous: ServerBlock[] = [], sources: Map<string, MemoryRef[]> = new Map()): ServerBlock[] {
  if (!isEditorDocument(document)) throw new Error("invalid_saved_document");
  const old = new Map(previous.map(b => [b.id, b]));
  const result: ServerBlock[] = [];
  const walk = (blocks: EditorBlock[], parent: string | null) => blocks.forEach((b, index) => {
    if (!uuid.test(b.id)) throw new Error("host_block_uuid_required");
    const prior = old.get(b.id);
    const { children: _children, ...neutral } = b;
    const inherited = prior?.properties.metadata?.open_editor as { sources?: MemoryRef[] } | undefined;
    const refs = sources.get(b.id) ?? inherited?.sources ?? [];
    const text = Array.isArray(b.content) ? b.content.map(item => typeof item === "object" && item && !Array.isArray(item) && typeof item.text === "string" ? item.text : "").join("") : "";
    result.push({ ...prior, id: b.id, document_id: id, workspace_id: scope.workspaceId, parent_block_id: parent, type: mapping[b.type] ?? "editor_tool", position: String(index).padStart(8, "0"), version: prior?.version ?? 1,
      content: mapping[b.type] ? { kind: "text", text, marks: [], inline_content: b.content ?? [] } : { kind: "editor_tool", tool_kind: b.type, tool_title: b.type, tool_body: text },
      properties: { ...prior?.properties, privacy_level: prior?.properties.privacy_level ?? "personal", metadata: { ...prior?.properties.metadata, open_editor: { schemaVersion: 1, block: neutral, sources: refs } } } });
    if (b.children) walk(b.children, b.id);
  });
  walk(document.blocks, null);
  return result;
}
export function decodeBlocks(value: unknown, id: string, scope: DocumentScope): EditorDocument {
  if (!Array.isArray(value) || value.length > 20000 || JSON.stringify(value).length > 4 * 1024 * 1024) throw new Error("invalid_host_blocks");
  const raw = value as ServerBlock[], tree = new Map<string, EditorBlock>(), seen = new Set<string>();
  for (const b of raw) {
    if (!b || !uuid.test(b.id) || seen.has(b.id) || b.document_id !== id || b.workspace_id !== scope.workspaceId || !Number.isSafeInteger(b.version) || b.version < 1 || typeof b.position !== "string" || !b.content || !b.properties || b.deleted_at) throw new Error("invalid_host_blocks");
    seen.add(b.id);
    const saved = b.properties.metadata?.open_editor as { schemaVersion?: number; block?: EditorBlock } | undefined;
    let block: EditorBlock;
    if (saved) {
      if (saved.schemaVersion !== 1 || !saved.block || saved.block.id !== b.id || saved.block.children !== undefined) throw new Error("unsupported_host_block");
      block = structuredClone(saved.block);
    } else {
      if (!reverse[b.type] || b.content.kind !== "text" || typeof b.content.text !== "string" || (Array.isArray(b.content.marks) && b.content.marks.length)) throw new Error("unsupported_host_block");
      block = { id: b.id, type: reverse[b.type], content: (b.content.inline_content ?? [{ type: "text", text: b.content.text, styles: {} }]) as EditorBlock["content"] };
    }
    tree.set(b.id, block);
  }
  const roots: EditorBlock[] = [];
  for (const b of [...raw].sort((a, b) => a.position.localeCompare(b.position))) {
    const block = tree.get(b.id)!;
    if (b.parent_block_id === null) roots.push(block);
    else { const parent = tree.get(b.parent_block_id); if (!parent || parent === block) throw new Error("invalid_host_tree"); (parent.children ??= []).push(block); }
  }
  const reachable = new Set<string>();
  const visit = (blocks: EditorBlock[], depth = 0) => { if (depth > 64) throw new Error("invalid_host_tree"); for (const b of blocks) { if (reachable.has(b.id)) throw new Error("invalid_host_tree"); reachable.add(b.id); if (b.children) visit(b.children, depth + 1); } };
  visit(roots);
  const document = { schemaVersion: 1, blocks: roots };
  if (reachable.size !== raw.length || !isEditorDocument(document)) throw new Error("invalid_host_tree");
  return document;
}
/** Historical bodies retain memory versions; undo cannot silently resurrect revoked sources. */
export function memoryRefs(blocks: ServerBlock[]): MemoryRef[] {
  const refs = new Map<string, number>();
  for (const b of blocks) {
    const saved = b.properties.metadata?.open_editor as { sources?: MemoryRef[] } | undefined;
    for (const r of saved?.sources ?? []) {
      if (!uuid.test(r.memory_id) || !Number.isSafeInteger(r.version) || r.version < 1 || (refs.has(r.memory_id) && refs.get(r.memory_id) !== r.version)) throw new Error("invalid_history_sources");
      refs.set(r.memory_id, r.version);
    }
  }
  if (refs.size > 12) throw new Error("too_many_history_sources");
  return [...refs].map(([memory_id, version]) => ({ memory_id, version }));
}
