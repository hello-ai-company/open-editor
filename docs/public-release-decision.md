# Public release decision package (master)

**INTERNAL EVIDENCE** — not a public product document.

**Case:** ENG-20260913-007 Phase 4E R1 / PA-20260917-002 / post-D1-EXEC / TP production-ready  
**Role:** Canonical decision matrix plus **current** state. Bootstrap visibility + npm `0.1.0` + tag/Release + Environment + Trusted Publisher are done. This document does **not** authorize republishing `0.1.0`, dispatching the publish workflow, or bumping to `0.1.1` without a separate ChatGPT-reviewed gate.

Master companions: [public-release-runbook.md](./public-release-runbook.md), [first-public-publish-bootstrap.md](./first-public-publish-bootstrap.md), [owner-release-confirmations.md](./owner-release-confirmations.md), [release-gate-closure.md](./release-gate-closure.md).

## Current (post D1-EXEC)

| Field | State | Verification |
| --- | --- | --- |
| Repository | `hello-ai-company/open-editor` | MACHINE-VERIFIED |
| MIT | **APPLIED** | MACHINE-VERIFIED |
| `Copyright (c) 2026 Yuki Shibata` | **APPLIED** | MACHINE-VERIFIED |
| Version `0.1.0` | **PUBLISHED** on npmjs (immutable; do not republish) | MACHINE-VERIFIED |
| Registry | npmjs **LIVE** (`https://registry.npmjs.org`) | MACHINE-VERIFIED |
| Access | public **LIVE** | MACHINE-VERIFIED |
| Public README / SECURITY / CONTRIBUTING / CODEOWNERS | **PRESENT** | MACHINE-VERIFIED |
| Old private publish workflow | **RETIRED** | MACHINE-VERIFIED |
| Repository visibility | **PUBLIC** | MACHINE-VERIFIED |
| npm publication | **YES** — `@hello-ai-company/editor-core@0.1.0` | MACHINE-VERIFIED |
| GitHub Private Vulnerability Reporting | **ENABLED** | MACHINE-VERIFIED |
| Protect main Ruleset | **ACTIVE** | MACHINE-VERIFIED |
| D1-EXEC | **EXECUTED** through bootstrap publish | MACHINE-VERIFIED |
| Trusted Publisher / OIDC | **OWNER-CONFIRMED CONFIGURED** (GitHub Actions → `hello-ai-company/open-editor` / `publish-public-core.yml` / Environment `public-npmjs`) | OWNER-CONFIRMED |
| Environment `public-npmjs` | **CONFIGURED + PROTECTED** (main only; no NPM_TOKEN) | MACHINE-VERIFIED existence/protection; no NPM_TOKEN OWNER-CONFIRMED |
| Tag / GitHub Release | **PUBLISHED** — tag `v0.1.0` → `ed59ae41ee4bd95ec01492415885f3ee2cdaaf0e`; Release `OpenEditor v0.1.0` (not prerelease) | MACHINE-VERIFIED |
| Future publish workflow | **production-ready candidate** — `.github/workflows/publish-public-core.yml` (manual OIDC for `0.1.1+` only; do not dispatch until ChatGPT review) | MACHINE-VERIFIED file |
| READY TO REPUBLISH `0.1.0` | **NO** | — |
| `packages/core/src/**` | frozen; **CORE SOURCE CHANGE REQUIRED: NO** | — |
| Root workspace | `"private": true` (never publishable) | MACHINE-VERIFIED |

Machine locks: `packages/core/package.json`, `scripts/lib/tarball.mjs` (`AUTHORIZED_*` = `0.1.0` / MIT / npmjs / public), `packages/core/test/publish-gate.test.ts`. Active non-publishing CI: `.github/workflows/ci.yml` and `.github/workflows/public-release-preflight.yml`. Active OIDC publish workflow: `.github/workflows/publish-public-core.yml` (prepare → Environment `public-npmjs` → publish; tokenless Trusted Publishing). Historical template: [release-templates/publish-public-core.yml](./release-templates/publish-public-core.yml).

## Companion documents

