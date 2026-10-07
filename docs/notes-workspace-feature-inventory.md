# Notes workspace ownership inventory

Read-only feature audit, 2026-10-07. This records observed requirements, data-field
names and integration boundaries. It does not transfer private implementation,
claim complete parity, or authorize removal of PersonalAI files or data.

## Observed source and status

PersonalAI baseline: local `personal-ai-oe-candidate` worktree (absolute path omitted).
Observed HEAD: `3a2104c078cc7b193a075629cdaf747df23db119`, with active uncommitted
integration WIP. Paths in the PA source column below are relative to
`apps/web/src/` in that baseline. Line numbers are audit locators, not immutable
API addresses. Files are requirements evidence only, not reusable source code.

OpenEditor baseline for this audit: the local `open-editor-notes-parity` source
containing the `.5` package functionality and active modern proposal UI WIP.
OpenEditor paths below are relative to this repository. Existing candidate
artifacts `.0`–`.5` and the modern UI work remain independent of this inventory.

The source files were read; no credential/environment files, production records,
private database contents, remote APIs, or excluded column-extension implementation
were accessed. No PersonalAI source was changed.

| Observed PA file | Lines | SHA256 at observation |
| --- | ---: | --- |
| `features/notes/NotesWorkspace.tsx` | 1260 | `b30220ba20e89d64dd24e3cfd703ec6821bc6309076027cb4ca4f8106832f43c` |
| `features/notes/components/DocumentSidebar.tsx` | 138 | `41e883b804b713a0317cf1b77e907ccb51274e5b0dab3ca637a33cc6dbe86e46` |
| `components/NoteRichEditor.tsx` | 4447 | `5c980b3e5928632e3c06cadb0e11a1a9001363ae2157130126b2c80e84aa3ce8` |
| `features/notes/components/NoteEditorPane.tsx` | 680 | `c3b9005b501e82a24119f38b7177a163b6b6db8236a73f7b8ef489075880ff0d` |
| `features/notes/components/DocumentProposalPanel.tsx` | 259 | `546c4f6fb6615c7ff0ecc5290dbb905b7251476630481dcd20997466f572c59a` |
| `lib/domain.ts` | 344 | `3b00a8d9603d43e1cd63d7482a4cf3d3f46a980b154dbd903d1fb49ce3bbdbed` |

`NotesWorkspace.tsx` and `DocumentSidebar.tsx` also have those exact SHA256 values
in the sibling `personal-ai-notes-migration`, `personal-ai-auto-organize`, and
`personal-ai-mac` worktrees. Other WIP observations apply only to the stated
baseline. Additional inspected components: NoteTree 165 lines, LibraryView 93,
PageHub 98, DatabasePreviewDrawer 115, NoteWorkspaceModes 447, NoteCanvasWorkspace
98; `app/App.tsx` 2157 and `editorAdapters/noteBlockFieldOwnership.ts` 90 lines.

Status vocabulary:

- **missing**: the complete requested public workspace behavior and its acceptance
  evidence are absent. A partial reusable component does not close the item.
- **reusable**: an existing public implementation can supply that bounded part.
  Workspace integration, host authorization and the listed checks remain open.
- **preservation-only**: raw/unknown legacy data can be retained, but an editable
  public implementation has not been established.

There is no overall completed row. Every row remains open until its acceptance
conditions have been exercised through the public package and host fixture.

## Left sidebar, navigation and workspace surface

OE owns reusable UI and local interaction state; host owns canonical records,
access, persistence and service calls. Optional integrations must be absent-safe.

