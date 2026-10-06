# 0.2.0 release preparation record

Historical snapshot at `1e4e071`. Its Core acceptance scope, test totals and
artifact hashes are superseded by the [Core contract alignment record](release-preparation-0.2-core-contract.md).
The old local artifacts/logs are retained; this record is not evidence for the
revised final candidate set.

Prepared 2026-10-06 on `codex/npm-release-preparation`, based on local
`8b306a028a3b07ed0d5aad6be9616fad64ae2c77`, including main
`f46cf9c548128a9b6d03134e2983e91e53b85626`. This preparation changes metadata,
release tooling, consumer expectations and documentation; it does not change
package/example runtime source or stored documents. Existing worktrees, branches,
untracked browser evidence and outputs are retained. No publish, workflow
release dispatch, push, PR, merge, tag, Release, deployment or authentication /
account-permission change was performed.

## Versions and compatibility

Read-only registry metadata and downloaded SHA-512-verified npm tarballs establish
these live baselines. Final registry read at 2026-10-06 06:29:50 UTC confirms all
five candidate versions remain absent.

| Package (`@hello-ai-company/`) | npm latest | Local candidate | Reason |
| --- | --- | --- | --- |
| editor-core | 0.1.1 | 0.2.0 | Bounded, cycle-safe validation and checked creation/cloning; some previously accepted large inputs are rejected. Explicit pre-1.0 compatibility boundary. |
| editor-blocknote | 0.1.1 | 0.2.0 | Saved-view provider types, editing/dialog/outline improvements, envelope/filter fixes, and core ^0.2.0 floor. |
| editor-ai | 0.1.0 | 0.2.0 | Additive opt-in ahead session and proposal equality fixes; core ^0.2.0 peer. |
| editor-canvas | 0.1.0 | 0.2.0 | Internal inspector, richer static previews and heading grouping fixes; core ^0.2.0 floor. |
| editor-publish | 0.1.0 | 0.2.0 | Hidden-parent and derived-title/description fixes; core and Canvas ^0.2.0 floors. |

All five have unpublished runtime differences against their respective live
baselines. Their coordinated 0.2.0 line avoids implying ^0.1.x drop-in compatibility.
MIT, Node >=20, ESM, existing export subpaths and document schema 1 remain.
BlockNote/React/optional math-diagram-code peer ranges remain. Root and example
lockfiles agree with all workspace versions and internal dependency floors; no
third-party resolved dependency versions changed.

See [changelog](../CHANGELOG.md) and [migration](migration-0.2.md). In particular,
creation/cloning whole-document limits differ from serialization's per-root-block
validation. Host objects with Date/Map prototypes require explicit normalization;
the current object predicate does not reject those prototypes. Preserve source
bytes and handle failed opens without overwriting a saved record. CanvasInspector
is internal to CanvasEditor and is not a new public export.

## Verification

Local environment: macOS, Node v22.14.0, npm 10.9.2. Logs and candidate tarballs are
under `output/npm-release-preparation/` and are excluded from this commit/package
contents.

- `npm run verify`: PASS, including all workspace typechecks and builds, **780**
  tests (AI 52, BlockNote 467, Canvas 30, Core 38, Publish 25, type-export 6,
  release-guard 123, demo-state 13, example 26), Core API/security checks, production
  audit (zero vulnerabilities), all isolated consumers and **4** bench smoke tests.
  The verify pipeline also reruns BlockNote's suite; the 780 total counts it once.
- `npm run build --prefix examples/blocknote-power`: PASS. Vite's existing large
  chunk warning remains; this preparation makes no performance-improvement claim.
- Five `npm pack --ignore-scripts` artifacts: PASS exact inventory, public metadata,
  export targets/declarations, MIT, no links, and no detected secret/private-path
  or unrelated-product content. Contents are package.json, README, LICENSE and
  approved dist JS/types/maps/CSS only; no logs, fixtures, screenshots, source
  tree, node_modules, .env, Git metadata or evidence/report files are packed.
- Five `npm publish <candidate.tgz> --dry-run --ignore-scripts --json --access public
  --registry=https://registry.npmjs.org`: PASS. Dry-run name/version/SHA-512
  integrity exactly match packed artifacts. This is not publication or OIDC proof.
