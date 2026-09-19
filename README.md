# OpenEditor

OpenEditor is a **portable document layer** for host-neutral editors — not another rich-text editor.

The public package is [`@hello-ai-company/editor-core`](./packages/core). It is a small TypeScript core: a versioned document model, JSON serialization, and optional provider **types**. Host UI, React, BlockNote, and other adapters are out of scope for this package.

## Status

| Item | Value |
| --- | --- |
| Repository | **PUBLIC** — https://github.com/hello-ai-company/open-editor |
| Package (published) | `@hello-ai-company/editor-core@0.1.0` on npmjs (**immutable**) |
| Package (workspace) | `@hello-ai-company/editor-core@0.1.1` candidate (**not published** yet) |
| Adapter | `@hello-ai-company/editor-blocknote@0.1.0` — in-repo, **unpublished** (depends on core `^0.1.1`) |
| License | MIT — Copyright (c) 2026 Yuki Shibata |
| Registry | https://registry.npmjs.org (`publishConfig.access`: public) |
| Publish sequence (after merge) | R2 review → merge → main publishes core `0.1.1` → registry prove → publish blocknote → Personal AI integration |
| Runtime dependencies (core) | none |

## Install

Published line (registry):

```bash
npm install @hello-ai-company/editor-core
```

For the `0.1.1` candidate (until it is published), pack from this tree:

```bash
npm pack -w @hello-ai-company/editor-core
npm install ./hello-ai-company-editor-core-0.1.1.tgz
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
| **Small Core** | `@hello-ai-company/editor-core` — document model, JSON, optional provider types | `0.1.1` candidate (`0.1.0` published) |
| **Adapters** | `@hello-ai-company/editor-blocknote` — BlockNote power layer (lossless adapter, commands, incremental bridge) | **in-repo, unpublished** `0.1.0` (depends on core `^0.1.1`) |
| **Docs** | Architecture, public API, contributing, security | this repository |
| **Examples** | `examples/blocknote-power` | demo / Quick Start |

See [docs/architecture.md](./docs/architecture.md), [docs/public-api.md](./docs/public-api.md), [docs/providers.md](./docs/providers.md), [docs/versioning.md](./docs/versioning.md), and [docs/security-boundary.md](./docs/security-boundary.md).

## Roadmap

v0.1.0 is an early 0.x line:

- **Stable:** document model, JSON serialization, `schemaVersion` `1`, runtime helpers, document types
- **Experimental:** optional provider type seams
- **Later:** adapter packages, more docs and examples

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
