# Owner release confirmations (Phase 4D.1)

**INTERNAL EVIDENCE** — not a public product document. Phase 4D.1 confirmation record. Phase 4E applied the recorded MIT line; D1-EXEC still pending.

**Case:** ENG-20260913-007 Phase 4D.1 / PA-20260917-001  
**Role:** Record owner final **pre-release confirmations**. Docs/evidence only.  
**This document does not authorize public release.** It does not make the repository public, apply a license, publish, tag, Release, register npm, enable GitHub Private Vulnerability Reporting, or start Phase 4E.

Canonical companion: [release-gate-closure.md](./release-gate-closure.md). Master matrix: [public-release-decision.md](./public-release-decision.md).

## Purpose

Record owner-confirmed answers that Phase 4D left as owner/legal/ops actions. Do **not** apply those answers to `LICENSE` files, npm, or GitHub settings in this phase. Do **not** start public-release preparation implementation (Phase 4E).

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

Machine locks unchanged: `packages/core/package.json`, `scripts/lib/tarball.mjs` (`AUTHORIZED_*` including `AUTHORIZED_LICENSE = "UNLICENSED"`), `packages/core/test/publish-gate.test.ts`, `.github/workflows/**`, root `LICENSE`, `packages/core/LICENSE`.

## Confirmation source

| Field | Value |
| --- | --- |
| Confirming owner | Yuki Shibata |
| Recorded in | this file (Phase 4D.1) |
| Legal advice | **No.** Owner representation only. Not counsel opinion. |
| Applied to product files / npm / GitHub settings | **NO** |

## Canonical gate state (Phase 4D.1)

Allowed labels: `CLOSED` | `PREPARED` | `OWNER ACTION REQUIRED` | `OWNER/LEGAL CONFIRMATION REQUIRED` | `PENDING EXECUTION AUTHORIZATION`.

| ID | Topic | Classification | Applied / enabled now |
| --- | --- | --- | --- |
| D2 | License **selection** | **CLOSED** — OWNER-SELECTED FUTURE LICENSE = **MIT**; SELECTED YES / APPLIED NO | **NO** — `LICENSE` files remain `UNLICENSED` |
| D3 | Copyright holder + year | **CLOSED** — recorded line `Copyright (c) 2026 Yuki Shibata` | **NO** — **DO NOT write into `LICENSE` yet** |
| D6 | npm org / scope ownership | **CLOSED** — owner controls npm org `hello-ai-company` / scope `@hello-ai-company` / target `@hello-ai-company/editor-core` | **NO** — no npm login / token / publish / register |
| D11 | Security contact | **PREPARED** — GitHub Private Vulnerability Reporting; **ENABLE DURING PUBLIC TRANSITION** | **NO** — not enabled; no invented email |
| D19 | Chain-of-title / relicensing | **CLOSED** — owner Yuki Shibata confirms relicensing authority under MIT | **NO** — owner representation, not legal advice; MIT still not applied |
| D1-EXEC | Public execution (visibility / npmjs / tag / Release) | **PENDING EXECUTION AUTHORIZATION** | **NO** — this phase ≠ public-release approval |

## D2 — License (CLOSED; selected MIT; applied NO)

| Field | Value |
| --- | --- |
| SELECTED | **YES** — MIT |
| APPLIED TO LICENSE FILES | **NO** |
| Root `LICENSE` | still proprietary `UNLICENSED` |
| `packages/core/LICENSE` | still proprietary `UNLICENSED` (ships in tarball) |
| `"license"` in package.json files | still `UNLICENSED` |
| `AUTHORIZED_LICENSE` | still `UNLICENSED` |
| Fallback recommendation | Apache-2.0 remains documented; **not selected** |

See [license-recommendation.md](./license-recommendation.md). **MIT SELECTED not APPLIED.** Do **not** apply MIT in this phase.

## D3 — Copyright holder (CLOSED; not written into LICENSE)

Owner-confirmed copyright line for a **later** MIT application:

```
Copyright (c) 2026 Yuki Shibata
```

| Field | Value |
| --- | --- |
| Holder | Yuki Shibata |
| Year | 2026 |
| Written into root `LICENSE` | **NO** |
| Written into `packages/core/LICENSE` | **NO** |
| Written into NOTICE / SPDX headers | **NO** |

**DO NOT write this line into `LICENSE` in Phase 4D.1.** Application remains a later authorized identity-change phase (`LICENSE APPLICATION REQUIRED`).

## D6 — npm org / scope (CLOSED by owner confirmation; no mutations)

Owner confirms control of:

| Item | Confirmed value |
| --- | --- |
| npm org | `hello-ai-company` |
| Scope | `@hello-ai-company` |
| Target package | `@hello-ai-company/editor-core` |

This phase performed **no** npm mutations:

- no `npm login`
- no npm token create/use
- no `npm publish`
- no org/scope **register**
- no `publishConfig` change

Phase 4D read-only probes (2026-09-16) remain historical snapshots only (`GET` 404 for the package and org; `npm whoami` `ENEEDAUTH`). They do **not** reopen D6. Owner confirmation is the closing evidence. Fallback names in [npm-publication-readiness.md](./npm-publication-readiness.md) stay **not selected**.

