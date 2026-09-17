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
  type OpenEditorBlockChange,
  type OpenEditorChangeBatch
} from "@hello-ai-company/editor-blocknote";
import { serializeEditorDocument } from "@hello-ai-company/editor-core";
import { useCallback, useMemo, useState } from "react";
import { sampleDocument } from "./sampleDocument";

function summarizeBatch(batch: OpenEditorChangeBatch): string {
  const counts = batch.changes.reduce(
    (acc, change: OpenEditorBlockChange) => {
      acc[change.type] = (acc[change.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const parts = Object.entries(counts).map(([type, n]) => `${type}:${n}`);
  return `seq=${batch.seq} coalesced=${batch.coalesced} [${parts.join(", ")}]`;
}

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
  const [lastBatchSummary, setLastBatchSummary] = useState("No batches yet — type in the editor.");
  const [lastChanges, setLastChanges] = useState<OpenEditorBlockChange[]>([]);

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
      // Hot path: incremental batch only — never full document serialize here.
      setBatchCount((count) => count + batch.changes.length);
      setLastBatchSummary(summarizeBatch(batch));
      setLastChanges([...batch.changes]);
    }
  });

  const refreshJson = useCallback(() => {
    const doc = fromBlockNote(editor.document as never);
    setJson(serializeEditorDocument(doc));
  }, [editor]);

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

      <aside className="demo-json" aria-label="Change inspector">
        <h2>Incremental batches</h2>
        <p>
          Typing shows <code>getChanges()</code> batches only. Full EditorDocument JSON is manual.
        </p>
        <p className="demo-batch-summary">{lastBatchSummary}</p>
        <pre className="demo-batch-pre">
          {lastChanges.length === 0
            ? "[]"
            : JSON.stringify(
                lastChanges.map((change) => ({
                  type: change.type,
                  blockId: change.blockId,
                  source: change.source,
                  blockType: change.block.type
                })),
                null,
                2
              )}
        </pre>

        <div className="demo-json-actions">
          <h2>EditorDocument JSON</h2>
          <button type="button" className="chip chip--on" onClick={refreshJson}>
            Refresh snapshot
          </button>
        </div>
        <p>Click Refresh to run fromBlockNote(editor.document) + serialize once.</p>
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
