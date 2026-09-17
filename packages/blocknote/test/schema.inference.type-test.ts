/**
 * Compile-time schema inference tests.
 * These are not executed by vitest (not *.test.ts); they fail `tsc` if inference regresses.
 */
import { createBlockSpec } from "@blocknote/core";
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

const extended = createOpenEditorBlockNoteSchema({
  blockSpecs: {
    myBlock: createMyBlockSpec()
  }
});

type ExtendedBlockType = (typeof extended.Block)["type"];
type _HasCustom = Expect<Extends<"myBlock", ExtendedBlockType>>;
type _StillHasCallout = Expect<Extends<"callout", ExtendedBlockType>>;

void 0 as unknown as _HasCallout;
void 0 as unknown as _HasStatus;
void 0 as unknown as _HasUnknown;
void 0 as unknown as _HasParagraph;
void 0 as unknown as _HasCustom;
void 0 as unknown as _StillHasCallout;
