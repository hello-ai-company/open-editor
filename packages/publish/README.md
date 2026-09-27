# `@hello-ai-company/editor-publish`

Safe static HTML and Markdown output, plus public knowledge projections for OpenEditor documents.

```ts
import {
  getPublicKnowledgeContext,
  renderOpenEditorMarkdown,
  renderOpenEditorSite
} from "@hello-ai-company/editor-publish";

const html = renderOpenEditorSite(document, {
  title: "Project update",
  description: "A public summary",
  canonicalUrl: "https://example.com/project"
});
const markdown = renderOpenEditorMarkdown(document);
const context = getPublicKnowledgeContext(document);
```

`context.trust` is always `"untrusted"`. Keep its document-derived text separate from trusted model instructions; a public page can contain prompt-injection text.

Both renderers use the same semantic block allowlist and omit hidden/private content and unknown blocks. HTML output escapes text and attributes, validates image and metadata URLs, and does not execute scripts, render arbitrary HTML, load iframes, or host pages. Markdown output escapes inline text as literal content, omits arbitrary links, validates and encodes image destinations, and uses fenced code blocks. These projections are intentionally lossy; review the result before publishing. The package does not provide hosting, DOCX/PDF output, arbitrary CSS, or JavaScript.
