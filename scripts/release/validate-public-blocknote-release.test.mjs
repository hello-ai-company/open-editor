import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  assertCoreDependencyPublished,
  assertRegistryEligible,
  expectedConfirmation,
  fetchBlocknoteRegistryState,
  validateIdentityAndInputs,
  validatePublicBlocknoteRelease,
  packReleaseArtifact,
  verifyReleaseArtifact,
  tarballFilenameFor,
  ReleaseGuardError
} from "./validate-public-blocknote-release.mjs";

const basePkg = JSON.parse(readFileSync("packages/blocknote/package.json", "utf8"));
const reviewedCommit = "a".repeat(40);

const baseEnv = {
  pkg: basePkg,
  inputVersion: "0.2.0",
  confirmation: expectedConfirmation("0.2.0"),
  githubRef: "refs/heads/main",
  githubRepository: "hello-ai-company/open-editor",
  reviewedCommit,
  githubSha: reviewedCommit,
  checkoutSha: reviewedCommit,
  // Default: core@0.2.0 already published (required publish order).
  coreVersionsList: ["0.1.0", "0.2.0"]
};

function assertFails(fn, snippet) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof ReleaseGuardError);
    assert.match(err.message, snippet);
    return true;
  });
}

function failingExec(stderr, status = 1) {
  return () => {
    const err = new Error(stderr);
    err.status = status;
    err.stderr = stderr;
    throw err;
  };
}

