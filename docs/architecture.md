# Architecture

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

`@hello-ai-company/editor-core` is a host-neutral document seam. It describes typed block trees, JSON serialization, and optional provider contracts. It does not render UI, talk to a backend, or import host application modules.

## Package surface

| Module | Responsibility |
| --- | --- |
| `src/model.ts` | `EditorDocument` / `EditorBlock` / `JsonValue` and schema-version guards |
| `src/serialization.ts` | JSON encode/decode with schema and block validation |
| `src/providers.ts` | Optional host seams (`AIProvider`, database, comments, versions, assets, pages, `NativeBridge`) |
| `src/index.ts` | Public runtime and type exports |

## Invariants

- Production sources stay inside `packages/core/src`.
- No React, BlockNote, XL, CSS, Swift, or host adapters.
- `schemaVersion` is the positive integer `1` only.
- Document props and content are `JsonValue`.
- Providers are optional. A consumer can hold a document with zero integrations.
- Native host I/O is generic: `ready` / `change` / `commit` / `error` / `hostRequest` / `hostResponse`.

## OSS product direction (Phase 4D.1 — record only)

Public shape: a **portable document layer** as **Small Core + Adapters + Docs + Examples**.

- **Small Core** is this package (document + serialization + optional provider types).
- **Adapters** (including any future BlockNote adapter) are separate packages, not created here.
- **Docs + Examples** are later public-facing material.

This phase does **not** add adapter packages and does **not** change the frozen core API.

## Non-goals (Phase 2; still true)

- BlockNote or any editor UI
- Host note adapters, domain models, or REST clients
- npm publish, public visibility, tags, or releases
