# Public release runbook

**INTERNAL EVIDENCE** — not a public product document.

**Case:** ENG-20260913-007 Phase 4E R1 / PA-20260917-002 / post-D1-EXEC / TP production-ready  
Historical human-gated release plan. Core `0.1.0`/`0.1.1` and BlockNote `0.1.0` are currently published; proposed BlockNote source changes and the new packages in this PR remain unreleased. Do not publish, tag, create a Release, or dispatch a workflow as part of this task.

Companion: [public-release-decision.md](./public-release-decision.md), [first-public-publish-bootstrap.md](./first-public-publish-bootstrap.md).

## Current (post D1-EXEC)

| Field | State | Verification |
| --- | --- | --- |
| MIT | **APPLIED** | MACHINE-VERIFIED |
| `Copyright (c) 2026 Yuki Shibata` | **APPLIED** | MACHINE-VERIFIED |
| Version `0.1.0` | **PUBLISHED** on `https://registry.npmjs.org` | MACHINE-VERIFIED |
| Registry | npmjs **LIVE** | MACHINE-VERIFIED |
| Access | public **LIVE** | MACHINE-VERIFIED |
| Public README / SECURITY / CONTRIBUTING / CODEOWNERS | **PRESENT** | MACHINE-VERIFIED |
| Old private publish workflow (`publish-private-core.yml`) | **RETIRED** | MACHINE-VERIFIED |
| Repository visibility | **PUBLIC** | MACHINE-VERIFIED |
| npm publication | **YES** — `@hello-ai-company/editor-core@0.1.0` + `@0.1.1` (immutable; do not republish) | MACHINE-VERIFIED |
| GitHub Private Vulnerability Reporting | **ENABLED** | MACHINE-VERIFIED |
| Protect main Ruleset | **ACTIVE** (PR required; conversation resolution; force-push/deletion blocked; required checks verify/preflight 20+22) | MACHINE-VERIFIED |
| D1-EXEC | **EXECUTED** through bootstrap publish of `0.1.0` | MACHINE-VERIFIED |
| Trusted Publisher / OIDC (core) | **OWNER-CONFIRMED CONFIGURED** (`publish-public-core.yml` + Environment `public-npmjs`) | OWNER-CONFIRMED |
| Trusted Publisher / OIDC (blocknote) | **OWNER CONFIGURATION REQUIRED** (`publish-public-blocknote.yml` + Environment `public-npmjs`) | OWNER ACTION |
| GitHub Environment `public-npmjs` | **CONFIGURED + PROTECTED** (main only; no NPM_TOKEN) | MACHINE-VERIFIED; no token OWNER-CONFIRMED |
| Tag / GitHub Release | **PUBLISHED** — `v0.1.0` → `ed59ae41ee4bd95ec01492415885f3ee2cdaaf0e`; `OpenEditor v0.1.0` | MACHINE-VERIFIED |
| Future publish workflow (core) | **production-ready** for `0.1.1+` | MACHINE-VERIFIED file |
| Future publish workflow (blocknote) | **production-ready candidate** for first `editor-blocknote@0.1.0` | MACHINE-VERIFIED file when landed |
| READY FOR PUBLIC RELEASE PREPARATION | **DONE** (historical) | — |
| READY TO REPUBLISH `0.1.0` / `0.1.1` | **NO** | — |
| READY TO RETAG / RERELEASE `v0.1.0` | **NO** | — |
| `@hello-ai-company/editor-blocknote` published | **NO** | MACHINE-VERIFIED |

Identity lock: `@hello-ai-company/editor-core@0.1.0` MIT, `publishConfig` `https://registry.npmjs.org` + `access: public`. Root workspace `"private": true`. **CORE SOURCE CHANGE REQUIRED: NO.**

`personal-ai` consumer baseline (docs only): `c2bd73f80ddb2752215acc01d78d26322068fcae` — **do not edit that repo from here**.

## Remaining execution (post-bootstrap)

Completed path (historical procedure; do not re-run):

```
(D1-EXEC through npm 0.1.0 — DONE)
→ Environment public-npmjs created + protected (DONE)
→ OIDC workflow landed under `.github/workflows/publish-public-core.yml` (DONE — foundation)
→ npm Trusted Publisher configured (OWNER-CONFIRMED DONE)
→ tag / GitHub Release v0.1.0 (DONE)
```

Remaining:

```
→ ChatGPT-independent review of blocknote Trusted Publishing workflow PR
→ OWNER: configure npm Trusted Publisher for publish-public-blocknote.yml + Environment public-npmjs
→ OWNER: confirm Trusted Publisher Allowed actions includes direct npm publish
→ separate human gate before any workflow_dispatch for editor-blocknote@0.1.0
→ never republish core 0.1.0 / 0.1.1; never claim blocknote is published until registry prove
```

