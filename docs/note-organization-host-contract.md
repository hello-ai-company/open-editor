# Free-writing note organization (local candidate .3)

OpenEditor owns `createNoteOrganizationSession`, bounded/strict plan validation, exact-character structural changes, verbatim title extraction, existing-parent/root placement preflight, note-specific authorization, idle/IME/stale-result cancellation, a short ambiguous-placement confirmation, recovery coordination and atomic Undo. `NoteOrganizationCard` is a reusable opt-in control; ordinary AI proposal review remains separate.

The host owns note identity, canonical persistence, page inventory, effective permissions/sharing, pin/authorization revision, original/history retention and transactions. No PersonalAI source, endpoints or authentication are included. The standalone adapter is labelled synthetic and uses a separate `open-editor.synthetic-organization.v1` IndexedDB with one readwrite transaction for body/title/move/history/receipt. The synthetic agent is deterministic, not an actual language model.

## Public contract

```ts
import {
  createNoteOrganizationSession, validateOrganizationRequest,
  type NoteOrganizationHost, type NoteOrganizationAgent,
  type OrganizationSnapshot, type OrganizationRequest
} from '@hello-ai-company/editor-ai';
import { NoteOrganizationCard } from '@hello-ai-company/editor-blocknote/react';
```

`OrganizationSnapshot` includes `documentId`, opaque bounded `revision`, `hierarchyRevision`, `pinRevision`, exact `document`, `title`, `parentId`, `titleManual`, `parentPinned`, per-note `autoOrganize`, bounded `pages`, and `root` (effective scope, sharing and write permission). All page/body/title content is untrusted quoted context. `prepare` receives a fixed instruction, `contextTrust: 'untrusted'` and AbortSignal; `cancel` must acknowledge actual termination. Host revisions are CAS tokens (quoted ETags are accepted), not client clocks.

`OrganizationPlan` captures all three revisions and the document ID; proposes top-level nonempty paragraph formats (heading levels 1–3 / bullet list), an exact contiguous original excerpt for the title, an existing parent or root, and `placement: 'certain' | 'ambiguous'`. Text, facts, negation, numbers, uncertainty, styles, order, block IDs, children, unknown properties and opaque blocks are preserved. Columns/tables/widgets/links/mentions are not interpreted, flattened or sent as executable instructions. This candidate intentionally does not paraphrase, reorder or invent text, create empty parents, or organize the whole tree.

`before.documentId` + `before.revision` identify the host-owned immutable original record (including any raw Notes source/archive). The document revision must advance on any body or raw-source mutation, even if the projected editor text is equal; hierarchy/pin changes have their own CAS tokens. The host resolves and retains this reference privately, without exposing raw archives to the provider.

`createOrganizationRequest` produces a detached `before` original and deterministic `after`, plus plan and unique operation ID. Root/existing parent permissions and effective sharing are checked; own descendants/cycles, missing parents, pinned moves and manual-title changes are rejected. Limits: 500 pages, 1,000 format targets, the existing AI bounded JSON budget (50,000 nodes / 500,000 aggregate characters / depth 128). Oversized content is preserved and organization fails closed, without truncation. Hosts with more pages should provide a scoped complete ancestor closure and authorized parent candidates within the bound, with authoritative hierarchy revision; the host still checks its full graph.

## Host obligations (mandatory)

