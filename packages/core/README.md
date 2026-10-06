# @hello-ai-company/editor-core

## 0.2.0 candidate: compatibility boundary

This version is prepared locally and is not published. The document schema stays
at `1`, with the same exports and optional provider types. Document creation,
cloning, validators and serialization share per-root-subtree bounds: 20,000 blocks
including the root, block depth 128 (root 0), 50,000 props/content JSON nodes and
JSON depth 128 (value root 0). Combining valid roots does not impose a document
aggregate ceiling. Cycles and unsupported primitives are rejected; a formerly
accepted single large/deep root can still fail. Supply JSON-shaped objects;
prototype validation is not enforced. Hosts own total document/text quotas.
These are pre-1.0 compatibility changes. Preserve originals on failed open/save;
invalid blocks produce TypeError for creation/cloning and
EditorDocumentSerializationError for the codec, without returning partial output.
See the [migration guide](https://github.com/hello-ai-company/open-editor/blob/main/docs/migration-0.2.md).

Portable TypeScript document model, JSON serialization, and optional provider types.

This is a **small host-neutral document layer** — not a rich-text editor, not a React component, and not a BlockNote/UI package.

## Install

```bash
npm install @hello-ai-company/editor-core
```

Requirements: Node.js `>=20`, ESM. No runtime dependencies. No CommonJS export.

Published `@hello-ai-company/editor-core@0.1.0` and `0.1.1` on npmjs are **immutable**. Workspace candidate is `0.2.0`, prepared locally and unpublished. An actual release requires a separately reviewed **main** commit. Pack the candidate:

```bash
npm pack -w @hello-ai-company/editor-core
npm install ./hello-ai-company-editor-core-0.2.0.tgz
```

## Quickstart

```ts
import {
  createEditorDocument,
  serializeEditorDocument,
  deserializeEditorDocument,
  EDITOR_DOCUMENT_SCHEMA_VERSION
} from "@hello-ai-company/editor-core";

const doc = createEditorDocument([
  {
    id: "p1",
    type: "paragraph",
    props: { text: "Hello" },
    content: [{ type: "text", text: "Hello" }]
  }
]);

const json = serializeEditorDocument(doc);
const roundTrip = deserializeEditorDocument(json);

if (roundTrip.schemaVersion !== EDITOR_DOCUMENT_SCHEMA_VERSION) {
  throw new Error("unexpected schemaVersion");
}
```

`createEditorDocument` takes an **array of blocks**, not a `{ blocks }` wrapper. Unknown `type` strings are first-class data and round-trip. `schemaVersion` is the positive integer `1`.

## What this package is

- `EditorDocument` / `EditorBlock` / `JsonValue`
- JSON serialize / deserialize
- Optional provider **types** only (no network clients, no UI)

## What this package is not

- Not a rich-text editor
- Not a host app, sync layer, or HTTP client
- Not an adapter package (host integrations belong in later separate packages)

Public runtime and type lists: [docs/public-api.md](https://github.com/hello-ai-company/open-editor/blob/main/docs/public-api.md).

## License

MIT. Copyright (c) 2026 Yuki Shibata.