| Action | Gate | Now |
| --- | --- | --- |
| Make the GitHub repository public | DONE | **YES** |
| Bootstrap `npm publish` of core `0.1.0` (exactly once) | DONE | **YES** (immutable) |
| Publish core `0.1.1` via OIDC | DONE | **YES** (immutable) |
| Enable GitHub PVR | DONE | **YES** |
| Protect main Ruleset | DONE | **ACTIVE** |
| Create + protect Environment `public-npmjs` | DONE | **YES** (MACHINE-VERIFIED) |
| Land core workflow under `.github/workflows/` | DONE | **YES** |
| Configure npm Trusted Publisher for core | DONE | **OWNER-CONFIRMED YES** |
| Land blocknote workflow `publish-public-blocknote.yml` | Candidate in review | when PR merges |
| Configure npm Trusted Publisher for blocknote | OWNER ACTION | **NO** — OWNER CONFIGURATION REQUIRED |
| Git tag / GitHub Release | DONE | **YES** — do not recreate |
| Dispatch blocknote publish workflow | Separate ChatGPT + human gate + owner TP | **NO** |
| Edit `hello-ai-company/personal-ai` | Never from this repo | NO |
| Modify `packages/core/src/**` or BlockNote renderer runtime for “release polish” | Out of scope | NO |
| Re-enable retired GH Packages publish workflow | Forbidden | NO |
| Republish `0.0.0-phase3.e17b4b5` or republish core `0.1.0`/`0.1.1` | Forbidden | NO |

## personal-ai consumer options (public artifact exists)

Baseline: `c2bd73f80ddb2752215acc01d78d26322068fcae` still may consume the **historical private** GitHub Packages prerelease.

| Option | Meaning | Who changes personal-ai |
| --- | --- | --- |
| Keep GH Packages pin | No registry migration | Nobody, or pin refresh only |
| Switch to npmjs | `.npmrc` / CI / lockfile in personal-ai | personal-ai maintainers |
| Dual period | Validate npmjs tarball in CI while runtime stays on GH Packages | personal-ai maintainers |
| Pin vs range | Exact version vs `^` after public semver policy | personal-ai maintainers |

**Owner Decision: PENDING.** Do not execute from this repo.

## Rollback if a public attempt is started then aborted

| If this happened | Rollback reality |
| --- | --- |
| Repo made public | Usually can set PRIVATE again; forks/mirrors may remain. **HUMAN GATE** to revert. |
| OSS license applied and published | Copies already taken keep that grant for **that version**. New versions can differ; you cannot claw back. |
| npmjs publish | **Assume irreversible.** Deprecate + publish a newer fix. Do not plan on unpublish. |
| Version `0.0.0-phase3.e17b4b5` on GH Packages | **Leave immutable.** Do not reuse. |
| `0.1.0` on npmjs | **Leave immutable.** Do not republish. |
| personal-ai pointed at npmjs | Revert **in personal-ai** to the GH Packages pin. Not this repo. |

## Destructive-step checklist (current)

| Step | Status |
| --- | --- |
| Make public | **YES** |
| Apply MIT | **YES** |
| Write copyright into LICENSE | **YES** |
| Prepare `0.1.0` + npmjs public metadata | **YES** |
| Publish `0.1.0` to npmjs | **YES** (once; immutable) |
| Tag | **YES** — `v0.1.0` (do not recreate/move) |
| GitHub Release | **YES** — `OpenEditor v0.1.0` published |
| Enable PVR | **YES** |
| Protect main | **YES** (Ruleset ACTIVE) |
| Create Environment `public-npmjs` | **YES** (MACHINE-VERIFIED CONFIGURED + PROTECTED) |
| Configure Trusted Publisher | **YES** (OWNER-CONFIRMED CONFIGURED) |
| Edit personal-ai | NO |
| Configure GitHub Sponsors | NO |
| Add `.github/FUNDING.yml` | NO |

## Historical snapshot (Phase 4E pre-D1 — not current)

Phase 4E preparation on private HEAD claimed visibility PRIVATE, npm publication NO, PVR NO, D1-EXEC PENDING. That snapshot is **historical**. Prefer **Current (post D1-EXEC)** above.

Also historical: Phase 4D.1 at `8d6b66a51219044e2e8a068443f11c7eb132beca` before MIT/`0.1.0` prep — private GH Packages `0.0.0-phase3.e17b4b5` `UNLICENSED`. That prerelease remains immutable on GitHub Packages.

## Classification

**Bootstrap publish DONE. Tag/Release DONE. Environment DONE. Trusted Publisher OWNER-CONFIRMED DONE.** Remaining: independent review + separate human gate before any production `workflow_dispatch` for **`0.1.1+` only**.

**Do not treat `0.1.0` as unpublished. Do not dispatch publish while package version is still `0.1.0`.**
