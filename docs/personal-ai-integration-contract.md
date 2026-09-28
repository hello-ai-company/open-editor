# Personal AI ↔ OpenEditor integration contract

Current integration snapshot (2026-09-28). This document does **not** authorize a production editor switch, merge, or package publish.

## Packages

| Package | Version | Role | Registry status |
| --- | --- | --- | --- |
| `@hello-ai-company/editor-core` | `0.1.1` | Document model, serialization, provider types | Published on npm |
| `@hello-ai-company/editor-blocknote` | `0.1.0` | BlockNote adapter / power layer | Published on npm; depends on core `^0.1.1` |
| `@hello-ai-company/editor-ai`, `editor-canvas`, `editor-publish` | `0.1.0` | Experimental agent/suggestion, responsive layout, static publishing contracts | In-repo only; not published |

The first-publish sequence formerly described here is complete for `editor-core` and `editor-blocknote`. This change does not publish the new experimental packages.

## Dependency direction

```text
Personal AI app
  → @hello-ai-company/editor-blocknote   (optional; requires BlockNote ^0.54.2)
      → @hello-ai-company/editor-core
  → @hello-ai-company/editor-core        (providers / document model; BlockNote-agnostic)
```

Never reverse the arrow (core must not import blocknote). Never use `file:` / local tarball as a **production** dependency.

## BlockNote peers

| Host | Required peers |
| --- | --- |
| OpenEditor power layer | `@blocknote/core@^0.54.2`, `@blocknote/react@^0.54.2` |
| Personal AI (current) | `^0.54.2` — matches `editor-blocknote` peers |

See [blocknote-compat.md](./blocknote-compat.md) for the compile/test matrix and decision.

## Provider seams (editor-core)

Hosts implement optional `EditorProviders` (see [providers.md](./providers.md)):

- `PageProvider`, `DatabaseProvider`, `BacklinkProvider`
- `AssetProvider`, `CommentsProvider`, `VersionProvider`, `AIProvider`
- Database view host seams: `onOpenRow`, `resolveRowMedia`, `resolveFeedRowMedia`, `resolveMapLocation`

Rules:

- Opaque `rowKey` / ids are host strings — no numeric ID invention
- Structured filters / `propertySort` without server backing → fail closed; do not advertise `queryCapabilities`
- OpenEditor stores references + view config in `EditorDocument`; the host owns entities/rows

## Shadow / guarded mount

| Rule | Requirement |
| --- | --- |
| Default | Legacy Personal AI editor remains the production writer |
| Shadow | OpenEditor mount **off** by default; read-only when enabled |
| Opt-in | Explicit guarded flag; single-writer; no dual-write |
| Writable | Guarded by the single-writer lease and production dual gate |
| Production switch | Legacy editor remains the default production writer |

## License boundary

- `@hello-ai-company/*` — MIT
- Allowed BlockNote runtime — `@blocknote/{core,react}` (+ optional `math-block` / `diagram-block` / `code-block`) MPL-2.0
- Forbidden — `@blocknote/xl-*` (GPL/proprietary). The Personal AI branch in this change removes `@blocknote/xl-multi-column` and replaces its use with independent CSS Grid/BlockNote code; no XL source is copied or adapted.

## Agent bridge

Personal AI sends explicit user-authored instructions through `instructSecretary` → Work Intake. It does not create `AgentTask` directly or execute tools from the editor. A bounded `EditorAgentContext` carries the exact `EditorDocument` snapshot and declared revision separately from trusted instruction text; document, references, search material, and comments remain untrusted. Server-side proposal construction follows Secretary → specialist → Reviewer and validates a structured `SuggestionGroup`; the browser parses and bounds it, checks the base revision, and requires group-level human acceptance before canonical note persistence. Stale proposals fail closed. The current local provider is `stub`, so the mounted agent proposal/review golden flow and prompt-injection browser E2E remain unverified.

The Personal-AI note workspace also mounts Canvas, Present, and Site. Browser evidence verifies Canvas persistence and Site viewport rendering, while the one-slide fixture did not verify slide stepping or fullscreen. Ask This Page is shown only for connected API-backed public notes and still needs a public-fixture browser check. The R3 product loop is partial until the provider, registry releases, and remaining browser gates are available.

## Publication / release guards (editor-blocknote)

Release-ready checklist:

- [x] `private` removed; `publishConfig` → npmjs public
- [x] MIT `LICENSE` with copyright line
- [x] Peer floor `^0.54.2` locked by publish-gate + release script
- [x] Core dependency floor `^0.1.1` + fail-closed publish-order gate (core meeting `^0.1.1` must already be on npmjs)
- [x] `npm pack` + `scripts/inspect-blocknote-tarball.mjs`
- [x] `npm publish --dry-run` only (no real publish)
- [x] Registry guard: npm **404** → first-publish eligible; network/other failures → **fail-closed STOP**
- [x] Immutable artifact path: `scripts/release/validate-public-blocknote-release.mjs` (`pack` / `verify-artifact`)
- [x] Manual OIDC workflow candidate: `.github/workflows/publish-public-blocknote.yml` (mirrors core; Environment `public-npmjs`)

**TRUSTED PUBLISHER: OWNER CONFIGURATION REQUIRED** — bind npm Trusted Publisher to `publish-public-blocknote.yml` + Environment `public-npmjs` before first `workflow_dispatch`. Do not claim npm-side TP is configured from repo files alone.

**Do not** `npm publish`, tag, or Release until ChatGPT review + owner authorization.

R3 adds separate main-only manual OIDC workflows for `editor-ai@0.1.0`,
`editor-canvas@0.1.0`, and `editor-publish@0.1.0`; the expanded preflight covers
all three. They are fail-closed and were not dispatched. See
[PUBLISHING.md](./PUBLISHING.md) for the release order, gates, registry state,
and owner-side Trusted Publisher configuration requirement.

## Verification commands (OpenEditor)

```bash
npm ci
npm run verify
npm run test:release-guards
npm run verify:isolated-blocknote
npm run compat:blocknote
npm run pack:blocknote
npm run inspect:blocknote-tarball
npm run publish:dry-run:blocknote
```
