# Chain-of-title evidence (Phase 4D / 4D.1)

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

**Case:** ENG-20260913-007 Phase 4D.1 / PA-20260917-001  
**Role:** Engineering provenance audit plus Phase 4D.1 owner confirmation. **Not legal advice.**  
**This document does not relicense anything.**

Gate **D19** classification: **CLOSED** — owner Yuki Shibata confirms relicensing authority under MIT (**owner representation, not legal advice**).

## Verdict

| Layer | Result |
| --- | --- |
| Engineering provenance of this extract | **ENGINEERING EVIDENCE SUPPORTS** an internal, documented extract into a fresh-history private repository with **zero** production third-party source in `packages/core/src/**` |
| Owner confirmation to relicense as MIT | **CLOSED** — Yuki Shibata (owner representation) |
| Legal advice / counsel memo | **Not claimed** |
| D19 gate | **CLOSED** (confirmation). MIT still **not applied** |

Owner confirmation is **not** a license, assignment, or CLA. Do not apply MIT in this phase.

## What was examined

| Source | Result |
| --- | --- |
| This repository git history | Fresh history only. Root commit `5644d14548641179de281e38a1d9219a38caa80f` (2026-09-13). No `git filter-repo` / subtree import of `personal-ai`. |
| Documented extract | [extraction-status.md](./extraction-status.md): source repo `hello-ai-company/personal-ai` (read-only; **do not edit**); original extract SHA `b29c4df72c59244523f29dd5949d35f6882048ff`; approved `apps/web/src/editorCore/*` paths only |
| `packages/core/src/**` | Four first-party modules (`index.ts`, `model.ts`, `serialization.ts`, `providers.ts`). Intra-package imports only. No SPDX/copyright headers. No vendored third-party snippets. |
| Production dependencies | None ([third-party-license-inventory.md](./third-party-license-inventory.md)) |
| Published tarball allowlist | `package.json`, `LICENSE`, `dist/*` only |
| `LICENSE` / `packages/core/LICENSE` | Proprietary `UNLICENSED`. Copyright line **not written in** (D3 recorded separately). |
| GitHub org `hello-ai-company` | `login` only. `name`, `email`, `company`, `blog` empty. `is_verified`: false. |
| `hello-ai-company/personal-ai` from the Phase 4D auditor | **Inaccessible** (GitHub API 404 with those credentials). Source LICENSE, authors, and commit `b29c4df…` could **not** be re-verified there. |
| Assignment / work-for-hire / CLA / DCO | **None found** in this repository |

## Authors present in *this* repository (not a legal conclusion)

`git shortlog -sne --all` on `open-editor` (Phase 4D snapshot):

| Commits (approx.) | Author |
| --- | --- |
| 9 | Cursor Agent `<cursoragent@cursor.com>` |
| 6 | yuki-s-code `<68765118+yuki-s-code@users.noreply.github.com>` |

These are git identities, not a copyright holder of record by themselves. Phase 4D.1 records the owner-confirmed copyright line as `Copyright (c) 2026 Yuki Shibata` (not written into `LICENSE`).

## What engineering evidence supports

1. This workspace was created as a **private extraction** (`README.md` banners; Phase 2 commit `e17b4b589b5784753e91a8bb4d69b44b46342418`).
2. Workspace docs list a closed, approved file set from `personal-ai` `editorCore` (no claim that other product code was copied).
3. Core source has no runtime npm dependencies and no third-party license files inside `src/`.
4. Host product identifiers are gated out of the tarball (`docs/security-boundary.md`, `scripts/security-scan.mjs`).
5. Same GitHub *org slug* is documented as owning both `open-editor` and `personal-ai`. That is **org membership branding**, not a deed of title.

## What engineering evidence does not prove

1. A registered company legal name (jurisdiction, entity type). D3 names an **individual**: Yuki Shibata.
2. Patent non-encumbrance.
3. Current contents and license of `personal-ai` (not re-verified from this auditor).
4. That a law firm reviewed the extract.

## D3 copyright line (CLOSED; not in LICENSE)

Recorded for later MIT application. **DO NOT write into `LICENSE` or `packages/core/LICENSE` in Phase 4D.1.**

```
Copyright (c) 2026 Yuki Shibata
```

## Owner confirmation checklist (Phase 4D.1)

Checked by the **owner** as representation, not by counsel:

- [x] Confirm the **name** that will appear in MIT `LICENSE` files — **Yuki Shibata**
- [x] Confirm the **copyright year** — **2026**
- [x] Confirm that person **owns or is exclusively licensed** the `personal-ai` `editorCore` extract listed in [extraction-status.md](./extraction-status.md)
- [x] Confirm that person **may relicense** that extract as **MIT** to the public
- [x] Confirm no third-party or employee/contractor claim requires extra permission or NOTICE — **owner representation**
- [x] Confirm AI-assisted commits in `open-editor` do not block the chosen copyright line — **owner representation**
- [ ] Optional counsel note on patents (Apache-2.0 remains the documented fallback; **MIT is owner-selected**) — **not obtained; not required to close D19 as owner representation**
- [x] Written confirmation stored in [owner-release-confirmations.md](./owner-release-confirmations.md)

D19 is **CLOSED** as an owner-confirmation gate. It is **not** legal advice.

## Relation to other gates

| Gate | Relation |
| --- | --- |
| D2 | MIT is **OWNER-SELECTED** but must not be applied until a later authorized identity-change phase |
| D3 | Copyright line **CLOSED** — `Copyright (c) 2026 Yuki Shibata` — **not in LICENSE** |
| D1-EXEC | Even after D19, public execution needs separate written authorization |

## What this phase did not do

Did not edit `hello-ai-company/personal-ai`. Did not apply MIT. Did not write the copyright line into `LICENSE`. Did not treat GitHub org slug as a copyright holder.
