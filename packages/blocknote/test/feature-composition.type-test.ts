/**
 * Compile-time feature composition tests for Phase 4F-2 R1.
 * These must fail if schema is typed as `any`.
 */
import { createBlockSpec, createInlineContentSpec, createStyleSpec } from "@blocknote/core";
import { createOpenEditorBlockNoteSchema } from "../src/schema/createOpenEditorBlockNoteSchema.js";
import { createOpenEditorPowerPreset } from "../src/features/compose.js";
import { createBlockReferenceInlineContentSpec } from "../src/references/blockReference.js";
import { createMathPowerFeature } from "../src/math/index.js";
import { createDiagramPowerFeature } from "../src/diagram/index.js";
import { createCodePowerFeature } from "../src/code/index.js";

type Expect<T extends true> = T;
type Extends<A, B> = A extends B ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;

const hostBlock = createBlockSpec(
  {
    type: "hostBlock" as const,
    propSchema: {},
    content: "none" as const
  },
  { render: () => ({ dom: document.createElement("div") }) }
);

const hostInline = createInlineContentSpec(
  {
    type: "hostMention" as const,
    propSchema: {},
    content: "none" as const
  },
  { render: () => ({ dom: document.createElement("span") }) }
);

const hostStyle = createStyleSpec(
  { type: "hostMark" as const, propSchema: "boolean" },
  { render: () => ({ dom: document.createElement("span") }) }
);

const withHost = createOpenEditorBlockNoteSchema({
  blockSpecs: { hostBlock: hostBlock() },
  inlineContentSpecs: {
    hostMention: hostInline,
    blockReference: createBlockReferenceInlineContentSpec()
  },
  styleSpecs: { hostMark: hostStyle }
});

type HostBlock = (typeof withHost.Block)["type"];
type HostInline = keyof typeof withHost.inlineContentSchema;
type HostStyle = keyof typeof withHost.styleSchema;

type _HasHostBlock = Expect<Extends<"hostBlock", HostBlock>>;
type _HasCallout = Expect<Extends<"callout", HostBlock>>;
type _HasHostInline = Expect<Extends<"hostMention", HostInline>>;
type _HasRef = Expect<Extends<"blockReference", HostInline>>;
type _HasHostStyle = Expect<Extends<"hostMark", HostStyle>>;

const preset = createOpenEditorPowerPreset();
type PresetBlock = (typeof preset.schema.Block)["type"];
type _PresetNotAny = Expect<Extends<IsAny<PresetBlock>, false>>;
type _PresetHasCallout = Expect<Extends<"callout", PresetBlock>>;
type _PresetHasRef = Expect<
  Extends<"blockReference", keyof typeof preset.schema.inlineContentSchema>
>;
type _PresetNoMath = Expect<IsNever<Extract<PresetBlock, "mathBlock">>>;
type _PresetNoDiagram = Expect<IsNever<Extract<PresetBlock, "diagram">>>;

const math = createMathPowerFeature();
const diagram = createDiagramPowerFeature();
const code = createCodePowerFeature();

const withFeatures = createOpenEditorPowerPreset({
  features: [math, diagram, code] as const
});

type FeatBlock = (typeof withFeatures.schema.Block)["type"];
type FeatInline = keyof typeof withFeatures.schema.inlineContentSchema;

type _FeatNotAny = Expect<Extends<IsAny<FeatBlock>, false>>;
type _HasMath = Expect<Extends<"mathBlock", FeatBlock>>;
type _HasDiagram = Expect<Extends<"diagram", FeatBlock>>;
type _HasInlineMath = Expect<Extends<"math", FeatInline>>;
type _StillHasCallout = Expect<Extends<"callout", FeatBlock>>;

const withCodeOnly = createOpenEditorPowerPreset({
  features: [code] as const
});
type CodeOnlyBlock = (typeof withCodeOnly.schema.Block)["type"];
type _CodeOnlyNoMath = Expect<IsNever<Extract<CodeOnlyBlock, "mathBlock">>>;
type _CodeOnlyNoDiagram = Expect<IsNever<Extract<CodeOnlyBlock, "diagram">>>;

void 0 as unknown as _HasHostBlock;
void 0 as unknown as _HasCallout;
void 0 as unknown as _HasHostInline;
void 0 as unknown as _HasRef;
void 0 as unknown as _HasHostStyle;
void 0 as unknown as _PresetNotAny;
void 0 as unknown as _PresetHasCallout;
void 0 as unknown as _PresetHasRef;
void 0 as unknown as _PresetNoMath;
void 0 as unknown as _PresetNoDiagram;
void 0 as unknown as _FeatNotAny;
void 0 as unknown as _HasMath;
void 0 as unknown as _HasDiagram;
void 0 as unknown as _HasInlineMath;
void 0 as unknown as _StillHasCallout;
void 0 as unknown as _CodeOnlyNoMath;
void 0 as unknown as _CodeOnlyNoDiagram;
void withFeatures.featureIds;
void withCodeOnly.editorOptions;
