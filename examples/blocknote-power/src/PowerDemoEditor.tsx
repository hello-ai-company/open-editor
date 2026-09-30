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
import {
  acceptSuggestionGroup,
  parseSuggestionGroup,
  rejectSuggestionGroup,
  type SuggestionGroup
} from "@hello-ai-company/editor-ai";
import { CanvasEditor } from "@hello-ai-company/editor-canvas/react";
import { createMagicLayoutSpec } from "@hello-ai-company/editor-canvas";
import { renderOpenEditorPresentation, renderOpenEditorSite } from "@hello-ai-company/editor-publish";
import {
  createEditorDocument,
  serializeEditorDocument,
  type EditorDocument
} from "@hello-ai-company/editor-core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDemoBacklinkProvider,
  createDemoDatabaseProvider,
  createDemoPageStore
} from "./demoProviders";
import { sampleDocument } from "./sampleDocument";
import type { EditorPageLink } from "@hello-ai-company/editor-core";

type DemoMode = "document" | "canvas" | "present" | "site";

type PendingDemoSuggestion = {
  group: SuggestionGroup;
  blockId: string;
  originalText: string;
  suggestedText: string;
  generatedAt: string;
  stale?: boolean;
};

const DEMO_AI_SOURCE = "A focused workspace keeps the content clear and the tools close at hand.";
const DEMO_AI_REWRITE = "A focused workspace keeps content clear and tools within reach.";

function selectedPlainParagraph(editor: {
  getSelection: () => { blocks: Array<{ id: string; type: string; content?: unknown }> } | undefined;
  getSelectedText: () => string;
}): { blockId: string; text: string } | null {
  const blocks = editor.getSelection()?.blocks ?? [];
  const selectedText = editor.getSelectedText();
  const block = blocks[0];
  if (blocks.length !== 1 || block?.type !== "paragraph" || !selectedText) return null;
  if (!Array.isArray(block.content) || block.content.length !== 1) return null;

  const inline = block.content[0];
  if (!inline || typeof inline !== "object" || Array.isArray(inline)) return null;
  const text = (inline as { type?: unknown; text?: unknown; styles?: unknown });
  const styles = text.styles;
  if (text.type !== "text" || typeof text.text !== "string") return null;
  if (styles && typeof styles === "object" && Object.keys(styles).length > 0) return null;
  return selectedText === text.text ? { blockId: block.id, text: text.text } : null;
}

