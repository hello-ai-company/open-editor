# Static publishing

`@hello-ai-company/editor-publish` provides `renderOpenEditorSite(document, options)` and `getPublicKnowledgeContext(document, options)`. The host decides which document is public, persists publication settings, configures hosting, and supplies optional title/description/canonical/Open Graph URLs.

The renderer accepts a fixed semantic block allowlist, omits hidden/private/internal content and unknown blocks, escapes text and attributes, and accepts only safe image URLs. It emits responsive semantic HTML and SEO metadata without scripts, iframes, arbitrary HTML, or arbitrary CSS.

`getPublicKnowledgeContext` returns `trust: "untrusted"`; keep published text separate from trusted model instructions because public content can contain prompt injection.

## R3 package release state

No package is published by this PR. The four release workflows are manual and main-only; they bind dispatch to a full reviewed SHA, require exact confirmation and the `public-npmjs` Environment, use npm OIDC Trusted Publishing, and do not use an npm token. They pin Actions to immutable commits, verify a pinned npm 11.20.0 tarball, disable lifecycle scripts during dependency installation and publication, validate exact package metadata/dependency releases, inspect an exact tarball inventory, and recheck the registry immediately before publish. Each workflow verifies the exact npm name, version, MIT license, canonical tarball URL, and SHA-512 integrity after publish with bounded retries. The publish job downloads and publishes the SHA-256-bound artifact without rebuilding it. `public-release-preflight` covers all four candidates and the dependency DAG on Node 20 and 22. See the [canonical owner release runbook](./public-release-runbook.md); GitHub Environment reviewers and npm Trusted Publisher bindings remain external owner settings.

The reviewed release Action commits are `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1`, `actions/setup-node@820762786026740c76f36085b0efc47a31fe5020`, `actions/upload-artifact@bbbca2ddaa5d8feaa63e36b76fdaad77386f024f`, and `actions/download-artifact@70fc10c6e5e1ce46ad2ea6f2b72d43f7d47b13c3`. Release workflows install npm 11.20.0 from `https://registry.npmjs.org/npm/-/npm-11.20.0.tgz` and verify SHA-512 `dF3EDFwbYN+N5RUip+ZYDe0NeURK5BgqKOcvT1iNtUYhTMTl0FwWhBuXrS7KtXyduqyTMS5aaQaregnHDAxNgw==`; npm Trusted Publishing requires npm 11.5.1 or newer.

The dependency order is `editor-blocknote@0.1.1`, `editor-ai@0.1.0`, `editor-canvas@0.1.0`, then `editor-publish@0.1.0`; the last package requires the exact Canvas version to be live first. `editor-core@0.1.1` is live. Registry checks on 2026-09-28 found the three new package targets and BlockNote 0.1.1 absent; BlockNote 0.1.0 remains live. No release workflow was dispatched and no publish authorization was given.

Before any owner-authorized dispatch, verify that the GitHub `public-npmjs` Environment has the intended reviewers and npm Trusted Publisher is configured for the exact workflow filename/environment pair. Those account settings are not inspectable from this source diff.

After the OpenEditor changes are reviewed and merged, publish through the guarded workflows in the order above. Then update Personal-AI's registry dependencies and lockfile, run the exact-package contract and host integration checks, and complete browser verification. Do not merge either draft PR as a shortcut for publication.

## Known projection limits

HTML, Markdown, DOCX, and PDF print HTML share one internal allowlisted Export IR. `renderOpenEditorMarkdown(document)` is lossy: inline marks, arbitrary hyperlinks, and unknown blocks are omitted. `renderOpenEditorDocx(document)` creates a clean-room DOCX; `renderOpenEditorPdfPrintHtml(document)` returns deterministic A4 HTML for a host browser's Save as PDF flow, not PDF bytes. Review exports before publication. Navigation, hosting, visitor analytics, CSP headers, and deployment remain host responsibilities; Ask This Page uses a separate server-owned public projection in Personal AI.
