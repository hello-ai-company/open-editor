# Repository governance (recommendations only)

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

Recommendations for a **future** public OSS posture. **No GitHub settings, branch protection, secrets, visibility, Sponsors, or workflow files were changed in Phase 4D.1.**

Related drafts: [public-drafts/README.md](./public-drafts/README.md), [public-drafts/CONTRIBUTING.md](./public-drafts/CONTRIBUTING.md), [public-drafts/SECURITY.md](./public-drafts/SECURITY.md).

## Current private posture

| Area | Today |
| --- | --- |
| Visibility | PRIVATE (must remain until owner approval) |
| Root README | Private extraction banners; retain until authorized rewrite |
| License | `UNLICENSED` at root and `packages/core` |
| CODEOWNERS | Missing |
| CONTRIBUTING / SECURITY / CoC | Missing at root; drafts under `docs/public-drafts/` only |
| Issue / PR templates | Missing (`.github/` contains workflows only) |
| Dependabot | Missing |
| Publish | `publish-private-core.yml` on `workflow_dispatch` only; `--access restricted --provenance=false` |
| Security contact | **None enabled** — prefer GitHub Private Vulnerability Reporting; D11 **PREPARED** (enable during public transition; not enabled; no invented email) |
| Funding | **No** `.github/FUNDING.yml` — **SPONSOR LINK — OWNER SETUP REQUIRED** |

## File checklist vs typical public OSS

| Artifact | Now | Recommendation when public is authorized | Apply in 4D? |
| --- | --- | --- | --- |
| Root README | Private banner | Replace with reviewed `docs/public-drafts/README.md` | NO |
| LICENSE (OSS) | Proprietary UNLICENSED | Apply selected SPDX | NO |
| CONTRIBUTING.md | Absent | Promote draft to root | NO |
| SECURITY.md | Absent | Promote draft **after** D11 is enabled during public transition | NO |
| CODE_OF_CONDUCT.md | Absent | Add Contributor Covenant or org CoC | NO |
| `.github/CODEOWNERS` | Absent | Require review from named owners | NO |
| `.github/ISSUE_TEMPLATE/*` | Absent | Bug / feature; block “please publish” noise | NO |
| `.github/pull_request_template.md` | Absent | Checklist: verify, no identity edits | NO |
| `.github/dependabot.yml` | Absent | npm + GitHub Actions | NO |
| GitHub Security Policy UI | Unset | Point at SECURITY.md + private reporting | NO |
| `.github/FUNDING.yml` | Absent | Add **only** with a real owner-approved sponsor URL | NO |

## CI recommendations

### What exists

| Workflow | Triggers | Notes |
| --- | --- | --- |
| `ci.yml` | `push` to `main`, `grokbot/phase-2-*`, `grokbot/phase-3-*`; `workflow_dispatch` | **No `pull_request`**. Omits `scripts/api-contract.mjs` vs local `npm run verify`. |
| `phase-4a-release-readiness.yml` | `push`/`pull_request` involving `main` and the Phase 4A branch; matrix Node 20/22 | Currently the PR verify path; includes API contract |
| `publish-private-core.yml` | `workflow_dispatch` only | Keep human-gated; do not add `push` publish |

### Recommended (do not implement now)

1. Canonical job name matching `npm run verify` exactly; required status check on `main`.
2. `pull_request` + `push` to `main` on that job (fork PRs without publish secrets).
3. Keep Node 20 and 22.
4. Concurrency cancel-in-progress per ref.
5. **Never** auto-publish on push.
6. When Phase 4A workflow is retired, **merge** its PR coverage into `ci.yml` first or PRs lose CI.
7. Optional later: `npm audit` / OSV **in addition to** `scripts/security-scan.mjs` (leakage scan is not a CVE scanner substitute).

Phase 4D.1 CI: documentation-only. Do not expand workflow branch lists unless a later authorized phase says so.

## Branch protection (recommend only — do not click settings)

For `main` after public authorization:

| Rule | Recommendation |
| --- | --- |
| Require a pull request | Yes |
| Required checks | Unified `verify` (strict / up to date) |
| Approving reviews | ≥1; CODEOWNERS when present |
| Force push | Disabled |
| Deletion of default branch | Disabled |
| Restrict who can push / bypass | Admins / release managers only |
| Restrict who can edit rules | Separate from everyday maintainers |
| Signed commits | Optional |

Unknown current protection is fine for a private extraction repo; **do not change settings in Phase 4D.1**.

## Permissions and secrets

| Item | Phase 4D.1 |
| --- | --- |
| Repository visibility | Stay PRIVATE |
| `GITHUB_TOKEN` packages write | Only on the existing dispatch publish workflow |
| npmjs trusted publisher / `NPM_TOKEN` | **Do not configure** |
| GitHub Sponsors / FUNDING.yml | **Do not configure**; no fake URLs |
| Environments / required reviewers for publish | Recommend for a future public publish workflow; **do not add now** |

## Code of Conduct / community

Recommend a CoC before external contributors. Selection of text (Contributor Covenant vs company policy) is **OWNER DECISION PENDING**. Not installed in this phase.

## Owner decisions that block “looking like OSS”

- D11 GitHub Private Vulnerability Reporting enablement (**PREPARED**; enable during public transition; preferred method recorded, not enabled)
- D12 CODEOWNERS names
- D13 branch protection
- D14 CI unification
- D17 promoting drafts to root

Until D1-EXEC (public execution authorization) is yes, keep the private README banners. Optional Support wording lives only in `docs/public-drafts/README.md`.
