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
  createDocumentOutline,
  toBlockNoteForSchema,
  useOpenEditorBlockChanges,
  usePowerCommandPaletteShortcut,
  type OpenEditorChangeBatch
} from "@hello-ai-company/editor-blocknote";
import {
  BacklinksPanel,
  BlockActionMenu,
  DatabaseViewPicker,
  createPageMentionSuggestionGetItems,
  DocumentOutline,
  jumpToBlock,
  QuickNav,
  useQuickNavShortcut,
  WorkspacePagePicker
} from "@hello-ai-company/editor-blocknote/react";
import type { DatabaseViewPick } from "@hello-ai-company/editor-blocknote/react";
import type { SuggestionGroup } from "@hello-ai-company/editor-ai";
import { Component, lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createMagicLayoutSpec } from "@hello-ai-company/editor-canvas";
import type { CanvasEditorViewState } from "@hello-ai-company/editor-canvas/react";
import {
  DEMO_AI_SOURCE,
  composeDemoRewrite,
  type DemoRewriteChoices,
  canImproveDemoSelection,
  canUndoDemoSuggestion,
  isDemoAiBusy,
  resolveDemoAiSource,
  type DemoAiAction
} from "./demoAiState.mjs";
import {
  createEditorDocument,
  serializeEditorDocument,
  type EditorDatabase,
  type EditorDocument
} from "@hello-ai-company/editor-core";
import {
  createDemoBacklinkProvider,
  createDemoDatabaseProvider,
  createDemoPageStore
} from "./demoProviders";
import { IdeaUnfold } from "./IdeaUnfold";
import { sampleDocument } from "./sampleDocument";
import type { EditorPageLink } from "@hello-ai-company/editor-core";
import { createCanvasPublicationOptions } from "./canvasPublication";
import type { AheadEditorPort } from "./AheadPanel";

const AheadPanel = lazy(() => import("./AheadPanel").then(module => ({ default: module.AheadPanel })));

const CanvasEditor = lazy(() =>
  import("@hello-ai-company/editor-canvas/react").then(({ CanvasEditor }) => ({
    default: CanvasEditor
  }))
);

type DemoMode = "document" | "canvas" | "present" | "site";

type PendingDemoSuggestion = {
  group: SuggestionGroup;
  blockId: string;
  originalText: string;
  suggestedText: string;
  generatedAt: string;
  choices: DemoRewriteChoices;
  decided?: "accepted" | "rejected" | "undone";
  stale?: boolean;
};

type PublishedPreview = {
  mode: "present" | "site";
  document: EditorDocument;
  html?: string;
  error?: string;
};

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

