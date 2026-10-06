# Notes candidate 0.3.0-notes.1 — package-side acceptance contract

Local candidate following `6bbaabb` / `0.3.0-notes.0`. Source manifests remain official `0.2.0`; the packaging script assigns the candidate version in an isolated temporary copy. No registry installation, publishing, push, merge or deployment is part of this phase. PersonalAI source is owned by the separate host integration task and was not changed.

The existing `output/candidate/*.tgz` and `output/candidate/manifest.json` are immutable. New artifacts go exclusively to `output/candidate/0.3.0-notes.1/`. Packaging requires an explicit new version and refuses an existing destination. Its manifest records the actual source commit, artifact hashes and isolated public consumer validation.

## 1. Quiet contextual proposals

`createQuietCooperationSession` adds optional `context`, `updateContext(context)` and `setReady(boolean)`. Context has exactly:

```ts
type QuietPreparationContext = {
  documentId: string;
  revision: string;
  secretaryId: string;
  instruction: string;
  selectionBlockIds: string[];
};
```

Revision, selection and instruction changes invalidate ready/in-flight proposals even if the document returns to identical content (A→B→A). The provider receives a detached context and the latest instruction as `purpose`. The proposal carries its captured context. `ready=false` suppresses preparation and invalidates proposals during reconnect, unsaved changes, unknown writes, unavailable row metadata and canonical loading. Restore readiness only after the host confirms canonical data. Context plus semantic document shares the preparation byte budget. No raw archive, database rows, credentials or provider metadata belongs in the AI context. Treat document content as untrusted quoted material; it cannot grant permission or override the secretary instruction.

Opt-in, idle debounce, composition suppression, bounded run count, cancellation acknowledgment, late-result rejection, no automatic writing/focus/scroll remain. Budget is per session; this is not an unlimited background agent scheduler. The example's deterministic fixture now changes with the actual heading; it remains a **synthetic fixture**, not evidence of real AI quality.

## 2. Secretary → assigned agent → approval → durable write → verification

`createSecretaryWorkflow({ provider, writer, document, context, agentId })` composes quiet preparation and `createDurableReviewCoordinator`. It starts with its readiness barrier closed. The host calls `refresh(document, context, ready)` with canonical, saved data. It exposes `quiet`, `getWriteState`, `approve`, `undo`, `reconcile`, `stop`, `dispose`.

Explicit approval must name the proposal's assigned agent and run in `decision.source`. The workflow pins the proposal's **generation-time revision** for the host CAS. `approve(decision, changeIndexes?)` supports a validated subset in original dependency order. Repeated approvals cannot start concurrent writes. `stop` aborts pending work; once submission occurred it cannot claim server rollback. `dispose` closes subsequent write/refresh/reconcile calls.

The returned `{ outcome, verification }` distinguishes a durable commit receipt from read-back verification:

| Verification | Meaning |
| --- | --- |
| `verified` | Current host read matches committed revision and document |
| `superseded` | Host has a different canonical revision/document after the commit |
| `unavailable` | Read-back failed, timed out, or lifecycle/context changed during verification |
| `not-committed` | Outcome was stale, cancelled, conflict, denied or unknown |

After any write, readiness remains closed until host refresh. A receipt is evidence of that operation, not a claim that no human edited afterward. The server must atomically authorize and persist CAS, document/history/provenance and an idempotency receipt. No model SDK, credentials or billable execution is supplied by this package.

The lower-level `durable.accept(..., { expectedRevision })` adds revision pinning and bounded read/authorization/commit/lookup waits (default 10s, configurable 100–120000ms). Existing callers omitting `expectedRevision` retain document-only freshness checks. **Use the pinned workflow/new option for concurrent Notes integration.** Undo still requires the exact committed revision, so it cannot overwrite later human edits. Unknown acknowledgments are reconciled by operation ID, never resubmitted. This document coordinator's unknown bookkeeping is session-scoped; host restart recovery still needs host-owned operation/history restoration.

## 3. Notes data that can actually be edited

`importLegacyNotesBlocks` / `exportLegacyNotesBlocks` now save new native paragraphs with native default props and independently authored HTML widgets. Widget source survives reopening, while script execution remains disabled. Nondefault unmapped native properties fail explicitly. Notes has no column gap field: new nondefault gaps fail instead of silently reopening at 16. Deleting a block now rejects concurrent version/unknown-metadata changes; retained blocks continue to merge current host metadata.

