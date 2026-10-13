# .26 host delta

Public entry: `@hello-ai-company/editor-blocknote/notes`. Add one host/session registry created by `createNotesTableEditingRegistry(host)` and pass the same instance as `tableEditing` to `NotesTabbedWorkspace` or `createOpenEditorNotesPreset`. The host owns registry disposal. Presets borrow it and do not dispose another pane's writer.

The registry and host have `version: 1`. The journal has `version: 1`, `compareAndSwap: true`, scoped `read(binding)` and `list(scope,parentTarget)`, `put(draft,expected)` and exact `remove(draft)`. Failed reads/CAS/puts/removal must reject. A previous DB37 prep journal with only `put(draft)` is insufficient: adapt it transactionally before mounting. Raw journals and private operation tickets remain separate; journal removal cannot erase an unresolved operation ticket.

The port's `rows()` now returns a local `NotesTableRowsPage.binding` proof matching actor/workspace, parent target, database, view and complete query. This is added by the authorized host adapter after validating the existing wire rows envelope, including query/options/revision/cursor. It is not a new HTTP request or response field. Missing/foreign identity rejects the page and retains old rows/input.

The port provides authorized `read`, rows, existing commit/lookup provider, durable `beforeSubmit`, optional `beforeLookup`, retained recovery and attested `releaseTerminal`. Persist raw + exact submitted ticket before private ticket + transport. `beforeLookup` restores local bookkeeping and performs no POST. Restore the exact operation ID and original expected revision; never generate a replacement operation from hydration.

`registry.beforeLeave(target,signal)` flushes all loaded writers and scans the scoped journal. Capture `captureLeaveGuard(target)` after success, then check it after other nested writers and immediately before committing navigation. `getGeneration()` is an enclosing layout transaction fence, not a capability. Direct preset controller navigation and built-in tab/Split/query paths apply these guards. Hosts with custom navigation/mode hooks must also drain their other registered writers. A negative generation or changed actor/session invalidates the guard.

When the registry is supplied, the old generic database-view mutation UI is disabled. Unsupported queries/renderers use the existing read path. Do not also mount the old host schema/CRUD trial editor for the same database resource. Extract its checked provider and durable ticket hooks into one ownership path first.
