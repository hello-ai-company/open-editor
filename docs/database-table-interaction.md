# Database Table Interaction (Phase 4F-3A)

EditorDocument stores **database references / view identity**. The host owns **row entities and persistence**.

> Rows are never embedded into `databaseView` block props.

```
databaseView block
  { databaseId, viewId, viewType, titleHint }
      │
      ▼
DatabaseRuntimeStore   (instance-scoped, ephemeral)
 ├ metadata cache
 ├ query / sort / trash state (per viewKey)
 ├ rows + pagination
 ├ mutation state
 └ subscriptions
      │
      ▼
DatabaseProvider
      │
      ▼
Host persistence
```

## View keys

Ephemeral **UI state** (query / sort / trash / pagination cursors) is keyed per
**block instance**:

```
viewKey = `${blockId}::${databaseId}::${viewId}`
```

via `databaseViewInstanceKey(blockId, databaseId, viewId)`.

Two blocks with the same `databaseId` + `viewId` (e.g. both defaulting to
`viewId: "main"`) therefore keep independent search/sort/trash UI state.

Provider **read dedupe** remains query-scoped (not block-scoped), using a
collision-safe JSON tuple key:

```
JSON.stringify([databaseId, query, sortBy, direction, trashMode, pageSize, cursor])
```

Identical in-flight reads still share one `listRows` call across views.

## Read query identity

List reads are keyed by:

```
db=…|q=…|sort=…|dir=…|trash=…|limit=…|cursor=…
```

Identical in-flight reads share one `listRows` call.

Stale responses (older generation) cannot overwrite newer query results.

## Mutations

Conservative commit:

1. local edit UI
2. provider call with **complete** row (for updates)
3. success → invalidate / refetch authoritative rows
4. failure → keep prior displayed rows + surface error

Opaque `JsonValue` mutation results are **not** parsed for `rowKey`.

## Capability model

| Host method | UI |
| --- | --- |
| `listRows` | read-only table |
| `+ createRow` | New row |
| `+ updateRow` | cell editing |
| `+ deleteRow` | Delete |
| `+ restoreRow` | Active / Trash |
| `+ reorderRows` | Move ↑↓ when safe |

## Reorder safety

Enabled only when:

- `reorderRows` exists
- query is empty
- trash mode is Active
- `sortBy === "position"`
- `direction === "asc"`
- `pagination.hasMore === false`
- `pagination.nextCursor === null`
- `items.length === pagination.total` (fail-closed, including `total === 0`)

## Property types

`normalizeDatabasePropertyType` maps known aliases to:

`text` | `number` | `boolean` | `date` | `url` | `select`

Unknown → **readonly** display (no destructive editor).

**Editable cells / New Row** (4F-3A): only `text` / `number` / `boolean`.
`date` / `url` / `select` are display-only until typed property metadata (4F-3B).
Readonly / unknown fields are omitted from the create payload (never sent as `""`).

## Pagination

Explicit **Load more** only. Repeated cursors disable further loads (no infinite loop).

## Non-goals (later)

Board / calendar / timeline / formulas / rollups / schema designer / Personal AI adapter.
