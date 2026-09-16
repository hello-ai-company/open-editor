# Contributing (draft)

> **DRAFT — NOT IN EFFECT.** Stored at `docs/public-drafts/CONTRIBUTING.md`. The repository is a private extraction workspace. Public contribution is **not authorized**. Do not open public PRs or forks until an owner changes visibility and applies this (or a replacement) guide.

## Current reality

- Repo: `hello-ai-company/open-editor` (PRIVATE)
- Package: `@hello-ai-company/editor-core@0.0.0-phase3.e17b4b5` (`UNLICENSED`, GitHub Packages)
- Source of truth: `packages/core`
- Do not send changes to `hello-ai-company/personal-ai` from this project

## If/when public contribution is authorized

### Prerequisites

- Node.js 20 or 22
- `npm ci` from the repository root

### Local gates (must pass)

```bash
npm ci
npm run verify
```

`verify` runs typecheck, tests, build, pack, tarball inspect, isolated consumer, security scan, and API contract.

### Scope

| Welcome (after public authorization) | Not welcome |
| --- | --- |
| Bug fixes inside the frozen document/serialization contract | Runtime dependencies |
| Tests and docs that match `docs/public-api.md` | Host UI, React, BlockNote, Swift, adapters |
| Additive **optional** provider methods only with a contract update | Forbidden host methods (`openEmployees`, …) |
| | Secrets, `.env`, product identifiers (`personal-ai`, `Secretary`, …) |
| | Version bumps, license edits, registry edits without owner issues |

Public API changes require updating:

- `packages/core/src` **and**
- `packages/core/contracts/public-api.json` / `provider-contract.json` **and**
- `docs/public-api.md`

Unknown block `type` strings must still round-trip. `schemaVersion` remains the positive integer `1` unless a separate migration is designed.

### Contributor terms (OWNER DECISION PENDING)

Choose one before accepting external PRs:

| Option | Meaning |
| --- | --- |
| DCO (`Signed-off-by`) | Lightweight certification of origin |
| CLA | Separate contributor agreement |
| Neither | Only org members commit (stay private-like) |

**Owner Decision: PENDING.**

### Pull requests

1. One topic per PR.
2. Do not include `dist/` churn unless the change is a release PR in an authorized phase.
3. Do not publish, tag, or change `packages/core/package.json` identity fields unless the PR is explicitly that authorized release.

Issue and PR templates are recommended in `docs/repository-governance.md` and are **not** installed in `.github/` in Phase 4B.
