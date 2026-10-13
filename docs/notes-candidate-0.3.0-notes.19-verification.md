# .19 scoped verification

Evidence is in `output/notes19/` in the isolated `open-editor-notes-interactions` worktree.

- `interactions.json`: actual mouse DnD before a middle block; exactly one insert; native Undo/Redo; explicit save/reload with IDs/position/content; real table block; repeat/forged/cancel drops; card-picker cancellation; 122 icons/search/title-tree persistence; focus trap and hover transfer/leave/Escape.
- `extended.json`: eight schema insertion kinds and one-step Undo, including nested columns; explicit-start link and Undo; composition rejection; icon categories/page switch/library/remove/reload; ten viewport/Reduced Motion cases with bounded modal and touch labels.
- `regression/`: Split/focus/TAG/theme/hover/repeated-current-tab evidence. Original49290 connection was refused; host continuation uses the isolated copy at5208. A failed attempt to that stopped backend is retained, not counted as PASS.
- `tests-frozen.log`: all 1448 workspace/release/demo checks passed before the cover-badge test; final BlockNote run passes 1008 tests (1449 distinct checks across the retained workspace runs); `targeted-final.log` verifies the final icon/drag/picker/header changes. Lint is not configured. Build/typecheck logs and license/source-map checks are retained separately.
- `independent-review/`: separate source and operation review, with limitations recorded by the reviewer.

## Timing correction

The earlier .18 report called 128–153ms a second-frame wait; the actual script awaited **eight** RAF callbacks. That value is not input latency and does not support a responsiveness improvement. The accepted .18 tar remains immutable. The correction and existing trace classification are `../open-editor-ui-quality/output/ui-quality/longtask-followup/PERFORMANCE-ERRATA.md` and `classification.json`; the new paired script labels eight-RAF waits explicitly.

Final .18 CPU4 LongTasks occurred during tools/close operations after startup, not only during startup. The retained old trace predates writer memoization and cannot identify the final101ms caller. Its nested EventDispatch/FunctionCall/microtask totals must not be added. No all-buttons-smooth or CPU-only cause claim is made.

Native IME, Safari, universal smoothness, all59/all35 and the host's persistence of every optional block remain unaccepted. Original49290 adoption of .19 is also pending. The existing .18 was restored at49290 with the original saved store at5209; `restored-notes18-check.json` records HTTP200 document reads, writer visibility and rejected reconnect WebSocket ping to protect old unsaved tabs. This does not establish the user’s current tab contents. Performance conclusions and exact final bundle figures are recorded in the handoff and machine-readable comparison, with matching conditions only.

## Final matched performance

`performance-final/paired.cjs` and `embedded-paired.json`: Chrome154.0.8037.98, serial CPU4, identical read-only host source and synthetic SQLite, 6 tools cycles and 6 repeated Document clicks at each 1440/1280/1100/390×900. Startup/fonts settle before observing. The frame metric waits eight RAF callbacks, not input latency.

| Width | .18 tools LongTasks | final .19 tools LongTasks | Body Y before/after |
| --- | --- | --- | --- |
| 1440 | 0 | 1, max58ms | 494/494 |
| 1280 | 5, max92ms | 7, max97ms | 494/494 |
| 1100 | 1, max63ms | 2, max61ms | 520/520 |
| 390 | 1, max63ms | 1, max59ms | 634/634 |

The first .19 run had11/12 LongTasks at1100/390; reusing reviewed SVG geometry and stable UI icon elements reduced the final run to2/1. This is one repeated run, not a statistical improvement claim. Raw before/first-after traces and CPU profiles remain in `performance/`: scripting/microtasks dominated; layout/style maxima were4.4/3.8ms. Nested trace totals are not additive. Remaining desktop tool costs are explicit; no universal smoothness claim. Active Document caused no additional GET, editable change, writer replacement or LongTask at any width. Body widths stayed fixed; the390px extra48px toolbar row is gone. No database trial explorer appeared in these normal URLs.

`bundle-comparison-final.json` records the exact production size scope: **four** index JS chunks summed, one workbench chunk and six CSS assets separately. These figures must not be compared directly with earlier differently scoped JS/CSS or paint/paste figures. The standalone production example includes `NOTES-ICON-LICENSE.txt`; the SDK includes the same notice beside emitted SVG data.
