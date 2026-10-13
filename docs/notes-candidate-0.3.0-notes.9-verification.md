# Notes .9 local verification — 2026-10-07

Worktree `open-editor-notes-parity`, branch `codex/notes-local-candidate9`, .8 base `c8bd9ddf87917b73f1bf3dadb412d59e9ac1e15b`. Synthetic local data only. No old worktree/process was removed, no paid API/provider used, and no remote publication or real-data migration performed.

## Checks

| Check | Result / evidence |
|---|---|
| Workspace typecheck | Pass; `output/verification-notes9/final-typecheck.log` |
| Full test suite | 1,267 pass; `final-tests.log`; 14 independent new tests with a further Library-page-open assertion added during root verification |
| Workspace / final BlockNote build | Pass; `final-workspace-build.log` and `final-blocknote-build.log` |
| Example typecheck + production build | Pass; `final-example-build.log`; existing >500KB chunk warning |
| Lint / whitespace | No repository lint script; `git diff --check` pass |
| Final UI probes | `output/playwright/notes9/run-bf5e1b0b5925/results.json`: standalone, reference, classic, flows, persistence, performance pass |
| Other UI probes | `run-3a5f7d76e713/results.json`: smoke/widgets/modes pass before the final Library/split-only fixes; relevant final flows/persistence rerun |
| Recorded external requests / page errors | Zero in the named probes; paid calls zero. Initial CLI launcher favicon404 is separate from these captured page-error results |
| Prior candidate preservation | All 27 protected .0–.8 archive/manifest hashes match `/tmp/oe-notes9-protected.json` |

The browser tests use cached Playwright CLI with local Chrome154.0.8037.98, Node22.14.0. No dependency install was needed. Drawers, modal cancellation/focus, synthetic composition barriers, unknown acknowledgments/query-only recovery, pending-comment/row draft guards, local backup and reload are exercised. Native Japanese IME, Safari, actual offline Mac/OS behavior, real model streaming and production providers remain unverified.

## Standalone full width

The final probe verifies viewport/container left `x=0`, no artificial reserve, no horizontal overflow at 1600/1100/840/720/390. Desktop navigation starts at its ordinary 22px padding. At 720 and 390 the body equals the editor-surface width (644px and 322px), including after closing the right drawer. Info is operable, Tab/Shift+Tab stays inside, Escape closes it, and Focus mode exits back to tools. Import source survives category switches and reopening. Library cards do not overlap/collapse; selecting the current page returns to the same retained writer.

Screenshots: final run's `standalone-1600.png`, `standalone-390.png`, `standalone-library.png`. The comparison-only URL explicitly adds `hostFrame=reference`; the full-width URL does not.

## Reference subset and remaining differences

`output/verification-notes9/final-reference-comparison.json/.md` records all 35 states with paired sampled rectangles/CSS and unavailable states. Reproduce with `scripts/qa/compare-notes-reference.py`. The authority is the original Notes .2 baseline with unifiedNotes=false, not the .7 trial. Conditions are Chrome154, DPR1, en-US/English app, light global scheme, Reduced Motion, fonts ready; responsive captures preserve each recorded width. Full-page screenshots are not claims of identical pixel output.

Twelve-theme title/body/block-content/rail computed subset: **768/768 match**. Standard desktop metadata/title/body/rail/panel rectangles match inferred document coordinates. This does not cover all sampled components or whole images. Reference scroll offsets were not recorded: retain raw coordinates; inference from shell offset does not prove sticky/fixed/internal-scroll equality.

Remaining measured examples: Info rail/panel heights differ by −13.05px; Library height +29.78px with different authorized summaries/order; split primary body y −8px, secondary metadata height −22px; mobile body minimum height +80px and 390 metadata y +4px. Per-state element/CSS/count differences remain in the JSON. Public icon paths/picker/cover/native gallery/tool-hover previews/Info metadata/Library details still differ. Studio DB/HTML/columns fixture is unavailable and cannot be called a match. The original Secretary proposal service is not mounted in this synthetic Notes workspace. Open picker, native gallery/focus visuals and Canvas/Present/Site require separate reference acceptance; no 36th accepted state exists.

## Performance and bundle

Same synthetic Notes route, Chrome154, 1440×900, CPU4×, five samples; ready means navigation start to two frames after visible editor, paste means paste event to two frames after 500 paragraphs (503 total blocks).

| Candidate evidence | Ready median | Paste median |
|---|---:|---:|
| .8 `run-221bfd0c6c4f` | 888ms | 362ms |
| .8 second retained run `run-4c097d75845c` | 885ms | 349ms |
| .9 final `run-bf5e1b0b5925` | 890ms | 358ms |

.9 raw ready `[891,884,891,875,890]`, paste `[394,358,359,345,348]`. Differences are within run variation; **no speed improvement claimed**. Earlier 391ms/598ms used other conditions/metrics and are not directly comparable.

Final example main JS 1,413.19KB / gzip427.44KB; optional Notes chunk 1,253.40KB / gzip337.06KB; main CSS376.61KB / gzip58.59KB; workbench CSS29.29KB / gzip8.05KB. Presentation grew rather than proving a bundle reduction. Packaging validation separately compiles/runs public extracted entries and the minimal TSX example; its manifest identifies the final source commit and archive hashes.
