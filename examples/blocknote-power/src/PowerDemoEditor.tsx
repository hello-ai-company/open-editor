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
  bindBlockReferenceRuntimeToIndex,
  createDatabaseRuntimeStore,
  createDocumentIndex,
  createOpenEditorPowerPreset,
  createPageRuntimeStore,
  createPageRuntimesFromStore,
  createRelationIndex,
  fromBlockNote,
  getPowerSlashItems,
  PowerCommandPalette,
  toBlockNoteForSchema,
  useOpenEditorBlockChanges,
  usePowerCommandPaletteShortcut,
  type OpenEditorChangeBatch
} from "@hello-ai-company/editor-blocknote";
import {
  BacklinksPanel,
  BlockActionMenu,
  createPageMentionSuggestionGetItems,
  DocumentOutline,
  jumpToBlock,
  QuickNav,
  useDocumentOutline,
  useQuickNavShortcut,
  WorkspacePagePicker
} from "@hello-ai-company/editor-blocknote/react";
import { serializeEditorDocument } from "@hello-ai-company/editor-core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDemoBacklinkProvider,
  createDemoDatabaseProvider,
  createDemoPageStore
} from "./demoProviders";
import { sampleDocument } from "./sampleDocument";
import type { EditorPageLink } from "@hello-ai-company/editor-core";

