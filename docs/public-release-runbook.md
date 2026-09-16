# Public release runbook

**INTERNAL EVIDENCE** — not a public product document.

**Case:** ENG-20260913-007 Phase 4E R1 / PA-20260917-002  
Human-gated plan for a later private→public **execution**. This file does **not** authorize D1-EXEC. Do not make PUBLIC, publish, tag, or Release from this document.

Companion: [public-release-decision.md](./public-release-decision.md), [first-public-publish-bootstrap.md](./first-public-publish-bootstrap.md).

## Current (Phase 4E HEAD) — unify with the tree

| Field | State |
| --- | --- |
| MIT | **APPLIED** |
| `Copyright (c) 2026 Yuki Shibata` | **APPLIED** |
| Version `0.1.0` | **PREPARED** (package identity on this branch) |
| Registry | npmjs **PREPARED** |
| Access | public **PREPARED** |
| Public README / SECURITY / CONTRIBUTING / CODEOWNERS | **PREPARED** |
| Old private publish workflow (`publish-private-core.yml`) | **RETIRED** |
| Repository visibility | **PRIVATE** |
| npm publication | **NO** |
| GitHub Private Vulnerability Reporting | **NO** (not enabled). PVR is for public repos; enable immediately **after** PUBLIC |
| D1-EXEC | **PENDING** |
| READY FOR PUBLIC RELEASE PREPARATION | **YES** |
| READY TO PUBLISH NOW | **NO** |
| READY TO MAKE PUBLIC NOW | **NO** |

Identity lock: `@hello-ai-company/editor-core@0.1.0` MIT, `publishConfig` `https://registry.npmjs.org` + `access: public`. Root workspace `"private": true`. **CORE SOURCE CHANGE REQUIRED: NO.**

`personal-ai` consumer baseline (docs only): `c2bd73f80ddb2752215acc01d78d26322068fcae` — **do not edit that repo from here**.

## Remaining execution (after written D1-EXEC — do not run now)

Canonical order is in [first-public-publish-bootstrap.md](./first-public-publish-bootstrap.md):

```
D1-EXEC
→ PRIVATE main final verify
→ GitHub repository PUBLIC
→ immediately enable PVR + protections
→ bootstrap publish 0.1.0 once (only)
→ confirm package exists on npm
→ configure npm Trusted Publisher
→ subsequent releases via OIDC template
```

| Action | Gate | Now |
| --- | --- | --- |
| Make the GitHub repository public | HUMAN GATE — D1-EXEC + D9 | NO |
| Bootstrap `npm publish` of `0.1.0` (exactly once) | HUMAN GATE — D1-EXEC + D7/D8 | NO |
| Configure npm Trusted Publisher / OIDC | HUMAN GATE — D15; package must already exist | NO |
| Git tag / GitHub Release | HUMAN GATE — D18; after the published version exists | NO |
| Enable GitHub PVR | After PUBLIC (not while PRIVATE) | NO |
| Change branch protection | HUMAN GATE — D13; with PUBLIC | NO |
| Edit `hello-ai-company/personal-ai` | Never from this repo | NO |
| Modify `packages/core/src/**` for “release polish” | Out of scope | NO |
| Re-enable retired GH Packages publish workflow | Forbidden | NO |
| Republish `0.0.0-phase3.e17b4b5` or republish `0.1.0` | Forbidden | NO |

MIT application, `0.1.0` identity, npmjs/public metadata, public docs, CODEOWNERS, and CI unification are **already done** on this branch. Do not repeat them as if still pending.

## personal-ai consumer options (after a public artifact exists)

Baseline: `c2bd73f80ddb2752215acc01d78d26322068fcae` already consumes the **historical private** GitHub Packages prerelease.

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

## Destructive-step checklist (Phase 4E / R1)

| Step | Executed now |
| --- | --- |
| Make public | NO |
| Apply MIT | **YES** (source tree) |
| Write copyright into LICENSE | **YES** |
| Prepare `0.1.0` + npmjs public metadata | **YES** |
| Register npm / login / token | NO |
| Publish to npmjs | NO |
| Tag | NO |
| GitHub Release | NO |
| Enable PVR | NO |
| Edit personal-ai | NO |
| Change protection / secrets / Trusted Publisher | NO |
| Configure GitHub Sponsors | NO |
| Add `.github/FUNDING.yml` | NO |

## Historical snapshot (Phase 4D.1 — not current)

The following described `origin/main` at Phase 4D.1 (`8d6b66a51219044e2e8a068443f11c7eb132beca`) **before** Phase 4E applied MIT and `0.1.0`. It is **not** the current package identity:

- Then: `@hello-ai-company/editor-core@0.0.0-phase3.e17b4b5` `UNLICENSED` on `npm.pkg.github.com`
- Then: MIT selected, **not applied**; copyright line recorded, **not written** into `LICENSE`
- Then: “Do not start Phase 4E” — **obsolete**; Phase 4E preparation is this branch

That private prerelease remains immutable on GitHub Packages. It is not the prepared public line.

## Classification

**READY FOR PUBLIC RELEASE PREPARATION** — **not READY TO PUBLISH NOW** — **not READY TO MAKE PUBLIC NOW**.

**STOP — READY FOR CHATGPT PUBLIC RELEASE REVIEW R1**
