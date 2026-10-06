# 0.2.0 Core contract alignment: current preparation record

Local follow-up to `1e4e071` on `codex/npm-release-preparation`, 2026-10-06.
This record supersedes the earlier [preparation snapshot](release-preparation-0.2.md)
for Core acceptance behavior, verification totals and final artifact hashes.
Previous logs/tarballs under `output/npm-release-preparation/` remain intact; the
new evidence set is `output/npm-release-preparation/core-contract-alignment/`.
Both sets are unpublished local 0.2.0 candidates, not two registry releases.

## Minimal compatibility decision

The former candidate checked whole-document totals for guard/create/clone but
individual roots for save/load. A 20,001-paragraph saved document could reopen
and then fail creation/cloning or adapter validation. Extending the aggregate
restriction to the codec would reject additional existing saved documents.

The correction instead matches the existing codec's per-root scope across all
Core document paths. Root subtree block/JSON ceilings, depth ceilings and cycle
rejection remain. No arbitrary ceiling increase, truncation, automatic split,
new configuration/export or document-format migration is introduced. Only
Core model/codec runtime source changes; AI and example host runtime source,
package versions, exports, dependency floors and lockfiles remain unchanged.

| API | Result for valid plain JSON document data |
| --- | --- |
| isEditorDocument | Every root must pass the same subtree validator; false on rejection |
| createEditorDocument / cloneEditorBlocks | Same root acceptance, detached result; TypeError on invalid block rejection |
| isEditorBlock / cloneEditorBlock | One subtree under the same limits; false / TypeError on rejection |
| serialize / toSerialized / deserialize / fromSerialized | Same root acceptance; invalid roots throw EditorDocumentSerializationError, no partial output |

Each root **including itself and all descendants** has at most 20,000 blocks.
Its block depth is at most 128, root 0 (129 levels). All its props/content JSON
containers and scalar values share a 50,000-node budget across descendants;
props/content JSON depth is at most 128, value root 0. Budgets reset between
roots. Sparse root arrays are rejected rather than skipped by Array.map.

