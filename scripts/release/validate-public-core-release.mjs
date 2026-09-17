/**
 * Shared release guards for @hello-ai-company/editor-core Trusted Publishing.
 *
 * Registry rule (P1-1): NEVER infer "unpublished" from npm failure / 404 regex.
 * Require a successful `npm view <name> versions --json` that returns a JSON
 * array containing 0.1.0, and NOT containing the candidate version.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const EXPECTED_REPO = "hello-ai-company/open-editor";
export const EXPECTED_NAME = "@hello-ai-company/editor-core";
export const EXPECTED_LICENSE = "MIT";
export const EXPECTED_REGISTRY = "https://registry.npmjs.org";
export const EXPECTED_ACCESS = "public";
export const EXPECTED_REF = "refs/heads/main";
export const ANCHOR_PUBLISHED_VERSION = "0.1.0";
export const HISTORICAL_VERSIONS = Object.freeze([
  "0.1.0",
  "0.0.0-phase3.e17b4b5",
]);

export class ReleaseGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReleaseGuardError";
  }
}

export function stop(message) {
  throw new ReleaseGuardError(message);
}

export function expectedConfirmation(version) {
  return `PUBLISH @hello-ai-company/editor-core@${version}`;
}

export function tarballFilenameFor(version) {
  return `hello-ai-company-editor-core-${version}.tgz`;
}

/**
 * Validate package identity, inputs, repo/ref, and historical bans.
 * Does not touch the network.
 */
export function validateIdentityAndInputs({
  pkg,
  inputVersion,
  confirmation,
  githubRef,
  githubRepository,
}) {
  if (githubRepository !== EXPECTED_REPO) {
    stop(`STOP — unexpected repository: ${githubRepository}`);
  }
  if (githubRef !== EXPECTED_REF) {
    stop(
      `STOP — main ref lock failed; github.ref must be ${EXPECTED_REF}, got ${githubRef}`
    );
  }
  if (!pkg || typeof pkg !== "object") {
    stop("STOP — package.json missing or invalid");
  }
  if (pkg.name !== EXPECTED_NAME) {
    stop(`STOP — unexpected package name: ${pkg.name}`);
  }
  if (pkg.license !== EXPECTED_LICENSE) {
    stop(`STOP — unexpected license: ${pkg.license}`);
  }
  if (pkg.publishConfig?.registry !== EXPECTED_REGISTRY) {
    stop("STOP — unexpected publishConfig.registry");
  }
  if (pkg.publishConfig?.access !== EXPECTED_ACCESS) {
    stop("STOP — unexpected publishConfig.access");
  }

  const version = String(inputVersion ?? "");
  const conf = String(confirmation ?? "");
  if (!version || pkg.version !== version) {
    stop(
      `STOP — RELEASE INPUT MISMATCH: input version ${JSON.stringify(version)} != package.json ${JSON.stringify(pkg.version)}`
    );
  }
  const expected = expectedConfirmation(version);
  if (conf !== expected) {
    stop(
      `STOP — RELEASE INPUT MISMATCH: confirmation must be exactly ${JSON.stringify(expected)}`
    );
  }

  if (
    HISTORICAL_VERSIONS.includes(pkg.version) ||
    HISTORICAL_VERSIONS.includes(version)
  ) {
    stop(
      `STOP — HISTORICAL VERSION MUST NEVER BE REPUBLISHED: ${pkg.version}`
    );
  }

  return { name: pkg.name, version: pkg.version };
}

/**
 * Fail-closed shape checks for npm `versions` JSON.
 * @param {unknown} versionsParsed
 */
export function assertVersionsListShape(versionsParsed) {
  if (!Array.isArray(versionsParsed)) {
    stop("STOP — registry versions response is not a JSON array");
  }
  if (versionsParsed.length === 0) {
    stop("STOP — registry versions list is empty");
  }
  if (!versionsParsed.every((v) => typeof v === "string")) {
    stop("STOP — registry versions list contains non-string entries");
  }
  if (!versionsParsed.includes(ANCHOR_PUBLISHED_VERSION)) {
    stop(
      `STOP — registry versions list missing anchor ${ANCHOR_PUBLISHED_VERSION}`
    );
  }
}

/**
 * Fail-closed registry eligibility using a successful versions list.
 * @param {unknown} versionsParsed — already-parsed JSON from npm view
 * @param {string} candidateVersion
 */
export function assertRegistryEligible(versionsParsed, candidateVersion) {
  assertVersionsListShape(versionsParsed);
  if (versionsParsed.includes(candidateVersion)) {
    stop(
      `STOP — VERSION ALREADY EXISTS: ${EXPECTED_NAME}@${candidateVersion}`
    );
  }
}

/**
 * Run `npm view <name> versions --json` and parse. Fail-closed on any anomaly.
 * @param {{ execFileSync?: typeof execFileSync }} [deps]
 * @returns {string[]}
 */
