# Public exposure audit (Phase 4E hard gate)

**INTERNAL EVIDENCE** — not a public product document.

**Case:** ENG-20260913-007 Phase 4E / PA-20260917-002  
**Role:** Best-effort audit of git history, blobs, and Actions YAML before a public-ready source tree. **No history rewrite.**

Audit date: 2026-09-16  
Base: `origin/main` `898b2af895984736ff4e40416aa403a40142c4c9`  
Repository: `hello-ai-company/open-editor` (PRIVATE; must remain PRIVATE)

## Verdict

| Class | Result |
| --- | --- |
| **P1** credential / live secret / unexpected PII / proprietary payload that would block opening history | **None found** |
| **P2** internal phase IDs, historical `UNLICENSED` text, provenance mentions, retired private publish workflow | **Present** (expected; not a STOP) |
| **CLEAR** for public-history exposure blocker | **YES** |

**STOP — PUBLIC HISTORY EXPOSURE BLOCKER:** not raised.

This audit is best-effort. It is not a counsel review and not a guarantee against every GitHub Actions log retention edge.

## Method

- Working tree scan for token-like patterns (`github_pat_`, `ghp_`+body, `npm_`, AWS key IDs, private keys, Slack tokens, Stripe live keys)
- `git grep` across all commits for the same classes
- Email harvest in tracked files
- `packages/core/src/**` leakage identifiers (`personal-ai`, `Secretary`, `AgentTask`, `__PAI_`)
- Workflow YAML `secrets.*` / `id-token` / `NPM_TOKEN`
- Blob size review (no large binary dumps)
- `git log` author/committer set
- `gh run list` for historical Actions (names/conclusions only; logs not fully re-downloaded)

## P1 — none

No live credentials, private keys, `.env` files, npm tokens, or GitHub PATs were found in blobs.

Hits that look like secret *names* are **deny-list patterns**, not values:

- `scripts/lib/leakage-patterns.mjs` matches `SUPABASE_JWT_SECRET`, `github_pat_`, `ghp_[A-Za-z0-9]{20,}`
- `docs/security-boundary.md` documents those classes as **must never enter the package**
- Historical `.github/workflows/publish-private-core.yml` referenced `${{ secrets.GITHUB_TOKEN }}` (Actions placeholder; not a token value). That workflow is **retired** in Phase 4E; the file remains in git history (P2). Do not unpublish the existing private GitHub Packages version.

## P2 — internal / historical (allowed)

Classify as **P2** unless a later review finds a real secret:

| Item | Why P2 |
| --- | --- |
| Internal phase IDs (`Phase 4A`…`4E`, `ENG-20260913-007`, `PA-20260917-002`, `D1-EXEC`) | Process metadata, not credentials |
| Historical `UNLICENSED` license text in git | Superseded by MIT in this phase; history must not be rewritten |
| Historical identity `@hello-ai-company/editor-core@0.0.0-phase3.e17b4b5` on `npm.pkg.github.com` | Immutable private prerelease; do not republish |
| Provenance docs naming `hello-ai-company/personal-ai` and extract SHAs | Internal evidence; keep classified; **not** in `packages/core/src/**` or the packed tarball |
| Git authors `Cursor Agent <cursoragent@cursor.com>` and `yuki-s-code` noreply | Standard git identities already on commits |
| Retired `publish-private-core.yml` in history | Private GH Packages publish path; workflow removed from HEAD; do not unpublish |
| Placeholder `security@hello-ai-company.com` in older security-gate prose | Explicitly a **do-not-invent** example, not a contact |

## CLEAR — production surface

- `packages/core/src/**`: no host product identifiers, no secrets
- Packed artifact allowlist: `package.json`, `LICENSE`, `README.md`, `dist/*`
- Runtime dependencies: zero
- Git history is **fresh** (no `personal-ai` import). Root commit `5644d14548641179de281e38a1d9219a38caa80f`

## Actions

Best-effort `gh run list`: CI / phase-4a / one successful historical `publish-private-core` `workflow_dispatch` on `main` (2026-09-13). Workflow YAML does not embed tokens. Full log redaction is **not** claimed.

## Non-action

- No `git filter-repo` / force-push / history rewrite
- No GitHub visibility change
- No attempt to unpublish GitHub Packages `0.0.0-phase3.e17b4b5`
