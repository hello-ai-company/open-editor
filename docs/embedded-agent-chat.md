# Embedded agent chat (private candidate)

The optional `@hello-ai-company/editor-blocknote/agent-chat` entry adds a reusable `oeAgentChat` leaf block, `createAgentChatFeature()` and `AgentChatProviderBoundary`. The base BlockNote package still depends only on editor-core; install the matching editor-ai candidate only when using chat. The provider-neutral session, validation and storage contracts are in editor-ai.

## User flow

1. Add the feature to the schema and bind a host boundary around the editable document.
2. Insert a chat marker and choose an existing employee. The marker stores only `agentId` and a bounded title.
3. Type a message. Document context defaults to none. Explicitly choose one eligible paragraph to share, or choose plain-paragraph rewrite mode.
4. Review the exact provider/model, employee, message, selected paragraph and up to ten preceding conversation messages before clicking Send.
5. A rewrite remains a proposal. Compare original and proposed text, then explicitly apply it to the local document draft. The document's ordinary save/CAS and undo/recovery policy remain authoritative.

The chat generation path does not implicitly invoke agent tools, search, knowledge retrieval, jobs or background continuation. A separately bound host action panel may expose explicit governed actions (see below). PersonalAI submits to `/api/v1/embedded-chat/generations`, backed by the existing intake generation path and employee model policy. Local/Codex runtimes, stub providers, inactive employees and unconfigured models are unavailable. No credentials are embedded in documents or the SDK.

## Private storage and interruption

The host supplies atomic compare-and-set storage. PersonalAI uses its local IndexedDB ticket store, keyed by authenticated actor, workspace, document, block and employee IDs. Conversation text is not document data and is not synced across devices. History loads without an AI request; incomplete sends never retry automatically. Unsent textarea text is session-only.

Duplicate/pasted blocks receive fresh IDs and start without history. Moving/copying to a different document or workspace does not attach prior conversations. Changing employee selects that employee's separate history in this block. Deleting the marker unmounts chat and aborts waiting; local history remains under the old private key so undo/reinsertion of that exact block can restore it. This is not a secure-erasure feature.

Cancellation stops local waiting and prevents late adoption; it cannot guarantee cancellation or refund of an already accepted upstream request. Account/workspace changes, removed markers, read-only state, changed source or revoked route invalidate pending work. Cross-view history CAS rejects competing sends before a second request.

## Publication and source integrity

Readonly/unbound surfaces never read private conversation storage or activate a provider. BlockNote external HTML exports a fixed neutral aside without employee/title attributes. The publish package treats the chat type as intrinsically private, including malformed nested descendants, for HTML, presentation, Markdown and public knowledge exports. Portable JSON retains only the validated marker.

PersonalAI's owner host only enables chat for authoritative public/personal documents whose source privacy is known. It re-reads canonical identity, capability, revision and privacy before sending. Protected or unknown document/block privacy fails closed. Provider privacy exclusions or missing inclusion receipts cause the response to be withheld.

The server returns both the requested model route and actual resolved model. An alias resolution is accepted only when the server's requested-model receipt matches the reviewed provider/model; the actual model remains visible. No provider fallback is added.

## Candidate access and limits

The PersonalAI implementation is wired into its existing opt-in owner OpenEditor document route, not the default production editor. Existing production rollout gates remain unchanged. There is no deployment, npm publication, account connection, paid generation or native Swift execution in this change.

Offline verification covers source/build/type checks, SDK/host tests, actual BlockNote serialization under jsdom, Python SQLite save/readback/CAS and mocked network privacy/auth boundaries. Browser visual/input/accessibility, GPU and native device verification remain unrun; a real configured provider response has not been tested.

## Reviewed employee profile and selected approved memories

The additive `AgentChatBinding.getEmployeeContext(agentId)` returns a canonical
`AgentChatEmployeeContext`: a profile (`agentId`, `name`, `role`, complete
`instructions`, `revision`, `fingerprint`, optional `description`, `skills`, and
`capabilities`) plus the host's currently eligible approved memories. Each memory
has `id`, full `text`, `privacy` (`public` or `personal`), `revision`, and
`fingerprint`. The host must resolve ownership, approval, privacy, and canonical
revisions; this SDK does not authorize or discover memory records.

Memory selection starts empty. `prepare(prompt, mode, contextBlockId,
{ memoryIds })` includes only explicitly selected IDs, never the whole available
memory list. The preview displays the full employee instructions and each selected
memory's ID, text and privacy. Instructions are not truncated. Oversized inputs
fail before transport (64,000 instruction characters, at most 10 selected memories,
12,000 characters per memory, and 250,000 characters per available context).

