# Selected Personal-AI context — Mac integration

This Mac integration uses `codex/human-ai-editing` at `9afd818`, retaining the
existing toolbar, mobile, AI review, Canvas and database work. The supplied cloud
reference uses `1f8ef33a8063336ef0a4b690740a1cfed52ccc31`. These are different
baselines; the complete cloud patch was not applied and App was not replaced.
The received reference and raw evidence are retained locally and excluded from
the public change. See [verification summary](./human-ai-editing-verification.md).

## Seven reference files

| Reference path | Mac handling |
| --- | --- |
| `examples/blocknote-power/src/App.tsx` | Adapted: original editor remains mounted; Tools opens a lazy workbench, returning restores scroll/focus; chunk error permits returning to Document. |
| `examples/blocknote-power/src/PersonalContextWorkbench.tsx` | Adapted to shared design: independent synthetic document, explicit source selection, statement/inference, reason/source metadata, partial adoption, decision receipt, async operation guard, synthetic failure controls, explicit save/restore. |
| `examples/blocknote-power/src/selectedPersonalContext.mjs` | Reference state contract retained and tightened: matching snapshot/current document version, selected-change validation, bounded timestamps and recording metadata, inference labeling, synthetic-only saved context and generated proposal/undo lineage. |
| `examples/blocknote-power/src/selectedPersonalContext.d.mts` | Retained type surface with partial-adoption IDs and current synthetic document versions. |
| `examples/blocknote-power/src/personalContextWorkbench.css` | Adapted to the Mac paper/ink/sage tokens, system fonts, 44px controls, readable reasons and responsive columns; no empty artwork slot. |
| `examples/blocknote-power/test/selected-personal-context.test.mjs` | Six reference tests retained; expanded to nine covering explicit source selection/partial adoption, deleted/offline/stale sources, synthetic-only restore and timestamp/recording inference rules. |
| `docs/selected-personal-context-local.md` | Rewritten for actual Mac integration, verification and remaining boundaries (this document). |

## Authorization and review boundary

External EditorContext JSON is a bounded untrusted snapshot, not a grant or proof
of current approval. It contains an exact document ID/version and explicitly
selected memory IDs/versions with assertion, content, rationale, source date and
source turn ID. Recording metadata, if present, must describe a self-speaker
selection; summaries remain inference. Extra token, grant or full-transcript
fields are rejected. Rendering uses text, without executing external content.

External imports are preview-only. No network, model, real Personal-AI API or
production verifier is connected. Synthetic mode verifies only the fixed sample
document/memories and produces a labeled deterministic draft. Propose and accept
verify current target and source versions; acceptance additionally requires exact
base text/version. Only chosen changes enter the synthetic document. Reject
retains human text; undo requires the exact accepted text/version and cannot
overwrite subsequent edits. The original BlockNote Document is separate.

The synthetic paused/deleted/changed/offline controls disable proposal/adoption.
Pure tests also invoke verification failures during acceptance and prove that no
partial write occurs. Source metadata is shown with each change; user statements
and inference are labeled independently.

## Local persistence and reload

Explicit Save stores this synthetic workbench only under
`open-editor.synthetic-selected-context.v1`. It does not save the main Document,
external imported snapshots, real private memories, account data or auth. Restore
validates size, structure, document identity, source bounds, fixed synthetic
source identities and deterministic proposal/undo lineage. Corruption retains
the current document. The restored proposal/undo cannot run until the user
explicitly reactivates synthetic verification. A pending proposal and an accepted
change both survive save/reload/restore with these checks. Workbench navigation
also retains mounted state.

Main Document still correctly says `Session only · not saved` and resets on
reload. Durable main-document storage was not part of the supplied seven-file
synthetic workbench; it remains host-owned.

## Assets and verification

The supplied Blender Idea unfold ZIP was obtained through canonical Library
materialization and its official transfer helper. The local ZIP retains
provenance; its transfer metadata and private identifiers are not redistributed.
ZIP integrity passed, and deployed MP4/static files and license match supplied
bytes. The actual guide uses `IdeaUnfold.tsx` and `decorativeMotion.mjs`, with
assets under `public/motion/idea-unfold`. Other kit ornaments are retained locally
and not loaded. No Blender re-render was needed.

Desktop 640×480 and mobile 480×360 MP4 playback was confirmed in Chromium.
Natural end, keyboard input, offscreen entry and failed/autoplay-denied playback
return to a loaded static image. Reduced Motion and Save Data request no MP4.
Once consumed, reopening/reentering does not replay. Background stopping is
verified through a synthetic DOM visibility event and lifecycle tests; automated
native tab switching did not produce a hidden state here and remains unconfirmed.
Low-memory/disposal conditions are covered by lifecycle tests.

An additional one-time native attempt used two verified tabs in the same new
headed Chromium window and minimized/restored only that owned window. Tab target
activation and native window bounds commands succeeded, but `document.hidden`
remained false with no visibilitychange. Video kept advancing; the still after
restoring the window was natural completion at 2.75 seconds, not a confirmed
background stop. These scenarios are blocked, not passed. Native desktop/browser
control tools are not exposed in this environment. No further retry or synthetic
substitution was used to claim completion. The app code is unchanged; the test
browser and dedicated preview were closed. The verification summary records
these observations; raw generated logs are retained locally only.

The blank-document guide was tested by deleting the sample text and remaining
independent blocks using the real editor's Block actions. It shows the blank
guide, focuses editing on Start writing, hides after input, keeps text across
views and resets on reload according to its session-only label. The misleading
sample-sentence hint was removed.

Relevant final example typecheck, build, 13 state/contract tests and 14 example
tests passed. Browser scripts/results, screenshots and asset integrity evidence
are retained locally, with a public verification summary linked above. The full workspace
typecheck/test/build also passed; no workspace package code changed in the final
hint adjustment. The existing large-bundle warning remains; no lint script exists.

## Remaining production integration

A real authenticated host must bind the current document/version and explicit
memory IDs/versions to Personal-AI's editor-context endpoint before proposing and
accepting. Current owner, workspace and approvals, atomic host document writes, writer
coordination, secure private persistence, multi-device sync, real model proposals
and recorder endpoints remain unconnected. Synthetic storage and client checks
do not supply these guarantees. Safari, Firefox, touch hardware and accessibility
assistive technology remain outside the verified environment. This is a review
change; it does not deploy the app, publish npm packages, change authentication
or call chargeable APIs.
