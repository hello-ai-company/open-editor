# Static publishing

`@hello-ai-company/editor-publish` provides `renderOpenEditorSite(document, options)` and `getPublicKnowledgeContext(document, options)`. The host decides which document is public, persists publication settings, configures hosting, and supplies optional title/description/canonical/Open Graph URLs.

The renderer accepts a fixed semantic block allowlist, omits hidden/private/internal content and unknown blocks, escapes text and attributes, and accepts only safe image URLs. It emits responsive semantic HTML and SEO metadata without scripts, iframes, arbitrary HTML, or arbitrary CSS.

`getPublicKnowledgeContext` returns `trust: "untrusted"`; keep published text separate from trusted model instructions because public content can contain prompt injection.

## R2 package release order

Do not publish as part of this PR. After review, use this order: verify `@hello-ai-company/editor-core@0.1.1` is on npm (confirmed); publish `@hello-ai-company/editor-blocknote@0.1.1`; publish `@hello-ai-company/editor-ai@0.1.0`; publish `@hello-ai-company/editor-canvas@0.1.0`; then publish `@hello-ai-company/editor-publish@0.1.0`. Each package has a public npm `publishConfig`; `editor-publish` depends on `editor-canvas`, so it must come last. The blocknote workflow remains manual, main-branch-only, and gated by the public-npmjs Environment.

After these releases, update Personal-AI to install the reviewed `editor-blocknote`, `editor-ai`, `editor-canvas`, and `editor-publish` versions, refresh its lockfile, and rerun the exact-package contract and host integration checks. The current Personal-AI integration remains on the previously published BlockNote package.

## Known projection limits

HTML, Markdown, DOCX, and PDF print HTML share one internal allowlisted Export IR. `renderOpenEditorMarkdown(document)` is lossy: inline marks, arbitrary hyperlinks, and unknown blocks are omitted. `renderOpenEditorDocx(document)` creates a clean-room DOCX; `renderOpenEditorPdfPrintHtml(document)` returns deterministic A4 HTML for a host browser's Save as PDF flow, not PDF bytes. Review exports before publication. Navigation, hosting, visitor analytics, Ask This Page UI, CSP headers, and deployment remain host responsibilities.
