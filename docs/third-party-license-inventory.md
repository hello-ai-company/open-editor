# Third-party license inventory

**INTERNAL EVIDENCE** — not a public product document. Historical inventory. Current first-party license is MIT (`Copyright (c) 2026 Yuki Shibata`).

Phase 4B inventory of third-party licenses. First-party MIT was applied in Phase 4E. SPDX NOTICE / CLA remain unused (no CLA/DCO for v0.1.0).

## Verdict

| Question | Answer |
| --- | --- |
| Production runtime dependencies in `@hello-ai-company/editor-core` | **None** |
| Third-party source bundled in `packages/core/src/**` | **None** |
| Third-party code in the published tarball | **None** (allowlist: `package.json`, `LICENSE`, `README.md`, `dist/*`) |
| Copyleft (GPL/AGPL/LGPL) in the lockfile | **None found** |
| Third-party license uncertainty **blocker** for the artifact | **No** |
| Remaining legal question | Chain-of-title for the extract — D19 **CLOSED** (owner representation, not legal advice); MIT **applied** in Phase 4E |

## First-party license (not third-party)

| Path | SPDX / field | Text |
| --- | --- | --- |
| `LICENSE` | MIT | `Copyright (c) 2026 Yuki Shibata` |
| `packages/core/LICENSE` | MIT | Same text; **ships in the npm tarball** |
| Root `package.json` `"license"` | MIT | Workspace is `"private": true` |
| `packages/core/package.json` `"license"` | MIT | Publishable package identity |

Copyright holder `Copyright (c) 2026 Yuki Shibata` is written into both `LICENSE` files in Phase 4E.

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

Provenance (internal, not an npm dep): extracted from `hello-ai-company/personal-ai` approved `apps/web/src/editorCore/*` paths. Relicensing that extract is **D19 CLOSED** (owner representation) in [public-release-decision.md](./public-release-decision.md).

## GitHub Actions (not redistributed)

Used by `.github/workflows/ci.yml` and `public-release-preflight.yml` (`phase-4a-release-readiness.yml` and `publish-private-core.yml` retired in Phase 4E):

| Action | Pin | Typical license | In tarball |
| --- | --- | --- | --- |
| `actions/checkout` | `@v4` | MIT (upstream Action) | No |
| `actions/setup-node` | `@v4` | MIT (upstream Action) | No |

## Isolated consumer harness

`tests/isolated-consumer/` is `private` + MIT (test fixture; not published). `scripts/isolated-consumer.mjs` may install `typescript@5.9.2` **into a temp directory** for consumer typecheck. That install is not part of the published core package.

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

Do not add license-checker (or any) runtime/dev dependency in this phase except lockfile follow-through for workspace license/version metadata.

## Applying an OSS license (done in Phase 4E)

Phase 4E applied MIT + `Copyright (c) 2026 Yuki Shibata` to `LICENSE` files, package metadata, `AUTHORIZED_LICENSE`, and identity tests. Optional NOTICE / CLA / DCO remain out of scope (no CLA/DCO for v0.1.0).
