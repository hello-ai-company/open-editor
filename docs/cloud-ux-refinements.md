# SDK .36 cloud UX refinements

This pass compares the SDK .36 source with its working copy. It changes presentation and transient surfaces, not document serialization, host capabilities, provider authorization, persistence or publication. The input snapshot remains unchanged.

## Confirmed source-level defects and fixes

### Space follows content and the allocated writer

The original cascade forced the page metadata region to a 182px minimum, including a late mobile override, and the narrow workspace header to a 96px minimum. Those reservations were unrelated to their actual controls. Nested compact layout, detail and workspace-grid gutters also accumulated before the editor's own padding.

- Metadata now grows from its contents; the header wraps at its natural height with a 36px minimum.
- Narrow tabbed and standalone layouts remove redundant detail/grid gutters while retaining outer and editor-content padding.
- A document-width container applies the small title treatment to an actually narrow writer, including a split pane in a wide browser.
- The cover control and tag form share a wrapping metadata-actions row below the title. Previously the cover control was the third child in a two-column `34px minmax(0,1fr)` grid: it implicitly occupied the icon column, and used its own row even when space was available beside the tag controls. The tag form stays independent so host cover controls are never nested inside it.
- Breadcrumbs can scroll horizontally; the current title truncates without forcing the document wider. Tags wrap, and an empty tag-list no longer reserves an empty flexible column.
- The duplicate gap above the document is reduced from 18px to 8px. Body font size, line spacing and reading padding are unchanged.

### Floating controls stay near their owner

The standalone selection toolbar previously used the complete workspace rectangle, including neighboring tools. Its offscreen check only considered the vertical axis.

- The fallback selection surface is bounded to `.oe-notes-document-cell` when present.
- Completely offscreen horizontal selections hide the surface, matching the existing vertical behavior.
- Standalone selection controls wrap within the bounded width.
- The integrated BlockNote formatting surface remains unified. Selection capture, F8, arrow navigation, Escape and editor transaction behavior are untouched.

### Dialogs remain within the visible viewport

`NotesOverlayPortal` previously used `window.innerWidth/innerHeight` only. On mobile, a software keyboard can reduce the visual viewport without reducing the layout viewport.

- Modal bounds now intersect their existing Notes owner with `visualViewport`, including zoom/pan offsets.
- Visual viewport resize/scroll events are observed and measurement bursts are coalesced into one animation frame.
- An owner outside the viewport hides its portal instead of leaving a one-pixel backdrop and overflowing children.
- Repositioning does not remount dialog input or move focus.
- Portal palette copying includes accent, soft, rail and muted colors. Portal buttons use the copied canvas/line palette.
- The icon picker starts 12px inside the measured owner so its maximum height cannot extend below that owner's bottom.

### Tool previews are deliberate

Inspector previews previously appeared immediately as the pointer crossed each insertion or style control, overlaying a 252px-wide example on the writer. Supported tools also supplied a native title in addition to the custom preview.

- Pointer previews require a 350ms dwell and are cancelled on pointer exit, scroll, resize or an explicit action.
- Keyboard focus shows the description immediately, with `aria-describedby` connecting the active button and preview.
- Escape dismisses the preview; IME Escape is ignored.
- Hoverless pointer environments do not start pointer previews.
- Supported tools do not create a duplicate native-title tooltip. Unavailable tools retain their explanation.

### Targets and motion

These are not blanket size reductions. Coarse-pointer header, metadata, tree, tabs, tool, portal and unified-selection controls retain or gain 44px minimum targets. The table picker grows to accommodate its five-column grid. Existing reduced-motion suppression remains in effect; no new animation is added.

## Automated verification

New dedicated tests:

- `packages/blocknote/test/notes-cloud-surface-geometry.test.tsx`: six passing tests for owner/visual-viewport intersection, keyboard-height updates, offsets, offscreen hiding, animation-frame coalescing and cleanup, writer-column selection placement, and preservation of focus/selection/input.
- `packages/blocknote/test/notes-cloud-tool-preview.test.tsx`: four passing tests for dwell versus transit, immediate keyboard descriptions, IME/Escape, pending-hover cancellation and hoverless pointers.
- `packages/blocknote/test/notes-cloud-metadata-row.test.tsx`: two passing tests for independent host-cover/tag form ownership and stable title/tag inputs across draft updates.

Existing focused regressions passed: `notes-classic-presentation`, `notes-design-selection`, `notes-floating-feedback` and `notes-page-icon` (66 tests). The BlockNote package typecheck also passed after the new test files were added. The parent audit owns the final aggregate gate and browser comparison. After the metadata-row refinement, all 58 affected classic-header, icon and selection regression tests were rerun and passed; the package typecheck passed again including all new tests.

The geometry tests use supplied DOM rectangles and a synthetic visual viewport. They verify placement logic, not browser layout or a physical mobile keyboard.

## Browser comparison scenarios

Compare the same original .36 and working fixtures at 1440px, 700px embedded and 390px widths, with identical content and page style:

1. Measure `.oe-notes-page-meta`, `.oe-notes-workspace-header`, `.oe-notes-classic-detail`, `.oe-notes-workspace-grid`, `.oe-notes-title-editor`, `.oe-notes-cover-control`, `.bn-editor`, `.oe-notes-document-cell` and `.oe-notes-tools-owner`. The metadata/header should have no unexplained forced vertical blank area. Cover control and long tags must remain inside the writer.
2. Use a narrow split pane inside a wide host. Title sizing must respond to the pane allocation. No horizontal document overflow should be introduced.
3. Open a selection dialog, retain text in its input, and reduce the visible viewport height. The portal's bottom must not exceed the visible viewport bottom; close/actions remain reachable by scrolling.
4. Move rapidly across insertion tools, then hold one for 350ms. No transit flashes; a stable described preview appears on dwell. Focus with keyboard, then press Escape during and after composition.
5. Select text near each writer edge. The fallback toolbar must remain within the writer's 12px margins and flip above the lower edge. Integrated native controls must still be a single surface.
6. Repeat with coarse pointer, reduced motion, dark page style, long breadcrumbs, many tags, focus mode and an open tool rail. Verify usable targets and no unrelated click interception.

## Limits

Browser results should be recorded separately by the audit harness; this document does not claim a full device/browser or all-capability optimum. A simulated visual viewport is not proof of physical keyboard behavior. Long selections may still leave insufficient room for a fully nonoverlapping toolbar. No external AI service, credential, remote account, publication or production data is needed for these synthetic checks.
