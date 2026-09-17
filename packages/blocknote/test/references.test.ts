/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import {
  createBlockReferenceInlineContentSpec,
  createBlockReferenceResolverFromIndex,
  formatBlockReferenceLabel,
  BLOCK_REFERENCE_TYPE,
  createBlockReferenceDom
} from "../src/references/blockReference.js";
import { createOpenEditorBlockNoteSchema } from "../src/schema/createOpenEditorBlockNoteSchema.js";
import { fromBlockNote, toBlockNoteForSchema } from "../src/index.js";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createDocumentIndex } from "../src/index/documentIndex.js";

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

  it("resolves human-readable titles from DocumentIndex", () => {
    const index = createDocumentIndex();
    index.replaceFromBlocks([
      {
        id: "h1",
        type: "heading",
        props: { level: 1 } as never,
        content: [{ type: "text", text: "Architecture", styles: {} }]
      }
    ]);
    const resolve = createBlockReferenceResolverFromIndex(index);
    expect(resolve("h1")).toEqual({ title: "Architecture" });
    expect(resolve("missing")?.missing).toBe(true);
  });

  it("renders resolved label and wires click navigate", () => {
    const onNavigate = vi.fn();
    const runtime = {
      resolve: (id: string) =>
        id === "h1" ? { title: "Architecture" } : { title: "", missing: true },
      onNavigate
    };
    const dom = createBlockReferenceDom("h1", runtime);
    expect(dom.textContent).toBe("→ Architecture");
    expect(dom.dataset.missing).toBe("false");
    dom.click();
    expect(onNavigate).toHaveBeenCalledWith("h1");
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
