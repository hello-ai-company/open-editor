import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  packageConfig,
  RELEASE_REF,
  RELEASE_REGISTRY,
  RELEASE_REPO,
  tarballFilename,
  validatePackageManifest
} from "./public-package-config.mjs";

export class PublicPackageReleaseError extends Error {
  constructor(message) {
    super(message);
    this.name = "PublicPackageReleaseError";
  }
}

function stop(message) {
  throw new PublicPackageReleaseError(message);
}

export function expectedConfirmation(config) {
  return `PUBLISH ${config.name}@${config.version}`;
}

export function validateReleaseInputs({ key, pkg, inputVersion, confirmation, githubRef, githubRepository, reviewedCommit, githubSha, checkoutSha }) {
  const config = packageConfig(key);
  if (githubRepository !== RELEASE_REPO) stop(`STOP — unexpected repository: ${githubRepository}`);
  if (githubRef !== RELEASE_REF) stop(`STOP — workflow must run from ${RELEASE_REF}`);
  if (!/^[0-9a-f]{40}$/i.test(String(reviewedCommit ?? ""))) stop("STOP — reviewed_commit must be a full 40-character commit SHA");
  if (String(reviewedCommit).toLowerCase() !== String(githubSha ?? "").toLowerCase()) {
    stop("STOP — reviewed_commit does not match the workflow_dispatch commit");
  }
  if (String(reviewedCommit).toLowerCase() !== String(checkoutSha ?? "").toLowerCase()) {
    stop("STOP — checked-out commit does not match reviewed_commit");
  }
  try {
    validatePackageManifest(pkg, config);
  } catch (error) {
    stop(`STOP — ${error.message}`);
  }
  if (String(inputVersion ?? "") !== config.version) {
    stop(`STOP — version input must be exactly ${config.version}`);
  }
  if (String(confirmation ?? "") !== expectedConfirmation(config)) {
    stop(`STOP — confirmation must be exactly ${JSON.stringify(expectedConfirmation(config))}`);
  }
  return { ...config, sourceCommit: String(reviewedCommit).toLowerCase() };
}

function parseVersions(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? "").trim());
  } catch {
    stop("STOP — registry versions response is empty or invalid JSON");
  }
  const versions = typeof parsed === "string" ? [parsed] : parsed;
  if (!Array.isArray(versions) || versions.length === 0 || !versions.every((version) => typeof version === "string")) {
    stop("STOP — registry versions response must be a non-empty string array");
  }
  return versions;
}

export function fetchRegistryVersions(name, exec = execFileSync) {
  try {
    return parseVersions(exec("npm", ["view", name, "versions", "--json", `--registry=${RELEASE_REGISTRY}`, "--prefer-online"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024
    }));
  } catch (error) {
    if (error instanceof PublicPackageReleaseError) throw error;
    const output = `${String(error?.stdout ?? "")}\n${String(error?.stderr ?? error?.message ?? error)}`;
    if (/\b(?:npm (?:error )?code )?E404\b/i.test(output)) return null;
    stop(`STOP — npm view ${name} failed (fail-closed): ${output.trim() || "unknown error"}`);
  }
}

function satisfiesCaret(version, range) {
  if (range.includes("||")) return range.split("||").some((part) => satisfiesCaret(version, part.trim()));
  const match = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(range);
  const versionMatch = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match || !versionMatch) return false;
  const [major, minor, patch] = match.slice(1).map(Number);
  const [actualMajor, actualMinor, actualPatch] = versionMatch.slice(1).map(Number);
  if (actualMajor !== major) return false;
  if (major > 0) return actualMinor > minor || (actualMinor === minor && actualPatch >= patch);
  if (minor > 0) return actualMinor === minor && actualPatch >= patch;
  return actualMinor === 0 && actualPatch === patch;
}

export function validateRegistryState(config, { exec = execFileSync, requirePackageAbsent = false } = {}) {
  const candidateVersions = fetchRegistryVersions(config.name, exec);
  if (config.publishedAnchor && !candidateVersions?.includes(config.publishedAnchor)) {
    stop(`STOP — existing package ${config.name} requires published anchor ${config.publishedAnchor}`);
  }
  if (requirePackageAbsent && candidateVersions !== null) {
    stop(`STOP — first publication requires a new npm package, but ${config.name} already exists`);
  }
  if (candidateVersions?.includes(config.version)) {
    stop(`STOP — immutable version already exists: ${config.name}@${config.version}`);
  }

  const expectedDependencies = {
    ...config.dependencies,
    ...config.peerDependencies
  };
  for (const [name, range] of Object.entries(expectedDependencies)) {
    const versions = fetchRegistryVersions(name, exec);
    if (!versions) stop(`STOP — required dependency ${name} is not published on npmjs`);
    const exactVersion = config.exactRegistryDependencies?.[name];
    if (exactVersion) {
      if (!versions.includes(exactVersion)) stop(`STOP — required ${name}@${exactVersion} is not published on npmjs`);
      continue;
    }
    if (!versions.some((version) => satisfiesCaret(version, range))) {
      stop(`STOP — no published ${name} version satisfies ${range}`);
    }
  }
  return { candidatePublished: false, dependencyNames: Object.keys(expectedDependencies) };
}

