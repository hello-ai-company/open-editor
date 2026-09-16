# Public release checklist (planning only)

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

This is a future planning list. Completing a private gate does **not** authorize a public release.

## Private readiness (this repository)

- [x] Single package SoT at `packages/core`
- [x] Public API contract (`docs/public-api.md` + `packages/core/contracts/public-api.json`)
- [x] Provider method contract (`packages/core/contracts/provider-contract.json`)
- [x] Package document/serialization contract tests
- [x] Tarball allowlist / denylist inspect
- [x] Isolated consumer install from tarball (typecheck + runtime)
- [x] Security scan of src + dist + tarball
- [x] Machine-verified API contract against the installed tarball
- [x] Identity lock: `@hello-ai-company/editor-core@0.0.0-phase3.e17b4b5` UNLICENSED on `npm.pkg.github.com`
- [x] README private banner retained

## Still required before any public action (UNCHECKED)

- [ ] **public-approval** — written authorization to change visibility or publish outside the private GitHub Packages identity
- [ ] **license** — human selection and application of an OSS license (`LICENSE` stays `UNLICENSED` until then)
- [ ] **visibility** — repository remains PRIVATE until an authorized visibility change

## Explicitly out of scope here

- npmjs.org publish
- Git tags / GitHub Releases
- Version bump away from `0.0.0-phase3.e17b4b5`
- Public fork / public PR
- Editing `hello-ai-company/personal-ai`
- Auto-publish on push
