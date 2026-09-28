# Agent integration

`@hello-ai-company/editor-ai` defines provider-neutral `AgentAdapter`, descriptor, request, run, status, and event contracts. An adapter starts and cancels host-owned runs; it does not own credentials, tools, policy, persistence, or UI. Suggestion event payloads remain `unknown` until validated.

Every request context item is marked `trust: "untrusted"`. Adapters keep task instructions separate from a bounded document snapshot and revision. Agent execution does not imply permission to mutate a document or run an external action.

## Personal AI

Personal AI implements its bridge outside OpenEditor. It routes explicit instructions and a separate, bounded `EditorAgentContext` through Secretary Work Intake. The server checks the document identity, persisted block-ID set, and server-owned privacy classification; it does not claim the browser snapshot's contents match stored block contents. The proposal carries the declared base revision and snapshot, and acceptance compares the full base document before using the host's server revision/CAS save path. The server does not accept browser-generated edit operations. The governed flow is Secretary → specialist → Reviewer → proposal builder → `SuggestionGroup`. The browser validates the group, base revision, provenance, and operation bounds, then waits for human review before calling `acceptSuggestionGroup` and the host's canonical note save path. No editor tool execution is exposed.

The adapter can resume and cancel the governed task and emits a proposal only after Personal AI's review path completes. The local browser run reported the configured provider as `stub`; it did not produce or fabricate an agent task or proposal. The exact agent-review golden flow and prompt-injection browser E2E remain unverified.