| Feature / observed PA source | Owner and data / actions | OE status and existing public part | Host boundary / required acceptance |
| --- | --- | --- | --- |
| Sidebar Pages / Library / Document modes — `features/notes/NotesWorkspace.tsx:996` | OE layout, active mode, width/collapse/drawer; `noteSidebarMode`, `noteSidebarWidth`, `notesPanelOpen` | **missing** integrated public NotesWorkspace/preset | Configurable layout; keyboard/focus/Escape, scroll stability, independent safe drawers at 320px and zoom, reload preferences scoped to workspace |
| Root/child page tree — `components/NoteTree.tsx:94` | OE tree projection, expand/collapse/selection; host pages `id`, `parentID`, title/icon; child create/open/preview | **missing** tree UI; reusable `PageProvider`, child-page block, page runtime | Authorization-filtered pages only; stable identities; nested navigation and reload; missing/deleted nodes; child create failure without invented canonical page |
| Tree move — `NotesWorkspace.tsx:542` and `:557`, `NoteTree.tsx:104` | OE drag/keyboard intent and subtree cycle validation; host atomic parent change | **missing** public move contract/UI | Self/descendant moves refused; parent/scope/share/CAS rechecked by host; denied/conflict/cancel/lost ACK preserve original; move/reload verified |
| Sibling order — `NotesWorkspace.tsx:572` and `:586`, `PageHub.tsx:95` | OE reorder intent, `pageOrderByParent`; host preference/order storage | **missing** | Persist/reload order; duplicates/unknown IDs; current siblings and remote changes; accessible alternative to drag |
| Favorite and recent panels — `NotesWorkspace.tsx:1012`, `app/App.tsx:171` and `:571` | OE list/popover; host `favoriteNoteIDs`, recent policy and data | **missing** | Toggle/open, persist/reload, access filtering, empty/loading/error, no cross-workspace leakage |
| Trash — `NotesWorkspace.tsx:1015` and `:1186` | OE search/list/confirmation UI; host `trashedNoteIDs`, restore/permanent delete | **missing** | Explicit destructive confirmation, pending/denied/error recovery, references to trashed pages, child policy and reload; no data deletion as part of migration |
| Library filters/sort/density — `components/LibraryView.tsx:12`, Workspace `:254` | OE `updated/title/workspace/children`, ascending, all/database/page, tag, comfortable/compact, limit/sentinel | **missing** integrated public UI | Every filter/sort/kind/density control, pagination without stale duplication, selection/navigation, reload preferences, narrow/keyboard |
| Library classification editor — `LibraryView.tsx:90` | OE category/privacy editor and AI action UI; host category/privacy/tags and classification provider | **missing** | Capability-gated metadata mutation, exact revision and host policy, cancellation/stale AI result, no silent privacy expansion |
| Child-page hub — `components/PageHub.tsx:36` | OE breadcrumbs, grid/list, child search/add/reorder, related-page cards and DB summaries | **missing** | Child counts/search/order with inaccessible/trash entries excluded, preview/full-open, persistence, no stale full-row overwrite |
| Page preview drawer — `components/DatabasePreviewDrawer.tsx:75` (115 lines) | OE resizable preview/open/close/full-page and relations UI; host allowed page retrieval | **missing** | Permission-filtered content, close/focus return/Escape, resize and 320px, drafts/IME safe when switching, no unintended data fetch |
| Workspace search — `NotesWorkspace.tsx:984` and `:1072`, `lib/noteSearch.ts:47` | OE input/results/highlight/loading; host page/DB search, pagination; note title/body/tags and DB hit identities | **missing** integrated search; reusable page search/pickers/index | Query cancellation/debounce, empty/error/late-result suppression, allowed-result scope, DB row open, no rows embedded in document |
| Search assistant / include web — `NotesWorkspace.tsx:984`, `components/SearchAssistantPanel.tsx` | OE opt-in action/results UI; host AI/search/web context policy | **missing** optional public service seam | Disabled/hidden when absent, explicit invocation, untrusted retrieved content, cancellation; fixture only, no paid/network calls in acceptance |
| Open tabs and split panes — `NotesWorkspace.tsx:1172` | OE active tab, open/close/create, split axis/drop position and pane focus; host page records | **missing** | Multiple editors target correct documents; single-writer ownership; flush/recovery before switch/close; late saves cannot replace a newer pane; reload and 320px |
| Title/icon/cover/breadcrumb header — `components/NoteEditorPane.tsx:59` and `:164` | OE editing/pickers/emoji search+24-item paging; host title/icon/coverURL/coverAlt/tags | **missing** public header; reusable page/asset providers | Title/metadata CAS and IME, icon add/change/remove/paging, cover local/cloud/image provider/cancel/clear, ancestors/access, persist/reload |
| Style gallery / cover — `NotesWorkspace.tsx:1208`, `NoteEditorPane.tsx:161`, `components/StyleGallery.tsx` | OE independent style gallery/theme config; host durable style and asset choice | **missing** | Current configured presets reproduced without private asset/code transfer; choose/cancel/close/clear, saved metadata, focus and contrast |
| Related pages / backlinks — `components/NoteEditorPane.tsx:676`, `lib/relations.ts:4` | OE relations and reference UI; host permitted records/references incl. trash status | **reusable** `BacklinksPanel`, `relationIndex`, page links; full panel integration missing | Incoming/outgoing child/inline/explicit relations, stale targets/trash/denial, exact page open; do not treat references as write permission |
| App context/voice/webclip/Ask AI — Workspace `:974` and `:1253`, App `:2040` | OE optional action slots; host app navigation, capture, clip and AI destinations | **missing** optional action contracts | No hard PersonalAI router/session imports; unavailable integrations fail closed; caller config reproduces current actions |

