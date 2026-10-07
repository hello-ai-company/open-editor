import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createDocumentColumns } from "../src/document/columns.js";
import { exportLegacyNotesBlocks, importLegacyNotesBlocks } from "../src/document/legacyNotes.js";
import { applyNotesMetadataEdits } from "../src/document/notesMetadata.js";
import { createRevisionedNotesResourceEditor, validateNotesPropertyValue, type NotesResourceResult, type NotesResourceRequest } from "../src/workspace/revisionedNotesResource.js";
afterEach(() => { vi.useRealTimers(); });
describe("Notes revisioned editing", () => {
  it("awaits the host recovery journal before submission and suppresses a late journal after cancellation", async () => {
    const commit = vi.fn(); let journal!: () => void;
    const editor = createRevisionedNotesResourceEditor({ commit, lookupOperation: vi.fn() }, { resourceId: "row", beforeSubmit: () => new Promise(resolve => { journal = resolve; }) });
    const pending = editor.commit("r1", { kind: "patch", fields: { title: "Cancelled" } }); await Promise.resolve();
    expect(commit).not.toHaveBeenCalled(); editor.cancel(); journal();
    expect((await pending).status).toBe("cancelled"); expect(commit).not.toHaveBeenCalled();
  });
  it("cancels before submission without starting a write or creating an unknown operation", async () => {
    const commit = vi.fn(); const editor = createRevisionedNotesResourceEditor({ commit, lookupOperation: vi.fn() }, { resourceId: "row" });
    const pending = editor.commit("r1", { kind: "patch", fields: { title: "Cancelled" } }); editor.cancel();
    expect((await pending).status).toBe("cancelled"); expect(commit).not.toHaveBeenCalled(); expect(editor.getState().status).toBe("idle");
  });
  it("saves a new native paragraph and an inert widget without losing their editable source", () => {
    const { archive } = importLegacyNotesBlocks([]);
    const document = createEditorDocument([{ id: "new", type: "paragraph", props: { backgroundColor: "default", textColor: "default", textAlignment: "left" }, content: [{ type: "text", text: "新しい段落", styles: {} }] }, { id: "widget", type: "oeHtmlWidget", props: { html: "<p>独立</p>", css: "p{color:red}", javascript: "alert(1)", title: "Widget" } }]);
    const saved = exportLegacyNotesBlocks(document, archive, []);
    const reopened = importLegacyNotesBlocks(saved).document;
    expect(reopened.blocks[0]!.content).toEqual(document.blocks[0]!.content);
    expect(reopened.blocks[1]!.props).toEqual(document.blocks[1]!.props);
    document.blocks[0]!.props!.textAlignment = "right";
    expect(() => exportLegacyNotesBlocks(document, archive, [])).toThrow(/unmapped/);
  });
  it("refuses a deletion after metadata-only changes, while retained blocks merge current metadata", () => {
    const blocks = [{ id: "a", type: "paragraph", text: "Same", version: 1, future: "old" }], { document, archive } = importLegacyNotesBlocks(blocks);
    const current = [{ ...blocks[0]!, version: 2, future: "human" }];
    expect(exportLegacyNotesBlocks(document, archive, current)).toEqual(current);
    document.blocks = [];
    expect(() => exportLegacyNotesBlocks(document, archive, current)).toThrow(/metadata changed/);
  });
  it("refuses unmapped nondefault column gap instead of silently reopening a different value", () => {
    const { archive } = importLegacyNotesBlocks([]), columns = createDocumentColumns([[], []]); columns.props!.gap = 32;
    expect(() => exportLegacyNotesBlocks(createEditorDocument([columns]), archive, [])).toThrow(/gap/);
  });
  it("edits complex table/config keys with CAS while preserving provider-owned lazy rows and unknown metadata", () => {
    const blocks = [{ id: "table", type: "table", tableProps: { widths: [100,200], future: true } }, { id: "db", type: "database", databaseConfig: JSON.stringify({ title: "Old", future: { x: true } }), databaseRowsLoaded: false, databaseRowCount: 812, preservedAPIBlock: { type: "database", content: { retain: true } } }];
    const saved = applyNotesMetadataEdits(blocks, [{ blockId: "table", field: "tableProps", key: "widths", expected: { present: true, value: [100,200] }, value: [120,250] }, { blockId: "db", field: "databaseConfig", key: "title", expected: { present: true, value: "Old" }, value: "New" }]) as unknown as typeof blocks;
    expect(saved[0]!.tableProps).toEqual({ widths: [120,250], future: true });
    expect(JSON.parse(saved[1]!.databaseConfig!)).toEqual({ title: "New", future: { x: true } });
    expect(saved[1]).toMatchObject({ databaseRowsLoaded: false, databaseRowCount: 812, preservedAPIBlock: blocks[1]!.preservedAPIBlock });
    expect(saved[1]).not.toHaveProperty("databaseRows");
    expect(blocks[0]!.tableProps!.widths).toEqual([100,200]);
    expect(() => applyNotesMetadataEdits(saved, [{ blockId: "table", field: "tableProps", key: "widths", expected: { present: true, value: [100,200] }, value: [] }])).toThrow(/changed/);
    expect(() => applyNotesMetadataEdits(blocks, [{ blockId: "db", field: "databaseConfig", key: "__proto__", expected: { present: false }, value: {} }])).toThrow();
  });
  it("recovers an ACK-lost creation across reload without a second create", async () => {
    let writes = 0, saved!: NotesResourceResult;
    const provider = { commit: async (request: NotesResourceRequest) => { writes++; saved = { status: "committed" as const, resourceId: request.resourceId, operationId: request.operationId, snapshot: { revision: "r2", value: { title: "New" } } }; throw new Error("Ack lost"); }, lookupOperation: async () => saved };
    const editor = createRevisionedNotesResourceEditor(provider, { resourceId: "row" });
    expect((await editor.commit("r1", { kind: "create", value: { title: "New" } })).status).toBe("unknown");
    await expect(editor.commit("r1", { kind: "create", value: {} })).rejects.toThrow(/Reconcile/);
    const recovered = createRevisionedNotesResourceEditor(provider, { resourceId: "row", recovery: editor.getRecovery() });
    expect((await recovered.reconcile()).status).toBe("committed"); expect(writes).toBe(1); expect(recovered.getRecovery()).toBeUndefined();
  });
  it("patches only requested typed properties and keeps concurrent unknown fields", async () => {
    let row = { title: "Old", future: { human: "concurrent" }, tags: ["a"] };
    const editor = createRevisionedNotesResourceEditor({ commit: async request => { if (request.change.kind !== "patch") throw new Error(); row = { ...row, ...request.change.fields }; return { status: "committed", resourceId: request.resourceId, operationId: request.operationId, snapshot: { revision: "r2", value: row } }; }, lookupOperation: async (resourceId, operationId) => ({ status: "unknown", resourceId, operationId }) }, { resourceId: "row" });
    const tags = validateNotesPropertyValue({ type: "multi_select", optionIds: ["a", "b"] }, ["b"]);
    expect((await editor.commit("r1", { kind: "patch", fields: { tags } })).status).toBe("committed");
    expect(row).toEqual({ title: "Old", future: { human: "concurrent" }, tags: ["b"] });
    expect(() => validateNotesPropertyValue({ type: "multi_select", optionIds: ["a"] }, ["b"])).toThrow();
    expect(() => validateNotesPropertyValue({ type: "date" }, "2026-02-30")).toThrow();
    expect(() => validateNotesPropertyValue({ type: "formula" } as never, null)).toThrow(/read-only/);
    expect(validateNotesPropertyValue({ type: "relation" }, ["page-1"])).toEqual(["page-1"]);
  });
  it("holds a hung write unknown and rejects a receipt for unapplied fields", async () => {
    vi.useFakeTimers();
    const editor = createRevisionedNotesResourceEditor({ commit: () => new Promise(() => {}), lookupOperation: async (resourceId, operationId) => ({ status: "committed", resourceId, operationId, snapshot: { revision: "r2", value: { title: "Wrong" } } }) }, { resourceId: "row", timeoutMs: 100 });
    const pending = editor.commit("r1", { kind: "patch", fields: { title: "Right" } }); await vi.advanceTimersByTimeAsync(100);
    expect((await pending).status).toBe("unknown"); expect((await editor.reconcile()).status).toBe("unknown");
    expect(editor.getState().status).toBe("unknown");
  });
  it("keeps rejected server CAS receipts from inventing a success", async () => {
    const editor = createRevisionedNotesResourceEditor({ commit: async r => ({ status: "conflict", resourceId: r.resourceId, operationId: r.operationId }), lookupOperation: async (resourceId, operationId) => ({ status: "unknown", resourceId, operationId }) }, { resourceId: "row" });
    expect((await editor.commit("old", { kind: "delete" })).status).toBe("conflict"); expect(editor.getState().status).toBe("idle");
  });
});
