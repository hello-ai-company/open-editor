# Migrating to the 0.2.0 candidate line

These five packages are local candidates, not npm-published versions. Keep using
the live 0.1 releases until a separately authorized release is verified. No
stored document is rewritten by this preparation.

## Package and runtime compatibility

All five candidates are 0.2.0 and require core ^0.2.0; Publish also requires
Canvas ^0.2.0. Core's stricter input behavior is a pre-1.0 compatibility boundary,
so 0.2.0 is deliberate rather than a silent patch. Caret ^0.1.x dependencies do
not update to 0.2.0. Upgrade related host dependencies and lockfiles together after
publication, then run that host's codec, ownership, save and UI tests.

Node >=20 and ESM remain required. There is no CommonJS export. BlockNote ^0.54.2,
optional math/diagram/code peers and React peer ranges remain unchanged. Existing
public exports/subpaths remain; AI's ahead controller and BlockNote APIs are
additive. CanvasEditor retains its public component export and includes the
dedicated inspector internally. Document schema stays 1; unknown block types
still round-trip.

## Core validation changes

`isEditorDocument`, `createEditorDocument` and `cloneEditorBlocks` share a whole
document budget of 20,000 blocks, 128 block depth and 50,000 JSON nodes. JSON depth
is bounded to 128. `isEditorBlock`/`cloneEditorBlock` and `isJsonValue` apply their
own corresponding budgets. Cycles, non-finite numbers and unsupported primitives
fail validation; shared acyclic objects are permitted. Supply JSON-shaped plain
objects: the current object predicate does not check prototypes, so values such
as Date or Map may pass and change shape when cloned through JSON. Normalize
such host objects explicitly before passing them to these APIs. For rejected
inputs, the predicates return false;
creation/cloning reject invalid or oversized values with TypeError.

Serialization has its own validation/error contract and validates individual
root blocks rather than imposing that whole-document aggregate block ceiling.
For example, 20,001 root paragraphs can currently deserialize/serialize while
`isEditorDocument` returns false and `createEditorDocument` throws. Do not claim
the same size limit is enforced at every ingress. Preserve source bytes, validate
the result with the API your host actually uses, handle
`EditorDocumentSerializationError` separately, and do not overwrite a saved record
on a failed open. Back up large documents, split them explicitly or reduce their
depth with user review before adopting the new host validation behavior.

## Host integration

- Saved database view providers and the edit dialog are optional; legacy hosts
  need not implement persistence to continue editing. Structured filtering/sort
  still requires declared server capabilities; existing simple filters remain.
- Canvas inspector changes layout only. Static previews of references are not
  connected entity data, and shortened tables are labeled. Existing host-owned
  view state/persistence rules remain.
- Export titles/descriptions and hidden-root slides may differ after the privacy
  fix. Regenerate and inspect exports; explicit public title options remain
  host-authored. There is no automatic website publication.
- `createAheadSession` is opt-in. The host owns model authorization, spend limits,
  actual cancellation, CAS writes and history. Closing/pausing cannot resume
  cancelled work. An unknown stop blocks execution. A synchronous document writer
  is not a remote durable receipt: add a separate async approval/reconciliation
  coordinator before integrating a real backend.

The bundled browser example uses local synthetic proposals, no real search or
model. Installing editor-ai does not connect an account, send a document, generate
code, access a microphone or upgrade Personal-AI. That repository's main
`49c74b0` is not automatically consumed by these packages. Real-model connection
and adversarial actual-model verification remain incomplete.
