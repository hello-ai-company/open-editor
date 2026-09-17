import assert from "node:assert/strict";
import test from "node:test";
import {
  ANCHOR_PUBLISHED_VERSION,
  EXPECTED_NAME,
  EXPECTED_REPO,
  EXPECTED_REF,
  ReleaseGuardError,
  assertRegistryEligible,
  assertVersionsListShape,
  expectedConfirmation,
  fetchPublishedVersions,
  validateIdentityAndInputs,
  validatePublicCoreRelease,
} from "./validate-public-core-release.mjs";

function basePkg(overrides = {}) {
  return {
    name: EXPECTED_NAME,
    version: "0.1.1",
    license: "MIT",
    publishConfig: {
      registry: "https://registry.npmjs.org",
      access: "public",
    },
    ...overrides,
  };
}

function baseEnv(overrides = {}) {
  const pkg = overrides.pkg ?? basePkg();
  const inputVersion = overrides.inputVersion ?? pkg.version;
  return {
    pkg,
    inputVersion,
    confirmation:
      overrides.confirmation ?? expectedConfirmation(inputVersion),
    githubRef: overrides.githubRef ?? EXPECTED_REF,
    githubRepository: overrides.githubRepository ?? EXPECTED_REPO,
    versionsList: overrides.versionsList ?? [ANCHOR_PUBLISHED_VERSION],
    ...overrides,
  };
}

function assertFails(fn, snippet) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof ReleaseGuardError);
    assert.match(err.message, snippet);
    return true;
  });
}

test("candidate absent PASS", () => {
  const result = validatePublicCoreRelease(
    baseEnv({ versionsList: [ANCHOR_PUBLISHED_VERSION, "0.0.9"] })
  );
  assert.equal(result.version, "0.1.1");
  assert.equal(result.name, EXPECTED_NAME);
});

test("candidate present FAIL", () => {
  assertFails(
    () =>
      validatePublicCoreRelease(
        baseEnv({
          versionsList: [ANCHOR_PUBLISHED_VERSION, "0.1.1"],
        })
      ),
    /VERSION ALREADY EXISTS/
  );
});

test("0.1.0 absent FAIL", () => {
  assertFails(
    () => assertVersionsListShape(["0.2.0", "0.3.0"]),
    /missing anchor/
  );
  assertFails(
    () =>
      validatePublicCoreRelease(
        baseEnv({ versionsList: ["0.2.0"] })
      ),
    /missing anchor/
  );
});

test("command error FAIL", () => {
  assertFails(
    () =>
      fetchPublishedVersions({
        execFileSync: () => {
          const err = new Error("boom");
          err.stderr = "ECONNRESET network down";
          throw err;
        },
      }),
    /npm view versions failed/
  );
});

test("invalid JSON FAIL", () => {
  assertFails(
    () =>
      fetchPublishedVersions({
        execFileSync: () => "not-json{",
      }),
    /invalid JSON/
  );
});

test("empty FAIL", () => {
  assertFails(
    () =>
      fetchPublishedVersions({
        execFileSync: () => "   ",
      }),
    /empty stdout/
  );
  assertFails(() => assertVersionsListShape([]), /empty/);
});

test("wrong name FAIL", () => {
  assertFails(
    () =>
      validateIdentityAndInputs(
        baseEnv({ pkg: basePkg({ name: "@other/pkg" }) })
      ),
    /unexpected package name/
  );
});

test("wrong version / confirmation FAIL", () => {
  assertFails(
    () =>
      validateIdentityAndInputs(
        baseEnv({ inputVersion: "0.1.2" })
      ),
    /RELEASE INPUT MISMATCH/
  );
  assertFails(
    () =>
      validateIdentityAndInputs(
        baseEnv({ confirmation: "PUBLISH wrong" })
      ),
    /RELEASE INPUT MISMATCH/
  );
});

test("historical 0.1.0 FAIL", () => {
  assertFails(
    () =>
      validateIdentityAndInputs(
        baseEnv({
          pkg: basePkg({ version: "0.1.0" }),
          inputVersion: "0.1.0",
          confirmation: expectedConfirmation("0.1.0"),
        })
      ),
    /HISTORICAL VERSION MUST NEVER BE REPUBLISHED/
  );
});

test("wrong repo/ref FAIL", () => {
  assertFails(
    () =>
      validateIdentityAndInputs(
        baseEnv({ githubRepository: "evil/open-editor" })
      ),
    /unexpected repository/
  );
  assertFails(
    () =>
      validateIdentityAndInputs(
        baseEnv({ githubRef: "refs/heads/feature" })
      ),
    /main ref lock failed/
  );
});

test("assertRegistryEligible rejects non-array", () => {
  assertFails(
    () => assertRegistryEligible({ versions: ["0.1.0"] }, "0.1.1"),
    /not a JSON array/
  );
});
