# .22 verification

Evidence is under `output/widget22` in the isolated widget checkout. Final full workspace typecheck/test/build and example build pass; 1472 distinct tests pass. Strict synthetic-fixture typecheck passes. The candidate pack step validates strict declarations and runtime against the extracted public tarballs. No lint command is configured. Existing example >500kB chunk warnings are retained.

Chromium 154.0.8037.98 uses disposable contexts with only local5224/data/blob routes, synthetic local storage and test-only host callbacks. HTTP POST and page errors are recorded. No actual PA trial installation or original-store writes. The test fixture is `examples/blocknote-power/widgets-interaction-fixture.html`; it imports SDK public entries and is not part of the production example entry.

Confirmed cases: actual right-sidebar Whiteboard DnD and first/repeated draw; header/background and SVG child clicks; seven drawing tools; drawing Undo/Redo, clear Cancel, pointercancel; save/reload; leave document/return; actual Split; 390px and Reduced Motion; Columns normal/hover/keyboard/Escape, width, sibling reorder, text preservation, selected paragraph movement, empty column re-entry; native/legacy and host-defined drawing factories; HTML source Apply and retained inert JavaScript; local and synthetic-host shared text with one named write; legacy link/page/asset fields; pageCard/childPage callbacks, read-only transclusion, read-only database search, status; Code input/selection; optional math/diagram source input and closing; touch-emulated options and drawing.

Columns controls occupy zero flow height and opening leaves the tested layout height unchanged. Drawing repeated strokes retain 636px width. These are geometry/interaction checks, not whole-app performance measurements. Prior Chromium144/CPU4 paste/paint measurements and different bundles are not directly comparable to this run. No speed certification is inferred.

Native whole-block/column-body dragTo did not settle within the headless Mac diagnostic limit; logs are retained, and this workflow remains unverified. Other deliberate limits: physical touch, Safari/iOS, actual IME, remote/authorized media upload, Unsplash, live shared persistence, all live DB views/writes, long sessions. Earlier harness selector/fixture problems and the fixed width/empty-column regressions remain in diagnostic logs; final results are separate.

Reproduction with already available dependencies and Chrome:

```sh
npm run build
./node_modules/.bin/vite --config scripts/qa/widgets-interaction-vite.config.mjs
# In another terminal; set OPENEDITOR_PLAYWRIGHT_PATH to an existing Playwright package if it is not locally resolved.
node scripts/qa/verify-widget-interactions.cjs
node scripts/qa/verify-widget-native-inputs.cjs
```

`OPENEDITOR_QA_ORIGIN` and `OPENEDITOR_QA_OUTPUT` select the private local origin and evidence directory. The scripts report nonzero exit status for failed checks/page errors. They install nothing, route external requests to abort, and use disposable contexts. Stop/restart only the QA server; do not rebuild packages while running the browser flow, because Vite would reload active tests.
