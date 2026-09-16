# Public release checklist (planning only)

**INTERNAL EVIDENCE** — not a public product document. Planning checklist. License application is done in Phase 4E; visibility/publish/tag remain unchecked.

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
- [x] Identity lock: `@hello-ai-company/editor-core@0.1.0` MIT on `registry.npmjs.org` (public access prepared; **not published**)
- [x] Public README (portable document layer; repo remains PRIVATE)

## Owner philosophy (Phase 4C — recorded, not a release)

These checks record **OWNER-CONFIRMED** intent. They are **not** license application, publish, visibility, tag, Release, security contact, or chain-of-title.

- [x] Owner intends **public OSS** (intent only — see D1; execution is D1-EXEC)
- [x] Monetization philosophy: **free core + optional sponsorship only**
- [x] No paid Cloud / Enterprise / feature paywall / commercial plugin at initial launch
- [x] No mandatory payment to install / use / modify / fork / self-host / commercially use
- [x] No hosted SaaS / open-core redesign at initial launch
- [x] Sponsors get no exclusive core functionality
- [x] OSS usage must not create owner hosting/API costs
- [x] License **selection** recorded (OWNER-SELECTED FUTURE LICENSE = **MIT**) — **applied in Phase 4E**

## Phase 4D.1 owner confirmations (docs only)

- [x] D2 selection **CLOSED** (MIT); **applied in Phase 4E**
- [x] D3 copyright holder **CLOSED** — `Copyright (c) 2026 Yuki Shibata`; **written into LICENSE in Phase 4E**
- [x] D6 npm scope **CLOSED** — owner controls `hello-ai-company` / `@hello-ai-company` / `@hello-ai-company/editor-core`; **no npm mutations**
- [x] D11 GitHub Private Vulnerability Reporting **PREPARED** — **ENABLE DURING PUBLIC TRANSITION**; **not enabled**; no invented email
- [x] D19 chain-of-title **CLOSED** — owner Yuki Shibata confirms relicensing authority under MIT (owner representation, not legal advice)
- [ ] D1-EXEC (**PENDING EXECUTION AUTHORIZATION**)

## Still required before any public action (UNCHECKED)

- [ ] **public-approval** — written authorization to **execute** visibility change or publish outside the private GitHub Packages identity (D1-EXEC; **PENDING EXECUTION AUTHORIZATION**; intent ≠ execution)
- [x] **license-application** — MIT applied in Phase 4E (`LICENSE`, package.json, identity gates) with `Copyright (c) 2026 Yuki Shibata`
- [ ] **visibility** — repository remains PRIVATE until an authorized visibility change (D1-EXEC)
- [x] **chain-of-title** — owner confirmation recorded (D19 **CLOSED**; not legal advice); MIT applied in Phase 4E
- [x] **copyright-holder** — recorded (D3 **CLOSED**) and written into `LICENSE` in Phase 4E
- [ ] **security-contact** — enable GitHub Private Vulnerability Reporting **during public transition** (D11 **PREPARED**; no invented email; settings not enabled)
- [x] **npm-scope** — owner-confirmed (D6 **CLOSED**); **no npm login/token/publish/register**
- [ ] **sponsor-destination** — **SPONSOR LINK — OWNER SETUP REQUIRED** (no `FUNDING.yml` until then)

## Explicitly out of scope (still)

- Real npmjs.org publish (dry-run only)
- Git tags / GitHub Releases
- Making the GitHub repository public
- Editing `hello-ai-company/personal-ai`
- Auto-publish on push
- Configuring GitHub Sponsors or adding `.github/FUNDING.yml`
- Enabling GitHub Private Vulnerability Reporting
- Phase 4F / public execution
