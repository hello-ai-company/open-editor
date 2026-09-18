# Personal AI ↔ OpenEditor workspace parity

Factual matrix after Phase **4F-2C**. Personal AI is a behavioral reference only —
OpenEditor remains host-neutral (no Supabase / auth / product stores).

| Capability | Personal AI | OpenEditor 4F-2C |
| --- | --- | --- |
| @ page mention | Suggestion `@` → link href | Suggestion `@` → structured `pageMention` |
| Slash / command insert | `/` child + card tools | `/` + palette commands + picker |
| Page search | Client filter on local catalog | `searchPages` with `listLinks` fallback + debounce |
| Page navigation | CustomEvents / open vs preview | `PageProvider.openPage` / `onOpen` / `onOpenBacklink` |
| Page card | `pageLink` block + context catalog | `pageCard` + PageRuntimeStore (loading/ready/missing/error) |
| Child page | Host create then insert link | Host `createChildPage` then `childPage` (optional title dialog) |
| Live title updates | Local catalog + some block rewrites | Runtime store `prime` / subscribe (no doc rewrite) |
| Missing page | Trash / missing styling | Explicit missing state; reference retained |
| Backlinks | Derived from notes graph | Outgoing = RelationIndex (this doc); Incoming = host `BacklinkProvider` |
| Host-neutral provider | Product-coupled | `PageProvider` / `DatabaseProvider` / `BacklinkProvider` |
| Instance-scoped cache | App-level notes state | Per-preset `PageRuntimeStore` (no globals) |
| Stale page search (@ / picker) | Product-specific | Latest-accepted `searchNow` + generation-gated picker callbacks (R1) |
| Database editing | Product DB UI | Deferred (4F-3+) — view/relation refs only |
| Board / calendar / formulas | Partial product surfaces | Deferred |

## Remaining for 4F-3+

- Full database property / row CRUD UI
- Multi-view renderers (board, calendar, timeline, …)
- Formulas / rollups
- Optional Personal AI host adapter (product-specific)
- Realtime collaboration / CRDT
- AI patch protocol
