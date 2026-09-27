# Canvas and presentation data

`@hello-ai-company/editor-canvas` defines a layout document that points to semantic block IDs. It supports responsive stacks, grids, columns, sections/frames, and optional positioned overlays; it does not copy document text or mutate `EditorDocument`.

`createMagicLayoutSpec(document, template)` provides deterministic `landing-page`, `report`, and `presentation` layouts. Theme presets and breakpoints are bounded data, not arbitrary CSS. `createPresentationSlides(document)` derives slide groups from headings and returns block ID references.

## React Canvas editor

Import `CanvasEditor` from `@hello-ai-company/editor-canvas/react`. It renders semantic block content as escaped text, uses HTTP(S)-only image URLs, and shows safe placeholders for missing references and unsupported media. Its inspector supports selection, move up/down, move into a layout container, duplicate, hide/show, lock/unlock, alignment, spacing, theme, and mobile/tablet/desktop preview sizes. Mobile controls use buttons and selects; dragging is not required.

The host owns persistence. `onLayoutChange` emits a new validated layout after edits, while `viewState` and `onViewStateChange` keep selection, visibility, locking, alignment, and preview size outside the semantic document. Store the layout and its revision under the host's document ID. Validate loaded specs before rendering and treat stale references as unavailable content.

## Current boundary

Canvas editing is structured and responsive, not freeform. The current React surface does not provide drag/resize, group creation, a persistence adapter, or presentation controls. Hosts still own save/load, revision conflict handling, and the surrounding Document/Canvas/Present/Site mode switcher.
