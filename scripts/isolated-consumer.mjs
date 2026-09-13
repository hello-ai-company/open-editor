#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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

const workdir = mkdtempSync(join(tmpdir(), "editor-core-isolated-"));
try {
  cpSync(join(root, "tests/isolated-consumer"), workdir, { recursive: true });
  execFileSync("npm", ["install", "--omit=dev", tarball], {
    cwd: workdir,
    stdio: "inherit"
  });
  execFileSync("npx", ["--yes", "typescript@5.9.2", "--noEmit", "-p", "tsconfig.json"], {
    cwd: workdir,
    stdio: "inherit"
  });
  console.log("Isolated consumer installed the tarball and typechecked successfully.");
} finally {
  rmSync(workdir, { recursive: true, force: true });
}
