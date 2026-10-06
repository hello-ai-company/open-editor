# Changelog

## 0.2.0 — local release candidates, not published

Compared against integrity-verified npm releases on 2026-10-06: core/blocknote
0.1.1 and ai/canvas/publish 0.1.0. All five contain unpublished runtime changes.
This preparation includes main `f46cf9c` and local collaboration `8b306a0`.

- **editor-core 0.1.1 → 0.2.0:** bounded, cycle-safe document/JSON validation and
  checked cloning/creation. Some formerly accepted large values are rejected.
  Public exports and document schema 1 remain unchanged.
- **editor-blocknote 0.1.1 → 0.2.0:** optional saved database view contracts,
  accessible block edit dialog, editing/navigation improvements, robust unknown
  content handling and legacy-filter availability independent of structured
  filtering capabilities. BlockNote peers remain ^0.54.2.
- **editor-ai 0.1.0 → 0.2.0:** opt-in conversation-driven `createAheadSession`,
  bounded outline/research/draft preparation, cancellation acknowledgement,
  partial adoption, human-edit protection and Undo; consistent Unicode-key
  equality. This is an orchestration contract, not a model execution provider.
- **editor-canvas 0.1.0 → 0.2.0:** dedicated inspector, richer static block previews
  and correct presentation heading grouping; host-owned layouts remain separate
  from semantic content.
- **editor-publish 0.1.0 → 0.2.0:** preserve hidden ancestor visibility in slides
  and exclude hidden Canvas text from derived Site/Present metadata.

Internal core and Canvas dependency/peer floors become ^0.2.0. There are no new
runtime dependency families, export subpaths, credentials or document migrations.
The core behavioral limits and 0.x dependency boundary warrant a minor bump;
^0.1.x does not select 0.2.0. See [migration](docs/migration-0.2.md).

The example's synthetic adapter is explicitly opt-in. Real-model connection,
actual-model prompt-injection resistance, Canvas/code/voice AI operations and
Personal-AI consumption remain outside this release claim. Personal-AI main
`49c74b0` is in another repository; no dependency upgrade or automatic sync was
performed here.

The manual release workflow for core now uses the same exact reviewed main SHA,
pinned Actions/npm, immutable inspected artifact and post-publish registry proof
as the other current workflows. Local candidate consumers test unpublished
dependency tarballs; actual release guards still require live exact dependencies.
No workflow dispatch, registry publish, tag, release or deployment was performed.