## Document inspector and right tool rail

| Feature / observed PA source | Owner and data / actions | OE status and existing public part | Host boundary / required acceptance |
| --- | --- | --- | --- |
| Left document inspector tabs — `components/DocumentSidebar.tsx:11` | OE outline/tasks/media/search/comments/history/info selection and panels | **missing** integrated inspector | All seven actual tabs available with honest empty states; modern proposal rail remains visible safely; keyboard/tab semantics and 320px |
| Heading outline — Sidebar `:90` and `:130` | OE heading/text/level projection and jump; host document | **reusable** `DocumentOutline`, index and `jumpToBlock` | Nested/long documents, current edits, jump preserves selection appropriately, removed target, reduced motion |
| Task list/toggle — Sidebar `:91` and `:131` | OE checklist projection, jump/toggle intent; host body revision | **missing** common task panel | Toggle exact block, preserve text/IDs/other fields; one undo/save, denied/read-only, stale block and reload |
| Media panel — Sidebar `:92` and `:132` | OE asset/image/file/attachment inventory and jump | **missing** common media panel | All supported media forms/nested blocks; safe authorized URL display, no implicit upload/fetch; live updates and keyboard |
| Document body search — Sidebar `:99` and `:133` | OE query/block result/highlight and focus | **missing** panel; reusable document index | Long/nested body, safe literal highlighting, empty/case handling, no focus-stealing while typing/IME |
| Comments — Sidebar `:135`, Workspace `:718`–`:765` | OE block composer/add/resolve/delete-confirm; host comments `{id,blockID,text,createdAt,resolved}` | **missing** UI/guarded mutations; reusable Core `CommentsProvider` | Authenticated current block/revision/scope; add/resolve/delete pending/conflict/error/lost ACK; persistent anchor migration, reload; old optimism is not success evidence |
| History — Sidebar `:114` and `:136`, Workspace `:766`–`:843` | OE list/rename/cancel/delete/restore-preview; host snapshot `{id,name,title,blocks,blockItems,createdAt}` | **missing** common UI/atomic restoration; reusable Core `VersionProvider` | Save current before restore, atomic title/body/metadata CAS, original retained, exact undo, denial/error/lost ACK, reload |
| Info/audit/classification/privacy/tags — Sidebar `:137`, Workspace `:673` | OE displays/controls; host createdAt/updatedAt/createdBy/updatedBy/category/privacy/tags | **missing** | Server audit values read-only, tag merge preserves manual entries, metadata CAS; AI results reviewed/cancellable; no sharing permission inferred |
| Right rail insert/style/info — `components/NoteRichEditor.tsx:3910` | OE selection-preserving tools, focus mode, panel/collapse/mobile state, table size picker and previews | **missing** unified rail; reusable palette/block actions | All observed controls wired to installed schema/allowed operations; repeated click/drag suppression, close/focus return, caret/IME, 320px/zoom/reduced motion |
| Basic text/formatting — RichEditor `:1506`, `:1538`, `:3590` | OE paragraphs/headings/quote/lists/checklists/callout, alignment/indent/move/clear; document fields | **reusable** schema/public BlockNote API and power commands | Exact style/text/selection/unknown-field roundtrip, independent toolbar/palette, bounded transformations, Undo/redo/save/reload |
| Font family and size — RichEditor `:1414`–`:1450`, `:3620` | OE safe style specs for sans/serif/mono, small/large; inline style values | **missing** public bundled specs; unknown values **preservation-only** | Known values render safely, unknown arbitrary CSS inert/retained, old styled text remains lossless, selection/caret and export |
| Inline links/page link presentation — RichEditor `:430`, `:458`, `:700`, `:3543` | OE text/card/article/portrait representation; host target identity and allowed page metadata | **missing** full style UI; reusable references/pickers and safe link assistance | Add/edit/unlink keeps styles/displayed text, safe URLs, grounded same-scope internal labels, stale target/review/Undo; no automatic metadata fetch |
| Code/equation/Mermaid — RichEditor `:1031`, `:1086`, `:1367` | OE source/preview editing; document source/language | **reusable** optional public code/math/diagram features | Existing content/source retained, parser errors safe, no external renderer requests, switch preview/edit/close and roundtrip |
| Page break/table size selection — RichEditor `:1506`, `:4011` | OE insertion command and selection; 1–5 row/column picker | **missing** public page-break parity/picker integration; reusable built-in table | Actual editable blocks, correct IDs/content and print projection, cancel/repeated click/Undo/save/reload |
| Import/export/statistics/focus — RichEditor `:3976`–`:4033`, `lib/noteEditorContent.ts:58` | OE Markdown/HTML parsing/export, statistics, focus; host download/import acceptance policy | **missing** integrated surface; reusable editor parsing/index and Publish | Import replacement explicitly reviewed; original/unknown archive preserved; correct nested counts; safe exports, no private DB row/widget leakage; cancelled import leaves body unchanged |
| Quick actions/templates/block deep links — RichEditor `:3776` | OE Cmd/Ctrl+K, search/arrows/Enter/Escape, duplicate/delete/move/focus, template insert/save, copy block URL | **missing** template UI/persistence; reusable palette/commands | Templates assign new block IDs while keeping deliberate sync/page reference IDs; host-scoped preference store, old hash compatibility, duplicate/delete Undo and focus return |
| Dictionary hints — RichEditor `:3847`, `:1806` | OE term occurrence UI/highlight/jump; host dictionary entries | **missing** public optional dictionary seam/UI | Exact configured entries, literal safe text, nested body/long note, stale matches, selection/scroll/IME, no dictionary backend transfer |
| Selected text AI/comment toolbar — RichEditor `:496`, `:583` | OE selection toolbar and review; host AI edit/employee routing, comments permissions | **missing** integrated action UI; reusable AI review APIs | No provider calls without explicit fixture/user permission; approved changes only, partial accept/reject/Undo, cancellation and resumed input withdraw stale results |

