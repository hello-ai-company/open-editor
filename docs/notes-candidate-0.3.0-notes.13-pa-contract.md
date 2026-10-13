# PA .12 acceptance discrepancies and .13 follow-up

Read-only source inspection of the independent `personal-ai-notes12-host` candidate,
its `mac-evidence/notes12-host/{HANDOFF,OE-NEXT-DELTA}.md` and shared SDK code.
No PA source, previous 1337-file candidate, authorization or server data was changed.
PA reports API109/Web477/build plus scoped Chrome success; those counts are host
owner evidence, not tests run by this SDK candidate. Full59/full35 remains pending.

## Per-target Canvas — common SDK fixed

PA `apps/web/src/features/notesMigration/NotesMigrationTrial.tsx` creates Canvas for
all targets while its Modes component already renders rows through
SyntheticRowPropertySurface. Row hosts do not have Canvas body-revision/entitlement.
Before .13, factory return type and session canvas.identity dereference required a
controller anyway. .13 accepts and caches undefined and keeps other writer guards.

Host integration: return undefined when `target.kind === 'row'` unless that exact
row has a real Canvas contract. Keep the existing row surface and ordinary scoped
property/action writer. Keep page Canvas construction unchanged. Do not infer row
Canvas authorization from page authorization. The synthetic .13 browser route
exercises rows without Canvas; paired PA connection/reload remains a host gate.

## Table persistence — host admission, not a browser defect

The SDK .12/.13 browser and installed consumer preserve actual table rows/cells,
selected insertion size, JSON and automatic column positions. BlockNote undefined
automatic widths are stored as JSON null in the known tableContent.columnWidths
array and restored to automatic editor widths on load. Unknown undefined arrays
still fail. The v2 legacy codec does not authorize arbitrary rich data writes.

PA `apps/api/personal_ai/services/notes_workspace.py:bind_reviewed_document` maps
only paragraph, heading, checklist, bullet_list, numbered_list and quote, checking
exact IDs, parents, text/marks and owned properties. It rejects table with
notes_document_binding_required before persistence. The web host's capability
projection likewise grants generic document.save only for the reviewed text shapes.
`apps/web/src/lib/noteBlockSync.ts` has a table conversion using
`content.kind='table'`, `rows` and `table_content`, but that conversion alone is not
server admission. A durable generic receipt for text cannot prove a table save.

Required host change: explicitly bind reviewed table nodes to the canonical table
record's complete table_content, including row/cell shape, inline marks, header and
automatic/explicit column-width positions; compare exact IDs/parents and bounded
known properties, preserve unknown archived fields, then use the existing CAS and
operation/history receipt transaction. Do not flatten table text into paragraphs,
remove unknown fields, bypass the binder or silently broaden document.save.

Host acceptance must test insert/cancel/3×4 shape, edits and JSON reload, null versus
explicit widths, stale IDs/parents, malformed cells/marks, conflict and lost ACK
lookup without resend. The actual PA table path is unaccepted until those pass.

## History body preview — two host format paths

The SDK accepts optional authorized `NotesHistoryRecord.document` (EditorDocument)
and title. Its details preview reads at most40 index entries without restoring,
writing or fetching the current body. The .13 synthetic reading probe verifies it.

PA `apps/api/personal_ai/api/v1/notes_workspace.py:panels` returns
snapshot.server_blocks as `blocks` and snapshot.reviewed_document as `document`.
The web `features/notesMigration/host.ts:readPanels` type declares blocks without
document, but its `{blocks,...version}` rest spread preserves an actual JSON
document field when blocks are absent. When blocks exist, it overwrites that field
with importLegacyNotesBlocks(tree(blocks)).document. This is not evidence that all
returned documents are dropped. Explicit history.save in notes_panels.py and
Journal creation can store server_blocks/reviewed_document. The two payload paths
need explicit typing/validation and version-specific browser evidence.

Ordinary document-save before-history in notes_workspace.py instead adds raw_blocks
and retains the original repository snapshot, without establishing server_blocks or
reviewed_document. The endpoint does not expose that raw archive as a preview.
These historical formats must be handled separately; do not substitute the current
document or reuse the newly saved after-version as the previous version.

Required host follow-up: explicitly validate/type a returned authorized
EditorDocument and document the precedence when both it and server_blocks exist.
Otherwise project authorized complete historical server_blocks. For raw-only older
formats, use their exact archived historical order/IDs/parents and reviewed text
projection if available; keep the archive and omit preview when safe projection
cannot be established. Reauthorize every version for workspace/document/actor.
Reading remains separate from existing expectedVersionRevision restore receipts.
The reported PA preview failure alone does not establish which payload path failed:
the actual version response, source format and restored panel/layout must be recorded.

Acceptance: explicit checkpoint and automatic-before-save histories, different
before/after text, correct version title/order, missing/unknown formats, scope/target
denial, reopen/reload, cancel and restore distinction. No actual PA browser preview
success or Safari/native-IME claim follows from the synthetic SDK result.

## Browser and CSS evidence boundaries

SDK verification uses local Chrome154, synthetic data and explicit blocked external
requests. PA reports its own scoped Chrome successes and a later panel rerun timeout
attributed to persisted layout. The recorded panel-ui-failure.txt specifically
waits for exact tab name Comments, while the rendered text includes Comments 1;
the recorded failure is an exact-selector/panel-state issue before a preview
assertion, not evidence of a missing history payload or broken SDK preview.
The additional reported preview failure has no recorded version response here;
its actual payload and layout still need paired verification. Native
IME, Safari, zoom, full35 CSS and all59 application workflows remain unverified.
Standalone uses the supplied width from x0; actual PA embedding supplies its owner
width and must not add a second inferred host-sidebar reserve.
