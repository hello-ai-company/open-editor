# License recommendation (not applied)

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

**Case:** ENG-20260913-007 Phase 4C / PA-20260916-003  
**Role:** Engineering assessment for a **future** owner/legal choice. **Not legal advice.**  
**APPLIED: NO.** `LICENSE`, `packages/core/LICENSE`, and `"license": "UNLICENSED"` fields are **unchanged**.

This note does **not** select a license in the legal sense and does **not** authorize rewriting license files. Comparison context: [license-decision.md](./license-decision.md). Third-party inventory: [third-party-license-inventory.md](./third-party-license-inventory.md).

## Recommendation (owner still must choose)

| Role | SPDX | Applied now |
| --- | --- | --- |
| **PRIMARY** | **MIT** | **NO** |
| **FALLBACK** | **Apache-2.0** | **NO** |
| GPL family (GPL / LGPL / AGPL) | Not recommended for this library | **NO** |
| BUSL / other source-available | Incompatible with confirmed “genuine OSS” intent | **NO** |
| Remain `UNLICENSED` | Current private state | **YES** (status quo) |

Owner Decision **D2 remains PENDING** until the owner (typically with counsel) picks PRIMARY or FALLBACK — or rejects both — **and** a later authorized phase applies files.

## PRIMARY — MIT

Engineering fit for `@hello-ai-company/editor-core` as a **zero-dependency, embeddable TypeScript library**:

1. **Embeddable-library default.** The package is host-neutral seams (optional provider **types**, no network clients). MIT is the usual npm/TypeScript default when the goal is “anyone uses core without paying,” including inside proprietary hosts.
2. **Lowest adoption friction.** Short text, universally recognized, typically light corporate review. Matches a small document/serialization core competing on utility, not on license ceremony.
3. **Matches the published artifact.** Production runtime dependencies: **none**. Tarball ships `package.json`, `LICENSE`, `dist/*` only. MIT’s notice-preservation duty matches that surface without Apache NOTICE machinery for code that is not redistributed.
4. **No open-core hook.** MIT does not encode use-field restrictions or delayed OSS. That supports **optional sponsorship only** without a license-based paywall.
5. **Ecosystem alignment.** Direct/transitive **dev** licenses are mostly MIT; TypeScript is Apache-2.0 but is **not** packed. Adopters of the runtime tarball should not have to reason about NOTICE/patent clauses for third-party code they did not receive.

## FALLBACK — Apache-2.0

Choose Apache-2.0 instead of MIT when the owner (typically with counsel) wants:

- An **explicit patent grant** and patent-retaliation termination from the copyright holder to downstream users — more relevant if D19 chain-of-title review finds patent-sensitive editor/document semantics in the `personal-ai` extract.
- A **NOTICE** file / trademark-attribution practice, or a contribution policy that assumes Apache-style patent language.
- **Procurement defaults** among target enterprise adopters that standardize on Apache-2.0.
- Anticipation of **vendoring Apache-2.0 code into `src/`** later (NOTICE then becomes relevant for *this* artifact).

Apache-2.0 is still permissive and compatible with free-core OSS + optional sponsorship. The cost is longer compliance text for a tarball that currently ships only first-party code.

## GPL-family — neutral note

Copyleft (GPL, LGPL, AGPL) is a legitimate philosophy when **reciprocal source-sharing** is an intentional product goal (for example some applications or frameworks).

For an **embeddable library** meant to sit inside diverse hosts — including proprietary products and the owner’s own apps — copyleft often creates **adoption friction**: downstream combinations may inherit source-disclosure or compatibility duties they did not choose. That is a **fit** judgment against “anyone uses core,” not a moral judgment on copyleft.

**Not recommended** as the OpenEditor library default. **Not selected. Not applied.**

## Source-available / BUSL

**Incompatible** with OWNER-CONFIRMED philosophy ([owner-oss-policy.md](./owner-oss-policy.md)):

- Use restrictions or delayed OSS are **not** OSI-style “anyone uses core without paying.”
- Commonly paired with commercial licenses — structurally similar to open-core, which the owner rejected for initial launch.

## What applying a license would require later (do not do now)

**LICENSE APPLICATION REQUIRED** as a separate authorized phase, after D2 + D3 (+ D19):

1. Replace root `LICENSE` and `packages/core/LICENSE` (the latter **ships in the npm tarball**).
2. Change `"license"` in root and `packages/core` `package.json` (lockfile metadata follows — that is a later lockfile change, forbidden in Phase 4C).
3. Update `AUTHORIZED_LICENSE` in `scripts/lib/tarball.mjs` and assertions in inspect/publish-gate/isolated-consumer scripts.
4. Optional: `NOTICE`, per-file SPDX headers, DCO vs CLA (D4).
5. Update private banners and public drafts so they no longer claim `UNLICENSED`.

Until that phase: identity remains `@hello-ai-company/editor-core@0.0.0-phase3.e17b4b5` **UNLICENSED** on `npm.pkg.github.com`.
