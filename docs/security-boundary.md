# Security boundary

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

`@hello-ai-company/editor-core` is a host-neutral document seam. The published tarball must contain only `package.json`, `LICENSE`, and `dist/` JavaScript / declaration / map files for that seam.

## Must NEVER enter the package

| Class | Examples |
| --- | --- |
| Personal AI product identifiers | `personal-ai`, `Personal AI`, `Secretary`, `AgentTask`, `__PAI_` |
| Host UI / native chrome | `WKWebView`, `NoteRichEditor`, `openEmployees`, `openAIEmployees`, `openStyleGallery`, `setDocumentStyle` |
| Host adapters / sync | `noteBlockSync`, `editorAdapters` |
| Backend / data plane | `Supabase`, `/api/v1`, `LIGHTSAIL` |
| Editor UI frameworks | `@blocknote`, React imports |
| Secrets | `SUPABASE_JWT_SECRET`, `github_pat_`, `ghp_…`, AWS keys, `.env` files |
| Workspace junk | `src/` TypeScript, tests, `node_modules`, git metadata, README, tsconfig |

Host workforce or document-chrome actions map through `NativeBridge.hostRequest` / `hostResponse`. They are not first-class core methods.

## What may ship

- Document model, `JsonValue`, schema version `1`
- JSON serialize / deserialize
- Optional provider **types** (no implementations, no network clients)
- `UNLICENSED` license file
- Relative source maps (`../src/*.ts`) without private absolute paths and without `sourcesContent` from a private checkout

## Gates

- `scripts/security-scan.mjs` scans `packages/core/src`, `packages/core/dist` when present, and tarball contents
- `scripts/inspect-tarball.mjs` enforces allowlist, denylist, identity lock, leakage, and private path checks
- `packages/core/test/dependency-boundary.test.ts` allowlists provider methods from `packages/core/contracts/provider-contract.json`

Provenance mentions of `hello-ai-company/personal-ai` belong in **workspace docs only**, never in `packages/core/src` or the packed tarball.
