# Contributing

Thanks for considering a contribution to OpenEditor (`@hello-ai-company/editor-core`).

v0.1.0 does **not** require a CLA or DCO. By opening a pull request you license your contribution under the MIT License (Copyright (c) 2026 Yuki Shibata).

## Prerequisites

- Node.js 20 or 22
- `npm ci` from the repository root

## Local gates

```bash
npm ci
npm run verify
```

`verify` runs typecheck, tests, build, pack, tarball inspect, isolated consumer, security scan, and API contract.

## Scope

| Welcome | Not in this repository |
| --- | --- |
| Bug fixes inside the frozen document/serialization contract | Runtime dependencies |
| Tests and docs that match `docs/public-api.md` | Host UI, React, adapter packages |
| Additive **optional** provider methods only with a contract update | Secrets, `.env`, product identifiers from other apps |
| | Version / license / registry edits without an explicit release issue |

Public API changes require updating:

- `packages/core/src` **and**
- `packages/core/contracts/public-api.json` / `provider-contract.json` **and**
- `docs/public-api.md`

Unknown block `type` strings must still round-trip. `schemaVersion` remains the positive integer `1` unless a separate migration is designed.

Do not publish, tag, or change GitHub visibility from a contribution PR.

## Pull requests

1. One topic per PR.
2. Do not include `dist/` churn unless the change is a release PR.
3. Target `main`. CI must pass on Node 20 and 22.

Sponsorship, if later offered, is optional and is never a condition of contributing. `.github/FUNDING.yml` is absent until an owner-approved destination exists.
