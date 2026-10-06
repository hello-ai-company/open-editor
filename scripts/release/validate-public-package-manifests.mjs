import { readFileSync } from "node:fs";
import { join } from "node:path";
import { packageConfig, validatePackageManifest } from "./public-package-config.mjs";

const root = process.cwd();
for (const key of ["core", "ai", "canvas", "publish"]) {
  const config = packageConfig(key);
  const pkg = JSON.parse(readFileSync(join(root, config.directory, "package.json"), "utf8"));
  validatePackageManifest(pkg, config);
}

const core = JSON.parse(readFileSync(join(root, "packages/core/package.json"), "utf8"));
const blocknote = JSON.parse(readFileSync(join(root, "packages/blocknote/package.json"), "utf8"));
if (core.name !== "@hello-ai-company/editor-core" || core.version !== "0.2.0") {
  throw new Error("Dependency DAG requires @hello-ai-company/editor-core@0.2.0");
}
if (blocknote.name !== "@hello-ai-company/editor-blocknote" || blocknote.version !== "0.2.0"
  || blocknote.dependencies?.[core.name] !== "^0.2.0") {
  throw new Error("Dependency DAG requires editor-blocknote@0.2.0 → editor-core ^0.2.0");
}
console.log("Public candidate manifests and release DAG passed: core → AI, core → Canvas → Publish; BlockNote → core.");
