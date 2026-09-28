import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  registryTarballUrl,
  registryVersionUrl,
  verifyPublishedPackage
} from "./verify-public-package-published.mjs";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "npm-published-proof-"));
  const packageDir = join(directory, "package");
  mkdirSync(packageDir);
  writeFileSync(join(packageDir, "package.json"), JSON.stringify({
    name: "@hello-ai-company/editor-ai",
    version: "0.1.0",
    license: "MIT"
  }));
  writeFileSync(join(packageDir, "LICENSE"), "MIT License\n");
  const tarballPath = join(directory, "hello-ai-company-editor-ai-0.1.0.tgz");
  execFileSync("tar", ["-czf", tarballPath, "-C", directory, "package"]);
  const integrity = `sha512-${createHash("sha512").update(readFileSync(tarballPath)).digest("base64")}`;
  return { directory, tarballPath, integrity };
}

describe("post-publish registry proof", () => {
  it("uses scoped registry identity and exact tarball URL", () => {
    assert.equal(
      registryVersionUrl("@hello-ai-company/editor-ai", "0.1.0"),
      "https://registry.npmjs.org/%40hello-ai-company%2Feditor-ai/0.1.0"
    );
    assert.equal(
      registryTarballUrl("@hello-ai-company/editor-ai", "0.1.0"),
      "https://registry.npmjs.org/@hello-ai-company/editor-ai/-/editor-ai-0.1.0.tgz"
    );
  });

  it("retries registry 404 and proves identity, license, tarball URL, and integrity", async () => {
    const test = fixture();
    try {
      let calls = 0;
      const result = await verifyPublishedPackage({
        key: "ai",
        tarballPath: test.tarballPath,
        retryDelays: [0],
        sleep: async () => {},
        fetchImpl: async () => {
          calls += 1;
          if (calls === 1) return { ok: false, status: 404 };
          return {
            ok: true,
            status: 200,
            json: async () => ({
              name: "@hello-ai-company/editor-ai",
              version: "0.1.0",
              license: "MIT",
              dist: {
                tarball: registryTarballUrl("@hello-ai-company/editor-ai", "0.1.0"),
                integrity: test.integrity
              }
            })
          };
        }
      });
      assert.equal(result.attempts, 2);
      assert.equal(calls, 2);
    } finally {
      rmSync(test.directory, { recursive: true, force: true });
    }
  });

  it("requests the npm metadata endpoint with its supported JSON media type", async () => {
    const test = fixture();
    try {
      const result = await verifyPublishedPackage({
        key: "ai",
        tarballPath: test.tarballPath,
        fetchImpl: async (_url, options) => {
          assert.equal(options.headers.accept, "application/json");
          return {
            ok: true,
            status: 200,
            json: async () => ({
              name: "@hello-ai-company/editor-ai",
              version: "0.1.0",
              license: "MIT",
              dist: {
                tarball: registryTarballUrl("@hello-ai-company/editor-ai", "0.1.0"),
                integrity: test.integrity
              }
            })
          };
        }
      });
      assert.equal(result.name, "@hello-ai-company/editor-ai");
    } finally {
      rmSync(test.directory, { recursive: true, force: true });
    }
  });

  it("fails closed on malformed metadata, integrity mismatch, and bounded 404s", async () => {
    const test = fixture();
    try {
      const metadata = {
        name: "@hello-ai-company/editor-ai",
        version: "0.1.0",
        license: "MIT",
        dist: {
          tarball: registryTarballUrl("@hello-ai-company/editor-ai", "0.1.0"),
          integrity: test.integrity
        }
      };
      const response = (json) => ({ ok: true, status: 200, json });
      await assert.rejects(
        verifyPublishedPackage({ key: "ai", tarballPath: test.tarballPath, fetchImpl: async () => response(async () => { throw new Error("bad JSON"); }) }),
        /malformed package JSON/
      );
      await assert.rejects(
        verifyPublishedPackage({ key: "ai", tarballPath: test.tarballPath, fetchImpl: async () => response(async () => ({ ...metadata, dist: { ...metadata.dist, integrity: "sha512-bad" } })) }),
        /integrity does not match/
      );
      let calls = 0;
      await assert.rejects(
        verifyPublishedPackage({
          key: "ai",
          tarballPath: test.tarballPath,
          retryDelays: [0],
          sleep: async () => {},
          fetchImpl: async () => { calls += 1; return { ok: false, status: 404 }; }
        }),
        /did not prove.*HTTP 404/
      );
      assert.equal(calls, 2);
    } finally {
      rmSync(test.directory, { recursive: true, force: true });
    }
  });
});
