# Personal AI ↔ OpenEditor workspace parity

Factual matrix after Phase **4F-4C**. Personal AI is a behavioral reference only —
OpenEditor remains host-neutral (no Supabase / auth / product stores).

## Workspace / pages (4F-2C)

| Capability | Personal AI | OpenEditor |
| --- | --- | --- |
| @ page mention | Suggestion `@` → link href | Suggestion `@` → structured `pageMention` |
| Page search | Client filter on local catalog | `searchPages` / `listLinks` + debounce + latest-accepted |
| Page card / child page | Product blocks + catalog | `pageCard` / `childPage` + PageRuntimeStore |
| Backlinks | Notes graph | RelationIndex outgoing + BacklinkProvider incoming |
| Host-neutral provider | Product-coupled | `PageProvider` / `DatabaseProvider` / `BacklinkProvider` |

## Database (4F-3A → 4F-4C)

| Capability | Personal AI | OpenEditor 4F-4C |
| --- | --- | --- |
| Database table | Product DB table UI | Interactive `databaseView` table via DatabaseRuntimeStore |
| Provider rows | REST `listDatabaseRows` etc. | Host-neutral `DatabaseProvider.listRows` |
| Board rendering | Product board | Board renderer (status/select grouping) |
| Board move between groups | DnD + select | Accessible `<select>` + optional HTML5 DnD → `updateRow` |
| Board within-column reorder | DnD onto cards | **Deferred** (never `reorderRows` under Board) |
| Calendar month / week | Product calendar | Date-only month/week |
| Calendar date move | DnD + writes | Accessible date input + optional DnD → `updateRow` |
| List | Product list (title/body/chips/drag/checkbox) | List renderer (title/secondary/chips/row-open) |
| List row open | Product drawer | Optional `runtime.onOpenRow` (`viewType: "list"`) |
| List drag reorder | `reorderDatabaseRows` | **Deferred / not exposed** |
| List completion heuristic | `status.toLowerCase() === "done"` checkbox | **Intentionally not inferred** |
| Gallery | Product gallery cards | Gallery card grid |
| Gallery optional media | Product files/images | Host `runtime.resolveRowMedia` only |
| Gallery row open | Product drawer | Optional `onOpenRow` (`viewType: "gallery"`) |
| Gallery drag reorder | Product DnD | **Deferred / not exposed** |
| Timeline | Product timeline | Timeline renderer (typed date property + axis) |
| Timeline date property | Name/id regex heuristics | Explicit typed `date` property selector (by id) |
| Timeline date move | Drag + writes | Accessible `<input type="date">` + optional DnD → `updateRow` |
| Timeline row reorder | Product vertical DnD | **Intentionally not exposed** |
| Gantt | Product gantt | Gantt renderer (start/end date selectors + bars) |
| Gantt start/end | Name heuristics (`start`/`due` regex) | Explicit date-property selectors (by id) |
| Gantt range move | Drag preserving duration | Accessible endpoints + optional bar drag → `updateRow` |
| Gantt row reorder | Product vertical DnD | **Intentionally not exposed** |
| Missing dates | Implicit fallback (today / end−2d / silent swap) | Explicit undated / incomplete / invalid trays |
| Row open host seam | CustomEvent / product drawer | `runtime.onOpenRow` |
| Typed metadata / filters / sort | Product | 4F-3B contracts |
| Chart | Product | **Deferred** |
| Feed | Product | **Deferred** |
| Map | Product | **Deferred** |
| Dashboard | Product | **Deferred** |
| Saved view configuration | Block props (`groupBy`, `calendarScale`, …) | **Deferred** |

## Generalized from Personal AI

- Host-owned row CRUD over a view identity block
- Soft-delete / trash listing
- Cursor pagination + query/sort options
- Property identity = id; display name is metadata only
- Board / Calendar / List / Gallery / Timeline / Gantt as presentation transforms over `snap.items`
- Host-neutral row-open + optional Gallery media seams (no OpenEditor drawer / upload)
- Shared civil-date axis for Timeline/Gantt (bounded ticks; no per-day DOM for huge spans)

## Deliberately deferred

- Chart / feed / map / dashboard renderers
- List/Gallery/Timeline/Gantt drag reorder via `reorderRows`
- List completion / “done” status guessing
- Gallery multi-image / video / upload / crop
- Gantt dependencies / critical path / progress / baselines
- Formula / rollup / relation engines
- Schema designer
- Saved view persistence
- Personal AI REST/Supabase adapter
- Embedding rows into EditorDocument (never)

## Remaining for 4F-4D+

- Chart / Feed / Map / Dashboard renderers
- Saved view configuration contract
- Optional Personal AI host adapter
- Realtime / CRDT / AI patch protocol
