# Public release decision package (master)

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

**Case:** ENG-20260913-007 Phase 4B / PA-20260916-002  
**Role of this document:** Human decision package for a *possible future* OSS release of `@hello-ai-company/editor-core`.  
**This document does not authorize release.** Completing Phase 4A private gates and reading this package do **not** make the repository public, apply a license, publish, tag, or bump a version.

Every row in the Owner Decision column is **PENDING**. No option is selected.

## Companion documents

| Document | Purpose |
| --- | --- |
| [third-party-license-inventory.md](./third-party-license-inventory.md) | Production (none) + dev/CI third-party licenses |
| [distribution-options.md](./distribution-options.md) | Scoped/unscoped naming; GitHub Packages vs npmjs |
| [repository-governance.md](./repository-governance.md) | Public-repo files, CI, branch protection (recommendations only) |
| [public-release-runbook.md](./public-release-runbook.md) | Human-gated private→public steps; do not execute |
| [public-drafts/README.md](./public-drafts/README.md) | Future public README (draft only) |
| [public-drafts/CONTRIBUTING.md](./public-drafts/CONTRIBUTING.md) | Future contributing guide (draft only) |
| [public-drafts/SECURITY.md](./public-drafts/SECURITY.md) | Future security policy (contact **OWNER DECISION REQUIRED**) |
| [license-decision.md](./license-decision.md) | Earlier comparison (still no selection) |
| [public-release-checklist.md](./public-release-checklist.md) | Private gates vs still-unchecked public actions |
| [versioning.md](./versioning.md) | Frozen identity and compatibility policy |
| [public-api.md](./public-api.md) | Frozen public surface |

Root `README.md` retains private warnings. Drafts under `docs/public-drafts/` must **not** replace it until an authorized later phase.

## Canonical start (frozen)

| Field | Value | Changed in Phase 4B |
| --- | --- | --- |
| Repository | `hello-ai-company/open-editor` | NO |
| `origin/main` | `c87bf79b7454079bb31b31e283c53747aca43c08` | NO |
| Package name | `@hello-ai-company/editor-core` | NO |
| Package version | `0.0.0-phase3.e17b4b5` | NO |
| License | `UNLICENSED` (all rights reserved) | NO |
| Registry | `https://npm.pkg.github.com` | NO |
| Access | restricted / PRIVATE | NO |
| Visibility | PRIVATE | NO |
| `personal-ai` (docs only) | consumer baseline `c2bd73f80ddb2752215acc01d78d26322068fcae` | NO — do not edit |

Machine locks: `packages/core/package.json`, `scripts/lib/tarball.mjs` (`AUTHORIZED_*`), `packages/core/test/publish-gate.test.ts`, `.github/workflows/publish-private-core.yml`.

## Decision matrix (all PENDING)

| ID | Topic | Options (none selected) | Recommendation (non-binding) | Owner Decision |
| --- | --- | --- | --- | --- |
| D1 | Public authorization | Remain private extraction workspace / Authorize a later public phase | Remain private until written approval | **PENDING** |
| D2 | License | Remain `UNLICENSED` / MIT / Apache-2.0 / GPL family / BUSL or other source-available | Permissive (MIT or Apache-2.0) if OSS is chosen; source-available ≠ OSS | **PENDING** |
| D3 | Copyright holder + year | Legal entity name + year range | Name the owning entity in LICENSE/NOTICE | **PENDING** |
| D4 | SPDX / NOTICE / CLA or DCO | SPDX id; NOTICE yes/no; CLA vs DCO vs neither | SPDX + DCO is lighter than CLA for a small library | **PENDING** |
| D5 | Package name | Keep `@hello-ai-company/editor-core` / unscoped `editor-core` / other scope | Keep current scoped name if npm org `@hello-ai-company` is owned | **PENDING** |
| D6 | npm org / scope ownership | Confirm `@hello-ai-company` on npmjs / choose another scope | Verify org ownership before any npmjs publish | **PENDING** |
| D7 | Registry | GitHub Packages only / npmjs.org / dual-publish | npmjs.org for public OSS; keep GH Packages private line until cutover | **PENDING** |
| D8 | First public version | Keep `0.0.0-phase3.e17b4b5` / `0.1.0` / `1.0.0` / other | Do **not** reuse `0.0.0-phase3.e17b4b5`; prefer `0.1.0` or `1.0.0` | **PENDING** |
| D9 | Repository visibility | Remain PRIVATE / make public | Remain PRIVATE until D1–D8 are decided | **PENDING** |
| D10 | Repository / package rename | Keep `open-editor` + current package name / rename | Not required if D5 keeps the scoped name | **PENDING** |
| D11 | Security contact | Email / GitHub private vulnerability reporting / both / none | Required before public visibility | **PENDING** — **SECURITY CONTACT — OWNER DECISION REQUIRED** |
| D12 | CODEOWNERS / reviewers | Owners list | Required before public contribution | **PENDING** |
| D13 | Branch protection | Current (unknown/internal) / recommended public rules | Require PR + `verify` on `main`; no force-push | **PENDING** |
| D14 | CI on pull request | Keep phase-4a workflow / merge into `ci.yml` | Unify `npm run verify` on every PR to `main` | **PENDING** |
| D15 | Trusted publishing / provenance | Keep `--provenance=false` / npm OIDC + provenance | Enable for npmjs only after D7 | **PENDING** |
| D16 | `personal-ai` consumer path | Stay on GH Packages pin / switch to npmjs / dual period | Pin until public semver exists; do not edit personal-ai from this repo | **PENDING** |
| D17 | Public README / CoC / templates | Keep private banners / apply drafts in `docs/public-drafts/` | Apply drafts only after D1 | **PENDING** |
| D18 | Tags / GitHub Releases | None / tag after first public version | No tag or Release until D8 is applied | **PENDING** |
| D19 | Provenance / chain-of-title from `personal-ai` extract | Confirm Hello AI Company may relicense this extract | Legal confirmation before OSS terms | **PENDING** |

