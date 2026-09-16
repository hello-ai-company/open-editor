import { describe, expect, it } from "vitest";
import {
  EDITOR_DOCUMENT_SCHEMA_VERSION,
  cloneEditorBlock,
  createEditorDocument,
  isEditorBlock,
  isEditorDocument,
  isJsonValue,
  type EditorBlock,
  type JsonValue
} from "../src/model.js";
import {
  EditorDocumentSerializationError,
  deserializeEditorDocument,
  serializeEditorDocument
} from "../src/serialization.js";

const paragraph = (id: string, text: string, extra?: Partial<EditorBlock>): EditorBlock => ({
  id,
  type: "paragraph",
  props: { text },
  ...extra
});

describe("editor-core package contract", () => {
  it("locks schemaVersion to the positive integer 1", () => {
    expect(EDITOR_DOCUMENT_SCHEMA_VERSION).toBe(1);
    expect(createEditorDocument([]).schemaVersion).toBe(1);
    expect(createEditorDocument([paragraph("p1", "ok")]).schemaVersion).toBe(1);
  });

  it("accepts an empty document", () => {
    const document = createEditorDocument([]);
    expect(document.blocks).toEqual([]);
    expect(isEditorDocument(document)).toBe(true);
    const restored = deserializeEditorDocument(serializeEditorDocument(document));
    expect(restored).toEqual({ schemaVersion: 1, blocks: [] });
  });

  it("accepts a normal document with props and content", () => {
    const document = createEditorDocument([
      {
        id: "p1",
        type: "paragraph",
        props: { text: "Hello", align: "left" },
        content: [{ type: "text", text: "Hello", styles: { bold: true } }]
      }
    ]);
    expect(document.blocks).toHaveLength(1);
    expect(document.blocks[0]?.props).toEqual({ text: "Hello", align: "left" });
    expect(document.blocks[0]?.content).toEqual([
      { type: "text", text: "Hello", styles: { bold: true } }
    ]);
  });

  it("accepts nested blocks", () => {
    const document = createEditorDocument([
      {
        id: "list",
        type: "bulletListItem",
        props: { text: "parent" },
        children: [
          paragraph("child-1", "nested"),
          {
            id: "child-2",
            type: "bulletListItem",
            props: { text: "deeper-parent" },
            children: [paragraph("grandchild", "leaf")]
          }
        ]
      }
    ]);
    expect(document.blocks[0]?.children?.[1]?.children?.[0]?.id).toBe("grandchild");
    const restored = deserializeEditorDocument(serializeEditorDocument(document));
    expect(restored).toEqual(document);
  });

  it("treats unknown block types as first-class data", () => {
    const mystery: EditorBlock = {
      id: "mystery",
      type: "vendorPluginBlock",
      props: { payload: { version: 2, items: ["a", "b"] } },
      content: { raw: "<widget />" },
      children: [paragraph("mystery-child", "child")]
    };
    expect(isEditorBlock(mystery)).toBe(true);
    const restored = deserializeEditorDocument(serializeEditorDocument(createEditorDocument([mystery])));
    expect(restored.blocks[0]?.type).toBe("vendorPluginBlock");
    expect(restored.blocks[0]?.props).toEqual({ payload: { version: 2, items: ["a", "b"] } });
  });

  it("accepts JsonValue and rejects non-JSON values", () => {
    const json: JsonValue = {
      text: "ok",
      count: 1,
      flag: false,
      empty: null,
      items: [1, "two", { nested: true }]
    };
    expect(isJsonValue(json)).toBe(true);
    expect(isJsonValue({ fn: () => undefined })).toBe(false);
    expect(isJsonValue(undefined)).toBe(false);
    expect(isJsonValue(Number.NaN)).toBe(false);
    expect(isEditorBlock({ id: "x", type: "paragraph", props: { fn: () => undefined } })).toBe(false);
  });

  it("isolates mutations from cloned blocks and created documents", () => {
    const original: EditorBlock = {
      id: "h1",
      type: "heading",
      props: { headingLevel: 2, text: "Title" },
      children: [paragraph("p2", "Nested")]
    };
    const cloned = cloneEditorBlock(original);
    const document = createEditorDocument([original]);

    cloned.props!.text = "Changed";
    cloned.children![0]!.props = { text: "Mutated" };
    document.blocks[0]!.props!.text = "Document mutated";
    document.blocks[0]!.children![0]!.props = { text: "Document child mutated" };

    expect(original.props?.text).toBe("Title");
    expect(original.children?.[0]?.props?.text).toBe("Nested");
  });

  it("round-trips serialize → deserialize with semantic equality", () => {
    const document = createEditorDocument([
      paragraph("p1", "Keep me", {
        content: [{ type: "text", text: "Keep me", styles: { italic: true } }]
      }),
      {
        id: "mystery",
        type: "vendorPluginBlock",
        props: { payload: { version: 2, items: ["a", "b"] } },
        children: [paragraph("mystery-child", "child")]
      }
    ]);
    const restored = deserializeEditorDocument(serializeEditorDocument(document));
    expect(restored).toEqual(document);
    expect(restored.schemaVersion).toBe(1);
  });

  it("guarantees serialize(deserialize(serialize(doc))) byte-stability after normalize", () => {
    const document = createEditorDocument([
      {
        id: "p1",
        type: "paragraph",
        props: { text: "stable" },
        children: []
      }
    ]);
    const first = serializeEditorDocument(document);
    const second = serializeEditorDocument(deserializeEditorDocument(first));
    expect(second).toBe(first);
    expect(JSON.parse(first)).toEqual({
      schemaVersion: 1,
      blocks: [{ id: "p1", type: "paragraph", props: { text: "stable" } }]
    });
  });

  it("does not claim canonical JSON key order across equivalent objects", () => {
    const left = createEditorDocument([{ id: "x", type: "paragraph", props: { a: 1, b: 2 } }]);
    const right = createEditorDocument([{ id: "x", type: "paragraph", props: { b: 2, a: 1 } }]);
    expect(deserializeEditorDocument(serializeEditorDocument(left))).toEqual(
      deserializeEditorDocument(serializeEditorDocument(right))
    );
  });

  it("rejects invalid payloads", () => {
    expect(() => deserializeEditorDocument("{")).toThrow(EditorDocumentSerializationError);
    expect(() => deserializeEditorDocument("[]")).toThrow(/must be an object/);
    expect(() => deserializeEditorDocument(JSON.stringify({ schemaVersion: 99, blocks: [] }))).toThrow(
      /Unsupported editor document schemaVersion 99/
    );
    expect(() => deserializeEditorDocument(JSON.stringify({ schemaVersion: 1, blocks: [{ type: "paragraph" }] }))).toThrow(
      /block at index 0 is invalid/
    );
    expect(() => deserializeEditorDocument(JSON.stringify({ schemaVersion: -1, blocks: [] }))).toThrow(
      /Unsupported editor document schemaVersion -1/
    );
    expect(() => createEditorDocument([], 2)).toThrow(/positive integer 1/);
  });
});
