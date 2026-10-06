import { describe, expect, it } from "vitest";
import { exportLegacyNotesBlocks, importLegacyNotesBlocks } from "../src/document/legacyNotes.js";

const types = "paragraph heading bullet_list numbered_list checklist quote callout code image file pdf divider toggle table database embed meeting ai drawing canvas child_page web_link asset editor_tool".split(" ");
const fixture = (): Record<string, unknown>[] => [
  ...types.map((type, index) => ({ id: `legacy-${index}`, type, text: "Original", version: 3, sourceType: "server", sourceId: `source-${index}`, unknownFuture: { opaque: [1, true, "retained"] }, preservedAPIBlock: { type, content: { privateMetadata: "host only" } }, ...(type === "database" ? { databaseRows: [{ privateRow: "host only" }], databaseView: "kanban", databaseConfig: { futureSetting: true } } : {}) })),
  { id: "group", type: "column_list", children: [{ id: "col-a", type: "column", columnWidth: 1.5, children: [{ id: "nested", type: "paragraph", inlineContent: [{ type: "text", text: "styled", styles: { fontFamily: "future-font" } }] }] }, { id: "col-b", type: "column", children: [] }] },
  { id: "widget", type: "editorTool", toolKind: "htmlEmbed", toolTitle: "Independent widget", toolData: JSON.stringify({ html: "<p>Hi</p>", css: "p{color:red}", js: "alert(1)", privateFuture: true }) },
  { id: "future", type: "future_type", unknownBinaryReference: "local:example" }
];
describe("independently authored Notes compatibility archive", () => {
  it("roundtrips all 26 canonical kinds and unknown fields without putting host data in document", () => {
    const input = fixture(), imported = importLegacyNotesBlocks(input);
    expect(exportLegacyNotesBlocks(imported.document, imported.archive, input)).toEqual(input);
    expect(JSON.stringify(imported.document)).not.toContain("host only");
    expect(JSON.stringify(imported.document)).not.toContain("privateFuture");
    input[0]!.text = "Mutated input";
    expect(imported.document.blocks[0]!.content).toBe("Original");
  });
  it("writes reviewed editor fields and merges the CURRENT host version/unknown/provider values", () => {
    const input = fixture(), { document, archive } = importLegacyNotesBlocks(input);
    document.blocks[0]!.content = "Human edit";
    const current = structuredClone(input); current[0]!.version = 99; current[0]!.unknownFuture = { opaque: ["latest"] };
    const saved = exportLegacyNotesBlocks(document, archive, current) as Record<string, unknown>[];
    expect(saved[0]).toMatchObject({ version: 99, inlineContent: "Human edit", unknownFuture: { opaque: ["latest"] } });
    expect(saved[0]).not.toHaveProperty("text");
    expect(importLegacyNotesBlocks(saved).document.blocks[0]!.content).toBe("Human edit");
  });
  it("retains unknown widget JSON keys when source changes and saves legacy js spelling", () => {
    const input = fixture(), { document, archive } = importLegacyNotesBlocks(input);
    document.blocks.find(b => b.id === "widget")!.props!.html = "<h1>Edited</h1>";
    const output = exportLegacyNotesBlocks(document, archive, input) as Record<string, unknown>[];
    expect(JSON.parse(output.find(b => b.id === "widget")!.toolData as string)).toEqual({ html: "<h1>Edited</h1>", css: "p{color:red}", js: "alert(1)", privateFuture: true });
  });
  it.each(["text", "sourceId", "type"])("refuses concurrent host %s changes", field => {
    const input = fixture(), { document, archive } = importLegacyNotesBlocks(input), current = structuredClone(input);
    (current[0] as Record<string, unknown>)[field] = "Changed";
    expect(() => exportLegacyNotesBlocks(document, archive, current)).toThrow();
  });
  it("rejects unknown new props, forged projections, duplicate ids, future codec versions, malformed columns", () => {
    const input = fixture(), { document, archive } = importLegacyNotesBlocks(input);
    document.blocks[0]!.props = { unsafeUnmapped: "Must survive or fail" };
    expect(() => exportLegacyNotesBlocks(document, archive, input)).toThrow(/Unmapped/);
    document.blocks[0]!.props = {};
    archive.records[document.blocks[0]!.id]!.projected.content = "Forged";
    expect(() => exportLegacyNotesBlocks(document, archive, input)).toThrow();
    expect(() => importLegacyNotesBlocks([{ id: "same", type: "paragraph" }, { id: "same", type: "paragraph" }])).toThrow(/Duplicate/);
    expect(() => importLegacyNotesBlocks([{ id: "orphan", type: "column" }])).toThrow(/columns/);
    const imported = importLegacyNotesBlocks(input); (imported.archive as { codecVersion: number }).codecVersion = 2;
    expect(() => exportLegacyNotesBlocks(imported.document, imported.archive, input)).toThrow(/version/);
  });
  it("does not execute accessors/toJSON and keeps prototype-shaped unknown fields", () => {
    let called = false;
    expect(() => importLegacyNotesBlocks([{ id: "x", type: "paragraph", get text() { called = true; return "secret"; } }])).toThrow(/Accessors/);
    expect(called).toBe(false);
    const input = JSON.parse('[{"id":"x","type":"future","__proto__":{"retained":true}}]');
    const imported = importLegacyNotesBlocks(input);
    expect(exportLegacyNotesBlocks(imported.document, imported.archive, input)).toEqual(input);
  });
  it("checks remotely edited deletion targets and requires approval for unknown deletion", () => {
    const input = fixture(), imported = importLegacyNotesBlocks(input), current = structuredClone(input);
    imported.document.blocks.splice(0, 1); current[0]!.text = "Remote human edit";
    expect(() => exportLegacyNotesBlocks(imported.document, imported.archive, current)).toThrow(/changed/);
    const unknown = [{ id: "future", type: "future", opaque: true }], next = importLegacyNotesBlocks(unknown);
    next.document.blocks = [];
    expect(() => exportLegacyNotesBlocks(next.document, next.archive, unknown)).toThrow(/approval/);
    expect(exportLegacyNotesBlocks(next.document, next.archive, unknown, { allowUnknownDeletion: true })).toEqual([]);
  });
  it("admits the generated archive quota at import time", () => {
    expect(() => importLegacyNotesBlocks([{ id: "large-a", type: "paragraph", inlineContent: Array(30_000).fill("x") }, { id: "large-b", type: "paragraph", inlineContent: Array(30_000).fill("x") }])).toThrow(/budget/);
  });
  it("uses a linear-size structure fingerprint for deeply nested unknown trees", () => {
    let node: Record<string, unknown> = { id: "leaf", type: "future" };
    for (let depth = 0; depth < 40; depth++) node = { id: `ancestor-${depth}`, type: "future", children: [node] };
    const input = [node], imported = importLegacyNotesBlocks(input);
    expect(imported.archive.structure.length).toBeLessThan(3000);
    expect(exportLegacyNotesBlocks(imported.document, imported.archive, input)).toEqual(input);
  });
});
