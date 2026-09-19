import { describe, expect, it } from "vitest";
import packageJsonSource from "../package.json?raw";
import rootPackageJsonSource from "../../../package.json?raw";

const AUTHORIZED_NAME = "@hello-ai-company/editor-blocknote";
const AUTHORIZED_REGISTRY = "https://registry.npmjs.org";
const AUTHORIZED_VERSION = "0.1.0";
const AUTHORIZED_LICENSE = "MIT";
const AUTHORIZED_ACCESS = "public";
const AUTHORIZED_CORE_DEP = "@hello-ai-company/editor-core";
const AUTHORIZED_PEER_CORE = "^0.54.2";
const FORBIDDEN_VERSIONS = ["0.0.0-private", "latest", "1.0.0"] as const;
const FORBIDDEN_REGISTRIES = ["https://npm.pkg.github.com"] as const;

const pkg = JSON.parse(packageJsonSource) as {
  name?: string;
  version?: string;
  private?: boolean;
  license?: string;
  description?: string;
  publishConfig?: { registry?: string; access?: string };
  repository?: { directory?: string; type?: string; url?: string };
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const rootPkg = JSON.parse(rootPackageJsonSource) as {
  private?: boolean;
  license?: string;
};

describe("public npmjs publish gate — editor-blocknote", () => {
  it("fails unless publishConfig is npmjs.org with public access", () => {
    expect(pkg.publishConfig?.registry).toBe(AUTHORIZED_REGISTRY);
    expect(pkg.publishConfig?.access).toBe(AUTHORIZED_ACCESS);
    for (const registry of FORBIDDEN_REGISTRIES) {
      expect(pkg.publishConfig?.registry).not.toBe(registry);
    }
  });

  it("fails unless version is the authorized public 0.1.0", () => {
    expect(pkg.name).toBe(AUTHORIZED_NAME);
    expect(pkg.version).toBe(AUTHORIZED_VERSION);
    for (const version of FORBIDDEN_VERSIONS) {
      expect(pkg.version).not.toBe(version);
    }
  });

  it("keeps the package publishable, MIT, and sourced from packages/blocknote", () => {
    expect(pkg.private).not.toBe(true);
    expect(pkg.license).toBe(AUTHORIZED_LICENSE);
    expect(pkg.repository).toEqual({
      type: "git",
      url: "git+https://github.com/hello-ai-company/open-editor.git",
      directory: "packages/blocknote"
    });
  });

  it("pins BlockNote peers to ^0.54.2 (compat matrix floor)", () => {
    expect(pkg.peerDependencies?.["@blocknote/core"]).toBe(AUTHORIZED_PEER_CORE);
    expect(pkg.peerDependencies?.["@blocknote/react"]).toBe(AUTHORIZED_PEER_CORE);
  });

  it("depends only on published editor-core", () => {
    expect(Object.keys(pkg.dependencies ?? {})).toEqual([AUTHORIZED_CORE_DEP]);
    expect(pkg.dependencies?.[AUTHORIZED_CORE_DEP]).toBe("^0.1.1");
  });

  it("keeps the workspace root private and never publishable", () => {
    expect(rootPkg.private).toBe(true);
    expect(rootPkg.license).toBe(AUTHORIZED_LICENSE);
  });

  it("does not claim unpublished in description", () => {
    expect(pkg.description?.toLowerCase()).not.toContain("unpublished");
  });
});
