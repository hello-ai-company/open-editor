# Notes parity candidate: audit and staged acceptance

Audit 2026-10-06. OpenEditor baseline main `6ac78a3`, published runtime source
`43ee878` (five immutable 0.2.0 packages). Candidate worktree
`open-editor-notes-parity`, branch `codex/notes-parity-0.3`; local only.
Notes observed at `3a2104c` with active uncommitted integration changes. It remains
read-only here; do not write or replace its adapters/WIP. Only this implementation
thread writes the OpenEditor candidate. Earlier release worktrees and artifacts
are preserved. This document is an implementation plan, not a completed parity claim.

## Full exposed-surface inventory

Sources: Notes `apps/web/src/components/NoteRichEditor.tsx` (23 insertion kinds,
21 style kinds, 22 database property types, 11 database views), `lib/domain.ts`
(NoteBlock fields), `editorAdapters/noteBlockFieldOwnership.ts`, note pane,
proposal/mode panels and their contracts. Requirements are observed rather than
copied from the private implementation. Additional items found by independent
review must be added before claiming inventory closure.

| Notes surface | OpenEditor 0.2.0 | Candidate work / acceptance |
| --- | --- | --- |
| Paragraph, heading, quote, bullet/number/check lists, divider, table | Existing BlockNote schema/commands; table is not a database | Reuse; verify styles/selection/keyboard roundtrip |
| Indent/outdent, alignment, move up/down/top/bottom, clear formatting | Existing power commands or public BlockNote API | Wire coherent toolbar/menu; avoid duplicate host operations |
| Font sans/serif/mono and small/large | No bundled custom fontFamily/fontSize specs | Public safe style specs and controls; retain unknown style values without applying arbitrary CSS |
| Code with highlight, TeX equation, Mermaid | Optional public code/math/diagram features exist | Reuse reviewed existing peers; retain source, no external renderer calls |
| Child page, mentions/backlinks, transclusion and block references | Public providers, schema, UI exist | Host adapter only; retain authorization and stable IDs |
| Callout icon vs variant/title | Name matches but schemas differ | Explicit icon-preserving schema/adapter; no silent default replacement |
| Web link text/card/article/portrait; visual card | Generic blocks/host spec needed | Safe public presentation/editing spec; do not fetch URL metadata automatically |
| Attachment/image/video/audio/PDF and compact/card layout | Public assets/upload provider types and base media blocks | Reusable asset UI, metadata/host adapter; no implicit upload, credentials or gallery account |
| Unsplash picker | ImageSearchProvider host seam; no account integration | Host adapter; no paid/new external requests in candidate tests |
| Page break | No public document block | Independent block and print projection |
| Column creation, widths, move/reorder, nesting, keyboard/touch | Canvas layout exists; no Document column editing; legacy structure retained/exported | Independent Document columns using public API; no paid extension; legacy types import/export losslessly |
| HTML widget HTML/CSS/JS editing, presets, import/export, mobile preview | Unknown-block preservation only | Public editor + sandboxed network-free preview; JS data retained but execution disabled; no blanket script capability |
| Whiteboard pen/highlighter/eraser/shapes/select/move/Undo/Redo/PNG | No Document drawing tool | Independent bounded drawing model/UI; pointer/keyboard history and safe local export |
| Synced editable block | Read-only transclusion/reference seams | Revisioned host-neutral synced-content editor/provider; two-view CAS tests; host authorization remains authoritative |
| Collection/gallery/kanban | Existing eleven database renderers | Reuse real DB/view engine, not static mock collections; host data/config adapters |
| DB text/number/select/status/date/checkbox/url | Seven public editable property types | Existing runtime/editors; boolean maps checkbox |
| DB multi_select/user/files/email/phone/location/id | unknown/read-only normalization | Portable extended metadata/value editors and validation; user/file/location providers/identity remain host-owned |
| DB formula/relation/rollup | No calculation engine; inline databaseRelation is a separate reference | Bounded deterministic formula and rollup contracts, relation editor; no eval/Function/network; host executes/persists authoritative computations |
| DB created/edited time and actor | Unknown/read-only | Typed immutable audit display; server owns values |
| DB button/property settings/add property | No generic schema mutation action | Optional host-neutral schema/action seam with explicit capabilities/authorization; disabled when absent |
| DB query/filter/sort/pagination/trash/reorder/row editor and eleven views | Public implementation exists | Reuse; AND/single-sort limits documented; tests must distinguish loaded-row summaries from database totals |
| Saved views, durable row saves, DB create/schema change | Saved-view provider/runtime exists, backend not bundled | Reuse host persistence; failed hydration cannot overwrite config; no row data embedded in document |
| Row detail drawer/page and row-local history/comments | onOpenRow callback only; no full row body UI | Reusable host-backed row detail component and scoped revision/comment integration |
| Comments, history save/restore/rename/delete | Public optional provider types; host-specific UI | Public revision-anchored UI, explicit restore preview/CAS; keep records outside semantic document |
| AI review/provenance, partial accept/reject/Undo and human edit protection | Suggestions/ahead exist; synchronous local writer | Durable async review coordinator, pending/unknown receipt reconciliation and conflict-safe history |
| AI cancellation/pause/resume, budget/access | Ahead acknowledgement/budgets exist; host policy separate | Reuse, verify no cancelled restart; include scoped authorization hook and safe denied/stale states |
| Document/Canvas/Present/Site, export Markdown/DOCX/PDF-print/HTML | Existing distinct modes and static projections | Preserve privacy allowlist; do not make widgets/private DB rows public accidentally |
| Block templates, reference identity, deep links | No template storage UI; block-reference JSON differs from old note href | Independent template codec/UI, distinguish new block IDs from retained sync/page references; preserve old deep links |
| Focus/statistics/task/media panels and dictionary terms | Some demo-only panels; not all public components | Public reusable panels and host-neutral dictionary callback |
| Offline/sync/realtime and human collaboration | Noop collaboration seam only | Host transport/auth remain owned by host; do not claim CRDT collaboration |
| Note layout/cover/icon/privacy/folders/search/trash/service integration | Host workspace/account state | Reusable optional host seams/UI where editor-specific; no account/router/backend migration or competing Notes writer |

