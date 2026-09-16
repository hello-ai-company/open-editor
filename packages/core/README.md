# @hello-ai-company/editor-core

Portable TypeScript document model, JSON serialization, and optional provider types.

This is a **small host-neutral document layer** — not a rich-text editor, not a React component, and not a BlockNote/UI package.

## Install

```bash
npm install @hello-ai-company/editor-core
```

Requirements: Node.js `>=20`, ESM. No runtime dependencies. No CommonJS export.

Until the first public npmjs publish, pack from this repository:

```bash
npm pack -w @hello-ai-company/editor-core
npm install ./hello-ai-company-editor-core-0.1.0.tgz
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
