import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { assertExactTarballFiles, expectedTarballFiles } from "./expected-tarball-files.mjs";

describe("candidate tarball file inventory", () => {
  it("derives only compiled output and required package metadata, rejecting extras", () => {
    const directory = mkdtempSync(join(tmpdir(), "tarball-inventory-"));
    try {
      mkdirSync(join(directory, "src"), { recursive: true });
      mkdirSync(join(directory, "src/nested"));
      writeFileSync(join(directory, "src/index.ts"), "export {};\n");
      writeFileSync(join(directory, "src/nested/view.tsx"), "export {};\n");
      const expected = expectedTarballFiles(directory);
      assert.ok(expected.has("package/dist/index.js"));
      assert.ok(expected.has("package/dist/nested/view.d.ts.map"));
      assertExactTarballFiles([...expected], expected);
      assert.throws(() => assertExactTarballFiles([...expected, "package/dist/unexpected.js"], expected), /Unexpected tarball files/);
      assert.throws(() => assertExactTarballFiles([...expected].filter((file) => file !== "package/dist/index.js"), expected), /Missing tarball files/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
