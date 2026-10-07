import { describe, expect, it } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { exportLegacyNotesBlocks, importLegacyNotesBlocks } from "../src/document/legacyNotes.js";
import { createHtmlWidgetPreview } from "../src/document/htmlWidget.js";
type Raw = Record<string, unknown>;
const save = (raw: Raw[], edit?: (props: Record<string, unknown>) => void): Raw[] => {
  const { document, archive } = importLegacyNotesBlocks(raw);
  if (edit) edit(document.blocks[0]!.props!);
  return exportLegacyNotesBlocks(document, archive, raw) as Raw[];
};
describe("HTML body/data compatibility", () => {
  it.each(["editorTool", "editor_tool"])("projects body-only %s and preserves exact no-op raw fields", type => {
    const raw = [{ id: "h", type, toolKind: "htmlEmbed", toolBody: "<b>日本語</b>", version: 7, sourceId: "host", future: { keep: true } }];
    expect(importLegacyNotesBlocks(raw).document.blocks[0]!.props!.html).toBe(raw[0]!.toolBody);
    expect(save(raw)).toEqual(raw);
    const edited = save(raw, p => { p.html = "<i>編集</i>"; });
    expect(edited[0]).toMatchObject({ toolBody: "<i>編集</i>", version: 7, sourceId: "host", future: { keep: true } });
    expect(typeof edited[0]!.toolData).toBe("string");
    expect(JSON.parse(edited[0]!.toolData as string)).toEqual({ html: "<i>編集</i>", css: "", javascript: "" });
    expect(save(edited)).toEqual(edited);
  });
  it.each(["string", "object"])("synchronizes edited HTML while preserving %s toolData, legacy js and future keys", representation => {
    const data = { html: "old", css: "b{color:red}", js: "alert(1)", future: { keep: [1, true] } };
    const raw = [{ id: "h", type: "editorTool", toolKind: "htmlEmbed", toolBody: "old", toolData: representation === "string" ? JSON.stringify(data) : data }];
    const edited = save(raw, p => { p.html = "new"; });
    const savedData = typeof edited[0]!.toolData === "string" ? JSON.parse(edited[0]!.toolData) : edited[0]!.toolData;
    expect(savedData).toEqual({ ...data, html: "new" }); expect(edited[0]!.toolBody).toBe("new");
    expect(save(edited)).toEqual(edited);
  });
  it("prioritizes explicit data HTML, including empty, and retains mismatches until a source edit", () => {
    for (const html of ["data wins", ""]) {
      const raw = [{ id: "h", type: "editorTool", toolKind: "htmlEmbed", toolBody: "stale body", toolData: JSON.stringify({ html, future: true }) }];
      expect(importLegacyNotesBlocks(raw).document.blocks[0]!.props!.html).toBe(html);
      expect(save(raw)).toEqual(raw);
      const title = save(raw, p => { p.title = "Only title"; }); expect(title[0]!.toolBody).toBe("stale body"); expect(title[0]!.toolData).toBe(raw[0]!.toolData);
      const changed = save(raw, p => { p.css = "p{color:red}"; }); expect(changed[0]!.toolBody).toBe(html);
      expect(JSON.parse(changed[0]!.toolData as string)).toMatchObject({ html, future: true });
    }
  });
  it("uses body when data has only CSS/JS and synchronizes explicit empty HTML edits", () => {
    const raw = [{ id: "h", type: "editor_tool", toolKind: "htmlEmbed", toolBody: "body", toolData: JSON.stringify({ css: "b{color:red}", js: "alert(1)", extra: 12 }) }];
    expect(importLegacyNotesBlocks(raw).document.blocks[0]!.props!.html).toBe("body"); expect(save(raw)).toEqual(raw);
    const next = save(raw, p => { p.html = ""; }); expect(next[0]!.toolBody).toBe(""); expect(JSON.parse(next[0]!.toolData as string)).toEqual({ html: "", css: "b{color:red}", js: "alert(1)", extra: 12 });
  });
  it("creates both fields and remains stable across repeated import/export/edit cycles", () => {
    const { archive } = importLegacyNotesBlocks([]), doc = createEditorDocument([{ id: "new", type: "oeHtmlWidget", props: { title: "Widget", html: "<b>new</b>", css: "", javascript: "alert(1)" } }]);
    let raw = exportLegacyNotesBlocks(doc, archive, []) as Raw[];
    expect(raw[0]!.toolBody).toBe("<b>new</b>"); expect(JSON.parse(raw[0]!.toolData as string).html).toBe(raw[0]!.toolBody);
    for (let i = 0; i < 12; i++) {
      const previous = structuredClone(raw); expect(save(raw)).toEqual(previous);
      raw = save(raw, p => { p.html = `<p>更新${i}</p>`; });
      expect(raw[0]!.toolBody).toBe(`<p>更新${i}</p>`); expect(JSON.parse(raw[0]!.toolData as string).html).toBe(raw[0]!.toolBody);
    }
  });
  it("merges current unknown metadata but refuses hidden concurrent body changes", () => {
    const raw = [{ id: "h", type: "editorTool", toolKind: "htmlEmbed", toolBody: "old", toolData: JSON.stringify({ html: "old", future: 1 }), future: "old" }];
    const { document, archive } = importLegacyNotesBlocks(raw); document.blocks[0]!.props!.html = "new";
    const current = structuredClone(raw); current[0]!.future = "latest"; current[0]!.toolData = JSON.stringify({ html: "old", future: 2 });
    const saved = exportLegacyNotesBlocks(document, archive, current) as Raw[];
    expect(saved[0]!.future).toBe("latest"); expect(JSON.parse(saved[0]!.toolData as string)).toMatchObject({ html: "new", future: 2 });
    current[0]!.toolBody = "human edit";
    expect(() => exportLegacyNotesBlocks(document, archive, current)).toThrow(/HTML body changed/);
    document.blocks[0]!.props!.html = "old";
    expect(exportLegacyNotesBlocks(document, archive, current)).toEqual(current);
  });
  it("rejects malformed present HTML and keeps body-only arbitrary JS inert in previews", () => {
    expect(() => importLegacyNotesBlocks([{ id: "h", type: "editorTool", toolKind: "htmlEmbed", toolData: '{"html":null}', toolBody: "fallback" }])).toThrow(/html must be a string/);
    const raw = [{ id: "h", type: "editorTool", toolKind: "htmlEmbed", toolBody: '<script>fetch("https://example.invalid")</script><b>safe</b>', toolData: '{"javascript":"alert(1)"}' }];
    const imported = importLegacyNotesBlocks(raw), preview = createHtmlWidgetPreview(imported.document.blocks[0]!.props);
    expect(preview).toContain("script-src 'none'"); expect(preview).toContain("connect-src 'none'"); expect(preview).not.toContain("<script>"); expect(preview).not.toContain("example.invalid");
    expect(exportLegacyNotesBlocks(imported.document, imported.archive, raw)).toEqual(raw);
  });
});
