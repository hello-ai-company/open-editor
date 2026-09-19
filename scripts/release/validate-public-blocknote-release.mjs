/**
 * Release guards for @hello-ai-company/editor-blocknote (first public 0.1.0).
 *
 * Unlike editor-core, this package is not yet on npmjs. Registry eligibility:
 * - Successful `npm view` that returns E404 / not found → eligible for first publish
 * - Successful versions array that already contains the candidate → STOP
 * - Any other npm view failure → STOP (fail-closed)
 *
 * Publish order (fail-closed): @hello-ai-company/editor-core meeting ^0.1.1
 * must already exist on npmjs before blocknote publish is allowed.
 *
 * Never infer eligibility from generic network errors alone without classifying 404.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertCoreFloorPublishedForBlocknote,
  fetchCorePublishedVersions
} from "../lib/core-registry-probe.mjs";

export const EXPECTED_REPO = "hello-ai-company/open-editor";
export const EXPECTED_NAME = "@hello-ai-company/editor-blocknote";
export const EXPECTED_LICENSE = "MIT";
export const EXPECTED_REGISTRY = "https://registry.npmjs.org";
export const EXPECTED_ACCESS = "public";
export const EXPECTED_REF = "refs/heads/main";
export const EXPECTED_CORE_DEP = "@hello-ai-company/editor-core";
/** Floor for blocknote → core; published 0.1.0 lacks APIs required by this package. */
export const EXPECTED_CORE_DEP_RANGE = "^0.1.1";
export const EXPECTED_PEER_BLOCKNOTE = "^0.54.2";

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
  return `PUBLISH @hello-ai-company/editor-blocknote@${version}`;
}

export function tarballFilenameFor(version) {
  return `hello-ai-company-editor-blocknote-${version}.tgz`;
}

