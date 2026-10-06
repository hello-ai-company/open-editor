/** @vitest-environment jsdom */
import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it } from "vitest";
import { createOpenEditorPowerPreset } from "../src/features/compose.js";
import { fromBlockNote } from "../src/adapter/fromBlockNote.js";
import { toBlockNoteForSchema } from "../src/adapter/toBlockNote.js";
import { exportLegacyNotesBlocks, importLegacyNotesBlocks } from "../src/document/legacyNotes.js";
import { createDocumentWorkspaceFeature } from "../src/document/workspaceFeature.js";

describe("real BlockNote document compatibility", () => {
  it("edits a body-only HTML widget through the native schema and saves synchronized fields", () => {
    const raw = [{ id: "widget", type: "editorTool", toolKind: "htmlEmbed", toolBody: "<b>old</b>", future: { keep: true } }, { id: "p", type: "paragraph", text: "Retained" }];
    const imported = importLegacyNotesBlocks(raw), options = createOpenEditorPowerPreset({ features: [createDocumentWorkspaceFeature()] }).editorOptions();
    const editor = BlockNoteEditor.create({ ...options, initialContent: toBlockNoteForSchema(imported.document, options.schema) as never });
    try {
      expect(editor.getBlock("widget")!.props).toMatchObject({ html: "<b>old</b>" });
      expect(exportLegacyNotesBlocks(fromBlockNote(editor.document), imported.archive, raw)).toEqual(raw);
      editor.updateBlock("widget", { props: { html: "<i>new</i>" } } as never);
      const saved = exportLegacyNotesBlocks(fromBlockNote(editor.document), imported.archive, raw) as Record<string, unknown>[];
      expect(saved[0]).toMatchObject({ toolBody: "<i>new</i>", future: { keep: true } });
      expect(JSON.parse(saved[0]!.toolData as string).html).toBe("<i>new</i>");
      expect(importLegacyNotesBlocks(saved).document.blocks[0]!.props!.html).toBe("<i>new</i>");
    } finally { editor._tiptapEditor.destroy(); }
  });
  it("saves an unchanged native editor without losing raw fields or creating default fields", () => {
    const input = [{ id: "p", type: "paragraph", text: "Hello", version: 7, unknownFuture: { preserved: true } }, { id: "h", type: "heading", text: "Heading" }, { id: "c", type: "code", text: "const n = 1", codeLanguage: "typescript" }];
    const imported = importLegacyNotesBlocks(input), preset = createOpenEditorPowerPreset({ features: [createDocumentWorkspaceFeature()] });
    const options = preset.editorOptions(), editor = BlockNoteEditor.create({ ...options, initialContent: toBlockNoteForSchema(imported.document, options.schema) as never });
    const portable = fromBlockNote(editor.document);
    expect(exportLegacyNotesBlocks(portable, imported.archive, input)).toEqual(input);
    editor._tiptapEditor.destroy();
  });
  it("refuses incomplete archives rather than treating existing records as new", () => {
    const input = [{ id: "p", type: "paragraph", text: "Hello", version: 7, future: true }], imported = importLegacyNotesBlocks(input);
    imported.archive.records = {};
    expect(() => exportLegacyNotesBlocks(imported.document, imported.archive, input)).toThrow(/incomplete/);
  });
  it("preserves unsupported marks on native no-op saves and refuses destructive content rewrites", () => {
    const input = [{ id: "p", type: "paragraph", inlineContent: [{ type: "text", text: "Hello", styles: { bold: true, futureMark: "retained", fontFamily: "futureFont" } }] }], imported = importLegacyNotesBlocks(input);
    const options = createOpenEditorPowerPreset().editorOptions(), editor = BlockNoteEditor.create({ ...options, initialContent: toBlockNoteForSchema(imported.document, options.schema) as never });
    const portable = fromBlockNote(editor.document);
    expect(exportLegacyNotesBlocks(portable, imported.archive, input)).toEqual(input);
    portable.blocks[0]!.content = "Changed";
    expect(() => exportLegacyNotesBlocks(portable, imported.archive, input)).toThrow(/unsupported styles/);
    editor._tiptapEditor.destroy();
  });
});
