/**
 * Optional-feature compile-time tests (math/diagram present when peers installed).
 */
import { createMathPowerFeature } from "../src/math/index.js";
import { createDiagramPowerFeature } from "../src/diagram/index.js";
import { createCodePowerFeature } from "../src/code/index.js";
import { createOpenEditorPowerPreset } from "../src/features/compose.js";

type Expect<T extends true> = T;
type Extends<A, B> = A extends B ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;

const math = createMathPowerFeature();
const diagram = createDiagramPowerFeature();
const code = createCodePowerFeature();

const withFeatures = createOpenEditorPowerPreset({
  features: [math, diagram, code] as const
});

type FeatBlock = (typeof withFeatures.schema.Block)["type"];
type FeatInline = keyof typeof withFeatures.schema.inlineContentSchema;

type _NotAny = Expect<Extends<IsAny<FeatBlock>, false>>;
type _HasMath = Expect<Extends<"mathBlock", FeatBlock>>;
type _HasDiagram = Expect<Extends<"diagram", FeatBlock>>;
type _HasInlineMath = Expect<Extends<"math", FeatInline>>;
type _StillHasCallout = Expect<Extends<"callout", FeatBlock>>;

const withoutOptional = createOpenEditorPowerPreset();
type BaseBlock = (typeof withoutOptional.schema.Block)["type"];
type _BaseNotAny = Expect<Extends<IsAny<BaseBlock>, false>>;
type _NoMathWhenDisabled = Expect<IsNever<Extract<BaseBlock, "mathBlock">>>;
type _NoDiagramWhenDisabled = Expect<IsNever<Extract<BaseBlock, "diagram">>>;

void 0 as unknown as _NotAny;
void 0 as unknown as _HasMath;
void 0 as unknown as _HasDiagram;
void 0 as unknown as _HasInlineMath;
void 0 as unknown as _StillHasCallout;
void 0 as unknown as _BaseNotAny;
void 0 as unknown as _NoMathWhenDisabled;
void 0 as unknown as _NoDiagramWhenDisabled;
void withFeatures.featureIds;
