# Public release decision package (master)

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

**Case:** ENG-20260913-007 Phase 4C / PA-20260916-003  
**Role of this document:** Human decision package for a *possible future* OSS release of `@hello-ai-company/editor-core`.  
**This document does not authorize release.** Completing private gates, recording OSS **intent**, and reading this package do **not** make the repository public, apply a license, publish, tag, or bump a version.

Phase 4C records **OWNER-CONFIRMED** philosophy (free OSS + optional sponsorship). Only those explicitly confirmed rows leave **PENDING**. License **application**, visibility, npmjs, tags, and Releases remain **PENDING**.

## Companion documents

| Document | Purpose |
| --- | --- |
| [owner-oss-policy.md](./owner-oss-policy.md) | OWNER-CONFIRMED mission, free OSS, sponsorship, cost principle |
| [license-recommendation.md](./license-recommendation.md) | PRIMARY MIT / FALLBACK Apache-2.0 — **not applied** |
| [third-party-license-inventory.md](./third-party-license-inventory.md) | Production (none) + dev/CI third-party licenses |
| [distribution-options.md](./distribution-options.md) | Scoped/unscoped naming; GitHub Packages vs npmjs |
| [repository-governance.md](./repository-governance.md) | Public-repo files, CI, branch protection (recommendations only) |
| [public-release-runbook.md](./public-release-runbook.md) | Human-gated private→public steps; do not execute |
| [public-drafts/README.md](./public-drafts/README.md) | Future public README (draft only; optional Support section) |
| [public-drafts/CONTRIBUTING.md](./public-drafts/CONTRIBUTING.md) | Future contributing guide (draft only) |
| [public-drafts/SECURITY.md](./public-drafts/SECURITY.md) | Future security policy (contact **OWNER DECISION REQUIRED**) |
| [license-decision.md](./license-decision.md) | Earlier comparison (still no selection) |
| [public-release-checklist.md](./public-release-checklist.md) | Private gates vs still-unchecked public actions |
| [versioning.md](./versioning.md) | Frozen identity and compatibility policy |
| [public-api.md](./public-api.md) | Frozen public surface |

Root `README.md` retains private warnings. Drafts under `docs/public-drafts/` must **not** replace it until an authorized later phase.

## Canonical start (frozen)

| Field | Value | Changed in Phase 4C |
| --- | --- | --- |
| Repository | `hello-ai-company/open-editor` | NO |
| `origin/main` | `4633bcb57852a73a973475f8fc23b336ccabb6a6` | NO (Phase 4C base; identity unchanged) |
| Package name | `@hello-ai-company/editor-core` | NO |
| Package version | `0.0.0-phase3.e17b4b5` | NO |
| License | `UNLICENSED` (all rights reserved) | NO |
| Registry | `https://npm.pkg.github.com` | NO |
| Access | restricted / PRIVATE | NO |
| Visibility | PRIVATE | NO |
| `personal-ai` (docs only) | consumer baseline `c2bd73f80ddb2752215acc01d78d26322068fcae` | NO — do not edit |

Machine locks: `packages/core/package.json`, `scripts/lib/tarball.mjs` (`AUTHORIZED_*`), `packages/core/test/publish-gate.test.ts`, `.github/workflows/publish-private-core.yml`.

## Decision matrix

Rows marked **CONFIRMED** are philosophy/intent only unless noted. They do **not** apply files or change GitHub/npm settings.

