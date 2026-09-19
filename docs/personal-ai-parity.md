# Personal AI ↔ OpenEditor workspace parity

Factual matrix after Phase **4F-4E**. Personal AI is a behavioral reference only —
OpenEditor remains host-neutral (no Supabase / auth / product stores).

## Workspace / pages (4F-2C)

| Capability | Personal AI | OpenEditor |
| --- | --- | --- |
| @ page mention | Suggestion `@` → link href | Suggestion `@` → structured `pageMention` |
| Page search | Client filter on local catalog | `searchPages` / `listLinks` + debounce + latest-accepted |
| Page card / child page | Product blocks + catalog | `pageCard` / `childPage` + PageRuntimeStore |
| Backlinks | Notes graph | RelationIndex outgoing + BacklinkProvider incoming |
| Host-neutral provider | Product-coupled | `PageProvider` / `DatabaseProvider` / `BacklinkProvider` |

## Database (4F-3A → 4F-4E)

| Capability | Personal AI | OpenEditor 4F-4E |
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
| Chart | Product chart | Chart renderer (loaded-snapshot presentation aggregation) |
| Chart status/select counts | Product category counts | Categorical bars over **loaded** `snap.items` only |
| Chart numeric comparison | Horizontal bars | Finite-number bars; zero-baseline domain; no `Number\|\|0` |
| Chart multi-select | Supported / product-specific | **Not in portable core** |
| Chart loaded-only semantics | Product-dependent | **Explicit** “Showing loaded rows only” notice |
| Feed | Product feed | Feed renderer (provider-order presentation cards) |
| Feed row open | Product drawer | Optional `onOpenRow` (`viewType: "feed"`) |
| Feed media | Product media discovery | Host `resolveFeedRowMedia` (`viewType: "feed"`) |
| Feed owner | Product field | **Not inferred** (no portable user property type) |
| Feed date | Product due heuristics | Explicit typed `date` property selector (by id) |
| Feed drag reorder | Personal AI behavior | **Intentionally not exposed** |
| Feed chronological sorting | Product-dependent | **Provider order preserved** |
| Map | Product map + location heuristics | Map renderer (host `resolveMapLocation` + equirectangular pins) |
| Map location property | Product location / name guessing | **No core `location` property type** — host seam only |
| Map SDK / tiles / geocoding | Product map libraries | **Intentionally not included** |
| Map row open | Product drawer | Optional `onOpenRow` (`viewType: "map"`) |
| Dashboard | Product BI dashboard | Dashboard renderer (loaded-only descriptive aggregates) |
| Dashboard completion/overdue | Product heuristics | **Intentionally not inferred** |
| Dashboard metrics | Product totals | Loaded-row counts / categorical / numeric / date summaries only |
| Missing dates | Implicit fallback (today / end−2d / silent swap) | Explicit undated / incomplete / invalid trays |
| Row open host seam | CustomEvent / product drawer | `runtime.onOpenRow` |
| Typed metadata / filters / sort | Product | 4F-3B contracts |
| Saved view configuration | Block props (`groupBy`, `calendarScale`, …) | **Deferred** |

## Generalized from Personal AI

- Host-owned row CRUD over a view identity block
- Soft-delete / trash listing
- Cursor pagination + query/sort options
- Property identity = id; display name is metadata only
- Board / Calendar / List / Gallery / Timeline / Gantt / Chart / Feed / Map / Dashboard as presentation transforms over `snap.items`
- Host-neutral row-open + optional Gallery (`resolveRowMedia`) / Feed (`resolveFeedRowMedia`) media / Map (`resolveMapLocation`) seams (no OpenEditor drawer / upload / geocoding)
- Shared civil-date axis for Timeline/Gantt (bounded ticks; no per-day DOM for huge spans)
- Chart / Dashboard = loaded-snapshot aggregation (not a second query engine)
- Feed = provider-order cards (not an activity / audit log)
- Map = host locations + dependency-free projection (not a tile client)

## BlockNote package line (Phase 4F-5B)

| Line | OpenEditor `editor-blocknote` | Personal AI host today |
| --- | --- | --- |
| `@blocknote/*` | **`^0.54.2`** (matrix-verified) | `^0.52.1` (incompatible peers) |

Upgrade Personal AI BlockNote before mounting `editor-blocknote`. Details: [blocknote-compat.md](./blocknote-compat.md), [personal-ai-integration-contract.md](./personal-ai-integration-contract.md).

## Deliberately deferred

- List/Gallery/Timeline/Gantt/Feed drag reorder via `reorderRows`
- List/Feed/Dashboard completion / “done” / overdue status guessing
- Gallery/Feed multi-image / video / upload / crop
- Chart pie/line/area/scatter/stacked/multi-series / multi-select / saved config / export
- Map SDK / network tiles / geocoding / core `location` property type
- Gantt dependencies / critical path / progress / baselines
- Formula / rollup / relation engines
- Schema designer
- Saved view persistence
- Personal AI REST/Supabase adapter
- Embedding rows into EditorDocument (never)

## Remaining after 4F-4E

- Saved view configuration contract
- Optional Personal AI host adapter
- Realtime / CRDT / AI patch protocol
