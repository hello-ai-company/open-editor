/**
 * Compile-time feature composition tests for Phase 4F-2.
 */
import { createBlockSpec, createInlineContentSpec, createStyleSpec } from "@blocknote/core";
import { createOpenEditorBlockNoteSchema } from "../src/schema/createOpenEditorBlockNoteSchema.js";
import { createOpenEditorPowerPreset } from "../src/features/compose.js";
import { createBlockReferenceInlineContentSpec } from "../src/references/blockReference.js";

type Expect<T extends true> = T;
type Extends<A, B> = A extends B ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;

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
type _PresetHasCallout = Expect<
  Extends<"callout", (typeof preset.schema.Block)["type"]>
>;
type _PresetHasRef = Expect<
  Extends<"blockReference", keyof typeof preset.schema.inlineContentSchema>
>;

/** Feature-disabled: base schema without mathBlock key */
const baseOnly = createOpenEditorBlockNoteSchema();
type BaseBlock = (typeof baseOnly.Block)["type"];
type _NoMathWhenDisabled = Expect<IsNever<Extract<BaseBlock, "mathBlock">>>;
type _NoDiagramWhenDisabled = Expect<IsNever<Extract<BaseBlock, "diagram">>>;

void 0 as unknown as _HasHostBlock;
void 0 as unknown as _HasCallout;
void 0 as unknown as _HasHostInline;
void 0 as unknown as _HasRef;
void 0 as unknown as _HasHostStyle;
void 0 as unknown as _PresetHasCallout;
void 0 as unknown as _PresetHasRef;
void 0 as unknown as _NoMathWhenDisabled;
void 0 as unknown as _NoDiagramWhenDisabled;
