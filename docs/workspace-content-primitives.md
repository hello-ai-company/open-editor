# Workspace Content Primitives (Phase 4F-2B)

OpenEditor stores **references and editing semantics**. The host owns **workspace entities and persistence**.

```
EditorDocument
     |
     +-- normal content
     +-- pageMention (inline)
     +-- pageCard / childPage (blocks)
     +-- databaseView (config only: databaseId, viewId, viewType)
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

## Invariant

A `databaseView` block persists identity/config only — never the row collection:

```json
{
  "type": "databaseView",
  "props": {
    "databaseId": "tasks",
    "viewId": "main-table",
    "viewType": "table"
  }
}
```

Rows come from `DatabaseProvider.listRows`. The same database can appear as table / board / calendar views in different pages without duplicating data.

## Providers

See [providers.md](./providers.md). Additive methods on existing `PageProvider` / `DatabaseProvider`:

- Pages: `searchPages`, `getPage`, `createPage`, `createChildPage({ parentPageId, title })`
- Database: `getDatabase`
- Backlinks: `EditorProviders.backlinks.listBacklinks`

## Preset

```ts
import {
  createOpenEditorPowerPreset,
  createPageMentionResolverFromLinks,
  bindDatabaseViewRuntime
} from "@hello-ai-company/editor-blocknote";

const preset = createOpenEditorPowerPreset({
  includeWorkspaceContent: true, // default
  pageMentionRuntime: {
    resolve: createPageMentionResolverFromLinks(() => pages),
    onNavigate: (pageId) => pagesProvider.openPage?.(pageId)
  },
  databaseViewRuntime: { database: databaseProvider }
});

// Commands require host pickers / capabilities on EditorCommandContext:
// requestPagePick, providers.pages.createChildPage, providers.database.listRows
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

## Page href codec

`encodePageHref` / `decodePageHref` support a portable `#page:<encoded-id>` token for hosts that need href-style links. Structured `pageMention` inline content is preferred inside OpenEditor documents.

## Non-goals (later phases)

Full eleven-view renderers, formulas, rollups, Personal AI migration, AI patch protocol, npm publish.
