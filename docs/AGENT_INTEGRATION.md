# Agent integration

`@hello-ai-company/editor-ai` defines provider-neutral `AgentAdapter`, descriptor, request, run, status, and event contracts. An adapter starts and cancels host-owned runs; it does not own credentials, tools, policy, persistence, or UI. Suggestion event payloads remain `unknown` until validated.

Every request context item is marked `trust: "untrusted"`. Adapters must keep task instructions separate from document/context text. Agent execution does not imply permission to mutate a document or run an external action.

## Personal AI

Personal AI implements its bridge outside OpenEditor. It routes explicit instructions through `instructSecretary` and the Work Intake path. It does not create `AgentTask` directly or call execution APIs from the editor. The current Work Intake endpoint has no separate untrusted-context field, so the adapter rejects requests containing document context rather than embedding note text in the instruction.

This is an intake bridge: it reports the created task/goal identifier, but does not yet stream specialist results into OpenEditor suggestions, expose cancellation from the editor, or implement the full researcher → reviewer → policy → accepted-suggestion golden flow.
