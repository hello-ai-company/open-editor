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

`createChildPage()` with no arguments remains supported. Prefer:

```ts
await pages.createChildPage({ parentPageId: currentPageId, title: "Untitled" });
```

## Forbidden host methods

These identifiers must not appear in `providers.ts`:

`openEmployees`, `openAIEmployees`, `openStyleGallery`, `setDocumentStyle`, `resolveFetch`, `postMessage`, `onReady`, `onChange`, `onCommit`, `ack`, `reload`.

Workforce or document-chrome actions belong on the host. They map through `NativeBridge.hostRequest` / `hostResponse` with a `JsonValue` payload.

## Parsing

The dependency-boundary test collects methods with the TypeScript AST (`MethodSignature` and function-typed `PropertySignature` on `*Provider` / `NativeBridge` types) and a fallback scan of `method?(` / `method?:` / `method()` / `method: (` shapes.
