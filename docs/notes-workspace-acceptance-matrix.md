# Notes workspace acceptance matrix — local candidate .7

This matrix covers all 59 observed requirement rows in the ownership inventory.
It is a completion ledger, not a claim of full feature parity. Public UI, model
fixtures, browser evidence, legacy preservation and production acceptance are
separate gates. The candidate must not authorize removal of old UI or any data.

Paths below are under `packages/blocknote/src/` (React components in `react/`,
controllers/config/catalog/widgets in `notes/`) unless stated otherwise. Tests are
in `packages/blocknote/test/` and the existing package suites. Exact final browser
runs, counts and source hashes are in the candidate verification report.

**Production status for every row: unconnected.** The prepared read-only app host
advertises no mutation capability, throws for unavailable commit transport, and
returns unknown lookup. A local journal does not prove a remote terminal fence.
Auth, canonical legacy projection/archive, concrete transactional storage,
authorization, revision/CAS, atomic history and receipt/fencing must be supplied
and verified by the application owner before enabling each write.

| Observed requirement | Public implementation / fixture evidence | Remaining acceptance or preservation-only boundary |
| --- | --- | --- |
| Sidebar Pages / Library / Document modes | NotesWorkspace/NotesNavigation/config; Navigation tests; Chrome drawers | Layout preferences remain session-only |
| Root/child page tree | NotesNavigation tree; NotesInsertDialog child create; Navigation + picker tests | Authorized complete/paged host tree and canonical create required |
| Tree move | NotesNavigation canMoveNotesPage + page.move; Cycle/scope/revision/cancel tests | Production workspace-CAS move/order transaction absent |
| Sibling order | NotesNavigation page.move position; Navigation tests | Production reorder and reload not verified |
| Favorite and recent panels | NotesLibrary favorite/recent; Navigation tests | Recent is session-only; host favorite persistence not connected |
| Trash | NotesLibrary trash/actions/confirmation; Navigation tests | Synthetic host omits permanent-delete capability; production deletion not connected |
| Library filters/sort/density | NotesLibrary controls + paging; Navigation tests; independent stale-query fixtures | Preference persistence and every configured filter remain integration gates |
| Library classification editor | Metadata panel; optional bridge.classify; Panel/cache tests | Library-specific classification workflow and actual provider not integrated |
| Child-page hub | NotesPageHub; Navigation tests | Full configured DB summaries/relations and durable preference mapping pending |
| Page preview drawer | NotesNavigation authorized preview/resize; Navigation focus/cancel tests | Actual legacy drawer/relations fixture and all resize paths pending |
| Workspace search | NotesWorkspace query/paging epoch; Independent query/cursor race checks | Page catalog search only; DB hit/highlight/assistant integration pending |
| Search assistant / include web | No complete public search assistant; None | Explicit optional AI/web-context host/UI adapter required |
| Open tabs and split panes | NotesTabbedWorkspace/NotesWorkspaceTabs; 35 model/React tests; Chrome modes probe | LayoutStorage unbound; reload/preferences and native drag integration pending |
| Title/icon/cover/breadcrumb header | NotesWorkspace title + PageHub ancestors; Chrome title/lost-ACK/reload; navigation tests | Icon/emoji/cover picker and full header presentation not integrated |
| Style gallery / cover | NotesWorkspaceModes themes; generic media seam; Mode tests | Full original style-gallery/cover workflow not integrated |
| Related pages / backlinks | Existing BacklinksPanel/relationIndex/page runtimes; Existing package tests | Common Notes backlinks/explicit relations panel not fully integrated |
| App context/voice/webclip/Ask AI | navigationExtras/renderModes/proposal slots; Public types | Configured app actions/voice/webclip/AI routing unbound |
| Left document inspector tabs | NotesDocumentSidebar seven panels; Panel tests; Chrome tasks/comments | Configured data providers and all seven real-host panels pending |
| Heading outline | Document index + outline focusBlock; Panel tests | Nested/long real-host heading/selection parity pending |
| Task list/toggle | NotesDocumentSidebar task toggle; Chrome toggle/save/reload | Legacy checklist codec + real host roundtrip pending |
| Media panel | NotesDocumentSidebar media/attachments; Panel tests | Actual scoped assets/attachment panel projection unbound |
| Document body search | NotesDocumentSidebar literal body query; Panel tests | Full highlight and configured long/nested search fixture pending |
| Comments | Comment composer/resolve/delete + scoped commands; Panel/controller tests; Chrome commit/cache | Authorized canonical panels/anchors and durable host mutation required |
| History | History save/rename/restore/delete; Panel/controller tests | Real atomic body/title/archive restoration + preview acceptance pending |
| Info/audit/classification/privacy/tags | Read-only audit + configured category/privacy/tags; Panel/controller tests; demo category/private config | Host metadata allowlist/rights required; actual classification provider unbound |
| Right rail insert/style/info | NotesInspector catalogs + picker binding; 23 insertion/21 style catalog tests; Chrome picker cancel | All real configured controls, table sizing and focus mode not yet accepted |
| Basic text/formatting | NotesBlockNoteDocument public formatting bridge; Panel tests; Chrome style | Nested movement is restricted to top-level; complete legacy style parity pending |
| Font family and size | createDocumentTypographyFeature + styles; Existing typography tests; Chrome mono | Unsupported old styles preserved inert; all native selection paths pending |
| Inline links/page link presentation | NotesInsertDialog safe/internal links; existing page refs; Picker safety/selection/cancel tests | Edit/unlink/card/article/portrait legacy workflow incomplete |
| Code/equation/Mermaid | Optional math/diagram/code public features; Existing tests; example installs math + diagram | Code optional feature not installed in synthetic Notes route; legacy editors pending |
| Page break/table size selection | oePageBreak + basic 2x2 table bridge; Existing document tests; catalog tests | Original 1–5 table size picker not integrated |
| Import/export/statistics/focus | NotesContentTools JSON/Markdown/HTML import/export; Content tests; Chrome template cancel | Markdown is lossy; full focus/statistics/export policy and custom codecs pending |
| Quick actions/templates/block deep links | Existing palette + block template helpers/content templates; Content/widget tests | Cmd-K integration, deep-link compatibility and full block menu not integrated |
| Dictionary hints | No complete public dictionary panel; None | Configured dictionary UI/provider/highlight required |
| Selected text AI/comment toolbar | Existing AI review APIs + proposal presentation slot; Earlier .6 browser AI approve/reject/Undo | Selected-text toolbar/agent/comment routing not integrated in .7 |
| Eleven DB views | Existing eleven database renderers/runtime; Existing DB package tests | No bound database-view fixture in Notes route; real configured views pending |
| DB CRUD/trash/order/remote paging | Existing DatabaseProvider/runtime; scoped contract; Existing DB tests | Legacy provider promises do not establish atomic CAS/receipts; production row CRUD pending |
| DB tree rows | No complete integrated DB tree rows; None | Authorized row paging/count/tree adapter and UI integration pending |
| DB previews | Generic page preview + existing DB renderers; Existing DB tests | Original bounded DB preview not integrated; never claim loaded counts as totals |
| Basic and extended property values | NotesDatabaseProperties/propertyCatalog all 22 authorities; 34 property/schema tests; Chrome row draft guard | Ten direct editors, four host pickers, seven computed/audit read-only, one action; real providers unbound |
| DB property/schema settings | NotesDatabaseSchema + typed schema commands; Property/schema tests; synthetic row settings | Production schema-CAS/options/rows preservation and reload pending |
| Formula/relation/rollup | Typed relation/location/user/file/computed seams; Property authority/safety tests | No eval/Function; authoritative formula/rollup computation is host-owned and unbound |
| DB row drawer/page body | NotesRowDetail + independent row controller; demo row tab; Row tests; Chrome body/tab/cache guard | Full drawer resize/close/presentation and actual row persistence acceptance pending |
| Row-local outline/tasks/media/search/comments/history | Same seven document panels on scoped row controller; Panel/row isolation tests | Configured row-local history/comment projection and reload pending |
| Assets and attachments | NotesContentTools + NotesInsertDialog scoped media; Mock scope/cancel/URL/attachment tests | Actual storage/paste/drop/cover and all real metadata/legacy formats unbound |
| Unsplash source | Scoped explicit image search/accept seam; Mock image search/pagination tests | Actual authorized catalog/service absent; no live Unsplash claim |
| Whiteboard | Independent oeNotesDrawing model/widget; 27 widget tests; Chrome pointer/Undo/Redo/PNG | Old editorTool drawing payload codec remains preservation-only |
| HTML widget | Independent oeHtmlWidget + controller source drafts; 29 HTML/source tests; Chrome Apply/reload/IME guards | Standard legacy HTML codec covered; full custom preset service and every legacy variant pending |
| Document columns | Independent oeColumns/oeColumn feature; Existing column tests | Old custom structures not all mapped; touch/nested long-draft parity pending |
| Synced editable block | oeNotesSyncedBlock + revisioned shared controller; Widget CAS/lost-ACK tests | Actual shared host/resolver unbound; old local sync format preservation-only |
| Canonical but non-live types | Unknown envelopes + host archive sidecars; Existing legacy/adapter tests | Preservation is not an editor for every canonical legacy type |
| Document/Canvas/Present/Site shell | NotesWorkspaceModes render adapter; 35 mode/tab tests; Chrome modes probe | All three templates/six themes and full old config/native fullscreen parity not yet accepted |
| Canvas layout persistence/recovery | createNotesCanvasController double-CAS/recovery contract; 20 layout/Canvas model tests | CanvasHost not connected; local draft cannot be restored after tab unmount/reload |
| Present/Site projection and local export | Injected safe site/presentation renderers; Chrome sandbox/three widths/Present preview; mode keyboard model tests and existing Publish tests | Real export projection policy and configured legacy content pending; no deployment |
| Ask this page / agent panel | No complete Ask-page panel; None | Optional explicit question/result/provider adapter unbound |
| Quiet proposals | Existing quiet sessions/cards; NotesProposalRail presentation; Protected .6 six Chrome probes/16 independent assertions | Synthetic .7 proposal slot unbound; no real AI/provider calls |
| Document writer ownership | Per-target cached writer + dirty/IME/cache/receipt barriers; Controller64 tests; tab35; independent race cases | Legacy writer quiesce, nested provider drain and server entitlement remain host gates |
| Scoped host resource changes | Typed command/evidence/recovery + named property/schema edits; Controller/property tests; Chrome lost-ACK lookup | Production transaction/history/receipt/fence endpoints absent |
| Offline/sync/collaboration | Honest unknown/conflict/offline controller status; Synthetic tests; Chrome lost-ACK lookup | No connected remote collaboration/CRDT/auth transport |

## Migration gate

The synthetic example uses public workspace components and separate test-only
IndexedDB records. Optional unbound services stay unavailable. It does not
reproduce every configured legacy workflow. All rows above remain pending
production acceptance. Several UI/codec rows explicitly remain incomplete even
before a real service is connected; those gaps must not be hidden by a passing
package test count.

CanvasHost and scoped tab-layout storage remain unconnected. No additional
persistence implementation is included in this candidate. Native OS IME,
fullscreen/native drag, real authorized attachments, multi-user collaboration and
all 59 application workflows remain unverified. Synthetic composition events and
in-memory race tests do not establish those properties.

Only supported standard legacy blocks are edited by the existing codec. Unknown
blocks/styles/fields and custom drawing/shared/database tool payloads remain
losslessly archived and inert unless explicitly mapped. Do not call preservation
full editing parity. No PA source or production data was changed.
