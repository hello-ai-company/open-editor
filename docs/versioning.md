# Versioning and compatibility

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

This is a future-facing policy for `@hello-ai-company/editor-core`. It does **not** bump the current package version and does **not** authorize publish, tags, or Releases.

## Current identity (frozen)

| Field | Value | Change in this phase |
| --- | --- | --- |
| Name | `@hello-ai-company/editor-core` | NO |
| Version | `0.0.0-phase3.e17b4b5` | NO |
| License | `UNLICENSED` | NO |
| Registry | `https://npm.pkg.github.com` | NO |
| Visibility | PRIVATE | NO |
| Document `schemaVersion` | `1` | NO |

## Two version layers

1. **Package version** — JavaScript/TypeScript export contract.
2. **Document `schemaVersion`** — persisted JSON shape. Currently the positive integer `1` only.

A package bump without a schema bump is possible in a later authorized phase. Introducing `schemaVersion: 2` is a separate, breaking document-format event and is not authorized here.

## Supported runtimes

- Node `>=20` (`engines` in the workspace and the package).
- CI verifies Node 20 and Node 22.
- Module format: ESM only. No CommonJS export. No subpath exports unless an isolated tarball consumer later proves a need.

## Additive vs breaking (after this freeze)

**Additive** (would be a future minor/patch if publishing were authorized):

- New optional provider methods or optional `EditorProviders` keys
- New type-only exports
- New runtime helpers only after updating `packages/core/contracts/public-api.json`
- New block `type` strings and extra `props` / `content` keys (`JsonValue`)
- Documentation and CI-only changes

**Breaking** (future major / new phase):

- Changing name, version string, license, registry, or visibility
- Changing `EDITOR_DOCUMENT_SCHEMA_VERSION` or accepting schema `2` without a migration story
- Removing or renaming exports; changing function signatures
- Making optional provider methods required
- Tightening deserialize so previously valid payloads fail (including unknown block types)
- Adding runtime dependencies
- Adding CJS / subpaths that split the public contract
- Removing the legacy deserialize behavior that defaults a missing `schemaVersion` to `1`

## Document JSON

- Unknown block types MUST round-trip.
- Unsupported `schemaVersion` MUST throw `EditorDocumentSerializationError`.
- Missing `schemaVersion` defaults to `1`. Removing that default would be breaking.
- `serialize(deserialize(serialize(doc)))` is byte-stable after normalize (empty `props` / `children` stripped).
- Canonical key order across equivalent objects is **not** guaranteed. Semantic equality after deserialize is the compatibility promise.

## Provider evolution

All provider methods stay optional. Host-specific actions belong on `NativeBridge.hostRequest` / `hostResponse` with `JsonValue` payloads. New host verbs must not appear as first-class methods (`openEmployees` and the rest of the forbidden list).

## Prerelease channel (future)

If a later authorized private publish happens, keep immutable published versions. Do not reuse `0.0.0-phase3.e17b4b5`. A future identifier would be a new prerelease such as `0.0.0-phaseN.<sha>` only after human approval. This document does not select that identifier.
