# Workspace Content Primitives (Phase 4F-2B)

OpenEditor stores **references and editing semantics**. The host owns **workspace entities and persistence**.

```
EditorDocument
     |
     +-- normal content
     +-- pageMention (inline)
     +-- pageCard / childPage (blocks)
     +-- databaseView (config only: databaseId, viewId, viewType)
     +-- databaseRelation (inline: databaseId + rowId only)
     +-- blockReference
     |
RelationIndex  -->  outgoing relationships from this document
Host
     |
     +-- PageProvider
     +-- DatabaseProvider
     +-- BacklinkProvider (incoming / workspace-wide)
     +-- persistence (Supabase, SQLite, files, …)
```

## Runtime scoping (R1)

**All provider/runtime bindings are editor-instance (preset) scoped.**
There is **no module-global workspace provider state**.

Each call to `createOpenEditorPowerPreset({ pageCardRuntime, … })` captures those
runtime objects by closure inside the block specs for that preset. Creating a
second preset cannot overwrite the first preset’s resolve/subscribe/provider
bindings. Do not introduce registries, static maps, or hidden globals.

## Invariant — databaseView

A `databaseView` block persists identity/config only — never the row collection:

```json
{
  "type": "databaseView",
  "props": {
    "databaseId": "projects",
    "viewId": "main-table",
    "viewType": "table"
  }
}
```

Rows come from `DatabaseProvider.listRows`. The same database can appear as table / board / calendar views in different pages without duplicating data.

## Database insertion

**OpenEditor never invents a `databaseId`.** The host must select/provide the
target database via `requestDatabaseViewPick` on the command context.

`database.insert-view` is enabled only when:

1. `providers.database.listRows` is available, **and**
2. `requestDatabaseViewPick` is available

If the picker is missing → `{ ok: false, reason: "Database picker not available" }`.
If the picker returns `null` → no insertion.
If the picker returns `{ databaseId: "db-X", … }` → the document stores `db-X` exactly.

After a real database is selected, `viewId` may default to the OpenEditor-owned
value `"main"`. Invalid `viewType` strings fall back to `"table"` (validated with
`isDatabaseViewType`).

## Database view reference vs database row relation

| Concept | Kind | Target | Persisted shape |
| --- | --- | --- | --- |
| **Database view reference** | `database-view-reference` | `database` + databaseId | `databaseView` block props |
| **Database row relation** | `database-row-relation` | `database-row` + rowId **scoped by** `targetDatabaseId` | `databaseRelation` inline `{ databaseId, rowId }` |

Row keys are only unique within a database: **`db-a` / `row-1` ≠ `db-b` / `row-1`**.
Never embed destination row objects in the document.

## Providers

See [providers.md](./providers.md). Additive methods on existing `PageProvider` / `DatabaseProvider`:

- Pages: `searchPages`, `getPage`, `createPage`, `createChildPage({ parentPageId, title })`
- Database: `getDatabase`
- Backlinks: `EditorProviders.backlinks.listBacklinks`

## Preset

```ts
import {
  createOpenEditorPowerPreset,
  createPageMentionResolverFromLinks
} from "@hello-ai-company/editor-blocknote";

const preset = createOpenEditorPowerPreset({
  includeWorkspaceContent: true, // default
  pageMentionRuntime: {
    resolve: createPageMentionResolverFromLinks(() => pages),
    onNavigate: (pageId) => pagesProvider.openPage?.(pageId),
    subscribe: (listener) => store.subscribe(listener)
  },
  pageCardRuntime: {
    resolve: (pageId) => /* … */,
    subscribe: (listener) => store.subscribe(listener)
  },
  childPageRuntime: {
    resolve: (pageId) => /* … */,
    subscribe: (listener) => store.subscribe(listener)
  },
  databaseViewRuntime: { database: databaseProvider }
});

// Commands require host pickers / capabilities on EditorCommandContext:
// requestPagePick, requestDatabaseViewPick,
// providers.pages.createChildPage, providers.database.listRows
```

Disable workspace primitives (schema **and** commands):

```ts
createOpenEditorPowerPreset({ includeWorkspaceContent: false });
```

## RelationIndex vs Backlinks

| Concern | Owner |
| --- | --- |
| Outgoing edges in the open document | `createRelationIndex()` (editor package) |
| Incoming links from other documents | Host `BacklinkProvider` |

Do not scan remote workspaces from the editor package.

On block **update**, RelationIndex clears edges for the **previous** subtree
(`prevBlock`) before inserting edges from the new subtree, so nested children
that disappear cannot leave stale relations.

## Page href codec

`encodePageHref` / `decodePageHref` support a portable `#page:<encoded-id>` token for hosts that need href-style links. Structured `pageMention` inline content is preferred inside OpenEditor documents.

## Non-goals (later phases)

Full eleven-view renderers, formulas, rollups, Personal AI migration, AI patch protocol, npm publish.
