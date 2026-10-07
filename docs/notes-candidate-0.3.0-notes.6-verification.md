# Quiet review UI verification

Local branch: `codex/quiet-review-rail`, based on candidate .5. The previous PR37 merge is `f40afa485683ad381f0a4f5e95596f5511f64863`; both post-merge GitHub workflows (CI 37561420618 and public preflight 37561420608, Node20/22) completed successfully. This UI branch is local only.

## Checks

- Workspace type checking, 964 existing tests and package builds passed. Example type checking/build passed separately. There is no repository lint script; syntax and whitespace are checked explicitly.
- Six local Chromium probes cover normal editing, links, repeated lifecycle actions, conflict/reload/lost acknowledgment, capability guards and layout. Synthetic fixture only; zero external requests.
- Layout: desktop body begins at y234 in a 1440×900 viewport, compared with y830 in the earlier review-below-editor screen. Proposal arrival preserves document bounds and window scroll. Accepting a heading naturally changes text baseline; this is not reported as zero geometry change.
- 504-block document, middle/bottom scrolling, 320px explicit sheet, keyboard trapping/return, settings invalidation, title cancellation, IME event guards, keyboard approval and Undo, reduced motion, 720×450 viewport and Chromium pinch zoom are exercised. The narrow proposal chip remains in the header, outside text; 25 ArrowUp transitions verify caret visibility beneath it.
- Independent review exercises dialog keys and checks actual desktop/mobile images. Native OS IME remains unverified.

## Bundle sizes and performance limits

Current example main JS: 1,400.29kB (gzip 423.32kB), main CSS: 317.60kB (gzip 49.86kB), unchanged at reported precision from .5. The lazy organization module is 42.18kB (gzip 13.62kB); its CSS is 16.89kB (gzip 3.63kB). The existing Vite chunk-size warning remains. This is bundle accounting, not a runtime speed measurement. Historical Chromium CPU-throttled editorpaint/paste numbers used different conditions and are not compared.

Actual browser evidence, per-probe results and immutable candidate hashes are recorded in the local verification handoff. Unknown-save outcomes, permission changes and rejected plans are not treated as successful mutations. New Notes workspace migration is tracked separately and is not implied by these UI results.
