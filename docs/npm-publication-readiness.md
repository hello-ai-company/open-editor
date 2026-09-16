# npm publication readiness (Phase 4D / 4D.1)

**INTERNAL EVIDENCE** — not a public product document. D6 confirmation plus Phase 4E metadata (npmjs public `0.1.0`). No real publish.

**Case:** ENG-20260913-007 Phase 4D.1 / PA-20260917-001  
**Role:** Record D6 owner confirmation. **Never** `npm login`, `npm adduser`, `npm org`, `npm publish`, or register a scope from this phase.

Gate **D6** classification: **CLOSED** — owner controls npm org `hello-ai-company` / scope `@hello-ai-company` / target `@hello-ai-company/editor-core`. **No npm mutations.**

## Current authorized package (unchanged)

| Field | Value |
| --- | --- |
| Name | `@hello-ai-company/editor-core` |
| Version | `0.0.0-phase3.e17b4b5` |
| License | `UNLICENSED` |
| Registry | `https://npm.pkg.github.com` |
| npmjs | **Not published** |

`publishConfig.registry` remains GitHub Packages. `packages/core/test/publish-gate.test.ts` still fails if the registry is `https://registry.npmjs.org`.

## Owner confirmation (Phase 4D.1)

| Item | Owner-confirmed |
| --- | --- |
| npm org | `hello-ai-company` |
| Scope | `@hello-ai-company` |
| Target package | `@hello-ai-company/editor-core` |
| Fallback names | **Not selected** |

This phase did **not**: `npm login`, create/use an npm token, `npm publish`, or register an org/scope.

## Historical read-only probes (Phase 4D, 2026-09-16)

No credentials were sent to npmjs. `npm whoami --registry=https://registry.npmjs.org` → `ENEEDAUTH` (not logged in; expected). These probes are **historical**. They do not reopen D6.

| URL / command | HTTP / result | Meaning at that time |
| --- | --- | --- |
| `GET https://registry.npmjs.org/@hello-ai-company%2feditor-core` | 404 `Not found` | Package name unused on npmjs |
| `GET https://registry.npmjs.org/-/org/hello-ai-company` | 404 org does not exist | npm org not observed on npmjs that day |
| `GET https://registry.npmjs.org/-/org/hello-ai-company/package` | 404 `Scope not found` | Scope not observed on npmjs that day |
| GitHub org `hello-ai-company` | exists (this private repo) | Does **not** reserve npm scope |

If creating or claiming the org on npmjs is still operationally required at publish time, that is a later public-transition step — **not** this phase.

## Fallback names (document only — not selected — do not register)

Keep `@hello-ai-company/editor-core`. If that scope cannot be obtained at publish time, owner may later choose a **documented** alternative. These probes are availability snapshots from Phase 4D, not reservations:

| Candidate | Probe | Snapshot |
| --- | --- | --- |
| `@hello-ai-company/editor-core` (owner-confirmed target) | 404 | Unused package at 2026-09-16 snapshot |
| `@hello-ai-company/core` | 404 | Unused; same scope |
| `@hello-ai-company/open-editor` | 404 | Unused |
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

## Why D6 is CLOSED (confirmation, not publication)

1. Owner confirms control of org `hello-ai-company`, scope `@hello-ai-company`, and target `@hello-ai-company/editor-core`.
2. This phase is **not logged in** to npm and must not log in.
3. GitHub Packages publication of the private identity is a different registry and does not prove npmjs publication.
4. Creating or claiming the org would be a **forbidden** register step in Phase 4D.1.

## What would still be required after this confirmation

Even with D6 closed as a confirmation gate, npmjs publication also needs (all later; none done here):

- D2 **application** of MIT (selection is already MIT; files still `UNLICENSED`)
- D3 copyright line written into `LICENSE` (`Copyright (c) 2026 Yuki Shibata` — **not written yet**)
- D7 registry choice
- D8 first public version (**not** `0.0.0-phase3.e17b4b5`)
- D11 enable GitHub PVR during public transition
- D1-EXEC written execution authorization
- Identity-lock updates (`AUTHORIZED_*`, publish-gate, workflow)
- Trusted publishing / provenance — **do not configure secrets now**

**Do not make the GitHub repository public while the package remains `UNLICENSED`.**

## Explicit non-action

Did not: `npm login`, `npm adduser`, create org, claim scope, `npm publish`, change `publishConfig`, bump version, add provenance, or configure trusted publishing.
