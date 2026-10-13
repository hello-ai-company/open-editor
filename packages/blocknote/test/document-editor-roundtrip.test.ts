/** @vitest-environment jsdom */
import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it } from "vitest";
import { createOpenEditorPowerPreset } from "../src/features/compose.js";
import { fromBlockNote } from "../src/adapter/fromBlockNote.js";
import { toBlockNoteForSchema } from "../src/adapter/toBlockNote.js";
import { exportLegacyNotesBlocks, importLegacyNotesBlocks } from "../src/document/legacyNotes.js";
import { createDocumentWorkspaceFeature } from "../src/document/workspaceFeature.js";

describe("real BlockNote document compatibility", () => {
  it("roundtrips absent and explicit ordinary block defaults through the native editor exactly", () => {
    const source = [
      { type: "text", text: "7. > [!WARNING] Exact ", styles: { bold: true, italic: true } },
      { type: "text", text: "source\r\nRetain trailing newline\n", styles: { bold: true, italic: true } },
      { type: "text", text: "Explicit inactive marks", styles: { bold: false, italic: true, underline: false, strike: false, code: false } }
    ];
    const input = [
      { id: "number-default", type: "numbered_list", text: "1. Continue", future: { keep: true } },
      { id: "number-explicit", type: "numbered_list", listStart: 7, inlineContent: source, text: "Original fallback", sourceType: "human", sourceId: "origin" },
      { id: "number-one", type: "numbered_list", listStart: 1, text: "1. Restart" },
      { id: "callout-default", type: "callout", text: "> [!NOTE] Keep marker", future: { keep: true } },
      { id: "callout-explicit", type: "callout", calloutVariant: "warning", calloutTitle: "  Alert 😀  ", inlineContent: source, text: "Original fallback", sourceType: "human", sourceId: "origin" },
      { id: "callout-info", type: "callout", calloutVariant: "info", calloutTitle: "", text: "Info" }
    ];
    const imported = importLegacyNotesBlocks(input), options = createOpenEditorPowerPreset().editorOptions();
    const editor = BlockNoteEditor.create({ ...options, initialContent: toBlockNoteForSchema(imported.document, options.schema) as never });
    try {
      expect(editor.schema.blockSchema.numberedListItem.propSchema.start.default).toBeUndefined();
      expect(editor.getBlock("number-default")!.props).not.toHaveProperty("start");
      expect(editor.getBlock("callout-default")!.props).toEqual({ variant: "info", title: "", textAlignment: "left" });
      expect(editor.getBlock("number-explicit")!.props).toMatchObject({ start: 7 });
      expect(editor.getBlock("callout-explicit")!.props).toEqual({ variant: "warning", title: "  Alert 😀  ", textAlignment: "left" });
      expect(exportLegacyNotesBlocks(fromBlockNote(editor.document), imported.archive, input)).toEqual(input);
    } finally { editor._tiptapEditor.destroy(); }
  });

  it("saves native ordinary property edits, reloads them, and keeps the complete raw source", () => {
    const input = [
      { id: "n", type: "numbered_list", listStart: 7, text: "7. Keep text and number", future: { keep: true } },
      { id: "c", type: "callout", calloutVariant: "warning", calloutTitle: "Before", inlineContent: [{ type: "text", text: "> [!WARNING] Original", styles: { underline: true } }], provenance: { author: "original" } }
    ];
    const imported = importLegacyNotesBlocks(input), options = createOpenEditorPowerPreset().editorOptions();
    const editor = BlockNoteEditor.create({ ...options, initialContent: toBlockNoteForSchema(imported.document, options.schema) as never });
    try {
      editor.updateBlock("n", { props: { start: 42 } } as never);
      editor.updateBlock("c", { props: { variant: "success", title: "After" } } as never);
      const saved = exportLegacyNotesBlocks(fromBlockNote(editor.document), imported.archive, input);
      expect(saved).toEqual([{ ...input[0], listStart: 42 }, { ...input[1], calloutVariant: "success", calloutTitle: "After" }]);
      const reloaded = importLegacyNotesBlocks(saved), reloadedEditor = BlockNoteEditor.create({ ...options, initialContent: toBlockNoteForSchema(reloaded.document, options.schema) as never });
      try {
        expect(exportLegacyNotesBlocks(fromBlockNote(reloadedEditor.document), reloaded.archive, saved)).toEqual(saved);
        reloadedEditor.updateBlock("n", { props: { start: undefined } } as never);
        reloadedEditor.updateBlock("c", { props: { variant: "info", title: "" } } as never);
        const reset = exportLegacyNotesBlocks(fromBlockNote(reloadedEditor.document), reloaded.archive, saved) as Record<string, unknown>[];
        expect(reset[0]).not.toHaveProperty("listStart");
        expect(reset[0]!.text).toBe(input[0]!.text);
        expect(reset[1]).toEqual({ ...input[1], calloutVariant: "info", calloutTitle: "" });
      } finally { reloadedEditor._tiptapEditor.destroy(); }
    } finally { editor._tiptapEditor.destroy(); }
  });

  it("keeps unsupported styles inert on numbered/callout no-op saves", () => {
    const input = ["numbered_list", "callout"].map((type, index) => ({ id: `inert-${index}`, type, inlineContent: [{ type: "text", text: "Exact source", styles: { bold: true, futureMark: "retained" } }] }));
    const imported = importLegacyNotesBlocks(input), options = createOpenEditorPowerPreset().editorOptions();
    const editor = BlockNoteEditor.create({ ...options, initialContent: toBlockNoteForSchema(imported.document, options.schema) as never });
    try {
      expect(editor.document.map(block => block.type)).toEqual(["oeUnknownBlock", "oeUnknownBlock"]);
      expect(exportLegacyNotesBlocks(fromBlockNote(editor.document), imported.archive, input)).toEqual(input);
    } finally { editor._tiptapEditor.destroy(); }
  });

  it("documents why divider is not a source-retaining organization target", () => {
    const input = [{ id: "divider-source", type: "divider", text: "---", inlineContent: [{ type: "text", text: "---", styles: { bold: true } }] }];
    const imported = importLegacyNotesBlocks(input), options = createOpenEditorPowerPreset().editorOptions();
    expect(options.schema.blockSchema.divider.content).toBe("none");
    expect(imported.document.blocks[0]).not.toHaveProperty("content");
    // Its source exists only in the raw archive, so retyping prose would hide it.
    expect(exportLegacyNotesBlocks(imported.document, imported.archive, input)).toEqual(input);
  });

  it("retains numbered start exactly but documents native consecutive-list numbering", () => {
    const input = [
      { id: "first", type: "numbered_list", listStart: 3, text: "3. First" },
      { id: "adjacent", type: "numbered_list", listStart: 7, text: "7. Adjacent" },
      { id: "separator", type: "paragraph", text: "Separate list" },
      { id: "isolated", type: "numbered_list", listStart: 7, text: "7. Isolated" }
    ];
    const imported = importLegacyNotesBlocks(input), options = createOpenEditorPowerPreset().editorOptions();
    const editor = BlockNoteEditor.create({ ...options, initialContent: toBlockNoteForSchema(imported.document, options.schema) as never });
    const element = document.createElement("div"); document.body.appendChild(element);
    try {
      editor.mount(element);
      const indices = Array.from(element.querySelectorAll("[data-index]")).map(node => node.getAttribute("data-index"));
      // Start is a carrier, not an independent visible number on every sibling.
      expect(indices).toEqual(["3", "4", "7"]);
      expect(exportLegacyNotesBlocks(fromBlockNote(editor.document), imported.archive, input)).toEqual(input);
    } finally { editor.unmount(); editor._tiptapEditor.destroy(); element.remove(); }
  });
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
  it("preserves the complete raw inline-link label when native text runs coalesce", () => {
    const input = [{ id: "linked", type: "paragraph", inlineContent: [
      { type: "link", href: "https://example.invalid/exact?x=1#section", content: [
        { type: "text", text: "Styled ", styles: { bold: true, italic: false } },
        { type: "text", text: "label", styles: { bold: true } },
        { type: "text", text: "", styles: {} }
      ] }, { type: "link", href: "https://example.invalid/exact?x=1#section", content: [{ type: "text", text: " continuation", styles: { bold: true } }] }, { type: "text", text: " tail", styles: {} }
    ], sourceType: "human", version: 7, future: { retained: true } }];
    const imported = importLegacyNotesBlocks(input), options = createOpenEditorPowerPreset().editorOptions();
    const editor = BlockNoteEditor.create({ ...options, initialContent: toBlockNoteForSchema(imported.document, options.schema) as never });
    try {
      const native = fromBlockNote(editor.document);
      expect((native.blocks[0]!.content as any)[0].content).toEqual([{ type: "text", text: "Styled label continuation", styles: { bold: true } }]);
      expect(exportLegacyNotesBlocks(native, imported.archive, input)).toEqual(input);
      (native.blocks[0]!.content as any)[0].href += "-changed";
      expect(exportLegacyNotesBlocks(native, imported.archive, input)).not.toEqual(input);
    } finally { editor._tiptapEditor.destroy(); }
  });

});
