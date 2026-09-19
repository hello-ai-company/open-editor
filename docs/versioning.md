# Versioning and compatibility

Policy for `@hello-ai-company/editor-core` (MIT, npmjs). This document does **not** authorize npm publish, tags, or GitHub Releases.

## Current identity

| Field | Value |
| --- | --- |
| Name | `@hello-ai-company/editor-core` |
| Workspace / candidate version | `0.1.1` (**not published** in R1) |
| Published on npmjs (immutable) | `0.1.0` — do **not** republish |
| License | MIT |
| Registry | `https://registry.npmjs.org` |
| Access | public |
| Document `schemaVersion` | `1` |

`0.1.1` is an **additive** candidate over published `0.1.0` (database/relation provider APIs used by `@hello-ai-company/editor-blocknote`). Publish order when authorized: **core `0.1.1` → blocknote `0.1.0`**. R1 does **not** publish.

The historical private GitHub Packages prerelease `0.0.0-phase3.e17b4b5` is **immutable** and must not be reused on npmjs.

## Two version layers

1. **Package version** — JavaScript/TypeScript export contract.
2. **Document `schemaVersion`** — persisted JSON shape. Currently the positive integer `1` only.

A package bump without a schema bump is possible. Introducing `schemaVersion: 2` is a separate, breaking document-format event.

## Supported runtimes

- Node `>=20` (`engines` in the workspace and the package).
- CI verifies Node 20 and Node 22.
- Module format: ESM only. No CommonJS export. No subpath exports unless an isolated tarball consumer later proves a need.

## Additive vs breaking

**Additive** (patch/minor on the public 0.x line):

- New optional provider methods or optional `EditorProviders` keys
- New type-only exports
- New runtime helpers only after updating `packages/core/contracts/public-api.json`
- New block `type` strings and extra `props` / `content` keys (`JsonValue`)
- Documentation and CI-only changes

**Breaking** (future major):

- Removing or renaming exports; changing function signatures
- Changing `EDITOR_DOCUMENT_SCHEMA_VERSION` or accepting schema `2` without a migration story
- Making optional provider methods required
- Tightening deserialize so previously valid payloads fail (including unknown block types)
- Adding runtime dependencies
- Adding CJS / subpaths that split the public contract
- Removing the legacy deserialize behavior that defaults a missing `schemaVersion` to `1`

## editor-blocknote floor

`@hello-ai-company/editor-blocknote` depends on `@hello-ai-company/editor-core` **`^0.1.1`**. Published `0.1.0` lacks APIs required by the BlockNote power layer (`withRelationEdgeId`, `DatabaseFilter`, `EditorDatabase`, …). Registry-realistic consumers must not resolve `0.1.0` for blocknote installs.

## Document JSON

- Unknown block types MUST round-trip.
- Unsupported `schemaVersion` MUST throw `EditorDocumentSerializationError`.
- Missing `schemaVersion` defaults to `1`. Removing that default would be breaking.
- `serialize(deserialize(serialize(doc)))` is byte-stable after normalize (empty `props` / `children` stripped).
- Canonical key order across equivalent objects is **not** guaranteed. Semantic equality after deserialize is the compatibility promise.

## Provider evolution

All provider methods stay optional. Host-specific actions belong on `NativeBridge.hostRequest` / `hostResponse` with `JsonValue` payloads. New host verbs must not appear as first-class methods (`openEmployees` and the rest of the forbidden list).
