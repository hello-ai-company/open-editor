# @hello-ai-company/editor-blocknote

## 0.2.0 candidate

Prepared locally; not published. Requires `editor-core ^0.2.0`; BlockNote peers
remain `^0.54.2`, with math/diagram/code optional. Adds optional persistent database
view configuration contracts and an accessible `BlockEditDialog`, improves
outline/navigation and editing controls, and retains legacy database filter
availability without requiring structured-filter support. Hosts still own data,
permissions and persistence. Upgrade core and review its validation limits first.
See the [migration guide](https://github.com/hello-ai-company/open-editor/blob/main/docs/migration-0.2.md).

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

## Host-owned saved database views

Database presentation settings are optional host-owned state. Pass a
`DatabaseViewConfigProvider` through `DatabaseViewRuntime.databaseViewConfig`
(or as the third argument to `createDatabaseViewRuntimeFromStore`). The
provider stores one versioned config per database and view identity; it does
not change `EditorDocument` or the editor-core database model.

```ts
import type { DatabaseViewConfig, DatabaseViewConfigProvider } from
  "@hello-ai-company/editor-blocknote";

const configs = new Map<string, DatabaseViewConfig>();
const key = (databaseId: string, viewId: string) => JSON.stringify([databaseId, viewId]);
const databaseViewConfig: DatabaseViewConfigProvider = {
  async load(databaseId, viewId) {
    return configs.get(key(databaseId, viewId)) ?? null;
  },
  async save(config) {
    configs.set(key(config.databaseId, config.viewId), config);
  },
  async list(databaseId) {
    return [...configs.values()]
      .filter((config) => config.databaseId === databaseId)
      .map(({ databaseId, viewId, viewType }) => ({ databaseId, viewId, viewType }));
  }
};
```

`load` is validated before the initial row query. Property-bound filters,
sorts, and renderer selectors are checked against current database metadata.
The optional `list(databaseId)` returns only view identities and lets hosts
discover generated view IDs that are not present in `EditorDatabase.views`.
If a load succeeds with no config, OpenEditor saves a validated default so the
new view can be listed. Saves contain query, filters, sort, and presentation
selectors only; row data, trash, pagination, focus, and loading state are never
part of `DatabaseViewConfig`. A save failure leaves the current view usable
and exposes a retry action.

If `load` fails, or property metadata needed to validate a saved setting is
unavailable, OpenEditor shows a local fallback and blocks config writes until
an explicit retry successfully rehydrates the view. `+ View` is enabled only
when the host implements both `save` and `list`; registration is confirmed by
rediscovery before the editor switches to the new identity.

## License boundary

- Never depend on `@blocknote/xl-*`
- Optional BlockNote packages are MPL-2.0; their XL exporter peers are marked optional and unused

## Hot path

Do not call `editor.document` + full `serializeEditorDocument` on every keystroke.
Use `createBlockChangeBridge` / `useOpenEditorBlockChanges` and `createDocumentIndex().applyChanges(...)`.

## Publication

Metadata targets public npmjs (`publishConfig.access: public`). Versions `0.1.0` and `0.1.1` are already published and immutable. Candidate `0.2.0` requires a separately reviewed main commit and an owner-triggered release; this repository does **not** auto-publish on merge.
