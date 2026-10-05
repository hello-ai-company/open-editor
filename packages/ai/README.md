# `@hello-ai-company/editor-ai`

`createAheadSession` adds bounded, opt-in look-ahead over the existing
`AgentAdapter`: outline → research → draft, a review queue, conversation
refinement, pause/resume/cancel and explicit partial adoption/Undo. It does not
execute models or write a document by itself. Hosts own authorization, billing,
acknowledged cancellation and document CAS. The OpenEditor example uses an
explicitly labeled local synthetic adapter; real-model integration remains
pending. See [implementation and host gates](../../docs/proactive-ai-collaboration.md).

Provider-neutral contracts and pure helpers for connecting an agent to an OpenEditor host. This package has no model or provider dependency and does not persist runs, suggestions, provenance, comments, or learning signals.

## Suggestions are proposals

Agent output is untrusted input. Parse it with `parseSuggestionGroup` before displaying or applying it. Parsing validates the whole base document and every proposed operation, including bounded JSON values, block IDs, unique IDs, anchors, and move cycles. Text diff offsets are JavaScript UTF-16 offsets and must match the exact `baseText`.

`acceptSuggestionGroup` is the only helper that returns an updated document. It takes a fresh host document and an explicit human decision; if the current document differs from the proposal's base, it returns `stale` with no document. It applies changes to a validated clone, so neither parsing, rejection, nor acceptance mutates caller-owned objects. The host supplies the agent and run identity from its registered adapter and active run when accepting; generated output cannot claim its own provenance. The accepted result includes source and decision provenance for the host to persist separately. This package does not write provenance into the editor document.

`rejectSuggestionGroup` records the explicit decision as a result without producing a document. Hosts decide how to persist that result and how to expose it in history or comments.

## Agent boundary

`AgentRequest.instruction` is the trusted, host-authored task instruction. Every `context` item is explicitly marked `trust: "untrusted"`; adapters must treat its text as quoted source data, not as instructions that override the task. Validate requests and adapter events with `parseAgentRequest` and `parseAgentRunEvent`. Suggestion event payloads remain `unknown` until the host validates them with `parseSuggestionGroup`.

The host must bind each event's `runId` to the active run and each accepted source agent ID to the registered adapter. Structural parsing does not establish identity, authorization, or trust in generated text. Treat generated strings and JSON props as untrusted data when rendering; apply host access controls and output sanitization for the chosen renderer.

The package defines contracts only. It does not manage run state, transport, credentials, retries, UI, comments, backlinks, history, or storage.

## Learning signals and preferences

Learning signals are explicit records for a host to route or persist; this package does not infer user preferences from document access or silently train on content. Preference proposals remain pending until `decidePreferenceProposal` receives an explicit accept/reject decision. Accepted proposals require `acceptedBy` and include it in the result.

```ts
import { acceptSuggestionGroup, parseSuggestionGroup } from "@hello-ai-company/editor-ai";

const proposal = parseSuggestionGroup(agentPayload);
const result = acceptSuggestionGroup(proposal, currentDocument, {
  acceptedBy: "user-123",
  acceptedAt: new Date().toISOString(),
  source: {
    agentId: registeredAgent.id,
    runId: activeRun.id,
    generatedAt: receivedAt
  }
});
if (result.status === "accepted") {
  // Host persists result.document and result.acceptedChange.provenance in its own transaction.
}
```