20,001 flat roots and two independent roots totaling more than 50,000 JSON nodes
now pass create/clone/codec and remain intact. A codec-loaded normalized document
can be created, cloned and saved again. Unknown block types and legacy missing
schemaVersion=1, plus existing empty-field codec normalization, are retained.
Unsupported schema versions retain their existing error behavior (creation's
ordinary Error, codec's EditorDocumentSerializationError); this correction does
not change that contract or the schema version.

## Data preservation and remaining restrictions

All processing is detached from caller-owned input; invalid later roots return
no partial document. Core does not perform persistence. Existing IndexedDB
validation/transactions and workspace failed-open handling are unchanged and
were exercised with isolated synthetic records. Rejected save/create operations
must not be followed by a fallback write; failed opens must retain stored raw
records and current edits. See [migration](migration-0.2.md).

Published 0.1.1 has no explicit subtree/depth ceilings, so a legacy single root
above the retained limits can still fail in 0.2.0. This remains a compatibility
boundary. Preserve original bytes and use the previous package line or a separate
explicitly reviewed host/migration policy; this preparation does not convert,
split or overwrite those records.

Core has no total document block/node/text/byte quota and parses JSON before
validating. Per-root validation does not bound whole-document memory/work. Hosts
must retain their own admission/operation quotas. The browser store still limits
serialized records to 4,194,304 JavaScript string code units, validates scope /
unique IDs, and enforces revision CAS. AI still separately caps whole-document
blocks, JSON nodes and text; Core acceptance does not authorize or promise AI
execution. Independent built-API checks confirm wide/Core-valid documents and
large text can still be rejected at the AI boundary.

The existing object predicate does not enforce plain prototypes; Date/Map and
accessor-bearing host objects are not a hardened untrusted-input contract. Supply
normalized JSON-shaped data. JSON.stringify before validation can already lose
Infinity as null. No real-model prompt-injection or durable host-execution
assurance is claimed.

## Verified revised candidates

Local macOS / Node v22.14.0 / npm 10.9.2:

- `npm run verify`: PASS, **800 distinct tests** (AI 52, BlockNote 467, Canvas 30,
  Core 57, Publish 25, type-export 6, release-guard 123, demo-state 13, example 27)
  plus **4 bench smoke**. Pipeline repeats BlockNote tests; count includes them once.
  Includes typechecks, builds, Core API contract, isolated consumers and production
  security audit (zero vulnerabilities).
- Core **19 new boundary regressions** cover accepted/rejected subtree counts,
  depths 128/129, JSON nodes 50,000/50,001, shared descendant/props budgets,
  wide/combined-JSON legacy documents, sparse/invalid later roots, cycles,
  shared acyclic values, detached data and legacy schema defaults. A new example
  test confirms the wide document remains within the existing host quota.
- Actual Chromium/IndexedDB/workspace **8 scenarios PASS**: wide create/load/save
  without truncation; save rejection for invalid later root, oversized subtree,
  host quota and cycle; CAS conflict; invalid persisted-record load/list/save;
  actual workspace failed initial open without an empty fallback record/write.
  Stored raw comparisons preserve content/revision on rejected operations.
  Zero page errors, external requests or API requests. Isolated fresh browser
  context only; the temporary loopback Vite process was stopped.
- Example production build PASS with the existing large-chunk warning. No new
  browser performance comparison, Safari or native host check is claimed.
- All **five** revised tarballs packed, exact inventories/security inspected and
  `npm publish <tgz> --dry-run --ignore-scripts` passed. Dry-run integrities match.
  The final five tarballs installed together outside the worktree with exact lock
  SRI/no symlinks, strict type and root/React export checks, wide/combined-JSON
  roundtrip/cloning, retained subtree rejection/codec errors, Canvas SSR,
  Markdown/Site/DOCX and explicit-start synthetic AI checks.
- Independent read-only review: Core 57 tests PASS, retained budgets, dense-root
  codec traversal, data preservation, unchanged AI/host limits and migration
  wording reviewed; no unresolved code blocker. Browser evidence is author-run
  evidence reviewed independently, not a second independent browser execution.
  Final independent artifact checks matched all five SHA-256/SHA-512 hashes,
  inventories, current source bytes, pack/dry-run metadata and installed SRI;
  previous candidate bytes remain preserved, with only Core changed.

Only Core's artifact bytes differ from the preserved `1e4e071` candidate set;
BlockNote/AI/Canvas/Publish artifacts are byte-identical. All versions remain
0.2.0, internal floors ^0.2.0, document schema 1 and public API exports unchanged.

| Key | Files | Tarball bytes | SHA-256 |
| --- | ---: | ---: | --- |
| core | 27 | 16,407 | `7155b71930b55ba5df87e58838911da82f27e87afaab38b52026bb0cca4ad6cd` |
| blocknote | 308 | 243,290 | `f98805e650e874efe9b1f956b9d44355190822fc248d2d08172c30cd50068bce` |
| ai | 27 | 30,572 | `4cd74de29b0ee12d64ceb5adc01e2f5fb75a4afd0f82bddf527c3b12b3da17f0` |
| canvas | 27 | 41,646 | `98db2cfce4da0fe352ef1d26b9c3ee2a06051aa9d19932f2e8d2a2755fe5f060` |
| publish | 7 | 24,444 | `3216c7c3c5a14b948c19fb6d8fa161d36175d085b9129d687801cf21ababc7e8` |

SHA-512, unpacked sizes, complete inventories, dry-run output, installed receipts
and browser scenario results are in the new evidence directory. Final read-only
registry check at 2026-10-06 06:52:20 UTC confirms all candidate versions are
absent and latest core/blocknote 0.1.1, AI/Canvas/Publish 0.1.0 remain unchanged.

## Remaining release gates

Candidate installs resolve all five OpenEditor packages from **local tarballs**;
third-party dependencies use public npm. This does not prove registry resolution
of OpenEditor 0.2.0 or real OIDC publication. Actual release guards still require
live exact core/Canvas 0.2.0 in dependency order and a reviewed main SHA / hosted
CI / existing publisher binding confirmation. Follow the [owner runbook](public-release-runbook.md).

No actual publish, push, PR, merge, tag, Release, workflow dispatch, deployment,
authentication/account-permission change or paid model call was performed.
Personal-AI was not upgraded or synchronized; actual model integration remains
incomplete. Formal registry release, hosted Node 20/22 checks and the pinned
Node 24/npm 11.20 publisher execution remain separate authorized operations.
