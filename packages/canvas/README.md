# @hello-ai-company/editor-canvas

Portable responsive layout specs for OpenEditor documents. Layout elements point
to semantic block IDs, so layouts do not copy document content.

```ts
import {
  createMagicLayoutSpec,
  createPresentationSlides,
  validateCanvasLayoutSpec
} from "@hello-ai-company/editor-canvas";

const layout = createMagicLayoutSpec(document, "report");
const slides = createPresentationSlides(document);
const issues = validateCanvasLayoutSpec(layout, document);
```

Templates are `landing-page`, `report`, and `presentation`. The package defines
layout data and validation only; rendering, persistence, and drag/resize belong
to the host.
