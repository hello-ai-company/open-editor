import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CORE_ANCHOR_VERSION,
  CORE_CANDIDATE_VERSION,
  CoreRegistryProbeError,
  assertCoreFloorPublishedForBlocknote,
  assertCoreVersionsListShape,
  classifyCoreCandidateState,
  fetchCorePublishedVersions,
  parseCoreVersionsStdout,
  probeCoreCandidatePublication,
  satisfiesCoreDependencyRange
} from "./core-registry-probe.mjs";

function assertFails(fn, snippet) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof CoreRegistryProbeError);
    assert.match(err.message, snippet);
    return true;
  });
}

describe("core-registry-probe fail-closed", () => {
  it('["0.1.0"] → unpublished candidate state', () => {
    const result = probeCoreCandidatePublication({
      versionsList: ["0.1.0"]
    });
    assert.equal(result.state, "unpublished_candidate");
    assert.equal(result.candidateVersion, CORE_CANDIDATE_VERSION);
    assert.equal(
      classifyCoreCandidateState(["0.1.0"], CORE_CANDIDATE_VERSION),
      "unpublished_candidate"
    );
  });

  it('["0.1.0","0.2.0"] → published candidate state', () => {
    const result = probeCoreCandidatePublication({
      versionsList: ["0.1.0", "0.2.0"]
    });
    assert.equal(result.state, "published_candidate");
    assert.equal(
      classifyCoreCandidateState(["0.1.0", "0.2.0"], CORE_CANDIDATE_VERSION),
      "published_candidate"
    );
  });

  it("network error → FAIL", () => {
    assertFails(
      () =>
        fetchCorePublishedVersions({
          execFileSync: () => {
            const err = new Error("getaddrinfo ENOTFOUND");
            err.stderr = "npm error code ENOTFOUND\nnpm error network";
            throw err;
          }
        }),
      /npm view versions failed/
    );
  });

  it("invalid JSON → FAIL", () => {
    assertFails(() => parseCoreVersionsStdout("not-json{"), /invalid JSON/);
  });

  it("empty output → FAIL", () => {
    assertFails(() => parseCoreVersionsStdout("   "), /empty stdout/);
  });

  it("missing 0.1.0 → FAIL", () => {
    assertFails(
      () => assertCoreVersionsListShape(["0.2.0", "0.2.0"]),
      /missing anchor/
    );
    assertFails(
      () =>
        probeCoreCandidatePublication({
          versionsList: ["0.2.0"]
        }),
      /missing anchor/
    );
  });

  it("accepts single-string versions JSON from npm", () => {
    const versions = parseCoreVersionsStdout(`"${CORE_ANCHOR_VERSION}"`);
    assert.deepEqual(versions, [CORE_ANCHOR_VERSION]);
  });

  it("rejects non-string array entries", () => {
    assertFails(
      () => assertCoreVersionsListShape(["0.1.0", 1]),
      /non-string/
    );
  });

  it("^0.2.0 caret: 0.2.0+ on 0.2.x only", () => {
    assert.equal(satisfiesCoreDependencyRange("0.2.0"), true);
    assert.equal(satisfiesCoreDependencyRange("0.2.1"), true);
    assert.equal(satisfiesCoreDependencyRange("0.1.0"), false);
    assert.equal(satisfiesCoreDependencyRange("0.1.1"), false);
    assert.equal(satisfiesCoreDependencyRange("1.0.0"), false);
    assert.equal(satisfiesCoreDependencyRange("0.2.0-beta.1"), false);
    assert.equal(satisfiesCoreDependencyRange("0.2.0+build.1"), true);
  });

  it("blocknote publish requires core floor on registry", () => {
    assertFails(
      () => assertCoreFloorPublishedForBlocknote(["0.1.0"]),
      /not published/
    );
    const matching = assertCoreFloorPublishedForBlocknote([
      "0.1.0",
      "0.2.0"
    ]);
    assert.deepEqual(matching, ["0.2.0"]);
  });
});
