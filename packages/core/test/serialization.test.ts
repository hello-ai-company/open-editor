import { describe, expect, it } from "vitest";
import { EDITOR_DOCUMENT_SCHEMA_VERSION, createEditorDocument } from "../src/model.js";
import {
  EditorDocumentSerializationError,
  deserializeEditorDocument,
  serializeEditorDocument,
  toSerializedEditorDocument
} from "../src/serialization.js";

describe("editorCore serialization", () => {
  it("round-trips a versioned document including unknown block types", () => {
    const document = createEditorDocument([
      {
        id: "p1",
        type: "paragraph",
        props: { text: "Keep me" },
        content: [{ type: "text", text: "Keep me", styles: { bold: true } }]
      },
      {
        id: "mystery",
        type: "vendorPluginBlock",
        props: { payload: { version: 2, items: ["a", "b"] } },
        content: { raw: "<widget />" },
        children: [{ id: "mystery-child", type: "paragraph", props: { text: "child" } }]
      }
    ]);

    const serialized = serializeEditorDocument(document);
    const envelope = JSON.parse(serialized) as { schemaVersion: number; blocks: unknown[] };
    expect(envelope.schemaVersion).toBe(EDITOR_DOCUMENT_SCHEMA_VERSION);
    expect(envelope.blocks).toHaveLength(2);

    const restored = deserializeEditorDocument(serialized);
    expect(restored).toEqual(document);
    expect(serializeEditorDocument(restored)).toBe(serialized);
    expect(restored.blocks[1]?.type).toBe("vendorPluginBlock");
    expect(restored.blocks[1]?.props).toEqual({ payload: { version: 2, items: ["a", "b"] } });
  });

  it("rejects invalid payloads and newer schema versions", () => {
    expect(() => deserializeEditorDocument("{")).toThrow(EditorDocumentSerializationError);
    expect(() => deserializeEditorDocument("[]")).toThrow(/must be an object/);
    expect(() => deserializeEditorDocument(JSON.stringify({ schemaVersion: 99, blocks: [] }))).toThrow(
      /Unsupported editor document schemaVersion 99/
    );
    expect(() => deserializeEditorDocument(JSON.stringify({ schemaVersion: 1, blocks: [{ type: "paragraph" }] }))).toThrow(
      /block at index 0 is invalid/
    );
  });

  it("rejects schemaVersion values that are not the positive integer 1", () => {
    const emptyBlocks = { blocks: [] };
    expect(() => deserializeEditorDocument(JSON.stringify({ schemaVersion: -1, ...emptyBlocks }))).toThrow(
      /Unsupported editor document schemaVersion -1/
    );
    expect(() => deserializeEditorDocument(JSON.stringify({ schemaVersion: 0, ...emptyBlocks }))).toThrow(
      /Unsupported editor document schemaVersion 0/
    );
    expect(() => deserializeEditorDocument(JSON.stringify({ schemaVersion: 1.5, ...emptyBlocks }))).toThrow(
      /Unsupported editor document schemaVersion 1\.5/
    );
    expect(() => deserializeEditorDocument(JSON.stringify({ schemaVersion: 2, ...emptyBlocks }))).toThrow(
      /Unsupported editor document schemaVersion 2/
    );
    expect(() => toSerializedEditorDocument({ schemaVersion: -1, blocks: [] })).toThrow(/positive integer 1/);
    expect(() => toSerializedEditorDocument({ schemaVersion: 0, blocks: [] })).toThrow(/positive integer 1/);
    expect(() => toSerializedEditorDocument({ schemaVersion: 1.5, blocks: [] })).toThrow(/positive integer 1/);
    expect(() => toSerializedEditorDocument({ schemaVersion: 2, blocks: [] })).toThrow(/positive integer 1/);
  });

  it("defaults a missing schemaVersion to the current version", () => {
    const restored = deserializeEditorDocument(JSON.stringify({
      blocks: [{ id: "p1", type: "paragraph", props: { text: "legacy" } }]
    }));
    expect(restored.schemaVersion).toBe(EDITOR_DOCUMENT_SCHEMA_VERSION);
    expect(restored.blocks[0]?.props).toEqual({ text: "legacy" });
  });
});
