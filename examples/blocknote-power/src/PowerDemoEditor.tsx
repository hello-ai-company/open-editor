import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@hello-ai-company/editor-blocknote/power.css";
import { BlockNoteView } from "@blocknote/mantine";
import { SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
import {
  createCommandRegistry,
  createDefaultPowerCommands,
  createMemoryCommentsSeam,
  createMemoryFileSeam,
  createNoopCollabSeam,
  createPowerEditorOptions,
  fromBlockNote,
  getPowerSlashItems,
  PowerCommandPalette,
  toBlockNoteForSchema,
  useOpenEditorBlockChanges,
  usePowerCommandPaletteShortcut,
  type OpenEditorChangeBatch
} from "@hello-ai-company/editor-blocknote";
import { serializeEditorDocument } from "@hello-ai-company/editor-core";
import { useMemo, useState } from "react";
import { sampleDocument } from "./sampleDocument";

export function PowerDemoEditor() {
  const options = useMemo(() => createPowerEditorOptions(), []);
  const initialContent = useMemo(
    () => toBlockNoteForSchema(sampleDocument, options.schema),
    [options.schema]
  );
  const editor = useCreateBlockNote({
    ...options,
    initialContent: initialContent as never
  });

  const registry = useMemo(() => createCommandRegistry(createDefaultPowerCommands()), []);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [filesOn, setFilesOn] = useState(true);
  const [commentsOn, setCommentsOn] = useState(true);
  const [json, setJson] = useState(() => serializeEditorDocument(sampleDocument));
  const [batchCount, setBatchCount] = useState(0);

  const seams = useMemo(
    () => ({
      files: filesOn ? createMemoryFileSeam() : undefined,
      comments: commentsOn ? createMemoryCommentsSeam() : undefined,
      collab: createNoopCollabSeam()
    }),
    [filesOn, commentsOn]
  );

  const ctx = useMemo(
    () => ({
      editor: editor as never,
      documentId: "demo",
      seams
    }),
    [editor, seams]
  );

  usePowerCommandPaletteShortcut(editor, () => setPaletteOpen((open) => !open));

  useOpenEditorBlockChanges({
    editor: editor as never,
    batch: { strategy: "raf" },
    onBatch: (batch: OpenEditorChangeBatch) => {
      setBatchCount((count) => count + batch.changes.length);
      const doc = fromBlockNote(editor.document as never);
      setJson(serializeEditorDocument(doc));
    }
  });

  return (
    <div className="demo-shell">
      <header className="demo-top">
        <div className="demo-brand">
          <span className="demo-brand__name">OpenEditor</span>
          <span className="demo-brand__meta">Power demo · Mod+K</span>
        </div>
        <div className="demo-chips" aria-label="Seams">
          <button
            type="button"
            className={filesOn ? "chip chip--on" : "chip"}
            onClick={() => setFilesOn((v) => !v)}
          >
            Files {filesOn ? "on" : "off"}
          </button>
          <button
            type="button"
            className={commentsOn ? "chip chip--on" : "chip"}
            onClick={() => setCommentsOn((v) => !v)}
          >
            Comments {commentsOn ? "on" : "off"}
          </button>
          <span className="chip chip--muted">Batches: {batchCount}</span>
        </div>
      </header>

      <main className="demo-editor">
        <BlockNoteView editor={editor} slashMenu={false} theme="light">
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) => getPowerSlashItems(registry, ctx, query)}
          />
        </BlockNoteView>
      </main>

      <aside className="demo-json" aria-label="Serialized EditorDocument">
        <h2>EditorDocument JSON</h2>
        <p>Serialized on batched change flush (not a claim of BN speed).</p>
        <pre>{json}</pre>
      </aside>

      <PowerCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        registry={registry}
        context={ctx}
      />
    </div>
  );
}
