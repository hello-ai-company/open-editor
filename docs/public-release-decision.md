# Public release decision package (master)

**INTERNAL EVIDENCE** — not a public product document.

**Case:** ENG-20260913-007 Phase 4E R1 / PA-20260917-002  
**Role:** Canonical decision matrix plus **current Phase 4E HEAD** state. This document does **not** authorize D1-EXEC (visibility / npmjs publish / tag / Release).

Master companions: [public-release-runbook.md](./public-release-runbook.md), [first-public-publish-bootstrap.md](./first-public-publish-bootstrap.md), [owner-release-confirmations.md](./owner-release-confirmations.md), [release-gate-closure.md](./release-gate-closure.md).

## Current (Phase 4E HEAD)

| Field | State |
| --- | --- |
| Repository | `hello-ai-company/open-editor` |
| MIT | **APPLIED** |
| `Copyright (c) 2026 Yuki Shibata` | **APPLIED** |
| Version `0.1.0` | **PREPARED** (package identity on this branch) |
| Registry | npmjs **PREPARED** (`https://registry.npmjs.org`) |
| Access | public **PREPARED** |
| Public README / SECURITY / CONTRIBUTING / CODEOWNERS | **PREPARED** |
| Old private publish workflow | **RETIRED** |
| Repository visibility | **PRIVATE** |
| npm publication | **NO** |
| GitHub Private Vulnerability Reporting | **NO** (not enabled; enable immediately after PUBLIC — PVR is not a private-repo setting) |
| D1-EXEC | **PENDING EXECUTION AUTHORIZATION** |
| READY FOR PUBLIC RELEASE PREPARATION | **YES** |
| READY TO PUBLISH NOW | **NO** |
| READY TO MAKE PUBLIC NOW | **NO** |
| `packages/core/src/**` | frozen; **CORE SOURCE CHANGE REQUIRED: NO** |
| Root workspace | `"private": true` (never publishable) |

Machine locks: `packages/core/package.json`, `scripts/lib/tarball.mjs` (`AUTHORIZED_*` = `0.1.0` / MIT / npmjs / public), `packages/core/test/publish-gate.test.ts`. Active non-publishing CI: `.github/workflows/ci.yml` and `.github/workflows/public-release-preflight.yml`. OIDC publish YAML is **template only** at [release-templates/publish-public-core.yml](./release-templates/publish-public-core.yml).

## Companion documents

| Document | Purpose |
| --- | --- |
| [public-release-runbook.md](./public-release-runbook.md) | Remaining human-gated execution order |
| [first-public-publish-bootstrap.md](./first-public-publish-bootstrap.md) | 0.1.0 once, then Trusted Publisher on the existing package, then OIDC |
| [public-exposure-audit.md](./public-exposure-audit.md) | Phase 4E history audit (P1 none) |
| [public-release-preparation.md](./public-release-preparation.md) | Phase 4E applied-prep record |
| [owner-release-confirmations.md](./owner-release-confirmations.md) | Phase 4D.1 confirmation record (historical + still-true philosophy) |
| [release-gate-closure.md](./release-gate-closure.md) | Earlier gate-classification record — prefer **Current** above if it disagrees |
| [owner-oss-policy.md](./owner-oss-policy.md) | OWNER-CONFIRMED mission; MIT now applied |
| [license-recommendation.md](./license-recommendation.md) | MIT selected; applied in Phase 4E |
| [chain-of-title-evidence.md](./chain-of-title-evidence.md) | D19 provenance; CLOSED (owner representation, not legal advice) |
| [npm-publication-readiness.md](./npm-publication-readiness.md) | D6 CLOSED; no npm mutations in confirmation phases |
| [security-release-gate.md](./security-release-gate.md) | D11 PREPARED; PVR not enabled |
| [repository-governance.md](./repository-governance.md) | CI / CODEOWNERS / protection recommendations |
| [branch-protection-plan.md](./branch-protection-plan.md) | Do not configure in this phase |
| [versioning.md](./versioning.md) | 0.1.0 compatibility policy |
| [public-api.md](./public-api.md) | Frozen public surface |
| [public-drafts/](./public-drafts/) | **Historical drafts** — live files are at repo root |

