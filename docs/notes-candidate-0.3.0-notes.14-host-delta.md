# .14 public host delta

Import from `@hello-ai-company/editor-blocknote/react`:

- `NotesCoverPreset`, `NotesCoverCatalogRequest`, `NotesCoverCatalog`;
  `NotesStyleGalleryButton` and expanded `NotesPageAppearanceOptions`.
- `NotesSelectionAction`, `NotesTextSelection`, `NotesSelectionAIRequest`,
  `NotesSelectionAIResult`, `NotesSelectionAIService`, `NotesSelectionTools`.
- Optional `selectionAI` on NotesWorkspace/NotesTabbedWorkspace/document props.
  Optional live-selection methods on NotesEditorBridge.

Existing API callers remain compatible. Appearance keys are explicitly mapped;
coverAlt/coverLayout are optional. Distinct style/cover/alt/layout keys are required
for editing. Original unknown metadata never authorizes an edit or becomes a
default mapping. Cover catalog read receives scope, exact page/row target,
snapshot revision and AbortSignal. Results must echo those values and contain
at most 100 unique IDs with bounded names/alt, safe HTTP(S) URLs, known optional
style/layout. No credential URLs, data/javascript URLs, inferred upload provider
or external stock preset download. The host owns authorized asset references.
Async late/foreign results and synchronous host exceptions are handled.

Gallery previews a retained patch cover only when the current authorized catalog
contains its exact URL; an existing host snapshot cover is preserved separately.
Apply checks original source/mapping/catalog/current own input and uses the
existing CAS/evidence/receipt controller. Provider/source replacement makes
retained input inert until revalidated; staged cover mutation cannot bypass the
catalog. Custom renderCoverControl receives only a verified preview reference
and truthful editable state. Host callbacks still own their independent lifecycle.

Selection service is invoked only by explicit user Generate. It receives a new
requestId; scope, target, revision/contentRevision; selection id/blockId/text;
action improve/shorten/expand/rewrite; bounded instruction and AbortSignal.
It receives no implicit whole-note context or web authorization. Results echo
requestId/scope/target/revisions/selectionId and plain text (nonempty, <=50,000).
Cancellation, service replacement, changed source/range/entitlement/IME/status,
another input and changed own cache fence invocation and settlement. The host
must enforce authorization, provenance/privacy and billing itself.

The live writer issues opaque single-block tickets. Blur into the dialog preserves
the public editor range; moving away/back or replacing the writer revokes it.
`replaceSelection(selection,text,localDraftId,expectedLocalDraft)` verifies the
entire reviewed local JSON fingerprint immediately before a local transaction.
Successful replacement publishes with the existing controller.setDraft; it does
not save or create a separate receipt. Undo is a conditional local restoration
of the exact pre-replacement draft, only if writer, scope, target, both revisions,
body and input state still match. After Save/new edits/writer disposal it is
unavailable. No historical/Secretary/durable Undo semantics are claimed.

Selected comments preview the captured quote but save only source blockId/text
through comment.add. Dirty body must be saved first. No schema changes or durable
character-range anchors are inferred. Close retains input, Cancel is conditional,
denial/conflict/unknown outcomes stay under the existing controller's recovery.

## Common versus host follow-up

Common changes in .14: reusable cover/gallery and selected AI/comment UI, live
range/cache/IME/Undo guards, common CSS and standalone full-width behavior.
Pending common work: full original59/35 parity, compact typed table cells, map pin
collision/zoom design, additive generic viewId/parent invalidation/view-config
receipt contracts. Existing .13 public APIs remain compatible.

PA .13 host fixes already verified by its owner: exact known table canonical
binder, actual authorized history payload/preview, count-aware Comments selectors,
fixture DB61 viewId binding, guarded clean-parent refresh, separate view-config
receipt/CAS/journal/reconciliation, 11-view roundtrips and pending-input retention,
unmounted Journal compatibility. These are bounded synthetic host checks, not
.14 production acceptance.

PA .14 adoption still required: exact cover metadata/catalog/24 presets/assets
mapping, selected AI consent/provenance/provider/receipts, comment semantics and
existing canonical save path. Keep all old UI and unknown data until paired gates
pass; do not replace host authorization or existing transaction ownership.
