# Extraction status

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

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
| Ticket | ENG-20260913-007 Phase 4D / PA-20260916-004 |

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

## Phase 3 private package

- Identity: `@hello-ai-company/editor-core@0.0.0-phase3.e17b4b5`
- Registry: `https://npm.pkg.github.com`
- License: `UNLICENSED`

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
- D3 / D6 / D11 / D19 classified honestly and **not** closed
- D1-EXEC **PENDING EXECUTION AUTHORIZATION**
- Companions: `docs/release-gate-closure.md`, `docs/chain-of-title-evidence.md`, `docs/npm-publication-readiness.md`, `docs/security-release-gate.md`, `docs/public-release-change-map.md`
- **CORE SOURCE CHANGE REQUIRED: NO**
- **Not** a public OSS release. No FUNDING.yml, no Sponsors, no LICENSE file changes, no npm register, no security-setting changes.

## History

This repository has fresh history only. The source repository was not imported as git history.

## Publish / visibility

Not authorized for public release, npmjs publish, tags, GitHub Releases, or merging a public release. Manual private GitHub Packages publish remains `workflow_dispatch` only and is not triggered by Phase 4D docs.

## Gate results (local)

| Gate | Result |
| --- | --- |
| `npm ci` | PASS |
| typecheck | PASS |
| unit tests | PASS |
| build (`dist` + `.d.ts`) | PASS |
| `npm pack` | PASS (`hello-ai-company-editor-core-0.0.0-phase3.e17b4b5.tgz`) |
| tarball inspect (allowlist / denylist / no host leakage) | PASS |
| isolated consumer install + typecheck + runtime | PASS |
| API contract (installed tarball) | PASS |
| security scan (`src` + `dist` + tarball) | PASS (0 production vulnerabilities) |
| git history | fresh only: Initial commit → baseline → Phase 2 extract → Phase 3 publish prep → Phase 4A readiness → Phase 4B decision package → Phase 4C OSS policy → Phase 4D gate closure (docs) |