| ID | Topic | Options | Recommendation (non-binding unless CONFIRMED) | Owner Decision |
| --- | --- | --- | --- | --- |
| D1 | Public OSS **intent** | Remain private extraction workspace forever / Public OSS | Public OSS; genuinely useful core | **CONFIRMED: YES** — intent only; **not** execution |
| D1-EXEC | Public **execution** (visibility / npmjs / tag / Release) | Remain private until later gated phase / Execute public actions | Remain private until written execution approval | **PENDING** |
| D2 | License | Remain `UNLICENSED` / MIT / Apache-2.0 / GPL family / BUSL or other source-available | **PRIMARY MIT**, **FALLBACK Apache-2.0**; GPL poor library fit; BUSL ≠ genuine OSS. See [license-recommendation.md](./license-recommendation.md) | **PENDING** — recommendation only; **LICENSE APPLICATION REQUIRED** later |
| D3 | Copyright holder + year | Legal entity name + year range | Name the owning entity in LICENSE/NOTICE | **PENDING** |
| D4 | SPDX / NOTICE / CLA or DCO | SPDX id; NOTICE yes/no; CLA vs DCO vs neither | SPDX + DCO is lighter than CLA for a small library | **PENDING** |
| D5 | Package name | Keep `@hello-ai-company/editor-core` / unscoped `editor-core` / other scope | Keep current scoped name **if** npm org `@hello-ai-company` is owned | **PENDING** |
| D6 | npm org / scope ownership | Confirm `@hello-ai-company` on npmjs / choose another scope | Verify org ownership before any npmjs publish | **PENDING** — **NPM SCOPE OWNERSHIP — OWNER ACTION REQUIRED** |
| D7 | Registry | GitHub Packages only / npmjs.org / dual-publish | npmjs.org for public OSS; keep GH Packages private line until cutover | **PENDING** |
| D8 | First public version | Keep `0.0.0-phase3.e17b4b5` / `0.1.0` / `1.0.0` / other | Do **not** reuse `0.0.0-phase3.e17b4b5`; prefer **`0.1.0`** (0.x early) | **PENDING** |
| D9 | Repository visibility | Remain PRIVATE / make public | Remain PRIVATE until D1-EXEC + license application | **PENDING** |
| D10 | Repository / package rename | Keep `open-editor` + current package name / rename | Not required if D5 keeps the scoped name | **PENDING** |
| D11 | Security contact | Email / GitHub private vulnerability reporting / both / none | Required before public visibility | **PENDING** — **SECURITY CONTACT — OWNER DECISION REQUIRED** |
| D12 | CODEOWNERS / reviewers | Owners list | Required before public contribution | **PENDING** |
| D13 | Branch protection | Current (unknown/internal) / recommended public rules | Require PR + `verify` on `main`; no force-push | **PENDING** |
| D14 | CI on pull request | Keep phase-4a workflow / merge into `ci.yml` | Unify `npm run verify` on every PR to `main` | **PENDING** |
| D15 | Trusted publishing / provenance | Keep `--provenance=false` / npm OIDC + provenance | Enable for npmjs only after D7 | **PENDING** |
| D16 | `personal-ai` consumer path | Stay on GH Packages pin / switch to npmjs / dual period | Pin until public semver exists; do not edit personal-ai from this repo | **PENDING** |
| D17 | Public README / CoC / templates | Keep private banners / apply drafts in `docs/public-drafts/` | Apply drafts only after D1-EXEC | **PENDING** |
| D18 | Tags / GitHub Releases | None / tag after first public version | No tag or Release until D8 is applied | **PENDING** |
| D19 | Provenance / chain-of-title from `personal-ai` extract | Confirm Hello AI Company may relicense this extract | Legal confirmation before OSS terms | **PENDING** — **CHAIN-OF-TITLE — OWNER/LEGAL CONFIRMATION REQUIRED** |
| D20 | Business model | Open-core SaaS / paid tiers / **free core + optional sponsorship** | Free core + optional sponsorship only | **CONFIRMED: FREE + OPTIONAL SPONSORSHIP** |
| D21 | Paid Cloud / Enterprise / feature paywall / commercial plugin (initial launch) | Yes / No | No | **CONFIRMED: NO** |
| D22 | Mandatory payment to install / use / modify / fork / self-host / commercially use | Yes / No | No (subject to eventual license) | **CONFIRMED: NO** |
| D23 | Hosted SaaS / open-core redesign (initial launch) | Yes / No | Do not redesign into open-core SaaS | **CONFIRMED: NO** |
| D24 | Sponsor-only exclusive core functionality | Yes / No | Sponsors get no exclusive core features | **CONFIRMED: NO** |
| D25 | Cost principle | OSS use may / must not create owner hosting/API cost | Must not | **CONFIRMED: OSS use must not create owner hosting/API costs** |
| D26 | GitHub Sponsors / FUNDING.yml | Add now / owner setup later / never | No `FUNDING.yml` without a real URL | **PENDING** — **SPONSOR LINK — OWNER SETUP REQUIRED** |

## Proposed public identity (not applied)

| Field | Current (frozen) | Proposed if public OSS is later authorized | Applied now |
| --- | --- | --- | --- |
| Repository | `hello-ai-company/open-editor` | Same | NO |
| Name | `@hello-ai-company/editor-core` | Same, **if** npm scope is owned (D5/D6) | NO |
| Version | `0.0.0-phase3.e17b4b5` | **`0.1.0`** (0.x early; never reuse the Phase 3 prerelease) | NO |
| License | `UNLICENSED` | SPDX selected in D2 (PRIMARY MIT / FALLBACK Apache-2.0) | NO |
| Registry | `npm.pkg.github.com` | **npmjs.org** for the public line (D7) | NO |
| Access | restricted | public on npmjs if D7 is npmjs | NO |
| Repo visibility | PRIVATE | Per D9 / D1-EXEC | NO |
| Maturity | Private extract | 0.x early: **stable** = document model / serialization / `schemaVersion` `1` / runtime + document types; **experimental** = provider seams | NO |

Rename is **not required** for a public release if the owner keeps the current scope and owns it on the target registry.

**NPM SCOPE OWNERSHIP — OWNER ACTION REQUIRED.** Registry probes in Phase 4C (read-only): `GET https://registry.npmjs.org/@hello-ai-company%2feditor-core` → 404; `GET https://registry.npmjs.org/-/org/hello-ai-company` → org does not exist. GitHub org membership does **not** reserve the npm scope. Do **not** register the org from this phase.

