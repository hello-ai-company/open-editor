# .13 final source verification

Local macOS, Node22.14.0, Chrome154. Branch codex/notes-reading-polish,
base immutable .12 f35b319680aae5a1aa9f0aad220bf3ee33fe7da3.
No production data, paid API, external media/provider, auth change or PA writes.
No push, merge, npm publication or deployment performed for this local candidate.

Root typecheck, all1305 tests and root package builds pass. This adds17 database
lifecycle regressions and2 optional-Canvas tab ownership regressions to .12's1286.
Final logs are output/verification-notes13/{typecheck,full-tests,build,example-build,
blocknote-css-build}.log. After the source checks, the final CSS-only pin correction
was rebuilt with the package and example and verified in Chrome. No lint script is
configured; git diff whitespace checks pass. Existing >500KB warning remains.

Final eleven probes: output/playwright/notes13/run-ea0b7ddaa7c7/results.json.
Database renders all11 views and actually opens/returns from the10 individual-row
views through the existing writer. Dashboard shows loaded4/12 only; paging reaches
4→8→12. Gallery/Feed have4 loaded same-origin images with naturalWidth>0. Map pin
computed geometry is square<15px, min-height0/padding0/50% radius, nonwhite/opaque
engine color. Overlapping nearby world-map pins remain a limitation; the accessible
companion list opens rows. Query/config delay prevents leaving; rejection retains
preferences until Retry; query/filter reload, unapplied-filter barrier, row property
save/refresh and explicit document view-choice Save/reload pass. Mobile390 has no
horizontal overflow. DB CRUD is intentionally disabled in the synthetic provider.

The other ten probes recheck .12 reading/property/table/proposal/history/dictionary,
standalone, polish, performance, reference, classic, modes, persistence, flows and
widgets. Standalone1600/1100/840/720/390 starts at x0, reserve0 and no overflow.
Reference records35 states and checks the established12-theme/768-value subset;
full35 CSS or screenshot equality remains false. Dialogs stay inside the simulated
840px Notes owner with explicit268px reference chrome. Native OS IME/Safari/zoom
and actual PA global routing/stacking remain unverified. No browser errors or
external requests were recorded in the final probes. Synthetic CompositionEvents
and mocks do not establish native OS or actual paid/provider behavior.

Matched performance: Chrome154,1440×900,CPU4×,five samples, navigationStart→two
frames after editor visible and paste event→two frames after500-block paste.
.12 medians889ms ready/368ms paste; .13 medians879ms/359ms. These small differences
do not establish a speed improvement. Historical391ms/598ms have different conditions.
Final main JS1418.90KB/gzip429.08 (.12:1413.60/427.55), optional Notes1297.53/351.02
(.12:1289.70/348.73), main CSS391.06/60.73 (.12:390.83/60.70), workbench29.29/8.05
unchanged. Optional fixture/UI integration increases code size.

Independent source and actual screenshot review:
output/verification-notes13/independent-review.{md,json}, PASS_SCOPED.
The19 new tests include same-key newer cache, controller identity, pending search,
forced unmount/IME, deferred hydration side effects, metadata-bound retained settings
and exact explicit Retry, custom row dispatch micro-races and optional row Canvas.
A transient review-doc assertion about dropped PA document was corrected: rest
spread preserves it without blocks; with blocks the import projection takes precedence.

Earlier failed probes and logs are retained and never counted as PASS: wrong filter
label, asynchronous schema wait, overlapped map pin pointer action, and expecting an
unsaved document view choice to survive reload. The final probe awaits actual schema
readiness, uses the map companion list and explicitly saves document choices. Initial
new tests also exposed incomplete synthetic mock payload/type/Canvas constructor
arguments; final typecheck and test logs supersede those failures.

Protected43 files (all .0–.12 tarballs/manifests and immutable .12 docs) match their
saved SHA256 values: output/verification-notes13/preservation.json. No reset/clean,
old artifact overwrite, production deletion, published release manifest change or
PA source modification occurred. No automatic approval rejection occurred in this
iteration; local synthetic browser checks used the reviewed sandbox escalation.

Actual PA .12 discrepancies are in the PA contract report: generic text-only table
binder, distinct historical formats/payload precedence and exact-selector/panel
failure, and target-specific Canvas. Only the common optional Canvas contract is
implemented here; paired PA table/history/browser acceptance requires host work.
The current readonly DB callback does not authorize arbitrary mutating nested writers.
All59 host/removal gates remain false; full35/native schema/CRUD/gallery/cover/emoji/
selection AI/comments/legacy format/Secretary/real collaboration acceptance remains
open. Old Notes and Journal must remain available.
