# Extraction status

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

## Provenance

| Item | Value |
| --- | --- |
| Target repo | `hello-ai-company/open-editor` (PRIVATE) |
| Source repo | `hello-ai-company/personal-ai` (read-only) |
| Source SHA | `b29c4df72c59244523f29dd5949d35f6882048ff` |
| Source branch (at extract time) | `grokbot/phase-1-editor-oss-boundary-foundation` @ same SHA |
| Ticket | ENG-20260913-006 Phase 2 |

Approved source files only:

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

## History

This repository has fresh history only. The source repository was not imported as git history.

## Publish / visibility

Not authorized for public release, npm publish, tags, or a public PR.

## Gate results (local)

| Gate | Result |
| --- | --- |
| `npm ci` | PASS |
| typecheck | PASS |
| unit tests (14) | PASS |
| build (`dist` + `.d.ts`) | PASS |
| `npm pack` | PASS (`hello-ai-editor-core-0.0.0-private.tgz`) |
| tarball inspect (no host leakage) | PASS |
| isolated consumer install + typecheck | PASS |
| security scan (`packages/core/src` + `npm audit --omit=dev`) | PASS (0 production vulnerabilities) |
| git history | fresh only: Initial commit → baseline → Phase 2 extract |