`applyNotesMetadataEdits(currentBlocks, edits)` provides **explicit host-side key edits** outside the semantic AI document. Supported targets are table `tableProps` and database serialized-JSON `databaseConfig`. Each edit names a block, field and key, captures `{ present, value? }`, and supplies a JSON value. Duplicate keys/targets, unsafe keys, invalid targets and changed captured values fail. Untouched future settings, lazy DB rows, row counts and preserved API fields survive. Configuration semantics must be validated by the host before server CAS. This does not convert arbitrary unknown blocks into editable renderers or turn a lazy database into an empty row array.

```ts
const savedBlocks = exportLegacyNotesBlocks(editorDocument, archive, freshHostBlocks);
const next = applyNotesMetadataEdits(savedBlocks, [{
  blockId: "table-id", field: "tableProps", key: "widths",
  expected: { present: true, value: [100, 200] }, value: [120, 250]
}]);
// Persist next only with the revision associated with freshHostBlocks.
// Refresh the archive from the acknowledged canonical result after saving.
```

`createRevisionedNotesResourceEditor` adds a provider-neutral row/config resource contract. Requests carry `resourceId`, `operationId`, `expectedRevision` and exactly one change: named-field `patch`, explicit `create`, or `delete`. The host patches named fields against its **current** row, preserving concurrent untouched fields; replacing a cached full row violates this contract. A creation receipt must match its reviewed JSON value; deletion returns a null value, and a patch receipt must contain each reviewed field value. Receipts also bind resource ID, operation ID and a changed revision.

Pending/unknown writes block more commits. Waiting is bounded (default 10s). Abort before submission reports cancelled; after submission an unconfirmed result stays unknown. `getRecovery()` produces bounded detached **host-private** bookkeeping. Use `options.beforeSubmit(recovery, signal)` to await the host recovery journal before any provider submission, then persist updated status atomically in the host; restore through `options.recovery`, then call only `reconcile()`. Failed/timed-out/cancelled journaling does not submit a write; a late journal result cannot start a cancelled submission. Never use a recovery ticket as authorization or success evidence. Authorization and atomic idempotency must be enforced by the host server. New row creation IDs must be reserved before submitting so reload cannot choose a different identity. This client coordinator supplies no persistent storage itself.

`validateNotesPropertyValue` and React `NotesPropertyEditor` provide actual explicit JSON-value editing for these 11 kinds: text, number, boolean, date, URL, email, phone, select, status, multi-select and relation IDs. Choice IDs must come from authoritative property metadata; relations require host access validation. Formula, rollup, files, user, location, button and audit/system properties remain host-edited or read-only. This is **not full editing parity for all 22 properties**. The form blocks unknown outcomes, offers receipt lookup, preserves a draft on revision conflict, and isolates property/provider/definition changes. Escape restores the unsubmitted current value. The synthetic example illustrates multi-select editing and acknowledgment loss; its in-memory fixture resets with document-mode remount/reload and is not a real DB backend. Loading waits until the example is opened.

Existing database read runtime now rejects old A responses after query A→B→A, preserves same-cohort concurrent read sharing, and reloads all mounted views of a written DB. The host calls `store.invalidateReads()` on reconnection to supersede old connection responses and reload canonical rows. It does not clear outstanding writes. Existing `DatabaseProvider.updateRow`/legacy view mutation UI still use their old full-row contract and are **not automatically upgraded** to this revisioned writer. Host wiring/capability gates are required before declaring those production writes safe.

## 4. Validation and limits

See `docs/notes-candidate-0.3.0-notes.1-verification.md` and the new `output/playwright-notes1/` artifacts. Unit/state tests cover ABA, context, readiness, timeout, lost ACK, recovery without duplicate create, partial property patches, unknown-field retention, read epochs, React target switching and postwrite cross-view refresh. Real Chromium tests cover local multi-tab IndexedDB CAS and recovery, narrow/reduced-motion display, ordinary editing and quiet rejection/approval/Undo. Japanese `insertText` and synthetic composition events are labeled accurately. Native OS Japanese IME, hours/days soak, real model quality, real PersonalAI/Notes persistence and connected production authorization are **not verified here**.

Licensing remains independently authored. No proprietary/GPL Notes or BlockNote XL implementation was copied. Existing public dependencies and the separate column licensing record remain documented in `notes-parity-license-record.json`; that record is not a legal clearance for arbitrary dependency reuse. HTML JS execution, authorization, credentials, security settings and the official published 0.2 release are unchanged.
