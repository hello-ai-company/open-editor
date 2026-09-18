# Personal AI ↔ OpenEditor workspace parity

Factual matrix after Phase **4F-3A**. Personal AI is a behavioral reference only —
OpenEditor remains host-neutral (no Supabase / auth / product stores).

## Workspace / pages (4F-2C)

| Capability | Personal AI | OpenEditor |
| --- | --- | --- |
| @ page mention | Suggestion `@` → link href | Suggestion `@` → structured `pageMention` |
| Page search | Client filter on local catalog | `searchPages` / `listLinks` + debounce + latest-accepted |
| Page card / child page | Product blocks + catalog | `pageCard` / `childPage` + PageRuntimeStore |
| Backlinks | Notes graph | RelationIndex outgoing + BacklinkProvider incoming |
| Host-neutral provider | Product-coupled | `PageProvider` / `DatabaseProvider` / `BacklinkProvider` |

## Database (4F-3A)

| Capability | Personal AI | OpenEditor 4F-3A |
| --- | --- | --- |
| Database table | Product DB table UI in NoteRichEditor | Interactive `databaseView` table via DatabaseRuntimeStore |
| Provider rows | REST `listDatabaseRows` etc. | Host-neutral `DatabaseProvider.listRows` |
| Create row | `createDatabaseRow` | `createRow` + New row draft UI |
| Edit row | Inline cell editing | Primitive cell editors (text/number/boolean/…) |
| Delete | Soft-delete API | `deleteRow` + Active list excludes trashed |
| Restore | Restore API + trash | `restoreRow` + Trash mode (`trashedOnly`) |
| Reorder | Drag/API reorder | Safe Move ↑↓ when full position list |
| Search | Query on list API | Debounced `DatabaseListOptions.query` |
| Pagination | Cursor pages | Explicit Load more + stuck-cursor guard |
| Primitive cell editors | Product property map | Normalized portable types; unknown → readonly |
| Board | Product board | **Deferred** |
| Calendar | Product calendar | **Deferred** |
| Timeline | Product timeline | **Deferred** |
| Advanced properties | Product schema | **Deferred** |
| Formula / rollup | Product | **Deferred** |

## Generalized from Personal AI

- Host-owned row CRUD over a view identity block
- Soft-delete / trash listing
- Position reorder with full-list safety
- Cursor pagination + query/sort options

## Deliberately deferred

- Board / calendar / timeline / gallery / chart renderers
- Formula / rollup engines
- Schema designer / advanced select option management
- Personal AI REST/Supabase adapter
- Embedding rows into EditorDocument (never)

## Remaining for 4F-3B / 4F-4+

- Advanced query & property UX
- Additional view renderers
- Optional Personal AI host adapter
- Realtime / CRDT / AI patch protocol
