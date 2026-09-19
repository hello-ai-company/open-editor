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
  satisfiesCaretZeroOneOne
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

  it('["0.1.0","0.1.1"] → published candidate state', () => {
    const result = probeCoreCandidatePublication({
      versionsList: ["0.1.0", "0.1.1"]
    });
    assert.equal(result.state, "published_candidate");
    assert.equal(
      classifyCoreCandidateState(["0.1.0", "0.1.1"], CORE_CANDIDATE_VERSION),
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
      () => assertCoreVersionsListShape(["0.2.0", "0.1.1"]),
      /missing anchor/
    );
    assertFails(
      () =>
        probeCoreCandidatePublication({
          versionsList: ["0.1.1"]
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

  it("^0.1.1 caret: 0.1.1+ on 0.1.x only", () => {
    assert.equal(satisfiesCaretZeroOneOne("0.1.1"), true);
    assert.equal(satisfiesCaretZeroOneOne("0.1.2"), true);
    assert.equal(satisfiesCaretZeroOneOne("0.1.0"), false);
    assert.equal(satisfiesCaretZeroOneOne("0.2.0"), false);
    assert.equal(satisfiesCaretZeroOneOne("1.0.0"), false);
  });

  it("blocknote publish requires core floor on registry", () => {
    assertFails(
      () => assertCoreFloorPublishedForBlocknote(["0.1.0"]),
      /not published/
    );
    const matching = assertCoreFloorPublishedForBlocknote([
      "0.1.0",
      "0.1.1"
    ]);
    assert.deepEqual(matching, ["0.1.1"]);
  });
});
