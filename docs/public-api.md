# Public API freeze

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

This document freezes the current `@hello-ai-company/editor-core` public surface at identity `0.0.0-phase3.e17b4b5` (UNLICENSED, GitHub Packages). It is a private contract, not a public OSS API announcement.

Canonical machine copy: `packages/core/contracts/public-api.json` and `packages/core/contracts/provider-contract.json`.

Entry: `"."` only (`types` + `import`). No CommonJS `require` condition. No subpath exports.

## Runtime exports

Kind: runtime. Stability: **stable** for this freeze. Compatibility: additive optional helpers would require an explicit contract update; removals or signature changes are breaking.

| Name | Kind | Purpose | Stability | Compatibility |
| --- | --- | --- | --- | --- |
| `EDITOR_DOCUMENT_SCHEMA_VERSION` | runtime | Canonical document schema version constant (`1`) | stable | Changing the numeric value is breaking |
| `createEditorDocument` | runtime | Factory; validates schema version and deep-clones blocks | stable | Default schema argument stays `1` |
| `serializeEditorDocument` | runtime | `EditorDocument` → JSON string | stable | Wire format for schema `1` |
| `deserializeEditorDocument` | runtime | JSON string → `EditorDocument`; throws `EditorDocumentSerializationError` | stable | Missing `schemaVersion` still defaults to `1` |
| `toSerializedEditorDocument` | runtime | `EditorDocument` → plain `{ schemaVersion, blocks }` object | stable | Empty `props` / `children` are normalized away |
| `fromSerializedEditorDocument` | runtime | `unknown` → `EditorDocument` with schema/block validation | stable | Same schema rules as deserialize |
| `isJsonValue` | runtime | Type guard for recursive JSON values | stable | Rejects `NaN`, functions, `undefined` |
| `isEditorBlock` | runtime | Type guard for extensible blocks | stable | Unknown `type` strings remain valid |
| `isEditorDocument` | runtime | Type guard for versioned documents | stable | Only schema `1` |
| `isSupportedSchemaVersion` | runtime | Guard: only the positive integer `1` | stable | `-1`, `0`, `1.5`, `2` remain invalid |
| `cloneEditorBlock` | runtime | Deep-clone one block | stable | Mutation isolation helper |
| `cloneEditorBlocks` | runtime | Deep-clone a block array | stable | Mutation isolation helper |
| `EditorDocumentSerializationError` | runtime | Named error class for invalid payloads | stable | `instanceof` / `.name` contract |

## Type exports

| Name | Kind | Purpose | Stability | Compatibility |
| --- | --- | --- | --- | --- |
| `EditorDocument` | type | `{ schemaVersion, blocks }` | stable | New required top-level fields would be breaking |
| `EditorBlock` | type | Extensible block (`id`, `type`, optional `props` / `content` / `children`) | stable | Unknown `type` values must round-trip |
| `EditorBlockProps` | type | `Record<string, JsonValue>` | stable | Extra keys allowed |
| `JsonValue` | type | Recursive JSON value union | stable | Host metadata must not appear here |
| `SerializedEditorDocument` | type | Wire envelope | stable | Matches serialize output |
| `EditorProviders` | type | Optional host seam bag | experimental | New optional keys are additive |
| `AIProvider` | type | Optional `edit` | experimental | Optional methods only |
| `AIEditAction` | type | Edit action union | experimental | New literals are additive |
| `AIEditRequest` | type | Edit request payload | experimental | New optional fields are additive |
| `DatabaseProvider` | type | Optional row CRUD / reorder | experimental | Optional methods only |
| `DatabaseListOptions` | type | List filter / pagination | experimental | New optional fields are additive |
| `DatabaseRowItem` | type | Row wrapper | experimental | New optional fields are additive |
| `DatabaseRowsPage` | type | Paginated database page | experimental | New optional fields are additive |
| `CommentsProvider` | type | Optional comment CRUD | experimental | Optional methods only |
| `EditorComment` | type | Comment record | experimental | New optional fields are additive |
| `VersionProvider` | type | Optional snapshot CRUD | experimental | Optional methods only |
| `EditorVersionSnapshot` | type | Snapshot record | experimental | New optional fields are additive |
| `AssetProvider` | type | Optional upload / insert | experimental | Optional methods only |
| `EditorAsset` | type | Asset descriptor | experimental | New optional fields are additive |
| `EditorAssetKind` | type | Asset kind union | experimental | New literals are additive |
| `EditorUploadFile` | type | Upload file interface | experimental | `arrayBuffer()` remains required if used |
| `AssetUploadScope` | type | Upload scope | experimental | Optional fields |
| `ImageSearchProvider` | type | Optional image search | experimental | Optional methods only |
| `ImageSearchResult` | type | Search hit | experimental | New optional fields are additive |
| `PageProvider` | type | Optional page links | experimental | Optional methods only |
| `EditorPageLink` | type | Page link preview | experimental | New optional fields are additive |
| `CreatedChildPage` | type | Child page result | experimental | New optional fields are additive |
| `NativeBridge` | type | Generic host protocol | experimental | Method set is allowlisted |
| `NativeBridgeStats` | type | Optional document stats | experimental | New optional fields are additive |
| `NativeHostRequest` | type | `{ id, method, payload? }` | experimental | Payload stays `JsonValue` |
| `NativeHostResponse` | type | `{ id, ok, payload?, error? }` | experimental | Payload stays `JsonValue` |

## Accidental / internal

None. Internal helpers (`isPlainObject`, `cloneJsonValue`, `normalizeEditorBlock`) are not exported.

Provider implementations are not shipped. `providers` contributes types only.

## Verification

- Source allowlist: `packages/core/test/public-api.test.ts`
- Built/installed package: `node scripts/api-contract.mjs`
- Isolated tarball consumer: `node scripts/isolated-consumer.mjs`
