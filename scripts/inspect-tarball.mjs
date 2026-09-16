#!/usr/bin/env node
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findLeakageHits, hasPrivateAbsolutePath } from "./lib/leakage-patterns.mjs";
import {
  AUTHORIZED_LICENSE,
  AUTHORIZED_NAME,
  AUTHORIZED_REGISTRY,
  AUTHORIZED_VERSION,
  findTarball,
  listTarballFiles,
  readTarballFile
} from "./lib/tarball.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tarball = findTarball(root);

if (!tarball) {
  console.error("No @hello-ai-company/editor-core tarball found. Run npm pack -w @hello-ai-company/editor-core first.");
  process.exit(1);
}

const files = listTarballFiles(tarball);
console.log(`Tarball ${tarball} contents:\n${files.map((file) => `  ${file}`).join("\n")}`);

const allowedExact = new Set(["package/package.json", "package/LICENSE"]);
const allowedDistFile = /^package\/dist\/[A-Za-z0-9._-]+\.(js|d\.ts|js\.map|d\.ts\.map)$/;
const denylist = [
  { name: "src tree", pattern: /(^|\/)src(\/|$)/ },
  { name: "test tree", pattern: /(^|\/)tests?(\/|$)/ },
  { name: "node_modules", pattern: /(^|\/)node_modules(\/|$)/ },
  { name: "git metadata", pattern: /(^|\/)\.git(\/|$)/ },
  { name: "env file", pattern: /(^|\/)\.env(?:\.|$)/ },
  { name: "README", pattern: /(^|\/)README(?:\.[A-Za-z0-9]+)?$/i },
  { name: "tsconfig", pattern: /(^|\/)tsconfig[^/]*$/ },
  { name: "source TypeScript", pattern: /\.tsx?$/ }
];

function isAllowedEntry(file) {
  if (allowedExact.has(file)) return true;
  if (file === "package" || file === "package/" || file === "package/dist" || file === "package/dist/") {
    return true;
  }
  return allowedDistFile.test(file);
}

const unexpected = files.filter((file) => !isAllowedEntry(file));
if (unexpected.length > 0) {
  console.error("Unexpected tarball entries (allowlist failed):\n", unexpected.join("\n"));
  process.exit(1);
}

const denied = [];
for (const file of files) {
  if (file.endsWith(".d.ts") || file.endsWith(".d.ts.map")) continue;
  for (const rule of denylist) {
    if (rule.pattern.test(file) || rule.pattern.test(basename(file))) {
      denied.push(`${file} (${rule.name})`);
    }
  }
}
if (denied.length > 0) {
  console.error("Tarball denylist hits:\n", denied.join("\n"));
  process.exit(1);
}

if (!files.includes("package/package.json") || !files.some((file) => file.endsWith(".d.ts"))) {
  console.error("Tarball is missing package.json or declaration files.");
  process.exit(1);
}

const packedPackage = JSON.parse(readTarballFile(tarball, "package/package.json"));

if (packedPackage.publishConfig?.registry !== AUTHORIZED_REGISTRY) {
  console.error(
    `Tarball publishConfig.registry must be ${AUTHORIZED_REGISTRY}, got ${packedPackage.publishConfig?.registry ?? "<missing>"}.`
  );
  process.exit(1);
}

if (packedPackage.version !== AUTHORIZED_VERSION) {
  console.error(`Tarball version must be ${AUTHORIZED_VERSION}, got ${packedPackage.version ?? "<missing>"}.`);
  process.exit(1);
}

if (packedPackage.name !== AUTHORIZED_NAME) {
  console.error(`Tarball name must be ${AUTHORIZED_NAME}, got ${packedPackage.name ?? "<missing>"}.`);
  process.exit(1);
}

if (packedPackage.license !== AUTHORIZED_LICENSE) {
  console.error(`Tarball license must be ${AUTHORIZED_LICENSE}, got ${packedPackage.license ?? "<missing>"}.`);
  process.exit(1);
}

if (packedPackage.dependencies && Object.keys(packedPackage.dependencies).length > 0) {
  console.error("Tarball must not introduce runtime dependencies.");
  process.exit(1);
}

const privatePathHits = [];
const leakageHits = new Set();
for (const file of files) {
  if (file.endsWith("/")) continue;
  const contents = readTarballFile(tarball, file);
  if (hasPrivateAbsolutePath(contents)) {
    privatePathHits.push(file);
  }
  for (const name of findLeakageHits(contents)) {
    leakageHits.add(`${file}: ${name}`);
  }
}

if (privatePathHits.length > 0) {
  console.error("Source maps or packed files contain private absolute paths:\n", privatePathHits.join("\n"));
  process.exit(1);
}

if (leakageHits.size > 0) {
  console.error("Tarball leakage detected:\n", [...leakageHits].join("\n"));
  process.exit(1);
}

console.log("Tarball inspect passed: allowlist/denylist, identity lock, no host leakage, no private paths.");
