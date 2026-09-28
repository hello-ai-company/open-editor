import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { packageConfig, tarballFilename } from "./public-package-config.mjs";
import { prepareFirstPublicRelease } from "./prepare-first-public-release.mjs";

const sha = "a".repeat(40);

function packageManifest(config) {
  return {
    name: config.name,
    version: config.version,
    license: "MIT",
    repository: config.repository,
    exports: config.exports,
    files: config.files,
    engines: config.engines,
    type: config.type,
    main: config.main,
    types: config.types,
    sideEffects: config.sideEffects,
    publishConfig: { registry: "https://registry.npmjs.org", access: "public" },
    dependencies: { ...config.dependencies },
    peerDependencies: { ...config.peerDependencies },
    scripts: { ...config.scripts }
  };
}

function fixture(key) {
  const root = mkdtempSync(join(tmpdir(), "first-public-release-"));
  const config = packageConfig(key);
  const packageDir = join(root, config.directory);
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(join(packageDir, "package.json"), JSON.stringify(packageManifest(config)));
  return { root, config };
}

function mockExec(key, overrides = {}) {
  const config = packageConfig(key);
  const calls = [];
  const versions = Object.fromEntries(Object.entries({
    ...config.dependencies,
    ...config.peerDependencies
  }).map(([name, range]) => [
    name,
    config.exactRegistryDependencies?.[name]
      ? [config.exactRegistryDependencies[name]]
      : name === "react" ? ["18.3.1"] : [range.replace(/^\^/, "")]
  ]));

  function exec(command, args, options = {}) {
    calls.push({ command, args, options });
    if (command === "git") {
      if (args[0] === "branch") return `${overrides.branch ?? "main"}\n`;
      if (args[0] === "status") return overrides.status ?? "";
      if (args[0] === "fetch") return "";
      if (args[0] === "rev-parse" && args[2] === "HEAD") return `${overrides.head ?? sha}\n`;
      if (args[0] === "rev-parse" && args[2] === "refs/remotes/origin/main") return `${overrides.remoteMain ?? sha}\n`;
    }
    if (command === "npm" && args[0] === "view") {
      const name = args[1];
      if (name === config.name && overrides.candidateVersions) return JSON.stringify(overrides.candidateVersions);
      if (overrides.ambiguousDependency === name) {
        const error = new Error("registry connection unavailable");
        error.stderr = error.message;
        throw error;
      }
      if (name in versions && !overrides.missingDependencies?.includes(name)) return JSON.stringify(versions[name]);
      const error = new Error(`npm error code E404\n${name} not found`);
      error.stderr = error.message;
      throw error;
    }
    if (command === "npm" && args[0] === "pack") {
      const destination = args[args.indexOf("--pack-destination") + 1];
      mkdirSync(destination, { recursive: true });
      writeFileSync(join(destination, tarballFilename(config)), "verified fixture tarball");
      return "";
    }
    return "";
  }
  return { exec, calls };
}

function withFixture(key, fn) {
  const test = fixture(key);
  try {
    fn(test);
  } finally {
    rmSync(test.root, { recursive: true, force: true });
  }
}

