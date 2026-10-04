import { validateStoredDocument, type DocumentScope, type DocumentStore, type StoredDocument } from "./documentStore";
import { parseContext } from "./selectedPersonalContext.mjs";

export const syntheticHostScope: DocumentScope = {
  actorId: "00000000-0000-4000-8000-000000000101",
  workspaceId: "00000000-0000-4000-8000-000000000102"
};
export type HostMemory = { id: string; version: number; status: string; content: string | null; assertion: string };
export type HostProposal = { id: string; baseRevision: number; context: ReturnType<typeof parseContext> };
export type HostDocument = StoredDocument & { undoAvailable?: boolean };

/** Local synthetic harness only. No OAuth, production host, secrets or cached grants. */
export function createLocalPersonalAiHost(base = "http://127.0.0.1:8189", scope = syntheticHostScope) {
  if (base !== "http://127.0.0.1:8189") throw new Error("local_host_only");
  const request = async <T>(path: string, payload?: unknown): Promise<T> => {
    const response = await fetch(base + path, {
      method: payload === undefined ? "GET" : "POST", credentials: "omit", cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json", "X-OpenEditor-Synthetic": "1", "X-Local-Test-Actor": scope.actorId },
      body: payload === undefined ? undefined : JSON.stringify(payload)
    });
    const text = await response.text();
    if (text.length > 5 * 1024 * 1024) throw new Error("oversized_host_response");
    const data = JSON.parse(text);
    if (!response.ok) throw new Error(typeof data.code === "string" ? data.code : "local_host_failed");
    return data as T;
  };
  const root = `/local-editor/${scope.workspaceId}`;
  const validate = (value: unknown): HostDocument => {
    const result = validateStoredDocument(value, scope);
    return { ...result, undoAvailable: (value as HostDocument).undoAvailable === true };
  };
  const store: DocumentStore = {
    list: async () => (await request<unknown[]>(root + "/documents")).map(validate),
    load: async id => validate(await request(root + "/documents/" + encodeURIComponent(id))),
    create: async (title, document) => validate(await request(root + "/documents", { title, document })),
    save: async (id, expectedRevision, document) => validate(await request(root + "/documents/" + encodeURIComponent(id) + "/save", { expected_revision: expectedRevision, document }))
  };
  return {
    store,
    memories: async () => await request<HostMemory[]>(root + "/memories"),
    propose: async (document: StoredDocument, memories: Array<{ memory_id: string; version: number }>): Promise<HostProposal> => {
      const proposal = await request<HostProposal>(root + "/documents/" + document.id + "/propose", { expected_revision: document.revision, memories });
      const context = parseContext(proposal.context);
      if (context.document_id !== document.id || context.document_version !== document.revision || proposal.baseRevision !== document.revision ||
        JSON.stringify(context.memories.map(m => ({ memory_id: m.memory_id, version: m.version }))) !== JSON.stringify(memories)) throw new Error("source_or_document_changed");
      return { ...proposal, context };
    },
    accept: async (document: StoredDocument, proposal: HostProposal, selected: string[]) => validate(await request(root + "/documents/" + document.id + "/accept", { expected_revision: document.revision, proposal_id: proposal.id, selected_memory_ids: selected })),
    undo: async (document: StoredDocument) => validate(await request(root + "/documents/" + document.id + "/undo", { expected_revision: document.revision })),
    // This POST is the exact PR119 route, not an imported JSON grant.
    verify: async (document: StoredDocument, memories: Array<{ memory_id: string; version: number }>) => parseContext(await request(`/api/v1/personal-context/${scope.workspaceId}/editor-context`, { document_id: document.id, document_version: document.revision, memories }))
  };
}
export type LocalPersonalAiHost = ReturnType<typeof createLocalPersonalAiHost>;
