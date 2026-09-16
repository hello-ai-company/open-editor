# Branch protection plan (do not configure in Phase 4E)

**INTERNAL EVIDENCE / OPS** — not a public product document.

**Case:** ENG-20260913-007 Phase 4E / PA-20260917-002  
**Role:** Recommended GitHub branch protection for `main` **after** public transition. **Do not click GitHub settings in this phase.**

## Recommended rules for `main` (later)

| Rule | Recommendation |
| --- | --- |
| Require a pull request | Yes |
| Required checks | `ci` / `verify` (Node 20 + 22) and `public-release-preflight` while that workflow remains the non-publishing gate |
| Approving reviews | ≥1; CODEOWNERS (`* @yuki-s-code`) |
| Force push | Disabled |
| Deletion of default branch | Disabled |
| Restrict who can push / bypass | Admins / release managers only |
| Restrict who can edit rules | Separate from everyday maintainers |
| Signed commits | Optional |

Do **not** require a publishing workflow. Never make `npm publish` (non-dry-run) a required check.

## Explicit non-action

Phase 4E does not enable, disable, or edit branch protection, rulesets, or org policies.
