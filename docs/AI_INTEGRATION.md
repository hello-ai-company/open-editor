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

The package is experimental and in-repo; it is not published. The current Personal AI text provider produces a draft that the user explicitly applies, but it is not yet wired to `editor-ai` suggestion groups or provenance storage.
