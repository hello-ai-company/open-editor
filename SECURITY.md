# Security policy

Please report vulnerabilities in `@hello-ai-company/editor-core` through **GitHub Private Vulnerability Reporting** on this repository.

## Current status (D11)

| Field | Value |
| --- | --- |
| Preferred channel | GitHub Private Vulnerability Reporting |
| Enabled now | **NO** |
| When to enable | **DURING PUBLIC TRANSITION** |
| Email | **None invented.** Do not invent a `security@` address. |

**D11 PREPARED — ENABLE DURING PUBLIC TRANSITION.** This file documents the path. It does not enable GitHub security settings. Private Vulnerability Reporting must be turned on in the GitHub UI as part of making the repository public. Do not file a public issue for an unfixed vulnerability.

## Supported versions (once public)

| Version | Supported |
| --- | --- |
| `0.1.0` (prepared public line) | Yes |
| `0.0.0-phase3.e17b4b5` (historical private GitHub Packages prerelease) | Internal only; not a public line |

## What this package handles

`@hello-ai-company/editor-core` is a document + serialization + provider-**type** library. It does not implement auth, HTTP, or persistence. Typical issues:

- Prototype pollution or unsafe JSON handling in deserialize (if found)
- Breaking schema validation (accepting `schemaVersion` other than `1`)
- Shipping host/product identifiers or secrets in the tarball

## Please do not

- Open a public issue with an exploit
- Invent a security email
- Publish, tag, or Release as a “security fix” without the owner runbook
- Weaken `scripts/inspect-tarball.mjs` / `scripts/security-scan.mjs` to hide a finding
