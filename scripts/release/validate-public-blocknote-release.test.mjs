import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertRegistryEligible,
  expectedConfirmation,
  validateIdentityAndInputs,
  validatePublicBlocknoteRelease,
  ReleaseGuardError
} from "./validate-public-blocknote-release.mjs";

const basePkg = {
  name: "@hello-ai-company/editor-blocknote",
  version: "0.1.0",
  license: "MIT",
  publishConfig: {
    registry: "https://registry.npmjs.org",
    access: "public"
  },
  dependencies: {
    "@hello-ai-company/editor-core": "^0.1.0"
  },
  peerDependencies: {
    "@blocknote/core": "^0.54.2",
    "@blocknote/react": "^0.54.2"
  }
};

const baseEnv = {
  pkg: basePkg,
  inputVersion: "0.1.0",
  confirmation: expectedConfirmation("0.1.0"),
  githubRef: "refs/heads/main",
  githubRepository: "hello-ai-company/open-editor"
};

describe("validate-public-blocknote-release", () => {
  it("accepts identity for first publish", () => {
    const id = validateIdentityAndInputs(baseEnv);
    assert.equal(id.name, basePkg.name);
    assert.equal(id.version, "0.1.0");
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

  it("rejects wrong BlockNote peer floor", () => {
    assert.throws(
      () =>
        validateIdentityAndInputs({
          ...baseEnv,
          pkg: {
            ...basePkg,
            peerDependencies: {
              "@blocknote/core": "^0.52.1",
              "@blocknote/react": "^0.52.1"
            }
          }
        }),
      /0\.54\.2/
    );
  });

  it("allows not_published registry state", () => {
    const result = validatePublicBlocknoteRelease({
      ...baseEnv,
      registryState: { status: "not_published" }
    });
    assert.equal(result.registryStatus, "not_published");
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
});
