# Providers

Every provider on `EditorProviders` is optional. Method names are allowlisted so host-specific actions cannot re-enter the standalone core.

## Allowlisted methods

| Provider | Methods |
| --- | --- |
| `AIProvider` | `edit` |
| `DatabaseProvider` | `getDatabase`, `listRows`, `getRow`, `createRow`, `updateRow`, `deleteRow`, `restoreRow`, `reorderRows` |
| `CommentsProvider` | `list`, `add`, `update`, `delete` |
| `VersionProvider` | `list`, `save`, `restore`, `rename`, `delete` |
| `AssetProvider` | `upload`, `insertCloud` |
| `ImageSearchProvider` | `search` |
| `PageProvider` | `listLinks`, `searchPages`, `getPage`, `createPage`, `createChildPage`, `openPage` |
| `BacklinkProvider` | `listBacklinks` |
| `NativeBridge` | `ready`, `change`, `commit`, `error`, `hostRequest`, `hostResponse` |

## Workspace content (Phase 4F-2B)

OpenEditor stores **references and view configuration** in `EditorDocument`. The host owns **entities and rows**:

- `PageProvider` resolves page titles / navigation / child creation
- `DatabaseProvider` supplies rows for `databaseView` blocks (never embed row arrays in the document)
- `BacklinkProvider` supplies workspace-wide *incoming* relations; a single editor only knows its outgoing `RelationIndex`
- `BacklinkQuery` is a discriminated union: `targetType: "database-row"` always requires `targetDatabaseId` + `targetId`

`createChildPage()` with no arguments remains supported. Prefer:

```ts
await pages.createChildPage({ parentPageId: currentPageId, title: "Untitled" });
```

## Workspace interaction (Phase 4F-2C)

BlockNote-layer UX on top of these contracts (no core changes):

- Instance-scoped `PageRuntimeStore` (cache / dedupe / stale protection)
- `WorkspacePagePicker` + `@` mention suggestions
- Production `BacklinksPanel` (outgoing RelationIndex + incoming BacklinkProvider)

See [workspace-interaction.md](./workspace-interaction.md) and [personal-ai-parity.md](./personal-ai-parity.md).

## Database interaction (Phase 4F-3A / 4F-3B)

`DatabaseProvider` supplies rows for `databaseView` blocks (never embed row arrays in the document).

Phase 4F-3B adds **optional** typed metadata on `EditorDatabase`:

- `propertyDefinitions` — portable property types / options / readOnly
- `queryCapabilities.propertyFilters` / `propertySort` — fail-closed advanced query UX

and **optional** fields on `DatabaseListOptions`:

- `filters` — AND `DatabaseFilter[]` (host executes)
- `propertySort` — mutually exclusive with legacy `sortBy`/`direction` when set by OpenEditor

Legacy hosts that only implement `listRows` continue to compile and run unchanged.

See [database-table-interaction.md](./database-table-interaction.md) and [personal-ai-parity.md](./personal-ai-parity.md).

## Forbidden host methods

These identifiers must not appear in `providers.ts`:

`openEmployees`, `openAIEmployees`, `openStyleGallery`, `setDocumentStyle`, `resolveFetch`, `postMessage`, `onReady`, `onChange`, `onCommit`, `ack`, `reload`.

Workforce or document-chrome actions belong on the host. They map through `NativeBridge.hostRequest` / `hostResponse` with a `JsonValue` payload.

## Parsing

The dependency-boundary test collects methods with the TypeScript AST (`MethodSignature` and function-typed `PropertySignature` on `*Provider` / `NativeBridge` types) and a fallback scan of `method?(` / `method?:` / `method()` / `method: (` shapes.
