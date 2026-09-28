# Public package release runbook

Canonical owner procedure for the reviewed npm package candidates. This runbook does not authorize a release. Do not dispatch a publish workflow or run the interactive publish step without separate owner authorization.

## Release paths

`@hello-ai-company/editor-blocknote@0.1.1` is an update to an existing npm package because `editor-blocknote@0.1.0` is already live. Configure its Trusted Publisher before release, then publish 0.1.1 through `.github/workflows/publish-public-blocknote.yml` using GitHub Actions OIDC.

`editor-ai@0.1.0`, `editor-canvas@0.1.0`, and `editor-publish@0.1.0` are new npm packages. npm requires the package to exist before a Trusted Publisher can be configured, and staged publishing also requires an existing package. Their first publication therefore uses one interactive maintainer 2FA bootstrap; after registry verification, configure Trusted Publisher and use OIDC for future versions. See npm's [Trusted Publisher requirements](https://docs.npmjs.com/trusted-publishers/), [`npm trust` command](https://docs.npmjs.com/cli/v11/commands/npm-trust/), and [staged publishing requirements](https://docs.npmjs.com/staged-publishing/).

Do not add an npm token fallback to any workflow. The three OIDC workflows remain fail-closed. Once a candidate 0.1.0 has been bootstrapped, its immutable-version guard must reject another attempt to publish 0.1.0; bump and review a later candidate for workflow publication.

## Release order

1. `@hello-ai-company/editor-blocknote@0.1.1` — existing package; OIDC Trusted Publisher workflow.
2. `@hello-ai-company/editor-ai@0.1.0` — new package; one-time interactive 2FA bootstrap.
3. `@hello-ai-company/editor-canvas@0.1.0` — new package; one-time interactive 2FA bootstrap.
4. `@hello-ai-company/editor-publish@0.1.0` — new package; one-time interactive 2FA bootstrap, only after Canvas 0.1.0 is live and independently verified.

Core 0.1.1 is a required live dependency. Publish also requires exact Canvas 0.1.0 and a live `docx` version satisfying the package manifest. Registry ambiguity is a stop condition.

## Before any release

1. Review and merge the release tooling through its normal approval path. Do not use a PR-head SHA as the release SHA.
2. Wait for hosted `ci` and `public-release-preflight` to pass on the resulting `main` commit.
3. Record that exact full `main` SHA. For an OIDC workflow dispatch, select `main`, enter that SHA and the exact confirmation string, and pass the `public-npmjs` Environment review.
4. Check that the target package/version is still absent where required, and all release dependencies are live. Stop on any ambiguity or workflow failure.

Each OIDC workflow independently checks the full reviewed SHA, package name/version, exact confirmation, public npmjs registry, immutable version absence, dependency availability, lifecycle-script settings, tarball inventory and digest, and post-publish registry identity/integrity. The prepare job has no OIDC token; only the minimal publish job receives `id-token: write`. Do not bypass those workflow checks.

npm publication may become registry-visible asynchronously. The post-publish verifier permits a bounded multi-minute propagation window. If npm reports a successful publish but the verifier fails, query npm's registry and investigate before any rerun because the immutable version may already exist. Never blindly rerun a failed publish workflow; first query npm registry.

## BlockNote 0.1.1 — OIDC update

Because `@hello-ai-company/editor-blocknote@0.1.0` already exists, configure the package's npm Trusted Publisher before dispatch:

- GitHub organization: `hello-ai-company`
- Repository: `open-editor`
- Workflow filename: `publish-public-blocknote.yml`
- GitHub Environment: `public-npmjs`
- Allowed action: `npm publish`

Then, only after separate publication authorization and successful preflight, dispatch `.github/workflows/publish-public-blocknote.yml` from `main` with the recorded main SHA, version `0.1.1`, and confirmation `PUBLISH @hello-ai-company/editor-blocknote@0.1.1`. Require the workflow's post-publish verification to pass.

## New packages — one-time first publication

