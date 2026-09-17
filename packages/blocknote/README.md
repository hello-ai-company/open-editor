# @hello-ai-company/editor-blocknote

OpenEditor **BlockNote power layer** (unpublished `0.1.0`).

BlockNoteを編集エンジンとして活用し、保存・拡張ブロック・コマンド・共同編集・アプリ連携を疎結合にできる高機能ドキュメントレイヤー。

This package is **not** a BlockNote fork, TipTap clone, or thin re-export. It sits between BlockNote and host apps:

```text
BlockNote (MPL-2.0 engine)
  → @hello-ai-company/editor-blocknote   (this package)
    → host apps / AI / collab / persistence
```

Portable documents stay in [`@hello-ai-company/editor-core`](../core) (`EditorDocument`).

## What / What not

| Is | Is not |
| --- | --- |
| Lossless BN ↔ `EditorDocument` adapter + unknown-block envelope | A replacement editor engine |
| Power schema (defaults + callout + status + `oeUnknownBlock`) | Multi-column / XL features |
| Shared command registry for `/` slash + Cmd/Ctrl+K | Owned persistence / backend |
| Incremental `getChanges()` bridge + batching | Claim of “faster than BlockNote” without your own measurements |

## License matrix

| Package | License |
| --- | --- |
| `@hello-ai-company/editor-blocknote` | MIT |
| `@hello-ai-company/editor-core` | MIT |
| `@blocknote/core` / `@blocknote/react` / UI shells | **MPL-2.0** (dependency; do not re-license BN sources as MIT) |
| `@blocknote/xl-*` | **Forbidden** (GPL-3.0 OR proprietary) |

## Install & peers

Workspace / local (package is unpublished):

```bash
npm install @hello-ai-company/editor-core
# link this workspace package, then peers:
npm install @blocknote/core@^0.54.2 @blocknote/react@^0.54.2 react react-dom
# demo UI shell (example only):
npm install @blocknote/mantine
```

Dependency direction: `editor-core` ← `editor-blocknote` ← app (never reverse).
`editor-blocknote` depends on `@hello-ai-company/editor-core@^0.1.0`.

### Entry points

| Import | Contents |
| --- | --- |
| `@hello-ai-company/editor-blocknote` | Full surface (adapter, bridge, commands, React power UX) |
| `@hello-ai-company/editor-blocknote/react` | Additive React-focused re-exports (hooks, palette, power schema/blocks) |
| `@hello-ai-company/editor-blocknote/power.css` | Callout / status / palette styles |

Root entry remains complete in 0.1.0; further narrowing of root vs `/react` is deferred to 4F-2 if needed.

## Minimal React snippet

```tsx
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { SuggestionMenuController } from "@blocknote/react";
import {
  createPowerEditorOptions,
  createCommandRegistry,
  createDefaultPowerCommands,
  getPowerSlashItems,
  PowerCommandPalette,
  usePowerCommandPaletteShortcut,
  fromBlockNote,
  toBlockNoteForSchema
} from "@hello-ai-company/editor-blocknote";
import "@hello-ai-company/editor-blocknote/power.css";

const options = createPowerEditorOptions();
const registry = createCommandRegistry(createDefaultPowerCommands());

function Editor() {
  const editor = useCreateBlockNote(options);
  const [paletteOpen, setPaletteOpen] = useState(false);
  usePowerCommandPaletteShortcut(editor, () => setPaletteOpen((v) => !v));
  const ctx = { editor };

  return (
    <>
      <BlockNoteView editor={editor} slashMenu={false}>
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => getPowerSlashItems(registry, ctx, query)}
        />
      </BlockNoteView>
      <PowerCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        registry={registry}
        context={ctx}
      />
    </>
  );
}
```

## Document adapter

```ts
import { fromBlockNote, toBlockNoteForSchema, createPowerSchema } from "@hello-ai-company/editor-blocknote";
import { serializeEditorDocument } from "@hello-ai-company/editor-core";

const schema = createPowerSchema();
const doc = fromBlockNote(editor.document);          // BN → EditorDocument
const json = serializeEditorDocument(doc);           // save once — not per keystroke
const partials = toBlockNoteForSchema(doc, schema);  // EditorDocument → BN
```

Unknown types and nested props use the `oeUnknownBlock` envelope inside the live editor, then unwrap back to the original `type` on `fromBlockNote`.

## Incremental changes

Use `createBlockChangeBridge` / `useOpenEditorBlockChanges`. The hot path maps **only** `getChanges()` blocks — never `editor.document` + full `serializeEditorDocument` per keystroke.

## Seams

`PowerSeams` (`files`, `comments`, `collab`) are host-injected. This package does not own storage, Yjs providers, or AI SDKs.

## Tables

Tables use BlockNote’s built-in `table` block. Multi-column layout requires `@blocknote/xl-multi-column` and is **not** included.

## Demo

See [`examples/blocknote-power`](../../examples/blocknote-power) for a 5-minute Quick Start.
