# .12 host integration delta

Existing workspace/controller/canonical commit/recovery APIs remain compatible.
OE owns common UI, interaction and editor rendering; the host owns authorized
records, actual AI/media/search/DB transports and atomic persistence. A displayed
reference/result/row is not a write capability.

## Optional read services

`NotesWorkspace` and `NotesTabbedWorkspace` accept optional `assistance.search` and
`assistance.askPage` (`NotesAssistanceService`). Each explicit request carries
scope, target, canonical revision, bounded query, includeWeb and AbortSignal.
Return only authorization-filtered plain text and permitted page/row hits. Web is
shown only when allowWeb is explicit. Cancellation and identity/revision changes
ignore late results. The service never writes a document. Real context/consent,
provider policy and search authorization remain host acceptance work.

Optional `databaseNavigation` contains database IDs/titles and a
`NotesDatabaseNavigationHost.read` projection. Pages carry scope/databaseId/revision,
allowed columns/rows, optional total/nextCursor. Rows contain values, not embedded
editable bodies. Missing total means unknown. Paging deduplicates stable row IDs
and rejects changed revision/repeated cursor; preview shows at most8 rows/5 columns.
Opening uses the existing guarded target route. This does not supply DB CRUD,
all11 views, schema settings, relation completeness or a legacy row drawer.

`documentOptions.dictionaryEntries` supplies authorized literal terms/definitions.
History reading uses optional already-authorized record.document and at most40
index entries. Neither dictionary nor history reading performs writes or fetches.

## Public picker and exact legacy modes

Call `useNotesPropertyPickers({controller,scope,host})` in a stable per-target row
component; render returned picker and pass adapters to NotesDatabaseProperties.
Keep a stable host adapter instance per mounted scope. Pending selection captures
the adapter and its read method, retains the method receiver and cancels before
calling any replacement adapter, even when instances share the same method.
Host read requests contain exact definition, target, query/cursor and AbortSignal.
The returned choice page must echo scope/target/propertyId/valueMode. Choices are
bounded and validated against the same definition. Choosing only changes a local
field draft; explicit save invokes the existing named property.patch operation.
Cancel/Abort/revision/scope/provider changes return undefined. Search suppresses
intermediate composition events. The host reauthorizes the value at commit.

Default config.valueMode is `reference`: user IDs, asset IDs, relation row IDs and
coordinates preserve the existing typed contract. Set `legacy-text` only on user
or location definitions to preserve exact free-form old strings. Set `legacy-files`
only on files definitions to preserve bounded `{url,name?,kind?,size?}` objects.
No label-to-user, place-to-coordinate or URL-to-asset inference is performed. These
new admission modes do not prove that PA currently accepts them: its independent
HANDOFF explicitly leaves legacy modes/storage/arithmetic/provider gaps open.
PA config.properties may be a JSON string, values are row.values, and multi_select/
relation may be nested JSON strings. The host must preserve raw archives and do
exact canonical projection/storage mapping rather than assign whole projected rows.
Unknown multiselect IDs stay visible; invalid edits cannot commit until the user
explicitly removes them. Computed values come from snapshot.metadata.properties;
loaded-row calculations never become authoritative values. database.action remains
the exact host command/evidence/receipt route.

## Presentation and width

`createLegacyNotesEditingFeature(options?)` accepts optional authorized
resolveMediaURL and guarded onOpenPage. Four link layouts render plain metadata.
Media resolves only after explicit preview; absent resolver causes no fetch. Keep
unknown fields/archive and bind the callbacks to the exact authorized target.
This does not authorize arbitrary widgets through generic document.save. PA's
reviewed text binder still limits admitted IDs/parents/types/marks. Rich tables,
widgets/history graphs require their own audited host admission and transaction.

NotesEditorBridge.insert has a backwards-compatible optional third argument
`{table:{rows,columns}}`, integer1–5. The adapter stores BlockNote automatic widths
as JSON null in the known tableContent.columnWidths array, restoring undefined
slots on editor load; specified widths and column positions are preserved.
Undefined arrays in unknown content still fail instead of being silently compacted.

The host supplies its available width once. Standalone uses the left edge; no
268px reserve is inferred. New dialogs portal to body to escape sticky stacking,
but intersect their nearest Notes owner with the viewport and inherit its theme.
Supply navigationMount inside the actual owner; an external portal without a
nearest Notes owner cannot infer a host boundary. Global host stacking/transforms,
live host chrome and native zoom still require paired visual acceptance.

## Review and Journal

NotesProposalRail optional comparison is display-only. The .12 review fixture uses
the existing scoped writer, canonical revision, exact before/after and result lookup.
It is synthetic and transient; real Secretary provenance/consent/partial adoption/
persisted receipts and Undo must bind the existing durable coordinator separately.

Journal can reuse the common controller, document renderer, CSS, sidebar and guarded
navigation. PA retains civil dates/calendar/prompt/source/privacy/create policy.
No Secretary/date-specific fields or competing journal writer were added to common
APIs. Consult the PA OE-HOST-CONTRACT.md/JOURNAL-CONSULTATION.md before runtime switch.