export function validateIdentityAndInputs({
  pkg,
  inputVersion,
  confirmation,
  githubRef,
  githubRepository
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
  if (pkg.private === true) {
    stop("STOP — packages/blocknote must not set private:true");
  }
  if (pkg.publishConfig?.registry !== EXPECTED_REGISTRY) {
    stop("STOP — unexpected publishConfig.registry");
  }
  if (pkg.publishConfig?.access !== EXPECTED_ACCESS) {
    stop("STOP — unexpected publishConfig.access");
  }
  if (pkg.peerDependencies?.["@blocknote/core"] !== EXPECTED_PEER_BLOCKNOTE) {
    stop(
      `STOP — peer @blocknote/core must be ${EXPECTED_PEER_BLOCKNOTE}`
    );
  }
  if (pkg.peerDependencies?.["@blocknote/react"] !== EXPECTED_PEER_BLOCKNOTE) {
    stop(
      `STOP — peer @blocknote/react must be ${EXPECTED_PEER_BLOCKNOTE}`
    );
  }
  const depKeys = Object.keys(pkg.dependencies ?? {});
  if (depKeys.length !== 1 || depKeys[0] !== EXPECTED_CORE_DEP) {
    stop("STOP — dependencies must be exactly @hello-ai-company/editor-core");
  }
  if (pkg.dependencies?.[EXPECTED_CORE_DEP] !== EXPECTED_CORE_DEP_RANGE) {
    stop(
      `STOP — ${EXPECTED_CORE_DEP} must be ${EXPECTED_CORE_DEP_RANGE}`
    );
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

  return { name: pkg.name, version: pkg.version };
}

/**
 * @returns {{ status: "not_published" } | { status: "published"; versions: string[] }}
 */
export function fetchBlocknoteRegistryState(deps = {}) {
  const exec = deps.execFileSync ?? execFileSync;
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  try {
    stdout = exec(
      "npm",
      [
        "view",
        EXPECTED_NAME,
        "versions",
        "--json",
        `--registry=${EXPECTED_REGISTRY}`
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 10 * 1024 * 1024
      }
    );
  } catch (err) {
    exitCode = typeof err?.status === "number" ? err.status : 1;
    stderr = String(err?.stderr || err?.message || err);
    stdout = String(err?.stdout || "");
  }

  const combined = `${stdout}\n${stderr}`;
  const is404 =
    /E404|404 Not Found|not in this registry|No match found/i.test(combined) ||
    (exitCode !== 0 && /code E404/i.test(combined));

  if (exitCode !== 0) {
    if (is404) {
      return { status: "not_published" };
    }
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
  // npm may return a single string for one version
  const versions = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "string"
      ? [parsed]
      : null;
  if (!versions || !versions.every((v) => typeof v === "string")) {
    stop("STOP — registry versions response is not a string or string array");
  }
  if (versions.length === 0) {
    stop("STOP — registry versions list is empty");
  }
  return { status: "published", versions };
}

export function assertRegistryEligible(state, candidateVersion) {
  if (state.status === "not_published") {
    return;
  }
  if (state.versions.includes(candidateVersion)) {
    stop(
      `STOP — VERSION ALREADY EXISTS: ${EXPECTED_NAME}@${candidateVersion}`
    );
  }
}

/**
 * Fail-closed publish-order gate: core meeting ^0.1.1 must be on npmjs
 * before blocknote may publish (core@0.1.1 → then blocknote).
 * @param {{
 *   coreVersionsList?: string[],
 *   execFileSync?: typeof execFileSync
 * }} [options]
 * @returns {string[]} matching core versions
 */
export function assertCoreDependencyPublished(options = {}) {
  try {
    let versions = options.coreVersionsList;
    if (versions === undefined) {
      versions = fetchCorePublishedVersions({
        execFileSync: options.execFileSync
      });
    }
    return assertCoreFloorPublishedForBlocknote(
      versions,
      EXPECTED_CORE_DEP_RANGE
    );
  } catch (err) {
    // Surface probe failures as ReleaseGuardError for this module's API.
    if (err?.name === "CoreRegistryProbeError") {
      stop(err.message);
    }
    throw err;
  }
}

export function validatePublicBlocknoteRelease(options) {
  const identity = validateIdentityAndInputs(options);
  const coreMatching = assertCoreDependencyPublished({
    coreVersionsList: options.coreVersionsList,
    execFileSync: options.execFileSync
  });
  let state = options.registryState;
  if (state === undefined) {
    state = fetchBlocknoteRegistryState({
      execFileSync: options.execFileSync
    });
  }
  assertRegistryEligible(state, identity.version);
  return {
    ...identity,
    registryStatus: state.status,
    versionsCount: state.status === "published" ? state.versions.length : 0,
    coreFloorVersions: coreMatching
  };
}

export function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

export function packReleaseArtifact({
  root = process.cwd(),
  version,
  execFileSync: exec = execFileSync
} = {}) {
  const outDir = join(root, "release-artifact-blocknote");
  mkdirSync(outDir, { recursive: true });

  exec("npm", ["pack", "-w", EXPECTED_NAME, "--pack-destination", outDir], {
    cwd: root,
    stdio: "inherit"
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
    size: st.size
  };
  writeFileSync(
    join(outDir, "digest.json"),
    `${JSON.stringify(digest, null, 2)}\n`
  );
  return digest;
}

export function loadPackageJson(root = process.cwd()) {
  return JSON.parse(
    readFileSync(join(root, "packages/blocknote/package.json"), "utf8")
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
    githubRepository: process.env.GITHUB_REPOSITORY
  };

  if (cmd === "validate") {
    const result = validatePublicBlocknoteRelease(env);
    console.log(
      "BlockNote release guards OK:",
      `${result.name}@${result.version}`,
      `(registry=${result.registryStatus}, versions=${result.versionsCount}, ` +
        `coreFloor=${result.coreFloorVersions.join(",")})`
    );
    return;
  }

  if (cmd === "pack") {
    validatePublicBlocknoteRelease(env);
    const digest = packReleaseArtifact({ root, version: pkg.version });
    console.log("Packed blocknote release artifact:", digest);
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
