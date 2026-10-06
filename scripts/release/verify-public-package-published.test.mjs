import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  publishedIdentity,
  registryTarballUrl,
  registryVersionUrl,
  verifyPublishedPackage
} from "./verify-public-package-published.mjs";

function fixture(key = "ai") {
  const directory = mkdtempSync(join(tmpdir(), "npm-published-proof-"));
  const packageDir = join(directory, "package");
  mkdirSync(packageDir);
  const identity = publishedIdentity(key);
  writeFileSync(join(packageDir, "package.json"), JSON.stringify({
    name: identity.name,
    version: identity.version,
    license: "MIT"
  }));
  writeFileSync(join(packageDir, "LICENSE"), "MIT License\n");
  const tarballPath = join(directory, identity.filename);
  execFileSync("tar", ["-czf", tarballPath, "-C", directory, "package"]);
  const integrity = `sha512-${createHash("sha512").update(readFileSync(tarballPath)).digest("base64")}`;
  return { directory, tarballPath, integrity, identity };
}

function testClock() {
  let elapsedMs = 0;
  return {
    now: () => elapsedMs,
    sleep: async (delayMs) => { elapsedMs += delayMs; },
    elapsed: () => elapsedMs
  };
}

function publishedMetadata(test, overrides = {}) {
  const { name, version } = test.identity;
  return {
    name,
    version,
    license: "MIT",
    dist: {
      tarball: registryTarballUrl(name, version),
      integrity: test.integrity
    },
    ...overrides
  };
}

