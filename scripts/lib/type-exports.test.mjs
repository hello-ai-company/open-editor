import assert from "node:assert/strict";
import test from "node:test";
import { collectTypeExportNames, diffTypeExports, typeExportsMatch } from "./type-exports.mjs";

const expected = ["EditorBlock", "EditorDocument", "JsonValue"];

test("collects export type { ... } names", () => {
  const source = `export type { EditorBlock, EditorDocument, JsonValue } from "./model.js";`;
  assert.deepEqual(collectTypeExportNames(source).sort(), expected);
});

test("collects export { type Foo } and ignores runtime named exports", () => {
  const source = `
    export {
      cloneEditorBlock,
      createEditorDocument,
      type EditorBlock,
      type EditorDocument,
      type JsonValue
    } from "./model.js";
  `;
  assert.deepEqual(collectTypeExportNames(source).sort(), expected);
});

test("collects exported type aliases and interfaces, not classes or functions", () => {
  const source = `
    export type Foo = string;
    export interface Bar { x: number }
    export class RuntimeClass {}
    export function runtimeFn() {}
    export const VALUE = 1;
  `;
  assert.deepEqual(collectTypeExportNames(source).sort(), ["Bar", "Foo"]);
});

test("missing type fails exact equality", () => {
  const actual = collectTypeExportNames(`export type { EditorBlock, JsonValue } from "./model.js";`);
  const { missing, extra } = diffTypeExports(actual, expected);
  assert.deepEqual(missing, ["EditorDocument"]);
  assert.deepEqual(extra, []);
  assert.equal(typeExportsMatch(actual, expected), false);
});

test("extra type fails exact equality", () => {
  const actual = collectTypeExportNames(
    `export type { EditorBlock, EditorDocument, JsonValue, UnexpectedType } from "./model.js";`
  );
  const { missing, extra } = diffTypeExports(actual, expected);
  assert.deepEqual(missing, []);
  assert.deepEqual(extra, ["UnexpectedType"]);
  assert.equal(typeExportsMatch(actual, expected), false);
});

test("exact match passes both directions", () => {
  const actual = collectTypeExportNames(
    `export type { JsonValue, EditorDocument, EditorBlock } from "./model.js";`
  );
  const { missing, extra } = diffTypeExports(actual, expected);
  assert.deepEqual(missing, []);
  assert.deepEqual(extra, []);
  assert.equal(typeExportsMatch(actual, expected), true);
});
