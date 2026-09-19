# Personal AI ↔ OpenEditor integration contract (Phase 4F-5B)

Host-neutral contract for integrating OpenEditor packages into Personal AI.
This document does **not** authorize production editor switch, merge, or npm publish.

## Packages

| Package | Version | Role | Registry status |
| --- | --- | --- | --- |
| `@hello-ai-company/editor-core` | `0.1.1` candidate (`0.1.0` published, immutable) | Document model, serialization, provider types | **0.1.1 not published** until post-merge on main |
| `@hello-ai-company/editor-blocknote` | `0.1.0` | BlockNote adapter / power layer | **Release-ready, not published**; depends on core `^0.1.1` |

Sequence: **R2 review → merge #23 → main publishes core → registry prove → publish blocknote → PA integration**. This PR does **not** `npm publish`, tag, or Release. Do not require published `0.1.1` before merge.

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
| Personal AI (current) | `^0.52.1` — **incompatible** with `editor-blocknote` peers |

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

## Shadow / guarded mount (forward contract for 5D–5E)

| Rule | Requirement |
| --- | --- |
| Default | Legacy Personal AI editor remains the production writer |
| Shadow | OpenEditor mount **off** by default; read-only when enabled |
| Opt-in | Explicit guarded flag; single-writer; no dual-write |
| Writable | Dev-only until parity harness + owner gate |
| Production switch | **Not** performed in 5B |

## License boundary

- `@hello-ai-company/*` — MIT
- Allowed BlockNote runtime — `@blocknote/{core,react}` (+ optional `math-block` / `diagram-block` / `code-block`) MPL-2.0
- Forbidden — `@blocknote/xl-*` (GPL/proprietary). Must never appear in deps or imports.

## Publication / release guards (editor-blocknote)

Release-ready checklist (5B):

- [x] `private` removed; `publishConfig` → npmjs public
- [x] MIT `LICENSE` with copyright line
- [x] Peer floor `^0.54.2` locked by publish-gate + release script
- [x] `npm pack` + `scripts/inspect-blocknote-tarball.mjs`
- [x] `npm publish --dry-run` only (no real publish)
- [x] Registry guard treats current npm **404** as first-publish eligible

**Do not** `npm publish`, tag, or enable Trusted Publisher for this package until owner authorization.

## Verification commands (OpenEditor)

```bash
npm ci
npm run verify
npm run compat:blocknote
npm run pack:blocknote
npm run inspect:blocknote-tarball
npm run publish:dry-run:blocknote
```
