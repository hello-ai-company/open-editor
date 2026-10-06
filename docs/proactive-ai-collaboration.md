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
stop-during-run-announcement behavior. A separate reviewer subsequently inspected
`110abd3` and the correction diff, independently reproduced two defects and
verified their fixes with 52 passing AI tests and `git diff --check`:

- P2: pause after cancellation, including while its acknowledgement was pending,
  could change `cancelled` back to `paused` and allow execution to resume. A
  cancellation intent now survives pause and document updates, and a stop serial
  prevents older asynchronous stop operations from overwriting newer ones. Only
  an explicit new goal after acknowledgement resets that intent. Both overlapping
  operation orders, subsequent pause and late output have regression coverage.
- P3: suggestion equality used locale-sensitive key sorting while the ahead
  controller used code-point ordering. Distinct composed/decomposed Unicode keys
  could reject adoption after a key-only reorder. Both now use the same total
  ordering; adoption, Undo and actual value changes have regression coverage.

The independent review covered code, local reproductions and unit tests for
editing conflicts, late output, duplicate adoption, pause/resume, limits, Undo and
the prompt-injection contract boundary. No additional unresolved defect was found
in that scope. This is a separate AI reviewer, not a human approval or a real-model
security assessment. Its verified source blobs are `ahead.ts` `614075f`,
`suggestions.ts` `cbe04fd` and `ahead.test.ts` `3d38f38`.
The implementation author additionally reran all 772 tests, typecheck, package
and example builds, and eight production Chromium scenarios including cancelled
work surviving close/reopen and Canvas/Document switches. Each browser scenario
had zero page errors, external requests or API requests. New review evidence is
under `output/proactive-ai/independent-review-*`.
**Actual model/host execution and actual-model prompt-injection resistance remain
unverified. This is not a completed J.A.R.V.I.S.-style real-model product.**

Review focus: execution cannot restart after unacknowledged cancellation; current
human content gates both adoption and Undo; refinement cannot reset cost limits;
all output is inert until the host commits; no user document content escapes via
the local example; backend receipt and permission rules are preserved.

Raw logs, isolated synthetic backups and screenshots live under
`output/proactive-ai/` and are excluded from commits. Runtime performance was
not remeasured. The new panel/controller are loaded lazily; the inherited large
bundle warning remains. Desktop Chromium tests do not establish Safari/Firefox,
physical touch, assistive technology, multi-device or native-background behavior.

## Minimal Personal-AI connection proposal (read-only findings)

All findings below are pinned to Personal-AI `6fd822516d042e1a7065f2df436e545c4d05b91e`
(PR121), not a claim about a deployed server's configuration. Only GitHub source
reads were made; no authenticated application, model, credential probe or real
user document was accessed. Original Personal-AI checkouts and its PR were not
changed. The source copies in `output/proactive-ai/connection-review/` are local
evidence and are excluded from commits.

| Existing seam | Verified source behavior | Missing for this feature |
| --- | --- | --- |
| `apps/web/src/editorAdapters/personalAIAIProvider.ts` | `AIProvider.edit` delegates to `/api/v1/ai/generate/search-context`; returns plain output. Its client requests personal/public retrieval, up to 12 hits / 24,000 characters, timeline and graph context. | It is not `AgentAdapter`, a reviewed proposal receipt, a per-run cancel acknowledgement or a document CAS writer. Reusing it unchanged could include knowledge outside this document. |
| `apps/web/src/lib/api/agents.ts` / `api/v1/agents.py` | `instructSecretary` submits instruction/workspace/priority through canonical Work Intake and Goal/Plan dispatch. Its request has no editor snapshot/revision or stable editor request ID. | Typed owner-bound editor context and a stable per-occurrence identity must enter through the reviewed server boundary. Do not invent direct AgentTasks or forge owner-proposal provenance via public Work Intake. |
| `services/editor_agent_context.py` | Can reload an exact untrusted editor context from a converted President Work Intake. Privacy classification compares the complete snapshot block ID set with persisted document rows. | Preserve rich content, correct owner document ID, server content revision and lineage. A browser ordinal revision or temporary BlockNote ID is insufficient. |
| `api/v1/editor_proposals.py`, its models/service | Owner-only create/list/get/adopt/reject/undo; creation is idempotent by owner/document/request UUID and request digest. Model mode is explicitly rejected with 422. Adoption and history/receipt commit together under owner CAS. | Link generation to the governed model occurrence, reviewed exact output and server persistence; add pending-run status/cancellation and selected-change adoption. There is no cancel endpoint or selected-index field in this contract. |
| `services/agent_model_execution.py` | `invoke_model_once` durably prepares and claims a governed provider dispatch, revalidates privacy/budgets, accounts for cost and preserves ambiguous outcomes without automatic redispatch. | Attach this existing execution lineage to the owner proposal service and enforce its no-tools scope. A Goal cancel/HTTP abort alone is not evidence that an in-flight provider has stopped or cannot be billed. |
| OpenEditor `localPersonalAi.ts` | Only accepts `http://127.0.0.1:8189`, omits credentials, supplies synthetic actor headers and mocks proposal preparation. Uses actual PR120 owner save/history contracts. | This fixture cannot become a production adapter by changing its URL. The ahead panel is intentionally disabled for it. |