describe("post-publish registry proof", () => {
  it("matches exact core registry metadata integrity with the reviewed tarball", async () => {
    const test = fixture("core");
    try {
      const result = await verifyPublishedPackage({
        key: "core", tarballPath: test.tarballPath,
        fetchImpl: async () => ({ ok: true, status: 200, json: async () => publishedMetadata(test) })
      });
      assert.equal(result.name, "@hello-ai-company/editor-core");
      assert.equal(result.version, "0.2.0");
      assert.equal(result.attempts, 1);
    } finally { rmSync(test.directory, { recursive: true, force: true }); }
  });
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

  it("reproduces delayed npm visibility after the old retry window", async () => {
    const test = fixture("blocknote");
    try {
      const clock = testClock();
      let calls = 0;
      const result = await verifyPublishedPackage({
        key: "blocknote",
        tarballPath: test.tarballPath,
        now: clock.now,
        sleep: clock.sleep,
        fetchImpl: async () => {
          calls += 1;
          if (calls <= 7) return { ok: false, status: 404 };
          return {
            ok: true,
            status: 200,
            json: async () => publishedMetadata(test)
          };
        }
      });
      assert.equal(result.attempts, 8);
      assert.equal(calls, 8);
      assert.ok(clock.elapsed() > 60_000, "simulated npm propagation exceeds the previous retry window");
      assert.equal(result.retryWaitMs, clock.elapsed());
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
            json: async () => publishedMetadata(test)
          };
        }
      });
      assert.equal(result.name, "@hello-ai-company/editor-ai");
      assert.equal(result.attempts, 1);
      assert.equal(typeof result.elapsedMs, "number");
    } finally {
      rmSync(test.directory, { recursive: true, force: true });
    }
  });

  it("retries HTTP 429 and 5xx before proving the published package", async () => {
    const test = fixture();
    try {
      const clock = testClock();
      let calls = 0;
      const result = await verifyPublishedPackage({
        key: "ai",
        tarballPath: test.tarballPath,
        retryDelays: [25, 50],
        now: clock.now,
        sleep: clock.sleep,
        fetchImpl: async () => {
          calls += 1;
          if (calls === 1) return { ok: false, status: 429 };
          if (calls === 2) return { ok: false, status: 503 };
          return { ok: true, status: 200, json: async () => publishedMetadata(test) };
        }
      });
      assert.equal(result.attempts, 3);
      assert.equal(calls, 3);
    } finally {
      rmSync(test.directory, { recursive: true, force: true });
    }
  });

  it("retries request timeouts and temporary network failures", async () => {
    const test = fixture();
    try {
      const clock = testClock();
      let calls = 0;
      const result = await verifyPublishedPackage({
        key: "ai",
        tarballPath: test.tarballPath,
        retryDelays: [10, 20],
        now: clock.now,
        sleep: clock.sleep,
        fetchImpl: async () => {
          calls += 1;
          if (calls === 1) throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
          if (calls === 2) throw new TypeError("temporary network error");
          return { ok: true, status: 200, json: async () => publishedMetadata(test) };
        }
      });
      assert.equal(result.attempts, 3);
      assert.equal(calls, 3);
    } finally {
      rmSync(test.directory, { recursive: true, force: true });
    }
  });

  it("retries missing integrity metadata until it becomes visible", async () => {
    const test = fixture();
    try {
      const clock = testClock();
      let calls = 0;
      const result = await verifyPublishedPackage({
        key: "ai",
        tarballPath: test.tarballPath,
        retryDelays: [15],
        now: clock.now,
        sleep: clock.sleep,
        fetchImpl: async () => {
          calls += 1;
          const metadata = publishedMetadata(test);
          if (calls === 1) delete metadata.dist.integrity;
          return { ok: true, status: 200, json: async () => metadata };
        }
      });
      assert.equal(result.attempts, 2);
      assert.equal(calls, 2);
    } finally {
      rmSync(test.directory, { recursive: true, force: true });
    }
  });

  it("fails immediately on wrong registry identity", async () => {
    const test = fixture();
    try {
      for (const [overrides, message] of [
        [{ name: "@hello-ai-company/other" }, /identity or MIT license mismatch/],
        [{ version: "9.9.9" }, /identity or MIT license mismatch/],
        [{ license: "Apache-2.0" }, /identity or MIT license mismatch/],
        [{ dist: { ...publishedMetadata(test).dist, tarball: "https://registry.npmjs.org/wrong.tgz" } }, /tarball URL mismatch/]
      ]) {
        let calls = 0;
        let sleeps = 0;
        await assert.rejects(verifyPublishedPackage({
          key: "ai",
          tarballPath: test.tarballPath,
          sleep: async () => { sleeps += 1; },
          fetchImpl: async () => {
            calls += 1;
            return { ok: true, status: 200, json: async () => publishedMetadata(test, overrides) };
          }
        }), message);
        assert.equal(calls, 1);
        assert.equal(sleeps, 0);
      }
    } finally {
      rmSync(test.directory, { recursive: true, force: true });
    }
  });

  it("fails immediately on malformed successful JSON", async () => {
    const test = fixture();
    try {
      let calls = 0;
      await assert.rejects(verifyPublishedPackage({
        key: "ai",
        tarballPath: test.tarballPath,
        fetchImpl: async () => {
          calls += 1;
          return { ok: true, status: 200, json: async () => { throw new Error("bad JSON"); } };
        }
      }), /malformed package JSON/);
      assert.equal(calls, 1);
    } finally {
      rmSync(test.directory, { recursive: true, force: true });
    }
  });

  it("fails immediately on integrity mismatch", async () => {
    const test = fixture();
    try {
      let calls = 0;
      await assert.rejects(verifyPublishedPackage({
        key: "ai",
        tarballPath: test.tarballPath,
        fetchImpl: async () => {
          calls += 1;
          return {
            ok: true,
            status: 200,
            json: async () => publishedMetadata(test, {
              dist: { ...publishedMetadata(test).dist, integrity: "sha512-bad" }
            })
          };
        }
      }), /integrity does not match/);
      assert.equal(calls, 1);
    } finally {
      rmSync(test.directory, { recursive: true, force: true });
    }
  });

  it("fails closed with diagnostics after the bounded 404 retry window", async () => {
    const test = fixture();
    try {
      const clock = testClock();
      let calls = 0;
      await assert.rejects(
        verifyPublishedPackage({
          key: "ai",
          tarballPath: test.tarballPath,
          now: clock.now,
          sleep: clock.sleep,
          fetchImpl: async () => { calls += 1; return { ok: false, status: 404 }; }
        }),
        /after 10 attempts \/ 292000ms elapsed.*retry budget 300000ms.*last observed failure: npm registry returned HTTP 404/
      );
      assert.equal(calls, 10);
      assert.equal(clock.elapsed(), 292_000);
    } finally {
      rmSync(test.directory, { recursive: true, force: true });
    }
  });
});
