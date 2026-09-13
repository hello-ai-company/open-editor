# open-editor

**PRIVATE EXTRACTION WORKSPACE**

**NOT AUTHORIZED FOR PUBLIC RELEASE**

This repository is a private, internal extraction workspace for a standalone editor-core package. It is not an open-source project, not a public product, and not authorized for public visibility, npm publish, tagging, or release.

- Repository visibility must remain **private**.
- License: **UNLICENSED**. All rights reserved.
- Do not import `personal-ai` git history.
- Do not open public PRs, merge to a public fork, or publish packages.

## Package

`@hello-ai/editor-core` (`packages/core`, `0.0.0-private`) is the Phase 2 standalone core:

- document model and `JsonValue`
- JSON serialization
- optional provider seams

See `docs/architecture.md`, `docs/providers.md`, and `docs/extraction-status.md`.

## Local gates

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack -w @hello-ai/editor-core
node scripts/inspect-tarball.mjs
node scripts/isolated-consumer.mjs
node scripts/security-scan.mjs
```
