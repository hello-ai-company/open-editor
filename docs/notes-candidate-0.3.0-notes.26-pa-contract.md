# PA adoption contract for .26

The PA DB37 preparation is an unmounted protocol/storage preparation. Its HANDOFF and `apps/web/src/features/notesMigration/{databaseEditing,tableDraftJournal,...}` were read. PA's newer Code/Card/HTML canonical-save work is a separate retained host deliverable. No PA host file is changed by this candidate.

Keep the existing operation URL and request:

```json
{"scope":{"actorId":"authorized","workspaceId":"authorized"},"resourceId":"notes-db-edit:database","operationId":"fixed-once","expectedRevision":"original-combined-revision","change":{"kind":"patch","fields":{"command":{"kind":"row.patch","rowKey":"reviewed-row","fields":{"stablePropertyId":"reviewed-value"}}}}}
```

`row.create` uses the same command shape and a once-generated row key. Do not add `expectedSchemaRevision` to this wire command. Preserve it in raw input only; the existing combined resource revision fences schema + parent/projection. Read current top-level table `row.create`/`row.patch` capabilities from the authorized DB editing snapshot; schema-only document capabilities are not a write grant.

Upgrade the prep raw-journal factory to the exact .26 CAS/list contract, preserving its private namespace, captured owner, original raw/revisions/value, storage-error rejection and independent operation-ticket lifecycle. Add the local rows binding proof only after complete existing API-envelope validation. Use the existing receipt checker to attest operation ID/resource/scope/parent, previous combined revision, exact command, durable history and returned canonical snapshot. Missing proof retains the original raw/ticket; it cannot be reported as saved.

The prep factory currently creates the old schema controller and a resource editor together. Extract and reuse the provider/ticket owner once. Never mount that factory's old CRUD writer alongside the .26 registry. If schema editing is mounted too, route it through one per-resource owner and drain it in `beforeResourceLeave`; this candidate does not implement PA's ownership extraction.

Required PA adoption acceptance remains pending: install the four exact candidate tarballs in an independent host checkout; actual in-table create/cell + repeated click; durable raw process/API restart; row/page/query/view/Split and canceled leave; stale schema restoration without autosend; private/raw storage faults and checked receipt failure; fixed-ID lost ACK GET-only; two readers' commit/conflict preserving raw and unknown/hidden parent/drawing data; owner/foreign/late responses. Preserve .25 accepted widget behavior and the newer host canonical-save results while doing this.

The shared synthetic browser result is supporting SDK evidence, not PA API/database acceptance. Full #37/#57 and all-59 status stay partial until the host work and broader remaining cases are accepted.
