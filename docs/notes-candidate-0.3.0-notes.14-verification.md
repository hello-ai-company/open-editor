# .14 verification — scoped local candidate

Source HEAD and package checksums are authoritative in the local manifest,
`output/candidate/0.3.0-notes.14/manifest.json`. Prior candidate files are immutable.
The preservation manifest independently checks 51 prior tarball/manifests/docs;
changed=[] before packaging. No PA source/data, remote write, publish or deployment.

## Checks

- All-workspace typecheck PASS; npm test **1,345 PASS** (+40 from .13).
  New design/selection UI tests: 30; actual bridge guard tests: 10.
  The latter use a public BlockNote editor harness while the production bridge,
  source/range/cache/IME/identity/Undo guards execute. Actual ranges use Chrome.
- Root build and example build PASS. No lint script exists; git diff --check PASS.
  Existing >500KB chunk warning remains, not a new build failure.
- Installed candidate consumer verifies public runtime/declarations, minimal
  example, prior contracts and .14 cover/selection host/bridge prop contracts.
- Independent source/visual review: scoped PASS; every issue raised was fixed and
  regression checked. Final independent notes are in output/verification-notes14.

Logs: output/verification-notes14/{typecheck,full-tests,build,example-build}.log.
All failures during development are retained, not counted as PASS. Early tests
needed corrected modal-portal selectors and explicit button names. Initial design
image exposed an extra direct grid child collapsing the body column; the toolbar
was moved inside the existing writer, with a width-invariance assertion and final
images. Resize QA now waits for committed owner bounds before measuring. Classic
first lacked its existing test-only storage probe after Vite emptied dist; explicit
prepare-notes-browser.mjs rebuild fixes reproducibility. A polish mobile immediate
focus assertion failed once; independent rerun passed without a production focus
change. Its cause remains unconfirmed, and this transient is not hidden.

## Actual Chrome operation evidence

Three frozen-build runs collectively pass twelve probes. Combined results are
`output/verification-notes14/browser-results.json`; individual evidence:

- output/playwright/notes14/run-906d0c97837c/results.json:
  design, standalone, reference. Design cover/style staged atomic Apply/reload,
  close-retention/cancel, actual selected text AI Generate/Reject/Replace/local
  Undo, source-block comment close/retention/save, focus and 390px/reduced motion.
- output/playwright/notes14/run-c66842be2ef0/results.json:
  polish, database, performance, reading. Ten row views open the existing writer;
  Dashboard loaded aggregates, query/filter/sort/paging/config reject/Retry,
  row-property save and view-choice body save/reload. Actual DB CRUD remains unbound.
- output/playwright/notes14/run-d86c8071606b/results.json:
  classic, modes, persistence, flows, widgets. Twelve themes, actual local raw-byte
  layout CAS, Canvas/Document/Present/Site, save/reload/conflict/unknown-result
  recovery, repeated/cancel/back actions, ordinary editing and widget operations.

The final passing probes report empty pageerror arrays and external requests=0;
paid calls=0. Console/network messages are not the pageerror metric.
Standalone x0/full-width/reserve0/no overflow: 1600/1100/840/720/390. Narrow owner
gallery x12/right378/bottom832 at390x844; no internal horizontal overflow, reduced
motion book transform none. New images are additional to the original 35 states.

## CSS and performance

Offline reproducible comparison `scripts/qa/compare-notes-css.mjs` covers all 35
original computed files and 35 new captures. Twelve mapped selector categories:
4,192 property comparisons, 3,536 equal, 656 different; **396 geometry differences**.
Missing baseline/candidate selectors and count mismatches are explicit. This is
mapped-subset analysis, not pixel/full CSS equality. All35 acceptance remains false.
JSON/Markdown matrix: output/verification-notes14/css35-comparison.{json,md}.

Chrome 1440x900, CPU4x, five samples, same synthetic route/metric: .13 median
ready879ms /500-block paste359ms; .14 **880ms /363ms**. No speedup claim. Historic
391/598 used different conditions/metric and is not compared directly.
Main JS1418.90KB gzip429.07 (previous1418.90/429.08); optional Notes JS1318.35KB
gzip357.66 (previous1297.53/351.02); main CSS398.12KB gzip62.07 (previous391.06/60.73).
The optional UI increases bundle size. Workbench CSS29.29KB gzip8.05 unchanged.

## Remaining acceptance

The 59-row machine ledger is complete; **none authorizes full replacement/removal**.
Original24 cover presets/floating selection toolbar/CSS, all cover geometry, upload/
Unsplash, multi-block/rich suggestions, saved/Secretary Undo, actual PA metadata/
AI/comment/provenance receipts and real DB CRUD/schema/nested writer entitlements
remain open. PA .13 owner reports API126/Web477/build and bounded known-table/history/all11
roundtrip/input/Journal checks passed. Actual .14 PA catalog/AI pairing remains
unverified; generic viewId/parent invalidation/view-config receipts need additive
common contracts. Table density and overlapping map pins remain common UX gaps. Native OS IME,
Safari, browser zoom, exact legacy variants/full35 images are unaccepted. Raw inputs
are controller-local; forced-unmount retention is not browser-restart durability.

Reproduce: root typecheck/test/build; example build; node
scripts/qa/prepare-notes-browser.mjs; existing cached Playwright runner with
--candidate notes14 and all twelve probes; offline compare-notes-css; local pack
with a new candidate version. Never overwrite an existing candidate directory.
