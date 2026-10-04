import { describe, expect, it } from "vitest";
import { createLocalPersonalAiHost, syntheticHostScope as scope } from "../src/localPersonalAi";
import { decodeBlocks, encodeBlocks, memoryRefs, revisionToken } from "../src/personalAiBlockCodec";
const id = "00000000-0000-4000-8000-000000000201";
const bid = "00000000-0000-4000-8000-000000000202";
const memory = { memory_id: "00000000-0000-4000-8000-000000000203", version: 2 };
const document = { schemaVersion: 1, blocks: [{ id: bid, type: "heading", props: { level: 2, custom: "kept" }, content: [{ type: "text", text: "Synthetic", styles: { bold: true } }], children: [{ id: "00000000-0000-4000-8000-000000000204", type: "paragraph", content: [] }] }] };
const blocks = () => encodeBlocks(document, id, scope, [], new Map([[bid, [memory]]]));
const owner = () => { const b = blocks(); return { id, workspace_id: scope.workspaceId, created_by: scope.actorId, title: "Synthetic", version: 4, updated_at: "2026-10-04T12:00:00Z", blocks: b, content_revision: revisionToken(b), personal_save_contract: "owner_cas_history_v1" }; };
describe("Personal-AI owner/CAS/history contract", () => {
  it("round trips nested styled blocks and keeps historical source versions", () => {
    const raw = blocks();
    expect(decodeBlocks(raw, id, scope)).toEqual(document);
    expect(memoryRefs(raw)).toEqual([memory]);
    expect(memoryRefs(encodeBlocks(document, id, scope, raw))).toEqual([memory]);
  });
  it("rejects orphan trees, foreign scopes, unsupported native rich content and source version conflicts", () => {
    const raw = blocks();
    expect(() => decodeBlocks([{ ...raw[0], parent_block_id: raw[1].id }, raw[1]], id, scope)).toThrow("invalid_host_tree");
    expect(() => decodeBlocks(raw, id, { ...scope, workspaceId: "other" })).toThrow("invalid_host_blocks");
    expect(() => decodeBlocks([{ ...raw[0], properties: {}, content: { kind: "text", text: "rich", marks: [{ type: "bold" }] } }], id, scope)).toThrow("unsupported_host_block");
    raw[1].properties.metadata = { open_editor: { sources: [{ ...memory, version: 3 }] } };
    expect(() => memoryRefs(raw)).toThrow("invalid_history_sources");
  });
  it("fails closed if an older host silently ignores personal_owner", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ ...owner(), personal_save_contract: undefined }));
    try { await expect(createLocalPersonalAiHost().store.load(id)).rejects.toThrow("invalid_saved_document"); }
    finally { globalThis.fetch = original; }
  });
  it("sends both current CAS values and never retries an ambiguous PUT", async () => {
    const original = globalThis.fetch; let put = 0; let payload: unknown;
    globalThis.fetch = async (url, options) => {
      if (options?.method === "PUT") { put++; payload = JSON.parse(options.body as string); throw new Error("Synthetic lost response"); }
      return new Response(JSON.stringify(String(url).endsWith('/versions') ? [] : owner()));
    };
    try {
      const host = createLocalPersonalAiHost(), saved = await host.store.load(id);
      await expect(host.store.save(id, saved.revision, document)).rejects.toThrow("save_outcome_unknown");
      expect(put).toBe(1);
      expect(payload).toMatchObject({ expected_content_revision: owner().content_revision, personal_save: { expected_document_version: 4, memories: [] } });
    } finally { globalThis.fetch = original; }
  });
});