The complete profile and selected memory payload are re-read and compared before
sending, after private-history CAS, after the provider responds, after reply CAS,
and before applying a proposal. Revocation, changed content/revision/fingerprint,
a missing employee, or unavailable selected memory fails closed. Unselected memory
content is not sent or retained with the reply. Public session snapshots are
frozen; mutating a returned review cannot change the request sent later. Legacy
hosts that omit this method retain the existing request shape and behavior.

## Rich multi-block proposals

`applyDocument(source, nextDocument)` is a separate optional, synchronous host
transaction. Its presence enables `mode: "document"` and the rich block selection
UI. Prepare with explicit IDs:

```ts
const review = session.prepare("Improve this section", "document", undefined, {
  blockIds: ["heading-1", "paragraph-2"],
  memoryIds: []
});
// Only after the user reviews this exact request:
await session.send(review.reviewId);
// Only after the user compares the saved reply's proposal:
session.apply(replyMessageId);
```

`AgentChatRequest.documentContext` contains only the selected rich root subtrees
and their exact fingerprint. `AgentChatReview.documentSource` retains the entire
local source plus exact full-source fingerprint, but is never passed to
`provider.generate`. Chat markers, unknown blocks, opaque widgets, hidden/custom
properties and unsupported inline content are excluded from eligible selections.
The request never includes private transcript storage or unselected source data.
Hosts must still revalidate authoritative document/block privacy, actor, workspace,
permissions and source freshness around their network calls.

The provider returns a structured `documentProposal: { title, changes }` in
addition to its existing text/provider/model receipt. `changes` uses the existing
`SuggestionChange` union: insert, replace, delete, move, update-props and text-diff.
There are at most 40 operations and 20 selected root subtrees. Every target and
parent/destination anchor must be in the reviewed selection. Root insertions and
moves require an explicit selected `beforeId`; unanchored global append is not
allowed. Source/proposed documents are bounded to 300,000 serialized characters,
and selected provider context to 80,000. A prose-only answer in document mode is
withheld rather than guessed into edits.

Supported rich content includes paragraphs, headings, quotes, nested bullet/
numbered/check lists, code blocks, tables, known text styles, and HTTP(S)/mailto
inline links. Unknown block types and arbitrary hidden style/props data cannot be
introduced. A proposal is dry-run validated, cannot change any unselected subtree,
and preserves the exact original representation of unknown/unselected roots.
`previewAgentChatDocumentProposal` is pure; it never writes to an editor. The UI
shows readable before/after documents plus exact structural/style changes, and a
separate apply button. Closing the preview changes nothing.

Before apply, the SDK compares the entire current source, including unrelated
blocks, against the captured snapshot. The host's `applyDocument` must repeat that
comparison inside its synchronous local draft transaction and honor the normal
undo/save/history workflow. A changed unrelated block invalidates the entire
proposal. No background acceptance, best-effort partial apply, automatic save,
automatic retry, or destructive fallback exists. Saved proposals stay in scoped
private chat history; they are never embedded in document marker props.

## Optional governed action surface

`AgentChatBinding.renderActions?(agentId, blockId)` is an opt-in host-rendered
surface for explicit, separately reviewed tools or jobs. It is not a dispatch
API. Model text, structured document proposals, loading/reloading chat history,
and accepted document edits cannot invoke this slot's actions. The host owns any
bounded tool allowlist, user-selected scope, canonical authorization, confirmation,
request submission and receipts. Readonly, unbound and published surfaces never
mount this panel. The SDK itself contains no network, provider credential,
autonomous tool, job scheduling, or external action implementation.

## Extension verification and remaining boundaries

| Source gap | Candidate SDK coverage | Host responsibility / remaining limit |
| --- | --- | --- |
| Plain-paragraph-only edits | Explicit selected rich subtrees and bounded multi-block changes | Bind an atomic full-source local draft transaction; ordinary save/history remains authoritative |
| Label-only employee identity | Complete canonical profile and expertise in exact reviewed request | Canonical employee ownership, active state and route policy |
| No selected memory contract | Explicit approved memory IDs/text/privacy/revision/fingerprint; none selected by default | Canonical memory approval/privacy and server inclusion receipts |
| Missing tools/jobs affordance | Optional isolated host action panel with employee and block identity | Host implements bounded reviewed actions and governed runtime; no SDK tool dispatch |
| Unknown/private source risk | Eligibility projection; no source snapshot in provider request; unselected opaque blocks preserved | Authoritative privacy checks, source revisions and platform transport |
| Interrupted/stale apply | Local pending-request recovery journal, explicit receipt lookup, shared response validation, cancellation/CAS plus full-source and employee/memory invalidation | GET-only authorized canonical receipt lookup; no automatic regeneration |

