# Public release preparation (Phase 4E)

**INTERNAL EVIDENCE** — not a public product document.

**Case:** ENG-20260913-007 Phase 4E / PA-20260917-002  
**Role:** Record what Phase 4E applied to make a **public-ready** v0.1.0 source tree while the repository stays **PRIVATE**.

This phase is **not** public execution. D1-EXEC remains **PENDING EXECUTION AUTHORIZATION**.

## Applied identity

| Field | Value | Applied |
| --- | --- | --- |
| Repository | `hello-ai-company/open-editor` | unchanged |
| Visibility | PRIVATE | **unchanged** — must remain PRIVATE |
| Package | `@hello-ai-company/editor-core` | unchanged name |
| Version | `0.1.0` | YES |
| License | MIT — `Copyright (c) 2026 Yuki Shibata` | YES |
| Registry | `https://registry.npmjs.org` | YES (metadata only) |
| Access | public | YES (`publishConfig`) |
| Root workspace | `"private": true` | YES — never publishable |
| `packages/core/src/**` | frozen | **not modified** |

## Hard gate

[public-exposure-audit.md](./public-exposure-audit.md) — P1 none; P2 historical UNLICENSED / phase IDs / provenance docs; **CLEAR** for public-history exposure blocker.

## Not executed

Make PUBLIC; real `npm publish`; tag; GitHub Release; enable Private Vulnerability Reporting; create npm tokens; configure Trusted Publisher; FUNDING.yml; adapters; Personal AI edits; Phase 4F.
