# First public publish bootstrap

**INTERNAL EVIDENCE / OPS** — not a public product document.

**Case:** ENG-20260913-007 Phase 4E R1 / PA-20260917-002 / post-D1-EXEC / TP production-ready  
**Role:** Record how `@hello-ai-company/editor-core@0.1.0` was published **exactly once**, then Trusted Publishing was attached for later versions. Do not republish `0.1.0`. Do not create npm tokens.

D1-EXEC through bootstrap publish of `0.1.0`, Environment, Trusted Publisher, and tag/Release are **DONE**. Remaining: reviewed production-ready OIDC publish path for **`0.1.1+` only** (do not dispatch while package version is still `0.1.0`).

## Current vs later

| Item | Current (post D1-EXEC) | Later | Verification |
| --- | --- | --- | --- |
| MIT + `Copyright (c) 2026 Yuki Shibata` | APPLIED | keep | MACHINE-VERIFIED |
| Package identity `0.1.0` npmjs public | **PUBLISHED** once on registry | never republish `0.1.0` | MACHINE-VERIFIED |
| Repository visibility | **PUBLIC** | keep | MACHINE-VERIFIED |
| npm publication | **YES** — `0.1.0` live | later versions via OIDC only after ChatGPT + human gate | MACHINE-VERIFIED |
| GitHub Private Vulnerability Reporting | **ENABLED** | keep | MACHINE-VERIFIED |
| Protect main Ruleset | **ACTIVE** | keep | MACHINE-VERIFIED |
| D1-EXEC | **EXECUTED** through bootstrap publish | n/a | MACHINE-VERIFIED |
| GitHub Environment `public-npmjs` | **CONFIGURED + PROTECTED** (main only; no NPM_TOKEN) | keep protected | MACHINE-VERIFIED; no token OWNER-CONFIRMED |
| Trusted Publisher / OIDC | **OWNER-CONFIRMED CONFIGURED** (`publish-public-core.yml` / `public-npmjs`) | first real dispatch only for `0.1.1+` | OWNER-CONFIRMED |
| Tag / Release | **PUBLISHED** — `v0.1.0` / `OpenEditor v0.1.0` | do not recreate/move | MACHINE-VERIFIED |
| Future publish workflow | **production-ready candidate** | ChatGPT review before any dispatch | MACHINE-VERIFIED file |
| `NPM_TOKEN` | do not create | do not create for ongoing releases | OWNER-CONFIRMED |

## Why bootstrap is separate from OIDC

npm **Trusted Publishing** (GitHub Actions OIDC → npmjs, no long-lived `NPM_TOKEN`) is the intended **ongoing** path. It requires the package to **already exist** on `https://registry.npmjs.org`.

Therefore (completed):

1. **Bootstrap (once) — DONE:** human published `@hello-ai-company/editor-core@0.1.0` exactly once so the package exists.
2. **Environment — DONE:** GitHub Environment `public-npmjs` created and protected (main only; no NPM_TOKEN).
3. **Workflow foundation — DONE:** `publish-public-core.yml` exists under `.github/workflows/` (filename required before Trusted Publisher config).
4. **Trusted Publisher — OWNER-CONFIRMED DONE:** GitHub Actions → `hello-ai-company/open-editor` / `publish-public-core.yml` / Environment `public-npmjs`.
5. **Tag / Release — DONE:** `v0.1.0` → `ed59ae41ee4bd95ec01492415885f3ee2cdaaf0e`; Release `OpenEditor v0.1.0` published.
6. **Ongoing (remaining gate):** later versions publish via OIDC from the production-ready workflow after ChatGPT-independent review and a separate human gate. No `NPM_TOKEN`. Template reference: [release-templates/publish-public-core.yml](./release-templates/publish-public-core.yml).

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
→ owner creates + protects GitHub Environment public-npmjs
→ land OIDC workflow under `.github/workflows/publish-public-core.yml`
→ configure npm Trusted Publisher
→ tag / GitHub Release v0.1.0
→ subsequent releases via OIDC (0.1.1+ only, after ChatGPT + human gate)
```

Status at this document revision:

```text
Repository            PUBLIC          DONE (MACHINE-VERIFIED)
PVR                   ENABLED         DONE (MACHINE-VERIFIED)
Protect main Ruleset  ACTIVE          DONE (MACHINE-VERIFIED)
npm 0.1.0             PUBLISHED       DONE (MACHINE-VERIFIED)
D1-EXEC               EXECUTED        DONE
Environment public-npmjs              DONE (MACHINE-VERIFIED CONFIGURED)
Trusted Publisher                     DONE (OWNER-CONFIRMED CONFIGURED)
Tag / Release                         DONE (MACHINE-VERIFIED)
Future OIDC publish                   production-ready candidate — do not dispatch yet
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

### 7. Create + protect Environment `public-npmjs` — DONE

**CONFIGURED + PROTECTED** (MACHINE-VERIFIED). Deployment branches restricted to `main`. No long-lived npm publish tokens as Environment secrets (OWNER-CONFIRMED).

### 8. Land OIDC workflow foundation — DONE

`publish-public-core.yml` exists under `.github/workflows/`. Filename must remain exact (Trusted Publisher binds to it).

### 9. Configure npm Trusted Publisher — DONE (OWNER-CONFIRMED)

On the **existing** package: GitHub Actions Trusted Publisher for `hello-ai-company/open-editor`, workflow filename `publish-public-core.yml`, Environment `public-npmjs`.

### 10. Subsequent releases via OIDC

Later versions: active `.github/workflows/publish-public-core.yml` (prepare → Environment → publish; Node 24; `npm@^11`; `id-token: write` on publish job only; no token). Never auto-publish on push. Never republish `0.1.0`. First real `workflow_dispatch` requires a separate ChatGPT + human gate when package version is `0.1.1+`. Tag / GitHub Release for `v0.1.0` is already **PUBLISHED** — do not recreate.

## Historical private line (immutable)

`publish-private-core.yml` is **RETIRED**. GitHub Packages `0.0.0-phase3.e17b4b5` stays on `npm.pkg.github.com`. Do not unpublish it. Do not republish that version on npmjs.

## Historical: Explicit non-action in Phase 4E / R1 (pre-D1)

Phase 4E preparation **did not** (at that time): `npm login`, create tokens, live publish, Trusted Publisher, Environment, tag, Release, visibility change, or PVR. Those constraints applied **before** D1-EXEC. Prefer **Current vs later** above for present truth.
