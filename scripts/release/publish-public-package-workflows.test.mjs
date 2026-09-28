import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const cases = [
  ["ai", "@hello-ai-company/editor-ai"],
  ["canvas", "@hello-ai-company/editor-canvas"],
  ["publish", "@hello-ai-company/editor-publish"]
];

for (const [key, name] of cases) {
  describe(`publish-public-${key}.yml`, () => {
    const yaml = readFileSync(join(root, `.github/workflows/publish-public-${key}.yml`), "utf8");
    const active = yaml.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");
    const publishJob = yaml.slice(yaml.indexOf("\n  publish:"));
    const publishActive = publishJob.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");

    it("is workflow_dispatch only and pins main plus the exact reviewed SHA", () => {
      assert.match(yaml, /^\s*workflow_dispatch:\s*$/m);
      assert.doesNotMatch(yaml, /^\s*(?:push|pull_request|release|schedule):\s*$/m);
      assert.match(yaml, /reviewed_commit:/);
      assert.match(yaml, /github\.ref == 'refs\/heads\/main' && inputs\.reviewed_commit == github\.sha/);
      assert.match(yaml, /ref: \$\{\{ inputs\.reviewed_commit \}\}/);
      assert.match(yaml, /RELEASE_WORKFLOW_SHA: \$\{\{ github\.sha \}\}/);
    });

    it("requires exact package confirmation, version, and owner OIDC environment", () => {
      assert.match(yaml, new RegExp(`PUBLISH ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}@0\\.1\\.0`));
      assert.match(yaml, /environment: public-npmjs/);
      assert.match(publishJob, /id-token:\s*write/);
      assert.match(publishJob, /--registry=https:\/\/registry\.npmjs\.org/);
      assert.match(publishJob, /--access public/);
    });

    it("prepares an immutable inspected artifact without publish credentials", () => {
      assert.match(yaml, /npm run verify/);
      assert.match(yaml, /npm ci --ignore-scripts/);
      assert.match(yaml, /validate-public-package-release\.mjs/);
      assert.match(yaml, /--ignore-scripts/);
      assert.match(yaml, /upload-artifact/);
      assert.match(yaml, /download-artifact/);
      assert.match(yaml, /verify-artifact/);
      const prepareJob = yaml.slice(yaml.indexOf("  prepare:"), yaml.indexOf("\n  publish:"));
      assert.doesNotMatch(prepareJob, /id-token:/);
      assert.match(prepareJob, /npm_config_ignore_scripts:\s*true/);
    });

    it("rechecks registry and artifact before publishing only the verified tarball", () => {
      assert.match(publishJob, /TOCTOU registry \/ commit \/ artifact recheck/);
      assert.match(publishJob, /npm publish "\$\{\{ steps\.artifact\.outputs\.tarball \}\}"/);
      assert.doesNotMatch(publishActive, /npm ci|npm run verify|npm run build|npm pack/);
      assert.match(publishJob, new RegExp(`verify-public-package-published\\.mjs ${key} `));
    });

    it("has no token secrets and cannot auto-cancel another release", () => {
      assert.doesNotMatch(active, /NPM_TOKEN|NODE_AUTH_TOKEN|secrets\./);
      assert.match(yaml, /cancel-in-progress:\s*false/);
    });

    it("pins every action and the npm OIDC CLI artifact", () => {
      assert.doesNotMatch(active, /uses:\s*[^\s@]+@v\d/);
      assert.match(active, /uses:\s*actions\/checkout@[0-9a-f]{40}/);
      assert.match(active, /uses:\s*actions\/setup-node@[0-9a-f]{40}/);
      assert.match(active, /uses:\s*actions\/upload-artifact@[0-9a-f]{40}/);
      assert.match(active, /uses:\s*actions\/download-artifact@[0-9a-f]{40}/);
      assert.match(active, /npm-11\.20\.0\.tgz/);
      assert.match(active, /dF3EDFwbYN\+N5RUip\+ZYDe0NeURK5BgqKOcvT1iNtUYhTMTl0FwWhBuXrS7KtXyduqyTMS5aaQaregnHDAxNgw==/);
      assert.doesNotMatch(active, /npm@\^|npm@latest/);
    });
  });
}
