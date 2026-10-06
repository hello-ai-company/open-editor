# @hello-ai-company/editor-canvas

## 0.2.0

Requires `editor-core ^0.2.0`. Adds a dedicated
inspector within `CanvasEditor` and richer static previews for lists, tables, callouts and
references, and corrects presentation heading grouping. Existing root and React
subpaths remain; React peers are unchanged. Layout references do not copy document
content, and the host owns layout persistence. Review the core validation limits
before upgrading. See the [migration guide](https://github.com/hello-ai-company/open-editor/blob/main/docs/migration-0.2.md).

Responsive Canvas layout specs and a React editor for OpenEditor documents.
Layout elements point to semantic block IDs, so Canvas rearranges presentation
without copying or changing document content.

```tsx
import {
  createMagicLayoutSpec,
  createPresentationSlides,
  validateCanvasLayoutSpec
} from "@hello-ai-company/editor-canvas";
import { CanvasEditor } from "@hello-ai-company/editor-canvas/react";

const layout = createMagicLayoutSpec(document, "report");
const slides = createPresentationSlides(document);
const issues = validateCanvasLayoutSpec(layout, document);

// The host owns and persists the layout and optional editor view state.
<CanvasEditor
  document={document}
  spec={layout}
  onLayoutChange={setLayout}
  viewState={viewState}
  onViewStateChange={setViewState}
/>
```

Templates are `landing-page`, `report`, and `presentation`. The React editor
renders stacks, grids, columns, sections, frames, content references, and safe
placeholders for unsupported media. It supports selection, mobile-friendly
reordering and moving, duplication, hide/show, lock/unlock, alignment, spacing,
theme, and responsive preview controls. Rich document content remains owned by
`EditorDocument`.

`onLayoutChange` is the persistence seam: hosts validate and save the resulting
`CanvasLayoutSpec` with their document ID and revision policy. `viewState` can be
stored separately; selection, visibility, locking, alignment, and preview size
never enter the semantic document.

The editor intentionally has no freeform drag/resize or group-creation UI.
