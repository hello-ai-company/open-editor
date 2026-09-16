# Release gate closure (Phase 4D / 4D.1)

**INTERNAL EVIDENCE** — not a public product document. Gate classifications. Phase 4E applied MIT; D1-EXEC still pending; repo PRIVATE.

**Case:** ENG-20260913-007 Phase 4D.1 / PA-20260917-001  
**Role:** Canonical public-release **gate classifications**. Phase 4D classified remaining gates honestly. Phase 4D.1 records owner confirmations.  
**This document does not authorize public release.** It does not make the repository public, apply a license, publish, tag, Release, register npm, enable GitHub Private Vulnerability Reporting, or start Phase 4E.

Owner confirmation record: [owner-release-confirmations.md](./owner-release-confirmations.md).

## Purpose

Keep a single canonical table of gate labels. License **application**, visibility, npmjs, tags, and Releases remain unauthorized.

## Canonical identity (frozen)

| Field | Value | Changed in Phase 4D.1 |
| --- | --- | --- |
| Repository | `hello-ai-company/open-editor` | NO |
| `origin/main` | `8d6b66a51219044e2e8a068443f11c7eb132beca` | NO |
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

Phase 4D.1 additionally records OSS product direction: **portable document layer**; **Small Core + Adapters + Docs + Examples**. No adapter packages and no core API change in this phase.

## Gate classification (canonical — Phase 4D.1)

Allowed labels: `CLOSED` | `PREPARED` | `OWNER ACTION REQUIRED` | `OWNER/LEGAL CONFIRMATION REQUIRED` | `PENDING EXECUTION AUTHORIZATION`.

| ID | Topic | Classification | Applied / enabled now |
| --- | --- | --- | --- |
| D2 | License **selection** | **CLOSED** — OWNER-SELECTED FUTURE LICENSE = **MIT**; SELECTED YES / APPLIED NO | **NO** — `LICENSE` files remain `UNLICENSED` |
| D3 | Copyright holder + year | **CLOSED** — `Copyright (c) 2026 Yuki Shibata` | **NO** — **DO NOT write into `LICENSE` yet** |
| D6 | npm org / scope ownership | **CLOSED** — owner controls npm org `hello-ai-company` / scope `@hello-ai-company` / target `@hello-ai-company/editor-core` | **NO** — no npm login / token / publish / register |
| D11 | Security contact | **PREPARED** — GitHub Private Vulnerability Reporting; **ENABLE DURING PUBLIC TRANSITION** | **NO** — not enabled; no invented email |
| D19 | Chain-of-title | **CLOSED** — owner Yuki Shibata confirms relicensing authority under MIT (owner representation, not legal advice) | **NO** — MIT still not applied |
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

## D3 — Copyright holder (CLOSED; not in LICENSE)

Owner-confirmed line (Phase 4D.1):

```
Copyright (c) 2026 Yuki Shibata
```

**DO NOT write this into `LICENSE` or `packages/core/LICENSE` yet.** Application is `LICENSE APPLICATION REQUIRED` in a later authorized phase.

## D6 — npm scope (CLOSED by owner confirmation)

Owner confirms control of npm org `hello-ai-company`, scope `@hello-ai-company`, target package `@hello-ai-company/editor-core`.

Phase 4D read-only probes (2026-09-16; no `npm login` / no register / no publish) remain historical:

| Probe | Result (2026-09-16) |
| --- | --- |
| `GET https://registry.npmjs.org/@hello-ai-company%2feditor-core` | 404 Not found |
| `GET https://registry.npmjs.org/-/org/hello-ai-company` | 404 org does not exist |
| `GET https://registry.npmjs.org/-/org/hello-ai-company/package` | 404 Scope not found |
| `npm whoami --registry=https://registry.npmjs.org` | `ENEEDAUTH` (not logged in; expected) |

GitHub org membership does **not** reserve the npm scope. Phase 4D.1 did **not** login, register, publish, or use an npm token. Fallback names stay documented only in [npm-publication-readiness.md](./npm-publication-readiness.md) and are **not selected**.

## D11 — Security contact (PREPARED)

Preferred method (record only): **GitHub Private Vulnerability Reporting**.

