#!/usr/bin/env node
import { basename } from "node:path";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findLeakageHits, hasPrivateAbsolutePath } from "./lib/leakage-patterns.mjs";
import { assertNoTarballLinks, listTarballFiles, readTarballFile } from "./lib/tarball.mjs";
import { assertExactTarballFiles, expectedTarballFiles } from "./release/expected-tarball-files.mjs";
import { packageConfig, tarballFilename, validatePackageManifest } from "./release/public-package-config.mjs";

const [, , key, tarball] = process.argv;
if (!key || !tarball) throw new Error("Usage: node scripts/inspect-public-tarballs.mjs <ai|canvas|publish> <tarball>");
const config = packageConfig(key);
if (basename(tarball) !== tarballFilename(config)) throw new Error(`Unexpected tarball filename for ${config.name}`);
const root = dirname(dirname(fileURLToPath(import.meta.url)));

const files = listTarballFiles(tarball);
assertNoTarballLinks(tarball);
const secretPatterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["npm token", /\bnpm_[A-Za-z0-9]{30,}\b/]
];
assertExactTarballFiles(files, expectedTarballFiles(join(root, config.directory)));
if (!files.includes("package/package.json") || !files.includes("package/LICENSE") || !files.includes("package/README.md")
  || !files.some((path) => path.endsWith(".d.ts")) || !files.some((path) => path.endsWith(".js"))) {
  throw new Error("Tarball must contain package.json, README.md, LICENSE, JavaScript, and declarations");
}

const pkg = JSON.parse(readTarballFile(tarball, "package/package.json"));
validatePackageManifest(pkg, config);
const license = readTarballFile(tarball, "package/LICENSE");
if (!license.includes("MIT License") || !license.includes(config.copyright)) {
  throw new Error("Tarball LICENSE must be the expected MIT license");
}

const privatePaths = [];
const leakage = new Set();
for (const path of files) {
  if (path.endsWith("/")) continue;
  const contents = readTarballFile(tarball, path);
  if (hasPrivateAbsolutePath(contents) || /file:\/\/\/(?:Users|home|workspace)\//i.test(contents)) privatePaths.push(path);
  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(contents)) leakage.add(`${path}: ${label}`);
  }
  for (const finding of findLeakageHits(contents)) {
    if (finding !== "react import") leakage.add(`${path}: ${finding}`);
  }
  if (/\.(?:tgz|png|jpe?g|webp|pdf|zip|log|tsbuildinfo)$/i.test(path)
    || /(^|\/)(?:\.env(?:\.|$)|node_modules|\.git|\.cache|coverage|playwright|evidence|fixtures?|tests?)(\/|$)/i.test(path)
    || /(^|\/)[^/]*(?:screenshot|evidence|fixture|test|cache)[^/]*(?:\/|$)/i.test(path)) {
    throw new Error(`Forbidden tarball file: ${path}`);
  }
}
if (privatePaths.length) throw new Error(`Private absolute paths found in: ${privatePaths.join(", ")}`);
if (leakage.size) throw new Error(`Product or secret leakage detected:\n${[...leakage].join("\n")}`);

console.log(`${config.name}@${config.version} tarball inspection passed (${files.filter((path) => !path.endsWith("/")).length} files).`);
