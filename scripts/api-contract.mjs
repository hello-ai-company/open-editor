#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { collectProviderMethodsFromAst } from "./lib/provider-methods.mjs";
import { collectTypeExportNames, diffTypeExports } from "./lib/type-exports.mjs";
import {
  AUTHORIZED_LICENSE,
  AUTHORIZED_NAME,
  AUTHORIZED_REGISTRY,
  AUTHORIZED_VERSION,
  ensureTarball
} from "./lib/tarball.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tarball = resolve(ensureTarball(root));
const publicApi = JSON.parse(readFileSync(join(root, "packages/core/contracts/public-api.json"), "utf8"));
const providerContract = JSON.parse(readFileSync(join(root, "packages/core/contracts/provider-contract.json"), "utf8"));
const workdir = mkdtempSync(join(tmpdir(), "editor-core-api-contract-"));

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

try {
  writeFileSync(
    join(workdir, "package.json"),
    JSON.stringify({
      name: "editor-core-api-contract",
      private: true,
      type: "module",
      license: "MIT"
    })
  );
  execFileSync("npm", ["install", "--omit=dev", tarball], {
    cwd: workdir,
    stdio: "inherit"
  });

  const installedRoot = join(workdir, "node_modules/@hello-ai-company/editor-core");
  const packageJsonPath = join(installedRoot, "package.json");
  const installedPackage = JSON.parse(readFileSync(packageJsonPath, "utf8"));

  if (installedPackage.name !== publicApi.packageName) {
    fail(`Installed name ${installedPackage.name} != ${publicApi.packageName}`);
  }
  if (publicApi.packageName !== AUTHORIZED_NAME) {
    fail(`Contract packageName ${publicApi.packageName} != ${AUTHORIZED_NAME}`);
  }
  if (installedPackage.version !== publicApi.version) {
    fail(`Installed version ${installedPackage.version} != ${publicApi.version}`);
  }
  if (installedPackage.version !== AUTHORIZED_VERSION) {
    fail(`Installed version ${installedPackage.version} != ${AUTHORIZED_VERSION}`);
  }
  if (installedPackage.license !== AUTHORIZED_LICENSE) {
    fail(`Installed license changed: ${installedPackage.license}`);
  }
  if (installedPackage.publishConfig?.registry !== AUTHORIZED_REGISTRY) {
    fail(`Installed registry is not ${AUTHORIZED_REGISTRY}.`);
  }
  if (installedPackage.publishConfig?.access !== "public") {
    fail("Installed publishConfig.access must be public.");
  }
  if (!installedPackage.exports?.["."]?.types || !installedPackage.exports?.["."]?.import) {
    fail('Installed exports must keep "." types/import only.');
  }
  if (installedPackage.exports?.["."]?.require) {
    fail("Unexpected CJS export condition.");
  }
  if (Object.keys(installedPackage.exports).join(",") !== ".") {
    fail(`Unexpected export subpaths: ${Object.keys(installedPackage.exports).join(", ")}`);
  }

  const mod = await import(pathToFileURL(join(installedRoot, installedPackage.exports["."].import)).href);
  const runtimeKeys = uniqueSorted(Object.keys(mod));
  const expectedRuntime = uniqueSorted(publicApi.runtimeExports);
  const missingRuntime = expectedRuntime.filter((name) => !runtimeKeys.includes(name));
  const extraRuntime = runtimeKeys.filter((name) => !expectedRuntime.includes(name));

  if (missingRuntime.length > 0 || extraRuntime.length > 0) {
    fail(`Runtime export mismatch. missing=${JSON.stringify(missingRuntime)} extra=${JSON.stringify(extraRuntime)}`);
  }

  const requiredRuntime = [
    "EDITOR_DOCUMENT_SCHEMA_VERSION",
    "createEditorDocument",
    "serializeEditorDocument",
    "deserializeEditorDocument",
    "isJsonValue"
  ];
  for (const name of requiredRuntime) {
    if (!(name in mod)) {
      fail(`Required runtime export missing: ${name}`);
    }
  }
  if (mod.EDITOR_DOCUMENT_SCHEMA_VERSION !== 1) {
    fail(`EDITOR_DOCUMENT_SCHEMA_VERSION must be 1, got ${String(mod.EDITOR_DOCUMENT_SCHEMA_VERSION)}`);
  }
  if (typeof mod.createEditorDocument !== "function") fail("createEditorDocument must be a function");
  if (typeof mod.serializeEditorDocument !== "function") fail("serializeEditorDocument must be a function");
  if (typeof mod.deserializeEditorDocument !== "function") fail("deserializeEditorDocument must be a function");
  if (typeof mod.isJsonValue !== "function") fail("isJsonValue must be a function");

  const empty = mod.createEditorDocument([]);
  const serialized = mod.serializeEditorDocument(empty);
  const restored = mod.deserializeEditorDocument(serialized);
  if (restored.schemaVersion !== 1 || !Array.isArray(restored.blocks)) {
    fail("Installed package failed create/serialize/deserialize round-trip.");
  }
  if (!mod.isJsonValue({ ok: true, count: 1, empty: null })) {
    fail("isJsonValue rejected a valid JSON object.");
  }

  const indexDts = readFileSync(join(installedRoot, installedPackage.exports["."].types), "utf8");
  const exportedTypes = uniqueSorted(collectTypeExportNames(indexDts, "index.d.ts"));
  const expectedTypes = uniqueSorted(publicApi.typeExports);
  const typeDiff = diffTypeExports(exportedTypes, expectedTypes);
  if (typeDiff.missing.length > 0 || typeDiff.extra.length > 0) {
    fail(`Type export mismatch. missing=${JSON.stringify(typeDiff.missing)} extra=${JSON.stringify(typeDiff.extra)}`);
  }

  const providersDts = readFileSync(join(installedRoot, "dist/providers.d.ts"), "utf8");
  const methods = uniqueSorted(collectProviderMethodsFromAst(providersDts));
  const allowed = uniqueSorted(providerContract.allowedMethods);
  const forbidden = providerContract.forbiddenMethods;
  const missing = allowed.filter((name) => !methods.includes(name));
  const extra = methods.filter((name) => !allowed.includes(name));
  const forbiddenPresent = forbidden.filter((name) => methods.includes(name) || new RegExp(`\\b${name}\\b`).test(providersDts));

  if (missing.length > 0 || extra.length > 0 || forbiddenPresent.length > 0) {
    fail(
      `Provider surface mismatch. missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)} forbidden=${JSON.stringify(forbiddenPresent)}`
    );
  }

  if (process.exitCode) {
    throw new Error("API contract failed.");
  }

  console.log("API contract passed against the installed tarball:");
  console.log(`  runtime exports: ${runtimeKeys.join(", ")}`);
  console.log(`  type exports: ${exportedTypes.join(", ")}`);
  console.log(`  provider methods: ${methods.join(", ")}`);
  console.log("  missing/extra/forbidden: none");
} finally {
  rmSync(workdir, { recursive: true, force: true });
}
