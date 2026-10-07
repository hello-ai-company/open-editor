# Notes workspace candidate .7 verification

The migration branch is local `codex/notes-workspace-migration`, based on the
protected quiet-review commit `0fcee0a4521a102c2915229699abb8c2e5df657d`.
The previous PR37 merge and main are unaffected. No migration push, merge,
publication, deployment, credentials/security change or paid provider call occurred.
The candidate manifest records the exact source commit and tarball hashes.

## Completed checks

- Full workspace typecheck and package builds passed; BlockNote was rebuilt after
  the final writer/drawer changes. Example typecheck and production build passed.
- `npm test`: **1,210 passed**: Core151, BlockNote769, AI30, Canvas57, Publish25,
  type exports6, release guards123, demo AI state13, example/Canvas publication36.
- The initial nine release-guard failures were caused by the new `/notes` export
  being absent from the exact approved export map. The map now names that one
  entry; all 123 guard tests pass. Intermediate parallel-edit/mock type failures
  were fixed. No remaining whole-suite failure is attributed to existing work.
- There is no lint script. `git diff --check`, Node QA/pack script syntax and
  Python compilation pass. A local scan of 121 public source/contract files finds
  no private absolute paths or credential patterns. This is not an npm audit or
  production security certification; no dependency install was performed.
- Five Chrome probes passed on the same final example build. Exact logs and
  extracted results are in `output/verification-notes7/browser-results.json`.
  Chrome channel/version: **154.0.8037.98**. All probes report zero external
  requests and zero page errors.
- Browser coverage: task toggle/save/reload, comment commit, style action,
  template cancel, lost-ACK authoritative lookup/reload, pending comment/row
  tab barriers and local backup, picker cancel, 320px focus trap/inert background/
  IME Escape/opener return, reduced motion, HTML draft/Apply/reload, independent
  drawing pointer/Undo/Redo/PNG, two split writers with pane-size responsive UI,
  preview/pin/close guard, Canvas report/editorial rendering, safe Site preview at
  three widths, Present preview and return to Document. A 503-block document is
  also checked at 320px. This does not exercise every exposed control.
- 33 independent boundary fixtures were reported successful by the review agent.
  Root compiled that completed message evidence in the local independent-review
  record. The later report-writing turn remained pending and was stopped; no new
  independent attestation of final root CSS is claimed.
- All 21 protected `.0`–`.6` tarball/manifest files match their prior SHA256 values.
  Other worktrees, application source and production data remain unchanged.

## Performance and bundle accounting

Final synthetic Notes route: 1440×900, Chrome154, CPU4× throttle, five iterations.
Median navigationStart-to-two-frames-after-visible-editor: **881ms**. Median
500-paragraph paste-event-to-two-frames: **357ms**, producing 503 blocks. Five raw
samples are retained. An earlier same-work run measured 876ms/344ms; neither is
compared to historical editorpaint391ms/paste598ms because the route, browser and
metric differ. No runtime improvement percentage is claimed.

Final main JS: **1,413.18kB, gzip427.44kB**; CSS: **328.11kB, gzip51.68kB**.
Protected .6 main JS/CSS: 1,400.29/317.60kB, gzip423.32/49.86kB. Main assets grew
12.89kB JS and 10.51kB CSS. The new optional Notes workbench chunk is 1,214.11kB,
gzip326.03kB, plus29.29kB CSS/gzip8.05kB; it includes optional math/diagram and
example rendering dependencies. Existing Vite >500kB chunk warnings remain.
This is bundle accounting, not proof that the full migration is lighter. The
default compatibility writer still projects a complete portable document on
changes; full typing/heap/incremental-update profiling remains future work.

## Uncompleted acceptance

The 59-row acceptance matrix explicitly distinguishes available public UI,
fixture-only checks, incomplete UI workflows and preservation-only legacy data.
It must not be treated as completed feature parity. Icon/cover/style gallery,
dictionary, deep links, selected-text/app/search AI actions, configured DB tree/
preview and specialized legacy editors have remaining integration work.

CanvasHost and tab LayoutStorage remain **unconnected**, as requested. Canvas
changes live only in that rendered surface and are not restored after tab unmount
or reload; the example states this. Actual authenticated/authorized reads, legacy
archive binding, transactional recovery storage, server CAS+history+receipt+
fencing, scoped assets/shared providers and old-writer quiescence are app-owner
gates. The prepared application read host advertises no mutation capability and
cannot establish a remote fence. Do not enable writes or delete duplicate UI/data
until every applicable gate has passed.

OS-native IME, native fullscreen/drag, real service behavior, multi-user remote
collaboration and all configured original feature paths remain unverified.
Synthetic composition events do not establish native IME correctness. No
production data, private implementation, auth settings or secrets were transferred.
