# Versioning and compatibility

Policy for `@hello-ai-company/editor-core` (MIT, npmjs). This document does **not** authorize npm publish, tags, or GitHub Releases.

## Current identity

| Field | Value |
| --- | --- |
| Name | `@hello-ai-company/editor-core` |
| Workspace / candidate version | `0.2.0` (local candidate; not published) |
| Published on npmjs (immutable) | `0.1.0`, `0.1.1` — do **not** republish |
| License | MIT |
| Registry | `https://registry.npmjs.org` |
| Access | public |
| Document `schemaVersion` | `1` |

`0.1.1` is an **additive** release over published `0.1.0` (database/relation provider APIs used by `@hello-ai-company/editor-blocknote`).

The five 0.2.0 candidates contain unpublished runtime changes relative to their
integrity-verified npm baselines. Core's bounded creation/cloning validation may
reject formerly valid large values. Before 1.0, the minor boundary is the explicit
compatibility boundary: ^0.1.x does not select 0.2.0. Once stable 1.x is declared,
incompatible changes require a major bump. See [migration](migration-0.2.md) and
[release runbook](public-release-runbook.md). Package version changes do not
rewrite saved documents or authorize publication.

## Two version layers

1. **Package version** — JavaScript/TypeScript export contract.
2. **Document `schemaVersion`** — persisted JSON shape. Currently the positive integer `1` only.

A package bump without a schema bump is possible. Introducing `schemaVersion: 2` is a separate, breaking document-format event.

## Supported runtimes

- Node `>=20` (`engines` in the workspace and the package).
- CI preflight is configured for Node 20 and Node 22; hosted checks on the final
  reviewed main SHA remain required before release.
- Module format: ESM only. No CommonJS export. No subpath exports unless an isolated tarball consumer later proves a need.

## Additive vs breaking

**Additive** (patch/minor on the public 0.x line):

- New optional provider methods or optional `EditorProviders` keys
- New type-only exports
- New runtime helpers only after updating `packages/core/contracts/public-api.json`
- New block `type` strings and extra `props` / `content` keys (`JsonValue`)
- Documentation and CI-only changes

**Breaking** (0.x minor compatibility boundary; stable 1.x major):

- Removing or renaming exports; changing function signatures
- Changing `EDITOR_DOCUMENT_SCHEMA_VERSION` or accepting schema `2` without a migration story
- Making optional provider methods required
- Tightening deserialize so previously valid payloads fail (including unknown block types)
- Adding runtime dependencies
- Adding CJS / subpaths that split the public contract
- Removing the legacy deserialize behavior that defaults a missing `schemaVersion` to `1`

## Internal dependency floors and consumer gates

The 0.2.0 line requires editor-core ^0.2.0; Publish also requires Canvas ^0.2.0.
BlockNote peers remain ^0.54.2, and optional modules remain optional. Runtime and
type exports are checked against installed candidate tarballs without --force or
--legacy-peer-deps. Local preparation uses candidate dependencies; actual release
guards require exact core/Canvas 0.2.0 already live in dependency order. Do not
mistake local install success for registry publication evidence.

## Document JSON

- Unknown block types MUST round-trip.
- Unsupported `schemaVersion` MUST throw `EditorDocumentSerializationError`.
- Missing `schemaVersion` defaults to `1`. Removing that default would be breaking.
- `serialize(deserialize(serialize(doc)))` is byte-stable after normalize (empty `props` / `children` stripped).
- Canonical key order across equivalent objects is **not** guaranteed. Semantic equality after deserialize is the compatibility promise.

## Provider evolution

All provider methods stay optional. Host-specific actions belong on `NativeBridge.hostRequest` / `hostResponse` with `JsonValue` payloads. New host verbs must not appear as first-class methods (`openEmployees` and the rest of the forbidden list).
