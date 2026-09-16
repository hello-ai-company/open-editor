# First public publish bootstrap

**INTERNAL EVIDENCE / OPS** — not a public product document.

**Case:** ENG-20260913-007 Phase 4E / PA-20260917-002  
**Role:** Document how the **first** npmjs publish of `@hello-ai-company/editor-core@0.1.0` can be bootstrapped. **Do not execute.** Do not create npm tokens.

Phase 4E prepares metadata and a **template** workflow only. D1-EXEC remains **PENDING EXECUTION AUTHORIZATION**. This file is not permission to publish.

## Why bootstrap is required

npm **trusted publishing** (GitHub Actions OIDC → npmjs, no long-lived `NPM_TOKEN`) is the intended ongoing path.

For a **brand-new** package, npm typically needs a one-time human bootstrap before OIDC can publish on its own:

1. The npm org `hello-ai-company` / scope `@hello-ai-company` must exist and be owned (D6 **CLOSED** as owner confirmation; claiming/creating it on npmjs, if still required, is a public-transition step).
2. The package `@hello-ai-company/editor-core` must exist on `https://registry.npmjs.org` **or** the first publish must be performed by an org member who can create that package.
3. After the package exists, configure a **trusted publisher** on npmjs pointing at this GitHub repository and the future publish workflow. Then OIDC (`id-token: write`) can publish later versions without a token.

Do **not** create a long-lived npm automation token. Do **not** store `NPM_TOKEN` in GitHub secrets for this project.

## Intended order (later phase; not Phase 4E)

1. Written **D1-EXEC**.
2. Confirm this tree is MIT + `@hello-ai-company/editor-core@0.1.0` + `publishConfig` npmjs public (already prepared here).
3. Enable GitHub Private Vulnerability Reporting (D11 **PREPARED**).
4. Human bootstrap on npmjs (org membership + first package creation). Prefer the npm website / interactive owner session — **not** a CI token.
5. Configure npm trusted publisher → GitHub repo `hello-ai-company/open-editor`, workflow from [release-templates/publish-public-core.yml](./release-templates/publish-public-core.yml) once copied under `.github/workflows/` in that later phase.
6. Only then: `workflow_dispatch` publish of `0.1.0` with `--access public` and provenance.
7. Tag / GitHub Release only after the published version exists.
8. Repository visibility public only after MIT is already applied (it is applied in this tree) **and** D1-EXEC.

The retired private workflow `publish-private-core.yml` must **not** be re-enabled. The historical GitHub Packages prerelease `0.0.0-phase3.e17b4b5` stays immutable on `npm.pkg.github.com`. Do not unpublish it. Do not republish that version on npmjs.

## Explicit non-action in Phase 4E

- No `npm login`
- No npm token create/use
- No `npm publish` except `--dry-run`
- No Trusted Publisher configuration in the npm UI
- No copy of this template into `.github/workflows/`
- No GitHub Environment `public-npmjs` created
- No tag, Release, or visibility change
