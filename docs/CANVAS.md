# Canvas and presentation data

`@hello-ai-company/editor-canvas` defines a layout document that points to semantic block IDs. It supports responsive stacks, grids, columns, sections/frames, and optional positioned overlays; it does not copy document text or mutate `EditorDocument`.

`createMagicLayoutSpec(document, template)` provides deterministic `landing-page`, `report`, and `presentation` layouts. Theme presets and breakpoints are bounded data, not arbitrary CSS. `createPresentationSlides(document)` derives slide groups from headings and returns block ID references.

## React Canvas editor

Import `CanvasEditor` from `@hello-ai-company/editor-canvas/react`. It renders semantic block content as escaped text, uses HTTP(S)-only image URLs, and shows safe placeholders for missing references and unsupported media. Its inspector supports selection, move up/down, move into a layout container, duplicate, hide/show, lock/unlock, alignment, spacing, theme, and mobile/tablet/desktop preview sizes. Mobile controls use buttons and selects; dragging is not required.

The host owns persistence. `onLayoutChange` emits a new validated layout after edits, while `viewState` and `onViewStateChange` keep selection, visibility, locking, alignment, and preview size outside the semantic document. Personal AI's R3 source stores the layout, view state, theme, Canvas revision, and canonical block revision in the note metadata record with debounced saves and compare-and-swap checks. Validate loaded specs before rendering and show missing block references as unavailable content.

## Current boundary

Canvas editing is structured and responsive, not freeform. Pixel resize and drag gestures are not provided. Personal AI's note workspace mounts the Document/Canvas/Present/Site switcher, Create Website flow, persisted Canvas inspector, responsive Site preview, and presentation player. That host integration is source-complete only; it still needs published registry dependencies and final browser verification before it can be called released.