export function PowerDemoEditor({ onOpenPersonalContext, initialDocument = sampleDocument, documentTitle = "Workspace primitives", onDocumentChange, saveStatus = "Session only · not saved", readOnly = false, allowLocalAhead = true, workspaceActive = true }: {
  onOpenPersonalContext?: () => void; initialDocument?: EditorDocument; documentTitle?: string;
  onDocumentChange?: (document: EditorDocument) => void; saveStatus?: string; readOnly?: boolean; allowLocalAhead?: boolean; workspaceActive?: boolean;
} = {}) {
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
  const databasePickResolverRef = useRef<((pick: DatabaseViewPick | null) => void) | null>(null);
  const databasePickRequestRef = useRef(0);
  const [databasePickOpen, setDatabasePickOpen] = useState(false);
  const [databasePickLoading, setDatabasePickLoading] = useState(false);
  const [databasePickError, setDatabasePickError] = useState<string | undefined>();
  const [availableDatabases, setAvailableDatabases] = useState<EditorDatabase[]>([]);

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
        databaseViewConfig: databaseProvider.databaseViewConfig,
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
    () => toBlockNoteForSchema(initialDocument, options.schema),
    [initialDocument, options.schema]
  );

  const editor = useCreateBlockNote({
    ...options,
    initialContent: initialContent as never
  });

  useEffect(() => editor.onChange((_editor, context) => {
    // setEditable emits update even for a no-op transaction. Persist actual
    // block changes only, so locking/unmounting an old view cannot save its
    // snapshot over a newly committed host revision.
    if (context.getChanges().length) onDocumentChange?.(fromBlockNote(editor.document as never));
  }), [editor, onDocumentChange]);
  useEffect(() => { editor.isEditable = !readOnly; }, [editor, readOnly]);

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
  const [guideOpen, setGuideOpen] = useState(() => initialDocument.blocks.length === 0 || initialDocument.blocks.every(block => block.type === "paragraph" && Array.isArray(block.content) && block.content.length === 0 && !block.children?.length));
  const [emptyDocument, setEmptyDocument] = useState(false);
  const [editorActive, setEditorActive] = useState(false);
  const motionOnce = useRef(false);
  const [focusMode, setFocusMode] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<EditorDocument>(initialDocument);
  const [canvasSpec, setCanvasSpec] = useState(() => createMagicLayoutSpec(initialDocument, "report"));
  const [canvasViewState, setCanvasViewState] = useState<CanvasEditorViewState>();
  const [reviewSuggestion, setReviewSuggestion] = useState<PendingDemoSuggestion | null>(null);
  const [publishedPreview, setPublishedPreview] = useState<PublishedPreview | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiAction, setAiAction] = useState<DemoAiAction>(null);
  const aiOperationRef = useRef(false);
  const toolsRef = useRef<HTMLDetailsElement>(null);
  const [aheadOpen, setAheadOpen] = useState(false);
  const [aheadVisited, setAheadVisited] = useState(false);
  const aheadEditable = useRef(false);
  aheadEditable.current = mode === "document" && !readOnly && workspaceActive;
  const aheadPort = useMemo<AheadEditorPort>(() => ({
    getDocument: () => fromBlockNote(editor.document as never),
    subscribe: listener => editor.onChange((_editor, context) => { if (context.getChanges().length) listener(); }),
    commit: (expected, next) => {
      if (!aheadEditable.current || !sameEditorJson(fromBlockNote(editor.document as never), expected)) return false;
      const same = sameEditorJson;
      // This local preview supports append-only changes and their exact undo.
      // Preserve existing rich blocks, focus, selection and editor-owned history.
      if (next.blocks.length > expected.blocks.length && expected.blocks.every((block, index) => same(block, next.blocks[index]))) {
        const additions = toBlockNoteForSchema(createEditorDocument(next.blocks.slice(expected.blocks.length)), options.schema);
        const last = editor.document.at(-1);
        if (!last || !additions.length) return false;
        editor.insertBlocks(additions as never, last.id, "after");
      } else if (expected.blocks.length > next.blocks.length && next.blocks.length && next.blocks.every((block, index) => same(block, expected.blocks[index]))) {
        editor.removeBlocks(expected.blocks.slice(next.blocks.length).map(block => block.id));
      } else return false;
      return sameEditorJson(fromBlockNote(editor.document as never), next);
    }
  }), [editor, options.schema]);
  const [acceptedSuggestion, setAcceptedSuggestion] = useState<{
    original: typeof editor.document[number];
    accepted: typeof editor.document[number];
  } | null>(null);
  const [canReviewSelection, setCanReviewSelection] = useState(false);
  const selectionRef = useRef<{ blockId: string; text: string } | null>(null);
  const devtoolsOpenRef = useRef(devtoolsOpen);
  devtoolsOpenRef.current = devtoolsOpen;
  const relationsOpenRef = useRef(relationsOpen);
  relationsOpenRef.current = relationsOpen;
  const [relationRevision, setRelationRevision] = useState(0);
  const aiBusy = isDemoAiBusy(aiAction);
  const outlineVisible = !focusMode && outlineOpen;
  const inspectorVisible = !focusMode && devtoolsOpen;

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

  const requestDatabaseViewPick = useCallback(() => {
    return new Promise<DatabaseViewPick | null>((resolve) => {
      databasePickResolverRef.current?.(null);
      databasePickResolverRef.current = resolve;
      const requestId = ++databasePickRequestRef.current;
      setPaletteOpen(false);
      requestAnimationFrame(() => {
        if (requestId === databasePickRequestRef.current) setDatabasePickOpen(true);
      });
      setDatabasePickLoading(true);
      setDatabasePickError(undefined);
      void databaseProvider.listDatabases()
        .then((databases) => {
          if (requestId === databasePickRequestRef.current) setAvailableDatabases(databases);
        })
        .catch((error: unknown) => {
          if (requestId !== databasePickRequestRef.current) return;
          setAvailableDatabases([]);
          setDatabasePickError(error instanceof Error ? error.message : "Could not load host databases.");
        })
        .finally(() => {
          if (requestId === databasePickRequestRef.current) setDatabasePickLoading(false);
        });
    });
  }, [databaseProvider]);

  const closeDatabasePick = useCallback((pick: DatabaseViewPick | null) => {
    databasePickRequestRef.current += 1;
    databasePickResolverRef.current?.(pick);
    databasePickResolverRef.current = null;
    setDatabasePickOpen(false);
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
    }
    setMode(nextMode);
  }, [editor, mode]);

  const resetCanvasLayout = useCallback(() => {
    setCanvasSpec(createMagicLayoutSpec(previewDocument, "report"));
  }, [previewDocument]);

  const createDemoSuggestion = useCallback(async () => {
    const selection = selectionRef.current;
    if (!selection || aiBusy || aiOperationRef.current) return;
    if (selection.text !== DEMO_AI_SOURCE) {
      setAiAction("error");
      setAiStatus("This local demo can only rewrite the sample sentence. Keep your own text, or open Tools → Writing guide to try the sample.");
      return;
    }

    aiOperationRef.current = true;
    setAiAction("preparing");
    setAiStatus("Preparing the local suggestion…");
    try {
      const { parseSuggestionGroup } = await import("@hello-ai-company/editor-ai");
      const currentDocument = fromBlockNote(editor.document as never);
      const source = resolveDemoAiSource(currentDocument.blocks, selection.blockId, selection.text);
      if (source.action === "stale") {
        setAiAction(source.action);
        setAiStatus(source.status);
        return;
      }
      const originalBlock = source.block;
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
            content: [{ type: "text", text: composeDemoRewrite({ clarity: true, reach: true }), styles: {} }]
          }
        }]
      });
      setReviewSuggestion({
        group,
        blockId: selection.blockId,
        originalText: selection.text,
        suggestedText: composeDemoRewrite({ clarity: true, reach: true }),
        choices: { clarity: true, reach: true },
        generatedAt
      });
      setAiAction("review");
      setAiStatus(null);
      setRelationsOpen(false);
      setActionsOpen(false);
      if (window.matchMedia("(max-width: 760px)").matches) setOutlineOpen(false);
    } catch (error) {
      setAiAction("error");
      setAiStatus(error instanceof Error ? error.message : "Could not prepare the demo suggestion.");
    } finally {
      aiOperationRef.current = false;
    }
  }, [aiBusy, editor]);

  const selectDemoSentence = useCallback(() => {
    openMode("document");
    setGuideOpen(false);
    requestAnimationFrame(() => {
      const source = resolveDemoAiSource(fromBlockNote(editor.document as never).blocks, "p-ai-demo", DEMO_AI_SOURCE);
      if (source.action === "stale") {
        setAiStatus("The sample sentence has changed. Keep writing, or reload this session to restore the sample.");
        return;
      }
      jumpToBlock(editor as never, "p-ai-demo");
      selectionRef.current = { blockId: "p-ai-demo", text: DEMO_AI_SOURCE };
      void createDemoSuggestion();
    });
  }, [createDemoSuggestion, editor, openMode]);

  const decideDemoSuggestion = useCallback(async (accept: boolean) => {
    const pending = reviewSuggestion;
    if (!pending || pending.decided || aiBusy || aiOperationRef.current) return;
    if (accept && (pending.stale || (!pending.choices.clarity && !pending.choices.reach))) return;
    aiOperationRef.current = true;
    const decidedAt = new Date().toISOString();
    setAiAction(accept ? "accepting" : "rejecting");
    setAiStatus(accept ? "Applying suggestion…" : "Rejecting suggestion…");

    if (!accept) {
      try {
        const { rejectSuggestionGroup } = await import("@hello-ai-company/editor-ai");
        const rejection = rejectSuggestionGroup(pending.group, {
          rejectedBy: "demo-user",
          rejectedAt: decidedAt
        });
        setReviewSuggestion({ ...pending, decided: "rejected" });
        setAiAction("rejected");
        setAiStatus(`Rejected by ${rejection.rejectedBy} · the document was left unchanged.`);
      } catch (error) {
        setAiAction("error");
        setAiStatus(error instanceof Error ? error.message : "Could not reject the demo suggestion.");
      } finally {
        aiOperationRef.current = false;
      }
      return;
    }

    try {
      const { acceptSuggestionGroup, parseSuggestionGroup } = await import("@hello-ai-company/editor-ai");
      const baseBlock = pending.group.baseDocument.blocks.find((block) => block.id === pending.blockId);
      if (!baseBlock) throw new Error("The source paragraph is unavailable. Reject this review and try again.");
      const selectedGroup = parseSuggestionGroup({
        ...pending.group,
        changes: [{ op: "replace", blockId: pending.blockId, block: {
          ...baseBlock,
          content: [{ type: "text", text: pending.suggestedText, styles: {} }]
        } }]
      });
      const result = acceptSuggestionGroup(
        selectedGroup,
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
        setAiAction("stale");
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
      const original = editor.getBlock(acceptedBlock.id);
      if (!original) throw new Error("The original block is no longer available.");
      editor.replaceBlocks([acceptedBlock.id], [replacement as never]);
      const accepted = editor.getBlock(acceptedBlock.id);
      if (accepted) setAcceptedSuggestion({ original: structuredClone(original), accepted: structuredClone(accepted) });
      const root = editor.domElement?.closest<HTMLElement>(".demo-shell");
      const acceptedElement = editor.domElement?.querySelector<HTMLElement>(
        `[data-id="${CSS.escape(acceptedBlock.id)}"]`
      );
      if (
        root &&
        acceptedElement?.animate &&
        !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ) {
        const motion = getComputedStyle(root);
        acceptedElement.animate(
          [
            { backgroundColor: motion.getPropertyValue("--demo-accent-soft").trim() },
            { backgroundColor: "transparent" }
          ],
          {
            duration: Number.parseFloat(motion.getPropertyValue("--oe-ui-motion-panel")) || 220,
            easing: motion.getPropertyValue("--oe-ui-motion-ease-enter").trim() || "ease-out"
          }
        );
      }
      setReviewSuggestion({ ...pending, decided: "accepted" });
      setAiAction("accepted");
      setAiStatus("Suggestion accepted. You can undo it without changing other paragraphs.");
    } catch (error) {
      setAiAction("error");
      setAiStatus(error instanceof Error ? error.message : "Could not accept the demo suggestion.");
    } finally {
      aiOperationRef.current = false;
    }
  }, [aiBusy, editor, options.schema, reviewSuggestion]);

  const undoSuggestion = useCallback(() => {
    if (!acceptedSuggestion || aiOperationRef.current) return;
    const current = editor.getBlock(acceptedSuggestion.accepted.id);
    if (!canUndoDemoSuggestion(current, acceptedSuggestion.accepted)) {
      setAiStatus("This paragraph changed after acceptance. Use the editor undo history to keep your later edits safe.");
      return;
    }
    editor.replaceBlocks([acceptedSuggestion.accepted.id], [acceptedSuggestion.original as never]);
    setAcceptedSuggestion(null);
    setReviewSuggestion(current => current?.decided === "accepted" ? { ...current, decided: "undone" } : current);
    setAiAction(null);
    setAiStatus("AI change undone. Other paragraphs were kept.");
    editor.focus();
  }, [acceptedSuggestion, editor]);

  useEffect(() => {
    const closeTools = (event: PointerEvent | KeyboardEvent) => {
      const tools = toolsRef.current;
      if (!tools?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        tools.open = false;
        tools.querySelector<HTMLElement>("summary")?.focus();
      } else if (event.target instanceof Node && !tools.contains(event.target)) {
        tools.open = false;
      }
    };
    document.addEventListener("pointerdown", closeTools);
    document.addEventListener("keydown", closeTools);
    return () => {
      document.removeEventListener("pointerdown", closeTools);
      document.removeEventListener("keydown", closeTools);
    };
  }, []);

  const refreshJson = useCallback(() => {
    const doc = fromBlockNote(editor.document as never);
    setJson(serializeEditorDocument(doc));
  }, [editor]);

  useEffect(() => {
    if (mode !== "present" && mode !== "site") return;
    let cancelled = false;
    void import("@hello-ai-company/editor-publish")
      .then(({ renderOpenEditorPresentation, renderOpenEditorSite }) => {
        if (cancelled) return;
        const options = createCanvasPublicationOptions(
          "Workspace primitives",
          canvasSpec,
          canvasViewState
        );
        const html = mode === "present"
          ? renderOpenEditorPresentation(previewDocument, options)
          : renderOpenEditorSite(previewDocument, options);
        setPublishedPreview({ mode, document: previewDocument, html });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPublishedPreview({
          mode,
          document: previewDocument,
          error: error instanceof Error ? error.message : "Could not load this preview."
        });
      });
    return () => {
      cancelled = true;
    };
  }, [mode, previewDocument, canvasSpec, canvasViewState]);

  const activePublishedPreview =
    (mode === "present" || mode === "site") &&
    publishedPreview?.mode === mode &&
    publishedPreview.document === previewDocument
      ? publishedPreview
      : null;

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
      <a className="demo-skip-link" href="#demo-main">Skip to document</a>
      <header className="demo-top">
        <div className="demo-brand" aria-label="OpenEditor">
          <span className="demo-brand__mark" aria-hidden="true">O</span>
          <span className="demo-brand__name">OpenEditor</span>
        </div>
        <div className="demo-breadcrumb" aria-label="Current document">
          <span>Workspace</span><span aria-hidden="true">/</span><strong>{documentTitle}</strong>
        </div>
        <div className="demo-toolbar" role="group" aria-label="Workspace controls">
          <div className="demo-toolbar__utilities" aria-hidden={focusMode} inert={focusMode}>
            <button
              type="button"
              className={outlineOpen ? "chip chip--on demo-panel-toggle" : "chip demo-panel-toggle"}
              onClick={() => setOutlineOpen((v) => !v)}
              aria-expanded={outlineVisible}
              aria-controls={outlineVisible ? "demo-outline-panel" : undefined}
            >
              Outline
            </button>
            <button type="button" className="chip" onClick={() => { openMode("document"); setNavOpen(true); }} aria-label="Search this document">
              Search
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => { openMode("document"); setPaletteOpen(true); }}
              aria-label="Open commands, Command K"
            >
              Commands <kbd>⌘K</kbd>
            </button>
            <details ref={toolsRef} className="demo-tools">
              <summary className="chip">Tools <span aria-hidden="true">⌄</span></summary>
              <div className="demo-tools__panel" onClick={(event) => {
                if ((event.target as HTMLElement).closest("button")) {
                  toolsRef.current?.removeAttribute("open");
                  toolsRef.current?.querySelector<HTMLElement>("summary")?.focus();
                }
              }}>
                {allowLocalAhead ? <button type="button" className="chip" aria-expanded={aheadOpen} onClick={() => { openMode("document"); setAheadVisited(true); setAheadOpen(value => !value); if (window.matchMedia("(max-width: 760px)").matches) setOutlineOpen(false); }}>先行AI共同作業</button> : null}
                <button type="button" className="chip" onClick={() => { openMode("document"); setGuideOpen(true); }}>Writing guide</button>
                {onOpenPersonalContext ? <button type="button" className="chip" onClick={onOpenPersonalContext}>Personal context demo</button> : null}
                <button
                  type="button"
                  className={relationsOpen ? "chip chip--on demo-panel-toggle" : "chip demo-panel-toggle"}
                  onClick={() => setRelationsOpen((v) => !v)}
                  aria-expanded={!focusMode && relationsOpen}
                  aria-controls={!focusMode && relationsOpen ? "demo-context-panel" : undefined}
                >
                  Context
                </button>
                <button
                  type="button"
                  className={actionsOpen ? "chip chip--on demo-panel-toggle" : "chip demo-panel-toggle"}
                  onClick={() => { openMode("document"); setActionsOpen((v) => !v); }}
                  aria-expanded={!focusMode && actionsOpen}
                  aria-controls={!focusMode && actionsOpen ? "demo-context-panel" : undefined}
                >
                  Block actions
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
                  aria-expanded={inspectorVisible}
                  aria-controls={inspectorVisible ? "demo-inspector-panel" : undefined}
                >
                  Inspect
                </button>
              </div>
            </details>
          </div>
          <button
            type="button"
            className={focusMode ? "chip chip--on demo-focus-toggle" : "chip demo-focus-toggle"}
            aria-pressed={focusMode}
            onClick={() => setFocusMode((value) => !value)}
          >
            {focusMode ? "Exit focus" : "Focus"}
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

      <div className={`demo-workspace${outlineOpen ? " demo-workspace--outline" : ""}${((aheadOpen && mode === "document") || reviewSuggestion || relationsOpen || actionsOpen) ? " demo-workspace--context" : ""}`}>
        {outlineOpen ? (
          <OutlinePanel
            editor={editor as never}
            index={index}
            onClose={() => setOutlineOpen(false)}
            onNavigate={() => setMode("document")}
            focusHidden={focusMode}
          />
        ) : null}

        <main id="demo-main" tabIndex={-1} className="demo-editor" data-mode={mode}>
          <div className="demo-page-heading">
            <div>
              <p className="demo-eyebrow">Your workspace</p>
              <h1>{documentTitle}</h1>
            </div>
            <span className="demo-local-label">{saveStatus}</span>
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
          {mode === "document" && !focusMode && (guideOpen || (emptyDocument && !editorActive)) ? (
            <section className="demo-writing-guide" aria-labelledby="demo-guide-title">
              <IdeaUnfold once={motionOnce} />
              <div className="demo-writing-guide__copy">
                <p className="demo-eyebrow">{emptyDocument ? "A blank page" : "A little room to think"}</p>
                <h2 id="demo-guide-title">{emptyDocument ? "Start with a sentence." : "Your words. Your call."}</h2>
                <p>Write freely. Review each change before it becomes yours.</p>
                <div className="demo-writing-guide__actions">
                  <button type="button" className="chip chip--on" onClick={() => { setGuideOpen(false); editor.focus(); }}>Start writing</button>
                  {!emptyDocument ? <button type="button" className="chip" onClick={selectDemoSentence}>Try a sample review</button> : null}
                </div>
                <small>Local demo · no AI connection. Illustration is decorative.</small>
              </div>
              {!emptyDocument ? <button type="button" className="demo-panel-close" aria-label="Dismiss writing guide" onClick={() => setGuideOpen(false)}>×</button> : null}
            </section>
          ) : null}
          {mode === "document" ? (
            <p className="demo-edit-hint">Write with / commands · ⌘K / Ctrl+K opens commands</p>
          ) : null}
          {mode === "document" ? (
            <BlockNoteView
              editor={editor}
              slashMenu={false}
              formattingToolbar={false}
              theme={bnTheme}
              onFocus={() => { setEditorActive(true); setGuideOpen(false); }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setEditorActive(false);
              }}
            >
              <FormattingToolbarController
                formattingToolbar={() => (
                  <div className="demo-selection-tools">
                    <FormattingToolbar />
                    <button
                      type="button"
                      className="demo-ai-action"
                      data-state={aiAction === "preparing" ? "preparing" : "idle"}
                      aria-busy={aiAction === "preparing"}
                      disabled={!canImproveDemoSelection(canReviewSelection, aiAction)}
                      title={canReviewSelection ? "Review a sample rewrite" : "Select the example sentence to preview a rewrite"}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={createDemoSuggestion}
                    >
                      {aiAction === "preparing" ? "Preparing…" : "✦ Improve"}
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
              <div role="group" aria-label="Canvas layout controls">
                <button type="button" className="chip" onClick={resetCanvasLayout}>
                  Reset to Magic Layout
                </button>
              </div>
              <Suspense fallback={<p className="demo-feedback" role="status">Loading Canvas…</p>}>
                <CanvasEditor
                  document={previewDocument}
                  spec={canvasSpec}
                  viewState={canvasViewState}
                  onViewStateChange={setCanvasViewState}
                  onLayoutChange={setCanvasSpec}
                />
              </Suspense>
            </section>
          ) : activePublishedPreview?.html ? (
            mode === "present" ? (
              <iframe
                className="demo-published-preview demo-published-preview--presentation"
                title="Presentation preview"
                srcDoc={activePublishedPreview.html}
                sandbox="allow-scripts allow-presentation"
                allow="fullscreen"
              />
            ) : (
              <iframe
                className="demo-published-preview"
                title="Published site preview"
                srcDoc={activePublishedPreview.html}
                sandbox=""
              />
            )
          ) : (
            <p className="demo-feedback" role={activePublishedPreview?.error ? "alert" : "status"}>
              {activePublishedPreview?.error ? "This preview could not open. Your writing is kept in Document." : `Loading ${mode === "present" ? "presentation" : "site"} preview…`}
              {activePublishedPreview?.error ? <button type="button" className="chip" onClick={() => openMode("document")}>Return to Document</button> : null}
            </p>
          )}
          {aiStatus ? (
            <p className="demo-feedback demo-ai-status" role="status" aria-live="polite" aria-atomic="true" data-state={aiAction ?? "idle"}>
              {aiStatus}
              {acceptedSuggestion && !reviewSuggestion ? <button type="button" className="chip" disabled={aiBusy || mode !== "document"} onClick={undoSuggestion}>Undo AI change</button> : null}
            </p>
          ) : null}
        </main>

        {aheadVisited ? <aside className="demo-context demo-ahead-shell" hidden={!aheadOpen || mode !== "document"} aria-hidden={focusMode} inert={focusMode} data-focus-hidden={focusMode ? "true" : "false"}>
          <AheadBoundary onClose={() => setAheadOpen(false)}><Suspense fallback={<p role="status">先行作業を読み込み中…</p>}><AheadPanel port={aheadPort} active={aheadOpen && !focusMode && mode === "document" && !readOnly && workspaceActive} onClose={() => setAheadOpen(false)} /></Suspense></AheadBoundary>
        </aside> : null}
        {!aheadOpen && reviewSuggestion ? (
          <aside
            id="demo-context-panel"
            className="demo-context demo-review"
            aria-labelledby="demo-review-title"
            aria-hidden={focusMode}
            inert={focusMode}
            data-focus-hidden={focusMode ? "true" : "false"}
            aria-busy={aiAction === "accepting" || aiAction === "rejecting"}
            data-state={aiAction === "accepting" || aiAction === "rejecting" ? aiAction : reviewSuggestion.stale ? "stale" : "review"}
          >
            <div className="demo-panel-heading">
              <span>AI suggestion</span>
              <button type="button" className="demo-panel-close" aria-label="Close suggestion review" disabled={aiBusy} onClick={() => { setReviewSuggestion(null); setAiAction(null); setAiStatus(reviewSuggestion.decided === "accepted" ? "Review closed. The accepted change is kept." : "Review dismissed. Your document was left unchanged."); }}>×</button>
            </div>
            <p className="demo-review__demo-label">Local demo · no connected agent</p>
            <h2 id="demo-review-title">{reviewSuggestion.group.title}</h2>
            <p className="demo-review__summary">{reviewSuggestion.group.summary}</p>
            <button type="button" className="chip demo-review__source" onClick={() => {
              openMode("document");
              requestAnimationFrame(() => jumpToBlock(editor as never, reviewSuggestion.blockId));
            }}>↗ Selected paragraph</button>
            <p className="demo-review__evidence">Source: the selected sentence only. Reasons below are authored demo examples; no external memory or evidence was retrieved.</p>
            <fieldset className="demo-review__choices" disabled={aiBusy || reviewSuggestion.stale || Boolean(reviewSuggestion.decided)}>
              <legend>Choose what to keep</legend>
              {(["clarity", "reach"] as const).map((key) => (
                <label key={key}>
                  <input type="checkbox" checked={reviewSuggestion.choices[key]} onChange={(event) => {
                    const enabled = event.target.checked;
                    setReviewSuggestion((current) => {
                      if (!current) return current;
                      const choices = { ...current.choices, [key]: enabled };
                      return { ...current, choices, suggestedText: composeDemoRewrite(choices) };
                    });
                  }} />
                  <span>
                    <strong>{key === "clarity" ? "Remove an extra article" : "Use a shorter phrase"}</strong>
                    <span className="demo-review__change"><del>{key === "clarity" ? "the content" : "the tools close at hand"}</del><ins>{key === "clarity" ? "content" : "tools within reach"}</ins></span>
                    <small>{key === "clarity" ? "Sample reason: the meaning stays clear with fewer words." : "Sample reason: a direct phrase is easier to scan."}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="demo-review__diff">
              <div><span>Before</span><p>{reviewSuggestion.originalText}</p></div>
              <div><span>After · your selection</span><p>{reviewSuggestion.suggestedText}</p></div>
            </div>
            {reviewSuggestion.stale ? <p className="demo-review__stale" role="alert">This text changed after the suggestion was prepared.</p> : null}
            <div className="demo-review__actions" role="group" aria-label="Suggestion decision">
              <button
                type="button"
                className="chip chip--on demo-review__accept"
                data-state={aiAction === "accepting" ? "accepting" : reviewSuggestion.stale ? "stale" : "idle"}
                aria-busy={aiAction === "accepting"}
                disabled={Boolean(reviewSuggestion.decided) || reviewSuggestion.stale || aiBusy || mode !== "document" || (!reviewSuggestion.choices.clarity && !reviewSuggestion.choices.reach)}
                onClick={() => decideDemoSuggestion(true)}
              >
                {reviewSuggestion.decided ? reviewSuggestion.decided === "accepted" ? "Accepted" : reviewSuggestion.decided === "undone" ? "Undone" : "Not applied" : aiAction === "accepting" ? "Applying…" : "Accept selected"}
              </button>
              <button
                type="button"
                className="chip demo-review__reject"
                data-state={aiAction === "rejecting" ? "rejecting" : "idle"}
                aria-busy={aiAction === "rejecting"}
                disabled={aiBusy || Boolean(reviewSuggestion.decided)}
                onClick={() => decideDemoSuggestion(false)}
              >
                {aiAction === "rejecting" ? "Rejecting…" : "Reject"}
              </button>
              {reviewSuggestion.decided === "accepted" && acceptedSuggestion ? <button type="button" className="chip" disabled={aiBusy || mode !== "document"} onClick={undoSuggestion}>Undo AI change</button> : null}
            </div>
            <p className="demo-review__note">{reviewSuggestion.decided ? reviewSuggestion.decided === "accepted" ? "Your selected change is applied. Undo it here, or close this review." : reviewSuggestion.decided === "undone" ? "This change was undone. Your original paragraph is restored." : "This suggestion was not applied. Your paragraph is unchanged." : mode !== "document" ? "Return to Document to accept this suggestion." : !reviewSuggestion.choices.clarity && !reviewSuggestion.choices.reach ? "Select at least one change, or reject the suggestion." : "Only selected changes enter your document. You can undo them after acceptance."}</p>
          </aside>
        ) : !aheadOpen && (relationsOpen || actionsOpen) ? (
          <aside
            id="demo-context-panel"
            className="demo-context"
            aria-label="Document context"
            aria-hidden={focusMode}
            inert={focusMode}
            data-focus-hidden={focusMode ? "true" : "false"}
            data-revision={relationRevision}
          >
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

      {inspectorVisible ? (
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
      <DatabaseViewPicker
        open={databasePickOpen}
        databases={availableDatabases}
        loading={databasePickLoading}
        errorMessage={databasePickError}
        onPick={closeDatabasePick}
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
        index={index}
        onBatch={(batch) => {
          const only = index.size() === 1 ? index.list()[0] : undefined;
          setEmptyDocument(Boolean(only?.type === "paragraph" && !only.text.trim()));
          if (batch.changes.length) setGuideOpen(false);
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
  const id = useId();
  const titleId = `${id}-title`;
  const inputId = `${id}-input`;
  const listboxId = `${id}-listbox`;
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const revision = useSyncExternalStore(
    props.index.subscribe,
    props.index.getRevision,
    props.index.getRevision
  );
  const hits = useMemo(() => {
    void revision;
    return props.index
      .query({ query, preferHeadings: true, limit: 40 })
      .filter((entry) => !props.excludeIds.includes(entry.blockId));
  }, [props.index, props.excludeIds, query, revision]);
  const selectedIndex = Math.min(activeIndex, Math.max(hits.length - 1, 0));

  useEffect(() => {
    if (!props.open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    dialog.showModal();
    setActiveIndex(0);
    inputRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [props.open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex, hits]);

  if (!props.open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="oe-overlay"
      aria-modal="true"
      aria-labelledby={titleId}
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
        <h2 id={titleId} className="oe-page-picker__heading">Insert block reference</h2>
        <label htmlFor={inputId}>Search blocks</label>
        <input
          ref={inputRef}
          id={inputId}
          className="oe-quick-nav__input"
          placeholder="Pick a block to reference…"
          role="combobox"
          aria-controls={listboxId}
          aria-expanded="true"
          aria-autocomplete="list"
          aria-activedescendant={
            hits[selectedIndex] ? `${listboxId}-option-${selectedIndex}` : undefined
          }
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex(Math.min(selectedIndex + 1, Math.max(hits.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex(Math.max(selectedIndex - 1, 0));
            } else if (event.key === "Enter") {
              const hit = hits[selectedIndex];
              if (hit) {
                event.preventDefault();
                props.onPick(hit.blockId);
              }
            }
          }}
        />
        {hits.length === 0 ? (
          <p className="oe-quick-nav__empty" role="status">No matching blocks</p>
        ) : null}
        <ul ref={listRef} id={listboxId} className="oe-quick-nav__list" role="listbox">
          {hits.map((entry, index) => (
              <li key={entry.blockId} role="presentation">
                <button
                  type="button"
                  className="oe-quick-nav__item"
                  role="option"
                  tabIndex={-1}
                  id={`${listboxId}-option-${index}`}
                  aria-selected={index === selectedIndex}
                  data-active={index === selectedIndex ? "true" : "false"}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => props.onPick(entry.blockId)}
                >
                  <span className="oe-quick-nav__type">{entry.type}</span>
                  <span className="oe-quick-nav__text">
                    {entry.text.trim() || entry.blockId}
                  </span>
                </button>
              </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}

function OutlinePanel(props: {
  editor: Parameters<typeof useOpenEditorBlockChanges>[0]["editor"];
  index: ReturnType<typeof createDocumentIndex>;
  onClose: () => void;
  onNavigate: () => void;
  focusHidden: boolean;
}) {
  const revision = useSyncExternalStore(
    props.index.subscribe,
    props.index.getRevision,
    props.index.getRevision
  );
  const nodes = useMemo(() => {
    void revision;
    return createDocumentOutline(props.index);
  }, [props.index, revision]);
  const jump = useCallback(
    (blockId: string) => {
      props.onNavigate();
      requestAnimationFrame(() => {
        jumpToBlock(props.editor as never, blockId);
        if (window.matchMedia("(max-width: 760px)").matches) props.onClose();
      });
    },
    [props.editor, props.onNavigate, props.onClose]
  );
  return (
    <aside
      id="demo-outline-panel"
      className="demo-outline"
      aria-label="Document outline"
      aria-hidden={props.focusHidden}
      inert={props.focusHidden}
      data-focus-hidden={props.focusHidden ? "true" : "false"}
    >
      <div className="demo-panel-heading">
        <span>On this page</span>
        <button type="button" className="demo-panel-close" aria-label="Close outline" onClick={props.onClose}>×</button>
      </div>
      <DocumentOutline nodes={nodes} onJump={jump} />
    </aside>
  );
}

function DemoChangeObserver(props: {
  editor: Parameters<typeof useOpenEditorBlockChanges>[0]["editor"] & { document?: unknown };
  index: ReturnType<typeof createDocumentIndex>;
  onBatch: (batch: OpenEditorChangeBatch) => void;
}) {
  useOpenEditorBlockChanges({
    editor: props.editor,
    batch: { strategy: "raf" },
    onBatch: (batch) => {
      props.index.applyChanges(batch.changes);
      props.onBatch(batch);
    }
  });
  useEffect(() => {
    props.index.replaceFromBlocks(fromBlockNote(props.editor.document as never).blocks);
  }, [props.editor, props.index]);
  return null;
}

class AheadBoundary extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <section role="alert"><p>先行作業を開けませんでした。文書は保持しています。</p><button className="chip" onClick={this.props.onClose}>文書に戻る</button></section> : this.props.children;
  }
}

// Both operands are host-owned or validated editor JSON. Preserve array order,
// while allowing the editor to reorder object keys during normalization.
function sameEditorJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => sameEditorJson(item, b[index]));
  return Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, value]) => Object.hasOwn(b, key) && sameEditorJson(value, (b as Record<string, unknown>)[key]));
}
