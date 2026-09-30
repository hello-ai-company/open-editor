# OpenEditor · BlockNote Power demo

Interactive product preview for the OpenEditor packages.

## What this is

The preview moves one document through Document, Canvas, Present, and Site views. It uses BlockNote as the editing adapter, the Canvas editor for responsive layout, and the publish renderers for static previews. The sample writing suggestion uses `@hello-ai-company/editor-ai` validation and accept/reject contracts; it makes no model call. Persistence and a real AI provider stay host-owned. No `@blocknote/xl-*` packages are used.

## Run

From the repository root:

```bash
# link workspace packages into the example (example is outside workspaces)
npm install --prefix examples/blocknote-power
npm run dev --prefix examples/blocknote-power
```

## Try in the UI

1. Edit the document; type `/` for commands or press **⌘K / Ctrl+K** for the command palette.
2. Select the sample sentence “A focused workspace keeps the content clear and the tools close at hand.” and choose **Improve** to review the local proposal. Accept applies it as one editor change; Reject leaves the document alone.
3. Switch to **Canvas**, **Present**, or **Site** to see the same document in each package's view.
4. Open **Outline**, **Context**, **Focus**, and **Inspect** as needed. The inspector holds host-owned page and relation examples.
5. Change **Appearance** to preview explicit light and dark themes.

## License footer

No `@blocknote/xl-*` · MPL BlockNote peers · MIT OpenEditor
