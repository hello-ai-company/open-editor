# Chain-of-title evidence (Phase 4D)

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

**Case:** ENG-20260913-007 Phase 4D / PA-20260916-004  
**Role:** Engineering provenance audit for a **future** MIT application. **Not legal advice.**  
**This document does not relicense anything.**

Gate **D19** classification: **CHAIN-OF-TITLE — OWNER/LEGAL CONFIRMATION REQUIRED**.

## Verdict

| Layer | Result |
| --- | --- |
| Engineering provenance of this extract | **ENGINEERING EVIDENCE SUPPORTS** an internal, documented extract into a fresh-history private repository with **zero** production third-party source in `packages/core/src/**` |
| Legal authority to relicense as MIT / name a copyright holder | **Not proven** |
| D19 gate | **CHAIN-OF-TITLE — OWNER/LEGAL CONFIRMATION REQUIRED** |

Engineering support is **not** owner/legal confirmation. Do not treat this file as a license, assignment, or CLA.

## What was examined

| Source | Result |
| --- | --- |
| This repository git history | Fresh history only. Root commit `5644d14548641179de281e38a1d9219a38caa80f` (2026-09-13). No `git filter-repo` / subtree import of `personal-ai`. |
| Documented extract | [extraction-status.md](./extraction-status.md): source repo `hello-ai-company/personal-ai` (read-only; **do not edit**); original extract SHA `b29c4df72c59244523f29dd5949d35f6882048ff`; approved `apps/web/src/editorCore/*` paths only |
| `packages/core/src/**` | Four first-party modules (`index.ts`, `model.ts`, `serialization.ts`, `providers.ts`). Intra-package imports only. No SPDX/copyright headers. No vendored third-party snippets. |
| Production dependencies | None ([third-party-license-inventory.md](./third-party-license-inventory.md)) |
| Published tarball allowlist | `package.json`, `LICENSE`, `dist/*` only |
| `LICENSE` / `packages/core/LICENSE` | Proprietary `UNLICENSED`. No copyright-holder legal name. |
| GitHub org `hello-ai-company` | `login` only. `name`, `email`, `company`, `blog` empty. `is_verified`: false. |
| `hello-ai-company/personal-ai` from this auditor | **Inaccessible** (GitHub API 404 with current credentials). Source LICENSE, authors, and commit `b29c4df…` could **not** be re-verified here. |
| Assignment / work-for-hire / CLA / DCO | **None found** in this repository |

## Authors present in *this* repository (not a legal conclusion)

`git shortlog -sne --all` on `open-editor`:

| Commits (approx.) | Author |
| --- | --- |
| 9 | Cursor Agent `<cursoragent@cursor.com>` |
| 6 | yuki-s-code `<68765118+yuki-s-code@users.noreply.github.com>` |

These are git identities, not a copyright holder of record. Cursor Agent commits do not prove tool-vendor ownership of the extract. `yuki-s-code` noreply email is not a legal entity name.

## What engineering evidence supports

1. This workspace was created as a **private extraction** (`README.md` banners; Phase 2 commit `e17b4b589b5784753e91a8bb4d69b44b46342418`).
2. Workspace docs list a closed, approved file set from `personal-ai` `editorCore` (no claim that other product code was copied).
3. Core source has no runtime npm dependencies and no third-party license files inside `src/`.
4. Host product identifiers are gated out of the tarball (`docs/security-boundary.md`, `scripts/security-scan.mjs`).
5. Same GitHub *org slug* is documented as owning both `open-editor` and `personal-ai`. That is **org membership branding**, not a deed of title.

## What engineering evidence does not prove

1. The **legal name** of the copyright holder (jurisdiction, entity type, official name).
2. That Hello AI Company (or any named entity) **owns** the `personal-ai` `editorCore` copyright and **may relicense** it under MIT.
3. Contributor / contractor / employee / AI-assistance ownership of every line.
4. Patent non-encumbrance.
5. Current contents and license of `personal-ai` (not readable from this auditor).
6. That informal phrases “Hello AI Company” in docs are the correct LICENSE copyright line.

## COPYRIGHT HOLDER — OWNER ACTION REQUIRED

Placeholder form **only**. Do **not** write this into `LICENSE` or `packages/core/LICENSE` in Phase 4D.

```
Copyright (c) 2026 <LEGAL ENTITY NAME — OWNER ACTION REQUIRED>
```

Replace both the year and the angle-bracket name with owner/legal values before any MIT application. Year `2026` is an engineering default from repository creation, not a legal determination.

## Owner / legal checklist (UNCHECKED)

These boxes must be checked by the **owner or counsel**, not by this phase:

- [ ] Confirm the **legal entity name** (and jurisdiction) that will appear in MIT `LICENSE` files
- [ ] Confirm the **copyright year or year range**
- [ ] Confirm that entity **owns or is exclusively licensed** the `personal-ai` `editorCore` extract listed in [extraction-status.md](./extraction-status.md)
- [ ] Confirm that entity **may relicense** that extract as **MIT** to the public
- [ ] Confirm no third-party or employee/contractor claim requires extra permission or NOTICE
- [ ] Confirm AI-assisted commits in `open-editor` do not block the chosen copyright line
- [ ] Optional counsel note on patents (Apache-2.0 was the fallback if patent grant is desired; **MIT is owner-selected**)
- [ ] Written confirmation stored outside this checklist (ticket/email) before license application

Until every required box is checked, D19 stays **CHAIN-OF-TITLE — OWNER/LEGAL CONFIRMATION REQUIRED**.

## Relation to other gates

| Gate | Relation |
| --- | --- |
| D2 | MIT is **OWNER-SELECTED** but must not be applied until D19 (and D3) are satisfied |
| D3 | Copyright line content — **COPYRIGHT HOLDER — OWNER ACTION REQUIRED** |
| D1-EXEC | Even after D19, public execution needs separate written authorization |

## What this phase did not do

Did not edit `hello-ai-company/personal-ai`. Did not apply MIT. Did not invent a legal name. Did not treat GitHub org slug as a copyright holder.