export function PowerDemoEditor() {
  const index = useMemo(() => createDocumentIndex(), []);
  const relationIndex = useMemo(() => createRelationIndex(), []);
  const [pageRevision, setPageRevision] = useState(0);
  const [lastOpenedRow, setLastOpenedRow] = useState<string | null>(null);

  const pageStore = useMemo(
    () =>
      createDemoPageStore(
        [
          {
            id: "architecture",
            title: "Architecture",
            preview: "System design notes"
          },
          {
            id: "api-surface",
            title: "API surface",
            preview: "Child of Architecture"
          },
          {
            id: "roadmap",
            title: "Roadmap",
            preview: "Milestones"
          }
        ],
        (pageId) => setLastOpenedPage(pageId)
      ),
    []
  );
  const databaseProvider = useMemo(() => createDemoDatabaseProvider(), []);
  const databaseRuntimeStore = useMemo(
    () =>
      createDatabaseRuntimeStore({
        provider: databaseProvider,
        defaultPageSize: 3
      }),
    [databaseProvider]
  );
  const backlinks = useMemo(
    () => createDemoBacklinkProvider("demo"),
    []
  );

  useEffect(() => pageStore.subscribe(() => setPageRevision((n) => n + 1)), [
    pageStore
  ]);

  const pickResolverRef = useRef<
    ((blockId: string | null) => void) | null
  >(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickExclude, setPickExclude] = useState<readonly string[]>([]);

  const pagePickResolverRef = useRef<
    ((page: { pageId: string; title?: string } | null) => void) | null
  >(null);
  const [pagePickOpen, setPagePickOpen] = useState(false);
  const [pagePickMode, setPagePickMode] = useState<"mention" | "card" | "generic">(
    "generic"
  );
  const childCreateResolverRef = useRef<
    ((details: { title?: string } | null) => void) | null
  >(null);
  const [childCreateOpen, setChildCreateOpen] = useState(false);
  const [childTitle, setChildTitle] = useState("Untitled");
  const [removedPage, setRemovedPage] = useState<EditorPageLink | null>(null);

  const pageRuntimeStore = useMemo(
    () =>
      createPageRuntimeStore({
        getPage: async (pageId) =>
          (await pageStore.provider.getPage?.(pageId)) ?? null
      }),
    [pageStore]
  );

  useEffect(() => {
    return pageStore.subscribe(() => {
      setPageRevision((n) => n + 1);
      for (const page of pageStore.pages) {
        pageRuntimeStore.prime(page);
      }
    });
  }, [pageStore, pageRuntimeStore]);

  const resolvePages = useCallback(() => {
    void pageRevision;
    return pageStore.pages;
  }, [pageStore, pageRevision]);

  const preset = useMemo(() => {
    const runtimes = createPageRuntimesFromStore(pageRuntimeStore, {
      onOpen: (pageId) => pageStore.provider.openPage?.(pageId)
    });
    const next = createOpenEditorPowerPreset({
      blockReferenceRuntime: {
        onNavigate: () => undefined
      },
      pageMentionRuntime: runtimes.pageMentionRuntime,
      pageCardRuntime: runtimes.pageCardRuntime,
      childPageRuntime: runtimes.childPageRuntime,
      databaseViewRuntime: {
        database: databaseProvider,
        store: databaseRuntimeStore,
        onOpenRow: (request) => {
          setLastOpenedRow(
            `${request.viewType}:${request.databaseId}/${request.rowKey}`
          );
        }
      }
    });
    bindBlockReferenceRuntimeToIndex(next.blockReferenceRuntime, index);
    return next;
  }, [databaseProvider, databaseRuntimeStore, index, pageRuntimeStore, pageStore]);

  const options = useMemo(() => preset.editorOptions(), [preset]);
  const initialContent = useMemo(
    () => toBlockNoteForSchema(sampleDocument, options.schema),
    [options.schema]
  );

  const editor = useCreateBlockNote({
    ...options,
    initialContent: initialContent as never
  });

  useEffect(() => {
    preset.blockReferenceRuntime.onNavigate = (blockId) => {
      jumpToBlock(editor as never, blockId);
    };
    bindBlockReferenceRuntimeToIndex(preset.blockReferenceRuntime, index);
    // Prime initial catalog into the runtime store
    for (const page of pageStore.pages) {
      pageRuntimeStore.prime(page);
    }
  }, [editor, index, pageRuntimeStore, pageStore, preset]);

  const getMentionItems = useMemo(
    () =>
      createPageMentionSuggestionGetItems({
        provider: pageStore.provider,
        getPages: resolvePages,
        excludePageId: "demo",
        editor: editor as never,
        onSelect: (page) => pageRuntimeStore.prime(page)
      }),
    [editor, pageRuntimeStore, pageStore.provider, resolvePages]
  );

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [relationsOpen, setRelationsOpen] = useState(true);
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

  const requestPagePick = useCallback(() => {
    return new Promise<{ pageId: string; title?: string } | null>((resolve) => {
      pagePickResolverRef.current = resolve;
      setPagePickMode("generic");
      setPagePickOpen(true);
    });
  }, []);

  const requestChildPageCreate = useCallback(() => {
    return new Promise<{ title?: string } | null>((resolve) => {
      childCreateResolverRef.current = resolve;
      setChildTitle("Untitled");
      setChildCreateOpen(true);
    });
  }, []);

  const requestDatabaseViewPick = useCallback(async () => {
    return {
      databaseId: "tasks",
      viewId: "main-table",
      viewType: "table" as const,
      titleHint: "Tasks"
    };
  }, []);

  const ctx = useMemo(
    () => ({
      editor: editor as never,
      documentId: "demo",
      documentIndex: index,
      requestBlockPick,
      requestPagePick,
      requestDatabaseViewPick,
      requestChildPageCreate,
      providers: {
        pages: pageStore.provider,
        database: databaseProvider,
        backlinks
      }
    }),
    [
      backlinks,
      databaseProvider,
      editor,
      index,
      pageStore.provider,
      requestBlockPick,
      requestChildPageCreate,
      requestDatabaseViewPick,
      requestPagePick
    ]
  );

  const { nodes, jump } = useDocumentOutline({
    editor: editor as never,
    index,
    seedFromDocument: true,
    batch: { strategy: "raf" }
  });

  usePowerCommandPaletteShortcut(editor, () => setPaletteOpen((o) => !o));
  useQuickNavShortcut(editor, () => setNavOpen((o) => !o));

  useEffect(() => {
    relationIndex.replaceFromBlocks(
      "demo",
      fromBlockNote(editor.document as never).blocks
    );
  }, [editor, relationIndex]);

  useOpenEditorBlockChanges({
    editor: editor as never,
    batch: { strategy: "raf" },
    onBatch: (batch: OpenEditorChangeBatch) => {
      setBatchCount((count) => count + batch.changes.length);
      relationIndex.applyChanges("demo", batch.changes);
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

  const closePagePick = useCallback(
    (page: { pageId: string; title?: string } | null) => {
      pagePickResolverRef.current?.(page);
      pagePickResolverRef.current = null;
      setPagePickOpen(false);
    },
    []
  );

  const closeChildCreate = useCallback((details: { title?: string } | null) => {
    childCreateResolverRef.current?.(details);
    childCreateResolverRef.current = null;
    setChildCreateOpen(false);
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
          <button
            type="button"
            className={relationsOpen ? "chip chip--on" : "chip"}
            onClick={() => setRelationsOpen((v) => !v)}
          >
            Relations
          </button>
          <button type="button" className="chip" onClick={() => setNavOpen(true)}>
            Search
          </button>
          <button
            type="button"
            className="chip chip--on"
            onClick={() => setPaletteOpen(true)}
          >
            Commands ⌘K
          </button>
          <button
            type="button"
            className={actionsOpen ? "chip chip--on" : "chip"}
            onClick={() => setActionsOpen((v) => !v)}
          >
            Block
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => {
              pageStore.rename("architecture", "System Architecture");
              pageRuntimeStore.prime({
                id: "architecture",
                title: "System Architecture",
                preview: "System design notes"
              });
            }}
          >
            Rename Architecture
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => {
              if (removedPage) {
                pageStore.restore(removedPage);
                pageRuntimeStore.prime(removedPage);
                setRemovedPage(null);
                return;
              }
              const removed = pageStore.remove("api-surface");
              if (removed) {
                pageRuntimeStore.prime(null, "api-surface");
                setRemovedPage(removed);
              }
            }}
          >
            {removedPage ? "Restore page" : "Delete API surface"}
          </button>
          <label className="chip chip--muted">
            Theme{" "}
            <select
              value={theme}
              onChange={(e) =>
                setTheme(e.target.value as "light" | "dark" | "system")
              }
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
          {lastOpenedPage ? (
            <p className="demo-open-hint" role="status">
              Host openPage → {lastOpenedPage}
            </p>
          ) : null}
          {lastOpenedRow ? (
            <p className="demo-open-hint" role="status">
              Host onOpenRow → {lastOpenedRow}
            </p>
          ) : null}
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
            <SuggestionMenuController
              triggerCharacter="@"
              getItems={getMentionItems}
            />
          </BlockNoteView>
        </main>

        {relationsOpen ? (
          <aside className="demo-actions" aria-label="Relations">
            <BacklinksPanel
              targetPageId="demo"
              provider={backlinks}
              relationIndex={relationIndex}
              resolveOutgoingTitle={(id) =>
                pageStore.pages.find((p) => p.id === id)?.title
              }
              onOpenOutgoingPage={(pageId) =>
                pageStore.provider.openPage?.(pageId)
              }
              onOpenBacklink={(item) =>
                setLastOpenedPage(item.sourceDocumentId)
              }
            />
          </aside>
        ) : null}

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
          <p>Outgoing relations: {relationIndex.size()}</p>
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
      {pagePickOpen ? (
        <div
          className="oe-overlay"
          role="presentation"
          onMouseDown={() => closePagePick(null)}
        >
          <div onMouseDown={(event) => event.stopPropagation()}>
            <WorkspacePagePicker
              open
              mode={pagePickMode}
              provider={pageStore.provider}
              pages={pageStore.pages}
              excludeIds={["demo"]}
              onPick={(page) => {
                if (page) pageRuntimeStore.prime(page);
                closePagePick(
                  page ? { pageId: page.id, title: page.title } : null
                );
              }}
            />
          </div>
        </div>
      ) : null}
      {childCreateOpen ? (
        <div
          className="oe-overlay"
          role="presentation"
          onMouseDown={() => closeChildCreate(null)}
        >
          <div
            className="oe-page-picker"
            role="dialog"
            aria-label="Create child page"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p className="oe-page-picker__heading">Create child page</p>
            <input
              className="oe-page-picker__input"
              value={childTitle}
              aria-label="Child page title"
              autoFocus
              onChange={(event) => setChildTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeChildCreate(null);
                if (event.key === "Enter") {
                  closeChildCreate({ title: childTitle });
                }
              }}
            />
            <button
              type="button"
              className="chip chip--on"
              onClick={() => closeChildCreate({ title: childTitle })}
            >
              Create
            </button>
            <button
              type="button"
              className="oe-page-picker__cancel"
              onClick={() => closeChildCreate(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
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
