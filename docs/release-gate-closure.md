# Release gate closure (Phase 4D)

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

**Case:** ENG-20260913-007 Phase 4D / PA-20260916-004  
**Role:** Close or honestly classify remaining public-release gates.  
**This document does not authorize public release.** It does not make the repository public, apply a license, publish, tag, Release, register npm, or start Phase 4E.

## Purpose

Record owner-selected future license **MIT** without applying `LICENSE` files. Classify D3 / D6 / D11 / D19 honestly. Keep package identity unchanged. Leave public execution (D1-EXEC) unauthorized.

## Canonical identity (frozen)

| Field | Value | Changed in Phase 4D |
| --- | --- | --- |
| Repository | `hello-ai-company/open-editor` | NO |
| `origin/main` | `1f8466ebc3191e05bfb5ac72799a406d840ae5a9` | NO |
| Package | `@hello-ai-company/editor-core@0.0.0-phase3.e17b4b5` | NO |
| License metadata | `UNLICENSED` | NO |
| Registry | `https://npm.pkg.github.com` | NO |
| Access | restricted | NO |
| Visibility | PRIVATE | NO |
| `personal-ai` | docs-only consumer baseline `c2bd73f80ddb2752215acc01d78d26322068fcae` | NO — do not edit |

Machine locks unchanged: `packages/core/package.json`, `scripts/lib/tarball.mjs` (`AUTHORIZED_*` including `AUTHORIZED_LICENSE = "UNLICENSED"`), `packages/core/test/publish-gate.test.ts`, `.github/workflows/**`.

## Owner-confirmed philosophy (unchanged)

Already recorded in Phase 4C ([owner-oss-policy.md](./owner-oss-policy.md)):

- Public OSS **intent** YES (not execution)
- Public OSS + optional sponsorship
- Mandatory payment NO
- Paid tiers / Cloud / Enterprise / commercial plugin at initial launch NO
- Hosted SaaS / open-core redesign at initial launch NO
- Sponsor-only exclusive core functionality NO
- OSS use must not create owner hosting/API costs

## Gate classification

Allowed labels: `CLOSED` | `OWNER ACTION REQUIRED` | `OWNER/LEGAL CONFIRMATION REQUIRED` | `PENDING EXECUTION AUTHORIZATION`.

| ID | Topic | Classification | Applied / enabled now |
| --- | --- | --- | --- |
| D2 | License **selection** | **CLOSED** — OWNER-SELECTED FUTURE LICENSE = **MIT** | **NO** — `LICENSE` files remain `UNLICENSED` |
| D3 | Copyright holder + year | **OWNER ACTION REQUIRED** — **COPYRIGHT HOLDER — OWNER ACTION REQUIRED** | NO — placeholder form only; not written into `LICENSE` |
| D6 | npm org / scope ownership | **OWNER ACTION REQUIRED** — **NPM SCOPE OWNERSHIP — OWNER ACTION REQUIRED** | NO — not registered |
| D11 | Security contact | **OWNER ACTION REQUIRED** — preferred future method GitHub Private Vulnerability Reporting; **not enabled** | NO — no invented email; settings unchanged |
| D19 | Chain-of-title | **OWNER/LEGAL CONFIRMATION REQUIRED** — **CHAIN-OF-TITLE — OWNER/LEGAL CONFIRMATION REQUIRED** | NO |
| D1-EXEC | Public execution (visibility / npmjs / tag / Release) | **PENDING EXECUTION AUTHORIZATION** | NO |

D2 is closed for **selection only**. License **application** is a later authorized phase (`LICENSE APPLICATION REQUIRED`).

## D2 — License (OWNER-SELECTED MIT; applied NO)

| Field | Value |
| --- | --- |
| SELECTED | **YES** — MIT |
| APPLIED TO LICENSE FILES | **NO** |
| Root `LICENSE` | still proprietary `UNLICENSED` |
| `packages/core/LICENSE` | still proprietary `UNLICENSED` (ships in tarball) |
| `"license"` in package.json files | still `UNLICENSED` |
| `AUTHORIZED_LICENSE` | still `UNLICENSED` |
| Fallback recommendation | Apache-2.0 remains documented; **not selected** |

See [license-recommendation.md](./license-recommendation.md). Do **not** apply MIT in this phase.

## D3 — Copyright holder

No authoritative legal-entity name exists in this repository, GitHub org profile (`name`/`email`/`company` are empty; org is not verified), or `LICENSE` files.

GitHub org slug `hello-ai-company` and informal “Hello AI Company” in docs are **branding**, not a registered legal name with jurisdiction.

**COPYRIGHT HOLDER — OWNER ACTION REQUIRED.**

Placeholder form only (do **not** paste into `LICENSE` until D3 is filled by the owner):

```
Copyright (c) 2026 <LEGAL ENTITY NAME — OWNER ACTION REQUIRED>
```

