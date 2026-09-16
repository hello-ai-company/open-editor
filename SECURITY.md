# Security policy

Report vulnerabilities in `@hello-ai-company/editor-core` through **GitHub Private Vulnerability Reporting** on this repository **once that feature is enabled**.

This repository is still **private**. GitHub Private Vulnerability Reporting is a **public-repository** feature and is **not enabled**. There is no invented `security@` address. Do not file a public issue for an unfixed vulnerability.

When the repository is made public, enable Private Vulnerability Reporting immediately and use it as the preferred channel.

## Supported versions

| Version | Supported |
| --- | --- |
| `0.1.0` | Yes (prepared public line; not yet published to npmjs) |
| `0.0.0-phase3.e17b4b5` | Historical private GitHub Packages prerelease only |

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
