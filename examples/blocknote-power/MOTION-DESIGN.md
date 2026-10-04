# Shared visual and motion contract

Supplied contract, redistributed with the [asset reuse notice](./public/motion/idea-unfold/LICENSE.txt). The actual implementation and verification limits are described in [review evidence](../../docs/human-ai-editing-verification.md).

## Direction

Personal AI and OpenEditor should feel calm, legible, and deliberately made. Use the same tactile objects and restrained colors, with the user's content as the visual priority. These are proposed integration values, not claims about the apps' current implementation.

Keep the ornament in its own media area. Do not move it behind text, inputs, toolbars, timelines, or the editing canvas. Do not use a video as a page background. The rendered backdrop has a studio tonal gradient and is opaque; keep it in a rounded media well instead of pretending it is transparent or an exact flat CSS-color match.

## Type and spacing

Use the platform system font stack, with Japanese system fonts as available. No font download is needed. Body text: 16px, 1.6 line height. Supporting labels: 13px, 1.5 line height. Section headings: 22–24px, 1.3 line height. A homepage title may be 32–40px with a 1.2 line height; use 28–32px on narrow screens. Prefer regular and medium weights, with a restrained semibold heading. Keep Japanese tracking normal; avoid all-caps labels and excessive tracking.

Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px. Use 24–32px between related groups and at least 16px between the ornament and nearby copy. Target a 44px minimum touch hit area. Content width: 720px for prose or a focused editing introduction; wider workspaces may expand independently. Avoid horizontal scrolling at 320 CSS px. Border radius: 12px for controls, 20px for media wells. Borders are a quiet 1px, not an all-card dashboard aesthetic.

UI palette: warm white #F6F5F0, primary ink #253430, muted text #5D6B63, subtle border #D9DED7, sage surface #E6ECE6, blue surface #E6EDF2. Sage #819C8B and blue #829EB6 are object/accent colors, not default small text colors. Verify actual contrast against actual surfaces; use ink for essential text and icons. Never rely on color alone for status.

## Motion

Each supplied clip is 2.75 seconds, 66 frames at 24 fps, muted and silent, with a final settled hold of about 0.4 seconds. The movement is a small rotation/lean, not a full revolution, pulse, flash, or camera move. Motion should play at most once on a relevant entrance, then stop on the final frame. It must not restart because of a status poll, render, focus change, or an unrelated DOM update.

UI transitions remain separate: 120ms for a control state, 180ms for a small panel, 220ms for a modal/section entrance, ease-out with no bounce. Reduced motion means a static final image and no decorative transition. Stop/reset decoration promptly if the user begins reading or editing nearby. Never delay an interaction to finish a clip.

## Placement and truthful state

Personal AI home: use memory-constellation once in a welcome or empty-history area, preferably 160–240 CSS px wide, beside or above the copy. A filled home should prioritize real conversations and saved content over the ornament.

Memory-candidate processing: if used at all, display the ornament once at 96–144 CSS px beside a text status derived from actual job state. It is not a loading meter. The clip ending must not change status, advance a step, imply candidates were accepted, or mark work complete. Show "Checking memory candidates…" only while the real job is running. Show review-ready, failed, cancelled, or completed only from corresponding real events. If work continues after 2.75 seconds, keep the final still and truthful status text. Provide cancel/retry as supported by the real operation. Do not convert the constellation into fabricated memory counts or a data graph.

OpenEditor empty canvas: use idea-unfold at 180–280 CSS px with a real action such as opening an existing document or creating one. It may play once when the empty state enters view. Remove it when content exists or editing starts; it must never animate beneath or beside active text entry. No fake typing, word count, export progress, or saved indicator.

Quiet-presence: optional, static by default. If used as an entrance, play once. It does not represent microphone input, a live waveform, an assistant "thinking" measurement, or completion. Never attach it to an elapsed-time estimate.

Do not load or display all three videos on one real app screen. Product state is DOM text and accessible controls, not pixels in these videos. Existing loading/error/confirmation logic remains authoritative.

## Accessibility and loading

Decorative image/video: empty alt text and aria-hidden. Real status: separate DOM text; use a polite live region when a meaningful state changes, not on every polling tick. Preserve keyboard focus and never autofocus the ornament. Keep any user-facing replay control labeled; do not expose native video controls in the app's decorative placement.

Honor prefers-reduced-motion before assigning a video src. For reduced motion, Save-Data, optional device-memory heuristic <= 4 GB, unsupported playback, an error, or offscreen/background state, show the static final WebP/PNG. Device-memory is an optional heuristic, not a reliable measurement of capacity. Use the smallest suitable file; 480x360 MP4 is the conservative mobile source. MP4 is the baseline choice; prefer WebM only after testing the target browser/device and energy usage.

Start with a static image, width/height or aspect-ratio reserved. Set preload="none", muted and playsInline. Assign one source only once when the ornament is visible and motion is allowed. One clip, one play. Stop when document visibility changes or it exits the viewport; do not replay automatically on return. Catch rejected play() calls and video errors. Do not use infinite loops, timers that alternate visuals, canvas pixel updates, WebGL, a JS 3D runtime, or audio for these ornaments.

The sample `source/decorative-motion.js` and CSS implement this conservative behavior. They are framework-neutral examples and have not been inserted into either app. Adapt the path prefix to the app's deployment base. Treat their removal callback as mandatory when the application view is disposed.

## Budgets and verification

Proposed budget: no more than one video visible, an ornament <=280 CSS px wide, one mobile video <=500 KiB and poster <=40 KiB; desktop video <=750 KiB. The actual artifact sizes and codec results are in `qa/media-report.json`. These are file-size checks, not a guarantee of FPS, GPU memory, battery cost, or performance on low-memory phones. Three decoded 640x480 YUV420 frames would occupy about 1.32 MiB before decoder/browser overhead; browsers may buffer more. Do not infer a total-memory ceiling from that arithmetic.

Integration acceptance tests: keyboard path unchanged; no layout shift; static fallback with reduced-motion and Save-Data; no video download before eligibility/visibility; no background replay; no restart on state polling; cancel, failure, and real completion use truthful copy; autoplay rejection leaves a useful still; no moving pixels behind text; stable crop at 320/390/768/1440 CSS px. Measure actual dropped frames, responsiveness, and memory on supported devices before enabling entrance motion broadly.

## 日本語の要点

3つとも装飾用です。処理の進捗・成功・録音状態は表しません。各2.75秒、1回だけ再生し、最後は静止。文字や編集領域の背景では動かさず、実際の処理状態は独立したテキストで表示します。動きを減らす設定や通信量節約時は静止画を使い、スマートフォンでは小さいMP4を優先してください。既存アプリへの組み込みと実機確認は別途必要です。
