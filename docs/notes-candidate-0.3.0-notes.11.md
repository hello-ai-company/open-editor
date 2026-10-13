# Notes local candidate 0.3.0-notes.11

Supersedes the intermediate .10 package without overwriting it. The final delta also clamps the hover card and the shared/portaled left navigation drawer to the supplied Notes region.

Local visual polish on immutable .9 source `8c882e01f1c5f7f50edf5841d1ff42159f2f2258`. Existing .0–.10 candidates and other worktrees are preserved. No push, merge, publish, deploy, paid AI or PersonalAI source changes were performed in this task.

- Standalone Notes fills its supplied width, including the left edge. Only explicit `hostFrame=reference` reserves excluded PersonalAI chrome in the comparison example.
- Tree hover/focus previews wait 200ms, appear 10px beside the target row as a viewport-and-owner-clamped 280×300 read-only card, and never select another editor or steal focus. Leaving, blur, drag, mode changes, scope/revision changes, scrolling and resize cancel pending reads. Generation/AbortSignal fences reject late responses. Escape restores the row, suppressing immediate reopening. Explicit public NotesPagePreview remains the independently resizable drawer.
- Document tabs prioritize titles and selection, with direct pin/close controls and a small options menu. The portaled menu stays outside tablist clipping; arrows/Home/End/Escape, outside clicks and focus return are supported. Split/preview retain the existing guarded writer and navigation paths. Pin remains one click, menu actions remain two clicks.
- The shell uses its actual allocated container and pane widths. Grid/flex minimums and editor box sizing keep long text inside the body, and narrow tool drawers are placed within the supplied host region. Closed drawers do not add work on document scroll. No extra host spacer is introduced.
- Tooltip/menu/drawer entrance uses 160ms easing, with a 100ms hover exit; Reduced Motion removes animation. Editor content, caret, layout width and scroll are not animated.

All 1,269 tests, workspace typecheck, workspace/example build and diff whitespace checks pass. The repository has no lint script. Synthetic Chrome probes cover editing, Undo, hover cancellation, menus, mobile keyboard access, long URLs, 500-block paste, split, persistence/reload/uncertain ACK, modes, widgets and 35 reference states. Independent visual review found no blocker within this scope. See the verification and host delta documents for evidence and remaining limits.

Library upload is blocked in this Mac execution environment: the current official batch helper reports `Library prepare_uploads is not available`. No Library IDs were issued. Images and a six-second video are retained locally; no direct write fallback was attempted.
