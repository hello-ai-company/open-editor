# .12 final source verification

Local macOS, Node22.14.0, Chrome154. Source branch `codex/notes-reading-polish`,
base .11 `5f55c611d2fd06610280c04cde89c5a3e8dbe114`. Only synthetic records,
authorized mock projections and existing cached dependencies were used.
No paid API/provider or production data calls. No PersonalAI source changes.

Final logs are `output/verification-notes12/{typecheck,full-tests,build,example-build}.log`.
Typecheck, all1286 tests, package builds and example build pass. No lint script is
configured; git diff whitespace checks pass. Existing >500KB chunk warning remains.
The16 initial new regressions and one additional method-receiver regression account
for the17-test increase over .11's1269. Full tests cover aborted/late/scope-changed
service results, runtime projection admission, public picker draft-only/cancel/
provider-instance switching/IME search, legacy modes, reading without restore,
proposal repeated clicks/unknown Undo, and table auto-width JSON roundtrip. Native
OS IME is unverified; synthetic CompositionEvents do not establish it.

Final browser evidence: `output/playwright/notes12/run-144575d3d089/results.json`.
Reading checks all22 property authorities, direct values/selects/multiselect,
four public pickers, action and reload; DB8/12→12/12 paging and8×5 preview; proposal
reject/adopt/Undo/lost-ACK lookup through the existing writer; history reading,
literal dictionary; cancelled table and actual3×4 insertion/save/reload; narrow
Reduced Motion; legacy user text picker/save/reload without inferred identity.
Three dialogs are bounded and unoccluded by elementFromPoint in a synthetic268px
host reserve with840px Notes owner. This is simulation, not live PersonalAI chrome.
Standalone1600/1100/840/720/390 uses x0/full width and no document overflow. General
polish/standalone/classic/modes/persistence/flows/widgets/reference/performance
probes exercise existing features and writer retention. The reference probe captures
35 states and compares a recorded12-theme subset; full image/CSS equality is not
asserted. New legacy presentations have component/regression evidence, not original
historical-record/live-host image acceptance.

Matched performance: Chrome154,1440×900,CPU4×,five iterations, navigationStart→two
frames after editor visible and paste event→two frames for500 blocks. .11 medians
885ms/370ms; .12 medians889ms/368ms. These differences do not establish a speed
improvement. Historical391ms/598ms use different conditions and are not compared.
Main JS1413.60KB/gzip427.55 (previous1413.19/427.44), optional Notes1289.70/348.73
(previous1256.33/338.28), main CSS390.83/60.70 (previous381.84/59.42), workbench
CSS29.29/8.05 unchanged. Additional UI increases optional code and common CSS.

Earlier .12 failed runs remain evidence: initial build/read sequencing load error,
unfixed table serialization failure, CSS dialog stacking defect, then harness
assumptions about responsive host reserve and mistaking the static Open-note header
for a button. Final repaired browser runs supersede them; none is counted as PASS.
No automatic approval rejection occurred in resumed implementation/checks. Process
listing required the normal reviewed sandbox escalation; local browser checks used
the same allowed review path.

Independent review: `output/verification-notes12/independent-review.{md,json}`.
Previous .0–.11 artifacts stay retained;24 prior tarballs match their recorded
manifest SHA256 values (`preservation.json`). The original temporary whole-file
snapshot was unavailable after resumption; no fabricated36-file snapshot assertion
is made. .11 tracked documents/source are unchanged by this iteration.

Unverified/pending: all59 full workflows, all11 configured DB views/CRUD/native
schema UI and old row drawer, full gallery/cover/emoji/selection tools, every legacy
widget/history-graph admission, actual Secretary provenance/partial adoption/Undo,
full35-image CSS/nativeIME/Safari/native zoom/global app routing, real PA provider
bindings and paid AI/media services. All59 removal gates remain false. The candidate
is a verified incremental common-package handoff, not complete replacement.