| Document | Purpose |
| --- | --- |
| [public-release-runbook.md](./public-release-runbook.md) | Remaining human-gated execution order |
| [first-public-publish-bootstrap.md](./first-public-publish-bootstrap.md) | 0.1.0 once, then workflow under `.github/workflows/`, then Trusted Publisher, then OIDC |
| [public-exposure-audit.md](./public-exposure-audit.md) | Phase 4E history audit (P1 none) |
| [public-release-preparation.md](./public-release-preparation.md) | Phase 4E applied-prep record |
| [owner-release-confirmations.md](./owner-release-confirmations.md) | Phase 4D.1 confirmation record (historical + still-true philosophy) |
| [release-gate-closure.md](./release-gate-closure.md) | Earlier gate-classification record — prefer **Current** above if it disagrees |
| [owner-oss-policy.md](./owner-oss-policy.md) | OWNER-CONFIRMED mission; MIT now applied |
| [license-recommendation.md](./license-recommendation.md) | MIT selected; applied in Phase 4E |
| [chain-of-title-evidence.md](./chain-of-title-evidence.md) | D19 provenance; CLOSED (owner representation, not legal advice) |
| [npm-publication-readiness.md](./npm-publication-readiness.md) | D6 CLOSED; no npm mutations in confirmation phases |
| [security-release-gate.md](./security-release-gate.md) | D11 historical prep notes — PVR is now **ENABLED** (prefer Current above) |
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
| D1-EXEC | Public **execution** (visibility / npmjs bootstrap; tag/Release separate) | **EXECUTED** through PUBLIC + PVR + Protect main + npm `0.1.0` | **YES** (bootstrap); tag/Release **PUBLISHED** |
| D2 | License | **CLOSED** — MIT | **APPLIED** |
| D3 | Copyright holder + year | **CLOSED** — `Copyright (c) 2026 Yuki Shibata` | **APPLIED** (in `LICENSE` files) |
| D4 | SPDX / NOTICE / CLA or DCO | **CLOSED for v0.1.0** — SPDX MIT; no NOTICE; **neither CLA nor DCO** | no CLA/DCO |
| D5 | Package name | **CLOSED** — keep `@hello-ai-company/editor-core` | name unchanged |
| D6 | npm org / scope ownership | **CLOSED** — owner controls `hello-ai-company` / `@hello-ai-company` / `@hello-ai-company/editor-core` | package **published**; no long-lived automation token |
| D7 | Registry | **CLOSED** — npmjs.org for the public line | **LIVE** |
| D8 | First public version | **CLOSED** — `0.1.0` published once (never reuse `0.0.0-phase3.e17b4b5`) | **PUBLISHED**; do not republish |
| D9 | Repository visibility | **CLOSED** — PUBLIC | **PUBLIC** |
| D10 | Repository / package rename | **CLOSED** — keep `open-editor` + current package name | NO rename |
| D11 | Security contact | **CLOSED** — GitHub PVR enabled; no invented email | **ENABLED** |
| D12 | CODEOWNERS / reviewers | **PREPARED** — `* @yuki-s-code` | file present; GitHub enforcement is a settings step |
| D13 | Branch protection | **CLOSED** — Protect main Ruleset ACTIVE | **ACTIVE** |
| D14 | CI on pull request | **PREPARED** — canonical `ci.yml` + non-publishing `public-release-preflight.yml` (Node 20+22) | active; no real publish |
| D15 | Trusted publishing / provenance | **OWNER-CONFIRMED CONFIGURED** — Environment `public-npmjs` + TP bound to `publish-public-core.yml` | no tokens; production-ready workflow candidate for `0.1.1+` only |
| D16 | `personal-ai` consumer path | **PENDING** — do not edit personal-ai from this repo | NO |
| D17 | Public README / CoC / templates | **PREPARED** for README / CONTRIBUTING / SECURITY; CoC / issue templates still later | root files present |
| D18 | Tags / GitHub Releases | **PUBLISHED** — `v0.1.0` / `OpenEditor v0.1.0` (do not recreate or move) | **YES** |
| D19 | Chain-of-title | **CLOSED** — owner representation, not legal advice | MIT applied on that basis |
| D20 | Business model | **CONFIRMED: FREE + OPTIONAL SPONSORSHIP** | no FUNDING.yml |
| D21 | Paid Cloud / Enterprise / plugin | **CONFIRMED: NO** | NO |
| D22 | Mandatory payment | **CONFIRMED: NO** | NO |
| D23 | Hosted SaaS / open-core redesign | **CONFIRMED: NO** | NO |
| D24 | Sponsor-only exclusive core | **CONFIRMED: NO** | NO |
| D25 | Cost principle | **CONFIRMED: OSS use must not create owner hosting/API costs** | library-only core |
| D26 | GitHub Sponsors / FUNDING.yml | **PENDING** — **SPONSOR LINK — OWNER SETUP REQUIRED** | no FUNDING.yml |

