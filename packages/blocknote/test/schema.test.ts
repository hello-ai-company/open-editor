/**
 * @vitest-environment jsdom
 */
import { createInlineContentSpec, createStyleSpec } from "@blocknote/core";
import { describe, expect, it } from "vitest";
import { BlockNoteAdapterError } from "../src/adapter/errors.js";
import { createOpenEditorBlockNoteSchema } from "../src/schema/createOpenEditorBlockNoteSchema.js";

const customInlineContent = createInlineContentSpec(
  { type: "customInlineContent", propSchema: {}, content: "none" },
  { render: () => ({ dom: document.createElement("span") }) }
);

const customStyle = createStyleSpec(
  { type: "customStyle", propSchema: "boolean" },
  { render: () => ({ dom: document.createElement("span") }) }
);

describe("schema factory", () => {
  it("includes unknown envelope, callout, and status", () => {
    const schema = createOpenEditorBlockNoteSchema();
    const types = Object.keys(schema.blockSchema);
    expect(types).toContain("oeUnknownBlock");
    expect(types).toContain("callout");
    expect(types).toContain("status");
    expect(types).toContain("table");
    expect(types).toContain("paragraph");
  });

  it("fails closed on reserved type collision", () => {
    expect(() =>
      createOpenEditorBlockNoteSchema({
        // Intentionally invalid for runtime collision check
        blockSpecs: {
          callout: {} as never
        }
      })
    ).toThrow(BlockNoteAdapterError);
  });

  it("can omit power blocks", () => {
    const schema = createOpenEditorBlockNoteSchema({ includePowerBlocks: false });
    const types = Object.keys(schema.blockSchema);
    expect(types).not.toContain("callout");
    expect(types).toContain("oeUnknownBlock");
  });

  it("merges host inlineContentSpecs and styleSpecs into the schema", () => {
    const schema = createOpenEditorBlockNoteSchema({
      inlineContentSpecs: {
        customInlineContent
      },
      styleSpecs: {
        customStyle
      }
    });

    expect(schema.inlineContentSchema).toHaveProperty("customInlineContent");
    expect(schema.styleSchema).toHaveProperty("customStyle");
    // Power blocks still present
    expect(schema.blockSchema).toHaveProperty("callout");
    expect(schema.blockSchema).toHaveProperty("status");
    // Defaults retained
    expect(schema.inlineContentSchema).toHaveProperty("text");
    expect(schema.styleSchema).toHaveProperty("bold");
  });

  it("merges inline/style even when power blocks are omitted", () => {
    const schema = createOpenEditorBlockNoteSchema({
      includePowerBlocks: false,
      inlineContentSpecs: { customInlineContent },
      styleSpecs: { customStyle }
    });

    expect(schema.blockSchema).not.toHaveProperty("callout");
    expect(schema.inlineContentSchema).toHaveProperty("customInlineContent");
    expect(schema.styleSchema).toHaveProperty("customStyle");
  });
});
