# Distribution options

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

Comparison of **future** naming and registry choices for `@hello-ai-company/editor-core`. This phase does **not** rename the package, register an npm organization, change `publishConfig`, or publish.

Owner decisions: **D5, D6, D7, D8, D10** in [public-release-decision.md](./public-release-decision.md) — still **PENDING** (not applied). Phase 4C **recommendation** (evaluate only): keep `@hello-ai-company/editor-core` on **npmjs.org** at first public version **`0.1.0`**.

## Current authorized distribution

| Field | Value |
| --- | --- |
| Name | `@hello-ai-company/editor-core` |
| Version | `0.0.0-phase3.e17b4b5` |
| Registry | `https://npm.pkg.github.com` |
| Publish | `workflow_dispatch` → `npm publish -w @hello-ai-company/editor-core --access restricted --provenance=false` |
| Consumer auth | scoped `.npmrc`: `@hello-ai-company:registry=https://npm.pkg.github.com` |

`packages/core/test/publish-gate.test.ts` **fails** if `publishConfig.registry` is `https://registry.npmjs.org`. That is the current private lock, not a forever product decision.

## Naming options

### A. Keep `@hello-ai-company/editor-core` (scoped)

| | |
| --- | --- |
| Pros | Zero import migration for `personal-ai` and in-repo contracts; matches GitHub org; lower squatting risk |
| Cons | Public npmjs publish needs the **npm org** `@hello-ai-company` (independent of GitHub org membership) |
| Rename required? | **No**, if that npm scope is owned and the owner wants this brand |

Non-binding lean: **A**, after D6 confirms npm org ownership.

**NPM SCOPE OWNERSHIP — OWNER ACTION REQUIRED.** Phase 4C read-only registry probes:

- `GET https://registry.npmjs.org/@hello-ai-company%2feditor-core` → 404
- `GET https://registry.npmjs.org/-/org/hello-ai-company` → org does not exist

GitHub org `hello-ai-company` does **not** reserve the npm scope. Do **not** register the org in this phase.

### B. Unscoped `editor-core`

| | |
| --- | --- |
| Pros | Short install name; default npmjs discoverability |
| Cons | **Rename** (breaking); high name-collision risk; all identity locks, tarball prefix `hello-ai-company-editor-core-`, and consumers change |

Rename **would** be required. Not recommended unless branding demands it.

### C. Different scope (e.g. `@open-editor/core`)

| | |
| --- | --- |
| Pros | Public brand can diverge from GitHub org; allows parallel private `@hello-ai-company/editor-core` during transition |
| Cons | Still a **rename**; two scopes to document and authenticate |

Use only if D6 finds `@hello-ai-company` unavailable or inappropriate for public npm.

## Registry options

| Option | Who can install | Auth | Discoverability | Notes |
| --- | --- | --- | --- | --- |
| **GitHub Packages only (status quo)** | Org/repo packages permission | `GITHUB_TOKEN` / PAT | Low (not npmjs index) | Authorized today |
| **npmjs.org public** | Anyone | None for install of public scoped packages | High | Requires D1, D2, D6, D8; `--access public` for scoped public packages |
| **Dual-publish** | Both audiences | Two publishers | Mixed | Same name, **per-registry versions**; keep them aligned deliberately |
| **Split lines** | Private prereleases on GH Packages; public semver on npmjs | Two channels | Clear | Avoid publishing `0.0.0-phase3.e17b4b5` on npmjs |

## Dual-registry implications (if staying scoped)

- `publishConfig.registry` currently forces GitHub Packages as the default `npm publish` target.
- A version published only on GitHub Packages is **not** the same artifact as the same version string on npmjs unless dual-published.
- **Do not reuse** `0.0.0-phase3.e17b4b5` on npmjs or under a different license ([versioning.md](./versioning.md)).
- Internal consumers with `@hello-ai-company:registry=https://npm.pkg.github.com` will **not** see npmjs versions until `.npmrc` / CI is changed (that change lives in **consumer** repos, not by editing `personal-ai` from here).

In-repo files that would need a later authorized identity/registry update (not done now):

- `packages/core/package.json` (`publishConfig`)
- `.github/workflows/publish-private-core.yml`
- `scripts/lib/tarball.mjs` (`AUTHORIZED_*`)
- `scripts/inspect-tarball.mjs`, `scripts/api-contract.mjs`
- `packages/core/test/publish-gate.test.ts`
- `packages/core/contracts/*.json` version field
- Docs that state the frozen identity

## Version for a first public artifact

| Candidate | Fit |
| --- | --- |
| `0.0.0-phase3.e17b4b5` | Internal Phase 3 prerelease. **Do not** use as the public OSS debut. |
| `0.1.0` | Signals usable but evolving (provider types are experimental). **Recommended first public version** (0.x early). Not applied. |
| `1.0.0` | Signals stable runtime/document contract. Higher semver expectation. |

**OWNER DECISION PENDING (D8).** Engineering recommendation: **`0.1.0`**. `publish-gate.test.ts` currently forbids `0.1.0` and `1.0.0` **for the frozen private package**. Those strings become eligible only after an authorized identity change in a later phase.

## Provenance and trusted publishing (recommend only)

Today: `--provenance=false` on GitHub Packages.

If D7 selects npmjs:

- npm org 2FA for publishers
- GitHub Actions OIDC **trusted publishing** bound to this repo and a dedicated workflow
- `--provenance` (Sigstore) on public publishes
- Prefer a **new** `workflow_dispatch` or tag-gated workflow over auto-publish on push
- Do **not** put long-lived npm tokens in this phase; do **not** configure secrets now

## Explicit non-action

This document does not register `@hello-ai-company` on npmjs, change package name or registry, publish, or bump the version.