Year `2026` is the engineering year of this repository (`createdAt` 2026-09-13). Owner/legal must confirm the legal name and year range before any MIT application.

## D6 — npm scope

Read-only registry probes (2026-09-16; no `npm login` / no register / no publish):

| Probe | Result |
| --- | --- |
| `GET https://registry.npmjs.org/@hello-ai-company%2feditor-core` | 404 Not found |
| `GET https://registry.npmjs.org/-/org/hello-ai-company` | 404 org does not exist |
| `GET https://registry.npmjs.org/-/org/hello-ai-company/package` | 404 Scope not found |
| `npm whoami --registry=https://registry.npmjs.org` | `ENEEDAUTH` (not logged in; expected) |

GitHub org membership does **not** reserve the npm scope `@hello-ai-company`.

**NPM SCOPE OWNERSHIP — OWNER ACTION REQUIRED.** Fallback names are documented only in [npm-publication-readiness.md](./npm-publication-readiness.md). Do not register from this phase.

## D11 — Security contact

Preferred future method (record only): **GitHub Private Vulnerability Reporting**.

Honest current state:

- No root `SECURITY.md`
- No in-repo `security@…` address (none invented)
- GitHub `isSecurityPolicyEnabled`: false
- Private vulnerability reporting API: not found / not enabled
- `security_and_analysis`: null
- Draft only: [public-drafts/SECURITY.md](./public-drafts/SECURITY.md)

Settings were **not** changed. Email was **not** invented.

**OWNER ACTION REQUIRED:** owner must enable GitHub Private Vulnerability Reporting (and optionally supply a real contact later) **before** public visibility. Until then D11 is not closed.

See [security-release-gate.md](./security-release-gate.md).

## D19 — Chain-of-title

Engineering evidence supports an **internal extract** with fresh git history and documented source paths. It does **not** prove legal authority to relicense.

**CHAIN-OF-TITLE — OWNER/LEGAL CONFIRMATION REQUIRED.**

Owner checklist in [chain-of-title-evidence.md](./chain-of-title-evidence.md) remains **unchecked**.

## D1-EXEC — Public execution

Written authorization to change visibility, publish to npmjs, tag, or create a GitHub Release is **absent**.

**PENDING EXECUTION AUTHORIZATION.**

Do not execute public release from this document. Do not start Phase 4E.

## License application (later phase; not this phase)

After D3 + D19 (and D1-EXEC when execution is actually wanted):

1. Replace root `LICENSE` and `packages/core/LICENSE` with MIT **including** the owner-supplied copyright line.
2. Change `"license"` fields and lockfile metadata.
3. Update `AUTHORIZED_LICENSE` and identity tests.
4. Then — and only then — consider visibility. **Do not make the repository public while `UNLICENSED`.**

## What Phase 4D did / did not do

**Did:** documentation and policy records only (this file and companions). Record MIT as OWNER-SELECTED FUTURE LICENSE. Re-probe npm read-only. Classify D3/D6/D11/D19 honestly.

**Did not:** publish; tag; Release; apply MIT; change license metadata; bump version; change `publishConfig`; register npm; make public; configure Sponsors / `FUNDING.yml` / security settings / branch protection / trusted publishing / secrets; edit `personal-ai`; modify `packages/core/src/**`; modify `packages/core/package.json` / root `package.json` / `package-lock.json` / `LICENSE` / `packages/core/LICENSE` / `.github/workflows/**`; start Phase 4E.

## Companion documents

| Document | Purpose |
| --- | --- |
| [chain-of-title-evidence.md](./chain-of-title-evidence.md) | Provenance audit + unchecked owner/legal checklist |
| [npm-publication-readiness.md](./npm-publication-readiness.md) | Read-only npm scope audit + fallback names (document only) |
| [security-release-gate.md](./security-release-gate.md) | Security contact gate; prefer GitHub PVR |
| [public-release-change-map.md](./public-release-change-map.md) | Future prep files; **CORE SOURCE CHANGE REQUIRED: NO** |
| [public-release-runbook.md](./public-release-runbook.md) | Safe future order; do not execute |
| [public-release-decision.md](./public-release-decision.md) | Master decision matrix |

## Remaining owner actions before public-release preparation

Public-release **preparation** (license application, identity/registry edits, root `SECURITY.md`) must not start until:

1. D3 copyright holder legal name + year — **OWNER ACTION REQUIRED**
2. D6 npm scope ownership or an owner-chosen fallback name — **OWNER ACTION REQUIRED**
3. D11 GitHub Private Vulnerability Reporting enabled by the owner (or a real contact supplied) — **OWNER ACTION REQUIRED**
4. D19 chain-of-title — **OWNER/LEGAL CONFIRMATION REQUIRED**

D1-EXEC remains a separate later authorization after those gates and after MIT is applied.

## Next

**STOP — OWNER ACTION REQUIRED BEFORE PUBLIC RELEASE PREPARATION**

Do not start Phase 4E. Do not execute public release.