Honest current state:

- No root `SECURITY.md`
- No in-repo `security@…` address (none invented)
- GitHub Private Vulnerability Reporting **not enabled**
- Draft only: [public-drafts/SECURITY.md](./public-drafts/SECURITY.md)

Settings were **not** changed. Email was **not** invented.

**PREPARED — ENABLE DURING PUBLIC TRANSITION.** Not a remaining confirmation blocker. Do not enable in this phase.

See [security-release-gate.md](./security-release-gate.md).

## D19 — Chain-of-title (CLOSED; owner representation)

Engineering evidence supports an **internal extract** with fresh git history and documented source paths.

Owner Yuki Shibata confirms relicensing authority under MIT. That confirmation is **owner representation, not legal advice**.

MIT is still **not applied**. See [chain-of-title-evidence.md](./chain-of-title-evidence.md).

## D1-EXEC — Public execution

Written authorization to change visibility, publish to npmjs, tag, or create a GitHub Release is **absent**.

**PENDING EXECUTION AUTHORIZATION.**

This phase is **not** public-release approval. Do not execute public release from this document. Do not start Phase 4E.

## License application (later phase; not this phase)

After written D1-EXEC (when execution is actually wanted):

1. Replace root `LICENSE` and `packages/core/LICENSE` with MIT **including** `Copyright (c) 2026 Yuki Shibata`.
2. Change `"license"` fields and lockfile metadata.
3. Update `AUTHORIZED_LICENSE` and identity tests.
4. Then — and only then — consider visibility. **Do not make the repository public while `UNLICENSED`.**

## What Phase 4D / 4D.1 did / did not do

**Phase 4D did:** documentation and policy records; record MIT as OWNER-SELECTED FUTURE LICENSE; re-probe npm read-only; classify D3/D6/D11/D19 honestly as then-open.

**Phase 4D.1 did:** record owner confirmations; close D2/D3/D6/D19 as confirmation gates; mark D11 PREPARED; leave D1-EXEC pending; record OSS product direction; classify READY FOR PUBLIC RELEASE PREPARATION / not READY TO PUBLISH NOW.

**Neither phase did:** publish; tag; Release; apply MIT; write the copyright line into `LICENSE`; change license metadata; bump version; change `publishConfig`; register npm; make public; configure Sponsors / `FUNDING.yml` / security settings / branch protection / trusted publishing / secrets; enable Private Vulnerability Reporting; edit `personal-ai`; modify `packages/core/src/**`; modify `packages/core/package.json` / root `package.json` / `package-lock.json` / `LICENSE` / `packages/core/LICENSE` / `.github/workflows/**`; start Phase 4E.

## Companion documents

| Document | Purpose |
| --- | --- |
| [owner-release-confirmations.md](./owner-release-confirmations.md) | Phase 4D.1 owner confirmation record |
| [chain-of-title-evidence.md](./chain-of-title-evidence.md) | Provenance audit + owner D19 confirmation |
| [npm-publication-readiness.md](./npm-publication-readiness.md) | npm scope; D6 CLOSED by owner; no mutations |
| [security-release-gate.md](./security-release-gate.md) | D11 PREPARED; prefer GitHub PVR; not enabled |
| [public-release-change-map.md](./public-release-change-map.md) | Future prep files; **CORE SOURCE CHANGE REQUIRED: NO** |
| [public-release-runbook.md](./public-release-runbook.md) | Safe future order; do not execute |
| [public-release-decision.md](./public-release-decision.md) | Master decision matrix |

## Remaining before publish (not confirmation blockers)

Public-release **preparation** (license application, identity/registry edits, enable PVR, root `SECURITY.md`) must not **execute** until written D1-EXEC. Confirmation gates D3/D6/D19 are closed; D11 is prepared for enablement during that transition.

D1-EXEC remains a separate later authorization. MIT must be applied **before** making the repository public.

## Classification

**READY FOR PUBLIC RELEASE PREPARATION** — **not READY TO PUBLISH NOW**.

## Next

**STOP — READY FOR CHATGPT REVIEW BEFORE PHASE 4E**

Do not start Phase 4E. Do not execute public release. Do not publish.
