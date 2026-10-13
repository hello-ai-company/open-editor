import { notesInsertionLinkAllowed, notesLinkSelectionAllowed } from "./notesLinkPolicy.js";
export { notesSafeInsertionLink } from "./notesLinkPolicy.js";
import type { NotesInsertionAnchor } from "./notesToolDrag.js";
import { useEffect, useId, useRef, useState } from "react";
import { serializeEditorDocument, type EditorAsset, type EditorBlock, type EditorDatabase, type ImageSearchResult } from "@hello-ai-company/editor-core";
import type { NotesCommandOutcome, NotesPageSummary, NotesScope, NotesWorkspaceController, NotesWorkspaceHost, NotesWorkspaceSnapshot } from "../notes/contracts.js";
import { notesSafeAssetUrl, type NotesMediaScope, type NotesScopedMediaHost } from "./NotesContentTools.js";
import { NotesPanelStatus, notesBlockById, notesIsComposing, notesOutcomeMessage, notesPanelIdentity, useNotesComposition, useNotesController, type NotesInsertKind, type NotesStyleKind } from "./notesWorkspacePanels.js";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";

export type NotesPickerInsertKind = "page" | "link" | "card" | "attachment" | "image" | "video" | "audio" | "pdf" | "unsplash" | "syncedBlock" | "collection" | "gallery" | "kanban";
export type NotesInsertRequest = { id: string; kind: NotesPickerInsertKind; signal?: AbortSignal; anchor?: NotesInsertionAnchor };
export type NotesSharedInsertRecord = { id: string; title: string; revision?: string };
export type NotesInsertionHost = {
  scope: NotesScope;
  /** Optional host restriction for schema-local widgets whose durable codec is available.
   * Omitted preserves the schema default; an empty array disables local insertions. */
  localInsertKinds?: readonly NotesInsertKind[];
  /** Optional owner-scoped durable-codec restrictions. Omitted keeps SDK defaults. */
  pickerInsertKinds?: readonly NotesPickerInsertKind[];
  /** Optional stricter URL policy, shared by picker and native link ingress.
   * Scope is checked live; omitted preserves the SDK defaults. */
  isValidLink?(href: string): boolean;
  /** Native block types whose complete inline-link codec the host can persist. */
  linkBlockTypes?: readonly string[];
  /** False when the durable host codec cannot retain links across hard line breaks. */
  allowLinkHardBreaks?: boolean;
  /** Separate inline-color codec restriction; does not grant block or table-cell colors. */
  inlineColorBlockTypes?: readonly string[];
  allowInlineColorHardBreaks?: boolean;
  localStyleKinds?: readonly NotesStyleKind[];
  /** Keys from getFormattingToolbarItems; blockColors controls the default gutter menu. */
  nativeFormattingItems?: readonly string[];
  /** Text selections outside these block types do not advertise restricted native formats. */
  nativeFormattingBlockTypes?: readonly string[];
  /** Enumeration and lookup must both return only currently authorized records. */
  listDatabases?(signal: AbortSignal, options: { query: string; cursor?: string }): Promise<{ databases: readonly EditorDatabase[]; nextCursor: string | null; hasMore: boolean }>;
  getDatabase?(id: string, signal: AbortSignal): Promise<EditorDatabase | null>;
  /** True only when the installed databaseView runtime is actually bound to these providers. */
  databaseViewsBound?: boolean;
  listShared?(signal: AbortSignal, options: { query: string; cursor?: string }): Promise<{ records: readonly NotesSharedInsertRecord[]; nextCursor: string | null; hasMore: boolean }>;
  getShared?(id: string, signal: AbortSignal): Promise<NotesSharedInsertRecord | null>;
  /** True only with an instance-scoped resolver for oeNotesSyncedBlock. */
  sharedBlocksBound?: boolean;
  resolvePageLink?(page: NotesPageSummary): string;
  /** Opt-in navigation after a verified child receipt AND committed parent-reference save.
   * No callback on failure/unknown/cancellation. Host owns the pane and actual navigation. */
  onCreatedPageReady?(context: { page: NotesPageSummary; scope: NotesScope; parentTarget: { kind: "page"; pageId: string }; parentRevision: string; parentContentRevision: string; signal: AbortSignal }): void | Promise<void>;
};
/** Synchronous local edits: each callback checks signal and publishes controller.setDraft.
 * Selection fingerprint includes a selection generation, so away-and-back is not mistaken for unchanged. */
