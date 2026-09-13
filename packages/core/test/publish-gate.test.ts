import { describe, expect, it } from "vitest";
import packageJsonSource from "../package.json?raw";

const AUTHORIZED_NAME = "@hello-ai/editor-core";
const AUTHORIZED_REGISTRY = "https://npm.pkg.github.com";
const AUTHORIZED_VERSION = "0.0.0-phase3.e17b4b5";
const FORBIDDEN_VERSIONS = ["0.0.0-private", "latest", "0.1.0", "1.0.0"] as const;

const pkg = JSON.parse(packageJsonSource) as {
  name?: string;
  version?: string;
  private?: boolean;
  license?: string;
  publishConfig?: { registry?: string };
  repository?: { directory?: string; type?: string; url?: string };
};

describe("private GitHub Packages publish gate", () => {
  it("fails unless publishConfig.registry is GitHub Packages", () => {
    expect(pkg.publishConfig?.registry).toBe(AUTHORIZED_REGISTRY);
    expect(pkg.publishConfig?.registry).not.toBe("https://registry.npmjs.org");
  });

  it("fails unless version is the authorized prerelease", () => {
    expect(pkg.name).toBe(AUTHORIZED_NAME);
    expect(pkg.version).toBe(AUTHORIZED_VERSION);
    for (const version of FORBIDDEN_VERSIONS) {
      expect(pkg.version).not.toBe(version);
    }
  });

  it("keeps the package publishable, UNLICENSED, and sourced from packages/core", () => {
    expect(pkg.private).not.toBe(true);
    expect(pkg.license).toBe("UNLICENSED");
    expect(pkg.repository).toEqual({
      type: "git",
      url: "https://github.com/hello-ai-company/open-editor.git",
      directory: "packages/core"
    });
  });
});
