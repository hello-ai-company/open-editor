# Cloud all-block candidate policy

The candidate `.36` SDK adds a **pure, review-only** policy in
[`packages/ai/src/blockCandidates.ts`](../packages/ai/src/blockCandidates.ts).
It evaluates every known block type plus the current host's runtime types, ranks
up to three useful choices by default, explains rejected choices, and always
retains a no-change choice. It never invokes AI, an adapter, a writer, a network
request, a renderer, a script, or an external resource. No document is rewritten.
This is an SDK development result, not a deployed Personal-AI feature.

## Small public seam

```ts
import {
  KNOWN_AGENT_BLOCK_TYPES,
  evaluateBlockCandidates,
  blockCandidateSourceKey,
  blockCandidateSnapshotKey,
  type BlockCandidateSnapshot,
  type BlockCandidateBinding,
  type BlockCandidateEvidence,
} from "@hello-ai-company/editor-ai";

const snapshot: BlockCandidateSnapshot = {
  documentId: "note-1",
  documentRevision: "body-19",
  document: {
    schemaVersion: 1,
    blocks: [{ id: "p1", type: "paragraph", content: "# Budget 42" }],
  },
  selection: { revision: "selection-3", blockIds: ["p1"] },
  capabilities: {
    revision: "capabilities-7",
    registeredBlockTypes: ["paragraph", "heading"],
    bindings: [{
      id: "host-heading-v1", blockType: "heading", kind: "text",
      sourceTypes: ["paragraph"], operations: ["format"],
      bound: true, proposalAuthorized: true,
      persistence: "durable", undo: "durable",
    }],
  },
};
const result = evaluateBlockCandidates(snapshot, { maxSuggestions: 3 });
// result.suggestions[0] is a grounded review intent, NOT a patch or permission.
// result.execution and every suggestion.execution are always "denied".
// result.diagnostics includes all 33 known types, even uninstalled ones.
```

`BlockCandidateBinding` has a target-specific `kind` union. Runtime validation
also rejects a known type labeled as a generic extension. Each target type can
have one binding; duplicate target bindings or IDs fail closed. Bindings are
**trusted host declarations**, never statements copied from model output.
They describe an already implemented, typed validator/writer contract; the
policy neither calls that implementation nor certifies its behavior.

`BlockCandidateResult` contains:

- `key`: captured document, selection, and capability freshness identity
- `suggestions`: bounded, scored, non-overlapping review intents, their stable
  `semanticKey`, exact source evidence, and a reason
- `noChange`: whether leaving the document alone is recommended, and why
- `diagnostics`: one row for every known, registered, bound, source, or evidence
  target type, with separate installation/binding/authorization/durability gates
- `rejected`: per-candidate reasons such as stale evidence, out-of-selection,
  no adapter, no permission, duplicate effect, overlap, or below threshold
- `execution: "denied"`: unconditional, even when every declared gate passes

The numeric score is a deterministic presentation priority, **not** a model
confidence, safety proof, measured benefit, or permission. Explicit markers score
72–94; host typed-format evidence scores 88 and typed-edit evidence scores 80.
The default usefulness threshold is 70. Equal scores use locale-independent
canonical-key ordering. No learning, timing, preference inference, or hidden
activity occurs.

## Installation is not execution

Each gate is separate:

1. `registeredBlockTypes`: the type is installed in this captured schema.
2. `bound`: a matching typed host adapter is actually connected.
3. `proposalAuthorized`: the host permits this **proposal** for this type.
4. `sourceTypes` and `operations`: the exact source/operation pair is bound.
5. `persistence: "durable"`: the host declares a canonical transaction, revision
   comparison, and receipt path.
6. `undo: "durable"`: the host declares durable, conflict-aware history/Undo.

All must pass to appear in `suggestions`. `"session"` and `"none"` are explicitly
reported but blocked. A declared durable path is **not evidence that any write
was persisted or can currently be undone**. There is no executed write here.
Approval, fresh authorization, server-side validation, apply-time CAS, receipt
verification, conflict handling, and Undo remain the host's separate work.
A client declaration cannot establish any of these guarantees on its own.

## Coverage and typed obligations

The fixed inventory follows the `.36` audit in
[`notes-agent-block-coverage.md`](./notes-agent-block-coverage.md). Optional and
legacy entries remain diagnostics when not installed; they are never suggested
in a host missing those registrations.

