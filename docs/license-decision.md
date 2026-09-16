# License decision (comparison only)

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

This note compares common options for a **future** human decision. It does **not** select a license. `LICENSE` and `packages/core/LICENSE` remain **UNLICENSED**. All rights reserved.

Phase 4C engineering recommendation (still **not applied**): [license-recommendation.md](./license-recommendation.md) — **PRIMARY MIT**, **FALLBACK Apache-2.0**. D2 remains **PENDING**.

| Option | What it would mean | Not selected |
| --- | --- | --- |
| Remain `UNLICENSED` | Private proprietary distribution only; no public reuse grant | Current state. No change. |
| MIT | Permissive reuse, including proprietary forks; short notice-preservation duty | Recommended **PRIMARY** — not applied |
| Apache-2.0 | Permissive plus explicit patent grant and NOTICE rules | Recommended **FALLBACK** — not applied |
| BUSL / delayed OSS | Use restrictions until a change date | Incompatible with confirmed genuine-OSS intent |
| Copyleft (GPL family) | Downstream source-sharing obligations | Poor fit for an embeddable library; not selected |

No SPDX identifier other than the current `UNLICENSED` field may be applied without a separate authorization. Public release, npmjs publish, and visibility changes are not implied by this comparison.
