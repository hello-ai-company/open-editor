# Notes candidate handoff — local, unpublished

This is an independent, phased OpenEditor candidate. It is **not complete Notes parity**, a production migration, or a new npm release. Official 0.2.0 artifacts remain immutable. Candidate artifacts use `0.3.0-notes.0` in temporary packaging manifests; repository release versions remain 0.2.0. No private Notes implementation or proprietary multi-column extension was transferred.

## Public exports and integration

`@hello-ai-company/editor-blocknote` exports:

- `createDocumentWorkspaceFeature`, `createDocumentColumnsBlockSpec`, `createDocumentColumnBlockSpec`, `createHtmlWidgetBlockSpec`, `DocumentColumnsGuard`, `applyDocumentColumnsAction`.
- `DOCUMENT_COLUMNS_TYPE = "oeColumns"`, `DOCUMENT_COLUMN_TYPE = "oeColumn"`, `createDocumentColumns`, `validateDocumentColumns`, `updateDocumentColumns`, `DocumentColumnsAction`.
- `HTML_WIDGET_TYPE = "oeHtmlWidget"`, `HtmlWidgetSource`, `parseHtmlWidgetSource`, `sanitizeWidgetMarkup`, `createHtmlWidgetPreview`, `HTML_WIDGET_PRESETS`, `MAX_WIDGET_SOURCE_CHARACTERS`.
- `createDocumentTypographyFeature`, `createDocumentPageBreakBlockSpec`.
- `importLegacyNotesBlocks`, `exportLegacyNotesBlocks`, `LegacyNotesArchive`, `LegacyNotesImport`.

`@hello-ai-company/editor-blocknote/react` exports `QuietCooperationCard` and its props. Import `@hello-ai-company/editor-blocknote/power.css` for document workspace and review styles. Features are opt-in; supply workspace and typography features to the existing power preset `features` array and use its schema/editor options. The column extension uses public BlockNote APIs plus ProseMirror decorations; declare the existing `@tiptap/pm ^3.31.3` peer. No new package was installed.

`@hello-ai-company/editor-ai` exports `createDurableReviewCoordinator` with reviewed snapshot/request/result/receipt/provider/state/outcome types, and `createQuietCooperationSession` with status/snapshot/provider/session/proposal types. Core 0.2.0 remains the peer contract. Package tarball runtime and declaration consumers are validated locally without network installation; run `node scripts/qa/package-notes-candidate.mjs` after building to reproduce them. Integrity and file inventories are in `output/candidate/manifest.json`.

## Column and widget storage contract

Columns are `oeColumns {gap:16}` with 2–6 `oeColumn {width:number}` children, which own ordinary nested blocks. Width is finite 0.1–10 (the demo slider intentionally offers 0.1–4), gap finite 0–64. IDs and all children survive detached width/reorder/move/merge/unwrap operations. Removing a column requires an explicit destination and at least two columns remain. Invalid trees/cycles/orphans are rejected before a transaction; no silent flattening. Width updates preserve the editor caret; structural replacement restores the block ID but currently can reset its inline selection offset. This structural-selection limitation must remain in the host acceptance gate.

Widget props are `title, html, css, javascript`; source is bounded to 200,000 characters. Presets, HTML/CSS/JavaScript source tabs, import/export, Apply/Cancel and responsive preview are supplied. Apply compares against the opened source; late import completion cannot reopen a cancelled editor. The candidate preview is deliberately inert: `sandbox=""`, `script-src 'none'`, `connect-src 'none'`, no resource URLs/event handlers/embedded active content. JavaScript is retained/exported but does **not execute**. This differs from PersonalAI's requested opaque `allow-scripts` preview. **Keep that host fallback; do not claim HTML execution parity or widen the sandbox to make acceptance tests pass.**

## Legacy codec: preserve first, persist once

```ts
const imported = importLegacyNotesBlocks(hostNoteBlocks);
// Keep imported.archive on the host side, outside model/context/public state.
const editorBlocks = toBlockNoteForSchema(imported.document, schema);
// Later, obtain a fresh authoritative host snapshot and server revision:
const noteBlocks = exportLegacyNotesBlocks(
  fromBlockNote(editor.document), imported.archive, currentHostNoteBlocks,
  { supportedStyles: ["fontFamily", "fontSize"] }
);
// Host canonical save performs revision CAS; await acknowledgement, then re-import.
```

