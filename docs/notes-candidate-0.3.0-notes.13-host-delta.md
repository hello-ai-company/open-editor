# .13 host integration delta

Existing canonical Notes commit/recovery, property and Canvas persistence APIs
remain compatible. Host authorization and receipts remain authoritative.

`createOpenEditorNotesPreset` / `NotesTabbedWorkspace` accept optional
`databasePresentation`, containing the existing authorized `resolveRowMedia`,
`resolveFeedRowMedia`, `resolveMapLocation` and renderer overrides. Bind the normal
`host.providers.database` and optional `databaseViewConfig` to this same scope.
The public root now exports `createDefaultDatabaseViewConfig` for host registration.
Neither presentation projections nor a successful bare DB-provider promise grants
resource mutation or canonical Notes receipt authority.

Row-open routes exact databaseId/rowKey through the Notes writer. The default uses
controller.open; custom onNavigate completes the host nested-writer drain and body
save guard. Both reject pending raw input, IME, recovery/nonready state and source
changes before dispatch. The tabbed workspace uses its existing session.open.
Documents with nested DB/shared writers still require beforeResourceLeave. The
synthetic callback is valid only for its known read-only database and rejects
other nested writers. A real mutating host must drain its own captured inputs and
settle actual canonical operations; do not copy this read-only callback as a CRUD
implementation.

`createCanvasController({target,preset})` may now return undefined. That decision
is cached once per loaded target. The session disposes only returned controllers
and continues to enforce body/property/IME/pending-input/recovery guards for rows.
The host must render its row document/property surface instead of passing an absent
controller into an auto-created Canvas surface. Recreate the scoped session after
an entitlement change; this API is not dynamic authorization or permission inference.

Search/filter input uses the existing source controller draft lifecycle. Config
preferences use the same lifecycle while an authoritative config provider save is
pending or rejected. Retry preserves exact database/view identity and restores
metadata-bound settings through the established config admission. A malformed,
foreign or externally superseded cache stays retained and inert. The public provider
save contract is still Promise<void>; this iteration does not introduce cross-client
CAS, production transport, recovery receipts or durable raw-input storage.

Database view selection is a document block edit (databaseId/viewId/viewType).
Query/filter/sort/renderer preferences are separate view-provider records. Saving
preferences alone does not save a dirty document's view choice. Use the Notes body
writer / explicit Save before expecting that choice to survive reload.

The synthetic provider deliberately omits create/update/delete/restore/reorder.
Computed values remain authoritative host values. Dashboard/map summaries represent
loaded rows only. Gallery/Feed images use a same-origin static synthetic reference;
URL admission is unchanged. Nearby map pins can overlap at the world projection;
the companion list provides row navigation.

PA .12 table/history/Canvas discrepancies and the exact host follow-up are described
in the accompanying NOTES13-PA-CONTRACT.md. Old Notes/Journal UI must remain until
all59 workflows and the full CSS comparison are accepted in the actual host.