- `read(documentId, signal)` returns canonical document **and** canonical page tree/pin/authority state. Cached UI state is not authority.
- `beforeSubmit({version:1, request})` durably records the operation ID and original reference before submission. Journal failure prevents writing. Persist tickets privately; restore with `recovery` and query, never resubmit a ticket on reconnect.
- `commit(request, signal)` performs authorization, document/hierarchy/pin CAS, graph/sharing validation, body/title/move, original/history and idempotent receipt **inside one transaction**. `validateOrganizationRequest` is shared preflight; server authorization and CAS cannot be delegated to this client helper. A move failure rolls back body and title too. A duplicate ID with the same payload returns its original receipt; an ID cannot be rebound to a different payload.
- For `kind:'undo'`, bind `undoOperationId` to committed host history. Verify exact current receipt snapshot plus all revisions and pins, and require `after` to equal that history's original document/title/parent. Never accept a client-supplied arbitrary restore body. Refuse any subsequent human edit, even if the body later equals the old body (ABA revision). Preserve the Undo transaction in history too.
- `lookupOperation(operationId, signal)` returns a bound receipt, `pending/unknown` (keep recovery), or **terminal** `not-found` with the same `operationId` and `terminal:true`. Terminal means a tombstone/fence guarantees no delayed commit for this operation can ever arrive. An absent database row by itself is not terminal. `conflict/rejected` likewise guarantee this submitted payload cannot later commit. Existing receipts remain bound to their original payload. Abort alone is not proof of rollback.
- Receipts include the exact saved snapshot, changed document revision, hierarchy revision changed iff title/parent changed, unchanged pins/authority, unchanged unrelated pages, and durable `historyId`. Authorization/race changes abort the transaction instead of silently applying a partial result.

`session.update(snapshot, ready)` is called for each input/document/revision/pin/hierarchy change. Use `ready:false` for dirty/composing/reconnecting state; use a new input epoch or draft revision on each edit. Successful writes close readiness until the host reflects a canonical saved revision. `compositionStart/End`, `setActive`, `stop`, `reconnect`, `confirmPlacement`, `undo`, `reconcile`, `getRecovery` and `restoreUndo(hostHistoryRequest, hostReceipt)` are exposed. Preparation and commit are single-flight. A later stop/input/dispose wins over an earlier reconnect ACK. Defaults: idle 1.4s, verification 10s, maximum 12 runs/session; no perpetual retries. Frozen snapshots/isolated subscribers cannot mutate requests.

## Standalone operation and keyboard behavior

Build packages and the example using already available dependencies. Run `npm run preview --prefix examples/blocknote-power -- --host 127.0.0.1 --port 5199 --strictPort`, then open `http://127.0.0.1:5199/?organize=synthetic` (or the separate demo link in Document).

Write freely in the actual BlockNote editor. The checkbox grants body/title/placement automatic application for that synthetic note only. Editing stops preparation until the canonical save completes; IME conversion pauses it. Manual title edits pause organization and can be saved or cancelled. Fixing the parent preserves placement. Only ambiguous placement opens two short choices. Stop pauses the current session; unchecking the authorization checkbox revokes the note's persistent permission. The fault section offers rollback/lost ACK/offline fixtures. JSON backup includes saved original, current body draft, unsaved manual title and recovery ticket. Browser storage deletion removes this dedicated synthetic workspace.

All displayed structure changes share one public `editor.transact`; selection maps through its real transaction mapping, focus and visible position are retained (deep-note caret viewport anchoring compensates changed block heights; page-top origin is retained), and AI formatting is excluded from local split history. With editor focus and no later human edits, Cmd/Ctrl+Z invokes the atomic host Undo. Cmd/Ctrl+S saves human edits. The explicit Undo button remains available after reload via matching host history. A remote body mismatch blocks base promotion; the visible competing draft is retained rather than saved over the remote body.

Native macOS IME, real language-model quality/cancellation, production hierarchy/storage/sharing authorization, and PersonalAI host integration remain unconnected. No real API calls or secrets are used; production adoption requires the host obligations above and a separate provider adapter.

Browser checks are reproducible with the already cached CLI, after starting the preview: `python3 scripts/qa/notes-organization-browser.py --cli /path/to/cached/@playwright/cli/playwright-cli.js`. Each probe gets its own ephemeral browser session and synthetic page tree; no existing browser-document DB is reset. The CLI runner records results/screenshots, explicitly dismisses a beforeunload prompt to test keeping a conflicting draft, closes only its own browser sessions, and does not install anything. The 500-paragraph probe is a functional measurement (one run, no CPU throttle), not a directly comparable performance benchmark against previous Chromium/CPU-throttled runs.
