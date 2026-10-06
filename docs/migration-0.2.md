# Migrating to 0.2.0

All five packages are published on npm as 0.2.0. See the
[verified release record](release-0.2.md). Installing the release does not rewrite
stored documents; review the compatibility boundaries below before upgrading.

## Package and runtime compatibility

All five packages are 0.2.0; adapters require core ^0.2.0, and Publish also requires
Canvas ^0.2.0. Core's stricter input behavior is a pre-1.0 compatibility boundary,
so 0.2.0 is deliberate rather than a silent patch. Caret ^0.1.x dependencies do
not update to 0.2.0. Upgrade related host dependencies and lockfiles together,
then run that host's codec, ownership, save and UI tests.

Node >=20 and ESM remain required. There is no CommonJS export. BlockNote ^0.54.2,
optional math/diagram/code peers and React peer ranges remain unchanged. Existing
public exports/subpaths remain; AI's ahead controller and BlockNote APIs are
additive. CanvasEditor retains its public component export and includes the
dedicated inspector internally. Document schema stays 1; unknown block types
still round-trip.

## Core validation changes

All Core document predicates, creation, cloning and codec paths now validate
**each root subtree independently**, matching the existing codec's acceptance
scope. They no longer reject a document solely for combining valid roots.
20,001 flat root paragraphs and multiple roots whose combined JSON nodes exceed
50,000 therefore remain readable, creatable, clonable and serializable.

| Scope | Retained limit |
| --- | --- |
| Each root plus all its descendants | 20,000 blocks, including that root |
| Block depth | 128, counting the root as 0 (129 levels) |
| All props/content values across one root subtree | 50,000 JSON nodes; containers and scalar values each count as one |
| JSON depth | 128, counting each props/content value root as 0 |

The budgets reset between roots, not between descendants or a block's props and
content. `isEditorBlock`/`cloneEditorBlock` apply the same subtree limits;
`isJsonValue` applies the JSON budget to its one input. Shared acyclic values are
allowed and count on each visit. Cycles, non-finite numbers, unsupported
primitives, sparse/malformed roots and oversized subtrees fail validation.
Predicates return false; creation/cloning throw TypeError; invalid blocks at both
codec ingress paths throw EditorDocumentSerializationError, with no partial
document returned. Codec normalization of empty props/children and legacy missing
schemaVersion defaulting to 1 remain.

There is **no Core aggregate document block/node/character/byte quota**, and JSON
parsing occurs before validation. Core's per-root limits do not guarantee bounded
total memory or work. Hosts must retain their own total-size and operation quotas;
the browser store's existing serialized-record length limit is 4,194,304 JavaScript
string code units, and AI contracts independently retain their total block/node/
text budgets. A document accepted by Core can still be too large for a host or AI
operation; never silently truncate or split it to satisfy those limits.

Unlike published 0.1.1, retained subtree/depth ceilings may reject a legacy single
large or deeply nested root. Preserve source bytes and the current editable
document on a failed open/save. Do not fall back to an empty document and autosave
over the record. Keep the previous package line available for such records until
an explicit, reviewed migration or host policy is chosen. Any split/depth change
requires user review and a separate copy; this release performs neither.

Supply JSON-shaped plain objects: prototype validation remains unchanged, so
Date/Map values may pass and change shape when cloned through JSON. Normalize
such host objects explicitly. Validate before plain JSON.stringify too, which
otherwise converts Infinity to null and loses the original invalid value.

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
