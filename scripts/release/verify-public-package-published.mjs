#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { readTarballFile } from "../lib/tarball.mjs";
import { packageConfig, RELEASE_REGISTRY, tarballFilename } from "./public-package-config.mjs";

const BLOCKNOTE = Object.freeze({
  name: "@hello-ai-company/editor-blocknote",
  version: "0.1.1",
  filename: "hello-ai-company-editor-blocknote-0.1.1.tgz"
});
const RETRY_DELAYS = Object.freeze([2000, 5000, 10000, 20000, 30000, 45000, 60000, 60000, 60000]);
const RETRY_BUDGET_MS = 300000;
const REQUEST_TIMEOUT_MS = 15000;

function isTransientRequestError(error) {
  return ["AbortError", "TimeoutError", "TypeError"].includes(error?.name);
}

function validateRetryPolicy(retryDelays, retryBudgetMs) {
  if (!Array.isArray(retryDelays) || retryDelays.some((delay) => !Number.isFinite(delay) || delay < 0)) {
    throw new Error("Registry retry delays must be a finite array of non-negative numbers");
  }
  if (!Number.isFinite(retryBudgetMs) || retryBudgetMs <= 0) {
    throw new Error("Registry retry budget must be a positive finite number");
  }
}

export function publishedIdentity(key) {
  if (key === "blocknote") return BLOCKNOTE;
  const config = packageConfig(key);
  return { name: config.name, version: config.version, filename: tarballFilename(config) };
}

export function registryVersionUrl(name, version) {
  return `${RELEASE_REGISTRY}/${encodeURIComponent(name)}/${version}`;
}

export function registryTarballUrl(name, version) {
  const unscoped = name.split("/")[1] ?? name;
  return `${RELEASE_REGISTRY}/${name}/-/${unscoped}-${version}.tgz`;
}

export async function verifyPublishedPackage({
  key,
  tarballPath,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms)),
  retryDelays = RETRY_DELAYS,
  retryBudgetMs = RETRY_BUDGET_MS,
  now = () => performance.now()
}) {
  validateRetryPolicy(retryDelays, retryBudgetMs);
  const identity = publishedIdentity(key);
  if (basename(tarballPath) !== identity.filename) throw new Error(`Unexpected tarball filename for ${identity.name}@${identity.version}`);
  const stat = lstatSync(tarballPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0) throw new Error("Published tarball must be a non-empty regular file");
  const packed = JSON.parse(readTarballFile(tarballPath, "package/package.json"));
  if (packed.name !== identity.name || packed.version !== identity.version || packed.license !== "MIT") {
    throw new Error("Prepared tarball identity or MIT license mismatch");
  }
  const license = readTarballFile(tarballPath, "package/LICENSE");
  if (!license.includes("MIT License")) throw new Error("Prepared tarball LICENSE is missing MIT text");
  const integrity = `sha512-${createHash("sha512").update(readFileSync(tarballPath)).digest("base64")}`;
  const versionUrl = registryVersionUrl(identity.name, identity.version);
  const tarballUrl = registryTarballUrl(identity.name, identity.version);
  let lastReason = "registry metadata not yet visible";
  let attempts = 0;
  let retryWaitMs = 0;
  const startedAt = now();
  const elapsedMs = () => Math.max(0, now() - startedAt);

  for (let retry = 0; retry <= retryDelays.length; retry += 1) {
    const remainingMs = retryBudgetMs - elapsedMs();
    if (remainingMs <= 0) break;
    attempts += 1;
    let response;
    try {
      response = await fetchImpl(versionUrl, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(Math.max(1, Math.min(REQUEST_TIMEOUT_MS, remainingMs)))
      });
    } catch (error) {
      if (!isTransientRequestError(error)) throw new Error("npm registry request failed unexpectedly");
      lastReason = error?.name === "TimeoutError" || error?.name === "AbortError"
        ? "registry request timed out"
        : "temporary registry network failure";
    }

    if (response && typeof response === "object" && response.ok === true) {
      let metadata;
      try {
        metadata = await response.json();
      } catch {
        throw new Error("npm registry returned malformed package JSON");
      }
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        throw new Error("npm registry returned malformed package metadata");
      }
      if (metadata?.name !== identity.name || metadata?.version !== identity.version || metadata?.license !== "MIT") {
        throw new Error("npm registry package identity or MIT license mismatch");
      }
      if (metadata?.dist?.tarball !== tarballUrl) throw new Error("npm registry tarball URL mismatch");
      if (metadata.dist.integrity === undefined || metadata.dist.integrity === null) {
        lastReason = "npm registry integrity metadata is not available yet";
      } else if (typeof metadata.dist.integrity !== "string" || metadata.dist.integrity.length === 0) {
        throw new Error("npm registry returned malformed integrity metadata");
      } else if (metadata.dist.integrity !== integrity) {
        throw new Error("npm registry integrity does not match the published tarball");
      } else {
        return { ...identity, tarballUrl, integrity, attempts, elapsedMs: Math.round(elapsedMs()), retryWaitMs };
      }
    } else if (response && typeof response === "object" && Number.isInteger(response.status)) {
      if (response.status === 404 || response.status === 408 || response.status === 429 || response.status >= 500) {
        lastReason = `npm registry returned HTTP ${response.status}`;
      } else {
        throw new Error(`npm registry verification failed with HTTP ${response.status}`);
      }
    } else if (response !== undefined) {
      throw new Error("npm registry returned malformed HTTP response");
    }

    if (retry < retryDelays.length) {
      const waitMs = Math.min(retryDelays[retry], Math.max(0, retryBudgetMs - elapsedMs()));
      if (waitMs <= 0) break;
      await sleep(waitMs);
      retryWaitMs += waitMs;
    }
  }
  const elapsed = Math.round(elapsedMs());
  const scheduledRetryWaitMs = retryDelays.reduce((total, delay) => total + delay, 0);
  throw new Error(
    `npm registry did not prove ${identity.name}@${identity.version} after ${attempts} attempts / ${elapsed}ms elapsed ` +
    `(retry budget ${retryBudgetMs}ms; scheduled retry wait ${scheduledRetryWaitMs}ms; actual retry wait ${retryWaitMs}ms); ` +
    `last observed failure: ${lastReason}`
  );
}

async function main(argv) {
  const [, , key, tarballPath] = argv;
  if (!key || !tarballPath) throw new Error("Usage: node scripts/release/verify-public-package-published.mjs <blocknote|ai|canvas|publish> <verified-tarball>");
  const result = await verifyPublishedPackage({ key, tarballPath });
  console.log(`Published registry proof passed: ${result.name}@${result.version} (${result.integrity}; attempts=${result.attempts}; elapsed=${result.elapsedMs}ms)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
