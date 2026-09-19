/**
 * Fail-closed npmjs versions-list probe for @hello-ai-company/editor-core.
 *
 * NEVER infer "unpublished candidate" from `npm view pkg@ver version` exit codes
 * (network/DNS/timeout/5xx would look like "not published" and falsely PASS).
 *
 * Always use:
 *   npm view @hello-ai-company/editor-core versions --json --registry=https://registry.npmjs.org
 *
 * Fail closed on: command failure, empty stdout, invalid JSON, wrong shape,
 * missing published anchor 0.1.0. Only then inspect whether the candidate
 * (default 0.1.1) is present.
 */

import { execFileSync } from "node:child_process";

export const CORE_PKG = "@hello-ai-company/editor-core";
export const CORE_REGISTRY = "https://registry.npmjs.org";
export const CORE_ANCHOR_VERSION = "0.1.0";
export const CORE_CANDIDATE_VERSION = "0.1.1";
/** Dependency floor encoded by blocknote: ^0.1.1 */
export const CORE_DEP_RANGE = "^0.1.1";

export class CoreRegistryProbeError extends Error {
  constructor(message) {
    super(message);
    this.name = "CoreRegistryProbeError";
  }
}

export function stop(message) {
  throw new CoreRegistryProbeError(message);
}

/**
 * Normalize npm `versions` JSON (string | string[]) into string[].
 * @param {unknown} parsed
 * @returns {string[]}
 */
export function normalizeVersionsList(parsed) {
  if (typeof parsed === "string") {
    return [parsed];
  }
  if (Array.isArray(parsed)) {
    return parsed;
  }
  stop("STOP — registry versions response is not a string or string array");
}

/**
 * Fail-closed shape + anchor checks.
 * @param {unknown} versionsParsed
 * @returns {string[]}
 */
export function assertCoreVersionsListShape(versionsParsed) {
  const versions = normalizeVersionsList(versionsParsed);
  if (versions.length === 0) {
    stop("STOP — registry versions list is empty");
  }
  if (!versions.every((v) => typeof v === "string")) {
    stop("STOP — registry versions list contains non-string entries");
  }
  if (!versions.includes(CORE_ANCHOR_VERSION)) {
    stop(
      `STOP — registry versions list missing anchor ${CORE_ANCHOR_VERSION}`
    );
  }
  return versions;
}

/**
 * Parse stdout from a successful `npm view … versions --json`.
 * @param {string} stdout
 * @returns {string[]}
 */
export function parseCoreVersionsStdout(stdout) {
  const text = String(stdout ?? "").trim();
  if (!text) {
    stop("STOP — npm view versions returned empty stdout");
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    stop("STOP — npm view versions returned invalid JSON");
  }
  return assertCoreVersionsListShape(parsed);
}

/**
 * Live (or injected) fetch of published core versions. Fail-closed.
 * @param {{ execFileSync?: typeof execFileSync }} [deps]
 * @returns {string[]}
 */
export function fetchCorePublishedVersions(deps = {}) {
  const exec = deps.execFileSync ?? execFileSync;
  let stdout;
  try {
    stdout = exec(
      "npm",
      [
        "view",
        CORE_PKG,
        "versions",
        "--json",
        `--registry=${CORE_REGISTRY}`
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 10 * 1024 * 1024
      }
    );
  } catch (err) {
    const stderr = String(err?.stderr || err?.message || err);
    stop(
      `STOP — npm view versions failed (fail-closed): ${stderr.trim() || "unknown error"}`
    );
  }
  return parseCoreVersionsStdout(stdout);
}

/**
 * Whether a semver string satisfies caret range ^0.1.1
 * (major===0 && minor===1 && patch>=1). Rejects 0.2.0 and 1.0.0.
 * @param {string} version
 * @returns {boolean}
 */
export function satisfiesCaretZeroOneOne(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(version ?? ""));
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  return major === 0 && minor === 1 && patch >= 1;
}

/**
 * Interpret a validated versions list for the adaptive consumer gate.
 * @param {string[]} versions — already shape-checked (includes 0.1.0)
 * @param {string} [candidateVersion]
 * @returns {"unpublished_candidate" | "published_candidate"}
 */
export function classifyCoreCandidateState(
  versions,
  candidateVersion = CORE_CANDIDATE_VERSION
) {
  assertCoreVersionsListShape(versions);
  if (versions.includes(candidateVersion)) {
    return "published_candidate";
  }
  return "unpublished_candidate";
}

/**
 * Full adaptive probe used by isolated-blocknote-consumer.
 * @param {{
 *   versionsList?: string[],
 *   execFileSync?: typeof execFileSync,
 *   candidateVersion?: string
 * }} [options]
 * @returns {{
 *   versions: string[],
 *   state: "unpublished_candidate" | "published_candidate",
 *   candidateVersion: string
 * }}
 */
export function probeCoreCandidatePublication(options = {}) {
  const candidateVersion = options.candidateVersion ?? CORE_CANDIDATE_VERSION;
  let versions = options.versionsList;
  if (versions === undefined) {
    versions = fetchCorePublishedVersions({
      execFileSync: options.execFileSync
    });
  } else {
    versions = assertCoreVersionsListShape(versions);
  }
  const state = classifyCoreCandidateState(versions, candidateVersion);
  return { versions, state, candidateVersion };
}

/**
 * Fail-closed: at least one published core version must satisfy ^0.1.1
 * before blocknote may be published.
 * @param {string[]} versions — shape-checked list
 * @param {string} [floorRange]
 */
export function assertCoreFloorPublishedForBlocknote(
  versions,
  floorRange = CORE_DEP_RANGE
) {
  const list = assertCoreVersionsListShape(versions);
  if (floorRange !== CORE_DEP_RANGE) {
    stop(`STOP — unsupported core floor range: ${floorRange}`);
  }
  const matching = list.filter((v) => satisfiesCaretZeroOneOne(v));
  if (matching.length === 0) {
    stop(
      `STOP — ${CORE_PKG} meeting ${floorRange} is not published on npmjs ` +
        `(require ${CORE_CANDIDATE_VERSION}+ before publishing blocknote)`
    );
  }
  return matching;
}