describe("first-publication preparation guards", () => {
  for (const key of ["ai", "canvas", "publish"]) {
    it(`prepares ${key} once, inspects the exact tarball, and never publishes`, () => {
      withFixture(key, ({ root, config }) => {
        const { exec, calls } = mockExec(key);
        const result = prepareFirstPublicRelease({ key, root, exec });
        const commands = calls.map(({ command, args }) => `${command} ${args.join(" ")}`);
        const packs = calls.filter(({ command, args }) => command === "npm" && args[0] === "pack");
        const inspections = calls.filter(({ command, args }) => args[0]?.endsWith("scripts/inspect-public-tarballs.mjs"));

        assert.equal(result.name, config.name);
        assert.equal(result.version, config.version);
        assert.equal(result.sourceCommit, sha);
        assert.match(result.sha256, /^[0-9a-f]{64}$/);
        assert.equal(result.tarballPath, join(root, `release-artifact-${key}`, tarballFilename(config)));
        assert.equal(calls.filter(({ command, args }) => command === "npm" && args[0] === "ci" && args[1] === "--ignore-scripts").length, 1);
        assert.equal(calls.filter(({ command, args }) => command === "npm" && args[0] === "run" && args[1] === "verify").length, 1);
        assert.equal(packs.length, 1);
        assert.deepEqual(packs[0].args, ["pack", "-w", config.name, "--pack-destination", join(root, `release-artifact-${key}`), "--ignore-scripts"]);
        assert.equal(inspections.length, 1);
        assert.deepEqual(inspections[0].args.slice(1), [key, result.tarballPath]);
        assert.ok(commands.every((command) => !/^npm publish(?: |$)/.test(command)));
      });
    });
  }

  it("rejects BlockNote before running commands", () => {
    const calls = [];
    assert.throws(() => prepareFirstPublicRelease({ key: "blocknote", exec: (...args) => calls.push(args) }), /only ai, canvas, or publish/);
    assert.equal(calls.length, 0);
  });

  it("requires the entire target package and candidate version to be absent", () => {
    withFixture("ai", ({ root }) => {
      const existingVersion = mockExec("ai", { candidateVersions: ["0.0.1"] });
      assert.throws(() => prepareFirstPublicRelease({ key: "ai", root, exec: existingVersion.exec }), /first publication requires a new npm package/);
      assert.equal(existingVersion.calls.some(({ command, args }) => command === "npm" && args[0] === "pack"), false);

      const candidateVersion = mockExec("ai", { candidateVersions: ["0.1.0"] });
      assert.throws(() => prepareFirstPublicRelease({ key: "ai", root, exec: candidateVersion.exec }), /first publication requires a new npm package/);
    });
  });

  it("fails closed on dependency registry ambiguity", () => {
    withFixture("ai", ({ root }) => {
      const { exec, calls } = mockExec("ai", { ambiguousDependency: "@hello-ai-company/editor-core" });
      assert.throws(() => prepareFirstPublicRelease({ key: "ai", root, exec }), /fail-closed/);
      assert.equal(calls.some(({ command, args }) => command === "npm" && args[0] === "ci"), false);
      assert.equal(calls.some(({ command, args }) => command === "npm" && args[0] === "pack"), false);
    });
  });

  it("requires live editor-canvas@0.1.0 before Publish bootstrap", () => {
    withFixture("publish", ({ root }) => {
      const { exec, calls } = mockExec("publish", { missingDependencies: ["@hello-ai-company/editor-canvas"] });
      assert.throws(() => prepareFirstPublicRelease({ key: "publish", root, exec }), /required dependency @hello-ai-company\/editor-canvas is not published/);
      assert.equal(calls.some(({ command, args }) => command === "npm" && args[0] === "pack"), false);
    });
  });

  it("rejects dirty, stale, or non-main checkouts", () => {
    for (const [overrides, error] of [
      [{ status: " M README.md" }, /working tree must be clean/],
      [{ branch: "feature" }, /requires branch main/],
      [{ remoteMain: "b".repeat(40) }, /stale or differs from origin\/main/]
    ]) {
      withFixture("ai", ({ root }) => {
        const { exec, calls } = mockExec("ai", overrides);
        assert.throws(() => prepareFirstPublicRelease({ key: "ai", root, exec }), error);
        assert.equal(calls.some(({ command, args }) => command === "npm" && args[0] === "pack"), false);
      });
    }
  });

  it("rejects a manifest whose version differs from the reviewed candidate", () => {
    withFixture("canvas", ({ root, config }) => {
      const packagePath = join(root, config.directory, "package.json");
      writeFileSync(packagePath, JSON.stringify({ ...packageManifest(config), version: "0.1.1" }));
      const { exec, calls } = mockExec("canvas");
      assert.throws(() => prepareFirstPublicRelease({ key: "canvas", root, exec }), /package version must be 0.1.0/);
      assert.equal(calls.length, 0);
    });
  });
});