The archive has `codecVersion:1`, ID-keyed `records.{original,projected}` and a structural fingerprint. It retains source/version/provenance, host metadata, DB data/config/lazy state, table properties and unrecognized fields. Unknown blocks project to inert `notes:TYPE` blocks; schema conversion uses public unknown envelopes. Unsupported rich styles also use a preservation envelope rather than silently stripping marks. An unchanged save retains original strings/empty content/default props exactly.

Export validates the complete record set and fresh host structure/projection/identity, including concurrently edited blocks that the editor has deleted. Changed host content, identity, version-related ownership or unknown deletion pauses saving. Do not catch a preservation error and fall back to a lossy mapper. `allowUnknownDeletion:true` is an explicit host policy override, never automatic cleanup. Unsupported new block types or unrepresentable props need a reviewed host creation codec; newly inserted HTML widgets currently require that host mapping. `tableProps` is retained but advanced table edits are not yet mapped.

Known aliases include headings, lists/tasks, code→codeBlock, image, table, callout, page break, columnList/column_list/column and editorTool/editor_tool `htmlEmbed`. Legacy widget `{html,css,js}` spelling, extra fields and JSON-string/object representation are preserved. Acceptance requires deep comparison of untouched IDs/tree/content/properties, not just visible text. There is one writer: host owns canonical storage, revisions, auth, row providers, URL regeneration and history. Display-only DB projections are not save payloads.

## Quiet cooperation and durable approval

Quiet sessions start `enabled:false`. Explicit enable permits bounded preparation after a full idle window (default 1.2 seconds). IME, inactive/hidden views, human edits, rejection and stopping invalidate or suppress proposals. Cancellation must receive a stop acknowledgement before another run; missing ACK leaves `blocked`, never starts another generation. Same-value active notifications preserve ready proposals. Snapshot `enabled` is authoritative for the checkbox; changing the document port remounts the demo session and clears prior Undo receipts.

The provider prepares a hypothesis plus a validated suggestion group. Session/card never execute tools or write documents. The demo uses local synthetic content only: secretary/assigned agent labels, intent hypothesis, state, manual diff and explicit paragraph-batch approval. It does not imply a real PersonalAI run. No actual provider, credentials, billing or outside transmission was added. There is no automatic focus, scrolling, streamed typing or fabricated progress.

Durable review reads a canonical `{revision,document}`, validates the chosen suggestion changes against the current base, and submits an operation-ID-bound request. Provider `commit` must atomically persist CAS revision, document, authorization, history/provenance and idempotency receipt. Browser `authorize` is an early UI check only. Unknown acknowledgements reconcile through `lookupOperation` without replaying uncertain writes. Undo requires the exact committed revision and document, so later human edits are protected. A provider-returned receipt cannot mutate the retained Undo baseline. Cancellation after submission does not claim rollback.

The demo's append-only editor port and IndexedDB autosave are separate from this server contract. PersonalAI's existing durable proposal integration remains insert-only: this candidate does not automatically supply DB-row, arbitrary HTML execution, column reorganization or Canvas-layout AI operations. Keep the existing PA revision/barrier/unknown-draft protection and accept this candidate only after its isolated backend fixtures pass.

## Phased acceptance and remaining work

Implemented and independently exercised: columns, inert widgets, preservation codec, safe typography/page breaks, durable review provider seam, bounded quiet hypothesis session and opt-in review UI. Shared chrome now uses compact 13px mode labels/16px icons, 44px targets, subdued green/neutral tokens, tabular digits, contrast-readable disabled controls, focus rings, brief panel transitions, Reduced Motion and responsive layout. User document styles/Canvas content palettes remain owned by their content.

Full Notes replacement is pending. Extended DB properties/calculations/relations/rollups, row detail/history/comments/trash, advanced table options, whiteboard/synced-block editing, media/page/link host features, all eleven DB view operations and production host acceptance are not certified. Present/Site/Canvas can preserve unsupported blocks using existing placeholders; rich rendering of these new document custom blocks is not complete. Existing host extensions must remain until each feature gate passes. See `docs/notes-parity-audit.md` and license record for exact inventory/independence boundaries.

Not verified: real Japanese/native IME, Safari/native foreground/offline behavior, real assets/uploads, real model transport/cancellation/billing, production authorization/concurrency and every Notes insertion/style combination. Synthetic browser composition events are not evidence of real IME completion. Read the QA evidence before accepting an adapter or publishing a package.
