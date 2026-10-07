# Notes workspace host contract

This document describes the local migration candidate's implemented contracts and
controller. It does not claim full Notes parity, a released package, or production
host support. The feature inventory and each public UI fixture remain separate
acceptance gates. PersonalAI remains read-only to this implementation owner.

## Package boundary and ownership

The candidate source entry is `packages/blocknote/src/notes/index.ts`. Integration
adds it to the public `@hello-ai-company/editor-blocknote/notes` entry. React
workspace/navigation/document-sidebar/inspector/row-detail components are exposed
through the existing `@hello-ai-company/editor-blocknote/react` entry. Consumers
must not use source or `dist` deep imports. Public export and isolated tarball
consumer checks belong to final candidate acceptance.

`createOpenEditorNotesPreset({ host, config, features, databaseViewConfig })`
composes the existing power schema/commands, independently authored Document
columns/HTML widgets, safe typography, page metadata store, database runtime and
one Notes controller. Independently authored drawing/shared specs are included;
shared content is unavailable/inert without `resolveSharedController`. Optional
math/code/diagram features are explicit `features`; this factory does not invent
installed features or providers.
Configured `featureIds` must actually exist in the composed feature registry.
Every store/runtime/controller belongs to its preset instance. No global workspace
bindings, browser storage, router, authenticated fetch or AI implementation is
introduced. The controller never calls a model.

OE owns UI, local interaction/draft state, schema/commands and input protection.
The host owns canonical records, page/row/attachment allocation, access policy,
database/auth/storage/transport/provider secrets, and recovery retention. Shared
PA stores used by Home/Inbox/WebClipper continue through adapters. Moving Notes UI
is not authorization to erase application records or legacy keys.

## Configuration and capabilities

`NotesWorkspaceConfig` is versioned, strict, bounded JSON. It contains presentation
only: navigation sections, seven document panels, three inspector panels, initial
panel/theme/density, locale, panel widths and installed feature IDs. Functions,
unknown fields, mutation grants and unavailable default panels are rejected. The
default config is immutable; each preset receives a detached config.

Canonical document snapshots advertise exact `capabilities: NotesCommandKind[]`
and `capabilitySemantics` for **each** advertised operation:

| Semantics | Meaning |
| --- | --- |
| `local-only` | Confirmed host-local storage; no remote persistence claim |
| `offline-queued` | Pending outbox; a queue ACK is not a canonical commit |
| `remote-committed` | Authoritative server transaction/receipt |
| `test-only` | Synthetic fixture only; not production coverage |

Missing binding, capability or semantics is unavailable. UI must disable it and
explain briefly rather than show false success. Installed schema/feature inventory
does not grant execution. A queued host write returns `pending`/`unknown`, keeps
its durable ticket and is queried; only a later `remote-committed` receipt may
establish server persistence. Receipts cannot silently change a local/test
operation into a remote capability.

Existing PA tree reparent/order, child creation and Trash are local workflows.
Row comments/history and synced blocks also have distinct local semantics. The
test-only named-field resource and synthetic proposal provider remain test-only.
The current APIs do not establish atomic create+initial body, metadata+tree+body,
schema+rows+order, or uniform remote resource receipts. A thin adapter must omit
strong capabilities until it actually implements the guarantees below.

## Identity, canonical reads and pagination

`host.scope` is `{ actorId, workspaceId }`, not credentials. Every document snapshot
and recovery request carries this exact scope. A controller rejects cross-scope
reads and recovery. Journals and UI preferences must use actor/workspace keys;
migration copies old keys into a versioned scope and preserves the originals.

`NotesTarget` is either `{ kind: "page", pageId }` or
`{ kind: "row", databaseId, rowId }`. Row `1` in database A is not row `1` in B.
Row commands cannot target another database/row or execute page lifecycle actions.
Temporary local IDs stay explicit host identities; allocation/remapping is host
owned and must preserve references.

`readDocument(target, signal)` returns canonical `revision` and `contentRevision`,
semantic document, title, opaque metadata, capabilities/semantics and optional
`legacyArchiveRef`. The reference is a host-owned sidecar handle. Raw legacy
records/archive, provider rows and secrets do not enter AI context or public output.
Revision tokens are opaque; changes to raw source/archive also advance the
canonical document revision, even if projected content looks equal.

`readWorkspace(signal, { cursor, parentId, limit })` returns
`{ scope, revision, pages, nextCursor, hasMore, total?, complete }`.
`searchWorkspace(query, signal, { cursor, limit })` returns a page with those
pagination fields. `complete: false` means unseen children/records may exist:
client filtering, counts and cycle checks cannot claim whole-workspace knowledge.
The host rechecks cycles, current siblings, scopes and sharing at commit. The
existing DatabaseProvider retains its own paginated row contract; rows are never
embedded in EditorDocument. Read authorization is enforced at the host boundary,
not inferred from tree membership or a link.

