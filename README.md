# OpenEditor

OpenEditor is a **portable document layer** for host-neutral editors — not another rich-text editor.

The public package is [`@hello-ai-company/editor-core`](./packages/core). It is a small TypeScript core: a versioned document model, JSON serialization, and optional provider **types**. Host UI, React, BlockNote, and other adapters are out of scope for this package.

## Status

| Item | Value |
| --- | --- |
| Package | `@hello-ai-company/editor-core@0.1.0` |
| License | MIT — Copyright (c) 2026 Yuki Shibata |
| Registry (prepared) | https://registry.npmjs.org (`publishConfig.access`: public) |
| Repository visibility | **PRIVATE** until a later human-gated public transition |
| npm publish | **Not executed** in this tree. First publish is a later gated step. |
| Runtime dependencies | none |

This source tree is public-ready. It is **not** a public GitHub repository yet, and the package is **not** on npmjs yet.

## Install (after first public publish)

```bash
npm install @hello-ai-company/editor-core
```

Requirements: Node.js `>=20`, ESM (`"type": "module"`). There is no CommonJS `require` export.

Until the first public publish, install from a packed tarball:

```bash
npm pack -w @hello-ai-company/editor-core
npm install ./hello-ai-company-editor-core-0.1.0.tgz
```

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

| Layer | What it is | v0.1.0 |
| --- | --- | --- |
| **Small Core** | `@hello-ai-company/editor-core` — document model, JSON, optional provider types | shipped |
| **Adapters** | Host integrations (for example a future BlockNote adapter) | **not shipped** — separate packages later |
| **Docs** | Architecture, public API, contributing, security | this repository |
| **Examples** | Consumer examples | later |

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
