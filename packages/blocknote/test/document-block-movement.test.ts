import { describe, it, expect } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createDocumentColumns, updateDocumentColumns, moveDocumentBlock, validateDocumentColumns } from "../src/document/columns.js";
import { importLegacyNotesBlocks, exportLegacyNotesBlocks } from "../src/document/legacyNotes.js";
import { documentBlockKeyboardMove } from "../src/document/blockMovement.js";
const fixture = () => createEditorDocument([{ id: "before", type: "paragraph", content: "Before" }, createDocumentColumns([[{ id: "a", type: "paragraph", content: "A", props: { opaque: { stay: true } } }], [{ id: "b", type: "futureWidget", props: { payload: { retained: [7, "raw"] } } }]], { id: "group", idFactory: (() => { let n = 0; return () => "c" + n++; })(), widths: [2, 1] }), { id: "after", type: "paragraph", content: "After" }]);
describe("identity-preserving Columns and block movement", () => {
  it("adds an empty third through sixth column without changing original widths/content or IDs", () => {
    const original = fixture(), before = structuredClone(original); let next = original;
    for (let n = 2; n < 6; n++) next = updateDocumentColumns(next, { type: "add-column", groupId: "group", columnId: "c" + n, index: n });
    expect(next.blocks[1]!.children!.slice(0, 2)).toEqual(before.blocks[1]!.children); expect(next.blocks[1]!.children).toHaveLength(6); expect(next.blocks[1]!.children![5]).toEqual({ id: "c5", type: "oeColumn", props: { width: 1 }, children: [] }); expect(original).toEqual(before);
    expect(() => updateDocumentColumns(next, { type: "add-column", groupId: "group", columnId: "c6", index: 6 })).toThrow();
  });
  it("rejects duplicate new IDs and invalid insertion positions atomically", () => {
    const before = fixture(), original = structuredClone(before);
    for (const [columnId, index] of [["a", 2], ["c0", 2], ["new", -1], ["new", 3], ["new", .5]] as const) expect(() => updateDocumentColumns(before, { type: "add-column", groupId: "group", columnId, index })).toThrow(); expect(before).toEqual(original);
  });
  it("moves the entire group including IDs, widths, nested/opaque content", () => {
    const before = fixture(), moved = moveDocumentBlock(before, { blockId: "group", anchorId: "after", placement: "after" });
    expect(moved.blocks.map(b => b.id)).toEqual(["before", "after", "group"]); expect(moved.blocks[2]).toEqual(before.blocks[1]); expect(validateDocumentColumns(moved)).toEqual([]);
  });
  it("reorders a wrapper only inside its own group, keeping its width/content", () => {
    const before = fixture(), moved = moveDocumentBlock(before, { blockId: "c0", anchorId: "c1", placement: "after" }); expect(moved.blocks[1]!.children!.map(c => c.id)).toEqual(["c1", "c0"]); expect(moved.blocks[1]!.children![1]).toEqual(before.blocks[1]!.children![0]);
    expect(() => moveDocumentBlock(before, { blockId: "c0", anchorId: "after", placement: "after" })).toThrow(/own group/);
  });
  it("moves content into an empty column and back outside without losing payload", () => {
    let next = updateDocumentColumns(fixture(), { type: "add-column", groupId: "group", columnId: "empty", index: 2 }); const original = structuredClone(next);
    next = moveDocumentBlock(next, { blockId: "b", anchorId: "empty", placement: "inside-end" }); expect(next.blocks[1]!.children![1]!.children).toEqual([]); expect(next.blocks[1]!.children![2]!.children![0]).toEqual(original.blocks[1]!.children![1]!.children![0]);
    next = moveDocumentBlock(next, { blockId: "b", anchorId: "after", placement: "before" }); expect(next.blocks.map(b => b.id)).toEqual(["before", "group", "b", "after"]); expect(next.blocks[2]).toEqual(original.blocks[1]!.children![1]!.children![0]);
  });
  it("orders content before/after inside a different column while leaving the source truly empty", () => {
    const next = moveDocumentBlock(fixture(), { blockId: "a", anchorId: "b", placement: "after" }); expect(next.blocks[1]!.children![0]!.children).toEqual([]); expect(next.blocks[1]!.children![1]!.children!.map(b => b.id)).toEqual(["b", "a"]);
  });
  it("rejects cycles, own target and content between column wrappers", () => {
    for (const action of [{ blockId: "group", anchorId: "a", placement: "before" }, { blockId: "a", anchorId: "a", placement: "after" }, { blockId: "before", anchorId: "c1", placement: "before" }] as const) expect(() => moveDocumentBlock(fixture(), action)).toThrow();
  });
  it("keeps nested group identity when moving between parent columns", () => {
    const before = fixture(), nested = createDocumentColumns([[{ id: "nested-text", type: "paragraph", content: "Nested" }], []], { id: "nested", idFactory: (() => { let n = 0; return () => "nested-c" + n++; })() }); before.blocks[1]!.children![0]!.children!.push(nested);
    const next = moveDocumentBlock(before, { blockId: "nested", anchorId: "c1", placement: "inside-end" }); expect(next.blocks[1]!.children![1]!.children![1]).toEqual(nested); expect(validateDocumentColumns(next)).toEqual([]);
  });
  it("provides keyboard movement from the handle identity without a prior document selection", () => {
    const blocks = fixture().blocks; expect(documentBlockKeyboardMove(blocks, "group", "ArrowDown")).toEqual({ blockId: "group", anchorId: "after", placement: "after" }); expect(documentBlockKeyboardMove(blocks, "c0", "ArrowRight")).toEqual({ blockId: "c0", anchorId: "c1", placement: "after" }); expect(documentBlockKeyboardMove(blocks, "a", "ArrowRight")).toEqual({ blockId: "a", anchorId: "c1", placement: "inside-end" }); expect(documentBlockKeyboardMove(blocks, "c0", "ArrowLeft")).toBeUndefined();
  });
  it("exports added/reordered columns through the unchanged legacy codec with original raw metadata preserved", () => {
    const raw = [{ id: "group", type: "column_list", custom: { keep: true }, version: 4, children: [{ id: "left", type: "column", columnWidth: 2, opaque: "keep-left", children: [{ id: "a", type: "paragraph", text: "Human", custom: { raw: 7 } }] }, { id: "right", type: "column", columnWidth: 1, opaque: "keep-right", children: [] }] }, { id: "outside", type: "paragraph", text: "Outside" }];
    const loaded = importLegacyNotesBlocks(raw); let next = updateDocumentColumns(loaded.document, { type: "add-column", groupId: "group", columnId: "third", index: 2 });
    next = moveDocumentBlock(next, { blockId: "left", anchorId: "third", placement: "after" });
    const written = exportLegacyNotesBlocks(next, loaded.archive, raw) as unknown as typeof raw;
    expect(written[0]!.children!.map(c => c.id)).toEqual(["right", "third", "left"]); expect(written[0]!.children![2]).toEqual(raw[0]!.children![0]); expect(written[0]!.children![0]).toEqual(raw[0]!.children![1]); expect(written[0]!.custom).toEqual(raw[0]!.custom); expect(written[1]).toEqual(raw[1]);
    expect(importLegacyNotesBlocks(written).document).toEqual(next); expect(raw[0]!.children).toHaveLength(2);
  });

});