Optional `readPanels(target, signal)` returns canonical comments, history,
templates and attachments with a panel revision. This is presentation data,
not mutation authority. Existing old CommentsProvider/VersionProvider promises
have no CAS/receipt guarantees; they are not sufficient for guarded mutations.

## Typed mutations, history and receipt evidence

`NotesCommand` covers document save; page create/rename/move/duplicate/trash/
restore/explicit permanent-delete; named metadata/property patch; comment add/
update/delete; history save/restore/rename/delete; schema create/update/delete/
reorder; registered database action; template save/apply/delete; media attach/
detach; and shared-content save. It is not an arbitrary method/event dispatcher.
Unsupported commands and unknown payload fields are rejected. Arbitrary callback
presence is not evidence that the inventory is implemented.

Every request contains exact operation ID, actor/workspace scope, target,
`expectedRevision`, `expectedContentRevision`, `expectedPersistence` and typed
command. Every `page.*` command also captures `expectedWorkspaceRevision`; schema/history/
template/shared changes capture the relevant resource revision. Modal editors
must retain their captured catalog/resource revision and draft when refreshed
data becomes stale; never reread then silently treat old user input as a new
approval. Metadata named fields must be host allowlisted. Audit/identity values
are server controlled, and privacy/sharing changes require explicit host rights.
Catalog-driven metadata edits/favorites carry the optional
`metadata.patch.expectedWorkspaceRevision` captured before the modal/action. The
host compares it even if the UI opened that target with a newer document revision.
Current-document metadata edits retain their document/content CAS boundary.

The host transaction must reauthorize and compare all captured canonical/resource
revisions, preserve unedited/unknown fields, apply only named fields, append
original/history and store an idempotent exact-payload receipt. A duplicate
operation ID returns the original result; a different payload with that ID is
rejected. Authoritative conflicts/denials/rejections guarantee non-commit. A
terminal not-found fences/tombstones the ID so no delayed request can commit.

Committed receipts include target, operation ID, canonical snapshot, history ID
and persistence. Document/title/metadata/named property values are compared
directly to the reviewed request. Other commands require `NotesMutationEvidence`
from the canonical resource read:

- Page lifecycle uses canonical page and tree revision; create/duplicate include
  the allocated page/document. Deletion requires explicit canonical absence.
- Comments use exact ID/block/text/resolution; deletion requires canonical absence.
- History uses exact ID/name and snapshot. Restore must exactly reproduce the
  selected version's title/body and version revision.
- Schema uses complete canonical definitions, resource revision and exact named
  edits/order. A partial page cannot prove a property was deleted.
- Templates use canonical ID/revision/source. Applying a template also includes
  the reviewed `afterDocument` and must save that exact document; insertion must
  preserve existing content and remap block IDs before human review.
- Media uses exact block/asset/presentation and canonical attachment or absence.
- Shared content uses shared ID, advancing shared revision and exact document.
- A registered database action uses exact database/row/action identity and a
  canonical revision/result; this is not permission for arbitrary code/network.

Missing, malformed or mismatched evidence is an unknown result, not a success.
The UI rereads canonical catalog/panels as necessary and preserves local inputs
if newer edits have occurred. Real adapters must implement the resource reads
and evidence; the presence of a TypeScript union is not feature acceptance.

## Controller lifecycle and recovery

`createNotesWorkspaceController(host, { timeoutMs, operationId, recovery })`
exposes stable deeply immutable `getState`, `subscribe`, `open`, `setDraft`,
`setComposing`, `save`, `execute`, `cancel`, `reconcile`, `getRecovery`, `dispose`,
`readLatest`, `acceptMergedDraft`.
State holds canonical snapshot separately from the current draft and includes
dirty/composing, message, last confirmed persistence and optional recovery.

`setLocalDraft(id, value)` stores a deeply detached JSON editor-local input in
`state.localDrafts`; invalid raw JSON can be retained as a string. Composite IDs
up to 4,096 characters retain page/database/row/property identity. Each actual
cache change advances UI activity, never body generation. `pendingEditors` is
derived from nonempty cache and blocks page/tab/row/mode leave independently of
document `dirty`. Unmount must not clear the cache. Consumers retain the
controller instance for the target or explicitly persist/recover its cache.

