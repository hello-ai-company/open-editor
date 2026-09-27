# OpenEditor

OpenEditor is a reusable editor platform built around a small portable document core. BlockNote is one editing adapter; host-specific AI, agent, canvas, and publishing behavior stays outside the core.

The public package is [`@hello-ai-company/editor-core`](./packages/core). It is a small TypeScript core: a versioned document model, JSON serialization, and optional provider **types**. Host UI, React, BlockNote, and other adapters are out of scope for this package.

## Status

| Item | Value |
| --- | --- |
| Repository | **PUBLIC** — https://github.com/hello-ai-company/open-editor |
| Package (published) | `@hello-ai-company/editor-core@0.1.0` + `@0.1.1` on npmjs (**immutable**) |
| Package (workspace) | `@hello-ai-company/editor-core@0.1.1` (matches published line) |
| Adapter | `@hello-ai-company/editor-blocknote@0.1.0` — published on npm (depends on core `^0.1.1`) |
| License | MIT — Copyright (c) 2026 Yuki Shibata |
| Registry | https://registry.npmjs.org (`publishConfig.access`: public) |
| New packages | `editor-ai`, `editor-canvas`, and `editor-publish` are in-repo experimental packages and are not published |
| Runtime dependencies (core) | none |

## Install

Published line (registry):

```bash
npm install @hello-ai-company/editor-core@0.1.1
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
| **Small Core** | `@hello-ai-company/editor-core` — document model, JSON, optional provider types | `0.1.1` published (`0.1.0` immutable) |
| **Editing adapter** | `@hello-ai-company/editor-blocknote` — BlockNote power layer, commands, and incremental bridge | `0.1.0` published; BlockNote peers `^0.54.2` |
| **AI contracts** | `@hello-ai-company/editor-ai` — agent events, validated suggestions, provenance results, and explicit learning decisions | experimental, in-repo |
| **Canvas model** | `@hello-ai-company/editor-canvas` — responsive layout specs, Magic Layout grouping, and derived slide references | experimental, in-repo |
| **Publishing** | `@hello-ai-company/editor-publish` — safe static HTML and public knowledge projection | experimental, in-repo |
| **Docs** | Architecture, public API, contributing, security | this repository |
| **Examples** | `examples/blocknote-power` | demo / Quick Start |

See [docs/architecture.md](./docs/architecture.md), [docs/AI_INTEGRATION.md](./docs/AI_INTEGRATION.md), [docs/AGENT_INTEGRATION.md](./docs/AGENT_INTEGRATION.md), [docs/CANVAS.md](./docs/CANVAS.md), [docs/PUBLISHING.md](./docs/PUBLISHING.md), [docs/PLUGIN_API.md](./docs/PLUGIN_API.md), [docs/SECURITY.md](./docs/SECURITY.md), and [docs/MIGRATION.md](./docs/MIGRATION.md).

## Roadmap

v0.1.0 is an early 0.x line:

- **Stable:** document model, JSON serialization, `schemaVersion` `1`, runtime helpers, document types
- **Experimental:** optional provider type seams
- **Experimental:** AI suggestion contracts, responsive canvas specs, and static public-page rendering; these packages do not include a full interactive canvas or host UI

This repository will not turn the core into a hosted editor, Cloud/Enterprise SKU, or paid plugin. Using, modifying, forking, self-hosting, and commercially using the core is free under MIT. Optional sponsorship may be offered later to help sustain maintenance; it will not unlock exclusive core functionality. There is no `.github/FUNDING.yml` yet.

## Local gates

```bash
npm ci
npm run verify
```

`verify` runs typecheck, tests, build, pack, tarball inspect, isolated consumer, security scan, and API contract.

Dry-run publish only (does **not** publish):

```bash
npm run publish:dry-run
```

## Contributing / security

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE). Copyright (c) 2026 Yuki Shibata.
