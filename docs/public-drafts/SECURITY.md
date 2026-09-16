# Security policy (draft)

> **DRAFT — NOT IN EFFECT.** Stored at `docs/public-drafts/SECURITY.md`. This is not a live GitHub Security Policy. The repository remains PRIVATE and `UNLICENSED`.

## Preferred future channel (not enabled)

**GitHub Private Vulnerability Reporting** is the preferred future disclosure method. It is **PREPARED** and **not enabled**. Enable during public transition. Do not invent a `security@` address.

## SECURITY CONTACT — PREPARED

No live security contact exists in this repository today:

- No root `SECURITY.md`
- No `security@…` address in-repo
- No GitHub Private Vulnerability Reporting **enabled** (preference recorded in [security-release-gate.md](../security-release-gate.md); settings unchanged)
- `docs/security-boundary.md` is a **tarball / host-leakage** boundary, not a disclosure policy

**Do not publish the repository or invite external researchers until GitHub Private Vulnerability Reporting is enabled during public transition and a real `SECURITY.md` is published at the repository root.**

| Field | Value |
| --- | --- |
| Contact email | **None invented.** Supply a real address later only if the owner has one. Do not invent. |
| GitHub private vulnerability reporting | **Preferred.** D11 **PREPARED** — **ENABLE DURING PUBLIC TRANSITION** (not enabled in Phase 4D.1) |
| PGP / alternative | **OWNER DECISION REQUIRED** |
| Supported versions (once public) | **OWNER DECISION REQUIRED** |
| Target first response | **OWNER DECISION REQUIRED** |
| Coordination with `personal-ai` host | **OWNER DECISION REQUIRED** |

Until those fields are set, vulnerability reports have **no documented destination**.

## What this package handles

`@hello-ai-company/editor-core` is a document + serialization + provider-**type** library. It does not implement auth, HTTP, or persistence. Typical issues:

- Prototype pollution or unsafe JSON handling in deserialize (if found)
- Breaking schema validation (accepting `schemaVersion` other than `1`)
- Shipping host/product identifiers or secrets in the tarball (regression of `scripts/security-scan.mjs`)

## What not to report here

- Bugs in `hello-ai-company/personal-ai` host UI, native bridges, or backends — report in that product’s channel (owner-defined)
- Dependency CVEs in **dev** tools (TypeScript, Vitest) that are not shipped in the tarball, unless they affect published `dist/`

## Private phase process

While the repo is private, treat findings as internal:

1. Do not file a public GitHub issue.
2. Do not include secrets in tickets.
3. Use GitHub Private Vulnerability Reporting once D11 is enabled during public transition (`docs/owner-release-confirmations.md`).

## Please do not

- Open a public issue with an exploit
- Publish, tag, or Release as a “security fix” without the owner runbook
- Weaken `scripts/inspect-tarball.mjs` / `scripts/security-scan.mjs` to hide a finding
