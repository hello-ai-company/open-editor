/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import {
  createBlockReferenceInlineContentSpec,
  formatBlockReferenceLabel,
  BLOCK_REFERENCE_TYPE
} from "../src/references/blockReference.js";
import { createOpenEditorBlockNoteSchema } from "../src/schema/createOpenEditorBlockNoteSchema.js";
import { fromBlockNote, toBlockNoteForSchema } from "../src/index.js";
import { createEditorDocument } from "@hello-ai-company/editor-core";

describe("block references", () => {
  it("registers blockReference inline content on schema", () => {
    const schema = createOpenEditorBlockNoteSchema({
      inlineContentSpecs: {
        blockReference: createBlockReferenceInlineContentSpec()
      }
    });
    expect(schema.inlineContentSchema).toHaveProperty(BLOCK_REFERENCE_TYPE);
  });

  it("formats missing and valid targets", () => {
    const missing = formatBlockReferenceLabel("x", () => null);
    expect(missing.missing).toBe(true);

    const ok = formatBlockReferenceLabel("a", (id) =>
      id === "a" ? { title: "Architecture" } : null
    );
    expect(ok.label).toBe("Architecture");
    expect(ok.missing).toBe(false);
  });

  it("round-trips a paragraph containing a reference through EditorDocument", () => {
    const schema = createOpenEditorBlockNoteSchema({
      inlineContentSpecs: {
        blockReference: createBlockReferenceInlineContentSpec()
      }
    });
    const doc = createEditorDocument([
      {
        id: "p1",
        type: "paragraph",
        content: [
          {
            type: "blockReference",
            props: { blockId: "target-1" }
          }
        ]
      }
    ]);
    const bn = toBlockNoteForSchema(doc, schema);
    const back = fromBlockNote(bn as never);
    const content = back.blocks[0]?.content;
    expect(JSON.stringify(content)).toContain("blockReference");
    expect(JSON.stringify(content)).toContain("target-1");
  });
});
