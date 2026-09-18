# Personal AI ↔ OpenEditor workspace parity

Factual matrix after Phase **4F-4A**. Personal AI is a behavioral reference only —
OpenEditor remains host-neutral (no Supabase / auth / product stores).

## Workspace / pages (4F-2C)

| Capability | Personal AI | OpenEditor |
| --- | --- | --- |
| @ page mention | Suggestion `@` → link href | Suggestion `@` → structured `pageMention` |
| Page search | Client filter on local catalog | `searchPages` / `listLinks` + debounce + latest-accepted |
| Page card / child page | Product blocks + catalog | `pageCard` / `childPage` + PageRuntimeStore |
| Backlinks | Notes graph | RelationIndex outgoing + BacklinkProvider incoming |
| Host-neutral provider | Product-coupled | `PageProvider` / `DatabaseProvider` / `BacklinkProvider` |

## Database (4F-3A + 4F-3B + 4F-4A)

| Capability | Personal AI | OpenEditor 4F-4A |
| --- | --- | --- |
| Database table | Product DB table UI in NoteRichEditor | Interactive `databaseView` table via DatabaseRuntimeStore |
| Provider rows | REST `listDatabaseRows` etc. | Host-neutral `DatabaseProvider.listRows` |
| Create row | `createDatabaseRow` | `createRow` + typed New row draft UI (shared shell) |
| Edit row | Inline cell editing | Typed cell editors (text/number/boolean/date/url/select/status) |
| Delete | Soft-delete API | `deleteRow` + Active list excludes trashed |
| Restore | Restore API + trash | `restoreRow` + Trash mode (`trashedOnly`) |
| Reorder | Drag/API reorder | Safe Move ↑↓ when full position list (table only; Board never reorders) |
| Search | Query on list API | Debounced `DatabaseListOptions.query` (coexists with filters) |
| Pagination | Cursor pages | Explicit Load more + stuck-cursor guard |
| Typed metadata | Product property map | `EditorDatabase.propertyDefinitions` (host-owned) |
| Text | Product text | Typed + legacy editable |
| Number | Product number | Typed + legacy editable; invalid draft does not commit |
| Checkbox | Product checkbox | Boolean checkbox |
| Date | Product date/datetime | Explicit typed `YYYY-MM-DD` only |
| URL | Product URL | Explicit typed text edit (no auto-navigate) |
| Select / status | Product options | Editable only with typed options; persist `option.value` |
| AND filters | Product filter UI | Structured `DatabaseFilter[]` when `queryCapabilities.propertyFilters` |
| Property sort | Product sort | `DatabasePropertySort` when `queryCapabilities.propertySort` |
| Board rendering | Product board | Board renderer (status/select grouping) |
| Board status/select grouping | `groupBy` block prop | Ephemeral UI selection — not EditorDocument |
| Board move between groups | DnD + select | Accessible `<select>` + optional HTML5 DnD → `updateRow` |
| Board within-column reorder | DnD onto cards | **Deferred** (never `reorderRows` under Board) |
| Calendar month | Product month | Month grid (date-only) |
| Calendar week | Product week | Week strip (date-only, no hourly grid) |
| Calendar date move | DnD + writes | Accessible date input + optional DnD → `updateRow` |
| Date-only semantics | Local `YYYY-MM-DD` writes | Canonical `YYYY-MM-DD` keys (no timezone invent) |
| Row open host seam | Product drawer / CustomEvent | Optional `runtime.onOpenRow` |
| Multi-select | Product | **Deferred** |
| User | Product | **Deferred** |
| Files | Product | **Deferred** |
| Formula | Product | **Deferred** (host `unknown` / read-only display) |
| Relation | Product | **Deferred** |
| Rollup | Product | **Deferred** |
| Schema designer | Product | **Deferred** (metadata is host-owned) |
| Timeline | Product timeline | **Deferred** |
| Gantt | Product | **Deferred** |
| List | Product | **Deferred** |
| Gallery | Product | **Deferred** |
| Chart | Product | **Deferred** |
| Feed | Product | **Deferred** |
| Map | Product | **Deferred** |
| Dashboard | Product | **Deferred** |
| Saved view config | Product block props (`groupBy`, `calendarScale`, …) | **Deferred** |

## Generalized from Personal AI

- Host-owned row CRUD over a view identity block
- Soft-delete / trash listing
- Position reorder with full-list safety (table)
- Cursor pagination + query/sort options
- Typed property metadata driving editors and AND filters
- Property identity = id; display name is metadata only
- Board grouping and Calendar date placement as **presentation transforms** over `snap.items`
- Host-neutral row-open callback (no OpenEditor drawer)

## Deliberately deferred

- Timeline / gantt / list / gallery / chart / feed / map / dashboard renderers
- Formula / rollup / relation engines
- Schema designer (add/delete/rename/change type/edit options)
- Multi-select / user / files / email / phone / location / button editors
- OR filters / nested groups / multi-sort / aggregation
- Saved view persistence (`groupBy`, calendar scale/cursor, filters/sort)
- Board within-column reorder via `reorderRows`
- Calendar datetime / timezone / ranges / recurrence / hourly grid
- Personal AI REST/Supabase adapter
- Embedding rows into EditorDocument (never)

## Remaining for 4F-4B+

- Timeline / Gantt renderers
- Saved view configuration contract
- Optional Personal AI host adapter
- Realtime / CRDT / AI patch protocol
