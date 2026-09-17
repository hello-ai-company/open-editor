# Public release runbook

**INTERNAL EVIDENCE** — not a public product document.

**Case:** ENG-20260913-007 Phase 4E R1 / PA-20260917-002 / post-D1-EXEC  
Human-gated plan for remaining post-publish steps. Bootstrap visibility + npm `0.1.0` are **done**. Do not republish `0.1.0`. Do not create tag/Release from this document without a separate gate.

Companion: [public-release-decision.md](./public-release-decision.md), [first-public-publish-bootstrap.md](./first-public-publish-bootstrap.md).

## Current (post D1-EXEC)

| Field | State |
| --- | --- |
| MIT | **APPLIED** |
| `Copyright (c) 2026 Yuki Shibata` | **APPLIED** |
| Version `0.1.0` | **PUBLISHED** on `https://registry.npmjs.org` |
| Registry | npmjs **LIVE** |
| Access | public **LIVE** |
| Public README / SECURITY / CONTRIBUTING / CODEOWNERS | **PRESENT** |
| Old private publish workflow (`publish-private-core.yml`) | **RETIRED** |
| Repository visibility | **PUBLIC** |
| npm publication | **YES** — `@hello-ai-company/editor-core@0.1.0` (immutable; do not republish) |
| GitHub Private Vulnerability Reporting | **ENABLED** |
| Protect main Ruleset | **ACTIVE** (PR required; conversation resolution; force-push/deletion blocked; required checks verify/preflight 20+22) |
| D1-EXEC | **EXECUTED** through bootstrap publish of `0.1.0` |
| Trusted Publisher / OIDC | **PENDING** (workflow foundation may land first; TP config after filename exists on default branch) |
| GitHub Environment `public-npmjs` | **OWNER ACTION — create and protect BEFORE merging** the Trusted Publishing foundation workflow |
| Tag / GitHub Release | **PENDING** |
| READY FOR PUBLIC RELEASE PREPARATION | **DONE** (historical) |
| READY TO REPUBLISH `0.1.0` | **NO** |
| READY TO TAG / RELEASE `v0.1.0` | **NO** until separate gate |

Identity lock: `@hello-ai-company/editor-core@0.1.0` MIT, `publishConfig` `https://registry.npmjs.org` + `access: public`. Root workspace `"private": true`. **CORE SOURCE CHANGE REQUIRED: NO.**

`personal-ai` consumer baseline (docs only): `c2bd73f80ddb2752215acc01d78d26322068fcae` — **do not edit that repo from here**.

## Remaining execution (post-bootstrap)

Canonical order is in [first-public-publish-bootstrap.md](./first-public-publish-bootstrap.md):

```
(D1-EXEC through npm 0.1.0 — DONE)
→ owner creates + protects GitHub Environment public-npmjs (BEFORE foundation merge)
→ land OIDC workflow under `.github/workflows/publish-public-core.yml` (merge foundation)
→ configure npm Trusted Publisher (workflow filename must already exist on default branch)
→ later reviewed PR enables real publish for future versions only
→ tag / GitHub Release only after separate gate
```

| Action | Gate | Now |
| --- | --- | --- |
| Make the GitHub repository public | DONE | **YES** |
| Bootstrap `npm publish` of `0.1.0` (exactly once) | DONE | **YES** (immutable) |
| Enable GitHub PVR | DONE | **YES** |
| Protect main Ruleset | DONE | **ACTIVE** |
| Create + protect Environment `public-npmjs` | **BEFORE** merging foundation workflow (avoid unprotected auto-create on first dispatch) | **NO — OWNER** |
| Land workflow foundation under `.github/workflows/` | Before Trusted Publisher config (npm requires existing filename) | Draft foundation PR may be open |
| Configure npm Trusted Publisher / OIDC | AFTER merge (filename on default branch); package already exists | **NO — OWNER after merge** |
| Git tag / GitHub Release | Separate human gate after independent review | **NO** |
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
| Tag | **NO** (pending separate gate) |
| GitHub Release | **NO** (pending separate gate) |
| Enable PVR | **YES** |
| Protect main | **YES** (Ruleset ACTIVE) |
| Create Environment `public-npmjs` | **NO — OWNER before foundation merge** |
| Configure Trusted Publisher | **NO — OWNER after foundation merge** |
| Edit personal-ai | NO |
| Configure GitHub Sponsors | NO |
| Add `.github/FUNDING.yml` | NO |

## Historical snapshot (Phase 4E pre-D1 — not current)

Phase 4E preparation on private HEAD claimed visibility PRIVATE, npm publication NO, PVR NO, D1-EXEC PENDING. That snapshot is **historical**. Prefer **Current (post D1-EXEC)** above.

Also historical: Phase 4D.1 at `8d6b66a51219044e2e8a068443f11c7eb132beca` before MIT/`0.1.0` prep — private GH Packages `0.0.0-phase3.e17b4b5` `UNLICENSED`. That prerelease remains immutable on GitHub Packages.

## Classification

**Bootstrap publish DONE.** Remaining: Environment `public-npmjs` (before foundation merge), Trusted Publisher (after merge), tag/Release (separate gate).

**Do not treat `0.1.0` as unpublished.**