export function PowerDemoEditor() {
  const index = useMemo(() => createDocumentIndex(), []);
  const relationIndex = useMemo(() => createRelationIndex(), []);
  const [pageRevision, setPageRevision] = useState(0);
  const [lastOpenedPage, setLastOpenedPage] = useState<string | null>(null);
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
  const childCreateDialogRef = useRef<HTMLDialogElement | null>(null);
  const [removedPage, setRemovedPage] = useState<EditorPageLink | null>(null);

  useEffect(() => {
    const dialog = childCreateDialogRef.current;
    if (!childCreateOpen || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [childCreateOpen]);

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
        },
        resolveRowMedia: (request) => {
          if (request.databaseId !== "tasks") return null;
          // Deterministic tiny SVG data URL from rowKey (never stored in EditorDocument).
          const hue =
            Math.abs(
              [...request.rowKey].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
            ) % 360;
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48" viewBox="0 0 64 48"><rect width="64" height="48" fill="hsl(${hue} 28% 72%)"/><text x="32" y="28" text-anchor="middle" font-size="10" fill="#44403c">${request.rowKey.slice(0, 6)}</text></svg>`;
          return {
            src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
            alt: request.rowKey
          };
        },
        resolveFeedRowMedia: (request) => {
          if (request.databaseId !== "tasks") return null;
          const hue =
            Math.abs(
              [...request.rowKey].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
            ) % 360;
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48" viewBox="0 0 64 48"><rect width="64" height="48" fill="hsl(${hue} 28% 72%)"/><text x="32" y="28" text-anchor="middle" font-size="10" fill="#44403c">${request.rowKey.slice(0, 6)}</text></svg>`;
          return {
            src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
            alt: request.rowKey
          };
        },
        // Host-owned demo locations — not a core `location` property type.
        resolveMapLocation: (request) => {
          if (request.databaseId !== "tasks") return null;
          const DEMO_LOCATIONS: Record<
            string,
            { latitude: number; longitude: number; label: string }
          > = {
            "task-1": {
              latitude: 35.6812,
              longitude: 139.7671,
              label: "Tokyo"
            },
            "task-2": {
              latitude: 37.7749,
              longitude: -122.4194,
              label: "San Francisco"
            },
            "task-3": {
              latitude: 51.5074,
              longitude: -0.1278,
              label: "London"
            },
            "task-4": { latitude: 0, longitude: 0, label: "Null Island" }
          };
          return DEMO_LOCATIONS[request.rowKey] ?? null;
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
  const [outlineOpen, setOutlineOpen] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 880px)").matches
  );
  const [relationsOpen, setRelationsOpen] = useState(false);
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [batchCount, setBatchCount] = useState(0);
  const [json, setJson] = useState(() => serializeEditorDocument(sampleDocument));
  const [actionsOpen, setActionsOpen] = useState(false);
  const [mode, setMode] = useState<DemoMode>("document");
  const [focusMode, setFocusMode] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<EditorDocument>(sampleDocument);
  const [canvasSpec, setCanvasSpec] = useState(() => createMagicLayoutSpec(sampleDocument, "report"));
  const [reviewSuggestion, setReviewSuggestion] = useState<PendingDemoSuggestion | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [canReviewSelection, setCanReviewSelection] = useState(false);
  const selectionRef = useRef<{ blockId: string; text: string } | null>(null);
  const devtoolsOpenRef = useRef(devtoolsOpen);
  devtoolsOpenRef.current = devtoolsOpen;
  const relationsOpenRef = useRef(relationsOpen);
  relationsOpenRef.current = relationsOpen;
  const [relationRevision, setRelationRevision] = useState(0);

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

  usePowerCommandPaletteShortcut(editor, () => setPaletteOpen((o) => !o));
  useQuickNavShortcut(editor, () => setNavOpen((o) => !o));

  useEffect(() => {
    const updateSelection = () => {
      const selection = selectedPlainParagraph(editor as never);
      selectionRef.current = selection;
      setCanReviewSelection((current) => current !== Boolean(selection) ? Boolean(selection) : current);
    };
    updateSelection();
    return editor.onSelectionChange(updateSelection);
  }, [editor]);

  useEffect(() => {
    relationIndex.replaceFromBlocks(
      "demo",
      fromBlockNote(editor.document as never).blocks
    );
  }, [editor, relationIndex]);

  const openMode = useCallback((nextMode: DemoMode) => {
    if (mode === "document") {
      const currentDocument = fromBlockNote(editor.document as never);
      setPreviewDocument(currentDocument);
      if (nextMode === "canvas") setCanvasSpec(createMagicLayoutSpec(currentDocument, "report"));
    }
    setMode(nextMode);
    setReviewSuggestion(null);
  }, [editor, mode]);

  const createDemoSuggestion = useCallback(() => {
    const selection = selectionRef.current;
    if (!selection) return;
    if (selection.text !== DEMO_AI_SOURCE) {
      setAiStatus("Select the example sentence to preview this local demo suggestion.");
      return;
    }

    try {
      const currentDocument = fromBlockNote(editor.document as never);
      const originalBlock = currentDocument.blocks.find((block) => block.id === selection.blockId);
      if (!originalBlock || originalBlock.type !== "paragraph") return;
      const generatedAt = new Date().toISOString();
      const group = parseSuggestionGroup({
        schemaVersion: 1,
        id: `demo-${crypto.randomUUID()}`,
        title: "Tighten this sentence",
        summary: "A shorter phrasing keeps the same idea and makes the action easier to scan.",
        baseDocument: currentDocument,
        changes: [{
          op: "replace",
          blockId: originalBlock.id,
          block: {
            ...originalBlock,
            content: [{ type: "text", text: DEMO_AI_REWRITE, styles: {} }]
          }
        }]
      });
      setReviewSuggestion({
        group,
        blockId: selection.blockId,
        originalText: selection.text,
        suggestedText: DEMO_AI_REWRITE,
        generatedAt
      });
      setAiStatus(null);
    setRelationsOpen(false);
    setActionsOpen(false);
    } catch (error) {
      setAiStatus(error instanceof Error ? error.message : "Could not prepare the demo suggestion.");
    }
  }, [editor]);

  const decideDemoSuggestion = useCallback((accept: boolean) => {
    const pending = reviewSuggestion;
    if (!pending) return;
    const decidedAt = new Date().toISOString();

    if (!accept) {
      const rejection = rejectSuggestionGroup(pending.group, {
        rejectedBy: "demo-user",
        rejectedAt: decidedAt
      });
      setReviewSuggestion(null);
      setAiStatus(`Rejected by ${rejection.rejectedBy} · the document was left unchanged.`);
      return;
    }

    if (pending.stale) return;
    try {
      const result = acceptSuggestionGroup(
        pending.group,
        fromBlockNote(editor.document as never),
        {
          acceptedBy: "demo-user",
          acceptedAt: decidedAt,
          source: {
            agentId: "openeditor-demo",
            runId: pending.group.id,
            generatedAt: pending.generatedAt
          }
        }
      );
      if (result.status === "stale") {
        setReviewSuggestion({ ...pending, stale: true });
        setAiStatus(result.reason);
        return;
      }

      const acceptedBlock = result.document.blocks.find((block) => block.id === pending.blockId);
      if (!acceptedBlock) throw new Error("The suggested block is no longer available.");
      const [replacement] = toBlockNoteForSchema(
        createEditorDocument([acceptedBlock]),
        options.schema
      );
      if (!replacement) throw new Error("The suggestion could not be converted to an editor block.");
      editor.replaceBlocks([acceptedBlock.id], [replacement as never]);
      const provenance = result.acceptedChange.provenance;
      setReviewSuggestion(null);
      setAiStatus(`Accepted by ${provenance.acceptedBy} · source ${provenance.sourceAgentId} · run ${provenance.sourceRunId}.`);
    } catch (error) {
      setAiStatus(error instanceof Error ? error.message : "Could not accept the demo suggestion.");
    }
  }, [editor, options.schema, reviewSuggestion]);

  const refreshJson = useCallback(() => {
    const doc = fromBlockNote(editor.document as never);
    setJson(serializeEditorDocument(doc));
  }, [editor]);

  const presentationHtml = useMemo(
    () => renderOpenEditorPresentation(previewDocument, { title: "Workspace primitives" }),
    [previewDocument]
  );
  const siteHtml = useMemo(
    () => renderOpenEditorSite(previewDocument, { title: "Workspace primitives" }),
    [previewDocument]
  );

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
    <div className={`demo-shell${focusMode ? " demo-shell--focus" : ""}`} data-oe-theme={themeAttr}>
      <header className="demo-top">
        <div className="demo-brand" aria-label="OpenEditor">
          <span className="demo-brand__mark" aria-hidden="true">O</span>
          <span className="demo-brand__name">OpenEditor</span>
        </div>
        <div className="demo-breadcrumb" aria-label="Current document">
          <span>Workspace</span><span aria-hidden="true">/</span><strong>Workspace primitives</strong>
        </div>
        <div className="demo-toolbar" role="group" aria-label="Workspace controls">
          <button
            type="button"
            className={outlineOpen ? "chip chip--on demo-panel-toggle" : "chip demo-panel-toggle"}
            onClick={() => setOutlineOpen((v) => !v)}
            aria-expanded={outlineOpen}
            aria-controls={outlineOpen ? "demo-outline-panel" : undefined}
          >
            Outline
          </button>
          <button
            type="button"
            className={relationsOpen ? "chip chip--on demo-panel-toggle" : "chip demo-panel-toggle"}
            onClick={() => setRelationsOpen((v) => !v)}
            aria-expanded={relationsOpen}
            aria-controls={relationsOpen ? "demo-context-panel" : undefined}
          >
            Context
          </button>
          <button type="button" className="chip" onClick={() => setNavOpen(true)} aria-label="Search this document">
            Search
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open commands, Command K"
          >
            Commands <kbd>⌘K</kbd>
          </button>
          <button
            type="button"
            className={actionsOpen ? "chip chip--on demo-panel-toggle" : "chip demo-panel-toggle"}
            onClick={() => setActionsOpen((v) => !v)}
            aria-expanded={actionsOpen}
            aria-controls={actionsOpen ? "demo-context-panel" : undefined}
          >
            Block actions
          </button>
          <button
            type="button"
            className={focusMode ? "chip chip--on demo-focus-toggle" : "chip demo-focus-toggle"}
            aria-pressed={focusMode}
            onClick={() => {
              setFocusMode((value) => !value);
              setOutlineOpen(false);
              setRelationsOpen(false);
              setActionsOpen(false);
              setDevtoolsOpen(false);
            }}
          >
            {focusMode ? "Exit focus" : "Focus"}
          </button>
          <label className="chip demo-theme-control">
            <span>Appearance</span>
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
            className={devtoolsOpen ? "chip chip--on demo-inspect-toggle" : "chip demo-inspect-toggle"}
            onClick={() => setDevtoolsOpen((v) => !v)}
            aria-expanded={devtoolsOpen}
            aria-controls={devtoolsOpen ? "demo-inspector-panel" : undefined}
          >
            Inspect
          </button>
        </div>
      </header>

      <nav className="demo-views" aria-label="Document views">
        {(["document", "canvas", "present", "site"] as const).map((view) => (
          <button
            key={view}
            type="button"
            aria-pressed={mode === view}
            className={mode === view ? "demo-view demo-view--active" : "demo-view"}
            onClick={() => openMode(view)}
          >
            {view === "document" ? "Document" : view === "canvas" ? "Canvas" : view === "present" ? "Present" : "Site"}
          </button>
        ))}
      </nav>

      <div className={`demo-workspace${!focusMode && outlineOpen ? " demo-workspace--outline" : ""}${!focusMode && (reviewSuggestion || relationsOpen || actionsOpen) ? " demo-workspace--context" : ""}`}>
        {!focusMode && outlineOpen ? (
          <OutlinePanel editor={editor} index={index} onClose={() => setOutlineOpen(false)} />
        ) : null}

        <main className="demo-editor">
          <div className="demo-page-heading">
            <div>
              <p className="demo-eyebrow">OPENEDITOR · WORKSPACE PRIMITIVES</p>
              <h1>Workspace primitives</h1>
            </div>
            <span className="demo-local-label">Local demo</span>
          </div>
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
          {mode === "document" ? (
            <BlockNoteView
              editor={editor}
              slashMenu={false}
              formattingToolbar={false}
              theme={bnTheme}
            >
              <FormattingToolbarController
                formattingToolbar={() => (
                  <div className="demo-selection-tools">
                    <FormattingToolbar />
                    <button
                      type="button"
                      className="demo-ai-action"
                      disabled={!canReviewSelection}
                      title={canReviewSelection ? "Review a sample rewrite" : "Select the example sentence to preview a rewrite"}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={createDemoSuggestion}
                    >
                      ✦ Improve
                    </button>
                  </div>
                )}
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
          ) : mode === "canvas" ? (
            <section className="demo-preview" aria-label="Canvas editor">
              <CanvasEditor
                document={previewDocument}
                spec={canvasSpec}
                onLayoutChange={setCanvasSpec}
              />
            </section>
          ) : mode === "present" ? (
            <iframe
              className="demo-published-preview demo-published-preview--presentation"
              title="Presentation preview"
              srcDoc={presentationHtml}
              sandbox="allow-scripts allow-presentation"
              allow="fullscreen"
            />
          ) : (
            <iframe
              className="demo-published-preview"
              title="Published site preview"
              srcDoc={siteHtml}
              sandbox=""
            />
          )}
          {aiStatus ? <p className="demo-feedback" role="status">{aiStatus}</p> : null}
        </main>

        {!focusMode && reviewSuggestion ? (
          <aside id="demo-context-panel" className="demo-context demo-review" aria-labelledby="demo-review-title">
            <div className="demo-panel-heading">
              <span>AI suggestion</span>
              <button type="button" className="demo-panel-close" aria-label="Close suggestion review" onClick={() => setReviewSuggestion(null)}>×</button>
            </div>
            <p className="demo-review__demo-label">Local sample · no model call</p>
            <h2 id="demo-review-title">{reviewSuggestion.group.title}</h2>
            <p className="demo-review__summary">{reviewSuggestion.group.summary}</p>
            <div className="demo-review__diff">
              <div><span>Original</span><p>{reviewSuggestion.originalText}</p></div>
              <div><span>Suggestion</span><p>{reviewSuggestion.suggestedText}</p></div>
            </div>
            {reviewSuggestion.stale ? <p className="demo-review__stale" role="alert">This text changed after the suggestion was prepared.</p> : null}
            <div className="demo-review__actions" role="group" aria-label="Suggestion decision">
              <button type="button" className="chip chip--on" disabled={reviewSuggestion.stale} onClick={() => decideDemoSuggestion(true)}>Accept</button>
              <button type="button" className="chip" onClick={() => decideDemoSuggestion(false)}>Reject</button>
            </div>
            <p className="demo-review__note">The suggestion is applied only after you accept it.</p>
          </aside>
        ) : !focusMode && (relationsOpen || actionsOpen) ? (
          <aside id="demo-context-panel" className="demo-context" aria-label="Document context" data-revision={relationRevision}>
            <div className="demo-panel-heading">
              <span>Context</span>
              <button type="button" className="demo-panel-close" aria-label="Close context" onClick={() => { setRelationsOpen(false); setActionsOpen(false); }}>×</button>
            </div>
            {relationsOpen ? (
              <BacklinksPanel
                targetPageId="demo"
                provider={backlinks}
                relationIndex={relationIndex}
                resolveOutgoingTitle={(id) => pageStore.pages.find((p) => p.id === id)?.title}
                onOpenOutgoingPage={(pageId) => pageStore.provider.openPage?.(pageId)}
                onOpenBacklink={(item) => setLastOpenedPage(item.sourceDocumentId)}
              />
            ) : null}
            {actionsOpen ? (
              <section className="demo-block-actions" aria-label="Block actions">
                <BlockActionMenu registry={preset.registry} context={ctx} />
              </section>
            ) : null}
          </aside>
        ) : null}
      </div>

      {devtoolsOpen ? (
        <aside id="demo-inspector-panel" className="demo-json" aria-label="Developer tools">
          <div className="demo-json__heading">
            <div><p className="demo-eyebrow">HOST BOUNDARY</p><h2>Inspect state</h2></div>
            <button type="button" className="demo-panel-close" aria-label="Close inspector" onClick={() => setDevtoolsOpen(false)}>×</button>
          </div>
          <p>Incremental batches received: {batchCount}</p>
          <p>Outgoing relations: {relationIndex.size()}</p>
          <button type="button" className="chip chip--on" onClick={refreshJson}>
            Refresh snapshot
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => {
              pageStore.rename("architecture", "System Architecture");
              pageRuntimeStore.prime({ id: "architecture", title: "System Architecture", preview: "System design notes" });
            }}
          >
            Rename sample page
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
            {removedPage ? "Restore sample page" : "Remove sample page"}
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
      <DemoChangeObserver
        editor={editor as never}
        onBatch={(batch) => {
          if (devtoolsOpenRef.current) {
            setBatchCount((count) => count + batch.changes.length);
          }
          relationIndex.applyChanges("demo", batch.changes);
          if (relationsOpenRef.current) setRelationRevision((revision) => revision + 1);
        }}
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
        <dialog
          ref={childCreateDialogRef}
          className="oe-overlay"
          aria-modal="true"
          aria-labelledby="demo-child-create-title"
          onCancel={(event) => {
            event.preventDefault();
            closeChildCreate(null);
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeChildCreate(null);
          }}
        >
          <div className="oe-page-picker">
            <p id="demo-child-create-title" className="oe-page-picker__heading">Create child page</p>
            <input
              className="oe-page-picker__input"
              value={childTitle}
              aria-label="Child page title"
              autoFocus
              onChange={(event) => setChildTitle(event.target.value)}
              onKeyDown={(event) => {
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
        </dialog>
      ) : null}
      <footer className="demo-footer">
        Document · Canvas · Present · Site <span aria-hidden="true">·</span> Host-owned storage and AI provider <span aria-hidden="true">·</span> MIT OpenEditor
      </footer>
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
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const revision = props.index.getRevision();
  const hits = useMemo(() => {
    void revision;
    return props.index
      .query({ query, preferHeadings: true, limit: 40 })
      .filter((entry) => !props.excludeIds.includes(entry.blockId));
  }, [props.index, props.excludeIds, query, revision]);

  useEffect(() => {
    if (!props.open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [props.open]);

  if (!props.open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="oe-overlay"
      aria-modal="true"
      aria-label="Insert block reference"
      onCancel={(event) => {
        event.preventDefault();
        props.onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onCancel();
      }}
    >
      <div
        className="oe-quick-nav"
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
    </dialog>
  );
}

function OutlinePanel(props: {
  editor: Parameters<typeof useDocumentOutline>[0]["editor"];
  index: ReturnType<typeof createDocumentIndex>;
  onClose: () => void;
}) {
  const { nodes, jump } = useDocumentOutline({
    editor: props.editor,
    index: props.index,
    seedFromDocument: true,
    batch: { strategy: "raf" }
  });
  return (
    <aside id="demo-outline-panel" className="demo-outline" aria-label="Document outline">
      <div className="demo-panel-heading">
        <span>On this page</span>
        <button type="button" className="demo-panel-close" aria-label="Close outline" onClick={props.onClose}>×</button>
      </div>
      <DocumentOutline nodes={nodes} onJump={jump} />
    </aside>
  );
}

function DemoChangeObserver(props: {
  editor: Parameters<typeof useOpenEditorBlockChanges>[0]["editor"];
  onBatch: (batch: OpenEditorChangeBatch) => void;
}) {
  useOpenEditorBlockChanges({
    editor: props.editor,
    batch: { strategy: "raf" },
    onBatch: props.onBatch
  });
  return null;
}
