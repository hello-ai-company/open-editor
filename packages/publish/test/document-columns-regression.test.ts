import { describe, expect, it } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { IncompletePublicationError, inspectOpenEditorPublication, getPublicKnowledgeContext, renderOpenEditorMarkdown, renderOpenEditorPdfPrintHtml, renderOpenEditorPresentation, renderOpenEditorSite } from "../src/index.js";

const document = createEditorDocument([{ id: "columns", type: "oeColumns", children: [
  { id: "left", type: "oeColumn", props: { width: 2 }, children: [{ id: "a", type: "paragraph", content: "Left public copy" }] },
  { id: "right", type: "oeColumn", props: { width: 1 }, children: [
    { id: "b", type: "paragraph", content: "Right <public> copy" },
    { id: "secret", type: "paragraph", props: { visibility: "private" }, content: "Private child" }
  ] },
  { id: "private-column", type: "oeColumn", props: { visibility: "private" }, children: [{ id: "hidden", type: "paragraph", content: "Private column body" }] }
] }]);

describe("Document column export parity", () => {
  it.each([renderOpenEditorSite, renderOpenEditorPresentation, renderOpenEditorPdfPrintHtml])("retains real Document column content in %s", render => {
    const html = render(document);
    expect(html).toContain("Left public copy");
    expect(html).toContain("Right &lt;public&gt; copy");
    expect(html).toContain("--oe-site-column-tracks:minmax(0,2fr) minmax(0,1fr)");
    expect(html).not.toContain("Private child");
    expect(html).not.toContain("Private column body");
  });
  it("retains column order in Markdown and public knowledge without exposing private descendants", () => {
    const markdown = renderOpenEditorMarkdown(document);
    expect(markdown).toBe("Left public copy\n\nRight &lt;public&gt; copy");
    const context = getPublicKnowledgeContext(document);
    expect(context.text).toBe("Left public copy\n\nRight <public> copy");
    expect(context.blocks.map(block => block.type)).toEqual(["paragraph", "paragraph"]);
  });
});


describe("complete Document preview admission", () => {
  it("retains nested current/legacy columns and supported special blocks without modifying source", () => {
    const nested = createEditorDocument([{ id: "outer", type: "oeColumns", children: [
      { id: "outer-a", type: "oeColumn", children: [{ id: "inner", type: "columnList", children: [
        { id: "inner-a", type: "column", children: [{ id: "quote", type: "quote", content: "Nested quote" }] },
        { id: "inner-b", type: "column", children: [{ id: "callout", type: "callout", props: { title: "Notice" }, content: "Nested callout" }] }
      ] }] },
      { id: "outer-b", type: "oeColumn", children: [{ id: "code", type: "codeBlock", content: "<script>literal code</script>" }] }
    ] }]);
    const original = JSON.stringify(nested);
    const freeze = (value: unknown): void => { if (value && typeof value === "object") { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } };
    freeze(nested);
    expect(inspectOpenEditorPublication(nested)).toEqual([]);
    for (const render of [renderOpenEditorSite, renderOpenEditorPresentation, renderOpenEditorPdfPrintHtml]) {
      const html = render(nested, { requireCompleteDocument: true });
      expect(html).toContain("Nested quote"); expect(html).toContain("Nested callout");
      expect(html).toContain("&lt;script&gt;literal code&lt;/script&gt;");
      expect(JSON.stringify(nested)).toBe(original);
    }
    // Moving between source and serializable preview inputs retains exact canonical body bytes.
    const restored = JSON.parse(original);
    expect(renderOpenEditorSite(restored, { requireCompleteDocument: true })).toBe(renderOpenEditorSite(nested, { requireCompleteDocument: true }));
    expect(JSON.stringify(restored)).toBe(original);
  });
  it.each([renderOpenEditorSite, renderOpenEditorPresentation, renderOpenEditorPdfPrintHtml])("pauses complete previews for unsupported drawing/database payloads in %s", render => {
    const source = createEditorDocument([{ id: "columns", type: "oeColumns", children: [
      { id: "column", type: "oeColumn", children: [
        { id: "drawing", type: "oeLegacyNotesDrawing", props: { opaquePayload: "retained drawing bytes" } },
        { id: "database", type: "databaseView", props: { databaseId: "retained-db", viewId: "retained-view" } }
      ] }
    ] }]);
    const original = JSON.stringify(source);
    expect(inspectOpenEditorPublication(source).map(issue => issue.blockId)).toEqual(["drawing", "database"]);
    expect(() => render(source, { requireCompleteDocument: true })).toThrow(IncompletePublicationError);
    expect(JSON.stringify(source)).toBe(original);
  });
  it("pauses unsupported inline references and excessive inline nesting instead of dropping text", () => {
    const mention = createEditorDocument([{ id: "mention", type: "paragraph", content: [{ type: "pageMention", props: { pageId: "referenced-page" } }] }]);
    expect(inspectOpenEditorPublication(mention)).toEqual([{ blockId: "mention", blockType: "paragraph", reason: "unsupported-inline" }]);
    expect(() => renderOpenEditorSite(mention, { requireCompleteDocument: true })).toThrow(IncompletePublicationError);
    let content: unknown = [{ type: "text", text: "Deep retained text" }];
    for (let depth = 0; depth < 34; depth++) content = [{ type: "link", content }];
    const deep = createEditorDocument([{ id: "deep", type: "paragraph", content: content as never }]);
    expect(inspectOpenEditorPublication(deep)[0]?.reason).toBe("inline-depth-limit");
    expect(() => renderOpenEditorPresentation(deep, { requireCompleteDocument: true })).toThrow(IncompletePublicationError);
  });
  it("does not inspect or expose an unsupported private subtree", () => {
    const source = createEditorDocument([{ id: "private", type: "unknownWidget", props: { visibility: "private" }, children: [{ id: "secret", type: "unknownChild", content: "Private secret" }] }]);
    expect(inspectOpenEditorPublication(source)).toEqual([]);
    expect(renderOpenEditorSite(source, { requireCompleteDocument: true })).not.toContain("Private secret");
  });
});