export function fetchPublishedVersions(deps = {}) {
  const exec = deps.execFileSync ?? execFileSync;
  let stdout;
  try {
    stdout = exec(
      "npm",
      [
        "view",
        EXPECTED_NAME,
        "versions",
        "--json",
        `--registry=${EXPECTED_REGISTRY}`,
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 10 * 1024 * 1024,
      }
    );
  } catch (err) {
    const stderr = String(err?.stderr || err?.message || err);
    stop(
      `STOP — npm view versions failed (fail-closed): ${stderr.trim() || "unknown error"}`
    );
  }

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

  assertVersionsListShape(parsed);
  return parsed;
}

/**
 * Full guard: identity/inputs + live (or injected) versions list.
 */
export function validatePublicCoreRelease(options) {
  const identity = validateIdentityAndInputs(options);
  let versions = options.versionsList;
  if (versions === undefined) {
    versions = fetchPublishedVersions({ execFileSync: options.execFileSync });
  } else {
    assertVersionsListShape(versions);
  }
  assertRegistryEligible(versions, identity.version);
  return { ...identity, versionsCount: versions.length };
}

export function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

/**
 * Pack once into release-artifact/, write digest.json.
 * Assumes verify/build already ran so dist is present.
 */
export function packReleaseArtifact({
  root = process.cwd(),
  version,
  execFileSync: exec = execFileSync,
} = {}) {
  const outDir = join(root, "release-artifact");
  mkdirSync(outDir, { recursive: true });

  exec("npm", ["pack", "-w", EXPECTED_NAME, "--pack-destination", outDir], {
    cwd: root,
    stdio: "inherit",
  });

  const expectedName = tarballFilenameFor(version);
  const tarballPath = join(outDir, expectedName);
  let st;
  try {
    st = statSync(tarballPath);
  } catch {
    stop(`STOP — expected packed tarball missing: ${expectedName}`);
  }
  if (!st.isFile() || st.size <= 0) {
    stop(`STOP — packed tarball invalid: ${expectedName}`);
  }

  const digest = {
    name: EXPECTED_NAME,
    version,
    filename: expectedName,
    sha256: sha256File(tarballPath),
    size: st.size,
  };
  writeFileSync(join(outDir, "digest.json"), `${JSON.stringify(digest, null, 2)}\n`);
  return digest;
}

export function verifyReleaseArtifact({
  artifactDir,
  expectedVersion,
  expectedName = EXPECTED_NAME,
}) {
  const digestPath = join(artifactDir, "digest.json");
  let digest;
  try {
    digest = JSON.parse(readFileSync(digestPath, "utf8"));
  } catch {
    stop("STOP — digest.json missing or invalid JSON");
  }
  if (digest.name !== expectedName) {
    stop(`STOP — digest name mismatch: ${digest.name}`);
  }
  if (digest.version !== expectedVersion) {
    stop(
      `STOP — digest version mismatch: ${digest.version} != ${expectedVersion}`
    );
  }
  if (digest.filename !== tarballFilenameFor(expectedVersion)) {
    stop(`STOP — digest filename unexpected: ${digest.filename}`);
  }
  const tarballPath = join(artifactDir, digest.filename);
  let st;
  try {
    st = statSync(tarballPath);
  } catch {
    stop(`STOP — artifact tarball missing: ${digest.filename}`);
  }
  if (st.size !== digest.size) {
    stop(`STOP — artifact size mismatch: ${st.size} != ${digest.size}`);
  }
  const actual = sha256File(tarballPath);
  if (actual !== digest.sha256) {
    stop(`STOP — artifact SHA-256 mismatch: ${actual} != ${digest.sha256}`);
  }
  return { digest, tarballPath: resolve(tarballPath) };
}

export function loadPackageJson(root = process.cwd()) {
  return JSON.parse(
    readFileSync(join(root, "packages/core/package.json"), "utf8")
  );
}

function main(argv) {
  const cmd = argv[2] ?? "validate";
  const root = process.cwd();
  const pkg = loadPackageJson(root);
  const env = {
    pkg,
    inputVersion: process.env.INPUT_VERSION,
    confirmation: process.env.INPUT_CONFIRMATION,
    githubRef: process.env.GITHUB_REF,
    githubRepository: process.env.GITHUB_REPOSITORY,
  };

  if (cmd === "validate") {
    const result = validatePublicCoreRelease(env);
    console.log(
      "Release guards OK:",
      `${result.name}@${result.version}`,
      `(registry versions=${result.versionsCount})`
    );
    return;
  }

  if (cmd === "pack") {
    validatePublicCoreRelease(env);
    const digest = packReleaseArtifact({ root, version: pkg.version });
    console.log("Packed release artifact:", digest);
    return;
  }

  if (cmd === "verify-artifact") {
    const artifactDir = argv[3] ?? join(root, "release-artifact");
    validatePublicCoreRelease(env);
    const { digest, tarballPath } = verifyReleaseArtifact({
      artifactDir,
      expectedVersion: pkg.version,
    });
    console.log("Artifact verified:", digest.filename, digest.sha256);
    console.log(`TARBALL_PATH=${tarballPath}`);
    return;
  }

  stop(`STOP — unknown command: ${cmd}`);
}

const invokedAsCli =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedAsCli) {
  try {
    main(process.argv);
  } catch (err) {
    if (err instanceof ReleaseGuardError) {
      console.error(err.message);
      process.exit(1);
    }
    console.error(err);
    process.exit(1);
  }
}
