# Owner OSS policy (philosophy — not a release)

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

**Case:** ENG-20260913-007 Phase 4D / PA-20260916-004  
**Status:** **OWNER-CONFIRMED** philosophy (Phase 4C) plus **OWNER-SELECTED FUTURE LICENSE = MIT** (Phase 4D; **not applied**).  
**This document does not authorize release.** Recording intent or license **selection** does **not** make the repository public, apply a license, publish, tag, bump a version, or configure GitHub Sponsors.

Companion: [license-recommendation.md](./license-recommendation.md) (MIT selected, **APPLIED: NO**), [release-gate-closure.md](./release-gate-closure.md), [public-release-decision.md](./public-release-decision.md).

## Mission

OpenEditor (`@hello-ai-company/editor-core`) should become **genuinely useful open-source software**. Anyone may use the **core** without paying — install, use, modify, fork, self-host, and (subject to the eventual license) use it commercially.

The product is a host-neutral TypeScript document model, JSON serialization, and optional provider **types**. It is not a hosted editor, not a Cloud product, and not an Enterprise SKU.

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

### Still needing owner / legal / ops approval (blocks public release, not this docs merge)

| Item | Flag |
| --- | --- |
| License **application** (`LICENSE` files, `package.json`, identity gates) | **LICENSE APPLICATION REQUIRED** — later phase; **APPLIED TO LICENSE FILES NO** |
| Copyright holder legal name + year (D3) | **OWNER ACTION REQUIRED** — **COPYRIGHT HOLDER — OWNER ACTION REQUIRED** |
| SPDX / NOTICE / CLA or DCO (D4) | PENDING |
| npm org `@hello-ai-company` on npmjs (D6) | **OWNER ACTION REQUIRED** — **NPM SCOPE OWNERSHIP — OWNER ACTION REQUIRED** |
| Security contact (D11) | **OWNER ACTION REQUIRED** — prefer GitHub Private Vulnerability Reporting; **not enabled**; no invented email |
| Chain-of-title for the `personal-ai` extract (D19) | **OWNER/LEGAL CONFIRMATION REQUIRED** — **CHAIN-OF-TITLE — OWNER/LEGAL CONFIRMATION REQUIRED** |
| Visibility, npmjs publish, version bump, tag, GitHub Release | PENDING — irreversible; later phase |
| Trusted publishing / provenance (D15) | PENDING — do not configure secrets now |
| `personal-ai` consumer migration (D16) | PENDING — **do not edit** that repo from here |
| GitHub Sponsors / FUNDING.yml destination | **SPONSOR LINK — OWNER SETUP REQUIRED** |

## What Phase 4D did not do

Did not publish, tag, Release, apply MIT/Apache/GPL, change visibility, rename, bump version, register an npm org, edit `personal-ai`, modify `packages/core/src/**`, change `LICENSE` files, add `.github/FUNDING.yml`, invent a sponsor URL or security email, enable GitHub security settings, or start Phase 4E / public release.
