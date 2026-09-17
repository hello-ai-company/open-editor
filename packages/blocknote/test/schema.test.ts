import { describe, expect, it } from "vitest";
import { BlockNoteAdapterError } from "../src/adapter/errors.js";
import { createOpenEditorBlockNoteSchema } from "../src/schema/createOpenEditorBlockNoteSchema.js";

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
        blockSpecs: {
          callout: {}
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
});
