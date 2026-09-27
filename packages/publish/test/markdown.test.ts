import { describe, expect, it } from "vitest";
import { createEditorDocument, type EditorBlock } from "@hello-ai-company/editor-core";
import { renderOpenEditorMarkdown } from "../src/index.js";

function document(blocks: EditorBlock[]) {
  return createEditorDocument(blocks);
}

describe("OpenEditor Markdown export", () => {
  it("renders allowlisted structures and escapes text as literal Markdown", () => {
    const ticks = String.fromCharCode(96).repeat(3);
    const fence = ticks + String.fromCharCode(96);
    const markdown = renderOpenEditorMarkdown(document([
      { id: "heading", type: "heading", props: { level: 2 }, content: "Release notes" },
      {
        id: "paragraph",
        type: "paragraph",
        content: [
          { type: "text", text: "<script>alert(1)</script> **literal** ", styles: {} },
          { type: "link", href: "javascript:alert(2)", content: [{ type: "text", text: "[link]", styles: {} }] }
        ]
      },
      {
        id: "item",
        type: "bulletListItem",
        content: "First item",
        children: [{ id: "nested", type: "paragraph", content: "Nested detail" }]
      },
      { id: "item2", type: "bulletListItem", content: "Second item" },
      { id: "ordered1", type: "numberedListItem", content: "One" },
      { id: "ordered2", type: "numberedListItem", content: "Two" },
      { id: "quote", type: "quote", content: "Quoted" },
      { id: "callout", type: "callout", props: { title: "Heads up", variant: "warning" }, content: "Read this" },
      { id: "code", type: "codeBlock", content: "sample\n" + ticks + "\n</script>" },
      { id: "status", type: "status", props: { state: "done" } },
      { id: "divider", type: "divider" }
    ]));

    expect(markdown).toContain("## Release notes");
    expect(markdown).toContain("&lt;script&gt;alert\\(1\\)&lt;/script&gt;");
    expect(markdown).toContain("\\*\\*literal\\*\\*");
    expect(markdown).toContain("\\[link\\]");
    expect(markdown).not.toContain("javascript:");
    expect(markdown).toContain("- First item\n  Nested detail\n- Second item");
    expect(markdown).toContain("1. One\n2. Two");
    expect(markdown).toContain("> Quoted");
    expect(markdown).toContain("> Heads up\n>\n> Read this");
    expect(markdown).toContain(fence + "\nsample\n" + ticks + "\n</script>\n" + fence);
    expect(markdown).toContain("Status: Done");
    expect(markdown).toContain("---");
    expect(markdown).not.toMatch(/<script\b/i);
    expect(markdown).not.toMatch(/<iframe\b/i);
  });

  it("keeps the public-content filter and emits only safe image destinations", () => {
    const markdown = renderOpenEditorMarkdown(document([
      {
        id: "private-parent",
        type: "paragraph",
        props: { visibility: "private" },
        content: "private parent",
        children: [{ id: "private-child", type: "paragraph", content: "private child" }]
      },
      { id: "unknown", type: "agentBlock", content: "unknown block text" },
      { id: "safe", type: "image", props: { url: "https://cdn.example.test/a b(foo).png", alt: "cover ](evil)" } },
      { id: "relative", type: "image", props: { url: "../images/cover.png", alt: "Relative cover" } },
      { id: "javascript", type: "image", props: { url: "javascript:alert(1)", alt: "Unsafe image" } },
      { id: "entity-scheme", type: "image", props: { url: "&#x6a;avascript:alert(1)", alt: "Entity image" } },
      { id: "encoded-scheme", type: "image", props: { url: "javascript&#58;alert(1)", alt: "Encoded scheme image" } },
      { id: "data", type: "image", props: { url: "data:image/svg+xml,<svg>", alt: "Data image" } },
      { id: "protocol-relative", type: "image", props: { url: "//tracker.example.test/image.png", alt: "Remote image" } }
    ]));

    expect(markdown).toContain("![cover \\]\\(evil\\)](https://cdn.example.test/a%20b%28foo%29.png)");
    expect(markdown).toContain("![Relative cover](../images/cover.png)");
    expect(markdown).toContain("Unsafe image");
    expect(markdown).toContain("Entity image");
    expect(markdown).toContain("Encoded scheme image");
    expect(markdown).toContain("Data image");
    expect(markdown).toContain("Remote image");
    expect(markdown).not.toContain("javascript:");
    expect(markdown).not.toContain("&#x6a;avascript:");
    expect(markdown).not.toContain("javascript&#58;");
    expect(markdown).not.toContain("data:image");
    expect(markdown).not.toContain("tracker.example.test");
    expect(markdown).not.toContain("private parent");
    expect(markdown).not.toContain("private child");
    expect(markdown).not.toContain("unknown block text");
  });
});