Observed insert union (23): `text`, `page`, `link`, `card`, `attachment`, `image`,
`video`, `audio`, `pdf`, `unsplash`, `code`, `equation`, `mermaid`, `whiteboard`,
`htmlEmbed`, `syncedBlock`, `collection`, `gallery`, `kanban`, `columns`, `divider`,
`pageBreak`, `tableInsert` (RichEditor lines 1506–1533).

Observed style/action union (21): `heading`, `quote`, `bullet`, `numbered`,
`checklist`, `callout`, `alignLeft`, `alignCenter`, `alignRight`, `indent`, `outdent`,
`fontSans`, `fontSerif`, `fontMono`, `textSmall`, `textLarge`, `clearFormatting`,
`moveUp`, `moveDown`, `moveTop`, `moveBottom` (lines 1538–1559).

## Database, assets and extended blocks

| Feature / observed PA source | Owner and data / actions | OE status and existing public part | Host boundary / required acceptance |
| --- | --- | --- | --- |
| Eleven DB views — RichEditor `:170`, `:2147`, `:3000`–`:3188` | OE view/filter/sort/paging and loaded-row renderers; host rows/schema/config | **reusable** workspace DB runtime and eleven real renderers | table/board/timeline/gantt/calendar/list/gallery/chart/feed/map/dashboard switch and configured fields; no fake row collections; current query limits documented |
| DB CRUD/trash/order/remote paging — RichEditor `:2374`–`:2585`, `lib/api/database.ts:30`–`:90` | OE mutation intent/pending/error; host rowKey/version/sortOrder/deletedAt/row payload | **reusable** Core DatabaseProvider and runtime; receipt/CAS workspace integration **missing** | Correct stable row IDs, durable create/update/delete/restore/reorder, denied/stale/lost ACK/reload, failed hydration cannot overwrite config |
| DB tree rows — `components/NoteTree.tsx:43`, Workspace `:631` | OE expand/limit/show-more/selected row; host pagination/count and row open | **missing** integrated tree section | Stable rowKey, count distinguishes loaded vs total, no duplicated/late rows, allowed row retrieval and selection/reload |
| DB previews — `components/DatabasePreviewDrawer.tsx:22`, `lib/databasePreview.ts:48` | OE bounded visual summary; host permitted row projection/count | **missing** workspace preview integration; reusable renderers | PA preview uses first 8 rows/5 columns, not full database; no loaded-row completion count labelled database total; private fields/rows excluded by projection |
| Basic and extended property values — RichEditor `:171`, `:2942` | OE field editors/validation; host property definitions/value commit | **reusable** basic seven types and NotesPropertyEditor subset; remaining editors **missing** | Each of all 22 kinds classified and exercised; exact unknown JSON retained; host-valued files/user/location/computed/audit remain read-only unless explicit editor provider |
| DB property/schema settings — RichEditor `:2703`, `:3333`, `:3433` | OE add/delete/reorder/property settings/options/formula/relation/rollup/button/format; host schema mutation | **missing** public schema/action contract/UI | Exact schema revision/capabilities; no delete without review, failures leave schema/rows intact; options/IDs preservation and reload |
| Formula/relation/rollup — RichEditor `:2638`–`:2670`, `:2952` | OE bounded expression/relation UI; host authoritative calculation/schema/target permissions | **missing** complete computation contract; relation references reusable | No `eval`/`Function`/network; loaded-row summaries distinguished from canonical totals; cycles/budget/invalid expression/denied relation; audit values server-owned |
| DB row drawer/page body — RichEditor `:3201`, `:2585` | OE row body/property editor, row switch, resize/close/page/back-drawer; host row body/schema/durable commit | **missing** reusable row editor; existing onOpenRow callback only | Stable database+row scope, single writer, ordinary editing/style/assets/search, close/cancel/flush/IME, body/properties save/reload/conflict, unknown data lossless |
| Row-local outline/tasks/media/search/comments/history — RichEditor `:3199`, `:3418`–`:3441` | OE same inspector controls, Cmd/Ctrl+S version-save; host row-local records | **missing** | Separate row/document identities; add/resolve comments, history save/name/restore/delete, anchors, persist/reload, pending/denied; row comment delete UI not observed, do not invent parity evidence |
| Assets and attachments — RichEditor `:332`, `:388`, `:426`, `components/assetUpload.tsx:114` | OE image/video/audio/PDF/file presentation compact/card and upload picker; host URL/attachmentId/name/type/size/storage | **missing** unified media specs/picker; reusable Core AssetProvider | Local/cloud/image provider, paste/drop/cover, cancellation/failure without orphan insertion, signed URL/permission, all metadata/style lossless, no implicit upload |
| Unsplash source — `components/assetUpload.tsx:31`, `:163` | OE optional image-source chooser; host image search/catalog | **missing** reusable picker; Core ImageSearchProvider exists | Observed PA is static catalog; configure authorized source rather than claiming live service; network-free synthetic assets for tests |
| Whiteboard — RichEditor `:847`–`:997` | OE independent bounded drawing model, tools/colors/width/selection/drag/eraser/history/export; host drawing payload persistence | **missing** public Document drawing spec/UI; unknown payload **preservation-only** | Pen/highlighter/eraser/line/rectangle/ellipse/select/move/delete, Undo/Redo/clear-confirm, keyboard/pointer, PNG, save/reload, bounded parsing |
| HTML widget — RichEditor `:1098`–`:1223` | OE independent source editor/presets/import/export/mobile preview; host payload/archive/preferences | **reusable** independent HTML widget spec/preview; full preset/source workflow integration **missing** | HTML/CSS edits sync correctly with source, JS data retained but never executed, sandbox/CSP/no requests, bad import/cancel keeps original, unknown fields and legacy roundtrip |
| Document columns — RichEditor `:1530`, `:1758` | OE independent column editing/layout/keyboard/touch; host legacy archive | **reusable** `createDocumentWorkspaceFeature`, columns guard/actions; old structures **preservation-only** until mapped | Nested width/reorder/move/Undo/save/reload, touch/keyboard/320px, no empty-child normalization loss, excluded paid/GPL implementation never imported/copied |
| Synced editable block — RichEditor `:1225`–`:1298` | OE shared-content editor/selection; host sync identity/content revision/authorized scope | **missing** durable public synced editor/provider; read-only transclusion reusable | Two-view CAS, denied/stale/cancel/lost ACK, original data retained; legacy browser storage/event syncing is not server collaboration |
| Canonical but non-live types — `lib/domain.ts:150`, `editorAdapters/unifiedNotes.ts:12` | OE inert rendering/codec; host untouched raw archive and provider fields | **preservation-only** | All unknown fields/blocks/styles/IDs preserved through import/open/save/reopen/export; no hidden deletion/retyping/truncation or public export leakage |

