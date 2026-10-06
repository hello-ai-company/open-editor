import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

export const AUTHORIZED_NAME = "@hello-ai-company/editor-core";
export const AUTHORIZED_VERSION = "0.2.0";
export const AUTHORIZED_REGISTRY = "https://registry.npmjs.org";
export const AUTHORIZED_LICENSE = "MIT";
export const AUTHORIZED_ACCESS = "public";
export const AUTHORIZED_COPYRIGHT = "Copyright (c) 2026 Yuki Shibata";
export const TARBALL_PREFIX = "hello-ai-company-editor-core-";

export function findTarball(root) {
  const directories = [root, join(root, "packages/core")];
  const expected = `${TARBALL_PREFIX}${AUTHORIZED_VERSION}.tgz`;
  for (const directory of directories) {
    if (readdirSync(directory).includes(expected)) return join(directory, expected);
  }
  return undefined;
}

export function listTarballFiles(tarball) {
  const listing = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" });
  return listing.split("\n").filter(Boolean);
}

export function assertNoTarballLinks(tarball) {
  const listing = execFileSync("tar", ["-tvzf", tarball], { encoding: "utf8" });
  if (listing.split("\n").some((line) => /^[lh]/.test(line))) {
    throw new Error("Tarball must not contain symbolic links or hard links");
  }
}

export function readTarballFile(tarball, entry) {
  return execFileSync("tar", ["-xOf", tarball, entry], { encoding: "utf8" });
}

export function packCore(root) {
  execFileSync("npm", ["pack", "-w", AUTHORIZED_NAME], {
    cwd: root,
    stdio: "inherit"
  });
  const tarball = findTarball(root);
  if (!tarball) {
    throw new Error("npm pack did not produce an editor-core tarball.");
  }
  return tarball;
}

export function ensureTarball(root) {
  return findTarball(root) ?? packCore(root);
}
