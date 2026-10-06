# `@hello-ai-company/editor-publish`

## 0.2.0 candidate

Prepared locally; not published. Requires `editor-core ^0.2.0` and
`editor-canvas ^0.2.0`. Hidden Canvas content is excluded from derived Site/Present
titles and descriptions; a hidden parent remains hidden when children become
slide roots. Existing rendering APIs remain. These corrected projections can
change previous exports, so review and regenerate output; no hosting or public
publication occurs automatically.
See the [migration guide](https://github.com/hello-ai-company/open-editor/blob/main/docs/migration-0.2.md).

Safe HTML, Markdown, presentation, and DOCX output plus public knowledge projections for OpenEditor documents.

```ts
import {
  getPublicKnowledgeContext,
  renderOpenEditorDocx,
  renderOpenEditorMarkdown,
  renderOpenEditorPdfPrintHtml,
  renderOpenEditorPresentation,
  renderOpenEditorSite
} from "@hello-ai-company/editor-publish";

const html = renderOpenEditorSite(document, {
  title: "Project update",
  description: "A public summary",
  canonicalUrl: "https://example.com/project",
  canvasSpec
});
const markdown = renderOpenEditorMarkdown(document);
const docxBlob = await renderOpenEditorDocx(document);
const printHtml = renderOpenEditorPdfPrintHtml(document, { canvasSpec });
const context = getPublicKnowledgeContext(document);
const presentation = renderOpenEditorPresentation(document);
```

`context.trust` is always `"untrusted"`. Keep its document-derived text separate from trusted model instructions; a public page can contain prompt-injection text.

The HTML renderer uses the same semantic allowlist and omits hidden/private content and unknown blocks. When a Canvas spec is provided, it validates the layout and renders responsive containers and allowlisted theme tokens. Without it, the existing article layout is unchanged. Native columnList and column blocks are transparent responsive wrappers, retaining ordered child content and relative widths.

The presentation renderer builds accessible heading-grouped slides with previous/next controls, arrow/space/escape keys, mobile sizing, and optional browser fullscreen. Both HTML renderers escape document text and attributes, validate URLs, and never render document-provided HTML, CSS, or JavaScript. Chart and embed references render placeholders; presentations are grouped from semantic headings rather than the Canvas tree.

The shared internal Export IR feeds HTML, Markdown, and a clean-room DOCX renderer. DOCX keeps semantic headings, paragraphs, lists, quotes, callouts, code, and public column child order; external images become safe text labels. The renderer uses the MIT-licensed docx package.

Markdown escapes inline text as literal content, omits arbitrary links, validates and encodes image destinations, and uses fenced code blocks. The PDF helper returns deterministic A4 print HTML that a host can open and pass to the browser's Save as PDF flow; it does not generate PDF bytes. These projections are intentionally lossy; review output before publishing. Hosting and publishing remain host responsibilities.
