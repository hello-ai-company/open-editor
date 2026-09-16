# License decision (comparison only)

**INTERNAL EVIDENCE** — not a public product document. Historical comparison. Live SPDX is **MIT** as of Phase 4E.

This note compares common options for a **future** human decision. It does **not** select a license. `LICENSE` and `packages/core/LICENSE` remain **UNLICENSED**. All rights reserved.

Phase 4D.1: **OWNER-SELECTED FUTURE LICENSE = MIT**. **APPLIED TO LICENSE FILES: NO.** Copyright line recorded (`Copyright (c) 2026 Yuki Shibata`) but **not written into LICENSE**. Apache-2.0 remains a documented fallback only. See [license-recommendation.md](./license-recommendation.md). D2 **selection** is **CLOSED**; application is later.

| Option | What it would mean | Not selected |
| --- | --- | --- |
| Remain `UNLICENSED` | Private proprietary distribution only; no public reuse grant | Current state. No change. |
| MIT | Permissive reuse, including proprietary forks; short notice-preservation duty | **OWNER-SELECTED** — not applied |
| Apache-2.0 | Permissive plus explicit patent grant and NOTICE rules | Recommended **FALLBACK** — not applied |
| BUSL / delayed OSS | Use restrictions until a change date | Incompatible with confirmed genuine-OSS intent |
| Copyleft (GPL family) | Downstream source-sharing obligations | Poor fit for an embeddable library; not selected |

No SPDX identifier other than the current `UNLICENSED` field may be applied without a separate authorization. Public release, npmjs publish, and visibility changes are not implied by this comparison.
