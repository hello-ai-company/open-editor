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
4. Generation counter drops stale async results when the query changes

Unrelated editor text edits do **not** call search or `getPage`.

## @ mention interaction

`SuggestionMenuController` with `triggerCharacter="@"` + `createPageMentionSuggestionGetItems`.

Selection inserts structured `{ type: "pageMention", props: { pageId } }` — not a plain link.

Slash/palette commands still use `WorkspacePagePicker` via `requestPagePick`.

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

| Side | Owner |
| --- | --- |
| Outgoing | `RelationIndex` (this document) |
| Incoming | `BacklinkProvider` |

States: loading / ready / empty / error + Refresh. Target changes bump a request generation so stale responses are ignored. Navigation uses `onOpenBacklink` — no assumed `sourceDocumentId === PageId`.

## Performance rules

- Typing hot path: no `searchPages` / `getPage` / `listBacklinks`
- Metadata fetch only when a visible reference calls `store.load`
- Multiple references → shared in-flight + cache

## Non-goals (later)

Database CRUD UI, board/calendar renderers, formulas, Personal AI adapter, auth, publish.
