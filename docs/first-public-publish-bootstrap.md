# First public publish bootstrap

**INTERNAL EVIDENCE / OPS** — not a public product document.

**Case:** ENG-20260913-007 Phase 4E R1 / PA-20260917-002 / post-D1-EXEC  
**Role:** Record how `@hello-ai-company/editor-core@0.1.0` is published **exactly once**, then Trusted Publishing is attached for later versions. Do not republish `0.1.0`. Do not create npm tokens.

D1-EXEC through bootstrap publish of `0.1.0` is **EXECUTED**. Remaining owner gates: Environment `public-npmjs` (before foundation merge), Trusted Publisher (after merge), tag/Release (separate).

## Current vs later

| Item | Current (post D1-EXEC) | Later |
| --- | --- | --- |
| MIT + `Copyright (c) 2026 Yuki Shibata` | APPLIED | keep |
| Package identity `0.1.0` npmjs public | **PUBLISHED** once on registry | never republish `0.1.0` |
| Repository visibility | **PUBLIC** | keep |
| npm publication | **YES** — `0.1.0` live | later versions via OIDC only after reviewed enablement |
| GitHub Private Vulnerability Reporting | **ENABLED** | keep |
| Protect main Ruleset | **ACTIVE** | keep |
| D1-EXEC | **EXECUTED** through bootstrap publish | n/a |
| GitHub Environment `public-npmjs` | **OWNER must create + protect BEFORE merging** foundation workflow | keep protected |
| Trusted Publisher / OIDC | **PENDING** — land workflow filename under `.github/workflows/` first, then configure TP | configure after merge |
| Tag / Release | **PENDING** | separate human gate |
| `NPM_TOKEN` | do not create | do not create for ongoing releases |

## Why bootstrap is separate from OIDC

npm **Trusted Publishing** (GitHub Actions OIDC → npmjs, no long-lived `NPM_TOKEN`) is the intended **ongoing** path. It requires the package to **already exist** on `https://registry.npmjs.org`.

Therefore (completed + remaining):

1. **Bootstrap (once) — DONE:** human published `@hello-ai-company/editor-core@0.1.0` exactly once so the package exists.
2. **Environment (owner, BEFORE foundation merge):** create and protect GitHub Environment `public-npmjs` (required reviewers if plan permits). Do **not** wait until after merge — first `workflow_dispatch` must not auto-create an unprotected Environment.
3. **Workflow foundation:** ensure `publish-public-core.yml` exists under `.github/workflows/` (npm requires the workflow filename to exist before Trusted Publisher config).
4. **Configure Trusted Publisher** on that existing package (npmjs UI, pointing at `hello-ai-company/open-editor` and `publish-public-core.yml`, Environment `public-npmjs`) — **after** the workflow is on the default branch.
5. **Ongoing:** later versions publish via OIDC from the active workflow after a reviewed enablement PR. No `NPM_TOKEN`. Template reference: [release-templates/publish-public-core.yml](./release-templates/publish-public-core.yml).

Do **not** use the OIDC workflow to republish `0.1.0`. Do **not** republish historical GitHub Packages `0.0.0-phase3.e17b4b5`.

The `npm trust` CLI, if used later to inspect publishers, requires **npm >= 11.15.0**. The OIDC workflow pins Node **24** and `npm@^11`.

## Canonical order

```
D1-EXEC
→ PRIVATE main final verify
→ GitHub repository PUBLIC
→ immediately enable PVR + Protect main
→ bootstrap publish 0.1.0 once (only)
→ confirm package exists on npm
→ owner creates + protects GitHub Environment public-npmjs (BEFORE foundation merge)
→ land OIDC workflow under `.github/workflows/publish-public-core.yml` (merge foundation)
→ configure npm Trusted Publisher (filename must already exist on default branch)
→ subsequent releases via OIDC (after reviewed enablement)
→ tag / GitHub Release only after separate gate
```

Status at this document revision:

```text
Repository            PUBLIC          DONE
PVR                   ENABLED         DONE
Protect main Ruleset  ACTIVE          DONE
npm 0.1.0             PUBLISHED       DONE
D1-EXEC               EXECUTED        DONE
Environment public-npmjs              OWNER — BEFORE foundation merge
Trusted Publisher                     PENDING — after merge
Tag / Release                         PENDING
```

### 1. D1-EXEC — DONE

Written authorization executed through visibility change and bootstrap publish.

### 2. PRIVATE `main` final verify — DONE (historical)

Pre-public verify on the prepared tree. Root `"private": true` remains. **CORE SOURCE CHANGE REQUIRED: NO.**

### 3. GitHub repository PUBLIC — DONE

### 4. PVR + Protect main — DONE

Private Vulnerability Reporting **ENABLED**. Protect main Ruleset **ACTIVE**.

### 5. Bootstrap publish `0.1.0` once — DONE

Published exactly once to `https://registry.npmjs.org` with `--access public`. **Immutable — do not republish.**

### 6. Confirm the package exists on npm — DONE

`@hello-ai-company/editor-core@0.1.0` is live. Treat npmjs publish as **largely irreversible**.

### 7. Create + protect Environment `public-npmjs` — OWNER BEFORE MERGE

Required **before** merging the foundation workflow that references `environment: public-npmjs`, so the first `workflow_dispatch` cannot auto-create an unprotected Environment.

Recommended:

```text
Name: public-npmjs
Required reviewers: enabled if GitHub plan/features permit
Deployment branches: restrict sensibly if available
Do not store long-lived npm publish tokens as Environment secrets
```

### 8. Land OIDC workflow foundation

npm Trusted Publisher configuration requires the workflow filename to already exist under `.github/workflows/`. Land `publish-public-core.yml` there (foundation may keep the real publish step disabled). Do not configure Trusted Publisher against a missing filename.

### 9. Configure npm Trusted Publisher — AFTER MERGE

On the **existing** package, attach GitHub Actions Trusted Publisher for `hello-ai-company/open-editor` and workflow filename `publish-public-core.yml` with Environment `public-npmjs`. Prefer the npmjs UI.

### 10. Subsequent releases via OIDC

Later versions: active `.github/workflows/publish-public-core.yml` (Node 24, `npm@^11`, `id-token: write`, no token), after a reviewed PR enables publish. Template reference: [release-templates/publish-public-core.yml](./release-templates/publish-public-core.yml). Never auto-publish on push. Tag / GitHub Release only after a separate gate — **PENDING**.

## Historical private line (immutable)

`publish-private-core.yml` is **RETIRED**. GitHub Packages `0.0.0-phase3.e17b4b5` stays on `npm.pkg.github.com`. Do not unpublish it. Do not republish that version on npmjs.

## Historical: Explicit non-action in Phase 4E / R1 (pre-D1)

Phase 4E preparation **did not** (at that time): `npm login`, create tokens, live publish, Trusted Publisher, Environment, tag, Release, visibility change, or PVR. Those constraints applied **before** D1-EXEC. Prefer **Current vs later** above for present truth.
