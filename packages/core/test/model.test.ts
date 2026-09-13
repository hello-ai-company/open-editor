import { describe, expect, it } from "vitest";
import {
  EDITOR_DOCUMENT_SCHEMA_VERSION,
  cloneEditorBlock,
  createEditorDocument,
  isEditorBlock,
  isEditorDocument,
  isJsonValue,
  isSupportedSchemaVersion
} from "../src/model.js";

describe("editorCore model", () => {
  it("creates a versioned document from extensible blocks", () => {
    const document = createEditorDocument([
      {
        id: "p1",
        type: "paragraph",
        props: { text: "Hello" },
        content: [{ type: "text", text: "Hello", styles: {} }]
      },
      {
        id: "custom-1",
        type: "futureCustomBlock",
        props: { density: 3, widget: "calendar-heat" }
      }
    ]);

    expect(document.schemaVersion).toBe(EDITOR_DOCUMENT_SCHEMA_VERSION);
    expect(document.blocks).toHaveLength(2);
    expect(document.blocks[1]?.type).toBe("futureCustomBlock");
    expect(document.blocks[1]?.props).toEqual({ density: 3, widget: "calendar-heat" });
  });

  it("clones blocks so mutations do not leak", () => {
    const original = {
      id: "h1",
      type: "heading",
      props: { headingLevel: 2, text: "Title" },
      children: [{ id: "p2", type: "paragraph", props: { text: "Nested" } }]
    };
    const cloned = cloneEditorBlock(original);
    cloned.props!.text = "Changed";
    cloned.children![0]!.props = { text: "Mutated" };

    expect(original.props.text).toBe("Title");
    expect(original.children[0]?.props?.text).toBe("Nested");
  });

  it("accepts unknown block types and rejects malformed blocks", () => {
    expect(isEditorBlock({ id: "x", type: "not-yet-specified", props: { ok: true } })).toBe(true);
    expect(isEditorBlock({ id: "", type: "paragraph" })).toBe(false);
    expect(isEditorBlock({ id: "x", type: "paragraph", children: [{ id: "bad" }] })).toBe(false);
    expect(isEditorDocument({ schemaVersion: 1, blocks: [{ id: "x", type: "paragraph" }] })).toBe(true);
    expect(isEditorDocument({ schemaVersion: 1, blocks: "nope" })).toBe(false);
    expect(isJsonValue({ text: "ok", items: [1, null, false] })).toBe(true);
    expect(isJsonValue({ fn: () => undefined })).toBe(false);
    expect(isEditorBlock({ id: "x", type: "paragraph", props: { text: "ok" }, content: [{ type: "text", text: "ok" }] })).toBe(true);
  });

  it("accepts only the positive integer schemaVersion 1", () => {
    const blocks = [{ id: "x", type: "paragraph" }];
    expect(isSupportedSchemaVersion(1)).toBe(true);
    expect(isSupportedSchemaVersion(-1)).toBe(false);
    expect(isSupportedSchemaVersion(0)).toBe(false);
    expect(isSupportedSchemaVersion(1.5)).toBe(false);
    expect(isSupportedSchemaVersion(2)).toBe(false);
    expect(isEditorDocument({ schemaVersion: -1, blocks })).toBe(false);
    expect(isEditorDocument({ schemaVersion: 0, blocks })).toBe(false);
    expect(isEditorDocument({ schemaVersion: 1.5, blocks })).toBe(false);
    expect(isEditorDocument({ schemaVersion: 2, blocks })).toBe(false);
    expect(isEditorDocument({ schemaVersion: 1, blocks })).toBe(true);
    expect(() => createEditorDocument(blocks, -1)).toThrow(/positive integer 1/);
    expect(() => createEditorDocument(blocks, 0)).toThrow(/positive integer 1/);
    expect(() => createEditorDocument(blocks, 1.5)).toThrow(/positive integer 1/);
    expect(() => createEditorDocument(blocks, 2)).toThrow(/positive integer 1/);
  });
});
