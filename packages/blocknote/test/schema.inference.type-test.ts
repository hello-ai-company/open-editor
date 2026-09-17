/**
 * Compile-time schema inference tests.
 * These are not executed by vitest (not *.test.ts); they fail `tsc` if inference regresses.
 */
import {
  createBlockSpec,
  createInlineContentSpec,
  createStyleSpec
} from "@blocknote/core";
import { createOpenEditorBlockNoteSchema } from "../src/schema/createOpenEditorBlockNoteSchema.js";

type Expect<T extends true> = T;
type Extends<A, B> = A extends B ? true : false;

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
