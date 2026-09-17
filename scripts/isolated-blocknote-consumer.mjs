import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

// Build + pack blocknote (and ensure core is built)
run("npm", ["run", "build", "-w", "@hello-ai-company/editor-core"], root);
run("npm", ["run", "build", "-w", "@hello-ai-company/editor-blocknote"], root);
run("npm", ["pack", "-w", "@hello-ai-company/editor-core", "--pack-destination", root], root);
run("npm", ["pack", "-w", "@hello-ai-company/editor-blocknote", "--pack-destination", root], root);

const coreTgz = join(root, "hello-ai-company-editor-core-0.1.0.tgz");
const bnTgz = join(root, "hello-ai-company-editor-blocknote-0.1.0.tgz");

const dir = mkdtempSync(join(tmpdir(), "oe-bn-consumer-"));
try {
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
  createCommandRegistry
} from "@hello-ai-company/editor-blocknote";

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
console.log("isolated-blocknote-consumer: ok");
`
  );

  // BlockNote lists optional Yjs v14 peers; npm on Node 20 can ERESOLVE them.
  // Isolated smoke only needs MPL core/react peers — use legacy-peer-deps.
  run("npm", ["install", "--omit=dev", "--legacy-peer-deps"], dir);
  run("node", ["smoke.mjs"], dir);
  console.log("verify:isolated-blocknote PASS");
} finally {
  rmSync(dir, { recursive: true, force: true });
  // Clean pack artifacts from repo root
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