## Proposed public identity (not applied)

| Field | Current (frozen) | Proposed if public OSS is later authorized | Applied now |
| --- | --- | --- | --- |
| Name | `@hello-ai-company/editor-core` | Same, **if** npm scope is owned (D5/D6) | NO |
| Version | `0.0.0-phase3.e17b4b5` | New public version (D8); never reuse the Phase 3 prerelease | NO |
| License | `UNLICENSED` | SPDX selected in D2 | NO |
| Registry | `npm.pkg.github.com` | Per D7 | NO |
| Access | restricted | public on npmjs if D7 is npmjs | NO |
| Repo visibility | PRIVATE | Per D9 | NO |

Rename is **not required** for a public release if the owner keeps the current scope and owns it on the target registry.

## License analysis (summary)

See [license-decision.md](./license-decision.md) and [third-party-license-inventory.md](./third-party-license-inventory.md).

- Current: proprietary denial (`UNLICENSED`). Not public domain. Not OSS.
- **Source-available ≠ open source.** BUSL/SSPL-style terms would still block an “OSS release” claim.
- Applying any OSS license **would** require changing `LICENSE`, `packages/core/LICENSE`, `package.json` license fields, lockfile metadata, and identity gates (`AUTHORIZED_LICENSE`). That is **LICENSE APPLICATION REQUIRED** — **not done in Phase 4B**.
- GPL/AGPL on a library is high viral risk for embedders. Permissive licenses are the usual library default. **Not selected.**

## Third-party (summary)

- Production runtime dependencies of `@hello-ai-company/editor-core`: **zero**.
- Published tarball: `package.json`, `LICENSE`, `dist/*` only. No `node_modules`.
- `packages/core/src/**`: original extract; intra-package imports only.
- Dev/CI licenses (TypeScript Apache-2.0, Vitest MIT, Actions MIT, plus MIT/ISC/BSD-3/Apache-2.0 transitives) do **not** ship in the tarball.
- **No third-party npm license uncertainty blocker** for the published artifact.
- Remaining legal question is **chain-of-title** from `hello-ai-company/personal-ai` (D19) — owner/legal, not a dependency-scan fail.

## Distribution (summary)

See [distribution-options.md](./distribution-options.md).

- Stay scoped `@hello-ai-company/editor-core` unless the npm org is unavailable.
- GitHub Packages remains the **only** authorized registry today (`publishConfig` + publish-gate tests refuse `registry.npmjs.org`).
- Dual-registry is possible later; versions are per-registry and must not reuse `0.0.0-phase3.e17b4b5` on a new registry/license.

## Version strategy (summary)

See [versioning.md](./versioning.md).

- Package version and document `schemaVersion` (`1`) are independent.
- First public version should be a **new** identifier (`0.1.0` or `1.0.0` are the compared options).
- `0.1.0` and `1.0.0` are **forbidden for this frozen private identity** (`publish-gate.test.ts`); they become eligible only after an authorized identity change.

## Public API (unchanged)

See [public-api.md](./public-api.md). Phase 4B does **not** alter the freeze.

- 13 stable runtime exports; 5 stable document types; remaining provider types experimental.
- Entry `"."` only; ESM; Node `>=20`; no runtime dependencies.
- Additive optional provider keys later; removals/signature changes are breaking.

## Governance (summary)

See [repository-governance.md](./repository-governance.md).

Missing vs typical public OSS: `CONTRIBUTING.md`, `SECURITY.md`, Code of Conduct, issue/PR templates, `CODEOWNERS`, Dependabot, documented branch protection, security contact. Drafts exist under `docs/public-drafts/` only. **No GitHub settings were changed.**

## Supply chain (current private posture)

- Manual private publish: `workflow_dispatch` only, `--access restricted --provenance=false`.
- Tarball inspect, isolated consumer, security scan, API contract.
- Future npmjs: 2FA, OIDC trusted publishing, `--provenance` — **not configured**.

## personal-ai migration (docs only)

See [public-release-runbook.md](./public-release-runbook.md).

- Consumer already uses the published private package at baseline `c2bd73f80ddb2752215acc01d78d26322068fcae`.
- This repository **must not** edit `hello-ai-company/personal-ai`.
- After a public package exists, options are: keep GH Packages pin, switch to npmjs, or a dual-install window. All **PENDING**.

## What Phase 4B did / did not do

**Did:** add this decision package and public documentation drafts under `docs/` (and `docs/public-drafts/`).

**Did not:** publish, tag, Release, apply a license, change visibility, rename, bump version, edit `personal-ai`, modify `packages/core/src/**`, change package identity, alter frozen API, add runtime deps, configure secrets/trusted publishing, or change branch protection.

## Next

Owner review of this package. **Do not start Phase 4C** from this document.

**STOP — READY FOR OWNER RELEASE DECISION REVIEW**
