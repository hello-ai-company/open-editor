# Public release runbook (do not execute)

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

Human-gated plan for a **possible** private→public transition of `@hello-ai-company/editor-core`. **Phase 4C must not execute any step below.** Every destructive or legally binding action has a **HUMAN GATE**. Do not check license-application / visibility / publish items in [public-release-checklist.md](./public-release-checklist.md) from this runbook.

Companion: [public-release-decision.md](./public-release-decision.md). Philosophy rows (D1, D20–D25) are OWNER-CONFIRMED; execution (D1-EXEC, D2 application, D9, D18, …) remains **PENDING**.

## Preconditions (already true; not a release)

Private readiness on `origin/main` `4633bcb57852a73a973475f8fc23b336ccabb6a6` (Phase 4A gates unchanged; Phase 4B/4C docs only):

- SoT `packages/core`; API + provider contracts; tarball inspect; isolated consumer; security scan; identity lock `@hello-ai-company/editor-core@0.0.0-phase3.e17b4b5` `UNLICENSED` on `npm.pkg.github.com`
- `personal-ai` consumer baseline (docs only): `c2bd73f80ddb2752215acc01d78d26322068fcae` — **do not edit that repo from here**

These gates **do not** authorize npmjs, tags, Releases, license application, or visibility change.

## Stop — do not start these from Phase 4C

| Action | Gate |
| --- | --- |
| Make the GitHub repository public | HUMAN GATE — D1-EXEC + D9 |
| Apply MIT/Apache/GPL/other to `LICENSE` / package.json | HUMAN GATE — D2 (**LICENSE APPLICATION REQUIRED** as a later phase) |
| Rename package or repository | HUMAN GATE — D5/D10 |
| Register npm org / unscoped name | HUMAN GATE — D6 |
| `npm publish` to npmjs or a new GitHub Packages version | HUMAN GATE — D7/D8 |
| Version bump away from `0.0.0-phase3.e17b4b5` | HUMAN GATE — D8 |
| Git tag | HUMAN GATE — D18 |
| GitHub Release | HUMAN GATE — D18 |
| Configure npm trusted publishing / secrets | HUMAN GATE — D15 |
| Change branch protection or org settings | HUMAN GATE — D13 |
| Edit `hello-ai-company/personal-ai` | Never from this repo — consumer owners only |
| Modify `packages/core/src/**` for “release polish” | Out of scope unless a later phase says CORE SOURCE CHANGE REQUIRED |

## Suggested order **after** written public-approval

Do not perform the list. It exists so an owner can see coupling.

1. **HUMAN GATE:** Written **D1-EXEC** approval (ticket/email) to execute public actions. D1 intent YES is **not** enough. Stop if missing.
2. **HUMAN GATE:** D19 chain-of-title for the `personal-ai` extract. Stop if legal is not satisfied.
3. **HUMAN GATE:** D2 license + D3 copyright holder. Stop — do not apply files until both are explicit.
4. **HUMAN GATE:** D11 security contact filled; then a real root `SECURITY.md`. Stop if contact is still “REQUIRED”.
5. **HUMAN GATE:** D5/D6 name + npm org; D7 registry; D8 first public version string. Stop if any is PENDING.
6. Engineering (later phase, **not 4C**): update `AUTHORIZED_*`, tests, workflows, docs banners; run `npm ci && npm run verify`.
7. **HUMAN GATE:** Confirm verify + identity gates match the **new** identity (never republish `0.0.0-phase3.e17b4b5` under a new license/registry).
8. **HUMAN GATE:** Publish command (new workflow or dispatch). Treat npmjs publish as **largely irreversible** (unpublish is not a rollback plan).
9. **HUMAN GATE:** Repository visibility (D9). Prefer publishing a licensed package **before** or **with** visibility change so the public tree is not `UNLICENSED` + public-by-accident.
10. **HUMAN GATE:** Tag + GitHub Release (D18) only after the published version exists.
11. **HUMAN GATE:** Promote `docs/public-drafts/*` to root; CoC; templates; CODEOWNERS; branch protection (D12–D14, D17).
12. Notify **personal-ai owners** (separate repo) to choose D16. This repo still does not edit personal-ai.

## personal-ai consumer options (after a public artifact exists)

Baseline: `c2bd73f80ddb2752215acc01d78d26322068fcae` already consumes the **private** GitHub Packages package.

| Option | Meaning | Who changes personal-ai |
| --- | --- | --- |
| Keep GH Packages pin | No registry migration | Nobody, or pin refresh only |
| Switch to npmjs | `.npmrc` / CI / lockfile in personal-ai | personal-ai maintainers |
| Dual period | Validate npmjs tarball in CI while runtime stays on GH Packages | personal-ai maintainers |
| Pin vs range | Exact version vs `^` after public semver policy | personal-ai maintainers |

**Owner Decision: PENDING.** Do not execute.

## Rollback if a public attempt is started then aborted

| If this happened | Rollback reality |
| --- | --- |
| Repo made public | Usually can set PRIVATE again; forks/mirrors may remain. **HUMAN GATE** to revert. |
| OSS license applied and published | Copies already taken keep that grant for **that version**. New versions can differ; you cannot claw back. |
| npmjs publish | **Assume irreversible.** Deprecate + publish a newer fix. Do not plan on unpublish. |
| Version `0.0.0-phase3.e17b4b5` on GH Packages | **Leave immutable.** Do not reuse. |
| personal-ai pointed at npmjs | Revert **in personal-ai** to the GH Packages pin. Not this repo. |
| Identity gates loosened | Revert git on `open-editor` to restore `AUTHORIZED_*` = current private identity. |

## Destructive-step checklist (all remain NO in Phase 4C)

| Step | Executed in 4C |
| --- | --- |
| Make public | NO |
| Apply license | NO |
| Rename | NO |
| Register npm | NO |
| Publish | NO |
| Version bump | NO |
| Tag | NO |
| GitHub Release | NO |
| Edit personal-ai | NO |
| Change protection/secrets | NO |
| Configure GitHub Sponsors | NO |
| Add `.github/FUNDING.yml` | NO |

## Phase 4D / public release

Do **not** start Phase 4D or any public release from this runbook. Phase 4C only recorded OSS philosophy and a license **recommendation**. Next:

**STOP — READY FOR OWNER LICENSE / RELEASE-GATE REVIEW**
