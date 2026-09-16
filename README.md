# open-editor

**PRIVATE EXTRACTION WORKSPACE**

**NOT AUTHORIZED FOR PUBLIC RELEASE**

This repository is a private, internal extraction workspace for a standalone editor-core package. It is not an open-source project, not a public product, and not authorized for public visibility, npm publish, tagging, or release.

- Repository visibility must remain **private**.
- License: **UNLICENSED**. All rights reserved.
- Do not import `personal-ai` git history.
- Do not open public PRs, merge to a public fork, or publish packages.

## Package

`@hello-ai-company/editor-core` (`packages/core`, `0.0.0-phase3.e17b4b5`) is the Phase 3 private GitHub Packages core:

- document model and `JsonValue`
- JSON serialization
- optional provider seams

See `docs/architecture.md`, `docs/providers.md`, `docs/public-api.md`, `docs/versioning.md`, `docs/security-boundary.md`, `docs/public-release-checklist.md`, `docs/extraction-status.md`, `docs/owner-oss-policy.md`, and `docs/public-release-decision.md`.

## Local gates

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack -w @hello-ai-company/editor-core
node scripts/inspect-tarball.mjs
node scripts/isolated-consumer.mjs
node scripts/security-scan.mjs
node scripts/api-contract.mjs
```
