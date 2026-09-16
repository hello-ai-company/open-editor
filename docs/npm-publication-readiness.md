# npm publication readiness (Phase 4D)

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

**Case:** ENG-20260913-007 Phase 4D / PA-20260916-004  
**Role:** Read-only npm registry audit. **Never** `npm login`, `npm adduser`, `npm org`, `npm publish`, or register a scope from this phase.

Gate **D6** classification: **NPM SCOPE OWNERSHIP — OWNER ACTION REQUIRED**.

## Current authorized package (unchanged)

| Field | Value |
| --- | --- |
| Name | `@hello-ai-company/editor-core` |
| Version | `0.0.0-phase3.e17b4b5` |
| License | `UNLICENSED` |
| Registry | `https://npm.pkg.github.com` |
| npmjs | **Not published** |

`publishConfig.registry` remains GitHub Packages. `packages/core/test/publish-gate.test.ts` still fails if the registry is `https://registry.npmjs.org`.

## Read-only probes (2026-09-16)

No credentials were sent to npmjs. `npm whoami --registry=https://registry.npmjs.org` → `ENEEDAUTH` (not logged in; expected).

| URL / command | HTTP / result | Meaning |
| --- | --- | --- |
| `GET https://registry.npmjs.org/@hello-ai-company%2feditor-core` | 404 `Not found` | Package name unused on npmjs |
| `GET https://registry.npmjs.org/-/org/hello-ai-company` | 404 org does not exist | **npm org `@hello-ai-company` is not proven / does not exist** |
| `GET https://registry.npmjs.org/-/org/hello-ai-company/package` | 404 `Scope not found` | Scope unowned on npmjs |
| GitHub org `hello-ai-company` | exists (this private repo) | Does **not** reserve npm scope |

**NPM SCOPE OWNERSHIP — OWNER ACTION REQUIRED.** Ownership is unproven. Do not publish to npmjs. Do not register the org from this phase.

## Fallback names (document only — do not register)

Keep `@hello-ai-company/editor-core` **if** the owner later creates and owns npm org `hello-ai-company`. If that scope cannot be obtained, owner may later choose a **documented** alternative. These probes are availability snapshots, not reservations:

| Candidate | Probe | Snapshot |
| --- | --- | --- |
| `@hello-ai-company/editor-core` (preferred if org owned) | 404 | Unused package; **org missing** |
| `@hello-ai-company/core` | 404 | Unused; same missing org |
| `@hello-ai-company/open-editor` | 404 | Unused; same missing org |
| `@open-editor/core` | 404 | Unused; org `@open-editor` not shown to exist |
| `@open-editor/editor-core` | 404 | Unused |
| `open-editor-core` | 404 | Unused unscoped name |
| `hello-ai-editor-core` | 404 | Unused |
| `openeditor` | 404 | Unused |
| `@openeditor/core` | 404 | Unused |
| `@hello-ai/editor-core` | 404 | Unused (different scope) |
| `@helloai/editor-core` | 404 | Unused (different scope) |
| unscoped `editor-core` | 200; unpublished `1.0.0-rc.0` (2019) | **Do not use.** Name has history; collision / reclaim risk |

Fallback names are **not selected**. Recording them does not rename the package and does not authorize `npm publish`.

## Why D6 is not CLOSED

1. The npm org required by the frozen scoped name **does not exist**.
2. This auditor is **not logged in** to npm and must not log in.
3. GitHub Packages publication of the private identity is a different registry and does not prove npmjs org ownership.
4. Creating the org would be a **forbidden** register step in Phase 4D.

## What would still be required after the owner owns a scope

Even with D6 resolved, npmjs publication also needs (all later; none done here):

- D2 **application** of MIT (selection is already MIT; files still `UNLICENSED`)
- D3 copyright holder
- D19 chain-of-title
- D7 registry choice
- D8 first public version (**not** `0.0.0-phase3.e17b4b5`)
- D1-EXEC written execution authorization
- Identity-lock updates (`AUTHORIZED_*`, publish-gate, workflow)
- Trusted publishing / provenance — **do not configure secrets now**

**Do not make the GitHub repository public while the package remains `UNLICENSED`.**

## Explicit non-action

Did not: `npm login`, `npm adduser`, create org, claim scope, `npm publish`, change `publishConfig`, bump version, add provenance, or configure trusted publishing.