## Decision matrix (current)

Philosophy rows (**CONFIRMED**) do not by themselves authorize GitHub/npm settings.

| ID | Topic | Owner Decision | Applied / enabled now |
| --- | --- | --- | --- |
| D1 | Public OSS **intent** | **CONFIRMED: YES** — intent only | not execution |
| D1-EXEC | Public **execution** (visibility / npmjs / tag / Release) | **PENDING EXECUTION AUTHORIZATION** | **NO** |
| D2 | License | **CLOSED** — MIT | **APPLIED** |
| D3 | Copyright holder + year | **CLOSED** — `Copyright (c) 2026 Yuki Shibata` | **APPLIED** (in `LICENSE` files) |
| D4 | SPDX / NOTICE / CLA or DCO | **CLOSED for v0.1.0** — SPDX MIT; no NOTICE; **neither CLA nor DCO** | no CLA/DCO |
| D5 | Package name | **CLOSED** — keep `@hello-ai-company/editor-core` | name unchanged |
| D6 | npm org / scope ownership | **CLOSED** — owner controls `hello-ai-company` / `@hello-ai-company` / `@hello-ai-company/editor-core` | no npm login/token/publish |
| D7 | Registry | **PREPARED** — npmjs.org for the public line | metadata only; **not published** |
| D8 | First public version | **PREPARED** — `0.1.0` (never reuse `0.0.0-phase3.e17b4b5`) | identity on branch; **not published** |
| D9 | Repository visibility | **PENDING** — remain PRIVATE until D1-EXEC | **PRIVATE** |
| D10 | Repository / package rename | **CLOSED** — keep `open-editor` + current package name | NO rename |
| D11 | Security contact | **PREPARED** — GitHub PVR; enable **immediately after PUBLIC**; no invented email | **not enabled** |
| D12 | CODEOWNERS / reviewers | **PREPARED** — `* @yuki-s-code` | file present; GitHub enforcement is a settings step |
| D13 | Branch protection | **PENDING** — see [branch-protection-plan.md](./branch-protection-plan.md) | **not configured** |
| D14 | CI on pull request | **PREPARED** — canonical `ci.yml` + non-publishing `public-release-preflight.yml` (Node 20+22) | active; no real publish |
| D15 | Trusted publishing / provenance | **PENDING** — OIDC after 0.1.0 exists; template only | no tokens; template not live |
| D16 | `personal-ai` consumer path | **PENDING** — do not edit personal-ai from this repo | NO |
| D17 | Public README / CoC / templates | **PREPARED** for README / CONTRIBUTING / SECURITY; CoC / issue templates still later | root files present |
| D18 | Tags / GitHub Releases | **PENDING** — only after the published version exists | NO |
| D19 | Chain-of-title | **CLOSED** — owner representation, not legal advice | MIT applied on that basis |
| D20 | Business model | **CONFIRMED: FREE + OPTIONAL SPONSORSHIP** | no FUNDING.yml |
| D21 | Paid Cloud / Enterprise / plugin | **CONFIRMED: NO** | NO |
| D22 | Mandatory payment | **CONFIRMED: NO** | NO |
| D23 | Hosted SaaS / open-core redesign | **CONFIRMED: NO** | NO |
| D24 | Sponsor-only exclusive core | **CONFIRMED: NO** | NO |
| D25 | Cost principle | **CONFIRMED: OSS use must not create owner hosting/API costs** | library-only core |
| D26 | GitHub Sponsors / FUNDING.yml | **PENDING** — **SPONSOR LINK — OWNER SETUP REQUIRED** | no FUNDING.yml |

## Public identity (prepared in git; not published)

