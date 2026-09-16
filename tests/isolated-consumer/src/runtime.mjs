#!/usr/bin/env node
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EDITOR_DOCUMENT_SCHEMA_VERSION,
  cloneEditorBlock,
  createEditorDocument,
  deserializeEditorDocument,
  isJsonValue,
  serializeEditorDocument
} from "@hello-ai-company/editor-core";

const installedRoot = join(dirname(fileURLToPath(import.meta.url)), "../node_modules/@hello-ai-company/editor-core");
const packageJsonPath = join(installedRoot, "package.json");
const installedStat = lstatSync(installedRoot);

if (installedStat.isSymbolicLink()) {
  throw new Error("Isolated consumer resolved a symlink, not a tarball extract.");
}

if (existsSync(join(installedRoot, "src"))) {
  throw new Error("Installed package contains src/; tarball-only install required.");
}

const installedPackage = JSON.parse(readFileSync(packageJsonPath, "utf8"));
if (installedPackage.name !== "@hello-ai-company/editor-core") {
  throw new Error(`Unexpected installed name ${installedPackage.name}`);
}
if (installedPackage.version !== "0.0.0-phase3.e17b4b5") {
  throw new Error(`Unexpected installed version ${installedPackage.version}`);
}
if (installedPackage.license !== "UNLICENSED") {
  throw new Error(`Unexpected installed license ${installedPackage.license}`);
}

if (EDITOR_DOCUMENT_SCHEMA_VERSION !== 1) {
  throw new Error("EDITOR_DOCUMENT_SCHEMA_VERSION must be 1");
}

const empty = createEditorDocument([]);
if (empty.schemaVersion !== 1 || empty.blocks.length !== 0) {
  throw new Error("empty document contract failed");
}

const original = {
  id: "h1",
  type: "heading",
  props: { text: "Title" },
  children: [{ id: "p2", type: "paragraph", props: { text: "Nested" } }]
};
const cloned = cloneEditorBlock(original);
cloned.props.text = "Changed";
if (original.props.text !== "Title") {
  throw new Error("mutation isolation failed");
}

const document = createEditorDocument([
  {
    id: "p1",
    type: "paragraph",
    props: { text: "isolated", count: 1, flag: false, empty: null },
    content: [{ type: "text", text: "isolated" }]
  },
  {
    id: "mystery",
    type: "vendorPluginBlock",
    props: { payload: { version: 2, items: ["a", "b"] } },
    children: [{ id: "mystery-child", type: "paragraph", props: { text: "child" } }]
  }
]);

if (!isJsonValue(document.blocks[0].props)) {
  throw new Error("props must be JsonValue");
}

const serialized = serializeEditorDocument(document);
const restored = deserializeEditorDocument(serialized);
if (JSON.stringify(restored) !== JSON.stringify(document)) {
  throw new Error("serialize → deserialize semantic equality failed");
}
if (serializeEditorDocument(restored) !== serialized) {
  throw new Error("normalized serialize was not byte-stable");
}
if (restored.blocks[1].type !== "vendorPluginBlock") {
  throw new Error("unknown block type was not preserved");
}

let invalidRejected = false;
try {
  deserializeEditorDocument("{");
} catch {
  invalidRejected = true;
}
if (!invalidRejected) {
  throw new Error("invalid payload must throw");
}

console.log("Isolated consumer runtime passed: create/serialize/deserialize from tarball install.");
