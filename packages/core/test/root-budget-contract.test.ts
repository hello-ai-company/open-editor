import { describe, expect, it } from "vitest";
import {
  cloneEditorBlock, cloneEditorBlocks, createEditorDocument,
  isEditorBlock, isEditorDocument, isJsonValue,
  type EditorBlock, type EditorDocument, type JsonValue
} from "../src/model.js";
import {
  deserializeEditorDocument, EditorDocumentSerializationError,
  fromSerializedEditorDocument, serializeEditorDocument, toSerializedEditorDocument
} from "../src/serialization.js";

const paragraph = (id = "p", content?: JsonValue): EditorBlock => ({
  id, type: "future-block", ...(content === undefined ? {} : { content })
});
function blockChain(depth: number): EditorBlock {
  let block = paragraph();
  for (let index = 0; index < depth; index++) block = { id: `parent-${index}`, type: "group", children: [block] };
  return block;
}
function jsonChain(depth: number): JsonValue {
  let value: JsonValue = "leaf";
  for (let index = 0; index < depth; index++) value = { next: value };
  return value;
}
function subtree(count: number): EditorBlock {
  return { id: "root", type: "group", children: Array.from({ length: count - 1 }, (_, index) => paragraph(`child-${index}`)) };
}

function expectAccepted(blocks: EditorBlock[]) {
  const document: EditorDocument = { schemaVersion: 1, blocks };
  const original = JSON.stringify(document);
  expect(isEditorDocument(document)).toBe(true);
  const created = createEditorDocument(blocks);
  expect(created).toEqual(document);
  expect(cloneEditorBlocks(blocks)).toEqual(blocks);
  for (const block of blocks.slice(0, 2)) {
    expect(isEditorBlock(block)).toBe(true);
    expect(cloneEditorBlock(block)).toEqual(block);
  }
  expect(toSerializedEditorDocument(document)).toEqual(document);
  expect(fromSerializedEditorDocument(document)).toEqual(document);
  const saved = serializeEditorDocument(document);
  const reopened = deserializeEditorDocument(saved);
  expect(reopened).toEqual(document);
  // A reopened document is also valid for creation, cloning and saving again.
  expect(createEditorDocument(reopened.blocks)).toEqual(document);
  expect(cloneEditorBlocks(reopened.blocks)).toEqual(blocks);
  expect(serializeEditorDocument(reopened)).toBe(saved);
  if (blocks.length) created.blocks[0]!.id = "changed-detached-copy";
  expect(JSON.stringify(document)).toBe(original);
}

function expectRejected(blocks: EditorBlock[]) {
  const document: EditorDocument = { schemaVersion: 1, blocks };
  expect(isEditorDocument(document)).toBe(false);
  expect(() => createEditorDocument(blocks)).toThrow(TypeError);
  expect(() => cloneEditorBlocks(blocks)).toThrow(TypeError);
  expect(() => toSerializedEditorDocument(document)).toThrow(EditorDocumentSerializationError);
  expect(() => serializeEditorDocument(document)).toThrow(EditorDocumentSerializationError);
  expect(() => fromSerializedEditorDocument(document)).toThrow(EditorDocumentSerializationError);
}

describe("consistent per-root core budgets", () => {
  it("preserves a flat legacy document above 20,000 roots through every document API", () => {
    expectAccepted(Array.from({ length: 20_001 }, (_, index) => paragraph(`p-${index}`)));
  });
  it("preserves a legacy document whose combined JSON nodes exceed 50,000", () => {
    expectAccepted([paragraph("first", Array(25_000).fill(null)), paragraph("second", Array(25_000).fill(null))]);
  });
  it.each([
    ["root plus 19,999 descendants", () => subtree(20_000)],
    ["block depth 128, root depth 0", () => blockChain(128)],
    ["50,000 JSON nodes including the array itself", () => paragraph("p", Array(49_999).fill(null))],
    ["JSON depth 128, value root depth 0", () => paragraph("p", jsonChain(128))],
    ["JSON budget shared across a root and its descendant", () => ({ ...paragraph("root", Array(24_999).fill(null)), children: [paragraph("child", Array(24_999).fill(null))] })],
    ["large text has no core character quota", () => paragraph("p", "字".repeat(2 * 1024 * 1024))]
  ] as const)("accepts %s for create, clone, save and load", (_label, make) => {
    expectAccepted([make()]);
  });
  it.each([
    ["root plus 20,000 descendants", () => subtree(20_001)],
    ["block depth 129", () => blockChain(129)],
    ["50,001 JSON nodes", () => paragraph("p", Array(50_000).fill(null))],
    ["JSON depth 129", () => paragraph("p", jsonChain(129))],
    ["props container counts towards the JSON budget", () => ({ ...paragraph("p", Array(49_999).fill(null)), props: {} })],
    ["JSON budget is not reset for descendants", () => ({ ...paragraph("root", Array(24_999).fill(null)), children: [paragraph("child", Array(25_000).fill(null))] })],
    ["empty block ID", () => paragraph("")],
    ["non-finite JSON value", () => paragraph("p", Infinity)]
  ] as const)("rejects %s consistently without changing the source", (_label, make) => {
    const block = make();
    const original = JSON.stringify(block);
    expect(isEditorBlock(block)).toBe(false);
    expect(() => cloneEditorBlock(block)).toThrow(TypeError);
    expectRejected([block]);
    const encoded = JSON.stringify({ schemaVersion: 1, blocks: [block] });
    if (block.content === Infinity) {
      // Plain JSON.stringify has already lost Infinity before the codec sees it.
      expect(deserializeEditorDocument(encoded).blocks[0]!.content).toBe(null);
      expect(block.content).toBe(Infinity);
    } else {
      expect(() => deserializeEditorDocument(encoded)).toThrow(EditorDocumentSerializationError);
    }
    expect(JSON.stringify(block)).toBe(original);
  });
  it("rejects sparse and invalid later roots instead of emitting a partial document", () => {
    const good = paragraph("good", { text: "Keep original" });
    const blocks = [good, paragraph("")];
    const snapshot = JSON.stringify(blocks);
    expectRejected(blocks);
    expect(JSON.stringify(blocks)).toBe(snapshot);
    const sparse: EditorBlock[] = Array(2);
    sparse[0] = good;
    expectRejected(sparse);
    expect(Object.hasOwn(sparse, 1)).toBe(false);
    expect(() => deserializeEditorDocument(JSON.stringify({ schemaVersion: 1, blocks: sparse }))).toThrow(EditorDocumentSerializationError);
  });
  it("rejects cyclic roots and JSON without damaging caller-owned references", () => {
    const block = paragraph("cycle");
    block.children = [block];
    expectRejected([block]);
    expect(block.children[0]).toBe(block);
    const value: Record<string, JsonValue> = {};
    value.self = value;
    expect(isJsonValue(value)).toBe(false);
    expectRejected([paragraph("cycle-json", value)]);
    expect(value.self).toBe(value);
  });
  it("continues to accept shared acyclic JSON and legacy missing schemaVersion", () => {
    const shared = { text: "Preserve me" };
    const block = { ...paragraph(), props: { first: shared, second: shared } };
    expectAccepted([block]);
    expect(fromSerializedEditorDocument({ blocks: [block] })).toEqual({ schemaVersion: 1, blocks: [block] });
  });
});