Observed DB property union (22): `text`, `number`, `select`, `multi_select`,
`status`, `date`, `user`, `files`, `checkbox`, `url`, `email`, `phone`, `formula`,
`relation`, `rollup`, `created_time`, `created_by`, `last_edited_time`,
`last_edited_by`, `button`, `location`, `id` (RichEditor lines 171–174).

OE Core runtime editable property metadata is seven kinds:
text/number/boolean/date/url/select/status; unknown is display-only.
`workspace/revisionedNotesResource.ts` additionally validates
text/number/boolean/date/url/email/phone/select/status/multi_select/relation.
Computed/file/user/location/audit properties explicitly require a host editor;
the validator is not proof of a complete 22-kind public database engine.

## Modes, cooperation and saving

| Feature / observed PA source | Owner and data / actions | OE status and existing public part | Host boundary / required acceptance |
| --- | --- | --- | --- |
| Document/Canvas/Present/Site shell — `components/NoteWorkspaceModes.tsx:47` (447 lines) | OE four-mode switch/templates3/themes6/site widths390/768/1440/draft UI | **missing** reusable integrated shell; CanvasEditor/Publish parts **reusable** | Current config reproduces modes, direct/local document projections, no mode change during IME/unconfirmed save, keyboard/focus/reduced motion/narrow layouts |
| Canvas layout persistence/recovery — `components/NoteCanvasWorkspace.tsx:13`, `components/noteCanvas.ts`, `lib/api/canvas.ts:13` | OE draft/validation/save lifecycle; host layout/view/theme revision and document version | **missing** public workspace lifecycle; Canvas model **reusable** | Failed initial hydration cannot replace saved config, revision conflicts preserve local draft, body token unchanged, reload recovery/flush before navigation |
| Present/Site projection and local export — `NoteWorkspaceModes.tsx:47` and Publish imports | OE safe renderers and preview/export UI; host allowed export projection | **reusable** renderOpenEditorPresentation/renderOpenEditorSite; shell integration **missing** | Data allowlist, widget/unknown/private DB rows remain inert/excluded, responsive preview, no publish/deploy implied by local export |
| Ask this page / agent panel — `NoteWorkspaceModes.tsx:47` | OE question/result/panel layout; host provider and allowed context | **missing** public optional shell callback integration | Honest synthetic/provider label, explicit invocation, cancellation/limit/stale context, no automatic paid calls, safe quoted context |
| Quiet proposals — `components/DocumentProposalPanel.tsx:19` (259 lines), `editorAdapters/hostProposalTiming.ts`, `syntheticAheadWorkflow.ts` | OE proposal/timing/review/UI; host scoped planner/authorization/persistence receipt | **reusable** AI session and cooperation/organization APIs; full Notes integration **missing** | Safe viewport rail/chip, short/500block/bottom/320px/zoom, continuous-input/IME suppression, dismissed plan stays dismissed, review before changes, Undo and stop/lost ACK |
| Document writer ownership — `components/NoteEditorPane.tsx:201`, `editorAdapters/openEditorWriterRole.ts`, `hooks/useBlockSync.ts` | OE pending/edit/switch orchestration; host writer entitlement/canonical revision/commit outcome | **missing** public Notes writer lifecycle; existing bridge parts reusable | One writer/document, legacy quiesce before acquire, drain pending DB writes, conflict draft retained, late host read/save/approval cannot overwrite human input or new document |
| Scoped host resource changes — `editorAdapters/NotesCandidateRowReview.tsx`, OE `workspace/revisionedNotesResource.ts` | OE single-flight/recovery/patch editor; host atomic authorization+CAS+receipt | **reusable** revisioned resource coordinator; workspace wiring **missing** | Persist ticket before submit, exact named-field patches rather than cached full-row replace, unknown receipt lookup/no blind resend, reload and permission change |
| Offline/sync/collaboration — App/session state, block sync and synced block source | OE honest pending/offline/error UI; host transport/auth/realtime | **missing** verified server collaboration | Real transport must be separately connected/verified; do not label browser events/noop collaboration as CRDT or remote sync |

