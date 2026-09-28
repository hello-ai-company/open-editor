# Public package release runbook

**Canonical owner procedure for the four reviewed package candidates.** This is documentation only. Do not run these steps as part of PR #25 review; publication and merge remain separately authorized actions.

## Current registry state

Read-only npmjs checks on 2026-09-28 found:

- Live: `@hello-ai-company/editor-core@0.1.1` and `@hello-ai-company/editor-blocknote@0.1.0`.
- Absent: `@hello-ai-company/editor-blocknote@0.1.1`, `@hello-ai-company/editor-ai@0.1.0`, `@hello-ai-company/editor-canvas@0.1.0`, and `@hello-ai-company/editor-publish@0.1.0`.
- No package was published by this task. Do not publish a candidate until the exact PR source has been reviewed and separately authorized.

Each candidate uses a manual `workflow_dispatch` workflow on `main`, requires the full reviewed commit SHA and exact confirmation, builds and packs in a no-OIDC prepare job, verifies the SHA-256-bound artifact in a minimal OIDC job, rechecks target absence and exact dependencies immediately before publish, publishes that tarball without lifecycle scripts, then verifies npm registry identity, license, tarball URL, and SHA-512 integrity with bounded retries. No npm token is used. Canvas and Publish remain unpublished until their own steps below complete.

## Owner sequence

1. **Merge reviewed OpenEditor PR #25.** Review the exact PR head and retain the merged result; do not infer that the PR head SHA will equal the eventual release SHA.
2. **Wait for hosted CI and public-release-preflight on `main`.** Require both Node 20 and Node 22 jobs to pass on the resulting main commit.
3. **Record the exact post-merge `main` SHA.** Use the SHA checked out by those successful main workflows. All later dispatches must use this full SHA as `reviewed_commit`, with branch set to `main`.
4. **Configure and verify the GitHub `public-npmjs` Environment.** Confirm required reviewers and permitted `main` ref. Keep the environment approval as a separate human gate.
5. **Configure npm Trusted Publisher for BlockNote.** Bind the package to repository `hello-ai-company/open-editor`, workflow filename `.github/workflows/publish-public-blocknote.yml`, and Environment `public-npmjs`. Verify direct `npm publish` is allowed. The repository cannot prove these account settings.
6. **Separately authorize and dispatch BlockNote 0.1.1.** Select `main`, supply `reviewed_commit=<recorded post-merge main SHA>`, `version=0.1.1`, and confirmation exactly `PUBLISH @hello-ai-company/editor-blocknote@0.1.1`.
7. **Verify BlockNote in npmjs.** Require the workflow’s post-publish proof to pass and independently confirm exact name, version, MIT license, canonical tarball URL, and matching integrity. Stop on any ambiguity.
8. **Configure and verify npm Trusted Publisher for AI.** Bind `@hello-ai-company/editor-ai` to `.github/workflows/publish-public-ai.yml` and Environment `public-npmjs`; verify direct `npm publish` is allowed.
9. **Separately authorize and dispatch AI 0.1.0.** Use the same recorded post-merge main SHA, `version=0.1.0`, and confirmation exactly `PUBLISH @hello-ai-company/editor-ai@0.1.0`.
10. **Verify AI in npmjs.** Require exact identity, MIT license, canonical tarball URL, and matching integrity.
11. **Configure and verify npm Trusted Publisher for Canvas.** Bind `@hello-ai-company/editor-canvas` to `.github/workflows/publish-public-canvas.yml` and Environment `public-npmjs`; verify direct `npm publish` is allowed. Confirm registry version `0.1.0` is absent and `editor-core@0.1.1` is live.
12. **Separately authorize and dispatch Canvas 0.1.0.** Use the recorded post-merge main SHA, `version=0.1.0`, and confirmation exactly `PUBLISH @hello-ai-company/editor-canvas@0.1.0`.
13. **Configure/verify Publish Trusted Publisher, then authorize and dispatch Publish 0.1.0.** Bind `@hello-ai-company/editor-publish` to `.github/workflows/publish-public-publish.yml` and Environment `public-npmjs`; verify direct `npm publish` is allowed. Before dispatch, require exact `editor-canvas@0.1.0`, `editor-core@0.1.1`, and `docx` release-compatible dependency availability. Select `main`, use the recorded post-merge SHA, `version=0.1.0`, and confirmation exactly `PUBLISH @hello-ai-company/editor-publish@0.1.0`.
14. **Verify Publish in npmjs.** Require the workflow’s post-publish proof and independently confirm exact name, version, MIT license, canonical tarball URL, and matching integrity.

For every dispatch, stop if the target version is already present, a dependency check is ambiguous, the SHA differs from `main`, or any workflow gate fails. Candidate versions are immutable; never retry by overwriting a version. The publish workflow itself will fail closed and perform the registry checks again immediately before and after publication.

## Release dependency order

```text
editor-core@0.1.1 (live)
├── editor-blocknote@0.1.1
├── editor-ai@0.1.0
└── editor-canvas@0.1.0
    └── editor-publish@0.1.0
```

BlockNote and AI may be released independently after core. Canvas also requires exact core `0.1.1`. Publish must wait until exact Canvas `0.1.0` is live. The package manifests keep compatible semver ranges; release guards require the exact dependency versions for this first release train.

Personal-AI remains separate. Its registry install is expected to fail until these packages are legitimately published. Do not replace that failure with file, GitHub, copied-source, alias, or temporary-package dependencies.
