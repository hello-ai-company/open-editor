# First public publish bootstrap

**INTERNAL EVIDENCE / OPS** — not a public product document.

**Case:** ENG-20260913-007 Phase 4E R1 / PA-20260917-002  
**Role:** Document how `@hello-ai-company/editor-core@0.1.0` is published **exactly once**, then Trusted Publisher is attached to that **already-existing** npm package. **Do not execute.** Do not create npm tokens. Do not configure Trusted Publisher in this phase.

D1-EXEC remains **PENDING EXECUTION AUTHORIZATION**. This file is not permission to publish or to make the repository public.

## Current vs later

| Item | Now (Phase 4E HEAD) | Later (after D1-EXEC) |
| --- | --- | --- |
| MIT + `Copyright (c) 2026 Yuki Shibata` | APPLIED | keep |
| Package identity `0.1.0` npmjs public | PREPARED in git | bootstrap-publish **once** |
| Repository visibility | PRIVATE | make PUBLIC **before** npmjs 0.1.0 |
| npm publication | NO | 0.1.0 exactly once, then later versions via OIDC |
| GitHub Private Vulnerability Reporting | NO — not enabled. GitHub PVR is for **public** repos; do not claim it can be enabled while still PRIVATE | enable **immediately after** making the repo PUBLIC |
| Trusted Publisher / OIDC | template / foundation only; not configured | land workflow under `.github/workflows/` first, then configure Trusted Publisher on the existing package |
| `NPM_TOKEN` | do not create | do not create for ongoing releases |

## Why bootstrap is separate from OIDC

npm **Trusted Publishing** (GitHub Actions OIDC → npmjs, no long-lived `NPM_TOKEN`) is the intended **ongoing** path. It requires the package to **already exist** on `https://registry.npmjs.org`.

Therefore:

1. **Bootstrap (once):** a human publishes `@hello-ai-company/editor-core@0.1.0` exactly once so the package exists.
2. **Workflow foundation:** ensure `publish-public-core.yml` exists under `.github/workflows/` (npm requires the workflow filename to exist before Trusted Publisher config).
3. **Configure Trusted Publisher** on that existing package (npmjs UI, pointing at `hello-ai-company/open-editor` and `publish-public-core.yml`).
4. **Ongoing:** later versions publish via OIDC from the active workflow after a reviewed enablement PR. No `NPM_TOKEN`. Template reference: [release-templates/publish-public-core.yml](./release-templates/publish-public-core.yml).

Do **not** use the OIDC template to publish `0.1.0`. Do **not** republish `0.1.0`. Do **not** republish historical GitHub Packages `0.0.0-phase3.e17b4b5`.

The `npm trust` CLI, if used later to inspect publishers, requires **npm >= 11.15.0**. The OIDC template pins Node **24** and `npm@^11`.

## Canonical order (document only — do not execute)

```
D1-EXEC
→ PRIVATE main final verify
→ GitHub repository PUBLIC
→ immediately enable PVR + branch protections
→ bootstrap publish 0.1.0 once (only)
→ confirm package exists on npm
→ land OIDC workflow under `.github/workflows/publish-public-core.yml`
→ configure npm Trusted Publisher (filename must already exist)
→ subsequent releases via OIDC (after reviewed enablement)
```

### 1. D1-EXEC

Written authorization to change visibility and to publish. Intent/MIT/0.1.0 preparation is not enough.

### 2. PRIVATE `main` final verify

On the private tree, after merge of this preparation: `npm ci && npm run verify` and identity lock `@hello-ai-company/editor-core@0.1.0` MIT / npmjs / public. Root `"private": true` remains. **CORE SOURCE CHANGE REQUIRED: NO.**

### 3. GitHub repository PUBLIC

Human GitHub setting. MIT is already applied, so the public tree is not `UNLICENSED`.

### 4. Immediately enable PVR + protections

GitHub **Private Vulnerability Reporting** applies to **public** repositories. Enable it **immediately after** visibility is public, together with branch protection ([branch-protection-plan.md](./branch-protection-plan.md)). Do not invent a `security@` address. Do not claim PVR can be enabled while the repo is still PRIVATE.

### 5. Bootstrap publish `0.1.0` once (only)

A human org member creates the npm package by publishing `0.1.0` **exactly once** to `https://registry.npmjs.org` with `--access public`.

This is **not** the OIDC workflow. Auth method for this one-time bootstrap (interactive `npm login`, npm website, or another owner-held session) is a **separate explicit Gate**. Document it at execution time. **Do not create a long-lived automation token in this repository.** **Do not store `NPM_TOKEN` in GitHub secrets.**

If `0.1.0` must ship with provenance, that requirement is the same bootstrap Gate (document the chosen provenance-capable method then). Do not solve it by adding `id-token` to a live workflow before the package exists.

### 6. Confirm the package exists on npm

`GET https://registry.npmjs.org/@hello-ai-company%2feditor-core` must return `0.1.0`. Treat npmjs publish as **largely irreversible**.

### 7. Land OIDC workflow foundation

npm Trusted Publisher configuration requires the workflow filename to already exist under `.github/workflows/`. Land `publish-public-core.yml` there (foundation may keep the real publish step disabled). Do not configure Trusted Publisher against a missing filename.

### 8. Configure npm Trusted Publisher

On the **existing** package, attach GitHub Actions Trusted Publisher for `hello-ai-company/open-editor` and workflow filename `publish-public-core.yml` (optional Environment `public-npmjs`). Prefer the npmjs UI.

### 9. Subsequent releases via OIDC

Later versions: active `.github/workflows/publish-public-core.yml` (Node 24, `npm@^11`, `id-token: write`, no token), after a reviewed PR enables publish. Template reference: [release-templates/publish-public-core.yml](./release-templates/publish-public-core.yml). Optional future practice: stage-first (`npm publish --dry-run`, then a separate human-gated publish). Never auto-publish on push. Tag / GitHub Release only after the published version exists.

## Historical private line (immutable)

`publish-private-core.yml` is **RETIRED**. GitHub Packages `0.0.0-phase3.e17b4b5` stays on `npm.pkg.github.com`. Do not unpublish it. Do not republish that version on npmjs.

## Explicit non-action in Phase 4E / R1

- No `npm login`
- No npm token create/use
- No `npm publish` except `--dry-run`
- No Trusted Publisher configuration in the npm UI
- No enablement of a live `npm publish` step (foundation workflow may exist with publish disabled)
- No GitHub Environment `public-npmjs` created
- No tag, Release, or visibility change
- No PVR enablement (repo is still PRIVATE)
