#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function findTarball() {
  const directories = [root, join(root, "packages/core")];
  for (const directory of directories) {
    const match = readdirSync(directory).find((name) => name.startsWith("hello-ai-editor-core-") && name.endsWith(".tgz"));
    if (match) return join(directory, match);
  }
  return undefined;
}

const tarball = findTarball();

if (!tarball) {
  console.error("No @hello-ai/editor-core tarball found. Run npm pack -w @hello-ai/editor-core first.");
  process.exit(1);
}

const listing = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" });
const files = listing.split("\n").filter(Boolean);
console.log(`Tarball ${tarball} contents:\n${files.map((file) => `  ${file}`).join("\n")}`);

const allowedPrefixes = [
  "package/package.json",
  "package/LICENSE",
  "package/dist/"
];

const unexpected = files.filter((file) => !allowedPrefixes.some((prefix) => file === prefix || file.startsWith(prefix)));
if (unexpected.length > 0) {
  console.error("Unexpected tarball entries:\n", unexpected.join("\n"));
  process.exit(1);
}

if (!files.includes("package/package.json") || !files.some((file) => file.endsWith(".d.ts"))) {
  console.error("Tarball is missing package.json or declaration files.");
  process.exit(1);
}

const packedPackage = JSON.parse(execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }));
const authorizedRegistry = "https://npm.pkg.github.com";
const authorizedVersion = "0.0.0-phase3.e17b4b5";

if (packedPackage.publishConfig?.registry !== authorizedRegistry) {
  console.error(
    `Tarball publishConfig.registry must be ${authorizedRegistry}, got ${packedPackage.publishConfig?.registry ?? "<missing>"}.`
  );
  process.exit(1);
}

if (packedPackage.version !== authorizedVersion) {
  console.error(`Tarball version must be ${authorizedVersion}, got ${packedPackage.version ?? "<missing>"}.`);
  process.exit(1);
}

if (packedPackage.name !== "@hello-ai/editor-core") {
  console.error(`Tarball name must be @hello-ai/editor-core, got ${packedPackage.name ?? "<missing>"}.`);
  process.exit(1);
}

const extracted = execFileSync("tar", ["-xOf", tarball], { encoding: "utf8" });
const leakage = [
  { name: "personal-ai", pattern: /personal-ai/i },
  { name: "openEmployees", pattern: /openEmployees/ },
  { name: "NoteRichEditor", pattern: /NoteRichEditor/ },
  { name: "noteBlockSync", pattern: /noteBlockSync/ },
  { name: "editorAdapters", pattern: /editorAdapters/ },
  { name: "__PAI_", pattern: /__PAI_/ },
  { name: "@blocknote", pattern: /@blocknote/ },
  { name: "supabase", pattern: /supabase/i },
  { name: "Secretary", pattern: /\bSecretary\b/ },
  { name: "AgentTask", pattern: /\bAgentTask\b/ }
];

const hits = leakage.filter(({ pattern }) => pattern.test(extracted));
if (hits.length > 0) {
  console.error("Tarball leakage detected:", hits.map((hit) => hit.name).join(", "));
  process.exit(1);
}

console.log("Tarball inspect passed: dist + d.ts only, no host leakage.");
