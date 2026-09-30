# Canvas and presentation data

`@hello-ai-company/editor-canvas` defines a layout document that points to semantic block IDs. It supports responsive stacks, grids, columns, sections/frames, and optional positioned overlays; it does not copy document text or mutate `EditorDocument`.

`createMagicLayoutSpec(document, template)` provides deterministic `landing-page`, `report`, and `presentation` layouts. Theme presets and breakpoints are bounded data, not arbitrary CSS. `createPresentationSlides(document)` derives slide groups from headings and returns block ID references.

## React Canvas editor

Import `CanvasEditor` from `@hello-ai-company/editor-canvas/react`. It projects visible semantic content into a static preview, uses HTTP(S)-only image URLs, and shows safe placeholders for missing references and unsupported content. Workspace references render a generic label or an explicit `titleHint`; Canvas does not expose their private IDs or fetch host metadata. `databaseView` stays an explicit placeholder because database rows belong to the host.

The inspector supports selection, move up/down, move into a layout container, duplicate, hide/show, lock/unlock, alignment, spacing, theme, and mobile/tablet/desktop preview sizes. Keyboard-operable inspector controls are available on mobile. Optional Pointer Event dragging moves unlocked items inside an absolute-positioned layout, captures the active pointer, and clamps movement to the parent bounds. Structured stacks, grids, and columns remain the main layout model; Canvas does not provide pixel resize handles or general freeform positioning.

The host owns persistence. `onLayoutChange` emits a new validated layout after edits, while `viewState` and `onViewStateChange` keep selection, visibility, locking, alignment, and preview size outside the semantic document. Personal AI's R3 source stores the layout, view state, theme, Canvas revision, and canonical block revision in the note metadata record with debounced saves and compare-and-swap checks. Validate loaded specs before rendering and show missing block references as unavailable content.

## Current boundary

Canvas layout and inspector state are host-persisted; neither Canvas nor its preview owns workspace metadata or database rows. Site and Present use a separate allowlisted static projection. See the [cross-mode compatibility matrix](./cross-mode-compatibility.md) for supported projections and omissions. Personal AI's note workspace mounts the Document/Canvas/Present/Site switcher, Create Website flow, persisted Canvas inspector, responsive Site preview, and presentation player. Browser evidence verifies Canvas save/reload and conflict choices, plus Site rendering without overflow at 375, 390, 768, and 1440 px. The overall product loop remains partial: the candidate registry dependencies are unpublished, the agent-review flow is blocked by the configured stub provider, and multi-slide keyboard/fullscreen behavior still needs browser proof.
