#!/usr/bin/env node
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import {
  hasPrivateAbsolutePath,
  leakagePatterns
} from "./lib/leakage-patterns.mjs";
import { assertNoTarballLinks, listTarballFiles, readTarballFile } from "./lib/tarball.mjs";
import { assertExactTarballFiles, expectedTarballFiles } from "./release/expected-tarball-files.mjs";

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
const AUTHORIZED_VERSION = "0.2.0";
const AUTHORIZED_REGISTRY = "https://registry.npmjs.org";
const AUTHORIZED_LICENSE = "MIT";
const AUTHORIZED_ACCESS = "public";
const AUTHORIZED_COPYRIGHT = "Copyright (c) 2026 Yuki Shibata";
const AUTHORIZED_PEER = "^0.54.2";
const AUTHORIZED_CORE_DEP = "^0.2.0";
const TARBALL_PREFIX = "hello-ai-company-editor-blocknote-";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function findBlocknoteTarball() {
  for (const directory of [root, join(root, "packages/blocknote")]) {
    const expected = `${TARBALL_PREFIX}${AUTHORIZED_VERSION}.tgz`;
    if (readdirSync(directory).includes(expected)) return join(directory, expected);
  }
  return undefined;
}

const tarball = process.argv[2] ? resolve(process.argv[2]) : findBlocknoteTarball();
if (!tarball) {
  console.error(
    "No @hello-ai-company/editor-blocknote tarball found. Run npm pack -w @hello-ai-company/editor-blocknote first."
  );
  process.exit(1);
}

const files = listTarballFiles(tarball);
assertNoTarballLinks(tarball);
console.log(
  `Tarball ${tarball} contents:\n${files.map((file) => `  ${file}`).join("\n")}`
);

assertExactTarballFiles(files, expectedTarballFiles(join(root, "packages/blocknote"), { css: true }));
const denylist = [
  { name: "src tree", pattern: /(^|\/)src(\/|$)/ },
  { name: "test tree", pattern: /(^|\/)tests?(\/|$)/ },
  { name: "node_modules", pattern: /(^|\/)node_modules(\/|$)/ },
  { name: "git metadata", pattern: /(^|\/)\.git(\/|$)/ },
  { name: "env file", pattern: /(^|\/)\.env(?:\.|$)/ },
  { name: "tsconfig", pattern: /(^|\/)tsconfig[^/]*$/ },
  { name: "source TypeScript", pattern: /\.tsx?$/ }
];

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
const expectedRepository = {
  type: "git",
  url: "git+https://github.com/hello-ai-company/open-editor.git",
  directory: "packages/blocknote"
};
const expectedExports = {
  ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
  "./react": { types: "./dist/react/index.d.ts", import: "./dist/react/index.js" },
  "./math": { types: "./dist/math/index.d.ts", import: "./dist/math/index.js" },
  "./diagram": { types: "./dist/diagram/index.d.ts", import: "./dist/diagram/index.js" },
  "./code": { types: "./dist/code/index.d.ts", import: "./dist/code/index.js" },
  "./power.css": "./dist/power.css"
};
const expectedPeers = {
  "@tiptap/pm": "^3.31.3",
  "@blocknote/core": "^0.54.2",
  "@blocknote/react": "^0.54.2",
  "@blocknote/math-block": "^0.54.2",
  "@blocknote/diagram-block": "^0.54.2",
  "@blocknote/code-block": "^0.54.2",
  react: "^18.0.0 || ^19.0.0",
  "react-dom": "^18.0.0 || ^19.0.0"
};
const expectedPeerMeta = {
  "@blocknote/math-block": { optional: true },
  "@blocknote/diagram-block": { optional: true },
  "@blocknote/code-block": { optional: true }
};
const expectedScripts = {
  build: "tsc -p tsconfig.build.json && node ../../scripts/copy-blocknote-css.mjs",
  typecheck: "npm run build -w @hello-ai-company/editor-core && tsc -p tsconfig.json --noEmit",
  test: "vitest run",
  "bench:smoke": "vitest run --config vitest.bench.config.ts"
};
for (const [field, expected] of Object.entries({
  repository: expectedRepository,
  exports: expectedExports,
  files: ["dist", "LICENSE", "README.md"],
  publishConfig: { registry: AUTHORIZED_REGISTRY, access: AUTHORIZED_ACCESS },
  engines: { node: ">=20" },
  peerDependencies: expectedPeers,
  peerDependenciesMeta: expectedPeerMeta,
  scripts: expectedScripts,
  type: "module",
  main: "./dist/index.js",
  types: "./dist/index.d.ts"
})) {
  if (!isDeepStrictEqual(packedPackage[field], expected)) {
    console.error(`Tarball package.json ${field} metadata mismatch.`);
    process.exit(1);
  }
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
if (Object.keys(packedPackage.optionalDependencies ?? {}).length > 0
  || (packedPackage.bundledDependencies ?? packedPackage.bundleDependencies ?? []).length > 0) {
  console.error("Tarball must not include optional or bundled dependencies.");
  process.exit(1);
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