## Ownership and preservation contract

`lib/domain.ts:106` defines Note metadata; `:133` comments; `:141` versions;
`:150` block data. `editorAdapters/noteBlockFieldOwnership.ts:27` classifies every
known NoteBlock key at compile time. Unknown runtime keys are opaque-preserved.

| Data | Owner / permitted responsibility |
| --- | --- |
| Block IDs, type and children | Structural identity; OE may alter through explicit supported editing only, host validates canonical revision |
| inlineContent/text/headingLevel/codeLanguage/columnWidth/checked/tableContent/tableProps/databaseView/databaseConfig | Editable semantic fields; OE editing and validation, host authoritative persistence |
| page/link/asset/tool payloads incl. HTML/drawing/sync identities | Typed block payload; explicit reviewed editor only, preserve otherwise |
| version/sourceType/sourceId/preservedAPIBlock | Host metadata; merge current host values by stable ID; never fabricate or take from stale view |
| databaseRows/databaseRowsLoaded/databaseRowCount | Provider-owned runtime data; never serialized from OE view into semantic document |
| Unknown blocks/styles/fields and original legacy records | Host-owned raw archive/sidecar; inert/recoverable, outside AI context/public exports |
| Created/updated times and actors, privacy/sharing/access | Host/server authority; UI display/actions do not grant access |
| Preferences: sidebar/tab/split/order/gallery/template/local draft | OE state and generic configured host storage; preserve existing host key migration explicitly |
| DB/auth/file/AI/search/voice/webclip services | Host adapters; no PersonalAI-only dependency, credential, router or backend in OE package |

