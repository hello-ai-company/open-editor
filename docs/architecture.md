# Architecture

`@hello-ai-company/editor-core` is a host-neutral document seam. It describes typed block trees, JSON serialization, and optional provider contracts. It does not render UI, talk to a backend, or import host application modules.

Public shape: a **portable document layer** as **Small Core + Adapters + Docs + Examples**. This package is the Small Core. Adapters (including any future BlockNote adapter) are separate packages, not shipped in v0.1.0.

## Package surface

| Module | Responsibility |
| --- | --- |
| `src/model.ts` | `EditorDocument` / `EditorBlock` / `JsonValue` and schema-version guards |
| `src/serialization.ts` | JSON encode/decode with schema and block validation |
| `src/providers.ts` | Optional host seams (`AIProvider`, database, comments, versions, assets, pages, `NativeBridge`) |
| `src/index.ts` | Public runtime and type exports |

## Invariants

- Production sources stay inside `packages/core/src`.
- No React, BlockNote, XL, CSS, Swift, or host adapters in this package.
- `schemaVersion` is the positive integer `1` only.
- Document props and content are `JsonValue`.
- Providers are optional. A consumer can hold a document with zero integrations.
- Native host I/O is generic: `ready` / `change` / `commit` / `error` / `hostRequest` / `hostResponse`.

## Non-goals (v0.1.0)

- Shipping an editor UI
- Host note adapters, domain models, or REST clients
- Paid Cloud / Enterprise SKUs