- Final five tarballs installed together outside the worktree: PASS, no symlinks,
  exact lock SHA-512 matching the artifacts below, strict consumer typecheck,
  public root/React imports, document codec, Canvas SSR, Markdown/Site/DOCX,
  explicit-start AI and the Core large-document boundary.
- The regular isolated AI consumer also exercises the installed ahead session
  with a local synthetic adapter: untrusted context, tool-disabled metadata,
  bounded execution, no automatic document write, partial adoption, duplicate
  adoption rejection and Undo. No model call or real user data was used.
- Independent read-only reviewer: release guards **123 PASS**, workspace/lock/API
  consistency, fail-closed core anchor/404/immutable version behavior, candidate
  versus registry gates, exact-SHA workflow and migration caveats reviewed; no
  unresolved preparation blocker. This is an AI review, not owner approval.
- JavaScript syntax check of **23** changed modules and `git diff --check`: PASS.
  No JS lint command is configured.

Preparation caught and corrected stale Core consumer 0.1.1 expectations and a
host-specific name in the packed AI README. Failed trial logs are retained
separately; final verify/inspection/dry-run logs show the successful reruns. The
inspection rules were not relaxed to make the candidate pass.

## Final local artifacts

Sizes are bytes, not editor/browser performance measurements. These local
artifacts are review evidence; release workflows must prepare fresh source-SHA
bound artifacts from the separately reviewed main commit.

| Key | Files | Tarball bytes | Unpacked bytes | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| core | 27 | 16,104 | 62,796 | `8792095e5d8ea61285a74a27113baf764d31d7614c65ce12ac480a747cf81371` |
| blocknote | 308 | 243,290 | 1,339,256 | `f98805e650e874efe9b1f956b9d44355190822fc248d2d08172c30cd50068bce` |
| ai | 27 | 30,572 | 145,861 | `4cd74de29b0ee12d64ceb5adc01e2f5fb75a4afd0f82bddf527c3b12b3da17f0` |
| canvas | 27 | 41,646 | 208,467 | `98db2cfce4da0fe352ef1d26b9c3ee2a06051aa9d19932f2e8d2a2755fe5f060` |
| publish | 7 | 24,444 | 107,426 | `3216c7c3c5a14b948c19fb6d8fa161d36175d085b9129d687801cf21ababc7e8` |

Exact SHA-512/npm metadata and complete inventories are retained in
`output/npm-release-preparation/candidate-artifacts.json`, `*-candidate-pack.json`
and `*-publish-dry-run.json`. `final-candidate-consumer-result.json` records the
installed final identities and integrities. `registry-final-proof.json` records
the final read-only registry status. Reproduce the isolated final artifact check
with `node output/npm-release-preparation/final-candidate-consumer.mjs` after
packing the same files and recording their metadata.

## Remaining release and integration steps

Follow the [owner runbook](public-release-runbook.md): reviewed main SHA and
hosted CI/preflight (configured Node 20/22), existing Trusted Publisher/Environment
binding confirmation, separately approved exact package publication, then
core → BlockNote/AI/Canvas → Publish. The current registry lacks core/Canvas 0.2.0;
actual dependent-package release guards deliberately reject that state. Local
candidate consumer success is not registry-live dependency evidence. Real OIDC,
workflow execution and npm account bindings were not checked or changed here.
The pinned publisher toolchain uses Node 24/npm 11.20.0 and still requires hosted
verification; local npm 10 dry-run does not establish its authentication behavior.

The complete BlockNote compatibility matrix and browser scenarios were not rerun
in this metadata preparation; the supported 0.54.2 base and optional-feature
consumer checks did run. No new before/after browser performance measurement or
Safari/native host check is claimed.

Real-model connection and actual-model adversarial/timeout/cancellation/save
reconciliation remain incomplete. The browser example is explicitly synthetic.
Personal-AI main `49c74b0` is a separate repository and was neither upgraded nor
automatically synchronized; consuming this package line and implementing durable
host execution require their own reviewed task. Tags, GitHub Releases and
deployments remain separate operations.