Pinned source entry points: [proposal API](https://github.com/hello-ai-company/personal-ai/blob/6fd822516d042e1a7065f2df436e545c4d05b91e/apps/api/personal_ai/api/v1/editor_proposals.py),
[governed execution](https://github.com/hello-ai-company/personal-ai/blob/6fd822516d042e1a7065f2df436e545c4d05b91e/apps/api/personal_ai/services/agent_model_execution.py),
[editor context](https://github.com/hello-ai-company/personal-ai/blob/6fd822516d042e1a7065f2df436e545c4d05b91e/apps/api/personal_ai/services/editor_agent_context.py).

### Authentication, cost and transmitted content

Prefer mounting the feature inside the existing Personal-AI web host and reusing
its `authenticatedFetch` and current signed-in principal. The source API validates
Bearer identity through Supabase `/auth/v1/user`, or accepts a validated internal
gateway identity; development actor headers are not production authorization.
Owner-document checks and single-writer activation remain mandatory. OpenEditor
packages receive no provider key, service-role key, internal gateway secret or
new persistent permission. No login, token read/refresh or permission change was
performed. An independent OpenEditor-origin app would require a separately
reviewed login/origin integration, which is outside this minimal proposal.

The server already has API-key model gateways and a separate `chatgpt_plan`
gateway. Their presence in source does not establish live availability. The latter
requires a scoped workspace/owner, a local authorized request, development/test,
enabled configuration and encrypted local connection storage; its gateway reports
`actual_cost=None`. It has no billable fallback on connection errors. It cannot be
assumed production-ready, free, connected or eligible for this execution merely
because the user has ChatGPT. API-key routes can incur provider charges. Reuse only
an already approved route, model and server-held connection; do not create or move
credentials, enable a route, refresh a connection, or silently fall back to a
paid route. Existing connection state, permissions, usage eligibility and dollar
limits need the Personal-AI owner's confirmation and approved live verification.
Source: [auth](https://github.com/hello-ai-company/personal-ai/blob/6fd822516d042e1a7065f2df436e545c4d05b91e/apps/api/personal_ai/services/auth.py),
[ChatGPT connection](https://github.com/hello-ai-company/personal-ai/blob/6fd822516d042e1a7065f2df436e545c4d05b91e/apps/api/personal_ai/services/chatgpt_connection.py).

A real proposal would send the authored goal/recent directions and the exact
classified saved document context to Personal-AI, then approved context to its
selected provider. A bounded research phase may add explicitly approved source
excerpts; avoid the existing broad search defaults for the initial document-only
connection. Do not send unsaved private browser documents, memories, recordings,
attachments, database rows or a repository automatically. Server privacy policy
must reject device-only or disallowed domains. The 1–12 client attempt cap is not
a monetary cap: planning, specialist/reviewer calls, research or embedding can
consume additional occurrences. Bind a server spending envelope, call/token
limits, reservation and ambiguous-outcome reconciliation to the same session;
edits/refinements/reconnect must not reset it. Prompt-injection labels are not
enforcement: server route/tool policy must prevent quoted document or model output
from obtaining tool access, authority or canonical writes.

### Smallest coordinated implementation

1. Extend the existing owner proposal boundary, retaining its request UUID/digest
   and owner/document CAS. Accept bounded structured goal/directions, phase and
   session identity; `AgentRequest.runId` is a string, whereas this API requires a
   UUID, so the host must keep an explicit stable mapping. Current instruction
   limit is 4,000 characters versus the controller's goal plus directions; fail
   visibly or use a reviewed bounded field, never silently truncate or merge
   document text into trusted instructions. Build the exact saved rich context
   on the server, including correct content revision; current synthetic creation
   reduces persisted text to `props.text` and is not a rich-document roundtrip.
2. Reuse canonical Work Intake → Goal → Plan → specialist/reviewer and existing
   governed invocation. Persist the exact validated, reviewed proposal plus its
   occurrence/output digest, evidence kind, budget and durable outcome. Expose
   owner-scoped pending/completed/failed/unknown status and idempotent cancellation.
   The host `AgentAdapter` maps validated statuses to monotonically sequenced
   events and returns a proposal only after terminal verified completion. Resolve
   `cancel()` only on trustworthy execution-stop acknowledgement; unknown provider
   outcomes remain blocked and reconciled, including cost. Do not run a second
   independent client phase chain alongside the server plan.
3. Add explicit selected change IDs/indices to server adoption, validate them
   against immutable reviewed output and record the exact selected receipt. Retain
   all preview memory references for revocation checks, even for unselected body
   additions. Extend/reuse existing atomic owner/history Undo rather than a local
   whole-body overwrite. The current synchronous `AheadDocumentWriter` cannot
   directly await remote approval: the consumer needs an asynchronous decision
   coordinator, locking/dirty guards and unknown-write recovery before reconciling
   the canonical server result. Do not return `true` before server confirmation.
4. Mount a real host adapter behind an explicit existing single-writer activation
   and connection/data/cost choice. Keep credentials in the host and reuse its
   request/client error handling. Start with document-only paragraph proposals;
   Canvas/code/voice adapters remain separate. `editor-ai` is currently in-repo,
   so consumer packaging/version/release work also needs separate coordination;
   no production `file:` dependency or package publication is proposed here.

Completion requires approved synthetic live-host tests followed by explicitly
authorized real-model checks: durable no-repeat outcomes, injected document
instructions, concurrent edits, partial adoption/double clicks, revocation,
cancel/pause/timeouts, receipts/Undo, save reconciliation, reviewed source evidence
and measured usage. Neither the local demo nor this read-only source review
satisfies those gates. No new external content submission, paid call, authentication,
permission change, push, PR or merge was initiated.
