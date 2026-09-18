# Database Table Interaction (Phase 4F-3A / 4F-3B)

EditorDocument stores **database references / view identity**. The host owns **row entities and persistence**.

> Rows are never embedded into `databaseView` block props.
> Phase 4F-3B filters and property sort are **ephemeral interaction state** — not saved view configuration.

```
EditorDatabase
 ├ propertyDefinitions   (typed metadata, host-owned)
 └ queryCapabilities     (propertyFilters / propertySort)
          │
          ▼
databaseView block
  { databaseId, viewId, viewType, titleHint }
          │
          ▼
DatabaseRuntimeStore   (instance-scoped, ephemeral)
 ├ query
 ├ filters               (AND only)
 ├ propertySort
 ├ pagination
 └ mutation state
          │
          ▼
DatabaseProvider.listRows(options)
          │
          ▼
Host query engine
```

## Identity semantics

| Concept | Role |
| --- | --- |
| `property.id` | Stable identity for row value lookup and filters/sort |
| `property.name` | Display metadata (headers); renaming must not break row lookup |
| Row values | Host-owned; OpenEditor never becomes a database backend |
| Filters | Executed **host-side** via `listRows` options — never fake-filter loaded pages |

## View keys

Ephemeral **UI state** (query / filters / propertySort / sort / trash / pagination) is keyed per
**block instance** via collision-safe `databaseViewInstanceKey(blockId, databaseId, viewId)`.

Provider **read dedupe** remains query-scoped:

```
JSON.stringify([
  databaseId,
  query,
  filters,
  propertySort,
  sortBy,
  direction,
  trashMode,
  pageSize,
  cursor
])
```

Identical in-flight reads still share one `listRows` call across views.
Different filters or property sorts never share an in-flight request.

## Sort precedence

When `propertySort != null`, the runtime sends **only** `propertySort` in list options
and omits legacy `sortBy` / `direction` so the host never receives an ambiguous dual claim.

```
if (propertySort) {
  options.propertySort = propertySort;
} else {
  options.sortBy = state.sortBy;
  options.direction = state.direction;
}
```

Free-text `query` and structured `filters` may coexist — the host executes both.

## Mutations

Conservative commit:

1. local edit UI
2. provider call with **complete** row (for updates)
3. success → invalidate / refetch authoritative rows
4. failure → keep prior displayed rows + surface error

Opaque `JsonValue` mutation results are **not** parsed for `rowKey`.

## Capability model

| Host method / flag | UI |
| --- | --- |
| `listRows` | read-only table |
| `+ createRow` | New row |
| `+ updateRow` | cell editing |
| `+ deleteRow` | Delete |
| `+ restoreRow` | Active / Trash |
| `+ reorderRows` | Move ↑↓ when safe |
| `queryCapabilities.propertyFilters === true` | AND filter builder |
| `queryCapabilities.propertySort === true` | Property sort options |

Absence of capability flags is **fail-closed** — advanced controls stay hidden.

## Reorder safety

Enabled only when:

- `reorderRows` exists
- query is empty
- **filters is empty**
- **propertySort is null**
- trash mode is Active
- `sortBy === "position"`
- `direction === "asc"`
- `pagination.hasMore === false`
- `pagination.nextCursor === null`
- `items.length === pagination.total` (fail-closed, including `total === 0`)

## Property types

### Typed metadata (`propertyDefinitions`)

Portable types: `text` | `number` | `boolean` | `date` | `url` | `select` | `status` | `unknown`

**Presence semantics:**

| Host field | Meaning |
| --- | --- |
| `propertyDefinitions` omitted / `undefined` | Typed metadata absent → legacy `schema` fallback |
| `propertyDefinitions: []` | Typed metadata present but empty → no columns / no legacy inference |
| `propertyDefinitions: [...]` | Use host definitions exclusively |

Do not treat `[]` as “absent”.

**Mutation authority (4F-3B R3):** when the host implements `getDatabase`, row create/update UI stays display-only until `metaStatus === "ready"`. This prevents a race where `listRows` returns first and temporary legacy editors bypass typed `readOnly` / empty definitions. Hosts without `getDatabase` may still mutate from legacy schema.

| Type | Edit (typed) | New Row | Notes |
| --- | --- | --- | --- |
| text | text input | yes | |
| number | number input | yes | Invalid draft does not commit / does not become a string |
| boolean | checkbox | yes | |
| date | `YYYY-MM-DD` | yes | No timezone/datetime yet |
| url | text edit | yes | No auto `window.open` / fetch / preview |
| select / status | `<select>` when `options.length > 0` | yes | Persist `option.value`, not label |
| unknown / readOnly | display only | omitted | Unsupported host types normalize to unknown |

Unknown current select values stay visible (temporary “Current: …” option) and are not coerced.

### Legacy schema (`schema: Record<string, string>`)

`normalizeDatabasePropertyType` maps aliases. Without typed metadata:

- Editable / creatable: `text` / `number` / `boolean` only (4F-3A safety)
- `select` / `status` / `date` / `url` / unknown → display-only

## Filters (4F-3B)

- AND composition only (no OR / nested groups)
- Explicit **Apply** (not per-keystroke provider churn)
- Validated against metadata + capabilities before `listRows`
- Metadata refresh that invalidates options removes bad filters, surfaces a notice, reloads

## Pagination

Explicit **Load more** only. Repeated cursors disable further loads (no infinite loop).

First-page reload (query/filters/propertySort/sort/trash) immediately clears `hasMore` / `nextCursor` so a
stale cursor cannot be used. `loadMore` is a no-op while `status === "loading"`.

Write mutations (`creating` / `updating` / …) keep `mutating` busy across a concurrent
first-page reload — only `loadingMore` / `refreshing` are superseded.

## Non-goals (later)

Board / calendar / timeline / formulas / rollups / relation editors / schema designer /
OR filters / multi-sort / saved views / Personal AI adapter / AG Grid.
