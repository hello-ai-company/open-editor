# Security release gate (Phase 4D)

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

**Case:** ENG-20260913-007 Phase 4D / PA-20260916-004  
**Role:** Classify the public-security-contact gate. **Do not** invent an email. **Do not** enable GitHub security settings, Private Vulnerability Reporting, or a live `SECURITY.md` in this phase.

Gate **D11** classification: **OWNER ACTION REQUIRED**.

## Preference (record only; not enabled)

**Preferred future disclosure channel:** GitHub **Private Vulnerability Reporting** (repository Security advisories / private reporting), once the owner enables it in GitHub settings in an authorized later phase.

Rationale: no validated public `security@` address exists. Inventing `security@hello-ai-company.com` (or similar) would publish a fake contact. GitHub PVR keeps reports inside GitHub without requiring a new mailbox.

Preference ≠ configuration. This phase **did not** enable PVR.

## Honest current state (2026-09-16, read-only)

| Check | Result |
| --- | --- |
| Root `SECURITY.md` | Absent |
| `docs/public-drafts/SECURITY.md` | Draft only; **not in effect** |
| In-repo security email | **None** — none invented |
| GitHub `isSecurityPolicyEnabled` | `false` |
| GitHub `securityPolicyUrl` | empty |
| `GET …/private-vulnerability-reporting` | 404 Not Found |
| `security_and_analysis` | `null` |
| Latest GitHub Release | none |
| Tags | none |
| `.github/FUNDING.yml` | absent (unrelated; must stay absent) |
| `docs/security-boundary.md` | Tarball / host-leakage boundary — **not** a disclosure policy |

## Why D11 is not CLOSED

1. Preferred method is recorded, but GitHub Private Vulnerability Reporting is **not enabled**.
2. No owner-supplied email exists to list as a backup contact.
3. Enabling settings is **forbidden** in Phase 4D.
4. Public visibility without a working disclosure path would leave researchers with **no documented destination**.

**OWNER ACTION REQUIRED:** owner enables GitHub Private Vulnerability Reporting on `hello-ai-company/open-editor` (and, if desired later, supplies a real email). Then a later authorized phase may promote a real root `SECURITY.md`.

## Recommended future SECURITY.md (do not install now)

When D11 is actually enabled by the owner:

1. Keep GitHub Private Vulnerability Reporting as the primary channel.
2. List an email **only** if the owner provides a real, monitored address — never invent one.
3. Scope reports to `@hello-ai-company/editor-core` (document/serialization/provider types). Host bugs belong in `personal-ai` channels defined by that product’s owners.
4. Do not file public GitHub issues for unfixed vulnerabilities.

Draft text remains at [public-drafts/SECURITY.md](./public-drafts/SECURITY.md).

## Package security posture (private gates; already true)

These are **not** a substitute for D11:

- `scripts/security-scan.mjs` on `src` + `dist` + tarball
- Tarball allowlist / denylist (`scripts/inspect-tarball.mjs`)
- Zero production dependencies / `npm audit --omit=dev` in the scan
- No secrets in the published artifact (enforced)

They remain private extraction gates. They do not create a public disclosure contact.

## Explicit non-action

Did not: invent an email; enable Private Vulnerability Reporting; add root `SECURITY.md`; change GitHub security or analysis settings; configure Dependabot; add Sponsors; change branch protection.
