# Canvas and presentation data

`@hello-ai-company/editor-canvas` defines a layout document that points to semantic block IDs. It supports responsive stacks, grids, columns, sections/frames, and optional positioned overlays; it does not copy document text or mutate `EditorDocument`.

`createMagicLayoutSpec(document, template)` provides deterministic `landing-page`, `report`, and `presentation` layouts. Theme presets and breakpoints are data, not arbitrary CSS. `createPresentationSlides(document)` derives slide groups from headings and returns block ID references.

## Current boundary

The package validates specs, IDs, references, breakpoints, dimensions, and themes. It does not render or persist Canvas, implement drag/resize/group/hide/lock controls, provide mobile Canvas editing, or implement presentation navigation/fullscreen. Hosts must connect the layout spec to a renderer and their own view-state storage.