| Types | Required adapter family | Host validation obligations before any later change |
| --- | --- | --- |
| paragraph, heading, bulletListItem, numberedListItem, checkListItem, quote, toggleListItem, callout | text | Preserve exact wording, marks, inline atoms, negation, numbers, IDs, children, heading/list/check/variant properties. Validate each actual typed patch. |
| table | table | Preserve cell values, inline content, row/column order, merges, widths, headers, and identities with native table operations. |
| databaseView | database | Validate database/view identity and view-property ownership. Rows, schema, and view configuration require independent resource permissions/CAS/receipts/Undo. |
| oeColumns, oeColumn | columns | Validate parentage, ordering, widths, 2–6 columns, no cycles/orphans, and before/after structure. |
| image, audio, video, file, oeLegacyNotesAsset | media | Preserve asset identity and approved URLs; constrain captions/presentation. No fetch/upload/asset creation is implied. |
| oeHtmlWidget | html | Compare original source identity; protect unsaved source/journal data. Preserve safe preview behavior; never enable scripts or network. |
| oeNotesDrawing, oeLegacyNotesDrawing | drawing | Validate versioned payload, dimensions, coordinates, stroke IDs and legacy representation. |
| oeNotesSyncedBlock | shared | Keep shared identity and reference editing separate from shared-source writes; obtain independent authority/revision/receipt/Undo. |
| pageCard, pageTransclusion, childPage, oeLegacyNotesPageLink | reference | Preserve authorized existing page identity, parent relationships and navigation guards. Editing a reference does not authorize editing its target page. |
| oeLegacyNotesLink | link | Preserve canonical source ownership and validate grounded existing URLs; do not infer new targets. |
| codeBlock | code | Preserve source and language; review actual source changes. No execution. |
| mathBlock | math | Validate source syntax, size and renderer constraints. No math rewriting is inferred. |
| diagram | diagram | Validate source syntax, size and safe rendering. No execution or external data retrieval. |
| divider, oePageBreak | separator | Validate explicit, scoped structural intent and placement. |
| status | status | Validate allowed state and label; never infer task completion from prose. |
| oeUnknownBlock | opaque | No adapter, transformation, retype, deletion, or flattening is accepted. |
| Runtime extension types | extension | An explicit target-specific extension contract is required. Its own structured payload stays opaque to built-in text inference. |

Changing a structured source through a different adapter family is rejected;
a text binding cannot stand in for a table, database, media, drawing, shared,
reference, or other structured-resource adapter. A runtime source can only use
same-type explicit extension evidence. Unknown envelopes and descendants inside
unknown/unadapted envelopes are never candidate sources. No built-in inference
descends into child hierarchies or flattens structured inline nodes.

## Evidence and small, conservative suggestions

Built-in inference examines only **top-level paragraphs**, without children,
whose content is a string or a known array of text runs with optional styles.
It recognizes explicit heading, bullet, checkbox, quote/callout, fenced code,
fenced Mermaid, display-math and separator markers, plus rectangular tab grids.
Numbered lists require two or more consecutive markers in the range 1–99, with
matching punctuation. An isolated numbered fact, a year, date, ordinary prose,
URL, raw HTML, or a statement mentioning a database produces no such inference.
Toggle, status, page break, database, columns, media, HTML, drawing, shared,
references, legacy links, and extension changes require typed adapter evidence.

A marker indicates a possible useful structure, not a license to remove or
reinterpret characters. **No marker, number, negation, date, name, amount, ID,
URL, code, or other source character is removed or replaced by this policy.**
Any later conversion must preserve meaning and have its own reviewed, typed
patch and complete before/after validation. A grid is never evidence of a
database-row write. A URL is never evidence of a permitted asset or target-page
write. Source text is untrusted data, never instructions to the policy.

Typed host evidence is optional:

```ts
const evidence: BlockCandidateEvidence = {
  blockType: "table", kind: "table", operation: "typed-edit",
  sources: [{ blockId: table.id, sourceKey: blockCandidateSourceKey(table) }],
  effectKey: "align-existing-amount-column",
  reason: "The table adapter found inconsistent alignment in the amount column.",
};
```

