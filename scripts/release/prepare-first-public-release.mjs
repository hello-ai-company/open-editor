#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { packageConfig, tarballFilename, validatePackageManifest } from "./public-package-config.mjs";
import {
  packReleaseArtifact,
  PublicPackageReleaseError,
  validateRegistryState,
  verifyReleaseArtifact
} from "./validate-public-package-release.mjs";

const FIRST_RELEASE_KEYS = new Set(["ai", "canvas", "publish"]);
const SHA_PATTERN = /^[0-9a-f]{40}$/i;

function stop(message) {
  throw new PublicPackageReleaseError(message);
}

function requireFirstReleaseKey(key) {
  if (!FIRST_RELEASE_KEYS.has(key)) {
    stop("STOP — first-publication bootstrap accepts only ai, canvas, or publish");
  }
  return packageConfig(key);
}

function readCandidateManifest(root, key, config) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(root, config.directory, "package.json"), "utf8"));
    validatePackageManifest(pkg, config);
  } catch (error) {
    stop(`STOP — ${error.message}`);
  }
  return pkg;
}

function verifyMainCheckout(root, exec) {
  const options = { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] };
  const branch = exec("git", ["branch", "--show-current"], options).trim();
  if (branch !== "main") stop(`STOP — bootstrap requires branch main, got ${branch || "detached HEAD"}`);

  const status = exec("git", ["status", "--porcelain=v1", "--untracked-files=all"], options).trim();
  if (status) stop("STOP — working tree must be clean before first-publication preparation");

  exec("git", ["fetch", "--quiet", "origin", "refs/heads/main:refs/remotes/origin/main"], options);
  const sourceCommit = exec("git", ["rev-parse", "--verify", "HEAD"], options).trim().toLowerCase();
  const remoteMain = exec("git", ["rev-parse", "--verify", "refs/remotes/origin/main"], options).trim().toLowerCase();
  if (!SHA_PATTERN.test(sourceCommit) || !SHA_PATTERN.test(remoteMain)) {
    stop("STOP — local HEAD and origin/main must resolve to full commit SHAs");
  }
  if (sourceCommit !== remoteMain) stop("STOP — local main is stale or differs from origin/main");
  return sourceCommit;
}

function requireEmptyArtifactDirectory(root, key) {
  const artifactDir = join(root, `release-artifact-${key}`);
  try {
    lstatSync(artifactDir);
    stop(`STOP — remove the existing artifact directory before preparing again: ${artifactDir}`);
  } catch (error) {
    if (error instanceof PublicPackageReleaseError) throw error;
    if (error?.code !== "ENOENT") stop(`STOP — cannot inspect artifact directory: ${artifactDir}`);
  }
}

export function prepareFirstPublicRelease({ key, root = process.cwd(), exec = execFileSync } = {}) {
  const config = requireFirstReleaseKey(key);
  readCandidateManifest(root, key, config);
  const sourceCommit = verifyMainCheckout(root, exec);

  validateRegistryState(config, { exec, requirePackageAbsent: true });

  const env = { ...process.env, npm_config_ignore_scripts: "true" };
  exec("npm", ["ci", "--ignore-scripts"], { cwd: root, env, stdio: "inherit" });
  exec("npm", ["run", "verify"], { cwd: root, env, stdio: "inherit" });

  if (verifyMainCheckout(root, exec) !== sourceCommit) {
    stop("STOP — source SHA changed during verification");
  }
  validateRegistryState(config, { exec, requirePackageAbsent: true });
  requireEmptyArtifactDirectory(root, key);

  packReleaseArtifact({ root, key, sourceCommit, exec });
  const verified = verifyReleaseArtifact({ artifactDir: join(root, `release-artifact-${key}`), key, sourceCommit });
  if (verified.digest.filename !== tarballFilename(config)) stop("STOP — prepared tarball filename mismatch");

  const result = {
    sourceCommit,
    tarballPath: verified.tarballPath,
    sha256: verified.digest.sha256,
    name: config.name,
    version: config.version
  };
  console.log(`SOURCE_SHA=${result.sourceCommit}`);
  console.log(`TARBALL_PATH=${result.tarballPath}`);
  console.log(`TARBALL_SHA256=${result.sha256}`);
  console.log("STOP — preparation only; npm publish was not run.");
  return result;
}

function main(argv) {
  if (argv.length !== 3) stop("Usage: node scripts/release/prepare-first-public-release.mjs <ai|canvas|publish>");
  prepareFirstPublicRelease({ key: argv[2] });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main(process.argv);
  } catch (error) {
    console.error(error instanceof PublicPackageReleaseError ? error.message : error);
    process.exitCode = 1;
  }
}
