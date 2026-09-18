# Database View Interaction (Phase 4F-3A / 4F-3B / 4F-4A / 4F-4B / 4F-4C)

EditorDocument stores **database references / view identity**. The host owns **row entities and persistence**.

> Rows are never embedded into `databaseView` block props.
> Phase 4F-3B filters and property sort are **ephemeral interaction state** — not saved view configuration.
> Phase 4F-4A Board grouping and Calendar scale/cursor/date-property selection are also **ephemeral** — not EditorDocument.
> Phase 4F-4B List/Gallery presentation (including host `resolveRowMedia`) is **ephemeral / host-owned** — media URLs never enter EditorDocument.
> Phase 4F-4C Timeline/Gantt date-property selection and axis viewport are **ephemeral presentation** — never persisted.

```
DatabaseRuntimeStore snapshot (snap.items)
          │
          ▼
Shared Database View Shell
  ├ title / search / filters / sort / refresh / trash / load more
  └ renderer dispatch
          │
   ┌──────┬──────┬──────────┬──────┬─────────┬──────────┬───────┐
   ▼      ▼      ▼          ▼      ▼         ▼          ▼
 Table  Board Calendar     List  Gallery   Timeline    Gantt
          │                                    │          │
          ▼                                    ▼          ▼
 presentation-only transforms
 (group / calendar / list / gallery / date axis / range bars)
```

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

Optional host seams (runtime, not document):
 ├ onOpenRow(request)
 └ resolveRowMedia(request) → DatabaseRowMedia | null
```

## Board & Calendar (4F-4A)

| Concern | Behavior |
| --- | --- |
| Row source | Same `snap.items` after provider query (no second client filter engine) |
| Board grouping | status/select only; ephemeral property pick; options ∪ observed values; Unassigned bucket |
| Board mutation | `updateRow` complete row; never `reorderRows`; DnD optional; `<select>` required |
| Calendar date | First `date` property default; `YYYY-MM-DD` only; invalid/missing → No date |
| Calendar nav | Month/week + Previous/Today/Next — presentation only (zero `listRows`) |
| Partial pages | Show loaded rows + “Showing loaded rows only” + Load more |
| Row open | Optional `runtime.onOpenRow({ databaseId, rowKey, viewId, viewType })` |
| Renderer override | `runtime.renderers` per editor instance — no module-global registry |

## List & Gallery (4F-4B)

| Concern | Behavior |
| --- | --- |
| Row source | Same `snap.items` (provider order); presentation only |
| List title / secondary | Shared title helper + secondary text helper; preview chips capped |
| List completion | **Not inferred** from status/boolean — no auto checkbox heuristic |
| List reorder | **Deferred** — never `reorderRows` under List |
| Gallery media | Host `runtime.resolveRowMedia` only; null/empty → placeholder; resolver throws isolated per card |
| Media persistence | `resolveRowMedia` results **never** enter EditorDocument / block props |
| Partial pages | Show loaded rows + “Showing loaded rows only” notice |
| Row open | Same `onOpenRow` seam with `viewType: "list" \| "gallery"` |
| Renderer override | `runtime.renderers.list` / `.gallery` per editor instance |

## Timeline & Gantt (4F-4C)

| Concern | Behavior |
| --- | --- |
| Row source | Same `snap.items` (provider order); date axis is presentation-only |
| Date contract | Canonical `YYYY-MM-DD` only (shared Calendar helpers + date-axis model) |
| Timeline date property | First typed `date` by default; ephemeral selector by **property.id** (no name heuristics) |
| Timeline placement | Valid dates on bounded axis; missing/invalid → trays; **never** invent Today |
| Timeline mutation | Accessible date input (+ optional marker DnD) → complete-row `updateRow` |
| Gantt start/end | Explicit date selectors; defaults first+second date (or same property = one-day milestone) |
| Gantt ranges | Inclusive; `start > end` stays **invalid** (no silent swap); missing endpoint → incomplete |
| Gantt range move | Preserve inclusive duration via civil-date arithmetic; both endpoints must be editable |
| Axis ticks | Bounded (≈48 max) — huge spans (1900–2100) must not emit tens of thousands of DOM ticks |
| Reorder | **Never** `reorderRows` from Timeline/Gantt |
| Config persistence | Timeline/Gantt property selection + axis **never** enter EditorDocument |
| Partial pages | Loaded-rows-only notice; axis bounds from loaded dates only |

Unsupported `viewType` values (chart, feed, map, dashboard) stay deferred.

## Identity semantics

| Concept | Role |
| --- | --- |
| `property.id` | Stable identity for row value lookup and filters/sort |
| `property.name` | Display metadata (headers); renaming must not break row lookup |
| Row values | Host-owned; OpenEditor never becomes a database backend |
| Filters | Executed **host-side** via `listRows` options — never fake-filter loaded pages |
| Gallery media | Host-owned via `resolveRowMedia`; opaque `rowKey` passed through; never serialized |

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

Board, List, and Gallery **never** call `reorderRows`.

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
| --- | --- | --- |
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

Chart / feed / map / dashboard /
List/Timeline/Gantt drag reorder / List completion heuristics /
Gantt dependencies / critical path / progress /
formulas / rollups / relation editors / schema designer /
OR filters / multi-sort / saved views (`groupBy`, calendar scale, timeline/gantt property picks) /
Board within-column reorder / calendar datetime-timezone /
Personal AI adapter / AG Grid /
persisting gallery media into EditorDocument.