export type NotesInsertEditor = {
  installedBlockTypes: readonly string[];
  getSelectedBlockId(): string;
  getSelectionFingerprint(): string;
  getSelectedText?(): string;
  getSelectedBlockTypes?(): readonly string[];
  getSelectedBlocksHaveHardBreaks?(): boolean;
  insertBlocks(blocks: readonly EditorBlock[], afterBlockId: string, signal: AbortSignal, placement?: "before" | "after"): void;
  insertLink(href: string, label: string, signal: AbortSignal): void;
};
/** cancelled closes the picker; an in-flight host mutation may still require controller receipt lookup. */
export type NotesInsertDialogResult = { status: "inserted" | "cancelled"; createdPageId?: string };
export type NotesInsertDialogProps = {
  request: NotesInsertRequest | null; controller: NotesWorkspaceController; host: NotesWorkspaceHost;
  editor: NotesInsertEditor; insertion?: NotesInsertionHost; media?: NotesScopedMediaHost;
  onAssetAccepted?(asset: EditorAsset, scope: NotesMediaScope, signal: AbortSignal, presentation: "compact" | "card"): Promise<void>;
  onClose(result: NotesInsertDialogResult): void;
};
const labels: Record<NotesPickerInsertKind, string> = { page: "子ページを追加", link: "リンクを追加", card: "ページカードを追加", attachment: "添付ファイルを追加", image: "画像を追加", video: "ビデオを追加", audio: "音声を追加", pdf: "PDFを追加", unsplash: "画像を探す", syncedBlock: "同期ブロックを追加", collection: "データベースを追加", gallery: "ギャラリーを追加", kanban: "カンバンを追加" };
const mediaKinds = new Set<NotesPickerInsertKind>(["attachment", "image", "video", "audio", "pdf", "unsplash"]);
const databaseKinds = new Set<NotesPickerInsertKind>(["collection", "gallery", "kanban"]);
const sameScope = (a: NotesScope, b: NotesScope): boolean => a.actorId === b.actorId && a.workspaceId === b.workspaceId;
function fingerprint(controller: NotesWorkspaceController): string {
  const state = controller.getState(); if (!state.snapshot) return "empty";
  return JSON.stringify([serializeEditorDocument(state.draft ?? state.snapshot.document), state.draftTitle ?? state.snapshot.title, state.localDrafts ?? {}]);
}
export function notesSupportedPickerInsertKinds(props: Omit<NotesInsertDialogProps, "request" | "onClose">): readonly NotesPickerInsertKind[] {
  const snapshot = props.controller.getState().snapshot;
  if (!snapshot || !sameScope(snapshot.scope, props.host.scope) || !snapshot.capabilities.includes("document.save") || !snapshot.capabilitySemantics["document.save"]) return [];
  const types = new Set(props.editor.installedBlockTypes), insertion = props.insertion && sameScope(props.insertion.scope, snapshot.scope) ? props.insertion : undefined;
  const result: NotesPickerInsertKind[] = [];
  if (types.has("childPage") && props.host.readWorkspace && snapshot.target.kind === "page" && snapshot.capabilities.includes("page.create") && snapshot.capabilitySemantics["page.create"]) result.push("page");
  if (types.has("paragraph") && (!props.insertion?.isValidLink && props.insertion?.linkBlockTypes === undefined && props.insertion?.allowLinkHardBreaks !== false || !!insertion) && notesLinkSelectionAllowed(props.insertion, props.editor.getSelectedBlockTypes?.(), props.editor.getSelectedBlocksHaveHardBreaks?.())) result.push("link");
  if (types.has("pageCard") && props.host.readWorkspace) result.push("card");
  const mediaBound = !!props.media?.upload || !!props.media?.listCloud;
  if (mediaBound && types.has("file")) result.push("attachment", "pdf");
  if (mediaBound && types.has("image")) result.push("image");
  if (mediaBound && types.has("video")) result.push("video");
  if (mediaBound && types.has("audio")) result.push("audio");
  if (types.has("image") && props.media?.searchImages && props.media.acceptImage) result.push("unsplash");
  if (types.has("oeNotesSyncedBlock") && insertion?.sharedBlocksBound && insertion.listShared && insertion.getShared) result.push("syncedBlock");
  if (types.has("databaseView") && insertion?.databaseViewsBound && insertion.listDatabases && insertion.getDatabase) result.push("collection", "gallery", "kanban");
  const restriction = props.insertion?.pickerInsertKinds;
  return restriction === undefined ? result : insertion ? result.filter(kind => restriction.includes(kind)) : [];
}
export function NotesInsertDialog(props: NotesInsertDialogProps) {
  return props.request ? <InsertionDialog key={props.request.id} {...props} request={props.request} /> : null;
}
function InsertionDialog(props: Omit<NotesInsertDialogProps, "request"> & { request: NotesInsertRequest }) {
  const { request, controller, editor } = props, state = useNotesController(controller), uid = useId();
  const liveProps = useRef(props); liveProps.current = props;
  const [base] = useState(() => {
    const snapshot = controller.getState().snapshot;
    return { anchorValid: !request.anchor || request.anchor.blockId === editor.getSelectedBlockId() && ["before", "after"].includes(request.anchor.placement), identity: notesPanelIdentity(controller, snapshot), session: controller.getDraftSessionId?.(), fingerprint: fingerprint(controller), blockId: editor.getSelectedBlockId(), selection: editor.getSelectionFingerprint(), revision: snapshot?.revision, contentRevision: snapshot?.contentRevision, scope: snapshot ? { ...snapshot.scope } : undefined, target: snapshot ? { ...snapshot.target } : undefined, initiallyComposing: controller.getState().composing };
  });
  const [title, setTitle] = useState(""), [url, setUrl] = useState(""), [label, setLabel] = useState(() => editor.getSelectedText?.() ?? ""), [linkSource, setLinkSource] = useState<"url" | "page">("url");
  const [query, setQuery] = useState(""), [workspace, setWorkspace] = useState<NotesWorkspaceSnapshot>(), [pages, setPages] = useState<readonly NotesPageSummary[]>([]), [selectedId, setSelectedId] = useState("");
  const [databases, setDatabases] = useState<readonly EditorDatabase[]>([]), [shared, setShared] = useState<readonly NotesSharedInsertRecord[]>([]), [cursor, setCursor] = useState<string | null>(null), [hasMore, setHasMore] = useState(false);
  const [mediaSource, setMediaSource] = useState<"local" | "cloud" | "images">(request.kind === "unsplash" ? "images" : props.media?.upload ? "local" : "cloud"), [assets, setAssets] = useState<readonly EditorAsset[]>([]), [images, setImages] = useState<readonly ImageSearchResult[]>([]), [pickedAsset, setPickedAsset] = useState<EditorAsset>(), [imagePage, setImagePage] = useState(1), [moreImages, setMoreImages] = useState(false), [presentation, setPresentation] = useState<"compact" | "card">("card");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [createdPage, setCreatedPage] = useState<NotesPageSummary>(), [unknownCreate, setUnknownCreate] = useState(false);
  const dialog = useRef<HTMLDivElement>(null), mounted = useRef(true), closed = useRef(false), pending = useRef<AbortController | null>(null), commandPending = useRef(false), editEpoch = useRef(0), lastFingerprint = useRef(base.fingerprint), createdPageRef = useRef<NotesPageSummary | undefined>(undefined);
  const lifecycleGeneration = useRef(0);
  const initialEpoch = useRef(0), requestedSignal = useRef(request.signal), ownRevision = useRef(base.revision), ownContentRevision = useRef(base.contentRevision);
  const composition = useNotesComposition(controller, request.id);
  useDialogFocusTrap(true, dialog);
  const close = (status: NotesInsertDialogResult["status"]): void => {
    if (closed.current) return;
    closed.current = true; pending.current?.abort(); pending.current = null;
    if (commandPending.current) controller.cancel();
    props.onClose({ status, ...(createdPageRef.current ? { createdPageId: createdPageRef.current.id } : {}) });
  };
  useEffect(() => {
    const generation = ++lifecycleGeneration.current; mounted.current = true;
    return () => {
      if (lifecycleGeneration.current !== generation) return;
      lifecycleGeneration.current++; mounted.current = false;
      const abort = pending.current; abort?.abort(); if (pending.current === abort) pending.current = null;
      if (commandPending.current) controller.cancel();
    };
  }, [controller]);
  useEffect(() => controller.subscribe(() => { const next = fingerprint(controller); if (next !== lastFingerprint.current) { lastFingerprint.current = next; editEpoch.current++; } }), [controller]);
  useEffect(() => {
    const signal = requestedSignal.current, abort = () => close("cancelled");
    if (signal?.aborted) abort(); else signal?.addEventListener("abort", abort, { once: true });
    return () => signal?.removeEventListener("abort", abort);
  }, []);
  const sameContext = (allowOwnRevision = false): boolean => {
    const current = controller.getState(), snapshot = current.snapshot;
    const insertionScopeRequired = databaseKinds.has(request.kind) || request.kind === "syncedBlock";
    return base.anchorValid && !!snapshot && controller.getDraftSessionId?.() === base.session && !closed.current && !requestedSignal.current?.aborted && !base.initiallyComposing && !current.composing && notesPanelIdentity(controller, snapshot) === base.identity && !!base.scope && sameScope(base.scope, props.host.scope) && (!insertionScopeRequired || !!props.insertion && sameScope(props.insertion.scope, base.scope)) && fingerprint(controller) === base.fingerprint && editEpoch.current === initialEpoch.current && editor.getSelectedBlockId() === base.blockId && editor.getSelectionFingerprint() === base.selection && !!notesBlockById((current.draft ?? snapshot.document).blocks, base.blockId) && (allowOwnRevision || snapshot.revision === ownRevision.current && snapshot.contentRevision === ownContentRevision.current);
  };
  const canEdit = (): boolean => {
    const current = controller.getState(); return notesSupportedPickerInsertKinds(liveProps.current).includes(request.kind) && current.status === "ready" && !current.composing && !current.pendingEditors && !current.recovery && !current.manualSaveRequired && !!current.snapshot?.capabilities.includes("document.save") && !!current.snapshot.capabilitySemantics["document.save"];
  };
  const linkAllowed = (href: string): boolean => notesInsertionLinkAllowed({ scope: controller.getState().snapshot?.scope, insertion: liveProps.current.insertion }, href);
  const pageLinksAllowed = !props.insertion?.isValidLink;
  const linkLabelAllowed = (text = label): boolean => liveProps.current.insertion?.allowLinkHardBreaks !== false || !/[\r\n]/.test(text);
  const linkUrl = (): string => liveProps.current.insertion?.isValidLink ? url : url.trim();
  const stale = !sameContext(), available = notesSupportedPickerInsertKinds(props).includes(request.kind);
  const work = (callback: (signal: AbortSignal) => Promise<void>): void => {
    if (pending.current || closed.current || !sameContext() || !canEdit()) return;
    const abort = new AbortController(), generation = lifecycleGeneration.current; pending.current = abort; setBusy(true); setMessage("");
    void Promise.resolve().then(() => { if (!abort.signal.aborted && generation === lifecycleGeneration.current && mounted.current && !closed.current && sameContext() && canEdit()) return callback(abort.signal); return undefined; }).catch(() => { if (mounted.current && generation === lifecycleGeneration.current && !abort.signal.aborted && !closed.current) setMessage("操作を完了できませんでした。元の本文と入力を保持しています"); }).finally(() => { if (pending.current === abort) { pending.current = null; if (mounted.current && generation === lifecycleGeneration.current && !closed.current) setBusy(false); } });
  };
  const readCatalog = (append = false): void => work(async signal => {
    if (databaseKinds.has(request.kind)) {
      const result = await props.insertion!.listDatabases!(signal, { query, ...(append && cursor ? { cursor } : {}) });
      if (!signal.aborted && sameContext() && canEdit() && mounted.current) { const valid = result.databases.filter(item => item.id && typeof item.title === "string"); setDatabases(previous => append ? [...new Map([...previous, ...valid].map(item => [item.id, item])).values()] : valid); setCursor(result.nextCursor); setHasMore(result.hasMore && !!result.nextCursor); }
    } else if (request.kind === "syncedBlock") {
      const result = await props.insertion!.listShared!(signal, { query, ...(append && cursor ? { cursor } : {}) });
      if (!signal.aborted && sameContext() && canEdit() && mounted.current) { const valid = result.records.filter(item => item.id && typeof item.title === "string"); setShared(previous => append ? [...new Map([...previous, ...valid].map(item => [item.id, item])).values()] : valid); setCursor(result.nextCursor); setHasMore(result.hasMore && !!result.nextCursor); }
    } else if (props.host.readWorkspace) {
      const result = await props.host.readWorkspace(signal, { ...(append && cursor ? { cursor } : {}) });
      if (!base.scope || !sameScope(result.scope, base.scope)) throw new Error("Wrong catalog scope");
      if (!signal.aborted && sameContext() && canEdit() && mounted.current) { setWorkspace(result); const valid = result.pages.filter(page => !page.deletedAt && (!query.trim() || page.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))); setPages(previous => append ? [...new Map([...previous, ...valid].map(item => [item.id, item])).values()] : valid); setCursor(result.nextCursor); setHasMore(result.hasMore && !!result.nextCursor); }
    }
  });
  useEffect(() => { if (available && (request.kind === "page" || request.kind === "card" || databaseKinds.has(request.kind) || request.kind === "syncedBlock")) readCatalog(); }, []);
  const localInsert = (blocks: readonly EditorBlock[], signal: AbortSignal): void => {
    if (signal.aborted || !sameContext() || !canEdit()) throw new Error("Insertion context changed");
    editor.insertBlocks(blocks, base.blockId, signal, request.anchor?.placement);
    const current = controller.getState();
    if (signal.aborted || !blocks.every(block => notesBlockById((current.draft ?? current.snapshot!.document).blocks, block.id))) throw new Error("Insertion was not confirmed");
    close("inserted");
  };
  const insertLink = (href: string, label: string, signal: AbortSignal): void => {
    if (signal.aborted || !sameContext() || !canEdit() || !linkAllowed(href) || !linkLabelAllowed(label)) throw new Error("Link context changed");
    editor.insertLink(href, label, signal);
    if (fingerprint(controller) === base.fingerprint) throw new Error("Link insertion was not confirmed");
    close("inserted");
  };
  const block = (type: string, propsFor: EditorBlock["props"]): EditorBlock => ({ id: crypto.randomUUID(), type, props: propsFor });
  const mediaScope = (): NotesMediaScope | undefined => {
    if (!base.scope || !base.target || !sameContext()) return undefined;
    return { scope: { ...base.scope }, target: { ...base.target }, blockId: base.blockId, ...(request.anchor?.placement === "before" ? { placement: "before" as const } : {}) };
  };
  const validAsset = (asset: EditorAsset): boolean => {
    if (!asset.attachmentId || !notesSafeAssetUrl(asset.url)) return false;
    if (request.kind === "attachment") return true;
    if (request.kind === "pdf") return asset.kind === "pdf" || asset.mimeType === "application/pdf";
    const kind = request.kind === "unsplash" ? "image" : request.kind;
    return (!asset.kind || asset.kind === kind) && asset.mimeType.startsWith(kind + "/");
  };
  const pickAsset = (asset: EditorAsset, signal: AbortSignal): void => {
    if (signal.aborted || !mounted.current || !sameContext() || !canEdit()) return;
    if (!validAsset(asset)) { setMessage("この種類の素材と安全な保存先を確認できませんでした"); return; }
    const kind = request.kind === "attachment" ? "file" : request.kind === "unsplash" ? "image" : request.kind;
    setPickedAsset({ ...asset, kind: kind as NonNullable<EditorAsset["kind"]> });
  };
  const searchMedia = (page = 1): void => {
    if (!query.trim()) return;
    const scope = mediaScope(), text = query.trim(), source = mediaSource;
    if (!scope) return;
    work(async signal => {
      if (source === "cloud" && props.media?.listCloud) { const result = await props.media.listCloud(scope, text, signal); if (!signal.aborted && sameContext() && canEdit() && mounted.current) setAssets(result.filter(validAsset)); }
      if (source === "images" && props.media?.searchImages) { const result = await props.media.searchImages(scope, text, page, signal); if (!signal.aborted && sameContext() && canEdit() && mounted.current) { setImages(result.results.filter(image => notesSafeAssetUrl(image.url))); setImagePage(page); setMoreImages(result.hasMore); } }
    });
  };
  const insertSelected = (): void => work(async signal => {
    if (!available || !sameContext()) return;
    if (request.kind === "card" || request.kind === "link" && linkSource === "page") {
      if (request.kind === "link" && !pageLinksAllowed) return;
      const selected = pages.find(page => page.id === selectedId); if (!selected) return;
      const result = await props.host.readDocument({ kind: "page", pageId: selected.id }, signal);
      if (!base.scope || !sameScope(result.scope, base.scope) || result.target.kind !== "page" || result.target.pageId !== selected.id || signal.aborted || !sameContext() || !canEdit()) return;
      if (request.kind === "card") localInsert([block("pageCard", { pageId: selected.id, titleHint: result.title })], signal);
      else { const href = props.insertion && sameScope(props.insertion.scope, base.scope) ? props.insertion.resolvePageLink?.({ ...selected, title: result.title }) ?? "openeditor://page/" + encodeURIComponent(selected.id) : "openeditor://page/" + encodeURIComponent(selected.id); if (!linkAllowed(href)) { setMessage("安全なリンク先を確認してください"); return; } insertLink(href, label.trim() || result.title, signal); }
    } else if (request.kind === "link") {
      if (!linkAllowed(linkUrl()) || !sameContext() || !canEdit()) return;
      insertLink(linkUrl(), liveProps.current.insertion?.isValidLink ? label || linkUrl() : label.trim() || linkUrl(), signal);
    } else if (databaseKinds.has(request.kind)) {
      if (!props.insertion?.databaseViewsBound || !databases.some(item => item.id === selectedId)) return;
      const result = await props.insertion.getDatabase!(selectedId, signal);
      if (!result || result.id !== selectedId || !sameContext() || signal.aborted) { setMessage("このデータベースを確認できませんでした"); return; }
      const viewType = request.kind === "gallery" ? "gallery" : request.kind === "kanban" ? "board" : "table";
      const existing = result.views?.find(view => view.viewType === viewType && view.id);
      localInsert([block("databaseView", { databaseId: result.id, viewId: existing?.id ?? "notes-" + viewType + "-" + crypto.randomUUID(), viewType, titleHint: result.title })], signal);
    } else if (request.kind === "syncedBlock") {
      if (!props.insertion?.sharedBlocksBound || !shared.some(item => item.id === selectedId)) return;
      const result = await props.insertion.getShared!(selectedId, signal);
      if (!result || result.id !== selectedId || !result.revision || !sameContext() || signal.aborted) { setMessage("同期ブロックの保存先を確認できませんでした"); return; }
      localInsert([block("oeNotesSyncedBlock", { sharedId: result.id, body: "" })], signal);
    } else if (mediaKinds.has(request.kind) && pickedAsset) {
      if (!validAsset(pickedAsset)) return;
      if (props.onAssetAccepted) {
        const scope = mediaScope(); if (!scope || signal.aborted || !sameContext() || !canEdit()) return;
        await props.onAssetAccepted(pickedAsset, scope, signal, presentation);
        if (!signal.aborted && mounted.current && !closed.current) {
          if (fingerprint(controller) === base.fingerprint) throw new Error("Asset insertion was not confirmed");
          close("inserted");
        }
        return;
      }
      const type = request.kind === "attachment" || request.kind === "pdf" ? "file" : request.kind === "unsplash" ? "image" : request.kind;
      localInsert([block(type, { url: pickedAsset.url, name: pickedAsset.name, showPreview: presentation === "card", caption: "" })], signal);
    }
  });
  const createPage = (): void => work(async signal => {
    if (!title.trim() || !workspace || !base.target || base.target.kind !== "page" || !sameContext() || controller.getState().manualSaveRequired || controller.getState().pendingEditors) return;
    if (controller.getState().dirty) {
      commandPending.current = true;
      let saved: NotesCommandOutcome | undefined;
      try { saved = await controller.save({ explicit: true }); } finally { commandPending.current = false; }
      if (signal.aborted || !saved || saved.status !== "committed" || controller.getState().dirty || !sameContext(true)) { if (mounted.current && !signal.aborted) { setMessage(saved ? notesOutcomeMessage(saved) : "本文の保存を確認してください"); if (saved?.status === "unknown" || saved?.status === "pending") setUnknownCreate(true); } return; }
      ownRevision.current = controller.getState().snapshot?.revision; ownContentRevision.current = controller.getState().snapshot?.contentRevision;
    }
    const latestWorkspace = await props.host.readWorkspace!(signal);
    if (!base.scope || !sameScope(latestWorkspace.scope, base.scope) || signal.aborted || !sameContext() || !canEdit()) return;
    commandPending.current = true;
    let result: NotesCommandOutcome;
    try { result = await controller.execute({ kind: "page.create", expectedWorkspaceRevision: latestWorkspace.revision, parentId: base.target.pageId, title: title.trim() }); } finally { commandPending.current = false; }
    if (!mounted.current || signal.aborted || closed.current) return;
    setMessage(notesOutcomeMessage(result));
    if (result.status === "unknown" || result.status === "pending") { setUnknownCreate(true); return; }
    if (result.status !== "committed" || result.evidence?.kind !== "page.create" || !result.evidence.page || !base.scope || !sameScope(result.snapshot.scope, base.scope) || result.snapshot.target.kind !== "page" || result.snapshot.target.pageId !== base.target.pageId) return;
    const created = result.evidence.page;
    if (!created.id || created.id === base.target.pageId || created.parentId !== base.target.pageId || created.title !== title.trim() || created.deletedAt) return;
    createdPageRef.current = created; setCreatedPage(created);
    if (!sameContext(true) || !canEdit()) { setMessage("子ページの作成は確認済みです。本文が変更されたため参照は挿入していません。作成済みページは一覧から開けます"); return; }
    ownRevision.current = controller.getState().snapshot?.revision; ownContentRevision.current = controller.getState().snapshot?.contentRevision;
    const child = block("childPage", { pageId: created.id, titleHint: created.title });
    const navigate = props.insertion && sameScope(props.insertion.scope, base.scope) ? props.insertion.onCreatedPageReady : undefined;
    if (!navigate) { localInsert([child], signal); return; }
    editor.insertBlocks([child], base.blockId, signal, request.anchor?.placement);
    const inserted = controller.getState();
    if (!notesBlockById((inserted.draft ?? inserted.snapshot!.document).blocks, child.id)) throw new Error("Child reference was not inserted");
    const expectedBody = serializeEditorDocument(inserted.draft ?? inserted.snapshot!.document);
    commandPending.current = true;
    let saved: NotesCommandOutcome | undefined;
    try { saved = await controller.save({ explicit: true }); } finally { commandPending.current = false; }
    const latest = controller.getState(), parent = latest.snapshot;
    if (signal.aborted || !mounted.current || closed.current) return;
    if (!saved || saved.status !== "committed" || latest.dirty || !canEdit() || controller.getDraftSessionId?.() !== base.session || !parent || !sameScope(parent.scope, base.scope) || parent.target.kind !== "page" || parent.target.pageId !== base.target.pageId || serializeEditorDocument(parent.document) !== expectedBody || !notesBlockById(parent.document.blocks, child.id)) {
      setMessage("子ページは作成済みです。親ページの保存と新しい入力の状態を確認するまで移動していません。本文と入力を保持しています"); return;
    }
    try { await navigate({ page: created, scope: { ...base.scope }, parentTarget: { ...base.target }, parentRevision: parent.revision, parentContentRevision: parent.contentRevision, signal }); }
    catch { if (mounted.current && !signal.aborted) setMessage("子ページと親の参照は保存済みです。ページを開けませんでした。作成済みページを一覧から開いてください"); return; }
    if (mounted.current && !signal.aborted && !closed.current) close("inserted");
  });
  const selected = !!selectedId && (request.kind === "syncedBlock" ? shared.some(item => item.id === selectedId) : databaseKinds.has(request.kind) ? databases.some(item => item.id === selectedId) : pages.some(item => item.id === selectedId));
  return <div className="oe-notes-dialog-backdrop"><div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={uid} tabIndex={-1} className="oe-notes-dialog oe-notes-insert-dialog" onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event)) { event.preventDefault(); event.stopPropagation(); close("cancelled"); } }}>
    <header><h2 id={uid}>{labels[request.kind]}</h2><button type="button" onClick={() => close("cancelled")}>閉じる</button></header>
    {!available ? <p role="alert">この挿入はホストに接続されていないか、許可されていません</p> : null}
    {stale ? <p role="status">本文、選択範囲、または作業先が変更されました。入力を保持しています。閉じてもう一度選択してください</p> : null}
    {request.kind === "page" ? <><label>ページ名<input aria-label="子ページの名前" value={title} disabled={busy || !!createdPage || unknownCreate} onChange={event => setTitle(event.target.value)} {...composition} /></label>{state.dirty ? <p>本文を保存してから子ページを作成します</p> : null}{state.manualSaveRequired ? <p>統合案を明示的に保存してから子ページを作成してください</p> : null}{state.pendingEditors ? <p>ほかの入力を確定または取り消してから子ページを作成してください</p> : null}<button type="button" disabled={busy || stale || !available || !canEdit() || !workspace || !title.trim() || !!createdPage || unknownCreate || state.composing || state.manualSaveRequired || state.pendingEditors} onClick={createPage}>{state.dirty ? "本文を保存して子ページを作成" : "確認して子ページを作成"}</button>{createdPage ? <p>作成済み: {createdPage.title}</p> : null}</> : null}
    {request.kind === "link" ? <><label>リンク先の種類<select aria-label="リンク先の種類" value={linkSource} disabled={busy} onChange={event => { const next = event.target.value as typeof linkSource; setLinkSource(next); setSelectedId(""); if (next === "page") readCatalog(); }}><option value="url">URL</option>{props.host.readWorkspace && pageLinksAllowed ? <option value="page">ページ</option> : null}</select></label>{linkSource === "url" ? <label>URL<input aria-label="リンク先URL" value={url} disabled={busy} onChange={event => setUrl(event.target.value)} {...composition} /></label> : null}<label>表示する文字<input aria-label="リンクの表示文字" value={label} disabled={busy} onChange={event => setLabel(event.target.value)} {...composition} /></label>{url && linkSource === "url" && !linkAllowed(linkUrl()) ? <p role="alert">安全なリンク先URLを入力してください</p> : null}</> : null}
    {request.kind === "card" || request.kind === "link" && linkSource === "page" || databaseKinds.has(request.kind) || request.kind === "syncedBlock" ? <><label>検索<input aria-label="挿入する項目を検索" value={query} disabled={busy} onChange={event => { setQuery(event.target.value); setSelectedId(""); }} {...composition} /></label><button type="button" disabled={busy || stale || !available || !canEdit() || state.composing} onClick={() => { setSelectedId(""); readCatalog(); }}>一覧を読み込む</button><label>挿入する項目<select aria-label="挿入する項目" value={selectedId} disabled={busy || stale} onChange={event => setSelectedId(event.target.value)}><option value="">選択してください</option>{(request.kind === "syncedBlock" ? shared : databaseKinds.has(request.kind) ? databases : pages).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{hasMore ? <button type="button" disabled={busy || stale} onClick={() => readCatalog(true)}>さらに読み込む</button> : null}</> : null}
    {mediaKinds.has(request.kind) ? <><label>素材の場所<select aria-label="挿入素材の場所" value={mediaSource} disabled={busy} onChange={event => { setMediaSource(event.target.value as typeof mediaSource); setAssets([]); setImages([]); setPickedAsset(undefined); setMoreImages(false); }}>{request.kind !== "unsplash" && props.media?.upload ? <option value="local">この端末</option> : null}{request.kind !== "unsplash" && props.media?.listCloud ? <option value="cloud">クラウド</option> : null}{(request.kind === "image" || request.kind === "unsplash") && props.media?.searchImages && props.media.acceptImage ? <option value="images">画像検索</option> : null}</select></label>{mediaSource === "local" ? <input type="file" aria-label="挿入する素材ファイル" disabled={busy || stale || !available || !canEdit() || state.composing} accept={request.kind === "attachment" ? undefined : request.kind === "pdf" ? "application/pdf" : request.kind + "/*"} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (!file || !props.media?.upload || !sameContext()) return; const scope = mediaScope(); if (!scope) return; work(async signal => { const asset = await props.media!.upload!(file, scope, signal); pickAsset(asset, signal); }); }} /> : <><label>素材を検索<input aria-label="挿入素材の検索語" value={query} disabled={busy} onChange={event => { setQuery(event.target.value); setPickedAsset(undefined); setAssets([]); setImages([]); setMoreImages(false); }} {...composition} /></label><button type="button" disabled={busy || stale || !available || !canEdit() || !query.trim() || state.composing} onClick={() => searchMedia()}>素材を検索</button></>}
      <ul>{assets.map(asset => <li key={asset.attachmentId}><button type="button" disabled={busy || stale} onClick={() => pickAsset(asset, new AbortController().signal)}>{asset.name}</button></li>)}{images.map(image => <li key={image.id}><button type="button" disabled={busy || stale} onClick={() => { const scope = mediaScope(); if (!scope) return; work(async signal => { const asset = await props.media!.acceptImage!(image, scope, signal); pickAsset(asset, signal); }); }}>{image.title}</button></li>)}</ul>{moreImages ? <button type="button" disabled={busy || stale} onClick={() => searchMedia(imagePage + 1)}>次の画像</button> : null}
      {pickedAsset ? <div className="oe-notes-insert-review"><strong>{pickedAsset.name}</strong><p>{pickedAsset.mimeType} · {pickedAsset.size ?? ""}</p><label>表示形式<select aria-label="挿入素材の表示形式" value={presentation} disabled={busy} onChange={event => setPresentation(event.target.value as typeof presentation)}><option value="compact">コンパクト</option><option value="card">カード</option></select></label><p>確認すると本文に追加します。本文の保存は別に確認してください</p></div> : null}
    </> : null}
    {request.kind !== "page" ? <button type="button" disabled={busy || stale || !available || state.composing || !canEdit() || (mediaKinds.has(request.kind) ? !pickedAsset : request.kind === "link" && linkSource === "url" ? !linkAllowed(linkUrl()) || !linkLabelAllowed() : !selected)} onClick={insertSelected}>確認して本文に挿入</button> : null}
    <button type="button" onClick={() => close("cancelled")}>キャンセル</button>
    <NotesPanelStatus controller={controller} message={message} />
  </div></div>;
}
