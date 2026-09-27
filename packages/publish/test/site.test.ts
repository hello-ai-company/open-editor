import { describe, expect, it } from "vitest";
import { createEditorDocument, type EditorBlock } from "@hello-ai-company/editor-core";
import { getPublicKnowledgeContext, renderOpenEditorSite } from "../src/index.js";

function document(blocks: EditorBlock[]) {
  return createEditorDocument(blocks);
}

describe("OpenEditor public site rendering", () => {
  it("escapes text, attributes, and SEO metadata", () => {
    const html = renderOpenEditorSite(document([
      { id: "p1", type: "paragraph", content: [{ type: "text", text: "<script>alert('x')</script> & safe", styles: {} }] },
      { id: "img1", type: "image", props: { url: "/cover.png", alt: `cover\" onerror=\"alert(1)` } }
    ]), {
      title: `Title\"><script>alert(1)</script>`,
      description: `Description\" onload=\"alert(1)`,
      canonicalUrl: "https://example.test/page?name=%22",
      ogImageUrl: "https://example.test/cover.png"
    });

    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; safe");
    expect(html).toContain("<title>Title&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>");
    expect(html).toContain('alt="cover&quot; onerror=&quot;alert(1)"');
    expect(html).toContain('content="Description&quot; onload=&quot;alert(1)"');
    expect(html).toContain('<link rel="canonical" href="https://example.test/page?name=%22">');
    expect(html).not.toMatch(/<script\b/i);
  });

  it("renders only safe HTTP(S) and relative image URLs", () => {
    const html = renderOpenEditorSite(document([
      { id: "https", type: "image", props: { url: "https://cdn.example.test/image.webp", alt: "HTTPS" } },
      { id: "relative", type: "image", props: { url: "../images/relative.png", alt: "Relative" } },
      { id: "javascript", type: "image", props: { url: "javascript:alert(1)", alt: "Unsafe" } },
      { id: "data", type: "image", props: { url: "data:image/svg+xml,<svg>", alt: "Unsafe data" } },
      { id: "protocol-relative", type: "image", props: { url: "//tracker.example.test/image.png", alt: "Unsafe relative" } },
      { id: "credential", type: "image", props: { url: "https://user:pass@example.test/image.png", alt: "Credential URL" } }
    ]));

    expect(html).toContain('src="https://cdn.example.test/image.webp"');
    expect(html).toContain('src="../images/relative.png"');
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:image");
    expect(html).not.toContain("tracker.example.test");
    expect(html).not.toContain("user:pass");
    expect(html).toContain("Unsafe");
  });

  it("omits hidden and private subtrees and projects no arbitrary props", () => {
    const doc = document([
      { id: "public", type: "heading", props: { level: 1, secret: "private metadata" }, content: [{ type: "text", text: "Public title", styles: {} }] },
      {
        id: "hidden-parent",
        type: "paragraph",
        props: { hidden: true },
        content: [{ type: "text", text: "Hidden parent" }],
        children: [{ id: "hidden-child", type: "paragraph", content: [{ type: "text", text: "Hidden child" }] }]
      },
      { id: "private", type: "paragraph", props: { visibility: "private" }, content: "Private visibility" },
      { id: "internal", type: "paragraph", props: { public: false }, content: "Internal content" },
      { id: "unknown", type: "agentBlock", props: { token: "agent-secret" }, content: "Unknown content" },
      { id: "comment", type: "comment", props: { author: "private author" }, content: "Private comment" },
      { id: "public-text", type: "paragraph", props: { provenance: { actorId: "secret-agent" }, custom: "not public" }, content: "Visible text" }
    ]);
    const html = renderOpenEditorSite(doc);
    const context = getPublicKnowledgeContext(doc);
    expect(context.trust).toBe("untrusted");

    for (const secret of [
      "Hidden parent",
      "Hidden child",
      "Private visibility",
      "Internal content",
      "Unknown content",
      "Private comment",
      "private metadata",
      "agent-secret",
      "secret-agent",
      "private author"
    ]) {
      expect(html).not.toContain(secret);
      expect(context.text).not.toContain(secret);
    }
    expect(html).toContain("Public title");
    expect(html).toContain("Visible text");
    expect(context.blocks).toEqual([
      { type: "heading", text: "Public title" },
      { type: "paragraph", text: "Visible text" }
    ]);
    expect(Object.keys(context.blocks[0]!).sort()).toEqual(["text", "type"]);
  });

  it("emits title, description, canonical and Open Graph metadata", () => {
    const html = renderOpenEditorSite(document([
      { id: "h1", type: "heading", props: { level: 1 }, content: "Derived title" },
      { id: "p1", type: "paragraph", content: "Derived description" }
    ]), {
      canonicalUrl: "https://example.test/canonical",
      ogImageUrl: "/images/share.png",
      siteName: "Example site"
    });

    expect(html).toContain("<title>Derived title</title>");
    expect(html).toContain('<meta name="description" content="Derived description">');
    expect(html).toContain('<link rel="canonical" href="https://example.test/canonical">');
    expect(html).toContain('<meta property="og:title" content="Derived title">');
    expect(html).toContain('<meta property="og:description" content="Derived description">');
    expect(html).toContain('<meta property="og:site_name" content="Example site">');
    expect(html).toContain('<meta property="og:image" content="/images/share.png">');
  });

  it("emits responsive semantic HTML without scripts or frames", () => {
    const html = renderOpenEditorSite(document([
      { id: "h1", type: "heading", props: { level: 1 }, content: "Page" },
      { id: "quote", type: "quote", content: "A quote" },
      { id: "list1", type: "bulletListItem", content: "First" },
      { id: "list2", type: "bulletListItem", content: "Second" },
      { id: "divider", type: "divider" },
      { id: "callout", type: "callout", props: { variant: "warning", title: "Note" }, content: "Details" },
      { id: "raw-html", type: "paragraph", content: "<script>alert(1)</script><iframe src=\"https://evil.test\"></iframe>" }
    ]));

    expect(html).toContain("<main class=\"oe-site\">");
    expect(html).toContain("<article class=\"oe-site__article\">");
    expect(html).toContain("<blockquote>A quote</blockquote>");
    expect(html).toContain("<ul><li>First</li><li>Second</li></ul>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;&lt;iframe");
    expect(html).toContain("@media(prefers-color-scheme:dark)");
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/<iframe\b/i);
  });

  it("rejects invalid documents and ignores unsafe SEO URLs", () => {
    expect(() => renderOpenEditorSite({ schemaVersion: 2, blocks: [] } as never)).toThrow(/valid EditorDocument/);
    const html = renderOpenEditorSite(document([]), {
      canonicalUrl: "javascript:alert(1)",
      ogImageUrl: "data:image/svg+xml,<svg>"
    });
    expect(html).not.toContain("rel=\"canonical\"");
    expect(html).not.toContain("og:url");
    expect(html).not.toContain("og:image");
  });
});
