/**
 * Optional-feature compile-time tests (math/diagram present when peers installed).
 */
import { createMathPowerFeature } from "../src/math/index.js";
import { createDiagramPowerFeature } from "../src/diagram/index.js";
import { createCodePowerFeature } from "../src/code/index.js";
import { createOpenEditorPowerPreset } from "../src/features/compose.js";

type Expect<T extends true> = T;
type Extends<A, B> = A extends B ? true : false;

const math = createMathPowerFeature();
const diagram = createDiagramPowerFeature();
const code = createCodePowerFeature();

const withFeatures = createOpenEditorPowerPreset({
  features: [math, diagram, code]
});

type FeatBlock = (typeof withFeatures.schema.Block)["type"];
type FeatInline = keyof typeof withFeatures.schema.inlineContentSchema;

type _HasMath = Expect<Extends<"mathBlock", FeatBlock>>;
type _HasDiagram = Expect<Extends<"diagram", FeatBlock>>;
type _HasInlineMath = Expect<Extends<"math", FeatInline>>;
type _StillHasCallout = Expect<Extends<"callout", FeatBlock>>;

void 0 as unknown as _HasMath;
void 0 as unknown as _HasDiagram;
void 0 as unknown as _HasInlineMath;
void 0 as unknown as _StillHasCallout;
void withFeatures.featureIds;
