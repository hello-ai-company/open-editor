import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

run("npm", ["run", "build", "-w", "@hello-ai-company/editor-core"], root);
run("npm", ["run", "build", "-w", "@hello-ai-company/editor-blocknote"], root);
run("npm", ["pack", "-w", "@hello-ai-company/editor-core", "--pack-destination", root], root);
run("npm", ["pack", "-w", "@hello-ai-company/editor-blocknote", "--pack-destination", root], root);

const coreTgz = join(root, "hello-ai-company-editor-core-0.1.0.tgz");
const bnTgz = join(root, "hello-ai-company-editor-blocknote-0.1.0.tgz");

function smokeBase(dir) {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "isolated-blocknote-consumer",
        private: true,
        type: "module",
        dependencies: {
          "@hello-ai-company/editor-core": `file:${coreTgz}`,
          "@hello-ai-company/editor-blocknote": `file:${bnTgz}`,
          "@blocknote/core": "0.54.2",
          "@blocknote/react": "0.54.2",
          react: "^19.1.0",
          "react-dom": "^19.1.0"
        }
      },
      null,
      2
    )
  );

  writeFileSync(
    join(dir, "smoke.mjs"),
    `
import { createEditorDocument } from "@hello-ai-company/editor-core";
import {
  fromBlockNote,
  toBlockNote,
  UNKNOWN_ENVELOPE_TYPE,
  createDefaultPowerCommands,
  createCommandRegistry,
  createDocumentIndex,
  createOpenEditorPowerPreset
} from "@hello-ai-company/editor-blocknote";
import { createDocumentOutline } from "@hello-ai-company/editor-blocknote";

const doc = createEditorDocument([
  { id: "p1", type: "paragraph", content: [{ type: "text", text: "hi", styles: {} }] },
  { id: "u1", type: "mystery", props: { nested: { ok: true } } }
]);
const bn = toBlockNote(doc, { knownBlockTypes: ["paragraph", UNKNOWN_ENVELOPE_TYPE] });
if (bn[1]?.type !== UNKNOWN_ENVELOPE_TYPE) throw new Error("envelope missing");
const back = fromBlockNote(bn);
if (back.blocks[1]?.type !== "mystery") throw new Error("unwrap failed");
const registry = createCommandRegistry(createDefaultPowerCommands());
if (!registry.get("block.insert.callout")) throw new Error("commands missing");
const index = createDocumentIndex();
index.replaceFromBlocks([{ id: "h1", type: "heading", props: { level: 1 }, content: "Hi" }]);
if (createDocumentOutline(index).length !== 1) throw new Error("outline failed");
const preset = createOpenEditorPowerPreset();
if (!preset.schema) throw new Error("preset missing");
console.log("isolated-blocknote-consumer base: ok");
`
  );

  writeFileSync(
    join(dir, "smoke-react.mjs"),
    `
import { DocumentOutline, QuickNav } from "@hello-ai-company/editor-blocknote/react";
if (typeof DocumentOutline !== "function") throw new Error("DocumentOutline missing");
if (typeof QuickNav !== "function") throw new Error("QuickNav missing");
console.log("isolated-blocknote-consumer react: ok");
`
  );

  run("npm", ["install", "--omit=dev", "--legacy-peer-deps"], dir);
  run("node", ["smoke.mjs"], dir);
  run("node", ["smoke-react.mjs"], dir);
}

function smokeOptional(dir, feature, peerPkg) {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: `isolated-blocknote-${feature}`,
        private: true,
        type: "module",
        dependencies: {
          "@hello-ai-company/editor-core": `file:${coreTgz}`,
          "@hello-ai-company/editor-blocknote": `file:${bnTgz}`,
          "@blocknote/core": "0.54.2",
          "@blocknote/react": "0.54.2",
          [peerPkg]: "0.54.2",
          react: "^19.1.0",
          "react-dom": "^19.1.0"
        }
      },
      null,
      2
    )
  );

  const exportName = `create${feature[0].toUpperCase()}${feature.slice(1)}PowerFeature`;

  writeFileSync(
    join(dir, "smoke.mjs"),
    `
import { readFileSync, existsSync } from "node:fs";
const mathEntry = new URL("./node_modules/@hello-ai-company/editor-blocknote/dist/${feature}/index.js", import.meta.url);
const path = mathEntry.pathname;
if (!existsSync(path)) throw new Error("missing subpath file ${feature}: " + path);
const source = readFileSync(path, "utf8");
if (!source.includes("${exportName}")) {
  throw new Error("missing ${exportName} in ${feature} entry");
}
const peerEntry = new URL("./node_modules/${peerPkg}/package.json", import.meta.url);
if (!existsSync(peerEntry.pathname)) throw new Error("peer missing: ${peerPkg}");
console.log("isolated-blocknote-consumer ${feature}: ok");
`
  );

  run("npm", ["install", "--omit=dev", "--legacy-peer-deps"], dir);
  run("node", ["smoke.mjs"], dir);
}

const dir = mkdtempSync(join(tmpdir(), "oe-bn-consumer-"));
try {
  smokeBase(dir);
  for (const [feature, peer] of [
    ["math", "@blocknote/math-block"],
    ["diagram", "@blocknote/diagram-block"],
    ["code", "@blocknote/code-block"]
  ]) {
    const featureDir = mkdtempSync(join(tmpdir(), `oe-bn-${feature}-`));
    try {
      smokeOptional(featureDir, feature, peer);
    } finally {
      rmSync(featureDir, { recursive: true, force: true });
    }
  }
  console.log("verify:isolated-blocknote PASS");
} finally {
  rmSync(dir, { recursive: true, force: true });
  for (const name of [
    "hello-ai-company-editor-core-0.1.0.tgz",
    "hello-ai-company-editor-blocknote-0.1.0.tgz"
  ]) {
    try {
      rmSync(join(root, name), { force: true });
    } catch {
      // ignore
    }
  }
}
