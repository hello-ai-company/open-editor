# OpenEditor · BlockNote Power demo

5-minute Quick Start for `@hello-ai-company/editor-blocknote`.

## What this is

BlockNote engine + OpenEditor portable `EditorDocument` + power commands (slash + Mod+K). Not a fork. Core stays separate. No `@blocknote/xl-*`, no AI SDK, no persistence inside the package.

## Run

From the repository root (after `npm install`):

```bash
# link workspace packages into the example (example is outside workspaces)
npm install --prefix examples/blocknote-power
npm run dev --prefix examples/blocknote-power
```

## Minutes 0–5

| Time | Outcome |
| --- | --- |
| 0:00 | Power layer on BlockNote + portable docs |
| 0:45 | Install `editor-core` + workspace `editor-blocknote` + BN peers |
| 1:30 | `createPowerEditorOptions` + `BlockNoteView` + slash controller |
| 2:30 | `/` and Mod+K share `createCommandRegistry` |
| 3:30 | `fromBlockNote` / `toBlockNoteForSchema` + serialize on save |
| 4:15 | Callout + status already in the preset |
| 4:45 | Boundaries: no XL, no AI SDK, host owns persistence |
| 5:00 | This demo |

## Try in the UI

1. Type `/` → insert **Callout** or **Status**
2. Press **Mod+K** → same registry
3. Toggle Files / Comments chips → media/collab commands appear/hide
4. Watch JSON update from the **batched** change bridge

## License footer

No `@blocknote/xl-*` · MPL BlockNote peers · MIT OpenEditor
