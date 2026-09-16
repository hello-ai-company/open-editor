# Third-party license inventory

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

Phase 4B inventory for a future OSS decision. **No license was applied.** SPDX, NOTICE, and copyright-holder naming remain **OWNER DECISION PENDING**.

Inventory date context: lockfile at `origin/main` `c87bf79b7454079bb31b31e283c53747aca43c08` (`package-lock.json` unchanged in this phase).

## Verdict

| Question | Answer |
| --- | --- |
| Production runtime dependencies in `@hello-ai-company/editor-core` | **None** |
| Third-party source bundled in `packages/core/src/**` | **None** |
| Third-party code in the published tarball | **None** (allowlist: `package.json`, `LICENSE`, `dist/*`) |
| Copyleft (GPL/AGPL/LGPL) in the lockfile | **None found** |
| Third-party license uncertainty **blocker** for the artifact | **No** |
| Remaining legal question | Chain-of-title for the `personal-ai` extract — owner/legal (not npm) |

## First-party license (not third-party)

| Path | SPDX / field | Text |
| --- | --- | --- |
| `LICENSE` | `UNLICENSED` | Proprietary, confidential, all rights reserved |
| `packages/core/LICENSE` | `UNLICENSED` | Same text; **ships in the npm tarball** |
| Root `package.json` `"license"` | `UNLICENSED` | Workspace is `"private": true` |
| `packages/core/package.json` `"license"` | `UNLICENSED` | Publishable package identity |

Copyright holder legal name is **not** stated in those files. **OWNER DECISION PENDING.**

## Production (published package)

`packages/core/package.json` has no `dependencies`, `peerDependencies`, or `optionalDependencies`.

Gates that enforce this:

- `scripts/inspect-tarball.mjs` — rejects tarballs that introduce runtime dependencies
- `scripts/security-scan.mjs` — `npm audit --omit=dev`
- `docs/security-boundary.md` — tarball must not contain `node_modules`

**Redistribution obligation for third-party npm code in the public package: none today.**

## Direct development dependencies (`packages/core`)

These are **not** packed. They exist only for typecheck, test, and build.

| Package | Declared | Resolved | License (lockfile) | Shipped |
| --- | --- | --- | --- | --- |
| `typescript` | `^5.9.2` | `5.9.3` | Apache-2.0 | No |
| `vitest` | `^3.2.4` | `3.2.7` | MIT | No |

Root `package.json` has no direct dependencies.

## Transitive development licenses (lockfile summary)

Counted from `package-lock.json` `packages` entries (dev tree). First-party workspace packages excluded from “third-party” totals.

| License | Count (approx.) | Examples |
| --- | --- | --- |
| MIT | 97 | `vitest`, Vite/Rollup/esbuild tooling, chai stack |
| Apache-2.0 | 2 | `typescript@5.9.3`, `expect-type@1.4.0` |
| ISC | 2 | `picocolors@1.1.1`, `siginfo@2.0.0` |
| BSD-3-Clause | 1 | `source-map-js@1.2.1` |

No GPL, AGPL, LGPL, BUSL, or proprietary-unknown third-party identifiers were found in the lockfile.

If Apache-2.0 is later chosen for **this** project, NOTICE is still optional for *this* artifact because those Apache-2.0 packages are **not redistributed**. NOTICE becomes relevant if the owner later bundles third-party notices or extracts Apache-licensed code into `src/`.

## Source tree (`packages/core/src`)

| File | External package imports |
| --- | --- |
| `index.ts` | None (re-exports local modules) |
| `model.ts` | None |
| `serialization.ts` | `./model.js` only |
| `providers.ts` | `import type` from `./model.js` only |

No copyright headers, SPDX tags, or vendored snippets. Test fixture block type `"vendorPluginBlock"` is a string used to prove unknown types round-trip — not third-party code.

Provenance (internal, not an npm dep): extracted from `hello-ai-company/personal-ai` approved `apps/web/src/editorCore/*` paths. Relicensing that extract is **D19** in [public-release-decision.md](./public-release-decision.md).

## GitHub Actions (not redistributed)

Used by `.github/workflows/ci.yml`, `phase-4a-release-readiness.yml`, and `publish-private-core.yml`:

| Action | Pin | Typical license | In tarball |
| --- | --- | --- | --- |
| `actions/checkout` | `@v4` | MIT (upstream Action) | No |
| `actions/setup-node` | `@v4` | MIT (upstream Action) | No |

## Isolated consumer harness

`tests/isolated-consumer/` is `private` + `UNLICENSED`. `scripts/isolated-consumer.mjs` may install `typescript@5.9.2` **into a temp directory** for consumer typecheck. That install is not part of the published core package.

## Inventory method (repeatable)

```bash
# Expect empty production tree for the package
npm ls --omit=dev -w @hello-ai-company/editor-core

# Dev tree
npm ls --include=dev -w @hello-ai-company/editor-core

# Packed surface
npm pack -w @hello-ai-company/editor-core
node scripts/inspect-tarball.mjs
```

Do not add license-checker (or any) runtime/dev dependency in this phase. Lockfile must stay unchanged.

## Applying an OSS license later (not now)

Would require, at minimum:

1. Owner selection of SPDX (see [license-decision.md](./license-decision.md))
2. Replace `LICENSE` and `packages/core/LICENSE`
3. Change `"license"` in root and `packages/core` `package.json` (lockfile follows)
4. Update `AUTHORIZED_LICENSE` in `scripts/lib/tarball.mjs` and tests/scripts that assert `UNLICENSED`
5. Optional NOTICE, per-file headers, CLA/DCO

That work is **LICENSE APPLICATION REQUIRED** and is **out of scope for Phase 4C**. See [license-recommendation.md](./license-recommendation.md) (PRIMARY MIT / FALLBACK Apache-2.0 — **not applied**).
