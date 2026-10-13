# .11 verification evidence

Environment: macOS local Chrome154, Node22.14.0, synthetic fixture only; external requests blocked, paid calls0. Source branch `codex/notes-visual-polish`; starting .9 commit `8c882e01f1c5f7f50edf5841d1ff42159f2f2258`.

Before: `output/playwright/notes10/run-fa0b5f6c702c/results.json`. Target row right297.3125 versus fixed preview x1224 (gap926.6875), preview360×896, and pointer leave retained the preview. Initial desktop body did not overlap the rail (12px gap), including the long unbroken-text fixture.

After: `output/playwright/notes11/run-6c9b01ca2211/results.json`. Hover x307.3125 (gap10), 280×300; delay, rapid different-row hover, leave/blur/wheel cancellation, focus/Escape, Undo, menu keyboard/loop/close, mobile tab actions and Reduced Motion pass. The 11 layout checks cover standalone1600/1100/840/720/390, simulated embedded1600/1100/840, split1600 and CSS zoom125%/150%; no body/rail overlap or document horizontal overflow. CSS zoom and a268px margin simulation are not native browser zoom or live PA integration. Final static captures wait for entry animation; actual video is retained raw and as a six-second clip.

Final probes: `output/playwright/notes11/run-6c9b01ca2211/results.json` covers polish/standalone/modes/persistence/classic/flows/widgets/performance/reference. Final reference captures35 states; no full-image parity assertion. Original PA35 baseline contains no left tree-hover capture; its source supplies the hover geometry/motion comparison.

Validation logs: `output/verification-notes11/{typecheck,tests,build,example-build}.log`. All 1,269 tests pass (1,267 previously plus two additional behavior regressions). No lint script exists. Diff whitespace checks pass. Initial QA errors were missing storage-probe after a build, executing the esbuild binary with Node, and focusing a scrolled-out row immediately after scroll (which correctly cancels hover); corrected harness reruns pass. No automatic approval rejection occurred.

Matched performance conditions: Chrome154,1440×900,CPU4×,five samples, synthetic Notes route, navigationStart to two frames after visible editor and paste event to two frames. .9 medians890ms/358ms; .11 medians885ms/370ms. These small differences do not establish a speed improvement. Historical391ms/598ms used different conditions and are not compared. Main JS1413.19KB/gzip427.44 unchanged; optional Notes JS1256.33/338.28 versus .9 1253.40/337.06; main CSS381.84/59.42 versus376.61/58.59; workbench CSS29.29/8.05 unchanged. Existing >500KB chunk warning persists.

Independent visual evidence: `output/verification-notes11/independent-review.{json,md}`. Existing .0–.10 artifact hashes are protected and unchanged (33 files). Current .9/live PA process and other worktrees are preserved.

Library: official current helper could not reach prepared uploads in this execution environment, reporting `Library prepare_uploads is not available`; no saved ID exists. PNG captures and `output/playwright/notes11/notes11-interactions.webm` remain local. The video is1280×800,25fps,VP9,6.080000 seconds. No direct write fallback was used.

Unverified: live PersonalAI installation, native browser zoom/IME/Safari, production authorization/concurrency, paid AI, uploads/cover/providers and original59 complete migration acceptance. Whole35-image equality is false/unclaimed. This candidate is a scoped visual and interaction fix.

Additional host-bound review found that a shared navigation portal required its own compact drawer selector. Corrected in the final source, with explicit left drawer and hover bounds assertions before capture. Intermediate .10/source4411d2f and earlier .11 trial run-4e874e8dd9d9 remain immutable historical evidence, and are superseded for final host placement acceptance.
