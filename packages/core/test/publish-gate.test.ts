import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import packageJsonSource from "../package.json?raw";

const AUTHORIZED_NAME = "@hello-ai-company/editor-core";
const AUTHORIZED_REGISTRY = "https://registry.npmjs.org";
const AUTHORIZED_VERSION = "0.1.0";
const AUTHORIZED_LICENSE = "MIT";
const AUTHORIZED_ACCESS = "public";
const FORBIDDEN_VERSIONS = ["0.0.0-private", "latest", "0.0.0-phase3.e17b4b5", "1.0.0"] as const;
const FORBIDDEN_REGISTRIES = ["https://npm.pkg.github.com"] as const;

const pkg = JSON.parse(packageJsonSource) as {
  name?: string;
  version?: string;
  private?: boolean;
  license?: string;
  publishConfig?: { registry?: string; access?: string };
  repository?: { directory?: string; type?: string; url?: string };
};

const rootPkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../package.json"), "utf8")
) as { private?: boolean; license?: string };

describe("public npmjs publish gate", () => {
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

  it("keeps the package publishable, MIT, and sourced from packages/core", () => {
    expect(pkg.private).not.toBe(true);
    expect(pkg.license).toBe(AUTHORIZED_LICENSE);
    expect(pkg.repository).toEqual({
      type: "git",
      url: "https://github.com/hello-ai-company/open-editor.git",
      directory: "packages/core"
    });
  });

  it("keeps the workspace root private and never publishable", () => {
    expect(rootPkg.private).toBe(true);
    expect(rootPkg.license).toBe(AUTHORIZED_LICENSE);
  });
});