PA `app/App.tsx:405`–`:429` holds page order, comments, versions, icon and local
notes storage and passes NotesWorkspace props at `:1863`. UI state may move to OE;
existing shared application records used by Home/Inbox/WebClipper must continue
through a host adapter rather than introducing a competing Notes writer.

Reusable OE preservation APIs include `document/legacyNotes.ts`, unknown
envelopes, `applyNotesMetadataEdits` and `createRevisionedNotesResourceEditor`.
Core `providers.ts` supplies pages/backlinks/database/comments/versions/assets/
imageSearch/AI seams. Old CommentsProvider/VersionProvider have no operation
receipt or CAS tokens: workspace mutations need the stronger scoped host contract,
not an assertion that those optional signatures already enforce atomicity.

## Observed limits that acceptance must not hide

- PA tree move at Workspace line 557 updates local `setNotes`; this function is
  not evidence of durable server parent mutation or reload persistence.
- Document comments/history are local optimistic state plus optional API calls;
  failure can mark API offline. Version restore saves body and title separately.
  New acceptance must prove confirmed atomic behavior rather than copying that
  local optimistic pattern.
- Row-local history/comments at RichEditor lines 3242–3277 use storage keys scoped
  by database ID and row numeric ID. Their durability differs from remote document
  histories. Row comments expose add and resolve; delete was not observed.
