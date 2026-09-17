import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@hello-ai-company/editor-blocknote/power.css";
import { BlockNoteView } from "@blocknote/mantine";
import {
  FormattingToolbar,
  FormattingToolbarController,
  SuggestionMenuController,
  useCreateBlockNote
} from "@blocknote/react";
import {
  createDocumentIndex,
  createOpenEditorPowerPreset,
  fromBlockNote,
  getPowerSlashItems,
  PowerCommandPalette,
  toBlockNoteForSchema,
  useOpenEditorBlockChanges,
  usePowerCommandPaletteShortcut,
  type OpenEditorChangeBatch
} from "@hello-ai-company/editor-blocknote";
import {
  BlockActionMenu,
  DocumentOutline,
  QuickNav,
  useDocumentOutline,
  useQuickNavShortcut
} from "@hello-ai-company/editor-blocknote/react";
import { serializeEditorDocument } from "@hello-ai-company/editor-core";
import { useCallback, useMemo, useState } from "react";
import { sampleDocument } from "./sampleDocument";

export function PowerDemoEditor() {
  const preset = useMemo(() => createOpenEditorPowerPreset(), []);
  const options = useMemo(() => preset.editorOptions(), [preset]);
  const initialContent = useMemo(
    () => toBlockNoteForSchema(sampleDocument, options.schema),
    [options.schema]
  );

  const editor = useCreateBlockNote({
    ...options,
    initialContent: initialContent as never
  });

  const index = useMemo(() => createDocumentIndex(), []);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [batchCount, setBatchCount] = useState(0);
  const [json, setJson] = useState(() => serializeEditorDocument(sampleDocument));
  const [actionsOpen, setActionsOpen] = useState(false);

  const ctx = useMemo(
    () => ({
      editor: editor as never,
      documentId: "demo"
    }),
    [editor]
  );

  const { nodes, jump } = useDocumentOutline({
    editor: editor as never,
    index,
    seedFromDocument: true,
    batch: { strategy: "raf" }
  });

  usePowerCommandPaletteShortcut(editor, () => setPaletteOpen((o) => !o));
  useQuickNavShortcut(editor, () => setNavOpen((o) => !o));

  useOpenEditorBlockChanges({
    editor: editor as never,
    batch: { strategy: "raf" },
    onBatch: (batch: OpenEditorChangeBatch) => {
      setBatchCount((count) => count + batch.changes.length);
    }
  });

  const refreshJson = useCallback(() => {
    const doc = fromBlockNote(editor.document as never);
    setJson(serializeEditorDocument(doc));
  }, [editor]);

  const themeAttr =
    theme === "system" ? undefined : theme === "dark" ? "dark" : "light";
  const bnTheme =
    theme === "system"
      ? undefined
      : theme === "dark"
        ? "dark"
        : "light";

  return (
    <div className="demo-shell" data-oe-theme={themeAttr}>
      <header className="demo-top">
        <div className="demo-brand">
          <span className="demo-brand__name">OpenEditor</span>
        </div>
        <div className="demo-toolbar" role="toolbar" aria-label="Editor tools">
          <button
            type="button"
            className={outlineOpen ? "chip chip--on" : "chip"}
            onClick={() => setOutlineOpen((v) => !v)}
          >
            Outline
          </button>
          <button type="button" className="chip" onClick={() => setNavOpen(true)}>
            Search
          </button>
          <button type="button" className="chip chip--on" onClick={() => setPaletteOpen(true)}>
            Commands ⌘K
          </button>
          <button
            type="button"
            className={actionsOpen ? "chip chip--on" : "chip"}
            onClick={() => setActionsOpen((v) => !v)}
          >
            Block
          </button>
          <label className="chip chip--muted">
            Theme{" "}
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
              aria-label="Theme"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <button
            type="button"
            className={devtoolsOpen ? "chip chip--on" : "chip"}
            onClick={() => setDevtoolsOpen((v) => !v)}
          >
            Dev {batchCount}
          </button>
        </div>
      </header>

      <div className="demo-body">
        {outlineOpen ? (
          <aside className="demo-outline" aria-label="Document outline">
            <DocumentOutline nodes={nodes} onJump={jump} />
          </aside>
        ) : null}

        <main className="demo-editor">
          <BlockNoteView
            editor={editor}
            slashMenu={false}
            formattingToolbar={false}
            theme={bnTheme}
          >
            <FormattingToolbarController
              formattingToolbar={() => <FormattingToolbar />}
            />
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) =>
                getPowerSlashItems(preset.registry, ctx, query)
              }
            />
          </BlockNoteView>
        </main>

        {actionsOpen ? (
          <aside className="demo-actions" aria-label="Block actions">
            <BlockActionMenu registry={preset.registry} context={ctx} />
          </aside>
        ) : null}
      </div>

      {devtoolsOpen ? (
        <aside className="demo-json" aria-label="Developer tools">
          <h2>Developer</h2>
          <p>Incremental batches received: {batchCount}</p>
          <button type="button" className="chip chip--on" onClick={refreshJson}>
            Refresh snapshot
          </button>
          <pre>{json}</pre>
        </aside>
      ) : null}

      <PowerCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        registry={preset.registry}
        context={ctx}
      />
      <QuickNav
        open={navOpen}
        onOpenChange={setNavOpen}
        index={index}
        editor={editor as never}
      />
    </div>
  );
}
