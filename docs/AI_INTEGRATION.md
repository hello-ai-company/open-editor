# AI integration

The core `AIProvider` remains an optional text transform seam. `@hello-ai-company/editor-ai` adds provider-neutral proposal contracts without calling a model or writing to a host.

## Suggestions

Agent payloads are untrusted. Validate them with `parseSuggestionGroup`, show the proposal for review, then call `acceptSuggestionGroup` only after a human accepts. It validates the base document again and returns `stale` with no document if the current content changed. Rejection returns a decision record without applying any changes.

```ts
const group = parseSuggestionGroup(agentPayload);
const result = acceptSuggestionGroup(group, currentDocument, {
  acceptedBy: userId,
  acceptedAt: new Date().toISOString(),
  source: { agentId, runId, generatedAt }
});
if (result.status === "accepted") {
  await host.persist(result.document, result.acceptedChange.provenance);
}
```

The host owns suggestion display, persistence, retries, and provenance storage. No suggestion mutates caller-owned values.

## Learning

`parseLearningSignal` validates an explicit event. `parsePreferenceProposal` and `decidePreferenceProposal` keep preferences pending until the host supplies an accept/reject decision. The package does not infer preferences or persist memory.

## Status

The package is experimental and in-repo; it is not published. The companion Personal-AI draft PR now connects the reviewed agent result to a parsed `SuggestionGroup`, explicit accept/reject UI, stale-revision checks, canonical note persistence, accepted-change history, and an opt-in preference action. The proposal remains untrusted until parsed and checked against the exact document revision. The host flow is still awaiting registry releases and final browser proof.
