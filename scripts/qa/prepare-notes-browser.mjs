import { build } from "esbuild";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../..");
if (!existsSync(resolve(root, "examples/blocknote-power/dist/index.html"))) throw new Error("Build the local example first");
// Test-only public-storage probe. Rebuild explicitly after Vite empties dist.
// Never copied into package tarballs, never deploys, no dependency installation.
await build({ absWorkingDir: root, entryPoints: ["scripts/qa/notes-storage-fixture.ts"], outfile: "examples/blocknote-power/dist/notes-storage-probe.mjs", bundle: true, format: "esm", platform: "browser", minify: true });
console.log("Local test-only storage probe prepared");
