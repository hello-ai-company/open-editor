# Static publishing

`@hello-ai-company/editor-publish` provides `renderOpenEditorSite(document, options)` and `getPublicKnowledgeContext(document, options)`. The host decides which document is public, persists publication settings, configures hosting, and supplies optional title/description/canonical/Open Graph URLs.

The renderer accepts a fixed semantic block allowlist, omits hidden/private/internal content and unknown blocks, escapes text and attributes, and accepts only safe image URLs. It emits responsive semantic HTML and SEO metadata without scripts, iframes, arbitrary HTML, or arbitrary CSS.

`getPublicKnowledgeContext` returns `trust: "untrusted"`; keep published text separate from trusted model instructions because public content can contain prompt injection.

## 0.2.0 release preparation

Registry reads on 2026-10-06 verified live core/blocknote 0.1.1 and
AI/Canvas/Publish 0.1.0. Integrity-verified registry tarballs differ from the current
runtime build in all five packages. All five 0.2.0 manifests are local candidates;
none was published by this preparation. See [CHANGELOG](../CHANGELOG.md),
[migration](migration-0.2.md) and the [owner runbook](public-release-runbook.md).

Publish order after separate approval is core 0.2.0 first, then BlockNote, AI and
Canvas 0.2.0, then Publish 0.2.0 after exact Canvas is live. Every internal core
and Canvas dependency/peer floor is ^0.2.0. Registry failure/ambiguity or an existing
candidate version stops publication; core also requires its known published
0.1.0 anchor. Exact release dependencies must exist at the actual publish gate.
Local candidate-consumer tests deliberately use unpublished tarballs and do not
prove those dependencies are registry-live.

All five manual OIDC workflows require an exact reviewed main SHA, pinned Actions
and npm 11.20.0, lifecycle-disabled installation/publication, inspected immutable
artifacts, SHA-256/source-SHA binding and post-publish npm identity/SHA-512 proof.
The core workflow now uses the shared reviewed-SHA guard. No workflow was
triggered. Existing Trusted Publisher and public-npmjs Environment account settings
must be confirmed by the owner before dispatch; no credentials, binding or
permissions were changed. Bootstrap instructions/scripts are historical first
publication tools and are not used for these existing package updates.

The local example has explicitly selected synthetic proposals only. editor-ai
ships a provider-neutral controller, not connected model execution. Personal-AI
main 49c74b0 is in a separate repository; it was not upgraded or automatically
synchronized. Consumption and actual-model validation remain separate work.

## Known projection limits

HTML, Markdown, DOCX, and PDF print HTML share one internal allowlisted Export IR. `renderOpenEditorMarkdown(document)` is lossy: inline marks, arbitrary hyperlinks, and unknown blocks are omitted. `renderOpenEditorDocx(document)` creates a clean-room DOCX; `renderOpenEditorPdfPrintHtml(document)` returns deterministic A4 HTML for a host browser's Save as PDF flow, not PDF bytes. Review exports before publication. Navigation, hosting, visitor analytics, CSP headers, and deployment remain host responsibilities; Ask This Page uses a separate server-owned public projection in Personal AI.
