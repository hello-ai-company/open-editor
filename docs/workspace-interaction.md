# Workspace Interaction (Phase 4F-2C)

OpenEditor stores **stable workspace references**. Hosts own **workspace entities**.
UI resolves **live metadata at runtime**.

> A page title is display data. `pageId` is identity.

```
PageProvider
     │
     ▼
PageRuntimeStore
 ├ cache
 ├ in-flight dedupe
 ├ invalidate / prime
 └ subscribe
     │
     ├── pageMention
     ├── pageCard
     └── childPage

PageProvider.searchPages (fallback: listLinks)
     │
     ▼
WorkspacePagePicker / @ suggestion
     │
     ├── mention mode
     └── card / command mode

BacklinkProvider
     │
     ▼
BacklinksPanel  (+ RelationIndex outgoing)
```

## PageRuntimeStore

Instance-scoped (preset/editor). **No module globals.**

| Capability | Behavior |
| --- | --- |
| `get(pageId)` | Sync snapshot (`idle` / `loading` / `ready` / `missing` / `error`) |
| `load(pageId)` | Async fetch with **in-flight dedupe** |
| `preload(ids)` | Batch load |
| `prime(link)` | Host push (rename / seed) — bumps generation |
| `invalidate(id?)` | Drop cache; stale in-flight responses cannot overwrite |

Request dedupe: five cards for the same `pageId` → one `getPage` call.

Stale protection: invalidate/prime bumps a generation token; late responses are ignored.

## Page search lifecycle

1. Prefer `PageProvider.searchPages(query, options)`
2. Else filter `PageProvider.listLinks`
3. Debounce (~150ms) in picker UI
4. Generation counter drops stale async **callback** results when the query changes
5. **Local exclusion:** OpenEditor always removes `excludePageId` from results even if the host ignored the hint
6. **`searchNow` latest-accepted:** a stale in-flight Promise resolves to the **latest accepted** pages (`stale: true`), not the obsolete payload and not `[]` — safe for BlockNote `getItems()` which may apply completions in Promise resolution order

### Stale-query guarantee (R1)

Applies to both:

- `WorkspacePagePicker` (`search` callbacks)
- `@` mention suggestions (`createPageMentionSuggestionGetItems` → `searchNow`)

```
query "a"     -> request A
query "arch"  -> request B
B finishes    -> Architecture accepted
A finishes    -> A is stale; visible/current = Architecture
```

Covered by direct tests on `createPageMentionSuggestionGetItems` and the picker.

## @ mention interaction

`SuggestionMenuController` with `triggerCharacter="@"` + `createPageMentionSuggestionGetItems`.

Selection inserts structured `{ type: "pageMention", props: { pageId } }` — not a plain link.

Slash/palette commands still use `WorkspacePagePicker` via `requestPagePick`.

## Read-only page transclusion

`page.insert-transclusion` stores only `{ pageId }`. The block asks the host's `PageTransclusionRuntime.loadCurrentProjection` for the current authorized `EditorDocument` and renders escaped text; it never edits the source or copies the projection into the owning document. Refresh performs a new host read.

Hosts must authorize every projection read at their trusted boundary, return only the content the current user may read, and use `null` for both missing and inaccessible pages. OpenEditor does not cache this content. Expansion stops at three linked pages, caps one projection at sixteen loaded pages and 20,000 displayed characters, detects repeated IDs on the current expansion path, and renders placeholders for missing, unavailable, cyclic, or over-limit content. Text-only rendering is intentional; source block styling and media are not copied.

## Child-page creation lifecycle

```
optional requestChildPageCreate()  →  null = cancel
        ↓
PageProvider.createChildPage({ parentPageId, title })
        ↓
host returns id  →  insert childPage
```

Never invent a page id. Never insert before host success.

## Backlink interaction

| Side | Owner | Meaning |
| --- | --- | --- |
| **Outgoing** | `RelationIndex` of **this open document** | All page relationships originating here (`page-reference`, `child-page`), **not** filtered by `targetPageId` |
| **Incoming** | `BacklinkProvider` | Workspace-wide links **to** `targetPageId` |

States: loading / ready / empty / error + Refresh. Target changes bump a request generation so stale **incoming** responses are ignored. Outgoing is independent of `targetPageId`.

Navigation:

- Incoming → `onOpenBacklink(item)` (`sourceDocumentId` is not assumed to be a `PageId`)
- Outgoing → `onOpenOutgoingPage?.(pageId)`

## Database views

In Document mode, a `databaseView` block stores host database/view identity and view configuration; row records and access policy stay with the host. `DatabaseProvider` supplies authorized rows through the editor-scoped `DatabaseRuntimeStore`, while an optional host config provider persists view presentation settings. The built-in renderer set covers Table, Board, Calendar, List, Gallery, Timeline, Gantt, Chart, Feed, Map, and Dashboard. Hosts decide which row mutations are allowed. Canvas renders a safe static placeholder for a `databaseView`; Site and Present omit database views under the current publication allowlist. Neither static mode requests database rows. See [database table interaction](./database-table-interaction.md) for the provider and mutation contract.

## Performance rules

- Typing hot path: no `searchPages` / `getPage` / `listBacklinks`
- Metadata fetch only when a visible reference calls `store.load`
- Multiple references → shared in-flight + cache
- Picker: one search engine per provider/debounce; one query effect (no double search on open)

## Host-owned boundaries

The editor supplies interaction surfaces and provider contracts. Hosts remain responsible for page/database authorization, entity and row storage, workspace navigation, persistence, and publication/deployment. Static Site and Present output intentionally project only allowlisted content; consult the [cross-mode compatibility matrix](./cross-mode-compatibility.md) before relying on parity across modes.
