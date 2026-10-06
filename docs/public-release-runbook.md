# Owner runbook: 0.2.0 existing-package updates

The 0.2.0 update is complete: all five packages are published and verified in the
[release record](release-0.2.md). **Do not dispatch another 0.2.0 publication.**
The steps below document the existing workflow and approval gates for future
owner-authorized updates, using new immutable versions. This file itself does
not authorize publish, push, merge, tag, Release, deployment or account changes.
The prior first-publication runbook remains in Git history at main f46cf9c.

## Completed 0.2.0 identities and order

Registry checked 2026-10-06: all five exact 0.2.0 versions exist, with verified
artifact bytes and provenance. Version absence was checked before publication.

| Released package | Required exact npm release | Workflow / confirmation used |
| --- | --- | --- |
| editor-core 0.2.0 | known core 0.1.0 anchor; no runtime dependencies | publish-public-core.yml / PUBLISH @hello-ai-company/editor-core@0.2.0 |
| editor-blocknote 0.2.0 | core 0.2.0 | publish-public-blocknote.yml / PUBLISH @hello-ai-company/editor-blocknote@0.2.0 |
| editor-ai 0.2.0 | core 0.2.0 | publish-public-ai.yml / PUBLISH @hello-ai-company/editor-ai@0.2.0 |
| editor-canvas 0.2.0 | core 0.2.0 | publish-public-canvas.yml / PUBLISH @hello-ai-company/editor-canvas@0.2.0 |
| editor-publish 0.2.0 | core and Canvas 0.2.0; matching docx | publish-public-publish.yml / PUBLISH @hello-ai-company/editor-publish@0.2.0 |

Publish core first; BlockNote, AI and Canvas may follow; Publish follows verified
Canvas. All packages retain MIT, public npmjs, Node >=20 and ESM. Existing versions
are immutable. Do not run the historical interactive first-publication bootstrap
for these already existing package objects.

## Local preparation evidence

Use npm run typecheck, npm test, npm run build and the example build, pack the five
packages with --ignore-scripts, inspect exact files and declarations and run
npm publish <candidate.tgz> --dry-run --ignore-scripts --access public
--registry=https://registry.npmjs.org. This dry run is not publication. Preserve
SHA-256, npm integrity, inventory and test logs outside committed packages.

npm run verify:isolated-blocknote explicitly selects --candidate-core and installs
local candidate tarballs. Direct node scripts/isolated-blocknote-consumer.mjs
without that option still requires live registry core 0.2.0 and fails closed if
absent. npm run verify:public-packages likewise installs candidate core/Canvas and
package tarballs. This avoids a core-release preflight self-dependency; it never
weakens live dependency validation at the actual workflow release boundary.

## Gates for future owner-authorized updates

1. Review the exact final diff and approve any push/PR/merge separately. This
   preparation branch must become release main. Obtain hosted CI and preflight success
   on the resulting main SHA before any dispatch.
2. Confirm the existing npm Trusted Publisher for each exact workflow filename,
   repository hello-ai-company/open-editor and Environment public-npmjs, including
   the intended human reviewers and allowed publish action. No token fallback or
   new permission is part of preparation. Stop if those existing bindings cannot
   be confirmed.
3. Separately approve publication of the exact versions, content and reviewed
   main SHA. Dispatch the matching main-only workflow with reviewed_commit equal
   to that SHA, the new unpublished version and its exact confirmation (the table
   above records completed 0.2.0 inputs, not reusable publish commands). The prepare job
   packs and verifies a new SHA-bound artifact from main; local draft artifacts
   are review evidence, not a substitute for that official artifact.
4. The publish job rechecks exact SHA, immutable version absence, live dependency
   versions and inspected artifact SHA-256 before publishing the downloaded
   artifact without rebuilding. Only that job receives OIDC. Preserve npm's
   post-publish exact name/version/MIT/tarball URL/SHA-512 proof.
5. If publish succeeds but verification fails, investigate the registry before
   rerunning: the version may already exist. Never republish an immutable version.
6. Upgrade Personal-AI's registry dependencies/lockfile in its own reviewed task,
   run its exact-package/save/owner/host tests and actual-model gates. Its main
   49c74b0 is not evidence of consuming OpenEditor 0.2.0. Tags,
   GitHub Releases and deployments each remain separately authorized operations.

Core now uses the same shared exact-SHA/inspected-artifact/post-publish path as the
other workflows. The older validate-public-core-release.mjs remains as historical
compatibility tooling, not this workflow's dispatch command. See migration-0.2.md
for validation limits and actual-model integration limitations.