The local preparer accepts only `ai`, `canvas`, or `publish`. First synchronize local `main`; the preparer also fetches `origin/main` itself and rejects any SHA mismatch:

```sh
git switch main
git fetch origin
git pull --ff-only origin main
node scripts/release/prepare-first-public-release.mjs ai
```

Run only the command for the next package in the release order; use `canvas` after AI and `publish` after Canvas is verified live. The preparer runs `npm ci --ignore-scripts`, the full `npm run verify`, checks the exact reviewed package manifest and current main SHA, requires the entire target package object to be absent, verifies exact release dependencies on npmjs, rechecks those registry facts immediately before packing, packs the selected workspace once with lifecycle scripts disabled, runs the existing tarball inspector, records `release-artifact-<key>/digest.json`, and prints the source SHA, exact tarball path, and SHA-256. It stops there and never publishes. It refuses a dirty/stale/non-main checkout, an existing artifact directory, a package that already exists, a missing dependency, or an ambiguous registry response.

Review the printed SHA, tarball path, digest, and inspection result. For the first publication, authenticate interactively as a package maintainer and complete npm's requested 2FA; do not create or use a long-lived automation token. Publish only the exact printed tarball (replace the path with the exact output):

```sh
npm publish "<EXACT_TARBALL_PATH>" --access public --registry=https://registry.npmjs.org --ignore-scripts
```

Scoped public-package publishing and its 2FA requirements are documented by npm [here](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/). Do not substitute a directory, wildcard, rebuilt tarball, or another version. This manual command is an owner action and is never run by the preparer.

Immediately verify the published tarball against npm's registry metadata using the same exact local file:

```sh
node scripts/release/verify-public-package-published.mjs ai "<EXACT_TARBALL_PATH>"
```

Replace `ai` with `canvas` or `publish` as appropriate. The verifier has bounded retries and proves package name, version, MIT license, canonical `dist.tarball`, `dist.integrity`, and equality between registry integrity and the local tarball bytes. Stop if the verifier fails or cannot prove the result.

After a new package is verified live, configure its npm Settings → Trusted Publisher binding:

| Package | GitHub organization | Repository | Workflow filename | Environment | Allowed action |
| --- | --- | --- | --- | --- | --- |
| `@hello-ai-company/editor-ai` | `hello-ai-company` | `open-editor` | `publish-public-ai.yml` | `public-npmjs` | `npm publish` |
| `@hello-ai-company/editor-canvas` | `hello-ai-company` | `open-editor` | `publish-public-canvas.yml` | `public-npmjs` | `npm publish` |
| `@hello-ai-company/editor-publish` | `hello-ai-company` | `open-editor` | `publish-public-publish.yml` | `public-npmjs` | `npm publish` |

Then consider enabling npm Publishing Access → **Require two-factor authentication and disallow tokens** after confirming the Trusted Publisher works; see npm's [2FA publishing guidance](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/). All later releases use the package's OIDC workflow, never a token.

Do not bootstrap Publish until `editor-canvas@0.1.0` has passed the post-publish verifier. The preparer checks Canvas 0.1.0, Core 0.1.1, and `docx` before creating a Publish tarball.

## GitHub Environment approval

As of this correction review, the `public-npmjs` Environment permits self-review (`prevent_self_review=false`); independent approval is not currently enforced. Do not change repository governance as part of this release correction. A solo maintainer may need self-review to proceed. Where multiple maintainers are available, prefer Prevent self-review and an independent reviewer before release.

## Current registry snapshot

Read-only checks on 2026-09-28 found Core 0.1.1 and BlockNote 0.1.0 live; BlockNote 0.1.1 was subsequently published and independently confirmed live. AI 0.1.0, Canvas 0.1.0, and Publish 0.1.0 remain unpublished in that snapshot. Repeat registry checks immediately before any owner-authorized release.

## Personal-AI dependency

Personal-AI must use normal registry dependencies after the packages are released. Its install failure while these versions are unpublished is expected. Do not replace registry dependencies with file, GitHub, copied-source, alias, or temporary-package dependencies.
