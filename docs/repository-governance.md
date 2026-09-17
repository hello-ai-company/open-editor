# Repository governance (recommendations only)

**INTERNAL EVIDENCE** — not a public product document. Historical governance notes plus Phase 4E CI updates. Current prepared identity: `@hello-ai-company/editor-core@0.1.0` MIT on npmjs (not published; repo PRIVATE).

Phase 4E applied public-facing files and canonical CI. **No GitHub visibility, branch protection, secrets, Sponsors, PVR, or npm publish** were changed.

Public-facing files now live at repo root (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`). Historical drafts: [public-drafts/README.md](./public-drafts/README.md). Branch protection plan (do not configure): [branch-protection-plan.md](./branch-protection-plan.md).

## Current posture (Phase 4E)

| Area | Today |
| --- | --- |
| Visibility | PRIVATE (must remain until D1-EXEC) |
| Root README | Public OSS positioning (portable document layer) |
| License | MIT — `Copyright (c) 2026 Yuki Shibata` |
| CODEOWNERS | `.github/CODEOWNERS` → `* @yuki-s-code` |
| CONTRIBUTING / SECURITY | Present at root; no CLA/DCO; PVR documented not enabled |
| Issue / PR templates | Missing (optional later) |
| Dependabot | Missing |
| Publish | Private GH Packages workflow **retired**. Active non-publishing `public-release-preflight.yml` (dry-run only). OIDC foundation: `.github/workflows/publish-public-core.yml` when present (publish disabled until reviewed enablement). Historical template: [release-templates/publish-public-core.yml](./release-templates/publish-public-core.yml) |
| Security contact | D11 **PREPARED** — **ENABLE DURING PUBLIC TRANSITION**; not enabled; no invented email |
| Funding | **No** `.github/FUNDING.yml` — **SPONSOR LINK — OWNER SETUP REQUIRED** |

## File checklist vs typical public OSS

| Artifact | Now | Recommendation when public is authorized | Apply in 4D? |
| --- | --- | --- | --- |
| Root README | Private banner | Replace with reviewed `docs/public-drafts/README.md` | NO |
| LICENSE (OSS) | MIT applied | Keep MIT | YES (Phase 4E) |
| CONTRIBUTING.md | Present at root | Keep lightweight; no CLA/DCO | YES (Phase 4E) |
| SECURITY.md | Present at root | Enable PVR during public transition | YES file / NO PVR |
| `.github/CODEOWNERS` | `* @yuki-s-code` | Keep | YES (Phase 4E) |
| `.github/ISSUE_TEMPLATE/*` | Absent | Bug / feature; block “please publish” noise | NO |
| `.github/pull_request_template.md` | Absent | Checklist: verify, no identity edits | NO |
| `.github/dependabot.yml` | Absent | npm + GitHub Actions | NO |
| GitHub Security Policy UI | Unset | Point at SECURITY.md + private reporting | NO |
| `.github/FUNDING.yml` | Absent | Add **only** with a real owner-approved sponsor URL | NO |

## CI recommendations

### What exists (Phase 4E)

| Workflow | Triggers | Notes |
| --- | --- | --- |
| `ci.yml` | `push`/`pull_request` on `main`; `workflow_dispatch` | Canonical verify; Node 20+22; includes API contract |
| `public-release-preflight.yml` | `push`/`pull_request` on `main`; `workflow_dispatch` | Non-publishing; `contents:read` only; `npm publish --dry-run`; no `packages:write` / `id-token` / `NPM_TOKEN` |
| `phase-4a-release-readiness.yml` | **retired** | Merged into `ci.yml` |
| `publish-private-core.yml` | **retired** | Do not unpublish existing GitHub Packages `0.0.0-phase3.e17b4b5` |

Rules: never auto-publish on push; dry-run only in required CI. OIDC publish workflow may exist as a `workflow_dispatch` foundation with the real publish step disabled until Trusted Publisher is configured (workflow filename must exist first).

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
