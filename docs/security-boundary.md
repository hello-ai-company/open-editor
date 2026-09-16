# Security boundary

`@hello-ai-company/editor-core` is a host-neutral document seam. The published tarball must contain only `package.json`, `LICENSE`, `README.md`, and `dist/` JavaScript / declaration / map files for that seam.

This document is a **tarball / host-leakage** boundary, not a vulnerability disclosure policy. Disclosure: [SECURITY.md](../SECURITY.md).

## Must NEVER enter the package

| Class | Examples |
| --- | --- |
| Other-product identifiers | `personal-ai`, `Secretary`, `AgentTask`, `__PAI_` |
| Host UI / native chrome | `WKWebView`, `NoteRichEditor`, `openEmployees`, `openAIEmployees`, `openStyleGallery`, `setDocumentStyle` |
| Host adapters / sync | `noteBlockSync`, `editorAdapters` |
| Backend / data plane | `Supabase`, `/api/v1`, `LIGHTSAIL` |
| Editor UI frameworks | `@blocknote`, React imports |
| Secrets | `SUPABASE_JWT_SECRET`, `github_pat_`, `ghp_…`, AWS keys, `.env` files |
| Workspace junk | `src/` TypeScript, tests, `node_modules`, git metadata, tsconfig |

Host workforce or document-chrome actions map through `NativeBridge.hostRequest` / `hostResponse`. They are not first-class core methods.

## What may ship

- Document model, `JsonValue`, schema version `1`
- JSON serialize / deserialize
- Optional provider **types** (no implementations, no network clients)
- MIT `LICENSE` with `Copyright (c) 2026 Yuki Shibata`
- Package `README.md`
- Relative source maps (`../src/*.ts`) without private absolute paths and without `sourcesContent` from a private checkout

## Gates

- `scripts/security-scan.mjs` scans `packages/core/src`, `packages/core/dist` when present, and tarball contents
- `scripts/inspect-tarball.mjs` enforces allowlist, denylist, identity lock, leakage, and private path checks
- `packages/core/test/dependency-boundary.test.ts` allowlists provider methods from `packages/core/contracts/provider-contract.json`
