# Human and AI editing demo: review evidence

This review is based on R3 at `9afd81847a5fabd0ba58169f1db2572ddf1bb681`,
the head of Draft PR #30, rather than replacing that PR or its database/Canvas
work. The selected-context reference used the older `1f8ef33` baseline and was
adapted file by file. See [integration mapping](./selected-personal-context-local.md).

## Completed behavior

- Quiet paper/ink/sage design, system fonts without font downloads, grouped
  auxiliary tools, responsive controls and independent database-table scrolling.
- Document/Canvas/Present/Site navigation retains pending reviews; keyboard
  command/search paths, Escape, closing, Focus and outline navigation remain usable.
- The authored sample review exposes two independently selected changes with
  reasons and before/after text. Accept/reject/undo, repeated-click guards and
  protection of later human edits were exercised with synthetic data.
- The independent selected-context workbench distinguishes statements from
  inference, shows source IDs/versions/reasons and copies only selected changes.
  Propose/accept revalidate the synthetic document and selected sources.
- Explicit synthetic browser save/reload/restore was exercised for pending and
  accepted proposals. Restore requires reactivation before adoption/undo;
  malformed storage is rejected without replacing current text. Human edit
  conflicts, revoked/deleted/changed/offline sources stop adoption.
- External JSON is untrusted, bounded and preview-only: no real verifier,
  model call, external private-memory storage or original Document modification.
- A blank document was created through ordinary editor deletion and block
  actions; guidance, Start writing focus, dismissal on input, retained text across
  views and session-only reset on reload were verified. The invalid sample hint
  was removed.

## Blender asset and lifecycle

The supplied original procedural Idea unfold assets were obtained through the
canonical Library transfer flow. ZIP integrity passed. The five shipped media
files and the reuse notice match the supplied bytes; no source ZIP, Blender
project, transfer metadata or other ornaments are published. The original reuse
grant permits copying, distribution and sublicensing; it is preserved at
`examples/blocknote-power/public/motion/idea-unfold/LICENSE.txt`.

| File | Bytes | SHA256 |
| --- | ---: | --- |
| `motion.mp4` | 86155 | `fd9a9795dd8bc3391e39ae24a95e547222ad2af07f310be4757be64646420d33` |
| `motion-mobile.mp4` | 28782 | `5f4b63dcadc989ba7d49a3752db1121bc39623375cae7a67f23ec1b7f02f855f` |
| `poster.webp` | 7602 | `b950623ead0e0a5d8093ba71d480cf0484ef68dbfd70430b9e575adfcb8f05c4` |
| `reduced-motion.webp` | 7902 | `5a3d44bd683af0db24e8a0660fa1ca6b987de6c61db304097923d1a9b34029f4` |
| `reduced-motion.png` | 65953 | `569d68626eaff5f571b07bc631b78923420a1d702144be4a755de983bbc7d4c9` |

Chromium decoded desktop 640×480 and mobile 480×360 clips. The loaded still
returns after natural end, keyboard input, real offscreen scrolling, network
failure and autoplay denial. Reduced Motion/Save Data request no MP4. Guide
reopening does not replay. Lifecycle tests cover low-memory, disposal and hidden
events; browser hidden-event testing used an explicitly synthetic DOM event.

**Native background stopping is not verified.** A separate headed-browser test
used two confirmed tabs in one owned window. Tab activation/return did not change
`document.hidden=false` or `visibilityState=visible`; video advanced from about
0.012 to 1.040 seconds. Minimizing/restoring that owned window returned minimized
bounds but no page visibility event; video advanced to 2.653 seconds and settled
only through natural end at 2.75 seconds. Neither scenario is counted as a pass.
No private tabs, desktop settings or visibility overrides were used in that
attempt, and testing stopped rather than repeating a synthetic substitute.

## Verification

Local full-workspace typecheck/test/build passed. Final related checks passed:
example typecheck/build, 13 demo/contract state tests and 14 example tests
(9 media lifecycle, 4 database discovery, 1 Canvas publication). No lint script
exists. The inherited Vite >500kB main-chunk warning remains.

Production-browser scenarios covered 1440×900, 390×844 and 320×740, enlarged text,
light/dark, partial adoption, double clicks, human edits, reject/undo, view
navigation, explicit saves and corruption, external JSON restrictions, blank
guidance, keyboard/Escape and failed lazy chunks returning to Document. Ordinary
scenarios recorded no page exceptions. Generated browser logs and downloaded
handoffs remain local and are intentionally excluded from the PR.

## Performance limits

Measurements compared the retained pre-change demo build against the improved
build under Chromium 153.0.8010.12, 1440×900, CPU throttle 4×, Reduced Motion, five
runs each. Pasting the same 500-block HTML fixture at the same sample paragraph
produced 511 blocks in every run. Input timing uses two animation frames.

| Median | Before | After |
| --- | ---: | ---: |
| Editor paint | 496.6ms | 342.2ms |
| FCP | 424ms | 284ms |
| Normal input | 14.3ms | 14.6ms |
| Input after 500-block insertion | 12.6ms | 14.0ms |
| 500-block paste | 501ms | 500ms |

The final wording adjustment was made after timing measurements. Main assets
changed from JS 1335.86kB/gzip402.54kB and CSS294.40kB/gzip46.00kB to
JS1344.50kB/gzip405.19kB and CSS301.59kB/gzip47.20kB. The workbench is a lazy
17.45kB/gzip5.74kB JS chunk plus 4.09kB/gzip1.17kB CSS. Faster measured startup
does not establish causality or a universal speedup; typing did not improve.
Earlier measurements with mismatched block counts were excluded. Older browser
measurements are not directly compared.

## Remaining boundaries

Real authenticated Personal-AI API/host verification, model generation, recording
APIs, private persistence, atomic real-document writes, multi-device coordination
and native visibility behavior remain unconnected/unverified. Original Document
was session-only in PR31; the subsequent [local persistence change](./local-document-personal-ai.md)
adds separate normal Document storage and a synthetic API host. The performance
measurements above describe PR31, not that later version.
Safari/Firefox, physical touch and assistive technology are unverified. This PR
does not change versions, dependencies, workflows, repository visibility,
authentication, service settings or production databases, and does not publish
packages or deploy the app.