export function validatePublicPackageRelease(options) {
  const identity = validateReleaseInputs(options);
  const registry = validateRegistryState(identity, { exec: options.execFileSync });
  return { ...identity, registry };
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function packReleaseArtifact({ root = process.cwd(), key, sourceCommit, exec = execFileSync }) {
  const config = packageConfig(key);
  const outDir = join(root, `release-artifact-${key}`);
  mkdirSync(outDir, { recursive: true });
  exec("npm", ["pack", "-w", config.name, "--pack-destination", outDir, "--ignore-scripts"], {
    cwd: root,
    stdio: "inherit"
  });
  const filename = tarballFilename(config);
  const tarballPath = join(outDir, filename);
  let stat;
  try {
    stat = statSync(tarballPath);
  } catch {
    stop(`STOP — expected tarball missing: ${filename}`);
  }
  if (!stat.isFile() || stat.size <= 0) stop(`STOP — packed tarball invalid: ${filename}`);
  exec(process.execPath, [join(root, "scripts/inspect-public-tarballs.mjs"), key, tarballPath], {
    cwd: root,
    stdio: "inherit"
  });
  const digest = {
    name: config.name,
    version: config.version,
    sourceCommit,
    filename,
    size: stat.size,
    sha256: sha256File(tarballPath)
  };
  writeFileSync(join(outDir, "digest.json"), `${JSON.stringify(digest, null, 2)}\n`);
  return digest;
}

export function verifyReleaseArtifact({ artifactDir, key, sourceCommit }) {
  const config = packageConfig(key);
  let digest;
  try {
    digest = JSON.parse(readFileSync(join(artifactDir, "digest.json"), "utf8"));
  } catch {
    stop("STOP — digest.json missing or invalid");
  }
  if (digest.name !== config.name || digest.version !== config.version || digest.filename !== tarballFilename(config)) {
    stop("STOP — release artifact identity mismatch");
  }
  if (digest.sourceCommit !== sourceCommit) stop("STOP — release artifact commit mismatch");
  const artifactEntries = readdirSync(artifactDir).sort();
  if (artifactEntries.length !== 2 || artifactEntries[0] !== "digest.json" || artifactEntries[1] !== digest.filename) {
    stop("STOP — release artifact contains unexpected files");
  }
  const tarballPath = join(artifactDir, digest.filename);
  let tarballEntry;
  let stat;
  try {
    tarballEntry = lstatSync(tarballPath);
  } catch {
    stop(`STOP — release tarball missing: ${digest.filename}`);
  }
  if (!tarballEntry.isFile() || tarballEntry.isSymbolicLink()) stop(`STOP — release tarball is not a regular file: ${digest.filename}`);
  stat = statSync(tarballPath);
  if (stat.size !== digest.size || sha256File(tarballPath) !== digest.sha256) {
    stop("STOP — release artifact size or SHA-256 mismatch");
  }
  return { digest, tarballPath: resolve(tarballPath) };
}

function readPackage(key, root) {
  const config = packageConfig(key);
  try {
    return JSON.parse(readFileSync(join(root, config.directory, "package.json"), "utf8"));
  } catch {
    stop(`STOP — cannot read ${config.directory}/package.json`);
  }
}

function main(argv) {
  const [key, command = "validate", artifactDir = ""] = argv.slice(2);
  const root = process.cwd();
  const pkg = readPackage(key, root);
  const input = {
    key,
    pkg,
    inputVersion: process.env.INPUT_VERSION,
    confirmation: process.env.INPUT_CONFIRMATION,
    githubRef: process.env.RELEASE_WORKFLOW_REF,
    githubRepository: process.env.RELEASE_WORKFLOW_REPOSITORY,
    reviewedCommit: process.env.INPUT_REVIEWED_COMMIT,
    githubSha: process.env.RELEASE_WORKFLOW_SHA,
    checkoutSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
  };
  if (command === "validate") {
    const result = validatePublicPackageRelease(input);
    console.log(`Release guards OK: ${result.name}@${result.version} at ${result.sourceCommit}`);
    return;
  }
  if (command === "pack") {
    const result = validatePublicPackageRelease(input);
    console.log("Packed release artifact:", packReleaseArtifact({ root, key, sourceCommit: result.sourceCommit }));
    return;
  }
  if (command === "verify-artifact") {
    const identity = validateReleaseInputs(input);
    const verified = verifyReleaseArtifact({ artifactDir: artifactDir || join(root, `release-artifact-${key}`), key, sourceCommit: identity.sourceCommit });
    execFileSync(process.execPath, [join(root, "scripts/inspect-public-tarballs.mjs"), key, verified.tarballPath], { cwd: root, stdio: "inherit" });
    validateRegistryState(identity);
    console.log(`TARBALL_PATH=${verified.tarballPath}`);
    return;
  }
  stop(`STOP — unknown command: ${command}`);
}

const invokedAsCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsCli) {
  try {
    main(process.argv);
  } catch (error) {
    console.error(error instanceof PublicPackageReleaseError ? error.message : error);
    process.exit(1);
  }
}
