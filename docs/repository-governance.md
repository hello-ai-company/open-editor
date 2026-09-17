# Repository governance (recommendations only)

**INTERNAL EVIDENCE** — not a public product document. Historical governance notes plus Phase 4E CI updates and post-D1-EXEC facts. Current identity: `@hello-ai-company/editor-core@0.1.0` MIT **published** on npmjs; repo **PUBLIC**.

Phase 4E applied public-facing files and canonical CI. D1-EXEC later made the repo PUBLIC, enabled PVR, activated Protect main, and published `0.1.0`. Trusted Publisher and Environment `public-npmjs` remain owner gates.

Public-facing files live at repo root (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`). Historical drafts: [public-drafts/README.md](./public-drafts/README.md). Branch protection: Protect main Ruleset **ACTIVE** (see [branch-protection-plan.md](./branch-protection-plan.md) for historical plan text).

## Current posture (post D1-EXEC)

| Area | Today |
| --- | --- |
| Visibility | **PUBLIC** |
| Root README | Public OSS positioning (portable document layer) |
| License | MIT — `Copyright (c) 2026 Yuki Shibata` |
| CODEOWNERS | `.github/CODEOWNERS` → `* @yuki-s-code` |
| CONTRIBUTING / SECURITY | Present at root; no CLA/DCO; PVR **ENABLED** |
| Protect main | Ruleset **ACTIVE** |
| Issue / PR templates | Missing (optional later) |
| Dependabot | Missing |
| Publish | Private GH Packages workflow **retired**. Active non-publishing `public-release-preflight.yml` (dry-run only). OIDC foundation: `.github/workflows/publish-public-core.yml` when present (publish disabled until reviewed enablement). Historical template: [release-templates/publish-public-core.yml](./release-templates/publish-public-core.yml). Environment `public-npmjs` must be created + protected **before** merging that foundation |
| npm | `@hello-ai-company/editor-core@0.1.0` **PUBLISHED** (do not republish) |
| Trusted Publisher | **PENDING** (after foundation merge) |
| Security contact | PVR **ENABLED** |
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
| Repository visibility | **PUBLIC** (D1-EXEC done) |
| `GITHUB_TOKEN` packages write | Not used for public npmjs path |
| npmjs trusted publisher / `NPM_TOKEN` | Trusted Publisher **PENDING** (after foundation merge); do not create `NPM_TOKEN` |
| GitHub Sponsors / FUNDING.yml | **Do not configure** without owner-approved URL |
| Environments / required reviewers for publish | **OWNER: create + protect `public-npmjs` BEFORE merging** foundation workflow |

## Code of Conduct / community

Recommend a CoC before external contributors. Selection of text (Contributor Covenant vs company policy) is **OWNER DECISION PENDING**. Not installed in this phase.

## Owner decisions that block “looking like OSS”

- D11 GitHub Private Vulnerability Reporting enablement (**PREPARED**; enable during public transition; preferred method recorded, not enabled)
- D12 CODEOWNERS names
- D13 branch protection
- D14 CI unification
- D17 promoting drafts to root

Until D1-EXEC (public execution authorization) is yes, keep the private README banners. Optional Support wording lives only in `docs/public-drafts/README.md`.
