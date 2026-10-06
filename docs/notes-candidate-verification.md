# Local Notes candidate verification — 2026-10-06

Candidate worktree: `open-editor-notes-parity`, branch `codex/notes-parity-0.3`,
base `6ac78a392f4de63c9c5667650f849112060e6ce1`. Existing original and human-ai
worktrees, their untracked artifacts and concurrent PersonalAI work were retained.
No reset/clean, real provider calls, installation, remote push, publication or merge.

## Checks

- Root `npm run typecheck`: PASS. Final additive AI snapshot test also checked with
  `npm run typecheck -w @hello-ai-company/editor-ai`: PASS.
- Root `npm test`: **853 PASS** (AI 73, BlockNote 499, Canvas 30, Core 57,
  Publish 25, auxiliary Node/release/demo 6+123+13, example 27).
  Baseline root typecheck/tests passed before candidate changes; no existing
  failing tests were hidden. Named negative-path tests containing “FAIL” are
  successful rejection tests, not failed checks.
- Root build and example TypeScript/Vite build: PASS.
- BlockNote bench smoke: **4 PASS**. `git diff --check`: PASS.
- No lint script/config is provided by this repository; lint is not claimed.
- Unpublished `0.3.0-notes.0` BlockNote/AI tarballs: public runtime imports and
  TypeScript declarations PASS in a separate consumer using local cached peers.
  No network install was performed. Exact hashes/file inventories/source commit
  are in `output/candidate/manifest.json`; `CANDIDATE.md` travels inside each tarball.

Logs: `output/verification/`. Reproduction commands are deliberately local-only.

## Actual Chrome regression

Cached Playwright CLI 0.1.18, macOS Chrome/Chromium **154.0.8037.98**, loopback
preview servers; synthetic documents/provider only. No sandbox permissions were
widened to make iframe tests pass.

- `scripts/qa/quiet-visual-browser.mjs`: four compact modes, mode/panel body
  preservation, opt-in, no autonomous write, unchanged caret/selection/scroll
  during hypothesis, synthetic composition suppression after mode switches,
  rejection, rapid duplicate approval (one new paragraph), Undo, refusal to Undo
  over later human edits, stop checkbox synchronization, all four modes at
  390×844 without page overflow, Reduced Motion, saved rich text reload and renewed
  opt-in. PASS. DB load controls are view state, so saved rich content was compared
  independently of host row UI.
- `scripts/qa/theme-controls-browser.mjs`: outer/inner theme synchronization,
  dark Canvas inspector, explicit Light under dark OS preference, unchanged
  Canvas content palette, Storage disclosure and page width at **320/390px**,
  keyboard column resize, **44×44** column arrows, HTML editor opening/Escape. PASS.
- `scripts/qa/document-workspace-browser.mjs`: desktop two-column grid,
  script/network markup exclusion, empty sandbox/CSP, nonexecuted JS, repeated
  opener disabled, Escape/Cancel source preservation and focus return, late file
  import cancellation, mobile column stacking, preview fitting and saved source
  reload. PASS.
- `scripts/qa/matched-comparison-browser.mjs`: before/after screenshots for all
  four modes, identical synthetic saved revision and initial view state, separate
  contexts, 1440×900, Reduced Motion. PASS. Earlier pre-resume images are also kept.

Evidence: `output/playwright/*-result.txt`, PNGs and
`output/review/OpenEditor-candidate-review.pdf` (seven pages). Mobile, source,
search/commands, quiet review, columns and dark screenshots accompany the report.

The Mac execution connection failed once before visual edits applied. It was
resumed only after the user reconnected. Browser QA found and fixed composition
listeners attached to an old editor DOM after mode return. Transient chunk 404s
while replacing the local build were resolved by reloading a fixed build; saved
data remained intact. Initial QA used macOS End (page scroll) and compared DB
display state as content; the final fixtures use Mac line-end keys and rich-content
checks. These are not waived application failures.

## Independent review

Read-only reviewer, separate memory/React+JSDOM fixtures, no shared browser writes:
durable receipt aliasing/Unicode equality, lost acknowledgements, human conflicts,
codec no-op preservation/deletion/archive bounds, React/ProseMirror DOM loop,
column layout and late imports reviewed and corrected. Quiet blocked/ready/opt-in,
late results/cancellation ACK, limits, StrictMode subscriptions, new document-port
Undo reset, inactive/visibility/IME/focus checked. Final mode DOM-remount regression
fixture: **15 assertions PASS**, no writes. Visual tokens/reduced motion/digits:
**51 assertions PASS**; Canvas content selectors, actual inspector name, dark
focus contrast and 44px arrows corrected. Final verified review scope had no
unresolved major findings. Real OS IME is outside JSDOM/synthetic events.

## Reproducible performance

This comparison is **pre-resume functional candidate vs final local candidate**,
not the historical 9afd818 baseline. Same Chromium 154, fresh default synthetic
documents, 1440×900, CPU throttling **4×**, Reduced Motion, one discarded warmup
and **five measured runs per build**. Definition: navigation to visible editor
plus two animation frames; synthetic clipboard paste of 500 paragraphs to last
rendered marker plus two frames. Exact samples: `output/performance/comparison.json`.

| Metric (median) | Before candidate | Final candidate |
| --- | ---: | ---: |
| Editor visible | 457.9 ms | 463.3 ms |
| 500 paragraph paste | 616.7 ms | 572.8 ms |

Paste is about 7.1% faster in this run after skipping rich JSON conversion when
the structural scan finds no columns. Column validation still runs for any
column/group, including pasted orphan columns. Decorations cache by immutable
ProseMirror document identity, avoiding selection-only recomputation. Initial
display did not improve; run variability is retained, not presented as certainty.
Initial pre-optimization samples are preserved separately.

Final main JS **1397.01 kB / gzip 422.36 kB**, CSS **316.38 kB / gzip 49.63 kB**.
The existing >500kB Vite chunk warning remains. Historical user figures
1333.58/401.79 kB, 292.16/45.60 kB, 391/598 ms use a different build/Chrome/metric
definition and are not directly compared. Broad bundle-size optimization remains
future work; this is not a blanket speed or lightweight claim.

## Acceptance boundary

See `docs/notes-candidate-handoff.md` for public APIs/props/codec/archive/CAS/Undo
and exact remaining gaps. Full Notes replacement, JavaScript widget execution,
advanced DB/table/drawing/sync features and PA backend fixture acceptance remain
pending. Unsupported new custom blocks are preserved but can show existing
Canvas/Present/Site placeholders. Structural column actions can reset inline
selection offset. Real Japanese IME, Safari/native foreground/offline, real assets,
production auth/concurrency, real provider transport and billing were not tested.

The public source and candidate artifacts are ready for a **bounded adapter
trial**, with host fallbacks retained; they are not approved for publication or
automatic migration of owner documents.
