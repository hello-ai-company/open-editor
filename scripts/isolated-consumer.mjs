#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdtempSync, readFileSync, readlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureTarball } from "./lib/tarball.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tarball = resolve(ensureTarball(root));
const workdir = mkdtempSync(join(tmpdir(), "editor-core-isolated-"));

function fail(message) {
  throw new Error(message);
}

try {
  cpSync(join(root, "tests/isolated-consumer"), workdir, { recursive: true });
  execFileSync("npm", ["install", "--omit=dev", tarball], {
    cwd: workdir,
    stdio: "inherit"
  });
  execFileSync("npm", ["install", "--no-save", "typescript@5.9.2"], {
    cwd: workdir,
    stdio: "inherit"
  });

  const installed = join(workdir, "node_modules/@hello-ai-company/editor-core");
  if (!existsSync(installed)) {
    fail("Isolated consumer did not install @hello-ai-company/editor-core.");
  }
  if (lstatSync(installed).isSymbolicLink()) {
    fail(`Installed package is a symlink to ${readlinkSync(installed)}; tarball extract required.`);
  }
  if (existsSync(join(installed, "src"))) {
    fail("Installed package contains src/; workspace/source install is forbidden.");
  }

  const lock = JSON.parse(readFileSync(join(workdir, "package-lock.json"), "utf8"));
  const resolved = lock.packages?.["node_modules/@hello-ai-company/editor-core"]?.resolved ?? "";
  if (!resolved.includes(".tgz")) {
    fail(`Installed package resolved to ${resolved || "<missing>"}; tarball required.`);
  }
  if (resolved.includes("packages/core") || resolved.includes("workspace:")) {
    fail(`Installed package resolved to workspace source: ${resolved}`);
  }

  execFileSync("npx", ["tsc", "--noEmit", "-p", "tsconfig.json"], {
    cwd: workdir,
    stdio: "inherit"
  });
  execFileSync(process.execPath, ["src/runtime.mjs"], {
    cwd: workdir,
    stdio: "inherit"
  });
  console.log("Isolated consumer installed the tarball, typechecked, and ran create/serialize/deserialize.");
} finally {
  rmSync(workdir, { recursive: true, force: true });
}