## Public identity (published)

| Field | Current | Published / GitHub setting |
| --- | --- | --- |
| Repository | `hello-ai-company/open-editor` | **PUBLIC** |
| Name | `@hello-ai-company/editor-core` | on npmjs |
| Version | `0.1.0` | **PUBLISHED** (immutable) |
| License | MIT | applied in tree + published |
| Registry | `https://registry.npmjs.org` | **LIVE** |
| Access | public | **LIVE** |
| Maturity | 0.x early: **stable** document model / serialization / `schemaVersion` `1`; **experimental** provider seams | n/a |

**D6 CLOSED.** Package `@hello-ai-company/editor-core@0.1.0` is on the public registry. Do not republish `0.1.0`. Historical Phase 4D probes are obsolete for publication status.

## License analysis (summary)

- **Selected and applied:** MIT with `Copyright (c) 2026 Yuki Shibata`.
- Apache-2.0 remains documented fallback only (not selected).
- Production runtime dependencies: **zero**. Tarball: `package.json`, `LICENSE`, `README.md`, `dist/*`.
- D19 chain-of-title: **CLOSED** as owner representation, not legal advice.

## Distribution (summary)

- Public line: scoped `@hello-ai-company/editor-core@0.1.0` is **published** on npmjs (see bootstrap doc). Do not republish.
- GitHub Packages `0.0.0-phase3.e17b4b5` is **historical and immutable**. Publish-gate tests **require** npmjs public `0.1.0` identity in git (they no longer lock GH Packages).
- Dual-registry is possible for consumers; do not reuse version strings across registries.

## Version strategy (summary)

- First public version is **`0.1.0`** (published). `1.0.0` would over-promise while provider types remain experimental.
- Package version and document `schemaVersion` (`1`) are independent.

## Public API (unchanged)

See [public-api.md](./public-api.md). Phase 4E does **not** alter the freeze besides echoing package version `0.1.0` in the contract JSON.

## Governance (summary)

Present at root: README, MIT LICENSE, CONTRIBUTING (no CLA/DCO), SECURITY, `.github/CODEOWNERS`. Repo is **PUBLIC**; PVR **ENABLED**; Protect main **ACTIVE**. Environment `public-npmjs` **CONFIGURED** (MACHINE-VERIFIED); Trusted Publisher **OWNER-CONFIRMED CONFIGURED**. **No** CoC, issue/PR templates, Dependabot, or `.github/FUNDING.yml`.

## Supply chain (current)

- Non-publishing CI + `npm publish --dry-run` preflight (`contents: read` only).
- Ongoing npmjs: OIDC Trusted Publishing **OWNER-CONFIRMED CONFIGURED**; production-ready `publish-public-core.yml` is the candidate path for `0.1.1+` only.
- Do not create `NPM_TOKEN` / `NODE_AUTH_TOKEN`.

## personal-ai migration (docs only)

See [public-release-runbook.md](./public-release-runbook.md). This repository **must not** edit `hello-ai-company/personal-ai`.

## OSS product direction

Portable document layer. **Small Core + Adapters + Docs + Examples**. No adapter packages. No core API change. **CORE SOURCE CHANGE REQUIRED: NO.**

## Historical snapshot (Phase 4D / 4D.1 — not current identity)

Phase 4D/4D.1 recorded MIT **selection** with **APPLIED NO**, identity `@hello-ai-company/editor-core@0.0.0-phase3.e17b4b5` `UNLICENSED` on GitHub Packages, and “do not start Phase 4E”. That snapshot is **obsolete as current state**. Those documents remain as evidence; if they disagree with **Current (post D1-EXEC)** above, the Current table wins.

Phase 4D.1 did **not** apply MIT, bump to `0.1.0`, or start preparation implementation. Phase 4E did the preparation. D1-EXEC / bootstrap / tag-Release / Environment / Trusted Publisher happened later — prefer the Current table, not historical “did not” wording.

## Next

Remaining: ChatGPT-independent review of the production-ready publish workflow PR, then a **separate** human gate before any `workflow_dispatch` for `0.1.1+`. Never republish `0.1.0`. Never dispatch publish as a test while package version is still `0.1.0`.

**STOP — RETURN TO CHATGPT FOR INDEPENDENT GITHUB REVIEW**
