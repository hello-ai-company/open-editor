import { validateStoredDocument, type DocumentScope, type DocumentStore, type StoredDocument } from "./documentStore";
import { parseContext } from "./selectedPersonalContext.mjs";
import { decodeBlocks, encodeBlocks, memoryRefs, revisionToken, type ServerBlock, type MemoryRef } from "./personalAiBlockCodec";
export const syntheticHostScope: DocumentScope = { actorId: "00000000-0000-4000-8000-000000000101", workspaceId: "00000000-0000-4000-8000-000000000102" };
export type HostMemory = { id: string; version: number; status: string; content: string | null; assertion: string };
export type HostProposal = { id: string; baseRevision: number; context: ReturnType<typeof parseContext> };
export type HostDocument = StoredDocument & { undoAvailable?: boolean };
type OwnerResponse = { id: string; workspace_id: string; created_by: string; version: number; title: string; updated_at: string; personal_save_contract: string; content_revision: string; blocks: ServerBlock[] };
type History = { id: string; document_id: string; created_by: string; name: string; title: string; snapshot: { format: string; document_version: number; server_blocks: ServerBlock[] } };
const AI_HISTORY = "Before OpenEditor AI review";
const conflict = (code: string) => /version_conflict|document_conflict/.test(code) ? "document_conflict" : code;
/** Only the isolated synthetic loopback host; actual PR120 owner/CAS/history APIs. */
export function createLocalPersonalAiHost(base = "http://127.0.0.1:8189", scope = syntheticHostScope) {
  if (base !== "http://127.0.0.1:8189") throw new Error("local_host_only");
  const cached = new Map<string, OwnerResponse>();
  const request = async <T>(path: string, payload?: unknown, method = payload === undefined ? "GET" : "POST"): Promise<T> => {
    let response: Response;
    try { response = await fetch(base + path, { method, credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(10000), headers: { "Content-Type": "application/json", "X-OpenEditor-Synthetic": "1", "X-Local-Test-Actor": scope.actorId }, body: payload === undefined ? undefined : JSON.stringify(payload) }); }
    catch { throw new Error(method === "PUT" ? "save_outcome_unknown" : "local_host_unavailable"); }
    try {
      const text = await response.text();
      if (text.length > 5 * 1024 * 1024) throw new Error("oversized_host_response");
      const data = JSON.parse(text);
      if (method === "PUT" && response.status >= 500) throw new Error("save_outcome_unknown");
      if (!response.ok) throw new Error(conflict(typeof data.code === "string" ? data.code : "local_host_failed"));
      return data as T;
    } catch (error) { if (method === "PUT" && response.ok) throw new Error("save_outcome_unknown"); throw error; }
  };
  const path = (id: string) => `/api/v1/documents/${encodeURIComponent(id)}`;
  const validate = (raw: OwnerResponse, id: string): HostDocument => {
    if (!raw || raw.id !== id || raw.created_by !== scope.actorId || raw.workspace_id !== scope.workspaceId || raw.personal_save_contract !== "owner_cas_history_v1") throw new Error("invalid_saved_document");
    const document = decodeBlocks(raw.blocks, id, scope);
    if (raw.content_revision !== revisionToken(raw.blocks)) throw new Error("invalid_content_revision");
    return validateStoredDocument({ ...scope, id, schemaVersion: 1, title: raw.title, revision: raw.version, updatedAt: raw.updated_at, document }, scope);
  };
  const history = async (id: string): Promise<History[]> => {
    const rows = await request<History[]>(path(id) + "/versions");
    if (!Array.isArray(rows) || rows.some(h => h.document_id !== id || h.created_by !== scope.actorId)) throw new Error("invalid_document_history");
    return rows;
  };
  const load = async (id: string): Promise<HostDocument> => {
    const raw = await request<OwnerResponse>(path(id) + "?personal_owner=true");
    const doc = validate(raw, id);
    const rows = await history(id);
    cached.set(id, structuredClone(raw));
    return { ...doc, undoAvailable: rows.some(h => h.name === AI_HISTORY && h.snapshot?.format === "personal_ai_blocks_v1" && h.snapshot.document_version === doc.revision - 1) };
  };
  const put = async (doc: StoredDocument, blocks: ServerBlock[], memories: MemoryRef[], name: string, title = doc.title): Promise<HostDocument> => {
    const before = cached.get(doc.id);
    if (!before || before.version !== doc.revision) throw new Error("document_conflict");
    decodeBlocks(blocks, doc.id, scope);
    const result = await request<{ document_id: string; document_version: number; content_revision: string; undo_version_id: string; blocks: ServerBlock[] }>(path(doc.id) + "/blocks/restore", {
      expected_content_revision: before.content_revision, blocks,
      personal_save: { expected_document_version: doc.revision, title, history_name: name, memories }
    }, "PUT");
    if (result.document_id !== doc.id || result.document_version !== doc.revision + 1 || typeof result.undo_version_id !== "string") throw new Error("save_outcome_unknown");
    const raw = { ...before, title, version: result.document_version, updated_at: new Date().toISOString(), blocks: result.blocks, content_revision: result.content_revision };
    let next: HostDocument;
    try { next = validate(raw, doc.id); } catch { throw new Error("save_outcome_unknown"); }
    cached.set(doc.id, raw);
    return { ...next, undoAvailable: name === AI_HISTORY };
  };
  const store: DocumentStore = {
    list: async () => { const ids = await request<string[]>(`/local-editor/${scope.workspaceId}/document-ids`); if (!Array.isArray(ids) || ids.length > 1000) throw new Error("invalid_document_list"); return Promise.all(ids.map(load)); },
    load,
    create: async (title, document) => {
      const id = crypto.randomUUID(); const blocks = encodeBlocks(document, id, scope);
      await request("/api/v1/documents", { id, workspace_id: scope.workspaceId, title, privacy_level: "personal", metadata: { open_editor_synthetic: true } });
      return put(await load(id), blocks, [], "Before OpenEditor initial content");
    },
    save: async (id, expectedRevision, document) => {
      const raw = cached.get(id); if (!raw || raw.version !== expectedRevision) throw new Error("document_conflict");
      return put(validate(raw, id), encodeBlocks(document, id, scope, raw.blocks), [], "Before OpenEditor human edit");
    }
  };
  const verify = async (doc: StoredDocument, memories: MemoryRef[]) => {
    const context = parseContext(await request(`/api/v1/personal-context/${scope.workspaceId}/editor-context`, { document_id: doc.id, document_version: doc.revision, memories }));
    if (context.document_id !== doc.id || context.document_version !== doc.revision || JSON.stringify(context.memories.map(m => ({ memory_id: m.memory_id, version: m.version }))) !== JSON.stringify(memories)) throw new Error("source_or_document_changed");
    return context;
  };
  return { store, verify,
    memories: async () => request<HostMemory[]>(`/local-editor/${scope.workspaceId}/memories`),
    propose: async (doc: StoredDocument, memories: MemoryRef[]): Promise<HostProposal> => ({ id: crypto.randomUUID(), baseRevision: doc.revision, context: await verify(doc, memories) }),
    accept: async (doc: StoredDocument, proposal: HostProposal, selected: string[]) => {
      if (proposal.context.document_id !== doc.id || proposal.baseRevision !== doc.revision || proposal.context.document_version !== doc.revision || !selected.length || new Set(selected).size !== selected.length || selected.some(id => !proposal.context.memories.some(m => m.memory_id === id))) throw new Error("document_conflict");
      const raw = cached.get(doc.id); if (!raw || raw.version !== doc.revision) throw new Error("document_conflict");
      const next = structuredClone(doc.document), sources = new Map<string, MemoryRef[]>();
      for (const m of proposal.context.memories.filter(m => selected.includes(m.memory_id))) {
        const id = crypto.randomUUID(); sources.set(id, [{ memory_id: m.memory_id, version: m.version }]);
        next.blocks.push({ id, type: "paragraph", content: [{ type: "text", text: `${m.assertion === "user_statement" ? "本人発言" : "推測・提案"}: ${m.content} (source ${m.source_turn_id} · ${m.source_date})`, styles: {} }] });
      }
      return put(doc, encodeBlocks(next, doc.id, scope, raw.blocks, sources), proposal.context.memories.map(m => ({ memory_id: m.memory_id, version: m.version })), AI_HISTORY);
    },
    undo: async (doc: StoredDocument) => {
      const current = await load(doc.id); if (current.revision !== doc.revision) throw new Error("document_conflict");
      const rows = await history(doc.id);
      const previous = rows.find(h => h.name === AI_HISTORY && h.snapshot?.format === "personal_ai_blocks_v1" && h.snapshot.document_version === doc.revision - 1);
      if (!previous) throw new Error("undo_unavailable");
      decodeBlocks(previous.snapshot.server_blocks, doc.id, scope);
      return put(doc, previous.snapshot.server_blocks, memoryRefs(previous.snapshot.server_blocks), "Before OpenEditor undo", previous.title);
    }
  };
}
export type LocalPersonalAiHost = ReturnType<typeof createLocalPersonalAiHost>;