Body save leaves local form inputs intact. A resource submit names its cache with
`execute(command, { localDraftId })`. A generic cache envelope carries
`baseRevision` and the exact reviewed `command`; while invalid input is being
edited, `command` may be omitted and `presentation` retains raw form fields.
A property envelope carries `kind: "property"`, `propertyId`, `baseRevision` and
raw JSON `source`; optional presentation/schema fingerprints are also retained.
The controller checks base revision and exact submitted value/payload before
creating any operation. Other unrelated mutations are blocked. Ticket-time source
changes cancel before submission; post-submission changes are kept. A committed
receipt or authoritative lookup clears only the operation-bound opaque cache
version. Equal-text cancellation/reopening gets a new version, so a late ACK
cannot clear a new form. Other cached forms remain pending. Explicit Cancel uses
`setLocalDraft(id, undefined)`; failed/denied/unknown writes do not clear inputs.

`persistLocalDrafts()` is an explicit optional backup action through
`host.persistDraft(scope, target, drafts, signal)`. Setters never call storage or
apply a command. Absence, capacity/storage failure, cancellation and stale backup
ACK retain memory inputs and do not claim current durable persistence. Unknown
operation tickets also preserve cache copies and captured versions for restart
lookup. Draft backups are distinct from canonical commits and never grant rights.

Writes are single-flight. `beforeSubmit(ticket, signal)` must durably persist the
scope-bound exact request **before** `commit`. Ticket failure/cancellation prevents
submission. Cancellation/timeout after possible submission preserves unknown
recovery; it never assumes abort rolled back a server transaction. Reconcile
uses `lookupOperation` only and never blindly resubmits. Resume from a recovery
ticket is blocked from opening unrelated documents until lookup settles it.
Host bookkeeping must retain original draft/outbox/conflict evidence and clear
resolved tickets according to its journal policy.

Drafting continues during async saves/resource writes. The controller captures
input generation and keeps any newer draft when the older ACK arrives. Canonical
revision advances independently so the next save uses current CAS. Non-save
resource mutation requires a clean current draft; a consumer flushes nested
row/widget writers before invoking it. A legacy host adapter that cannot enforce
that sole-writer barrier must not advertise the strong operation.

Navigation first saves dirty input, then reads the destination. It checks dirty
state, input activity, IME and recovery after both async boundaries. A late read,
wrong scope/target, resumed input, even a composition that began and ended during
the read, or cancelled navigation cannot replace the current draft. IME blocks
writes and navigation. Single-flight prevents repeated clicks creating duplicate
loads/writes. Dispose aborts controller operations and suppresses late UI state.
Consumers unmount runtime surfaces and unsubscribe their observers on dispose;
legacy database provider reads do not acquire a new cancellation guarantee.

Conflicts/denials preserve draft and block navigation/retry. `readLatest()` obtains
a separate comparison snapshot without rebasing or replacing the draft. Input,
composition or wrong-scope/target responses invalidate that review. Unknown
operations must be reconciled first. `acceptMergedDraft(latestRevision, document,
title)` is an explicit user review action: it rereads the canonical snapshot and
compares the exact scope/target/revision/content/capability/metadata/body and input
activity before preparing the merged draft. It does not save it.

Prepared merges set `manualSaveRequired`; automatic `save()` is a no-op and
navigation is blocked. The user explicitly calls `save({ explicit: true })`.
The first conflict `originalDraft` and immediate pre-merge `mergeSourceDraft` retain
all original semantic fields/styles in state and in the durable recovery ticket.
They remain until a confirmed commit; failed/unknown persistence never removes
them. Hosts retain those scoped backups with journal/history evidence rather than
discarding a conflict copy when acknowledging a merge. A consumer offers original
backup download and an editable comparison/merge UI; it must not discard or reset
draft automatically. Quiet proposals keep their existing scoped approval/history/Undo
session and use the same sole-writer/persistence boundary. UI timing/config never
changes automatic organization permission.

## Preservation and acceptance

Use the existing import/export legacy codec and host-owned archive. Export merges
only reviewed editor fields into **current** host records. Unknown payloads and
styles remain inert/recoverable; columns remain independently authored, HTML JS
is retained as data but not executed. Invalid payloads are preserved until an
explicit recovery action. Mutation receipts do not authorize archive deletion.

The local controller suite exercises save/reload, late input/read/ACK, IME,
single-flight, cancellation, denied/conflict, unknown/lost ACK/restart lookup,
actor/workspace and row isolation, honest persistence, unsafe config/JSON, exact
mutation evidence and instance-scoped presets. It uses synthetic data only.
Final workspace acceptance additionally needs all inventory rows through public
exports, real browser/layout/keyboard evidence, nested-row flush, all widgets/
property/view kinds, modes and isolated candidate installation. None of these
broader gates is implied by controller tests. No PA deletion, publish, deployment,
push/merge, credential change or real AI execution is performed by this contract.
