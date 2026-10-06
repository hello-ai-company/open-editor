# OpenEditor 0.2.0 release record

Published on 2026-10-06 from reviewed main
`43ee878310690b5265c8e6bd31b5f027d1998eb7` in
[hello-ai-company/open-editor](https://github.com/hello-ai-company/open-editor/commit/43ee878310690b5265c8e6bd31b5f027d1998eb7).
All five packages are public, MIT, immutable 0.2.0 releases on the official npm
registry. Core was published first; BlockNote, AI and Canvas followed; Publish
followed verified Core and Canvas. Later documentation commits do not change
this release source or the immutable artifacts.

## Official publication and verification

| npm package | Version | Existing OIDC workflow | Recorded result |
| --- | --- | --- | --- |
| [@hello-ai-company/editor-core](https://www.npmjs.com/package/@hello-ai-company/editor-core/v/0.2.0) | 0.2.0 | [core run](https://github.com/hello-ai-company/open-editor/actions/runs/37436820538) | Workflow succeeded |
| [@hello-ai-company/editor-blocknote](https://www.npmjs.com/package/@hello-ai-company/editor-blocknote/v/0.2.0) | 0.2.0 | [blocknote run](https://github.com/hello-ai-company/open-editor/actions/runs/37437556648) | Workflow succeeded |
| [@hello-ai-company/editor-ai](https://www.npmjs.com/package/@hello-ai-company/editor-ai/v/0.2.0) | 0.2.0 | [ai run](https://github.com/hello-ai-company/open-editor/actions/runs/37437560526) | Publish succeeded; post-publish read recovered separately |
| [@hello-ai-company/editor-canvas](https://www.npmjs.com/package/@hello-ai-company/editor-canvas/v/0.2.0) | 0.2.0 | [canvas run](https://github.com/hello-ai-company/open-editor/actions/runs/37437564332) | Workflow succeeded |
| [@hello-ai-company/editor-publish](https://www.npmjs.com/package/@hello-ai-company/editor-publish/v/0.2.0) | 0.2.0 | [publish run](https://github.com/hello-ai-company/open-editor/actions/runs/37438507612) | Workflow succeeded |

The existing Trusted Publisher bindings and normal `public-npmjs` Environment
approvals were used. Pinned Actions, Node 24 and npm 11.20.0 prepared immutable,
inspected, source-SHA-bound artifacts; publish jobs consumed those artifacts
without rebuilding. No new token, login, binding, reviewer, account permission or
security setting was introduced. No tag, GitHub Release or deployment was made.

AI run 37437560526 retains a failed conclusion: its `npm publish` step succeeded,
but the subsequent read-only registry verification reported
`npm registry request failed unexpectedly`. The same repository verification
command then passed read-only locally (one request, 278 ms). Independent official
metadata, tarball and provenance checks also passed, followed by an isolated
registry install and cryptographic signature audit. The failing run was preserved;
it was not rerun, and AI 0.2.0 was not republished. The logs do not establish a
more specific root cause for the failed request.

A Core preparation run on the earlier main was cancelled while awaiting approval,
before publication, to remove stale unpublished labels from packed READMEs.
The final five package payloads differ from the preserved local Core-alignment
candidates only in `package/README.md`; runtime, manifests, declarations, exports,
versions and dependency floors were retained.

## Published artifact identity

These SHA-256 values identify the exact downloaded official prepared artifacts
and the byte-identical tarballs fetched independently from the public registry.
All five registry SHA-512 integrities match the prepared artifact digest and
installed lockfile SRI. Inventories and source bytes were inspected before each
Environment approval; no secrets, local paths or browser/test artifacts were packed.

| Package | Files | Tarball bytes | SHA-256 |
| --- | ---: | ---: | --- |
| core | 27 | 16,353 | `d9cd3f49ee036e8532d3abbd1d8a8a853199f7d61a91091ed4b4ff2067ceb003` |
| blocknote | 308 | 243,261 | `0fa52324ce1c5c5004fa9a383162714e6d0fb037c79ca046eefef7ee24b1b1fe` |
| ai | 27 | 30,550 | `631e7f0493e8dcb8b74b71ffd40ae9b654b03461896c1a45ef5b579a57ebefc3` |
| canvas | 27 | 41,621 | `4a862e1cfddb02a5a6c38e648ae9a982227addeef783ee57d8e589aae2795146` |
| publish | 7 | 24,416 | `2aa312b73f3b7893d02b3085ab2b5c9ff71aa3004c378c0de3ea9f66365aa2d1` |

Provenance claims match the exact tarball SHA-512, source commit above, repository,
`refs/heads/main`, each `.github/workflows/publish-public-*.yml`, GitHub-hosted
builder and corresponding run/attempt 1. Pinned npm 11.20.0
`audit signatures --json --include-attestations` cryptographically verified all
five exact 0.2.0 attestations; `invalid` and `missing` were empty.

## Verification evidence

- Hosted [CI](https://github.com/hello-ai-company/open-editor/actions/runs/37436441165)
  and [public-release-preflight](https://github.com/hello-ai-company/open-editor/actions/runs/37436441107)
  passed on the exact release main SHA for Node 20 and 22. Each Node 24 prepare job
  passed the full verification suite and its immutable-artifact inspection.
- `npm run verify`: 800 distinct tests (AI 52, BlockNote 467, Canvas 30, Core 57,
  Publish 25, type-export 6, release-guard 123, demo-state 13, example 27), plus
  4 benchmark smoke cases. Repeated BlockNote pipeline tests are counted once.
  Typechecks, builds, API contract, package consumers and production security
  audit passed. The example build retains its existing large-chunk warning.
- An isolated macOS / Node 22.14.0 consumer installed all five exact 0.2.0 versions
  directly from `https://registry.npmjs.org`, with no local tarballs or workspace
  symlinks. Exact tarball URLs/SRI, strict NodeNext public/root/React types and
  runtime exports passed. Tests exercised wide-document and combined-JSON
  roundtrip/cloning, retained subtree rejection and codec errors, Canvas SSR,
  Markdown/Site/DOCX and an explicit idle synthetic AI session with zero model calls.
- Four additional fresh consumers each installed only BlockNote, AI, Canvas or
  Publish 0.2.0. Core 0.2.0 resolved automatically, and Publish also resolved Canvas
  0.2.0. Exact lock SRI, official tarball URLs, imports, no workspace symlinks and
  no duplicate nested Core installation passed. No `--force` or
  `--legacy-peer-deps` was used.
- Earlier isolated Chromium/IndexedDB preservation checks passed 8 scenarios,
  including wide save/load, rejected operations, revision CAS and failed initial
  open without fallback overwrite. Their source/environment and limitations are
  preserved in the [historical preparation record](release-preparation-0.2-core-contract.md).
  They are not a new performance, Safari or native-host comparison for publication.

Local detailed evidence remains outside committed/packed packages in
`output/npm-release-preparation/github-publication/`: official digests/tarballs,
artifact reviews, published metadata/proofs, provenance, workflow results/logs,
AI recovery log, registry consumer receipts and signature results. Previous
worktrees, branches, untracked files and preparation artifacts were preserved.

## Compatibility and remaining scope

See [CHANGELOG](../CHANGELOG.md), [migration](migration-0.2.md),
[versioning](versioning.md) and the [owner runbook](public-release-runbook.md).
Document schema remains 1. Internal Core/Canvas floors are ^0.2.0; ^0.1.x does
not select this release. Core accepts each valid root independently, while
retaining subtree/depth/JSON limits; a legacy single oversized root may still
fail. Preserve stored bytes/current edits on rejection. There is no automatic
split, truncation or document migration. Host and AI total-size quotas remain
independent of Core acceptance.

The example uses explicitly selected synthetic proposals. Real-model connection,
actual-model adversarial verification, durable remote approval coordination and
Personal-AI dependency/lockfile upgrades were not performed. Publication removes
the missing-registry-version gate; it does not prove those separate product flows.
