# Public release checklist (planning only)

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

This is a future planning list. Completing a private gate, or recording OSS **intent**, does **not** authorize a public release.

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

## Owner philosophy (Phase 4C — recorded, not a release)

These checks record **OWNER-CONFIRMED** intent. They are **not** license application, publish, visibility, tag, Release, security contact, or chain-of-title.

- [x] Owner intends **public OSS** (intent only — see D1; execution is D1-EXEC)
- [x] Monetization philosophy: **free core + optional sponsorship only**
- [x] No paid Cloud / Enterprise / feature paywall / commercial plugin at initial launch
- [x] No mandatory payment to install / use / modify / fork / self-host / commercially use
- [x] No hosted SaaS / open-core redesign at initial launch
- [x] Sponsors get no exclusive core functionality
- [x] OSS usage must not create owner hosting/API costs
- [x] License **selection** recorded (OWNER-SELECTED FUTURE LICENSE = **MIT**) — **not applied** (`LICENSE` stays `UNLICENSED`)

## Phase 4D gate closure (docs only)

- [x] D2 selection **CLOSED** (MIT); application still required later
- [ ] D3 copyright holder (**COPYRIGHT HOLDER — OWNER ACTION REQUIRED**)
- [ ] D6 npm scope (**NPM SCOPE OWNERSHIP — OWNER ACTION REQUIRED**)
- [ ] D11 GitHub Private Vulnerability Reporting enabled (**OWNER ACTION REQUIRED**)
- [ ] D19 chain-of-title (**CHAIN-OF-TITLE — OWNER/LEGAL CONFIRMATION REQUIRED**)
- [ ] D1-EXEC (**PENDING EXECUTION AUTHORIZATION**)

## Still required before any public action (UNCHECKED)

- [ ] **public-approval** — written authorization to **execute** visibility change or publish outside the private GitHub Packages identity (D1-EXEC; **PENDING EXECUTION AUTHORIZATION**; intent ≠ execution)
- [ ] **license-application** — apply MIT to `LICENSE` / package.json / identity gates (**LICENSE APPLICATION REQUIRED**; D2 selection is CLOSED; files still `UNLICENSED`)
- [ ] **visibility** — repository remains PRIVATE until an authorized visibility change; **do not make public while UNLICENSED**
- [ ] **chain-of-title** — owner/legal confirmation the extract may be relicensed (**CHAIN-OF-TITLE — OWNER/LEGAL CONFIRMATION REQUIRED**)
- [ ] **copyright-holder** — legal entity name + year (**COPYRIGHT HOLDER — OWNER ACTION REQUIRED**; placeholder form only, not in LICENSE)
- [ ] **security-contact** — enable GitHub Private Vulnerability Reporting (**OWNER ACTION REQUIRED**; no invented email; settings not enabled in 4D)
- [ ] **npm-scope** — **NPM SCOPE OWNERSHIP — OWNER ACTION REQUIRED**
- [ ] **sponsor-destination** — **SPONSOR LINK — OWNER SETUP REQUIRED** (no `FUNDING.yml` until then)

## Explicitly out of scope here

- npmjs.org publish
- Git tags / GitHub Releases
- Version bump away from `0.0.0-phase3.e17b4b5`
- Applying MIT, Apache-2.0, or any other SPDX to `LICENSE` files
- Making the GitHub repository public
- Public fork / public merge of a release
- Editing `hello-ai-company/personal-ai`
- Auto-publish on push
- Configuring GitHub Sponsors or adding `.github/FUNDING.yml` with a fake URL
- Phase 4E / public release execution
