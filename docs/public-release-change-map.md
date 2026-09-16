# Public release change map (future prep only)

**INTERNAL EVIDENCE** — not a public product document. Historical file map. Phase 4E executed the license/identity/docs/CI prep rows; not visibility/publish/tag.

**Case:** ENG-20260913-007 Phase 4D.1 / PA-20260917-001  
**Role:** List files a **later** authorized phase would touch. **Do not execute.** Phase 4D.1 changes documentation/policy only.

## CORE SOURCE CHANGE REQUIRED: NO

`packages/core/src/**` does **not** need edits to apply MIT, name a copyright holder, enable GitHub PVR, own an npm scope, or publish the **already frozen** public API.

No gap was proven that would require changing document/serialization/provider TypeScript for gate closure. Identity, license text, banners, and registry live **outside** `src/`.

Do not modify `packages/core/src/**` in Phase 4D.1. Do not modify it for “release polish” unless a later phase proves **CORE SOURCE CHANGE REQUIRED: YES**. No adapter packages.

## Frozen identity (must stay until a later identity-change phase)

| Lock | File |
| --- | --- |
| Name / version / license / registry | `packages/core/package.json` |
| Workspace license / scripts | `package.json` (root) |
| Lockfile | `package-lock.json` |
| `AUTHORIZED_*` | `scripts/lib/tarball.mjs` |
| Pack inspect | `scripts/inspect-tarball.mjs` |
| Publish gate tests | `packages/core/test/publish-gate.test.ts` |
| Private publish workflow | `.github/workflows/publish-private-core.yml` |
| Proprietary license text | `LICENSE`, `packages/core/LICENSE` |

Phase 4D.1 **must not** change those files.

## Future file map (after owner gates + written D1-EXEC)

Order is in [public-release-runbook.md](./public-release-runbook.md). **Do not make the repository public while `UNLICENSED`.**

### A. License application (D2 already selected MIT; D3/D19 confirmations recorded; still not applied)

| Path | Future change |
| --- | --- |
| `LICENSE` | Replace UNLICENSED text with MIT + `Copyright (c) 2026 Yuki Shibata` |
| `packages/core/LICENSE` | Same (this file **ships in the tarball**) |
| `package.json` `"license"` | `MIT` |
| `packages/core/package.json` `"license"` | `MIT` |
| `package-lock.json` | Metadata follow-through only |
| `scripts/lib/tarball.mjs` | `AUTHORIZED_LICENSE = "MIT"` |
| `scripts/inspect-tarball.mjs` / isolated-consumer / publish-gate | Assert MIT instead of UNLICENSED |
| Root `README.md` | Stop claiming UNLICENSED **after** files actually change |
| Docs banners | Align with applied MIT |

### B. First public version + registry (D6 owner-confirmed; D7/D8 still PENDING)

| Path | Future change |
| --- | --- |
| `packages/core/package.json` `version` | **Not** `0.0.0-phase3.e17b4b5`; recommended `0.1.0` |
| `packages/core/package.json` `publishConfig` | npmjs only if D7 selects npmjs |
| `scripts/lib/tarball.mjs` | `AUTHORIZED_VERSION` / `AUTHORIZED_REGISTRY` |
| `packages/core/contracts/*.json` | Version field if they echo package version |
| `.github/workflows/publish-private-core.yml` or a **new** dispatch workflow | Human-gated public publish; no auto-publish on push |

### C. Disclosure and community files (D11 PREPARED; enable PVR during public transition)

| Path | Future change |
| --- | --- |
| Root `SECURITY.md` | Promote draft **after** GitHub PVR is enabled |
| `docs/public-drafts/SECURITY.md` | Source draft |
| `.github/CODEOWNERS` | After D12 names exist |
| `CONTRIBUTING.md`, CoC, issue/PR templates | After D17 / D4 |

### D. Visibility and distribution (D1-EXEC + D9 + D18)

| Action | In-repo files vs GitHub/npm settings |
| --- | --- |
| Make repository public | GitHub setting — **after** MIT is applied |
| npmjs publish | Registry — new version only |
| Git tag / GitHub Release | After the public version exists |
| `.github/FUNDING.yml` | Only with a real owner URL (D26) — still **SPONSOR LINK — OWNER SETUP REQUIRED** |

### E. Out of scope forever from this repo

| Path / repo | Rule |
| --- | --- |
| `hello-ai-company/personal-ai` | **Do not edit** from `open-editor` |
| Secrets, OIDC npm tokens, branch protection | Owner/ops in GitHub UI; not this docs phase |

## Phase 4D.1 allowed surface

| Path | Role now |
| --- | --- |
| `docs/**` | Owner confirmation + gate-closure records |
| Root `README.md` | Links to new docs; **private warnings intact** |

If a later diff includes `packages/core/src/**`, `LICENSE`, package identity, lockfile, or workflows, that is a **STOP — PHASE 4D.1 SCOPE VIOLATION**.
