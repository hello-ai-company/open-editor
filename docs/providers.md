# Providers

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

Every provider on `EditorProviders` is optional. Method names are allowlisted so host-specific actions cannot re-enter the standalone core.

## Allowlisted methods

| Provider | Methods |
| --- | --- |
| `AIProvider` | `edit` |
| `DatabaseProvider` | `listRows`, `getRow`, `createRow`, `updateRow`, `deleteRow`, `restoreRow`, `reorderRows` |
| `CommentsProvider` | `list`, `add`, `update`, `delete` |
| `VersionProvider` | `list`, `save`, `restore`, `rename`, `delete` |
| `AssetProvider` | `upload`, `insertCloud` |
| `ImageSearchProvider` | `search` |
| `PageProvider` | `listLinks`, `createChildPage`, `openPage` |
| `NativeBridge` | `ready`, `change`, `commit`, `error`, `hostRequest`, `hostResponse` |

## Forbidden host methods

These identifiers must not appear in `providers.ts`:

`openEmployees`, `openAIEmployees`, `openStyleGallery`, `setDocumentStyle`, `resolveFetch`, `postMessage`, `onReady`, `onChange`, `onCommit`, `ack`, `reload`.

Workforce or document-chrome actions belong on the host. They map through `NativeBridge.hostRequest` / `hostResponse` with a `JsonValue` payload.

## Parsing

The dependency-boundary test collects methods with the TypeScript AST (`MethodSignature` and function-typed `PropertySignature` on `*Provider` / `NativeBridge` types) and a fallback scan of `method?(` / `method?:` / `method()` / `method: (` shapes.
