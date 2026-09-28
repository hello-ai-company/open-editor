# Static publishing

`@hello-ai-company/editor-publish` provides `renderOpenEditorSite(document, options)` and `getPublicKnowledgeContext(document, options)`. The host decides which document is public, persists publication settings, configures hosting, and supplies optional title/description/canonical/Open Graph URLs.

The renderer accepts a fixed semantic block allowlist, omits hidden/private/internal content and unknown blocks, escapes text and attributes, and accepts only safe image URLs. It emits responsive semantic HTML and SEO metadata without scripts, iframes, arbitrary HTML, or arbitrary CSS.

`getPublicKnowledgeContext` returns `trust: "untrusted"`; keep published text separate from trusted model instructions because public content can contain prompt injection.

## R3 package release state

No package is published by this PR. The source has separate manual, main-only, exact-version and reviewed-SHA gated workflows for `editor-blocknote@0.1.1`, `editor-ai@0.1.0`, `editor-canvas@0.1.0`, and `editor-publish@0.1.0`. They require the `public-npmjs` Environment, exact confirmation, OIDC Trusted Publisher, public npm registry/access, MIT metadata, exact dependency checks, tarball inspection, lifecycle-script allowlists, and a registry absence recheck before publish. They do not accept PR refs or use an npm token. The new AI/Canvas/Publish release workflows pin actions to immutable commit SHAs and install npm 11.20.0 from an integrity-pinned tarball. The shared preflight validates all candidate manifests, dependency order, tarball identity, and isolated consumers.

The dependency order is `editor-blocknote@0.1.1`, `editor-ai@0.1.0`, `editor-canvas@0.1.0`, then `editor-publish@0.1.0`; the last package requires the exact Canvas version to be live first. `editor-core@0.1.1` is live. Registry checks on 2026-09-28 found the three new package targets and BlockNote 0.1.1 absent; BlockNote 0.1.0 remains live. No release workflow was dispatched and no publish authorization was given.

Before any owner-authorized dispatch, verify that the GitHub `public-npmjs` Environment has the intended reviewers and npm Trusted Publisher is configured for the exact workflow filename/environment pair. Those account settings are not inspectable from this source diff.

After the OpenEditor changes are reviewed and merged, publish through the guarded workflows in the order above. Then update Personal-AI's registry dependencies and lockfile, run the exact-package contract and host integration checks, and complete browser verification. Do not merge either draft PR as a shortcut for publication.

## Known projection limits

HTML, Markdown, DOCX, and PDF print HTML share one internal allowlisted Export IR. `renderOpenEditorMarkdown(document)` is lossy: inline marks, arbitrary hyperlinks, and unknown blocks are omitted. `renderOpenEditorDocx(document)` creates a clean-room DOCX; `renderOpenEditorPdfPrintHtml(document)` returns deterministic A4 HTML for a host browser's Save as PDF flow, not PDF bytes. Review exports before publication. Navigation, hosting, visitor analytics, CSP headers, and deployment remain host responsibilities; Ask This Page uses a separate server-owned public projection in Personal AI.
