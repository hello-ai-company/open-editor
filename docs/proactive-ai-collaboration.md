# Ahead collaboration: local implementation and real-operation gates

Base: OpenEditor main `f46cf9c548128a9b6d03134e2983e91e53b85626`.
The implementation is local on `codex/proactive-ai-collaboration`; no push,
PR, merge, publication, deployment, paid model call or new authentication is part
of this work. Existing worktrees, branches and outputs are retained.

## User flow

Tools → **先行AI共同作業** opens an optional conversation panel. The user gives a
goal once, opts into **ローカルの合成例で試す**, and chooses a run limit. The panel
shows a provisional interpretation, the document target and append-only scope,
then prepares outline, research-checklist and paragraph proposals. It prepares
another proposal while the first awaits review, up to two pending proposals.
The checklist expressly says it did not search or verify sources.

Conversation refinements retain the original goal and recent user directions,
withdraw older proposals, and update the plan within the same execution budget.
Recent directions are bounded to five whole messages and 3,000 total characters;
the transient conversation and pending work are not stored. Human edits update
the document snapshot after a quiet period; live document equality is checked
again immediately before adoption, so an earlier visible proposal cannot replace
newer typing. Accepted text continues through the existing document autosave.

Each proposal has selectable changes and an added-paragraph preview. Adoption
adds only those paragraphs and keeps a disabled receipt to handle repeated clicks.
Undo restores the immediately preceding adopted document only while it is still
unchanged. Later human edits block that Undo. Cancellation withdraws pending
work and retains accepted text; it is distinct from Undo. Closing the panel,
switching views, entering Focus, leaving Document for personal context or hiding
the browser tab pauses preparation. Resumption is explicit.

The example supports browser documents. It is disabled in the existing
Personal-AI synthetic-owner host mode, whose durable CAS/history pathway remains
unchanged. Canvas remains the existing manual layout editor. Generating or
optimizing code, executing code, modifying repository files, publishing and
voice input are not implemented by this feature.

## Responsibilities and execution contract

`packages/ai/src/ahead.ts` exports `createAheadSession` over the existing
`AgentAdapter`. It dispatches no tools, does not fetch, authenticate or persist,
and writes only through an explicitly supplied synchronous `AheadDocumentWriter`.
That writer must atomically compare the expected document and commit the reviewed
result, returning true only on success. The example writer supports additions
and their exact removal, preserving existing rich blocks and editor history.
Object key ordering is not treated as a document edit.

The adapter host owns execution, permissions, provider routing, billing, model
policy and durable outcomes. `cancel(runId)` must resolve only after execution
has stopped. Until acknowledgement, no new run starts. Rejected or timed-out
cancellation blocks the session. Late events are ignored; no failed execution
is retried automatically. Successful output requires matching run identity,
strictly increasing event sequence, a validated suggestion over the exact requested
base, a unique proposal identity and a completed status. Proposal IDs cannot be
replayed after rejection in the same goal.

The default budget is six attempts, configurable from 1 to 12; edits, rejection,
refinement and resume never reset it. Pending groups are capped at two
(configurable from 1 to 3). Requests are limited to 16,000 UTF-8 bytes and reviews
to 64,000 bytes; event count is at most 256. Run and cancellation timeouts default
to 30 and 10 seconds. Exceeding a request limit sends nothing and retains the
document. There is no silent document truncation. The goal and recent user
directions are task instructions; document contents are quoted `trust: untrusted`
context with `reviewRequired: true` and `toolsAllowed: false`. An actual adapter
must enforce those policies; the transport contract alone cannot guarantee model
resistance to prompt injection.

## Personal-AI coordination needed

Read-only inspection of Personal-AI PR121 found it open at
`6fd822516d042e1a7065f2df436e545c4d05b91e`, with CI successful. Neither that branch
nor the Personal-AI checkout was changed. The pinned
[proposal service](https://github.com/hello-ai-company/personal-ai/blob/6fd822516d042e1a7065f2df436e545c4d05b91e/apps/api/personal_ai/services/editor_proposals.py)
rejects `generation_mode: model` with
`editor_proposal_durable_model_review_required`; synthetic generation is restricted
to development/test with the stub provider. Its
[proposal contracts](https://github.com/hello-ai-company/personal-ai/blob/6fd822516d042e1a7065f2df436e545c4d05b91e/apps/api/personal_ai/models/editor_proposals.py)
have no selected-change indices, and adoption applies all server-recorded changes.

Real operation therefore needs a coordinated Personal-AI host implementation:

- An authorized model execution tied to durable, unknown-outcome-safe invocation
  records and reviewed exact output, with acknowledged cancellation and budgets.
- Mapping owner document identity/revision and rich OpenEditor context to the
  host's intake and event contract, keeping server grants and credentials outside
  OpenEditor. No snapshot or cached proposal becomes a permission grant.
- An explicit server-reviewed partial-adoption contract and async durable
  adoption/Undo receipts under the existing owner CAS/history rules. The local
  synchronous preview writer is not a substitute for that pathway.
- Actual model/output, source verification, adversarial document-context,
  cancellation, timeout, concurrent editing and save-reconciliation tests with
  approved data and costs before claiming end-to-end completion.

No existing microphone or speech-recognition capture path was found in OpenEditor.
Existing audio support concerns assets/rendering. Voice input needs a future
explicitly authorized input adapter; no microphone permission or audio transfer
was requested here.

## Verification and review status

Local typecheck, workspace tests, package builds and example production build
pass. New tests exercise explicit start, bounded look-ahead, every phase,
cancellation failure/hang, timeouts, late events, event identity/order, invalid
or oversized output, partial selection, writer refusal, human-edit protection,
Undo, key-order normalization, direction history, replayed proposal identity and
synchronous stop before execution. Synthetic adapter tests verify no fetch,
unchecked-research labeling and cancellation without a proposal.

Production Chromium passes the conversation/adoption/Undo smoke test and seven
scenarios: stale live edits; later human edits and cancellation; execution limit;
close/mode/Focus changes; 320px Reduced Motion; long-context rejection retaining
saved text; failed lazy chunk returning to Document. Network interception reports
zero external or API requests in these scenarios. Existing editor review,
mode, narrow-layout, motion and lazy-failure browser checks also pass.
Security audit reports zero vulnerabilities; API and isolated public-package
consumer checks pass. No JS lint command is configured.

The self-review and browser runs exposed and fixed empty-child normalization,
object-key equality, adoption restarting the outline, replayed proposal IDs and
stop-during-run-announcement behavior. They are not a third-party review.
**Independent reviewer sign-off is pending. Actual model/host execution is
pending. This is not a completed J.A.R.V.I.S.-style real-model product.**

Review focus: execution cannot restart after unacknowledged cancellation; current
human content gates both adoption and Undo; refinement cannot reset cost limits;
all output is inert until the host commits; no user document content escapes via
the local example; backend receipt and permission rules are preserved.

Raw logs, isolated synthetic backups and screenshots live under
`output/proactive-ai/` and are excluded from commits. Runtime performance was
not remeasured. The new panel/controller are loaded lazily; the inherited large
bundle warning remains. Desktop Chromium tests do not establish Safari/Firefox,
physical touch, assistive technology, multi-device or native-background behavior.