- Legacy formula at lines 2638–2670 uses `Function` after arithmetic filtering;
  it must not be transferred. Independently implement bounded parsing or a typed
  host calculation seam. Legacy rollup calculates only loaded current DB rows.
- SyncedBlock uses localStorage, storage events and a custom window event. It is
  browser-local reuse, not evidence of server sync, authorization or CRDT.
- PA Unsplash is a static catalogue; no live search-service acceptance exists.
- DB preview intentionally uses the first eight rows/five properties. Loaded
  completion/group summaries must not be presented as full database totals.
- `NOTES_EDITABLE_TYPES` contains 19 live types. The canonical 26-type model and
  unknown preservation do not establish editors for all canonical records.
- Source/current package names or passing model tests do not prove modern visual
  quality. Use actual before/after screens and independent design review.

## Completion gate

Do not mark full Notes ownership complete until a documented public export/preset
and isolated package consumer can reproduce the current configured workspace using
only installation + host adapter + configuration. The matrix above requires
actual fixture verification of ordinary editing and all exposed controls;
persist/reload; tree move/order; permissions/cancellation/conflicts/lost ACK;
unknown/legacy lossless preservation; short and 500-block documents; document
bottom; 320px/zoom; IME/continuous typing; reduced motion; focus/keyboard/Escape;
and safe mode/import/export behavior. Real services remain explicitly unverified
unless connected under separate authorization.

Use independent code/design review and final typecheck/tests/build/real-browser
evidence. Preserve `.0`–`.5`, current WIP and PR37 main; record migration in a new
branch/candidate. PA removal is a separate owner action after feature acceptance;
production data deletion is prohibited. Current scope permits no new push,
merge, npm publish, deployment, credential/security changes or paid model calls.

See `notes-parity-audit.md` and `notes-parity-license-record.json` for provenance.
Private Notes implementation is not copied. The excluded
`@blocknote/xl-multi-column` implementation is not inspected/imported/copied;
columns and HTML preview remain independently authored with JS execution off.
