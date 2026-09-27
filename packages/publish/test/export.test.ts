import { describe, expect, it } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import {
  renderOpenEditorDocx,
  renderOpenEditorPdfPrintHtml
} from "../src/index.js";

describe("clean-room document exports", () => {
  it("creates a valid DOCX archive from the public Export IR", async () => {
    const doc = createEditorDocument([
      { id: "heading", type: "heading", props: { level: 1 }, content: "Public title" },
      { id: "column-list", type: "columnList", children: [
        { id: "column-a", type: "column", children: [{ id: "a", type: "paragraph", content: "Column A" }] },
        { id: "column-b", type: "column", children: [{ id: "b", type: "paragraph", content: "Column B" }] }
      ] },
      { id: "private", type: "paragraph", props: { visibility: "private" }, content: "Private material" }
    ]);
    const blob = await renderOpenEditorDocx(doc, { author: "OpenEditor test" });
    const bytes = new Uint8Array(await blob.arrayBuffer());

    expect(blob.type).toContain("officedocument.wordprocessingml.document");
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("returns deterministic browser-printable HTML rather than claiming PDF bytes", () => {
    const doc = createEditorDocument([
      { id: "heading", type: "heading", props: { level: 1 }, content: "Print title" },
      { id: "paragraph", type: "paragraph", content: "Print copy" }
    ]);
    const html = renderOpenEditorPdfPrintHtml(doc);

    expect(html).toContain("@page{size:A4;margin:18mm}");
    expect(html).toContain("@media print");
    expect(html).toContain("break-inside:avoid-page");
    expect(html).toContain("Print title");
    expect(html).toContain("Print copy");
    expect(html).not.toMatch(/<script\b/i);
  });
});
