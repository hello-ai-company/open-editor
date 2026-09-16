import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

export const AUTHORIZED_NAME = "@hello-ai-company/editor-core";
export const AUTHORIZED_VERSION = "0.1.0";
export const AUTHORIZED_REGISTRY = "https://registry.npmjs.org";
export const AUTHORIZED_LICENSE = "MIT";
export const AUTHORIZED_ACCESS = "public";
export const AUTHORIZED_COPYRIGHT = "Copyright (c) 2026 Yuki Shibata";
export const TARBALL_PREFIX = "hello-ai-company-editor-core-";

export function findTarball(root) {
  const directories = [root, join(root, "packages/core")];
  for (const directory of directories) {
    const match = readdirSync(directory).find(
      (name) => name.startsWith(TARBALL_PREFIX) && name.endsWith(".tgz")
    );
    if (match) return join(directory, match);
  }
  return undefined;
}

export function listTarballFiles(tarball) {
  const listing = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" });
  return listing.split("\n").filter(Boolean);
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
