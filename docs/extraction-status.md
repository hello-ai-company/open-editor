# Extraction status

**INTERNAL EVIDENCE** — not a public product document. Provenance and phase log. Current prepared identity: `@hello-ai-company/editor-core@0.1.0` MIT on npmjs (not published; repo PRIVATE).

## Provenance

| Item | Value |
| --- | --- |
| Target repo | `hello-ai-company/open-editor` (PRIVATE) |
| Source repo | `hello-ai-company/personal-ai` (read-only; **do not edit**) |
| Original extract SHA | `b29c4df72c59244523f29dd5949d35f6882048ff` |
| Source branch (at extract time) | `grokbot/phase-1-editor-oss-boundary-foundation` @ same SHA |
| Personal AI consumer baseline | `c2bd73f80ddb2752215acc01d78d26322068fcae` |
| Personal AI migration | **Done** (consumer uses published `@hello-ai-company/editor-core`; this repo does not modify personal-ai) |
| Local `editorCore` | **Retired** (SoT is `packages/core` in this private workspace) |
| Ticket | ENG-20260913-007 Phase 4D.1 / PA-20260917-001 |

Approved source files only (original extract):

- `apps/web/src/editorCore/model.ts`
- `apps/web/src/editorCore/serialization.ts`
- `apps/web/src/editorCore/providers.ts`
- `apps/web/src/editorCore/index.ts`
- `apps/web/src/editorCore/__tests__/model.test.ts`
- `apps/web/src/editorCore/__tests__/serialization.test.ts`
- `apps/web/src/editorCore/__tests__/dependencyBoundary.test.ts`

## Phase 1 R1 preserved

- No `openEmployees` (or other forbidden host methods)
- `NativeBridge` = `ready` / `change` / `commit` / `error` / `hostRequest` / `hostResponse` only
- `JsonValue` for document props/content and bridge payloads
- Provider method allowlist

## Phase 2 hardening

- `schemaVersion` must be the positive integer `1` (reject `-1`, `0`, `1.5`, `2`)
- Allowlist parsing uses TypeScript AST plus `method?(` / `method?:` / `method()` patterns

## Phase 3 private package (historical)

- Identity: `@hello-ai-company/editor-core@0.0.0-phase3.e17b4b5`
- Registry: `https://npm.pkg.github.com`
- License: `UNLICENSED` (superseded in Phase 4E; version remains immutable on GitHub Packages)

## Phase 4A private release-readiness

- Public API freeze documented and machine-verified from the installed tarball
- Provider contract lives in `packages/core/contracts/provider-contract.json`
- Isolated consumer typechecks and executes create / serialize / deserialize
- Tarball allowlist / denylist and src+dist+tarball security scan
- **Not** a public OSS release. No version bump, tag, Release, license **application**, or visibility change.

## Phase 4C owner OSS policy (docs only)

- Recorded OWNER-CONFIRMED free-OSS + optional-sponsorship philosophy (`docs/owner-oss-policy.md`)
- License **recommendation** only at that time: PRIMARY MIT / FALLBACK Apache-2.0 — **not applied**

## Phase 4D release-gate closure (docs only)

- OWNER-SELECTED FUTURE LICENSE = **MIT**; **APPLIED TO LICENSE FILES NO**
- D3 / D6 / D11 / D19 classified honestly and **not** closed at that time
- D1-EXEC **PENDING EXECUTION AUTHORIZATION**
- Companions: `docs/release-gate-closure.md`, `docs/chain-of-title-evidence.md`, `docs/npm-publication-readiness.md`, `docs/security-release-gate.md`, `docs/public-release-change-map.md`
- **CORE SOURCE CHANGE REQUIRED: NO**
- **Not** a public OSS release. No FUNDING.yml, no Sponsors, no LICENSE file changes, no npm register, no security-setting changes.

## Phase 4D.1 owner gate confirmation (docs only)

- D2/D3/D6/D19 **CLOSED**; D11 **PREPARED** (enable GitHub PVR during public transition); D1-EXEC **PENDING EXECUTION AUTHORIZATION**
- Copyright line recorded: `Copyright (c) 2026 Yuki Shibata` — **not written into LICENSE**
- npm org `hello-ai-company` owner-confirmed — **no npm mutations**
- OSS product direction: portable document layer; Small Core + Adapters + Docs + Examples — **no adapter packages, no core API change**
- Classification: **READY FOR PUBLIC RELEASE PREPARATION** / **not READY TO PUBLISH NOW**
- Companion: `docs/owner-release-confirmations.md`
- **Not** a public OSS release. No FUNDING.yml, no LICENSE file changes, no npm register, no PVR enablement.

## Phase 4E public release preparation

- Public-exposure audit: [public-exposure-audit.md](./public-exposure-audit.md) — P1 none; P2 historical UNLICENSED / phase IDs
- MIT applied: root `LICENSE` + `packages/core/LICENSE` with `Copyright (c) 2026 Yuki Shibata`
- Package identity: `@hello-ai-company/editor-core@0.1.0`, `publishConfig` npmjs + public
- Root workspace remains `"private": true`
- Public README / `packages/core/README.md` / CONTRIBUTING / SECURITY / CODEOWNERS
- Private GH Packages publish workflow retired; `public-release-preflight.yml` is non-publishing (dry-run only)
- **CORE SOURCE CHANGE REQUIRED: NO** — `packages/core/src/**` not modified
- **Did not:** make PUBLIC; real npm publish; tag; Release; enable PVR; create npm tokens; start Phase 4F

## History

This repository has fresh history only. The source repository was not imported as git history.

## Publish / visibility

Repository remains PRIVATE. npmjs publish, tags, and GitHub Releases are **not** authorized in Phase 4E. The private GitHub Packages publish workflow is retired; do not unpublish `0.0.0-phase3.e17b4b5`. Active non-publishing gate: `.github/workflows/public-release-preflight.yml` (dry-run only).

## Gate results (local)

| Gate | Result |
| --- | --- |
| `npm ci` | PASS |
| typecheck | PASS |
| unit tests | PASS |
| build (`dist` + `.d.ts`) | PASS |
| `npm pack` | PASS (`hello-ai-company-editor-core-0.1.0.tgz`) |
| tarball inspect (allowlist / denylist / no host leakage) | PASS |
| isolated consumer install + typecheck + runtime | PASS |
| API contract (installed tarball) | PASS |
| security scan (`src` + `dist` + tarball) | PASS (0 production vulnerabilities) |
| git history | fresh only: Initial commit → baseline → Phase 2 extract → Phase 3 publish prep → Phase 4A readiness → Phase 4B decision package → Phase 4C OSS policy → Phase 4D gate closure (docs) → Phase 4D.1 owner confirmations (docs) |