The host must generate this from its actual typed analysis of captured sources,
not by relabeling model guesses as verified evidence. `sourceKey` verifies exact
source identity only. It does **not** prove the reason, semantic improvement,
proposed payload, resource permissions, or preservation. The evidence contains
no patch; any future patch must be separately checked. Render reasons as plain
untrusted text and never execute them.

## Freshness, dismissal, and scope

The host must advance document, selection, and capability revisions whenever
the corresponding state changes. These are opaque tokens, not clock values.
`blockCandidateSnapshotKey` includes the document ID/revision, selection revision
and sorted block IDs, and capability revision. Every suggestion carries that
key plus exact full-block source identities. A key is not an apply-time CAS or
an authorization token: reacquire the snapshot, reevaluate gates, and compare
sources before handing an approved patch to the host's existing durable path.

An empty selection array explicitly means whole-document scope. A nonempty array
is an exact set of allowed source IDs; it does not implicitly authorize children,
external resources, parent metadata, or referenced documents. Selecting a block
never broadens the host's separately validated patch scope.

Semantic keys ignore document/capability/selection revision churn and generated
reason wording, while including document ID, target, operation, exact source
identities, and effect. All format requests for the same sources and target share
one effect regardless of generated IDs. Typed-edit adapters supply their own
stable semantic `effectKey`; equivalent typed effects must use the same key.
Pass locally retained dismissed keys to suppress unchanged repeats. Source changes
invalidate that semantic dismissal. Parent/child or same-source alternatives
cannot occupy multiple displayed choices.

Both source and semantic keys contain **private document content** in canonical
JSON. They are exact collision-free identities, not hashes, signatures, or safe
telemetry IDs. Keep them inside the authorized host state. Never put them in
URLs, logs, analytics, or model prompts. Reusing the host's trusted revisions is
still required even with exact source evidence.

## Bounds and failure behavior

Existing JSON/core validation enforces finite values, plain data objects, dense
arrays, no getters/symbols/prototype keys/cycles, unique stable block IDs,
`schemaVersion: 1`, and aggregate depth/node/text limits. Additional limits are:

- At most 1,000 source blocks in the evaluated scope; choose a smaller explicit
  selection for a larger document. The input document still needs to fit core
  validation budgets.
- At most 256 runtime registrations, bindings, or typed evidence entries; one to
  32 exact source references per typed evidence entry.
- At most 65,536 characters per canonical source or semantic effect key. Oversized
  source identity fails closed; an oversized effect reports `semantic-key-limit`.
  Neither is hashed or truncated. Every displayed semantic key can be reused
  in the dismissal option.
- Built-in literal inference is bounded to 16,000 characters per paragraph.
  Larger blocks report `literal-inference-limit` and require a narrower, typed
  source/review workflow.
- At most five displayed suggestions (three by default); at most 256 dismissed
  keys, with the existing aggregate JSON text budget also applied to options.

Malformed snapshots or bindings throw. Stale/mismatched evidence and unavailable
capabilities produce explicit rejection diagnostics. No source content is
truncated, silently rewritten, or submitted to an API. Types without evidence
have `no-grounded-evidence` diagnostics rather than invented suggestions.

## Verification and limits

`packages/ai/test/block-candidates.test.ts` covers the 33-type inventory, runtime
extensions, all structured adapter families, each separate host gate, no-change,
scored top choices, prose/number/negation/ID preservation, exact source keys,
selection boundaries, freshness keys, semantic dedup/dismissal, parent/child
alternatives, optional registration, unknown/inline opacity, malformed and
oversized inputs, and deterministic non-mutation.

These are synthetic pure-policy tests. They do not establish host integration,
server authority, database/asset/shared/page-resource writes, real model quality,
actual persistence, network/reload recovery, or durable Undo. The existing
organization, selection-text, and small plain-text coediting APIs are unchanged;
this helper does not expand their permissions or supported execution scope.

Verified in the `.36` working copy on 2026-10-10:

- AI package suite: 171 tests passed across seven files, including 57 focused
  candidate-policy cases.
- AI package typecheck: passed.
- AI package build and public `dist/index.js` import smoke: passed, yielding all
  33 diagnostics and unconditional denied execution for an empty snapshot.
- Full-repository and browser/host integration checks are outside this module's
  verification; the coordinating task runs broader checks separately.
