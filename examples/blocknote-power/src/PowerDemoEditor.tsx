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
  createBlockReferenceResolverFromIndex,
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
  jumpToBlock,
  QuickNav,
  useDocumentOutline,
  useQuickNavShortcut
} from "@hello-ai-company/editor-blocknote/react";
import { serializeEditorDocument } from "@hello-ai-company/editor-core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sampleDocument } from "./sampleDocument";

export function PowerDemoEditor() {
  const index = useMemo(() => createDocumentIndex(), []);
  const pickResolverRef = useRef<
    ((blockId: string | null) => void) | null
  >(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickExclude, setPickExclude] = useState<readonly string[]>([]);

  const preset = useMemo(
    () =>
      createOpenEditorPowerPreset({
        blockReferenceRuntime: {
          resolve: createBlockReferenceResolverFromIndex(index),
          onNavigate: () => {
            // wired to editor in effect below
          }
        }
      }),
    [index]
  );

  const options = useMemo(() => preset.editorOptions(), [preset]);
  const initialContent = useMemo(
    () => toBlockNoteForSchema(sampleDocument, options.schema),
    [options.schema]
  );

  const editor = useCreateBlockNote({
    ...options,
    initialContent: initialContent as never
  });

  // Keep reference navigate wired to the live editor
  useEffect(() => {
    preset.blockReferenceRuntime.onNavigate = (blockId) => {
      jumpToBlock(editor as never, blockId);
    };
    preset.blockReferenceRuntime.resolve =
      createBlockReferenceResolverFromIndex(index);
  }, [editor, index, preset]);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [batchCount, setBatchCount] = useState(0);
  const [json, setJson] = useState(() => serializeEditorDocument(sampleDocument));
  const [actionsOpen, setActionsOpen] = useState(false);

  const requestBlockPick = useCallback(
    (options?: { excludeIds?: readonly string[] }) => {
      return new Promise<string | null>((resolve) => {
        pickResolverRef.current = resolve;
        setPickExclude(options?.excludeIds ?? []);
        setPickOpen(true);
      });
    },
    []
  );

  const ctx = useMemo(
    () => ({
      editor: editor as never,
      documentId: "demo",
      documentIndex: index,
      requestBlockPick
    }),
    [editor, index, requestBlockPick]
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

  const closePick = useCallback((blockId: string | null) => {
    pickResolverRef.current?.(blockId);
    pickResolverRef.current = null;
    setPickOpen(false);
  }, []);

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
      <ReferencePicker
        open={pickOpen}
        index={index}
        excludeIds={pickExclude}
        onCancel={() => closePick(null)}
        onPick={(blockId) => closePick(blockId)}
      />
    </div>
  );
}

function ReferencePicker(props: {
  open: boolean;
  index: ReturnType<typeof createDocumentIndex>;
  excludeIds: readonly string[];
  onPick: (blockId: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const revision = props.index.getRevision();
  const hits = useMemo(() => {
    void revision;
    return props.index
      .query({ query, preferHeadings: true, limit: 40 })
      .filter((entry) => !props.excludeIds.includes(entry.blockId));
  }, [props.index, props.excludeIds, query, revision]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        props.onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  if (!props.open) return null;

  return (
    <div className="oe-overlay" role="presentation" onMouseDown={props.onCancel}>
      <div
        className="oe-quick-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Insert block reference"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          className="oe-quick-nav__input"
          autoFocus
          placeholder="Pick a block to reference…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul className="oe-quick-nav__list" role="listbox">
          {hits.length === 0 ? (
            <li className="oe-quick-nav__empty">No matching blocks</li>
          ) : (
            hits.map((entry) => (
              <li key={entry.blockId} role="presentation">
                <button
                  type="button"
                  className="oe-quick-nav__item"
                  role="option"
                  onClick={() => props.onPick(entry.blockId)}
                >
                  <span className="oe-quick-nav__type">{entry.type}</span>
                  <span className="oe-quick-nav__text">
                    {entry.text.trim() || entry.blockId}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