Focused offline suites include `packages/ai/test/agentChat-rich.test.ts` and
`packages/blocknote/test/agentChat-rich.test.tsx`, alongside existing chat,
private-marker serialization/export and readonly tests. They cover rich selection,
exact reviewed profile/memory delivery, close/back/apply, stale unrelated edits,
revocation, malformed/hidden payloads and opaque source preservation. Real browser
visual/input/accessibility testing, real configured AI generation and live hosted
job execution are separate integration checks, not proven by these SDK tests.

### Generation request identity

Every prepared send carries optional-contract `requestId`, populated by the SDK
with that exact review's `reviewId`. The default ID source is `crypto.randomUUID()`.
The same identity is persisted on both the user message (before transport) and
assistant reply, enabling a host to look up a canonical generation receipt after
a lost HTTP acknowledgement without issuing a second paid request. Legacy records
without this additive field remain readable. Custom test ID generators remain
supported; a host may enforce UUIDs at its real transport boundary. This SDK does
not automatically retry generation or infer terminal failure from a missing reply.

### Explicit response recovery after reload

`AgentChatProvider.recover?(request, signal): Promise<AgentChatResponse>` is an
optional **read-only receipt lookup**, returning the same response type as
`generate`. The host must never generate, POST or fall back to generation inside
this callback. PersonalAI looks up
`GET /api/v1/embedded-chat/generations/{requestId}` and rechecks current canonical
document permission/source, employee and selected-memory authorization. Missing,
pending, unknown, expired or inaccessible receipts throw an explanatory error.
They do not prove that a paid request failed and do not authorize another send.

Before generation, the SDK atomically persists a versioned `recovery` envelope on
the pending user message. It contains the exact approved provider request,
pending-record revision, local chat-marker fingerprint, and (only for rich
document proposals) the original full local source snapshot. The envelope is
bounded to 900,000 serialized characters, within the existing 1,000,000-character
private record limit; oversized records fail before transport, without truncation.
Neither provider callback receives the local source snapshot or marker. The
envelope is removed when the response is saved, or replaced when the user
explicitly approves a new conversation turn. Legacy records lacking this envelope
remain readable and unchanged on load; the SDK never reconstructs missing approval
or guesses the original document source from today's document.

`session.load()` only loads history. `session.recover()` must be called explicitly;
the chat UI offers a separate "recover prior response" action when the final user
message has the approved envelope and the host implements recovery. Recovery
does not create another user message, call `generate`, write document content,
apply proposals, or schedule retries. A later user click may repeat the read-only
lookup if a receipt was still pending. Cancellation/disposal aborts waiting and
suppresses late adoption.

A missing receipt may remain missing if the original POST never reached the
server; the SDK does not assume that this is terminal. To move on, the user can
cancel an active wait, reload the saved conversation, and prepare and approve a
new message. The new review explicitly warns that the earlier request may still
run or have incurred cost, and that the separate new request may add cost. It gets
a fresh request ID. The old user message and request ID remain in history; only
its now-superseded recovery envelope is cleared when the new turn is saved.
Returning from or dismissing the new review leaves the prior recovery intact.
Late responses from the old wait cannot overwrite the new conversation. This
does not cancel upstream work, issue refunds, or infer that the old request failed.

Recovery validates the exact original scope, marker, route, employee profile,
selected memories and selected source before and after lookup. Rich proposals
require the complete original full-source match, including unrelated blocks.
It reads current private history before lookup and uses the same atomic
compare-and-set and response-validation/adoption path as a new send. Concurrent
history edits are never overwritten. Recovered proposals still need explicit
comparison and apply, followed by the document's ordinary save action.

The focused `agentChat-recovery.test.ts` suite exercises interruption/reload,
explicit lookup without a second generation, rich original-source preservation,
profile/memory/permission/marker revocation, cancelled and late replies,
malformed and legacy records, unknown outcomes, provider validation and competing
history revisions. BlockNote tests cover the visible recovery action, cancellation,
remount, and inert legacy/readonly/unsupported hosts. These are synthetic offline
checks; they do not prove live-provider, browser, or deployment behavior.
