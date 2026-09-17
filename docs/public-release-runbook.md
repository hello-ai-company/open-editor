# Public release runbook

**INTERNAL EVIDENCE** — not a public product document.

**Case:** ENG-20260913-007 Phase 4E R1 / PA-20260917-002 / post-D1-EXEC / TP production-ready  
Human-gated plan for remaining post-publish steps. Bootstrap visibility + npm `0.1.0` + tag/Release + Environment + Trusted Publisher are **done**. Do not republish `0.1.0`. Do not recreate or move tag/Release. Do not `workflow_dispatch` the publish workflow until a separate ChatGPT-reviewed gate.

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
| npm publication | **YES** — `@hello-ai-company/editor-core@0.1.0` (immutable; do not republish) | MACHINE-VERIFIED |
| GitHub Private Vulnerability Reporting | **ENABLED** | MACHINE-VERIFIED |
| Protect main Ruleset | **ACTIVE** (PR required; conversation resolution; force-push/deletion blocked; required checks verify/preflight 20+22) | MACHINE-VERIFIED |
| D1-EXEC | **EXECUTED** through bootstrap publish of `0.1.0` | MACHINE-VERIFIED |
| Trusted Publisher / OIDC | **OWNER-CONFIRMED CONFIGURED** (`publish-public-core.yml` + Environment `public-npmjs`) | OWNER-CONFIRMED |
| GitHub Environment `public-npmjs` | **CONFIGURED + PROTECTED** (main only; no NPM_TOKEN) | MACHINE-VERIFIED; no token OWNER-CONFIRMED |
| Tag / GitHub Release | **PUBLISHED** — `v0.1.0` → `ed59ae41ee4bd95ec01492415885f3ee2cdaaf0e`; `OpenEditor v0.1.0` | MACHINE-VERIFIED |
| Future publish workflow | **production-ready candidate** for `0.1.1+` only | MACHINE-VERIFIED file |
| READY FOR PUBLIC RELEASE PREPARATION | **DONE** (historical) | — |
| READY TO REPUBLISH `0.1.0` | **NO** | — |
| READY TO RETAG / RERELEASE `v0.1.0` | **NO** | — |

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
→ ChatGPT-independent review of production-ready publish workflow PR (#10, R1 hardened)
→ OWNER: confirm Trusted Publisher Allowed actions includes direct npm publish
→ separate human gate before any workflow_dispatch for 0.1.1+ only
→ never republish 0.1.0; never dispatch while package.json is still 0.1.0
```

| Action | Gate | Now |
| --- | --- | --- |
| Make the GitHub repository public | DONE | **YES** |
| Bootstrap `npm publish` of `0.1.0` (exactly once) | DONE | **YES** (immutable) |
| Enable GitHub PVR | DONE | **YES** |
| Protect main Ruleset | DONE | **ACTIVE** |
| Create + protect Environment `public-npmjs` | DONE | **YES** (MACHINE-VERIFIED) |
| Land workflow under `.github/workflows/` | DONE (foundation merged; production-ready redesign in review) | **YES** on `main` foundation; production-ready PR separate |
| Configure npm Trusted Publisher / OIDC | DONE | **OWNER-CONFIRMED YES** |
| Git tag / GitHub Release | DONE | **YES** — do not recreate |
| Dispatch publish workflow | Separate ChatGPT + human gate; package must be `0.1.1+` | **NO** |
| Edit `hello-ai-company/personal-ai` | Never from this repo | NO |
| Modify `packages/core/src/**` for “release polish” | Out of scope | NO |
| Re-enable retired GH Packages publish workflow | Forbidden | NO |
| Republish `0.0.0-phase3.e17b4b5` or republish `0.1.0` | Forbidden | NO |

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
