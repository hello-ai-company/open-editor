#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { findLeakageHits, hasPrivateAbsolutePath } from "./lib/leakage-patterns.mjs";
import { findTarball, listTarballFiles, readTarballFile } from "./lib/tarball.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcRoot = join(root, "packages/core/src");
const distRoot = join(root, "packages/core/dist");

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function scanText(label, text, violations) {
  for (const name of findLeakageHits(text)) {
    violations.push(`${label}: ${name}`);
  }
  if (hasPrivateAbsolutePath(text)) {
    violations.push(`${label}: private absolute path`);
  }
}

const violations = [];

if (!existsSync(srcRoot)) {
  console.error("packages/core/src is missing.");
  process.exit(1);
}

for (const file of walk(srcRoot)) {
  scanText(relative(root, file), readFileSync(file, "utf8"), violations);
}

if (existsSync(distRoot)) {
  for (const file of walk(distRoot)) {
    scanText(relative(root, file), readFileSync(file, "utf8"), violations);
  }
}

const tarball = findTarball(root);
if (tarball) {
  for (const file of listTarballFiles(tarball)) {
    if (file.endsWith("/")) continue;
    scanText(`tarball:${file}`, readTarballFile(tarball, file), violations);
  }
}

if (violations.length > 0) {
  console.error("Security scan failed:\n", violations.join("\n"));
  process.exit(1);
}

const audit = execFileSync("npm", ["audit", "--omit=dev", "--audit-level=high"], {
  cwd: root,
  encoding: "utf8"
});
console.log(audit);
console.log(
  `Security scan passed for packages/core/src${existsSync(distRoot) ? " + dist" : ""}${tarball ? " + tarball contents" : ""} (no host leakage).`
);