## Exact insertion/style/property checklist

Insertion (23): text, page, link, card, attachment, image, video, audio, pdf,
unsplash, code, equation, mermaid, whiteboard, htmlEmbed, syncedBlock, collection,
gallery, kanban, columns, divider, pageBreak, tableInsert.

Style/action (21): heading, quote, bullet, numbered, checklist, callout, alignLeft,
alignCenter, alignRight, indent, outdent, fontSans, fontSerif, fontMono, textSmall,
textLarge, clearFormatting, moveUp, moveDown, moveTop, moveBottom.

DB property (22): text, number, select, multi_select, status, date, user, files,
checkbox, url, email, phone, formula, relation, rollup, created_time, created_by,
last_edited_time, last_edited_by, button, location, id.

Root automated union extraction corrected the DB count to 22 (15 outside the existing seven kinds). Independent read-only audit reviewed the surfaces and highlighted row-specific
history/comments, callout icon mismatch, old deep links and template reference-ID
policies. Audit was static (not a second runtime test). Each item above remains
open until it is either verified public functionality, a documented adapter-only
requirement, or an explicitly unresolved candidate gap.

Canonical (26): paragraph, heading, bullet_list, numbered_list, checklist, quote,
callout, code, image, file, pdf, divider, toggle, table, database, embed, meeting,
ai, drawing, canvas, child_page, web_link, asset, editor_tool, column_list, column.

Live editor (19): paragraph, heading, bullet_list, numbered_list, checklist, quote,
code, divider, pageBreak, database, table, callout, asset, child_page, webLink,
image, editorTool, columnList, column. A canonical record without an existing
editor is a preservation/import requirement, not proof that Notes already edits it.

## Preservation contract

Never silently drop unknown legacy fields. New compatibility APIs must retain the
original JSON-shaped record and unknown fields in a **host-owned sidecar**, outside
AI context/public export/semantic document; provider rows and server versions must
not become editor-owned values. Mapping is explicit and versioned. Export merges
current host-owned fields, writes only reviewed editor-owned fields, and rejects
ambiguous identity/type/budget conflicts. Failed import/open/save keeps raw bytes
and current edits. Unknown blocks/styles remain inert but recoverable. No change
to schemaVersion 1 is planned; no implicit split/truncate/downgrade.

## Stages and required evidence

1. Audit/license/design closure: every exposed Notes insertion/style/DB type and
   NoteBlock field classified, no third-party/private implementation transfer,
   independent audit reviewed; explicit host boundaries and candidate version.
2. Preservation + Document columns + HTML widget: public exported APIs/types/specs,
   normalized and old-record fixtures with unknown fields, save/reopen, widths,
   nested blocks, keyboard/touch, repeated controls/close/cancel, narrow screen and
   reduced motion. Widget payload is inert with sandbox/CSP, no external requests,
   no script execution, safe editable source/import/export/presets.
3. Remaining parity + collaboration: extended properties/styles/assets/drawing/
   synced content/history interfaces and UI are real rather than placeholders;
   deterministic model tests and mock host integrations; async CAS/conflict/lost
   acknowledgement/permission denial/partial approval/history/Undo and cancelled
   resume regressions. Account/database authorization remains server-owned.
4. Package handoff: root and optional React exports proven in isolated candidate
   tarball consumers, meaningful regression tests, typecheck/build/full verify,
   exact inventories/licensing/security checks, actual browser tests and read-only
   independent code review. Publish/remote push/merge/deploy/real AI calls excluded.

## License/provenance decision

See [machine-readable license record](notes-parity-license-record.json). Existing
BlockNote public core/react/optional feature packages are MPL-2.0; React/Tiptap
observed licenses are MIT, with Tiptap third-party notices retained. We use public
APIs and do not alter or copy their implementation. The legacy column extension
reports GPL-3.0 OR PROPRIETARY: its implementation is excluded from inspection and
from the candidate. Private Notes has no repository license located: its
implementation is not transferred. New code/fixtures are independently authored
from required behavior and data-field names. No legal clearance is inferred merely
from independent implementation. Any unlicensed/proprietary transfer or new
contract requirement stops that portion rather than acquiring permissions.

[MPL license](https://www.mozilla.org/en-US/MPL/2.0/),
[MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).

## Integration handoff

The candidate APIs must live under documented package exports, not deep imports.
Document columns/widget block specs and host-neutral codec helpers belong to
editor-blocknote; small generic portable types stay in Core; async reviewed-change
coordination belongs to editor-ai; existing Canvas and Publish projections stay
separate. A local candidate package inventory, exact versions/dependency floors,
API examples, fixtures and review findings are in [candidate handoff](notes-candidate-handoff.md)
and [verification record](notes-candidate-verification.md). This continuation supplies
the bounded columns/widget/codec/cooperative-review phase and workspace visual
polish; the full inventory above remains a roadmap, not a completion claim.
