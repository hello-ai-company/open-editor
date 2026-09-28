import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { linkSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import { assertNoTarballLinks } from "./tarball.mjs";

describe("assertNoTarballLinks", () => {
  it("rejects symbolic and hard links in a tarball", () => {
    const dir = mkdtempSync(join(tmpdir(), "tarball-links-"));
    try {
      const packageDir = join(dir, "package");
      mkdirSync(packageDir);
      const source = join(packageDir, "source.txt");
      writeFileSync(source, "safe fixture");
      symlinkSync("source.txt", join(packageDir, "symbolic.txt"));
      linkSync(source, join(packageDir, "hard.txt"));
      const tarball = join(dir, "links.tgz");
      execFileSync("tar", ["-czf", tarball, "-C", dir, "package"]);
      const listing = execFileSync("tar", ["-tvzf", tarball], { encoding: "utf8" });
      assert.match(listing, /^l/m);
      assert.match(listing, /^h/m);
      assert.throws(() => assertNoTarballLinks(tarball), /symbolic links or hard links/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