describe("validate-public-blocknote-release", () => {
  it("accepts identity for the R2 update candidate", () => {
    const id = validateIdentityAndInputs(baseEnv);
    assert.equal(id.name, basePkg.name);
    assert.equal(id.version, "0.2.0");
  });

  it("rejects private:true", () => {
    assert.throws(
      () =>
        validateIdentityAndInputs({
          ...baseEnv,
          pkg: { ...basePkg, private: true }
        }),
      ReleaseGuardError
    );
  });

  it("locks reviewed source and published metadata", () => {
    assertFails(
      () => validateIdentityAndInputs({ ...baseEnv, reviewedCommit: "f".repeat(40) }),
      /reviewed_commit must equal/
    );
    for (const changed of [
      { exports: { ".": "./dist/unsafe.js" } },
      { repository: { ...basePkg.repository, directory: "packages/other" } },
      { files: ["dist", "README.md"] },
      { engines: { node: ">=18" } },
      { scripts: { ...basePkg.scripts, prepack: "node payload.js" } }
    ]) {
      assertFails(
        () => validateIdentityAndInputs({ ...baseEnv, pkg: { ...basePkg, ...changed } }),
        /package .* metadata mismatch/
      );
    }
    assertFails(
      () => validateIdentityAndInputs({
        ...baseEnv,
        pkg: { ...basePkg, publishConfig: { ...basePkg.publishConfig, tag: "latest" } }
      }),
      /publishConfig must be exactly/
    );
    assertFails(
      () => validateIdentityAndInputs({
        ...baseEnv,
        pkg: { ...basePkg, optionalDependencies: { injected: "*" } }
      }),
      /optional or bundled dependencies/
    );
  });

  it("rejects wrong BlockNote peer floor on core/react", () => {
    assert.throws(
      () =>
        validateIdentityAndInputs({
          ...baseEnv,
          pkg: {
            ...basePkg,
            peerDependencies: {
              ...basePkg.peerDependencies,
              "@blocknote/core": "^0.52.1",
              "@blocknote/react": "^0.52.1"
            }
          }
        }),
      /0\.54\.2/
    );
  });

  it("rejects wrong optional BlockNote peer floor (math/diagram/code)", () => {
    for (const peer of [
      "@blocknote/math-block",
      "@blocknote/diagram-block",
      "@blocknote/code-block"
    ]) {
      assertFails(
        () =>
          validateIdentityAndInputs({
            ...baseEnv,
            pkg: {
              ...basePkg,
              peerDependencies: {
                ...basePkg.peerDependencies,
                [peer]: "^0.52.1"
              }
            }
          }),
        new RegExp(peer.replace("/", "\\/"))
      );
    }
  });

  it("rejects missing optional peerDependenciesMeta.optional true", () => {
    assertFails(
      () =>
        validateIdentityAndInputs({
          ...baseEnv,
          pkg: {
            ...basePkg,
            peerDependenciesMeta: {
              "@blocknote/math-block": { optional: true },
              "@blocknote/diagram-block": { optional: true }
              // code-block missing
            }
          }
        }),
      /peerDependenciesMeta\.@blocknote\/code-block\.optional must be true/
    );
    assertFails(
      () =>
        validateIdentityAndInputs({
          ...baseEnv,
          pkg: {
            ...basePkg,
            peerDependenciesMeta: {
              ...basePkg.peerDependenciesMeta,
              "@blocknote/math-block": { optional: false }
            }
          }
        }),
      /peerDependenciesMeta\.@blocknote\/math-block\.optional must be true/
    );
  });

  it("rejects editor-core dependency below ^0.2.0 floor", () => {
    assert.throws(
      () =>
        validateIdentityAndInputs({
          ...baseEnv,
          pkg: {
            ...basePkg,
            dependencies: {
              "@hello-ai-company/editor-core": "^0.1.0"
            }
          }
        }),
      /\^0\.2\.0/
    );
  });

  it("allows not_published registry state when core floor is published", () => {
    const result = validatePublicBlocknoteRelease({
      ...baseEnv,
      registryState: { status: "not_published" }
    });
    assert.equal(result.registryStatus, "not_published");
    assert.deepEqual(result.coreFloorVersions, ["0.2.0"]);
  });

  it("stops when core@0.2.0 is not on npmjs (publish order)", () => {
    assert.throws(
      () =>
        validatePublicBlocknoteRelease({
          ...baseEnv,
          coreVersionsList: ["0.1.0"],
          registryState: { status: "not_published" }
        }),
      (err) =>
        err instanceof ReleaseGuardError && /not published/.test(err.message)
    );
    assert.throws(
      () => assertCoreDependencyPublished({ coreVersionsList: ["0.1.0"] }),
      /not published/
    );
  });

  it("requires the exact core 0.2.0 release dependency", () => {
    assert.deepEqual(assertCoreDependencyPublished({ coreVersionsList: ["0.2.0"] }), ["0.2.0"]);
    assert.throws(() => assertCoreDependencyPublished({ coreVersionsList: ["0.1.2"] }), /@hello-ai-company\/editor-core@0\.2\.0/);
  });

  it("stops when candidate version already exists", () => {
    assert.throws(
      () =>
        assertRegistryEligible(
          { status: "published", versions: ["0.1.0"] },
          "0.1.0"
        ),
      /ALREADY EXISTS/
    );
  });

  it("rejects wrong confirmation", () => {
    assert.throws(
      () =>
        validateIdentityAndInputs({
          ...baseEnv,
          confirmation: "PUBLISH NOW"
        }),
      /confirmation must be exactly/
    );
  });

  it("rejects wrong repo/ref", () => {
    assertFails(
      () =>
        validateIdentityAndInputs({
          ...baseEnv,
          githubRepository: "evil/open-editor"
        }),
      /unexpected repository/
    );
    assertFails(
      () =>
        validateIdentityAndInputs({
          ...baseEnv,
          githubRef: "refs/heads/feature"
        }),
      /main ref lock failed/
    );
  });

  it("E404 classifies as not_published (first-publish eligible)", () => {
    const state = fetchBlocknoteRegistryState({
      execFileSync: failingExec(
        "npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/@hello-ai-company%2feditor-blocknote"
      )
    });
    assert.equal(state.status, "not_published");
  });

  it("E404 shorthand without 'npm error code' still classifies as not_published", () => {
    const state = fetchBlocknoteRegistryState({
      execFileSync: failingExec("code E404\npackage not found")
    });
    assert.equal(state.status, "not_published");
  });

  it("fail-closed: lone '404 Not Found' without E404 is NOT not_published", () => {
    assertFails(
      () =>
        fetchBlocknoteRegistryState({
          execFileSync: failingExec(
            "npm error 404 Not Found - GET https://registry.npmjs.org/@hello-ai-company%2feditor-blocknote"
          )
        }),
      /fail-closed/
    );
  });

  it("fail-closed: lone 'No match found' without E404 is NOT not_published", () => {
    assertFails(
      () =>
        fetchBlocknoteRegistryState({
          execFileSync: failingExec("No match found for package")
        }),
      /fail-closed/
    );
  });

  it("fail-closed: lone 'not in this registry' without E404 is NOT not_published", () => {
    assertFails(
      () =>
        fetchBlocknoteRegistryState({
          execFileSync: failingExec(
            "'@hello-ai-company/editor-blocknote@*' is not in this registry."
          )
        }),
      /fail-closed/
    );
  });

  it("fail-closed: ECONNRESET is NOT treated as unpublished", () => {
    assertFails(
      () =>
        fetchBlocknoteRegistryState({
          execFileSync: failingExec("ECONNRESET network down")
        }),
      /npm view versions failed \(fail-closed\)/
    );
  });

  it("fail-closed: ENOTFOUND is NOT treated as unpublished", () => {
    assertFails(
      () =>
        fetchBlocknoteRegistryState({
          execFileSync: failingExec("npm error code ENOTFOUND")
        }),
      /fail-closed/
    );
  });

  it("fail-closed: ETIMEDOUT is NOT treated as unpublished", () => {
    assertFails(
      () =>
        fetchBlocknoteRegistryState({
          execFileSync: failingExec("npm error code ETIMEDOUT")
        }),
      /fail-closed/
    );
  });

  it("fail-closed: 5xx registry errors are NOT treated as unpublished", () => {
    assertFails(
      () =>
        fetchBlocknoteRegistryState({
          execFileSync: failingExec(
            "npm error 502 Bad Gateway - GET https://registry.npmjs.org/@hello-ai-company%2feditor-blocknote"
          )
        }),
      /fail-closed/
    );
    assertFails(
      () =>
        fetchBlocknoteRegistryState({
          execFileSync: failingExec(
            "npm error 503 Service Unavailable"
          )
        }),
      /fail-closed/
    );
  });

  it("fail-closed: empty stdout on success", () => {
    assertFails(
      () =>
        fetchBlocknoteRegistryState({
          execFileSync: () => "   "
        }),
      /empty stdout/
    );
  });

  it("fail-closed: invalid JSON on success", () => {
    assertFails(
      () =>
        fetchBlocknoteRegistryState({
          execFileSync: () => "not-json{"
        }),
      /invalid JSON/
    );
  });

  it("verifyReleaseArtifact accepts matching digest + tarball", () => {
    const dir = mkdtempSync(join(tmpdir(), "bn-artifact-"));
    try {
      const filename = tarballFilenameFor("0.2.0");
      const payload = Buffer.from("fake-blocknote-tarball");
      const tarballPath = join(dir, filename);
      writeFileSync(tarballPath, payload);
      const sha256 = createHash("sha256").update(payload).digest("hex");
      writeFileSync(
        join(dir, "digest.json"),
        JSON.stringify({
          name: "@hello-ai-company/editor-blocknote",
          version: "0.2.0",
          sourceCommit: reviewedCommit,
          filename,
          sha256,
          size: payload.length
        })
      );
      const inspectorCalls = [];
      const { digest, tarballPath: verified } = verifyReleaseArtifact({
        artifactDir: dir,
        expectedVersion: "0.2.0",
        sourceCommit: reviewedCommit,
        execFileSync: (command, args, options) => inspectorCalls.push({ command, args, options })
      });
      assert.equal(digest.sha256, sha256);
      assert.equal(verified, tarballPath);
      assert.equal(inspectorCalls.length, 1);
      assert.equal(inspectorCalls[0].command, "node");
      assert.deepEqual(inspectorCalls[0].args, ["scripts/inspect-blocknote-tarball.mjs", tarballPath]);
      assert.equal(inspectorCalls[0].options.cwd, process.cwd());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("packReleaseArtifact inspects the exact tarball before writing its digest", () => {
    const root = mkdtempSync(join(tmpdir(), "bn-pack-artifact-"));
    try {
      const calls = [];
      const filename = tarballFilenameFor("0.2.0");
      const tarballPath = join(root, "release-artifact-blocknote", filename);
      const digest = packReleaseArtifact({
        root,
        version: "0.2.0",
        sourceCommit: reviewedCommit,
        execFileSync: (command, args, options) => {
          calls.push({ command, args, options });
          if (command === "npm") writeFileSync(tarballPath, "candidate tarball");
        }
      });
      assert.equal(calls.length, 2);
      assert.equal(calls[0].command, "npm");
      assert.equal(calls[1].command, "node");
      assert.deepEqual(calls[1].args, ["scripts/inspect-blocknote-tarball.mjs", tarballPath]);
      assert.equal(calls[1].options.cwd, root);
      assert.equal(digest.filename, filename);
      assert.equal(digest.sha256, createHash("sha256").update("candidate tarball").digest("hex"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("verifyReleaseArtifact rejects SHA-256 mismatch", () => {
    const dir = mkdtempSync(join(tmpdir(), "bn-artifact-bad-"));
    try {
      const filename = tarballFilenameFor("0.2.0");
      writeFileSync(join(dir, filename), "payload-a");
      writeFileSync(
        join(dir, "digest.json"),
        JSON.stringify({
          name: "@hello-ai-company/editor-blocknote",
          version: "0.2.0",
          sourceCommit: reviewedCommit,
          filename,
          sha256: "0".repeat(64),
          size: Buffer.byteLength("payload-a")
        })
      );
      assertFails(
        () =>
          verifyReleaseArtifact({
            artifactDir: dir,
            expectedVersion: "0.2.0",
            sourceCommit: reviewedCommit
          }),
        /SHA-256 mismatch/
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