Creating or claiming the org on npmjs, if still operationally required at publish time, is a later public-transition step — **not** this phase.

## D11 — Security contact (PREPARED; enable during public transition)

| Field | Value |
| --- | --- |
| Preferred method | GitHub **Private Vulnerability Reporting** |
| Email | **None invented** |
| Enabled now | **NO** |
| GitHub settings changed | **NO** |
| Root `SECURITY.md` | still absent (draft only) |
| When to enable | **DURING PUBLIC TRANSITION** (not this phase) |

D11 is **PREPARED**, not CLOSED and not OWNER ACTION REQUIRED as a confirmation gate. Enablement is an execution step of public transition, after written D1-EXEC, not a remaining confirmation blocker.

See [security-release-gate.md](./security-release-gate.md).

## D19 — Relicensing / chain-of-title (CLOSED; owner representation)

Owner Yuki Shibata confirms authority to relicense the `personal-ai` `editorCore` extract listed in [extraction-status.md](./extraction-status.md) under **MIT**.

| Field | Value |
| --- | --- |
| Confirming person | Yuki Shibata |
| Authority claimed | relicensing this extract as MIT |
| Kind of confirmation | **Owner representation** |
| Legal advice / counsel memo | **Not obtained / not claimed** |
| MIT applied | **NO** |

Engineering provenance in [chain-of-title-evidence.md](./chain-of-title-evidence.md) is unchanged. D19 is closed as an **owner confirmation gate**, not as a law-firm opinion.

## D1-EXEC — Public execution (PENDING)

Written authorization to change visibility, publish to npmjs, tag, or create a GitHub Release is **absent**.

**PENDING EXECUTION AUTHORIZATION.**

Phase 4D.1 records confirmations. It is **not** public-release approval. It is **not** Phase 4E.

## OSS product direction (record only)

Owner-confirmed public-product shape for a later authorized OSS launch:

| Layer | Meaning | This phase |
| --- | --- | --- |
| **Portable document layer** | Host-neutral document model + JSON serialization + optional provider **types** | already the frozen core |
| **Small Core** | `@hello-ai-company/editor-core` stays small | **no core API change** |
| **Adapters** | Host integrations (for example a future BlockNote adapter) live **outside** core | **no adapter packages created** |
| **Docs** | Architecture, public API, examples documentation | docs/evidence only here |
| **Examples** | Later consumer examples | **not added** |

Do **not** redesign into open-core SaaS. Do **not** add BlockNote / React / host adapters in this repository in this phase. **CORE SOURCE CHANGE REQUIRED: NO.** Frozen public API in [public-api.md](./public-api.md) is unchanged.

## Classification

| Question | Answer |
| --- | --- |
| New confirmation blockers | **None** |
| READY FOR PUBLIC RELEASE **PREPARATION** | **YES** (after ChatGPT review; Phase 4E is a later authorized phase) |
| READY TO PUBLISH **NOW** | **NO** |
| READY TO APPLY MIT **NOW** | **NO** |
| READY TO MAKE REPOSITORY PUBLIC **NOW** | **NO** |
| READY TO ENABLE GitHub PVR **NOW** | **NO** — enable during public transition |
| D1-EXEC | **PENDING EXECUTION AUTHORIZATION** |

**Do not make the repository public while `UNLICENSED`.**

## Remaining after this confirmation (not Phase 4D.1 work)

These remain for a later authorized **preparation / execution** phase. They are not owner-confirmation blockers:

- D2 **application** of MIT (`LICENSE APPLICATION REQUIRED`) using the D3 line above
- D11 enable GitHub Private Vulnerability Reporting during public transition
- D1-EXEC written execution authorization
- D4 SPDX / NOTICE / CLA or DCO
- D5/D7/D8/D9/D10/D12–D18/D26 as in [public-release-decision.md](./public-release-decision.md)

## What Phase 4D.1 did / did not do

**Did:** create this confirmation record; update gate docs to D2/D3/D6/D19 **CLOSED**, D11 **PREPARED**, D1-EXEC **PENDING**; record OSS product direction (portable document layer; Small Core + Adapters + Docs + Examples); classify **READY FOR PUBLIC RELEASE PREPARATION** / **not READY TO PUBLISH NOW**.

**Did not:** publish; tag; Release; apply MIT; write the copyright line into `LICENSE`; change license metadata; bump version; change `publishConfig`; register npm; `npm login` / token / publish; make public; configure Sponsors / `FUNDING.yml` / security settings / branch protection / trusted publishing / secrets; enable Private Vulnerability Reporting; edit `personal-ai`; modify `packages/core/src/**`; modify `packages/core/package.json` / root `package.json` / `package-lock.json` / `LICENSE` / `packages/core/LICENSE` / `.github/workflows/**`; create adapter packages; start Phase 4E.

## Next

**STOP — READY FOR CHATGPT REVIEW BEFORE PHASE 4E**

Do not start Phase 4E. Do not publish. Do not apply MIT. Do not enable PVR. Do not merge as a public release.
