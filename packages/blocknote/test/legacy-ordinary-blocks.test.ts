import { createEditorDocument, type JsonValue } from "@hello-ai-company/editor-core";
import { describe, expect, it } from "vitest";
import { exportLegacyNotesBlocks, importLegacyNotesBlocks } from "../src/document/legacyNotes.js";

type Raw = Record<string, JsonValue>;
const richSource = [{ type: "text", text: "> [!WARNING] Keep all 7. markers\r\nand the final newline\n", styles: { bold: true, italic: true, underline: true, strike: true, code: true } }];
const fixture = (type: "numbered_list" | "callout", fields: Raw = {}): Raw[] => [{
  id: "original-id", type, text: "Exact fallback retained", inlineContent: richSource,
  sourceType: "human", sourceId: "source-id", version: 9, position: "a1", parentID: "parent-id",
  preservedAPIBlock: { provenance: { origin: "user" }, content: { marks: [{ future: true }] }, properties: { metadata: { private: true } } },
  unknownFuture: { nested: [null, 2, "retained"] }, ...fields
}];

describe("reviewed numbered-list and callout legacy fields", () => {
  it.each([1, 7, 999_999_999])("roundtrips explicit numbered start %i with exact source and identity", start => {
    const raw = fixture("numbered_list", { listStart: start }), imported = importLegacyNotesBlocks(raw);
    expect(imported.document.blocks[0]).toEqual({ id: "original-id", type: "numberedListItem", content: richSource, props: { start } });
    expect(exportLegacyNotesBlocks(imported.document, imported.archive, raw)).toEqual(raw);
  });

  it.each(["info", "warning", "success", "danger"])("roundtrips callout %s without rewriting source", variant => {
    const raw = fixture("callout", { calloutVariant: variant, calloutTitle: "  注意\nNo trimming 😀  " }), imported = importLegacyNotesBlocks(raw);
    expect(imported.document.blocks[0]!.props).toEqual({ variant, title: raw[0]!.calloutTitle });
    expect(exportLegacyNotesBlocks(imported.document, imported.archive, raw)).toEqual(raw);
  });

  it("preserves absent numbered start, and treats an explicit 1 as a real edit", () => {
    const raw = fixture("numbered_list"), imported = importLegacyNotesBlocks(raw);
    expect(imported.document.blocks[0]!.props).toBeUndefined();
    expect(exportLegacyNotesBlocks(imported.document, imported.archive, raw)).toEqual(raw);
    imported.document.blocks[0]!.props = { start: 1 };
    expect(exportLegacyNotesBlocks(imported.document, imported.archive, raw)[0]).toEqual({ ...raw[0], listStart: 1 });
  });

  it.each<Raw>([{}, { calloutVariant: "info" }, { calloutTitle: "" }, { calloutVariant: "info", calloutTitle: "" }])("keeps original presence of callout default fields: %j", fields => {
    const raw = fixture("callout", fields), imported = importLegacyNotesBlocks(raw);
    imported.document.blocks[0]!.props = { variant: "info", title: "" };
    expect(exportLegacyNotesBlocks(imported.document, imported.archive, raw)).toEqual(raw);
  });

  it("edits only the reviewed fields and merges the current host metadata", () => {
    const raw = fixture("callout", { calloutVariant: "warning", calloutTitle: "Old title" }), imported = importLegacyNotesBlocks(raw), current = structuredClone(raw);
    current[0]!.version = 10; current[0]!.unknownFuture = { newer: true };
    imported.document.blocks[0]!.props = { variant: "danger", title: "New title" };
    const saved = exportLegacyNotesBlocks(imported.document, imported.archive, current);
    expect(saved).toEqual([{ ...current[0], calloutVariant: "danger", calloutTitle: "New title" }]);
    expect(importLegacyNotesBlocks(saved).document.blocks[0]!.props).toEqual({ variant: "danger", title: "New title" });
  });

  it("supports explicit removal of mapped values without inventing defaults", () => {
    for (const [type, fields] of [["numbered_list", { listStart: 7 }], ["callout", { calloutVariant: "warning", calloutTitle: "Title" }]] as const) {
      const raw = fixture(type, fields), imported = importLegacyNotesBlocks(raw);
      delete imported.document.blocks[0]!.props;
      expect(exportLegacyNotesBlocks(imported.document, imported.archive, raw)).toEqual(fixture(type));
    }
  });

  it.each([null, false, "7", 0, -1, 1.5, 1_000_000_000, {}, []])("rejects malformed numbered start %j at import and export", value => {
    expect(() => importLegacyNotesBlocks(fixture("numbered_list", { listStart: value }))).toThrow(/start/);
    const raw = fixture("numbered_list"), imported = importLegacyNotesBlocks(raw);
    imported.document.blocks[0]!.props = { start: value };
    expect(() => exportLegacyNotesBlocks(imported.document, imported.archive, raw)).toThrow(/start/);
    expect(() => exportLegacyNotesBlocks(createEditorDocument([{ id: "new", type: "numberedListItem", props: { start: value } }]), importLegacyNotesBlocks([]).archive, [])).toThrow(/start/);
  });

  it.each([null, false, 1, "", "Warning", "note", {}, []])("rejects malformed callout variant %j at import and export", value => {
    expect(() => importLegacyNotesBlocks(fixture("callout", { calloutVariant: value }))).toThrow(/variant/);
    const raw = fixture("callout"), imported = importLegacyNotesBlocks(raw);
    imported.document.blocks[0]!.props = { variant: value };
    expect(() => exportLegacyNotesBlocks(imported.document, imported.archive, raw)).toThrow(/variant/);
    expect(() => exportLegacyNotesBlocks(createEditorDocument([{ id: "new", type: "callout", props: { variant: value } }]), importLegacyNotesBlocks([]).archive, [])).toThrow(/variant/);
  });

  it.each([null, true, 12, {}, [], "x".repeat(501), "😀".repeat(251)])("rejects malformed or oversized callout title %#", value => {
    expect(() => importLegacyNotesBlocks(fixture("callout", { calloutTitle: value }))).toThrow(/title/);
    const raw = fixture("callout"), imported = importLegacyNotesBlocks(raw);
    imported.document.blocks[0]!.props = { title: value };
    expect(() => exportLegacyNotesBlocks(imported.document, imported.archive, raw)).toThrow(/title/);
    expect(() => exportLegacyNotesBlocks(createEditorDocument([{ id: "new", type: "callout", props: { title: value } }]), importLegacyNotesBlocks([]).archive, [])).toThrow(/title/);
  });

  it.each(["x".repeat(500), "😀".repeat(250)])("admits exactly 500 UTF-16 title units %#", title => {
    const raw = fixture("callout", { calloutTitle: title }), imported = importLegacyNotesBlocks(raw);
    expect(exportLegacyNotesBlocks(imported.document, imported.archive, raw)).toEqual(raw);
  });

  it.each([
    ["numbered_list", "listStart", 8], ["callout", "calloutVariant", "danger"], ["callout", "calloutTitle", "New title"],
    ["numbered_list", "sourceId", "other-source"], ["callout", "sourceType", "other-author"],
    ["numbered_list", "inlineContent", "Concurrent text"], ["callout", "type", "paragraph"], ["callout", "id", "other-id"]
  ] as const)("rejects concurrent %s %s changes", (type, field, value) => {
    const raw = fixture(type), imported = importLegacyNotesBlocks(raw), current = structuredClone(raw);
    current[0]![field] = value;
    expect(() => exportLegacyNotesBlocks(imported.document, imported.archive, current)).toThrow(/changed|identit/);
  });

  it.each(["numbered_list", "callout"] as const)("retains concurrent hidden %s text on no-op but refuses to erase it on content edits", type => {
    const raw = fixture(type), imported = importLegacyNotesBlocks(raw), current = structuredClone(raw);
    current[0]!.text = "New concurrent fallback";
    expect(exportLegacyNotesBlocks(imported.document, imported.archive, current)).toEqual(current);
    imported.document.blocks[0]!.content = "Local edit";
    expect(() => exportLegacyNotesBlocks(imported.document, imported.archive, current)).toThrow(/Host source changed/);
  });

  it("creates explicit typed new blocks with the same reviewed field mapping", () => {
    const imported = importLegacyNotesBlocks([]), document = createEditorDocument([
      { id: "n", type: "numberedListItem", content: richSource, props: { start: 7 } },
      { id: "c", type: "callout", content: richSource, props: { variant: "success", title: "Done" } }
    ]);
    const saved = exportLegacyNotesBlocks(document, imported.archive, []);
    expect(saved).toEqual([
      { id: "n", type: "numbered_list", text: "", inlineContent: richSource, listStart: 7 },
      { id: "c", type: "callout", text: "", inlineContent: richSource, calloutVariant: "success", calloutTitle: "Done" }
    ]);
    expect(importLegacyNotesBlocks(saved).document).toEqual(document);
  });

  it("does not permit callout defaults on unrelated blocks or unknown fields on the new types", () => {
    for (const [type, props] of [["paragraph", { variant: "info", title: "" }], ["callout", { future: true }], ["numbered_list", { future: true }]] as const) {
      const raw = [{ id: "x", type }], imported = importLegacyNotesBlocks(raw);
      imported.document.blocks[0]!.props = props;
      expect(() => exportLegacyNotesBlocks(imported.document, imported.archive, raw)).toThrow(/Unmapped/);
    }
  });

  it("preserves raw segmentation, empty runs, and explicit false native styles on semantic no-op", () => {
    const source: JsonValue = [
      { type: "text", text: "", styles: { bold: false } },
      { type: "text", text: "First ", styles: { bold: false, italic: true } },
      { type: "text", text: "second", styles: { italic: true } }
    ];
    for (const type of ["numbered_list", "callout"] as const) {
      const raw = fixture(type, { inlineContent: source }), imported = importLegacyNotesBlocks(raw);
      imported.document.blocks[0]!.content = [{ type: "text", text: "First second", styles: { italic: true } }];
      expect(exportLegacyNotesBlocks(imported.document, imported.archive, raw)).toEqual(raw);
      // Active styles still change meaning and must be written as an actual edit.
      imported.document.blocks[0]!.content = [{ type: "text", text: "First second", styles: { bold: true, italic: true } }];
      const edited = exportLegacyNotesBlocks(imported.document, imported.archive, raw) as Raw[];
      expect(edited[0]!.inlineContent).toEqual(imported.document.blocks[0]!.content);
      expect(edited[0]).not.toHaveProperty("text");
    }
  });
});
