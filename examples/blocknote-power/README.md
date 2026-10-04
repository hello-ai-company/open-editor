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
2. Use **Tools → Writing guide → Try a sample review**, or select “A focused workspace keeps the content clear and the tools close at hand.” and choose **Improve**. Review the before/after text and choose either or both changes. Accept applies the selected changes as one editor change; Reject leaves the document alone. The decision stays visible and disables repeat adoption. **Undo AI change** restores the original paragraph only if it has not changed since acceptance, preserving later human edits and other paragraphs. Normal editor undo remains available.
3. Switch to **Canvas**, **Present**, or **Site** to see the same document in each package's view.
4. **Outline**, **Search**, **Commands**, and **Focus** are always within reach. **Tools** holds Writing guide, Personal context demo, Context, Block actions, Appearance, and Inspect. Escape or clicking outside closes Tools. Escape cancels search and commands. Outline navigation returns to Document and closes the outline on phones.
5. Change **Tools → Appearance** to preview explicit light and dark themes. Reduced Motion removes demo animations and transitions.
6. Switching views keeps a pending AI review; return to Document to accept it. Closing a review dismisses the proposal without editing the document.

Normal **Document** now saves automatically in this browser's IndexedDB. **Save** or Cmd/Ctrl+S saves explicitly; **New document**, the saved-document selector and **Export backup** manage independent local documents. **Saved locally** confirms a completed write. Conflicts retain your edits and offer a recovered copy; storage failures offer Retry and Export. Reload and browser restart retain saved Document blocks in the same browser profile/origin. Canvas layout, external page/database records and the sample AI review history remain host-owned/session state.

On a loopback preview, **Personal-AI local test** explicitly connects a separate synthetic SQLite/API host. It exercises real local permission/version checks and atomic adoption/undo, with mock proposals and no paid model. It never connects a production account. See [local persistence and pinned host contract](../../docs/local-document-personal-ai.md) for setup, verification and remaining production gates.

## Personal context contract demo

**Tools → Personal context demo** lazily opens a separate synthetic document. Returning to Document keeps the original BlockNote editor mounted and preserves its edits. This screen uses no Personal-AI API or model provider. It demonstrates the supplied EditorContext contract with explicit source selection, user-statement/inference labels, source metadata, partial adoption, fresh verification, human-edit conflict rejection, and guarded undo. Synthetic controls exercise paused, deleted, changed, and offline sources.

External JSON is untrusted and preview-only: it cannot authorize proposals, acceptance, or storage. An authenticated host must revalidate the exact document and approved memory versions before real proposals and acceptance. No production verifier, recording capture, token, private transcript, or host document writer is connected here.

The synthetic demo has its own explicit browser save/restore (`open-editor.synthetic-selected-context.v1`). Restore validates structure, bounded content, generated proposal/undo lineage, and fixed synthetic source identities. It restores in preview mode; reactivate synthetic verification before adopting or undoing. Saving this screen does not save the original Document. Removing browser storage clears this synthetic saved state.

See [Mac integration and the seven reference files](../../docs/selected-personal-context-local.md) for the exact migration, tested persistence/conflict boundaries, assets and remaining production integration.

## Shared visual and motion contract

The interface follows the supplied Personal-AI/OpenEditor paper, ink, sage, spacing, typography, and touch-target contract in [MOTION-DESIGN.md](./MOTION-DESIGN.md). It uses system fonts and no external font requests. The writing guide contains one isolated decorative media well; it is independent from loading, agent, and save state.

Only `idea-unfold` is shipped under `public/motion/idea-unfold`, with its supplied license. Playback chooses one desktop/mobile MP4 on visible entry, plays once, and returns to a static fallback. Reduced Motion, Save Data, low device memory, hidden/offscreen state, input, failed playback, and unmount stop or prevent video. It never replays on guide reopening. Other Blender assets are retained in the local handoff but are not loaded by the app.

## License footer

No `@blocknote/xl-*` · MPL BlockNote peers · MIT OpenEditor
