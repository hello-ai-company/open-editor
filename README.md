# OpenEditor

OpenEditor is a reusable editor platform built around a small portable document core. BlockNote is one editing adapter; host-specific AI, agent, canvas, and publishing behavior stays outside the core.

The public package is [`@hello-ai-company/editor-core`](./packages/core). It is a small TypeScript core: a versioned document model, JSON serialization, and optional provider **types**. Host UI, React, BlockNote, and other adapters are out of scope for this package.

## Status

| Item | Value |
| --- | --- |
| Repository | **PUBLIC** — https://github.com/hello-ai-company/open-editor |
| Package (published) | Five `@hello-ai-company/editor-*` packages at `0.2.0` on npmjs (**immutable**) |
| Package (workspace) | Five packages at `0.2.0` |
| Published packages | core/blocknote/ai/canvas/publish `0.2.0` (registry verified 2026-10-06) |
| License | MIT — Copyright (c) 2026 Yuki Shibata |
| Registry | https://registry.npmjs.org (`publishConfig.access`: public) |
| Current release | `0.2.0`; see [release verification](./docs/release-0.2.md), [changes](./CHANGELOG.md) and [migration](./docs/migration-0.2.md) |
| Runtime dependencies (core) | none |

See the [0.2.0 release record](./docs/release-0.2.md) for official artifacts,
registry consumers, signature verification and the AI workflow recovery.

## Install

Published line (registry):

```bash
npm install @hello-ai-company/editor-core@0.2.0
```

Requirements: Node.js `>=20`, ESM (`"type": "module"`). There is no CommonJS `require` export.

## Quickstart

```ts
import {
  createEditorDocument,
  serializeEditorDocument,
  deserializeEditorDocument
} from "@hello-ai-company/editor-core";

const doc = createEditorDocument([
  {
    id: "p1",
    type: "paragraph",
    props: { text: "Hello" }
  }
]);

const json = serializeEditorDocument(doc);
const roundTrip = deserializeEditorDocument(json);
```

Unknown block `type` strings round-trip. `schemaVersion` is the positive integer `1`.

## Architecture

Public shape: **Small Core + Adapters + Docs + Examples**.

| Layer | What it is | line |
| --- | --- | --- |
| **Small Core** | `@hello-ai-company/editor-core` — document model, JSON, optional provider types | `0.2.0` published |
| **Editing adapter** | `@hello-ai-company/editor-blocknote` — BlockNote power layer, commands, and incremental bridge | `0.2.0` published; BlockNote peers `^0.54.2` |
| **AI contracts** | `@hello-ai-company/editor-ai` — agent events, validated suggestions, provenance results, and explicit learning decisions | `0.2.0` published |
| **Canvas** | `@hello-ai-company/editor-canvas` — responsive layout specs, React inspector, Magic Layout grouping, and slide references | `0.2.0` published |
| **Publishing** | `@hello-ai-company/editor-publish` — safe static HTML, Markdown, DOCX, print HTML, and public knowledge projection | `0.2.0` published |
| **Docs** | Architecture, public API, contributing, security | this repository |
| **Examples** | `examples/blocknote-power` | demo / Quick Start |

See [docs/architecture.md](./docs/architecture.md), [docs/AI_INTEGRATION.md](./docs/AI_INTEGRATION.md), [docs/AGENT_INTEGRATION.md](./docs/AGENT_INTEGRATION.md), [docs/CANVAS.md](./docs/CANVAS.md), [docs/PUBLISHING.md](./docs/PUBLISHING.md), [docs/PLUGIN_API.md](./docs/PLUGIN_API.md), [docs/SECURITY.md](./docs/SECURITY.md), and [docs/MIGRATION.md](./docs/MIGRATION.md).

## Product mode map

| Mode | Current capability | Boundary |
| --- | --- | --- |
| **Document** | BlockNote editing, workspace references, and host-backed database views | Host providers own entity metadata, row data, persistence, and access control. |
| **Canvas** | Responsive layout editing, inspector controls, and static semantic previews | Workspace references use safe labels/placeholders; database rows are never loaded into Canvas. Pointer dragging applies to positioned items; there are no resize handles. |
| **Present** | Accessible static slide player from allowlisted content or Canvas frames | Uses the Publish projection; unsupported/private blocks and workspace references are omitted. |
| **Site** | Static allowlisted HTML with optional responsive Canvas layout | Does not fetch host metadata or database rows; unsupported/private content is omitted. |

See the [cross-mode compatibility matrix](./docs/cross-mode-compatibility.md) for per-block behavior and the intentionally lossy static projections.

## Roadmap

The published 0.2.0 line includes opt-in AI, Canvas, and publishing packages:

- **Stable:** document model, JSON serialization, `schemaVersion` `1`, runtime helpers, document types
- **Experimental:** optional provider type seams
- **Experimental:** AI proposal contracts, the React Canvas editor, presentation primitives, and safe export/site renderers
- **Host-owned:** agent policy and run state, suggestion review and persistence, Canvas save/load, mode navigation, hosting, and public-page Q&A

## R3 integration state

The companion Personal-AI draft PR mounts Document, Canvas, Present, and Site in the note workspace; it adds server-backed Canvas revisions, structured agent proposals with human review, accepted-change provenance, history, comments, and explicit preference learning. Browser checks verified Canvas persistence, historical column save/reload, PDF output, and Site widths. The full product loop remains partial: the configured agent provider is a stub, and multi-slide/fullscreen and Ask This Page browser flows remain unverified. OpenEditor 0.2.0 is now available from the public registry. Personal-AI dependencies and its lockfile were not upgraded; consumption and actual-model validation require separate work in that repository.

This repository will not turn the core into a hosted editor, Cloud/Enterprise SKU, or paid plugin. Using, modifying, forking, self-hosting, and commercially using the core is free under MIT. Optional sponsorship may be offered later to help sustain maintenance; it will not unlock exclusive core functionality. There is no `.github/FUNDING.yml` yet.

## Local gates

```bash
npm ci
npm run verify
```

`verify` runs typecheck, tests, build, pack, exact tarball inspection, isolated candidate consumers, security scan, API contract, and release guards. The separate `public-release-preflight` checks Node 20 and 22 and performs publish dry runs; it never publishes. Actual registry installs and signature verification for the published line are recorded in [release verification](./docs/release-0.2.md). See [the release runbook](./docs/public-release-runbook.md) for future owner-authorized updates.

Dry-run publish only (does **not** publish):

```bash
npm run publish:dry-run
```

## Contributing / security

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE). Copyright (c) 2026 Yuki Shibata.
