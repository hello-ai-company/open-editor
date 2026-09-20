/**
 * Workflow regression tests for publish-public-blocknote.yml.
 * Structural / security locks only — does not dispatch or publish.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const workflowPath = join(
  root,
  ".github/workflows/publish-public-blocknote.yml"
);
const yaml = readFileSync(workflowPath, "utf8");

describe("publish-public-blocknote.yml regression", () => {
  it("filename and workflow name are locked for Trusted Publisher binding", () => {
    assert.match(yaml, /^name:\s*publish-public-blocknote\s*$/m);
    assert.ok(
      workflowPath.endsWith("publish-public-blocknote.yml"),
      "workflow filename must remain publish-public-blocknote.yml"
    );
  });

  it("is workflow_dispatch only (no push/PR/release/schedule)", () => {
    assert.match(yaml, /^\s*workflow_dispatch:\s*$/m);
    assert.doesNotMatch(yaml, /^\s*push:\s*$/m);
    assert.doesNotMatch(yaml, /^\s*pull_request:\s*$/m);
    assert.doesNotMatch(yaml, /^\s*release:\s*$/m);
    assert.doesNotMatch(yaml, /^\s*schedule:\s*$/m);
  });

  it("requires exact confirmation input for 0.1.0", () => {
    assert.match(
      yaml,
      /PUBLISH @hello-ai-company\/editor-blocknote@0\.1\.0/
    );
  });

  it("concurrency group is locked and never auto-cancels", () => {
    assert.match(yaml, /group:\s*npm-public-blocknote-publish/);
    assert.match(yaml, /cancel-in-progress:\s*false/);
  });

  it("main-ref lock on prepare and publish jobs", () => {
    const prepareBlock = yaml.slice(
      yaml.indexOf("prepare:"),
      yaml.indexOf("publish:")
    );
    const publishBlock = yaml.slice(yaml.indexOf("\n  publish:"));
    assert.match(prepareBlock, /if:\s*github\.ref == 'refs\/heads\/main'/);
    assert.match(publishBlock, /if:\s*github\.ref == 'refs\/heads\/main'/);
  });

  it("permissions: prepare has no id-token; publish has id-token:write", () => {
    const prepareBlock = yaml.slice(
      yaml.indexOf("prepare:"),
      yaml.indexOf("\n  publish:")
    );
    const publishBlock = yaml.slice(yaml.indexOf("\n  publish:"));
    assert.match(prepareBlock, /contents:\s*read/);
    assert.doesNotMatch(prepareBlock, /id-token:/);
    assert.match(publishBlock, /contents:\s*read/);
    assert.match(publishBlock, /id-token:\s*write/);
  });

  it("publish job uses existing Environment public-npmjs only", () => {
    assert.match(yaml, /environment:\s*public-npmjs/);
    assert.doesNotMatch(yaml, /environment:\s*(?!public-npmjs)\S+/);
  });

  it("uses Node 24 and npm >= 11.5.1 gate", () => {
    assert.match(yaml, /node-version:\s*24/);
    assert.match(yaml, /npm >= 11\.5\.1/);
    assert.match(yaml, /npm install -g npm@\^11/);
  });

  it("prepare runs verify, release-guards, isolated-blocknote, then pack", () => {
    assert.match(yaml, /npm run verify/);
    assert.match(yaml, /npm run test:release-guards/);
    assert.match(yaml, /npm run verify:isolated-blocknote/);
    assert.match(
      yaml,
      /validate-public-blocknote-release\.mjs pack/
    );
  });

  it("immutable artifact model: upload then download + verify-artifact", () => {
    assert.match(yaml, /public-blocknote-release-artifact/);
    assert.match(yaml, /release-artifact-blocknote/);
    assert.match(
      yaml,
      /validate-public-blocknote-release\.mjs verify-artifact/
    );
  });

  it("publish does not npm ci / rebuild / repack", () => {
    const publishBlock = yaml.slice(yaml.indexOf("\n  publish:"));
    // Ignore comment lines when checking for forbidden prepare-job steps.
    const stepsOnly = publishBlock
      .split("\n")
      .filter((line) => !/^\s*#/.test(line))
      .join("\n");
    assert.doesNotMatch(stepsOnly, /^\s+run:\s*npm ci\s*$/m);
    assert.doesNotMatch(stepsOnly, /npm run verify/);
    assert.doesNotMatch(stepsOnly, /npm run build/);
    assert.doesNotMatch(stepsOnly, /validate-public-blocknote-release\.mjs pack/);
  });

  it("publishes prepared tarball with --ignore-scripts and public registry", () => {
    assert.match(yaml, /npm publish "\$\{\{ steps\.artifact\.outputs\.tarball \}\}"/);
    assert.match(yaml, /--access public/);
    assert.match(yaml, /--registry=https:\/\/registry\.npmjs\.org/);
    assert.match(yaml, /--ignore-scripts/);
  });

  it("documents TRUSTED PUBLISHER: OWNER CONFIGURATION REQUIRED", () => {
    assert.match(yaml, /TRUSTED PUBLISHER: OWNER CONFIGURATION REQUIRED/);
  });

  it("never wires NPM_TOKEN or NODE_AUTH_TOKEN", () => {
    // Forbid secret wiring in active YAML; comments may mention the ban.
    const active = yaml
      .split("\n")
      .filter((line) => !/^\s*#/.test(line))
      .join("\n");
    assert.doesNotMatch(active, /NPM_TOKEN/);
    assert.doesNotMatch(active, /NODE_AUTH_TOKEN/);
    assert.doesNotMatch(active, /secrets\./);
  });
});
