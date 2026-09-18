# @hello-ai-company/editor-blocknote

Unpublished OpenEditor power layer on BlockNote.

## Install (workspace)

```bash
npm install @hello-ai-company/editor-blocknote
# peers
npm install @blocknote/core@^0.54.2 @blocknote/react@^0.54.2 react react-dom
```

Optional features (MPL-2.0 BlockNote packages; XL exporters stay optional/uninstalled):

```bash
npm install @blocknote/math-block@^0.54.2
npm install @blocknote/diagram-block@^0.54.2
npm install @blocknote/code-block@^0.54.2
```

```ts
import { createOpenEditorPowerPreset } from "@hello-ai-company/editor-blocknote";
import { createMathPowerFeature } from "@hello-ai-company/editor-blocknote/math";

const power = createOpenEditorPowerPreset({
  features: [createMathPowerFeature()]
});
```

## Exports

| Subpath | Purpose |
|---------|---------|
| `.` | Adapter, schema, commands, document index, references, preset |
| `./react` | Outline, quick nav, palette, block actions |
| `./math` | Optional math feature |
| `./diagram` | Optional Mermaid diagram feature |
| `./code` | Optional Shiki syntax highlighting |
| `./power.css` | OpenEditor-owned UI styles |

## License boundary

- Never depend on `@blocknote/xl-*`
- Optional BlockNote packages are MPL-2.0; their XL exporter peers are marked optional and unused

## Hot path

Do not call `editor.document` + full `serializeEditorDocument` on every keystroke.
Use `createBlockChangeBridge` / `useOpenEditorBlockChanges` and `createDocumentIndex().applyChanges(...)`.
