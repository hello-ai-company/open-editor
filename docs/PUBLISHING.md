# Static publishing

`@hello-ai-company/editor-publish` provides `renderOpenEditorSite(document, options)` and `getPublicKnowledgeContext(document, options)`. The host decides which document is public, persists publication settings, configures hosting, and supplies optional title/description/canonical/Open Graph URLs.

The renderer accepts a fixed semantic block allowlist, omits hidden/private/internal content and unknown blocks, escapes text and attributes, and accepts only safe image URLs. It emits responsive semantic HTML and SEO metadata without scripts, iframes, arbitrary HTML, or arbitrary CSS.

`getPublicKnowledgeContext` returns `trust: "untrusted"`; keep published text separate from trusted model instructions because public content can contain prompt injection.

## Published 0.2.0

All five 0.2.0 packages were published on 2026-10-06 from reviewed main
`43ee878310690b5265c8e6bd31b5f027d1998eb7`. Core was released first, then
BlockNote, AI and Canvas, followed by Publish after exact Canvas was live.
Every internal Core and Canvas dependency/peer floor is ^0.2.0. Official registry
bytes, isolated dependency resolution and cryptographic provenance verification
passed. See the [release record](release-0.2.md), [CHANGELOG](../CHANGELOG.md),
[migration](migration-0.2.md) and [owner runbook](public-release-runbook.md).

Existing manual Trusted Publisher OIDC workflows used the exact reviewed main
SHA, pinned Actions/npm 11.20.0, lifecycle-disabled installation/publication,
inspected immutable artifacts and SHA-256/source-SHA binding. Normal public-npmjs
Environment approvals were used. No credentials, bindings or account permissions
were changed. AI's publish step succeeded; its post-publish read failed and was
recovered by read-only verification without republishing. Published 0.2.0 versions
are immutable. Bootstrap tools are historical and were not used.

The local example has explicitly selected synthetic proposals only. editor-ai
ships a provider-neutral controller, not connected model execution. Personal-AI
main 49c74b0 is in a separate repository; it was not upgraded or automatically
synchronized. Consumption and actual-model validation remain separate work.

## Known projection limits

HTML, Markdown, DOCX, and PDF print HTML share one internal allowlisted Export IR. `renderOpenEditorMarkdown(document)` is lossy: inline marks, arbitrary hyperlinks, and unknown blocks are omitted. `renderOpenEditorDocx(document)` creates a clean-room DOCX; `renderOpenEditorPdfPrintHtml(document)` returns deterministic A4 HTML for a host browser's Save as PDF flow, not PDF bytes. Review exports before publication. Navigation, hosting, visitor analytics, CSP headers, and deployment remain host responsibilities; Ask This Page uses a separate server-owned public projection in Personal AI.
