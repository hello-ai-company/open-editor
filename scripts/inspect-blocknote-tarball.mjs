#!/usr/bin/env node
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
import {
  hasPrivateAbsolutePath,
  leakagePatterns
} from "./lib/leakage-patterns.mjs";
import { listTarballFiles, readTarballFile } from "./lib/tarball.mjs";

/** editor-blocknote may legally mention @blocknote / react peers; still ban product leakage + XL. */
const blocknoteAllowedLeakage = new Set(["@blocknote", "react import"]);
const blocknoteLeakagePatterns = [
  ...leakagePatterns.filter(({ name }) => !blocknoteAllowedLeakage.has(name)),
  { name: "@blocknote/xl-*", pattern: /@blocknote\/xl-[A-Za-z0-9-]+/ }
];

function findBlocknoteLeakageHits(text) {
  return blocknoteLeakagePatterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ name }) => name);
}

const AUTHORIZED_NAME = "@hello-ai-company/editor-blocknote";
const AUTHORIZED_VERSION = "0.1.0";
const AUTHORIZED_REGISTRY = "https://registry.npmjs.org";
const AUTHORIZED_LICENSE = "MIT";
const AUTHORIZED_ACCESS = "public";
const AUTHORIZED_COPYRIGHT = "Copyright (c) 2026 Yuki Shibata";
const AUTHORIZED_PEER = "^0.54.2";
const AUTHORIZED_CORE_DEP = "^0.1.1";
const TARBALL_PREFIX = "hello-ai-company-editor-blocknote-";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function findBlocknoteTarball() {
  for (const directory of [root, join(root, "packages/blocknote")]) {
    const match = readdirSync(directory).find(
      (name) =>
        name.startsWith(TARBALL_PREFIX) &&
        name.endsWith(".tgz") &&
        !name.includes("matrix-widened")
    );
    if (match) return join(directory, match);
  }
  return undefined;
}

const tarball = findBlocknoteTarball();
if (!tarball) {
  console.error(
    "No @hello-ai-company/editor-blocknote tarball found. Run npm pack -w @hello-ai-company/editor-blocknote first."
  );
  process.exit(1);
}

const files = listTarballFiles(tarball);
console.log(
  `Tarball ${tarball} contents:\n${files.map((file) => `  ${file}`).join("\n")}`
);

const allowedExact = new Set([
  "package/package.json",
  "package/LICENSE",
  "package/README.md"
]);
const allowedDistFile =
  /^package\/dist\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.(js|d\.ts|js\.map|d\.ts\.map|css)$/;
const denylist = [
  { name: "src tree", pattern: /(^|\/)src(\/|$)/ },
  { name: "test tree", pattern: /(^|\/)tests?(\/|$)/ },
  { name: "node_modules", pattern: /(^|\/)node_modules(\/|$)/ },
  { name: "git metadata", pattern: /(^|\/)\.git(\/|$)/ },
  { name: "env file", pattern: /(^|\/)\.env(?:\.|$)/ },
  { name: "tsconfig", pattern: /(^|\/)tsconfig[^/]*$/ },
  { name: "source TypeScript", pattern: /\.tsx?$/ }
];

function isAllowedEntry(file) {
  if (allowedExact.has(file)) return true;
  if (
    file === "package" ||
    file === "package/" ||
    file === "package/dist" ||
    file === "package/dist/" ||
    /^package\/dist\/(?:[A-Za-z0-9._-]+\/)*$/.test(file)
  ) {
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

if (
  !files.includes("package/package.json") ||
  !files.includes("package/LICENSE") ||
  !files.includes("package/README.md") ||
  !files.some((file) => file.endsWith(".d.ts")) ||
  !files.includes("package/dist/power.css")
) {
  console.error(
    "Tarball is missing package.json, LICENSE, README.md, declaration files, or power.css."
  );
  process.exit(1);
}

const packedPackage = JSON.parse(readTarballFile(tarball, "package/package.json"));

if (packedPackage.publishConfig?.registry !== AUTHORIZED_REGISTRY) {
  console.error(
    `Tarball publishConfig.registry must be ${AUTHORIZED_REGISTRY}, got ${packedPackage.publishConfig?.registry ?? "<missing>"}.`
  );
  process.exit(1);
}
if (packedPackage.publishConfig?.access !== AUTHORIZED_ACCESS) {
  console.error(
    `Tarball publishConfig.access must be ${AUTHORIZED_ACCESS}, got ${packedPackage.publishConfig?.access ?? "<missing>"}.`
  );
  process.exit(1);
}
if (packedPackage.version !== AUTHORIZED_VERSION) {
  console.error(
    `Tarball version must be ${AUTHORIZED_VERSION}, got ${packedPackage.version ?? "<missing>"}.`
  );
  process.exit(1);
}
if (packedPackage.name !== AUTHORIZED_NAME) {
  console.error(
    `Tarball name must be ${AUTHORIZED_NAME}, got ${packedPackage.name ?? "<missing>"}.`
  );
  process.exit(1);
}
if (packedPackage.license !== AUTHORIZED_LICENSE) {
  console.error(
    `Tarball license must be ${AUTHORIZED_LICENSE}, got ${packedPackage.license ?? "<missing>"}.`
  );
  process.exit(1);
}
if (packedPackage.private === true) {
  console.error("Tarball package must remain publishable (private must not be true).");
  process.exit(1);
}
if (packedPackage.peerDependencies?.["@blocknote/core"] !== AUTHORIZED_PEER) {
  console.error(`Tarball peer @blocknote/core must be ${AUTHORIZED_PEER}.`);
  process.exit(1);
}
if (packedPackage.peerDependencies?.["@blocknote/react"] !== AUTHORIZED_PEER) {
  console.error(`Tarball peer @blocknote/react must be ${AUTHORIZED_PEER}.`);
  process.exit(1);
}

const depKeys = Object.keys(packedPackage.dependencies ?? {});
if (depKeys.length !== 1 || depKeys[0] !== "@hello-ai-company/editor-core") {
  console.error(
    "Tarball must depend only on @hello-ai-company/editor-core:",
    depKeys
  );
  process.exit(1);
}
if (packedPackage.dependencies["@hello-ai-company/editor-core"] !== AUTHORIZED_CORE_DEP) {
  console.error(
    `Tarball editor-core dependency must be ${AUTHORIZED_CORE_DEP}, got ${packedPackage.dependencies["@hello-ai-company/editor-core"] ?? "<missing>"}.`
  );
  process.exit(1);
}

for (const section of ["dependencies", "peerDependencies", "optionalDependencies"]) {
  for (const name of Object.keys(packedPackage[section] ?? {})) {
    if (name.startsWith("@blocknote/xl-")) {
      console.error(`Tarball must not include XL package: ${section}.${name}`);
      process.exit(1);
    }
  }
}

const packedLicense = readTarballFile(tarball, "package/LICENSE");
if (
  !packedLicense.includes("MIT License") ||
  !packedLicense.includes(AUTHORIZED_COPYRIGHT)
) {
  console.error(`Tarball LICENSE must be MIT with ${AUTHORIZED_COPYRIGHT}.`);
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
  for (const name of findBlocknoteLeakageHits(contents)) {
    leakageHits.add(`${file}: ${name}`);
  }
}
if (privatePathHits.length > 0) {
  console.error(
    "Source maps or packed files contain private absolute paths:\n",
    privatePathHits.join("\n")
  );
  process.exit(1);
}
if (leakageHits.size > 0) {
  console.error("Tarball leakage detected:\n", [...leakageHits].join("\n"));
  process.exit(1);
}

console.log("editor-blocknote tarball inspection passed.");
