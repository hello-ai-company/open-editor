#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readTarballFile } from "../lib/tarball.mjs";
import { packageConfig, RELEASE_REGISTRY, tarballFilename } from "./public-package-config.mjs";

const BLOCKNOTE = Object.freeze({
  name: "@hello-ai-company/editor-blocknote",
  version: "0.1.1",
  filename: "hello-ai-company-editor-blocknote-0.1.1.tgz"
});
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];

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

export async function verifyPublishedPackage({ key, tarballPath, fetchImpl = fetch, sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms)), retryDelays = RETRY_DELAYS }) {
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

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(versionUrl, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(15000)
      });
    } catch (error) {
      lastReason = error?.name === "TimeoutError" ? "registry request timed out" : "registry request failed";
    }

    if (response?.ok) {
      let metadata;
      try {
        metadata = await response.json();
      } catch {
        throw new Error("npm registry returned malformed package JSON");
      }
      if (metadata?.name !== identity.name || metadata?.version !== identity.version || metadata?.license !== "MIT") {
        throw new Error("npm registry package identity or MIT license mismatch");
      }
      if (metadata?.dist?.tarball !== tarballUrl) throw new Error("npm registry tarball URL mismatch");
      if (typeof metadata?.dist?.integrity !== "string") {
        lastReason = "npm registry integrity metadata is not available yet";
      } else if (metadata.dist.integrity !== integrity) {
        throw new Error("npm registry integrity does not match the published tarball");
      } else {
        return { ...identity, tarballUrl, integrity, attempts: attempt + 1 };
      }
    } else if (response) {
      if (response.status === 404 || response.status === 429 || response.status >= 500) {
        lastReason = `npm registry returned HTTP ${response.status}`;
      } else {
        throw new Error(`npm registry verification failed with HTTP ${response.status}`);
      }
    }

    if (attempt < retryDelays.length) await sleep(retryDelays[attempt]);
  }
  throw new Error(`npm registry did not prove ${identity.name}@${identity.version}: ${lastReason}`);
}

async function main(argv) {
  const [, , key, tarballPath] = argv;
  if (!key || !tarballPath) throw new Error("Usage: node scripts/release/verify-public-package-published.mjs <blocknote|ai|canvas|publish> <verified-tarball>");
  const result = await verifyPublishedPackage({ key, tarballPath });
  console.log(`Published registry proof passed: ${result.name}@${result.version} (${result.integrity}; attempts=${result.attempts})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
