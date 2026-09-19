# @hello-ai-company/editor-blocknote

OpenEditor BlockNote power layer on **BlockNote `^0.54.2`** (MPL-2.0).

## Install

```bash
npm install @hello-ai-company/editor-blocknote @hello-ai-company/editor-core
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

## Peer compatibility

| BlockNote | npm peer resolve | Source typecheck | Consumer smoke (widened peers) |
| --- | --- | --- | --- |
| `0.54.2` | PASS | PASS | PASS |
| `0.52.1` | FAIL (ERESOLVE) | FAIL (`syntaxHighlighter` / missing math-diagram pkgs) | PASS (matrix-only; not supported) |

**Decision:** keep `peerDependencies` at `^0.54.2`. Hosts still on BlockNote `^0.52.1` must upgrade before adopting this package. See [blocknote-compat.md](../../docs/blocknote-compat.md).

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

## Publication

Metadata targets public npmjs (`publishConfig.access: public`). First publish of `0.1.0` requires owner authorization and Trusted Publishing — this repository does **not** auto-publish on merge.