| Field | Phase 4E HEAD | Published / GitHub setting |
| --- | --- | --- |
| Repository | `hello-ai-company/open-editor` | still PRIVATE |
| Name | `@hello-ai-company/editor-core` | not on npmjs |
| Version | `0.1.0` | not on npmjs |
| License | MIT | applied in tree |
| Registry | `https://registry.npmjs.org` | metadata only |
| Access | public | metadata only |
| Maturity | 0.x early: **stable** document model / serialization / `schemaVersion` `1`; **experimental** provider seams | n/a |

**D6 CLOSED** by owner confirmation. Historical Phase 4D read-only probes (2026-09-16, not re-run as a publish): package/org 404s on npmjs; `npm whoami` `ENEEDAUTH`. GitHub org membership does **not** reserve the npm scope. Fallback names in [npm-publication-readiness.md](./npm-publication-readiness.md) stay **not selected**.

## License analysis (summary)

- **Selected and applied:** MIT with `Copyright (c) 2026 Yuki Shibata`.
- Apache-2.0 remains documented fallback only (not selected).
- Production runtime dependencies: **zero**. Tarball: `package.json`, `LICENSE`, `README.md`, `dist/*`.
- D19 chain-of-title: **CLOSED** as owner representation, not legal advice.

## Distribution (summary)

- Public line: scoped `@hello-ai-company/editor-core` on npmjs at `0.1.0` **once** after D1-EXEC (see bootstrap doc).
- GitHub Packages `0.0.0-phase3.e17b4b5` is **historical and immutable**. Publish-gate tests now **require** npmjs public `0.1.0` (they no longer lock GH Packages).
- Dual-registry is possible for consumers; do not reuse version strings across registries.

## Version strategy (summary)

- First public version is **`0.1.0`** (prepared). `1.0.0` would over-promise while provider types remain experimental.
- Package version and document `schemaVersion` (`1`) are independent.

## Public API (unchanged)

See [public-api.md](./public-api.md). Phase 4E does **not** alter the freeze besides echoing package version `0.1.0` in the contract JSON.

## Governance (summary)

Present at root: README, MIT LICENSE, CONTRIBUTING (no CLA/DCO), SECURITY (PVR path; not enabled), `.github/CODEOWNERS`. **No** CoC, issue/PR templates, Dependabot, or `.github/FUNDING.yml`. **No GitHub visibility/PVR/protection settings were changed.**

## Supply chain (current)

- Non-publishing CI + `npm publish --dry-run` preflight (`contents: read` only).
- Ongoing npmjs: OIDC Trusted Publishing **after** 0.1.0 exists — **not configured**.
- Do not create `NPM_TOKEN`.

## personal-ai migration (docs only)

See [public-release-runbook.md](./public-release-runbook.md). This repository **must not** edit `hello-ai-company/personal-ai`.

## OSS product direction

Portable document layer. **Small Core + Adapters + Docs + Examples**. No adapter packages. No core API change. **CORE SOURCE CHANGE REQUIRED: NO.**

## Historical snapshot (Phase 4D / 4D.1 — not current identity)

Phase 4D/4D.1 recorded MIT **selection** with **APPLIED NO**, identity `@hello-ai-company/editor-core@0.0.0-phase3.e17b4b5` `UNLICENSED` on GitHub Packages, and “do not start Phase 4E”. That snapshot is **obsolete as current state**. Those documents remain as evidence; if they disagree with **Current (Phase 4E HEAD)** above, the Current table wins.

Phase 4D.1 did **not** apply MIT, bump to `0.1.0`, or start preparation implementation. Phase 4E did the preparation. Neither phase published, tagged, Released, made the repo public, enabled PVR, or configured Trusted Publisher.

## Next

**READY FOR PUBLIC RELEASE PREPARATION** — **not READY TO PUBLISH NOW** — **not READY TO MAKE PUBLIC NOW**.

**STOP — READY FOR CHATGPT PUBLIC RELEASE REVIEW R1**
