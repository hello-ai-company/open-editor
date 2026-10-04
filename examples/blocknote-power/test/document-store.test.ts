import { describe, expect, it } from "vitest";
import { validateStoredDocument, browserScope } from "../src/documentStore";
import { createLocalPersonalAiHost, syntheticHostScope } from "../src/localPersonalAi";

const saved = () => ({ ...browserScope, schemaVersion: 1, id: "00000000-0000-4000-8000-000000000001", title: "Synthetic document", revision: 1, updatedAt: "2026-10-04T12:00:00Z", document: { schemaVersion: 1, blocks: [{ id: "paragraph", type: "paragraph", content: [{ type: "text", text: "Synthetic", styles: {} }] }] } });
describe("local saved documents", () => {
  it("retains a validated detached snapshot", () => {
    const raw = saved(), restored = validateStoredDocument(raw, browserScope);
    raw.document.blocks[0].content[0].text = "Later edit";
    expect(JSON.stringify(restored)).toContain("Synthetic");
    expect(JSON.stringify(restored)).not.toContain("Later edit");
  });
  it("rejects other owners, workspaces, unsupported schema, duplicates and oversized storage", () => {
    for (const patch of [{ actorId: "other" }, { workspaceId: "other" }, { schemaVersion: 2 }, { revision: 0 }, { document: { schemaVersion: 2, blocks: [] } }, { title: "a".repeat(501) }]) {
      expect(() => validateStoredDocument({ ...saved(), ...patch }, browserScope)).toThrow();
    }
    const duplicate = saved(); duplicate.document.blocks.push(duplicate.document.blocks[0]);
    expect(() => validateStoredDocument(duplicate, browserScope)).toThrow("duplicate_block_id");
    const oversized = saved(); oversized.document.blocks[0].content[0].text = "a".repeat(4 * 1024 * 1024);
    expect(() => validateStoredDocument(oversized, browserScope)).toThrow("invalid_saved_document");
  });
});
describe("local Personal-AI host response boundaries", () => {
  it("cannot connect a production host", () => {
    expect(() => createLocalPersonalAiHost("https://example.com")).toThrow("local_host_only");
  });
  it("fails closed for another account even when the HTTP response is successful", async () => {
    const fetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ ...saved(), ...syntheticHostScope, actorId: "other-user" }));
    try { await expect(createLocalPersonalAiHost().store.load(saved().id)).rejects.toThrow("invalid_saved_document"); }
    finally { globalThis.fetch = fetch; }
  });
  it("binds verification to the target ID/version and selected memory versions", async () => {
    const fetch = globalThis.fetch;
    let posted: unknown;
    globalThis.fetch = async (_url, options) => {
      posted = JSON.parse(options!.body as string);
      return new Response(JSON.stringify({ code: "editor_document_version_conflict" }), { status: 409 });
    };
    try {
      const host = createLocalPersonalAiHost();
      const doc = validateStoredDocument({ ...saved(), ...syntheticHostScope, revision: 4 }, syntheticHostScope);
      const memories = [{ memory_id: "00000000-0000-4000-8000-000000000010", version: 3 }];
      await expect(host.verify(doc, memories)).rejects.toThrow("document_conflict");
      expect(posted).toEqual({ document_id: doc.id, document_version: 4, memories });
    } finally { globalThis.fetch = fetch; }
  });
});
