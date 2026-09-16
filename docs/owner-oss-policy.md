# Owner OSS policy (philosophy — not a release)

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

**Case:** ENG-20260913-007 Phase 4D.1 / PA-20260917-001  
**Status:** **OWNER-CONFIRMED** philosophy (Phase 4C) plus **OWNER-SELECTED FUTURE LICENSE = MIT** (Phase 4D; **not applied**) plus Phase 4D.1 owner confirmations (D3/D6/D19 **CLOSED**; D11 **PREPARED**).  
**This document does not authorize release.** Recording intent, license **selection**, or owner confirmations does **not** make the repository public, apply a license, publish, tag, bump a version, or configure GitHub Sponsors.

Companion: [owner-release-confirmations.md](./owner-release-confirmations.md), [license-recommendation.md](./license-recommendation.md) (MIT selected, **APPLIED: NO**), [release-gate-closure.md](./release-gate-closure.md), [public-release-decision.md](./public-release-decision.md).

## Mission

OpenEditor (`@hello-ai-company/editor-core`) should become **genuinely useful open-source software**. Anyone may use the **core** without paying — install, use, modify, fork, self-host, and (subject to the eventual license) use it commercially.

The product is a host-neutral TypeScript document model, JSON serialization, and optional provider **types**. It is not a hosted editor, not a Cloud product, and not an Enterprise SKU.

OSS product direction (Phase 4D.1, record only): a **portable document layer** shaped as **Small Core + Adapters + Docs + Examples**. Adapters are future packages outside core. This phase creates **no adapter packages** and makes **no core API change**.

Do **not** redesign this project into an open-core SaaS.

## Free OSS (OWNER-CONFIRMED)

| Statement | Status |
| --- | --- |
| Public OSS **intent** | **YES** |
| Free core — anyone uses without paying | **YES** |
| Mandatory payment to install / use / modify / fork / self-host / commercially use | **NO** |
| Paid Cloud / Enterprise / feature paywall / commercial plugin at initial launch | **NO** |
| Hosted SaaS at initial launch | **NO** |
| Sponsor-only exclusive **core** functionality | **NO** |

“Intent YES” is **not** written authorization to change GitHub visibility or to publish. Execution remains a later human-gated phase. See D1 vs D1-EXEC in [public-release-decision.md](./public-release-decision.md).

## Optional sponsorship only (OWNER-CONFIRMED)

Monetization at initial public launch, if any, is **OPTIONAL SUPPORT ONLY** (GitHub Sponsors or donations).

- Never required to install, use, modify, fork, self-host, or commercially use the core (subject to the eventual license).
- Sponsors receive **no exclusive core functionality**, no paid feature flags, and no private core APIs.
- There is **no** approved sponsor destination in this repository today.

**SPONSOR LINK — OWNER SETUP REQUIRED.** Do not invent a URL. Do not add `.github/FUNDING.yml` until the owner supplies a real, approved destination. Draft wording only: [public-drafts/README.md](./public-drafts/README.md) Support section.

## Cost principle (OWNER-CONFIRMED)

**OSS usage must not create hosting or API costs for the owner.**

The published core is a library (document + serialization + type seams). It must not call owner-operated Cloud APIs, must not require owner-hosted inference, and must not pull users onto a paid backend as a condition of using the package.

If a later product wants hosted services, that is a **separate** system — not a gate on the OSS core, and not in scope for initial launch.

## Confirmed vs still needing approval

### Confirmed in Phase 4C (philosophy only)

- Public OSS intent
- Free core; no mandatory payment
- Optional sponsorship only; no paid tiers / Cloud / Enterprise / commercial plugin at initial launch
- No hosted SaaS; no open-core redesign
- No sponsor-only exclusive core functionality
- Cost principle: OSS use must not bill the owner’s hosting/API

### Confirmed in Phase 4D (selection only — not applied)

- OWNER-SELECTED FUTURE LICENSE = **MIT** (`LICENSE` files remain `UNLICENSED`)

### Confirmed in Phase 4D.1 (record only — not applied / not enabled)

- D3 copyright line = `Copyright (c) 2026 Yuki Shibata` (**not written into `LICENSE`**)
- D6 owner controls npm org `hello-ai-company` / scope `@hello-ai-company` / target `@hello-ai-company/editor-core` (**no npm mutations**)
- D19 owner Yuki Shibata confirms relicensing authority under MIT (**owner representation, not legal advice**)
- D11 GitHub Private Vulnerability Reporting **PREPARED** — enable during public transition (**not enabled now**)
- OSS product direction: portable document layer; Small Core + Adapters + Docs + Examples

### Still needing later authorization (blocks publish, not this docs merge)

| Item | Flag |
| --- | --- |
| License **application** (`LICENSE` files, `package.json`, identity gates) | **LICENSE APPLICATION REQUIRED** — later phase; **APPLIED TO LICENSE FILES NO** |
| Copyright holder legal name + year (D3) | **CLOSED** — line recorded; **DO NOT write into LICENSE yet** |
| SPDX / NOTICE / CLA or DCO (D4) | PENDING |
| npm org `@hello-ai-company` on npmjs (D6) | **CLOSED** — owner-confirmed control; **no npm login/token/publish/register** |
| Security contact (D11) | **PREPARED** — prefer GitHub Private Vulnerability Reporting; **ENABLE DURING PUBLIC TRANSITION**; **not enabled**; no invented email |
| Chain-of-title for the `personal-ai` extract (D19) | **CLOSED** — owner representation, not legal advice |
| Visibility, npmjs publish, version bump, tag, GitHub Release | **PENDING EXECUTION AUTHORIZATION** (D1-EXEC) |
| Trusted publishing / provenance (D15) | PENDING — do not configure secrets now |
| `personal-ai` consumer migration (D16) | PENDING — **do not edit** that repo from here |
| GitHub Sponsors / FUNDING.yml destination | **SPONSOR LINK — OWNER SETUP REQUIRED** |

## What Phase 4D.1 did not do

Did not publish, tag, Release, apply MIT/Apache/GPL, write the copyright line into `LICENSE`, change visibility, rename, bump version, register an npm org, edit `personal-ai`, modify `packages/core/src/**`, change `LICENSE` files, add `.github/FUNDING.yml`, invent a sponsor URL or security email, enable GitHub security settings, create adapter packages, or start Phase 4E / public release.