## License analysis (summary)

See [license-recommendation.md](./license-recommendation.md), [license-decision.md](./license-decision.md), and [third-party-license-inventory.md](./third-party-license-inventory.md).

- Current: proprietary denial (`UNLICENSED`). Not public domain. Not OSS.
- **Source-available ≠ open source.** BUSL/SSPL-style terms would still block an “OSS release” claim and conflict with D20–D22.
- Applying any OSS license **would** require changing `LICENSE`, `packages/core/LICENSE`, `package.json` license fields, lockfile metadata, and identity gates (`AUTHORIZED_LICENSE`). That is **LICENSE APPLICATION REQUIRED** — **not done in Phase 4C**.
- Engineering lean: **MIT primary**, **Apache-2.0 fallback**. GPL/AGPL on a library is high friction for embedders. **Not selected. Not applied.**

## Third-party (summary)

- Production runtime dependencies of `@hello-ai-company/editor-core`: **zero**.
- Published tarball: `package.json`, `LICENSE`, `dist/*` only. No `node_modules`.
- `packages/core/src/**`: original extract; intra-package imports only.
- Dev/CI licenses (TypeScript Apache-2.0, Vitest MIT, Actions MIT, plus MIT/ISC/BSD-3/Apache-2.0 transitives) do **not** ship in the tarball.
- **No third-party npm license uncertainty blocker** for the published artifact.
- Remaining legal question is **chain-of-title** from `hello-ai-company/personal-ai` (D19) — owner/legal, not a dependency-scan fail. **CHAIN-OF-TITLE — OWNER/LEGAL CONFIRMATION REQUIRED.** Does not block Phase 4C docs merge; **does** block public release.

## Distribution (summary)

See [distribution-options.md](./distribution-options.md).

- Stay scoped `@hello-ai-company/editor-core` unless the npm org is unavailable.
- GitHub Packages remains the **only** authorized registry today (`publishConfig` + publish-gate tests refuse `registry.npmjs.org`).
- Dual-registry is possible later; versions are per-registry and must not reuse `0.0.0-phase3.e17b4b5` on a new registry/license.

## Version strategy (summary)

See [versioning.md](./versioning.md).

- Package version and document `schemaVersion` (`1`) are independent.
- First public version recommendation: **`0.1.0`** (0.x early maturity). `1.0.0` would over-promise while provider types remain experimental.
- `0.1.0` and `1.0.0` are **forbidden for this frozen private identity** (`publish-gate.test.ts`); they become eligible only after an authorized identity change.

## Public API (unchanged)

See [public-api.md](./public-api.md). Phase 4C does **not** alter the freeze.

- 13 stable runtime exports; 5 stable document types; remaining provider types experimental.
- Entry `"."` only; ESM; Node `>=20`; no runtime dependencies.
- Additive optional provider keys later; removals/signature changes are breaking.

## Governance (summary)

See [repository-governance.md](./repository-governance.md).

Missing vs typical public OSS: `CONTRIBUTING.md`, `SECURITY.md`, Code of Conduct, issue/PR templates, `CODEOWNERS`, Dependabot, documented branch protection, security contact. Drafts exist under `docs/public-drafts/` only. **No GitHub settings were changed.** **No `.github/FUNDING.yml`.**

## Supply chain (current private posture)

- Manual private publish: `workflow_dispatch` only, `--access restricted --provenance=false`.
- Tarball inspect, isolated consumer, security scan, API contract.
- Future npmjs: 2FA, OIDC trusted publishing, `--provenance` — **not configured**.

## personal-ai migration (docs only)

See [public-release-runbook.md](./public-release-runbook.md).

- Consumer already uses the published private package at baseline `c2bd73f80ddb2752215acc01d78d26322068fcae`.
- This repository **must not** edit `hello-ai-company/personal-ai`.
- After a public package exists, options are: keep GH Packages pin, switch to npmjs, or a dual-install window. All **PENDING**.

## What Phase 4C did / did not do

**Did:** record OWNER-CONFIRMED OSS + optional-sponsorship philosophy; add license **recommendation** (not applied); update this matrix so only confirmed philosophy rows leave PENDING; add optional Support wording to the public README **draft**; keep `FUNDING.yml` absent.

**Did not:** publish, tag, Release, apply a license, change visibility, rename, bump version, edit `personal-ai`, modify `packages/core/src/**`, change package identity, alter frozen API, add runtime deps, configure secrets/trusted publishing/Sponsors, invent a sponsor URL, change branch protection, or start Phase 4D / public release.

## Next

Owner/legal: D2 license choice + D19 chain-of-title + D11 security contact + D6 npm scope. **Do not start Phase 4D / public release** from this document.

**STOP — READY FOR OWNER LICENSE / RELEASE-GATE REVIEW**
