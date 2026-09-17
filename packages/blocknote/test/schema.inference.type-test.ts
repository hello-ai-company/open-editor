/**
 * Compile-time schema inference tests.
 * These are not executed by vitest (not *.test.ts); they fail `tsc` if inference regresses.
 */
import {
  createBlockSpec,
  createInlineContentSpec,
  createStyleSpec
} from "@blocknote/core";
import {
  createOpenEditorBlockNoteSchema,
  createPowerSchema
} from "../src/schema/createOpenEditorBlockNoteSchema.js";

type Expect<T extends true> = T;
type Extends<A, B> = A extends B ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;

const defaultSchema = createOpenEditorBlockNoteSchema();
type DefaultBlockType = (typeof defaultSchema.Block)["type"];

type _HasCallout = Expect<Extends<"callout", DefaultBlockType>>;
type _HasStatus = Expect<Extends<"status", DefaultBlockType>>;
type _HasUnknown = Expect<Extends<"oeUnknownBlock", DefaultBlockType>>;
type _HasParagraph = Expect<Extends<"paragraph", DefaultBlockType>>;

const createMyBlockSpec = createBlockSpec(
  {
    type: "myBlock" as const,
    propSchema: {
      label: { default: "" as const }
    },
    content: "none" as const
  },
  {
    render() {
      return { dom: document.createElement("div") };
    }
  }
);

const myInlineContent = createInlineContentSpec(
  {
    type: "myMention" as const,
    propSchema: {},
    content: "none" as const
  },
  {
    render() {
      return { dom: document.createElement("span") };
    }
  }
);

const myStyle = createStyleSpec(
  {
    type: "myHighlight" as const,
    propSchema: "boolean"
  },
  {
    render() {
      return { dom: document.createElement("span") };
    }
  }
);

const extended = createOpenEditorBlockNoteSchema({
  blockSpecs: {
    myBlock: createMyBlockSpec()
  },
  inlineContentSpecs: {
    myMention: myInlineContent
  },
  styleSpecs: {
    myHighlight: myStyle
  }
});

type ExtendedBlockType = (typeof extended.Block)["type"];
type ExtendedInlineType = keyof typeof extended.inlineContentSchema;
type ExtendedStyleType = keyof typeof extended.styleSchema;

type _HasCustom = Expect<Extends<"myBlock", ExtendedBlockType>>;
type _StillHasCallout = Expect<Extends<"callout", ExtendedBlockType>>;
type _HasCustomInline = Expect<Extends<"myMention", ExtendedInlineType>>;
type _StillHasText = Expect<Extends<"text", ExtendedInlineType>>;
type _HasCustomStyle = Expect<Extends<"myHighlight", ExtendedStyleType>>;
type _StillHasBold = Expect<Extends<"bold", ExtendedStyleType>>;

/** Flag contract: unknown envelope disabled — type must not claim oeUnknownBlock. */
const withoutUnknown = createPowerSchema({
  includeUnknownEnvelope: false
});
type WithoutUnknownBlockType = (typeof withoutUnknown.Block)["type"];
type _WithoutUnknownHasCallout = Expect<Extends<"callout", WithoutUnknownBlockType>>;
type _WithoutUnknownHasStatus = Expect<Extends<"status", WithoutUnknownBlockType>>;
type _WithoutUnknownHasNoEnvelope = Expect<
  IsNever<Extract<WithoutUnknownBlockType, "oeUnknownBlock">>
>;

/**
 * Flag contract: power blocks off + host inline/style —
 * custom keys stay fully typed (not dropped to loose BlockNoteSchema.create).
 */
const powerOffCustom = createOpenEditorBlockNoteSchema({
  includePowerBlocks: false,
  inlineContentSpecs: {
    myMention: myInlineContent
  },
  styleSpecs: {
    myHighlight: myStyle
  }
});
type PowerOffBlockType = (typeof powerOffCustom.Block)["type"];
type PowerOffInlineType = keyof typeof powerOffCustom.inlineContentSchema;
type PowerOffStyleType = keyof typeof powerOffCustom.styleSchema;

type _PowerOffHasUnknown = Expect<Extends<"oeUnknownBlock", PowerOffBlockType>>;
type _PowerOffNoCallout = Expect<IsNever<Extract<PowerOffBlockType, "callout">>>;
type _PowerOffHasMention = Expect<Extends<"myMention", PowerOffInlineType>>;
type _PowerOffHasHighlight = Expect<Extends<"myHighlight", PowerOffStyleType>>;

void 0 as unknown as _HasCallout;
void 0 as unknown as _HasStatus;
void 0 as unknown as _HasUnknown;
void 0 as unknown as _HasParagraph;
void 0 as unknown as _HasCustom;
void 0 as unknown as _StillHasCallout;
void 0 as unknown as _HasCustomInline;
void 0 as unknown as _StillHasText;
void 0 as unknown as _HasCustomStyle;
void 0 as unknown as _StillHasBold;
void 0 as unknown as _WithoutUnknownHasCallout;
void 0 as unknown as _WithoutUnknownHasStatus;
void 0 as unknown as _WithoutUnknownHasNoEnvelope;
void 0 as unknown as _PowerOffHasUnknown;
void 0 as unknown as _PowerOffNoCallout;
void 0 as unknown as _PowerOffHasMention;
void 0 as unknown as _PowerOffHasHighlight;
