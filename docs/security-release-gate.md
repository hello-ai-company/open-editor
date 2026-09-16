# Security release gate (Phase 4D / 4D.1)

**PRIVATE EXTRACTION WORKSPACE — NOT AUTHORIZED FOR PUBLIC RELEASE**

**Case:** ENG-20260913-007 Phase 4D.1 / PA-20260917-001  
**Role:** Classify the public-security-contact gate. **Do not** invent an email. **Do not** enable GitHub security settings, Private Vulnerability Reporting, or a live `SECURITY.md` in this phase.

Gate **D11** classification: **PREPARED** — **ENABLE DURING PUBLIC TRANSITION**.

## Preference (record only; not enabled)

**Preferred future disclosure channel:** GitHub **Private Vulnerability Reporting** (repository Security advisories / private reporting).

Rationale: no validated public `security@` address exists. Inventing `security@hello-ai-company.com` (or similar) would publish a fake contact. GitHub PVR keeps reports inside GitHub without requiring a new mailbox.

Preference ≠ configuration. This phase **did not** enable PVR.

## Honest current state

| Check | Result |
| --- | --- |
| Root `SECURITY.md` | Absent |
| `docs/public-drafts/SECURITY.md` | Draft only; **not in effect** |
| In-repo security email | **None** — none invented |
| GitHub Private Vulnerability Reporting | **Not enabled** |
| Latest GitHub Release | none |
| Tags | none |
| `.github/FUNDING.yml` | absent (unrelated; must stay absent) |
| `docs/security-boundary.md` | Tarball / host-leakage boundary — **not** a disclosure policy |

Phase 4D read-only GitHub checks (2026-09-16): `isSecurityPolicyEnabled` false; private-vulnerability-reporting API 404; `security_and_analysis` null. Settings were **not** changed in 4D.1 either.

## Why D11 is PREPARED (not CLOSED, not OWNER ACTION REQUIRED)

1. Preferred method is recorded: GitHub Private Vulnerability Reporting.
2. No owner-supplied email exists; none invented.
3. Enabling settings is **forbidden** in Phase 4D.1.
4. Owner instruction: **enable during public transition**, not now.

D11 is therefore **PREPARED**. Enablement is an execution step of public transition (after written D1-EXEC), not a remaining confirmation blocker.

## Recommended future SECURITY.md (do not install now)

When D11 is actually enabled during public transition:

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
