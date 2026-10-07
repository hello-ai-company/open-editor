import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { NotesCommand, NotesCommandKind, NotesCommandOutcome, NotesPageSummary, NotesPersistenceMode, NotesTarget, NotesWorkspaceSnapshot, NotesWorkspaceState } from "../notes/contracts.js";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";

export type NotesNavigationMode = "pages" | "library" | "document";
/** Authorized presentation data only. Permissions remain exact host capabilities. */
export type NotesPagePresentation = {
  summary?: string; workspace?: string; privacy?: string;
  kind?: "page" | "database"; database?: { title: string; rowCount: number; viewType: string };
  /** Host-resolved authorized URL; the navigation never resolves storage or credentials. */
  cover?: { url: string; alt?: string };
};
export type NotesPageOperations = {
  workspace: NotesWorkspaceSnapshot;
  activePageId?: string;
  status?: NotesWorkspaceState["status"];
  message?: string;
  getCapabilities(pageId: string): readonly NotesCommandKind[];
  getPersistence?(pageId: string, kind: NotesCommandKind): NotesPersistenceMode | undefined;
  onOpen(target: NotesTarget): Promise<boolean>;
  /** Route through the guarded controller for this target; never execute on a different active page. */
  onCommand(target: NotesTarget, command: NotesCommand): Promise<NotesCommandOutcome>;
  onCancel?(): void;
  onReconcile?(): Promise<unknown>;
  onWorkspaceChanged?(): void | Promise<void>;
  getPresentation?(page: NotesPageSummary): NotesPagePresentation;
};
export type NotesNavigationProps = NotesPageOperations & {
  mode?: NotesNavigationMode; onModeChange?(mode: NotesNavigationMode): void;
  recentPageIds?: readonly string[];
  sections?: readonly ("tree" | "library" | "favorites" | "recent" | "trash")[];
  documentContent?: ReactNode;
  onSearch?(query: string): Promise<void>;
  onLoadMore?(): Promise<void>; loadingMore?: boolean;
  /** Authorized read-only content; this read must never switch or save the active editor. */
  onPreview?(target: NotesTarget, signal: AbortSignal): Promise<NotesPagePreviewData>;
};
export type NotesPagePreviewData = { page: NotesPageSummary; content?: ReactNode; related?: readonly NotesPageSummary[] };

const blockedStatuses = new Set<NotesWorkspaceState["status"]>(["loading", "saving", "unknown"]);
function busy(props: NotesPageOperations): boolean { return blockedStatuses.has(props.status ?? "ready"); }
function alive(page: NotesPageSummary): boolean { return !page.deletedAt; }
function byPosition(a: NotesPageSummary, b: NotesPageSummary): number { return a.position - b.position || a.id.localeCompare(b.id); }
function matches(page: NotesPageSummary, query: string, presentation?: NotesPagePresentation): boolean {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const text = [page.title, page.category, ...(page.tags ?? []), presentation?.summary, presentation?.workspace].join(" ").toLocaleLowerCase();
  return words.every(word => text.includes(word));
}
function PageMedia({ page, presentation }: { page: NotesPageSummary; presentation?: NotesPagePresentation }) {
  const url = presentation?.cover?.url ?? page.cover;
  const safe = url && (/^https?:\/\//i.test(url) || /^blob:/i.test(url) || /^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(url));
  return <span className="oe-notes-page-media">{safe ? <img src={url} alt={presentation?.cover?.alt ?? ""} loading="lazy" /> : <span aria-hidden="true">{page.icon || (presentation?.kind === "database" ? "▦" : "▤")}</span>}</span>;
}
/** Fails closed for cycles, missing or deleted destinations, and malformed source ancestry. */
export function canMoveNotesPage(pages: readonly NotesPageSummary[], pageId: string, parentId: string | null): boolean {
  const indexed = new Map(pages.map(page => [page.id, page]));
  const source = indexed.get(pageId);
  if (!source || !alive(source) || parentId === pageId) return false;
  const sourceSeen = new Set<string>([pageId]);
  let sourceParent = source.parentId;
  while (sourceParent !== null) {
    if (sourceSeen.has(sourceParent)) return false;
    sourceSeen.add(sourceParent);
    const ancestor = indexed.get(sourceParent);
    if (!ancestor || !alive(ancestor)) return false;
    sourceParent = ancestor.parentId;
  }
  const seen = new Set<string>([pageId]);
  let cursor = parentId;
  while (cursor !== null) {
    if (seen.has(cursor)) return false;
    seen.add(cursor);
    const parent = indexed.get(cursor);
    if (!parent || !alive(parent)) return false;
    cursor = parent.parentId;
  }
  return true;
}
function nextPosition(pages: readonly NotesPageSummary[], parentId: string | null, exclude?: string): number {
  return Math.max(-1, ...pages.filter(page => alive(page) && page.parentId === parentId && page.id !== exclude).map(page => page.position)) + 1;
}
function outcomeMessage(status: NotesCommandOutcome["status"], persistence?: NotesPersistenceMode): string {
  switch (status) {
    case "committed": return persistence === "local-only" ? "この端末への保存を確認しました" : persistence === "offline-queued" ? "オフラインの保存キューに追加しました" : persistence === "test-only" ? "合成データへの保存を確認しました" : persistence === "remote-committed" ? "サーバーへの保存を確認しました" : "保存を確認しました";
    case "unknown": case "pending": return "保存結果が不明です。再送せず結果を照会してください";
    case "cancelled": return "送信前にキャンセルしました";
    case "denied": return "この操作は許可されていません";
    case "conflict": return "別の変更があります。最新の一覧を確認してください";
    default: return "保存できませんでした。入力は保持しています";
  }
}
function OperationStatus(props: NotesPageOperations) {
  const [checking, setChecking] = useState(false), [lookupMessage, setLookupMessage] = useState("");
  const lock = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const reconcile = async (): Promise<void> => {
    if (lock.current || !props.onReconcile) return;
    lock.current = true; setChecking(true); setLookupMessage("");
    try { await props.onReconcile(); }
    catch { if (mounted.current) setLookupMessage("保存結果を照会できませんでした。再送せず、もう一度照会してください"); }
    finally { lock.current = false; if (mounted.current) setChecking(false); }
  };
  return <div className="oe-notes-operation-status" aria-live="polite">
    <p>{props.status === "unknown" ? "保存結果が不明です。再送せず確認してください" : props.status === "saving" ? "保存を確認しています" : props.message}</p>
    {props.status === "unknown" && props.onReconcile ? <button type="button" disabled={checking} onClick={() => void reconcile()}>{checking ? "保存結果を照会中" : "保存結果を照会"}</button> : null}
    {props.status === "saving" && props.onCancel ? <button type="button" onClick={props.onCancel}>保存の待機を中止</button> : null}
    {lookupMessage ? <p>{lookupMessage}</p> : null}
  </div>;
}

type PageAction = "rename" | "move" | "create" | "duplicate" | "trash" | "restore" | "delete" | "classify";
const actionKind: Record<PageAction, NotesCommandKind> = {
  rename: "page.rename", move: "page.move", create: "page.create", duplicate: "page.duplicate",
  trash: "page.trash", restore: "page.restore", delete: "page.delete-permanently", classify: "metadata.patch"
};
const actionLabel: Record<PageAction, string> = {
  rename: "名前を変更", move: "移動", create: "子ページを追加", duplicate: "複製", trash: "ゴミ箱へ移動", restore: "復元", delete: "完全に削除", classify: "分類を編集"
};
type ActionDraft = { page: NotesPageSummary; action: PageAction; workspaceRevision: string; scopeKey: string };
function scopeKey(workspace: NotesWorkspaceSnapshot): string { return JSON.stringify([workspace.scope.actorId, workspace.scope.workspaceId]); }
async function refreshWorkspace(props: NotesPageOperations): Promise<boolean> {
  try { await props.onWorkspaceChanged?.(); return true; } catch { return false; }
}
function PageActionDialog(props: NotesPageOperations & { draft: ActionDraft; onClose(): void }) {
  const { draft } = props;
  const [title, setTitle] = useState(draft.action === "create" ? "" : draft.action === "duplicate" ? draft.page.title + "のコピー" : draft.page.title);
  const [parent, setParent] = useState(draft.page.parentId ?? "");
  const [beforeId, setBeforeId] = useState("");
  const [category, setCategory] = useState(draft.page.category ?? "");
  const [privacy, setPrivacy] = useState(props.getPresentation?.(draft.page).privacy ?? "");
  const [tags, setTags] = useState((draft.page.tags ?? []).join(", "));
  const [confirmation, setConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false), mounted = useRef(true), dialog = useRef<HTMLDivElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useDialogFocusTrap(true, dialog);
  const stale = draft.workspaceRevision !== props.workspace.revision || draft.scopeKey !== scopeKey(props.workspace);
  const allowed = props.getCapabilities(draft.page.id).includes(actionKind[draft.action]);
  const blocked = submitting || unconfirmed || busy(props);
  const needsTitle = ["rename", "create", "duplicate"].includes(draft.action);
  const close = (): void => { if (!blocked) { mounted.current = false; props.onClose(); } };
  const submit = async (): Promise<void> => {
    if (lock.current || confirmed || blocked || stale || !allowed || (needsTitle && !title.trim()) || (draft.action === "delete" && !confirmation)) return;
    const parentId = parent || null;
    if (draft.action === "move" && !canMoveNotesPage(props.workspace.pages, draft.page.id, parentId)) { setMessage("自分自身や子孫には移動できません"); return; }
    const siblings = props.workspace.pages.filter(page => alive(page) && page.parentId === parentId && page.id !== draft.page.id).sort(byPosition);
    const beforeIndex = siblings.findIndex(page => page.id === beforeId), before = siblings[beforeIndex], prior = siblings[beforeIndex - 1];
    const position = before ? prior ? prior.position + (before.position - prior.position) / 2 : before.position - 1 : nextPosition(props.workspace.pages, parentId, draft.page.id);
    if (draft.action === "move" && (!Number.isFinite(position) || (before && (position === before.position || position === prior?.position)))) { setMessage("この並び順は更新できません。挿入位置を選び直してください"); return; }
    const command: NotesCommand = draft.action === "rename" ? { kind: "page.rename", title: title.trim(), expectedWorkspaceRevision: draft.workspaceRevision }
      : draft.action === "create" ? { kind: "page.create", parentId: draft.page.id, title: title.trim(), expectedWorkspaceRevision: draft.workspaceRevision }
      : draft.action === "duplicate" ? { kind: "page.duplicate", parentId: draft.page.parentId, title: title.trim(), expectedWorkspaceRevision: draft.workspaceRevision }
      : draft.action === "move" ? { kind: "page.move", parentId, position, expectedWorkspaceRevision: draft.workspaceRevision }
      : draft.action === "trash" ? { kind: "page.trash", expectedWorkspaceRevision: draft.workspaceRevision }
      : draft.action === "restore" ? { kind: "page.restore", expectedWorkspaceRevision: draft.workspaceRevision }
      : draft.action === "delete" ? { kind: "page.delete-permanently", confirmation: "delete-permanently", expectedWorkspaceRevision: draft.workspaceRevision }
      : { kind: "metadata.patch", expectedWorkspaceRevision: draft.workspaceRevision, fields: { category, ...(privacy ? { privacy } : {}), tags: [...new Set(tags.split(",").map(tag => tag.trim()).filter(Boolean))] } };
    lock.current = true; setSubmitting(true); setMessage("");
    try {
      const result = await props.onCommand({ kind: "page", pageId: draft.page.id }, command);
      if (!mounted.current) return;
      setMessage(outcomeMessage(result.status, result.status === "committed" ? result.persistence : undefined));
      if (result.status === "unknown" || result.status === "pending") setUnconfirmed(true);
      if (result.status === "committed") {
        setConfirmed(true);
        const refreshed = await refreshWorkspace(props);
        if (!mounted.current) return;
        if (refreshed) props.onClose(); else setMessage(outcomeMessage(result.status, result.persistence) + "。最新の一覧を再読込できませんでした。再送せず閉じて確認してください");
      }
    } catch { if (mounted.current) { setUnconfirmed(true); setMessage("保存結果を確認できませんでした。入力を保持しています"); } }
    finally { lock.current = false; if (mounted.current) setSubmitting(false); }
  };
  const reconcile = async (): Promise<void> => {
    if (lock.current || !props.onReconcile) return;
    lock.current = true; setSubmitting(true);
    try {
      const result = await props.onReconcile();
      if (!mounted.current || typeof result !== "object" || result === null || !("status" in result)) return;
      const status = (result as { status: NotesCommandOutcome["status"] }).status;
      setMessage(outcomeMessage(status, "persistence" in result ? (result as { persistence: NotesPersistenceMode }).persistence : undefined));
      if (status === "committed") { setUnconfirmed(false); setConfirmed(true); const refreshed = await refreshWorkspace(props); if (mounted.current) { if (refreshed) props.onClose(); else setMessage("保存は確認済みです。最新の一覧を再読込できませんでした"); } }
      else if (["denied", "conflict", "rejected", "not-found", "cancelled"].includes(status)) setUnconfirmed(false);
    } catch { if (mounted.current) setMessage("保存結果を照会できませんでした。再送せず確認してください"); }
    finally { lock.current = false; if (mounted.current) setSubmitting(false); }
  };
  return <div className="oe-notes-dialog-backdrop"><div ref={dialog} role="dialog" aria-modal="true" aria-label={actionLabel[draft.action]} tabIndex={-1} className="oe-notes-dialog" onKeyDown={(event: KeyboardEvent) => {
    if (event.key === "Escape" && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229 && !blocked) { event.stopPropagation(); close(); }
  }}>
    <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <h2>{actionLabel[draft.action]}</h2><p>{draft.page.title}</p>
      {props.getPersistence?.(draft.page.id, actionKind[draft.action]) === "local-only" ? <p>この端末にのみ保存されます</p> : props.getPersistence?.(draft.page.id, actionKind[draft.action]) === "offline-queued" ? <p>同期を待つ保存キューへ追加します</p> : null}
      {needsTitle ? <label>ページ名<input aria-label="ページ名" value={title} disabled={blocked} onChange={event => setTitle(event.target.value)} /></label> : null}
      {draft.action === "move" ? <><label>移動先<select aria-label="移動先" value={parent} disabled={blocked} onChange={event => { setParent(event.target.value); setBeforeId(""); }}><option value="">最上位</option>{props.workspace.pages.filter(page => canMoveNotesPage(props.workspace.pages, draft.page.id, page.id)).sort(byPosition).map(page => <option key={page.id} value={page.id}>{page.title}</option>)}</select></label><label>挿入位置<select aria-label="挿入位置" value={beforeId} disabled={blocked} onChange={event => setBeforeId(event.target.value)}><option value="">最後</option>{props.workspace.pages.filter(page => alive(page) && page.parentId === (parent || null) && page.id !== draft.page.id).sort(byPosition).map(page => <option key={page.id} value={page.id}>{page.title}の前</option>)}</select></label></> : null}
      {draft.action === "classify" ? <><label>分類<input aria-label="分類" value={category} disabled={blocked} onChange={event => setCategory(event.target.value)} /></label><label>公開範囲<select aria-label="公開範囲" value={privacy} disabled={blocked} onChange={event => setPrivacy(event.target.value)}><option value="">変更なし</option><option value="private">非公開</option><option value="workspace">ワークスペース</option><option value="public">公開</option></select></label><label>タグ（カンマ区切り）<input aria-label="タグ" value={tags} disabled={blocked} onChange={event => setTags(event.target.value)} /></label></> : null}
      {draft.action === "delete" ? <label><input type="checkbox" checked={confirmation} disabled={blocked} onChange={event => setConfirmation(event.target.checked)} />このページを完全に削除することを確認しました</label> : null}
      {!allowed ? <p role="alert">この操作は許可されていません</p> : null}
      {stale ? <p role="alert">一覧が更新されました。入力を保持しています。閉じて最新のページを確認してください</p> : null}
      <p role="status">{message}</p><OperationStatus {...props} status={unconfirmed ? "unknown" : props.status} onReconcile={props.onReconcile ? reconcile : undefined} />
      <div className="oe-notes-dialog-actions"><button type="submit" disabled={confirmed || blocked || stale || !allowed || (needsTitle && !title.trim()) || (draft.action === "delete" && !confirmation)}>確認して保存</button><button type="button" disabled={blocked} onClick={close}>{confirmed ? "閉じる" : "キャンセル"}</button>{submitting && props.onCancel ? <button type="button" onClick={props.onCancel}>保存の待機を中止</button> : null}</div>
    </form>
  </div></div>;
}

/** Explicit per-page actions, with no permission implied by visible navigation items. */
export function NotesPageActions(props: NotesPageOperations & { page: NotesPageSummary }) {
  const [draft, setDraft] = useState<ActionDraft | null>(null);
  const capability = props.getCapabilities(props.page.id);
  const actions: PageAction[] = props.page.deletedAt ? ["restore", "delete"] : ["create", "rename", "move", "duplicate", "classify", "trash"];
  return <div className="oe-notes-page-actions" aria-label={props.page.title + "の操作"}>
    {actions.filter(action => capability.includes(actionKind[action])).map(action => <button key={action} type="button" disabled={busy(props)} onClick={() => setDraft({ page: props.page, action, workspaceRevision: props.workspace.revision, scopeKey: scopeKey(props.workspace) })}>{actionLabel[action]}</button>)}
    {capability.includes("metadata.patch") && !props.page.deletedAt ? <FavoriteButton {...props} /> : null}
    {draft ? <PageActionDialog {...props} draft={draft} onClose={() => setDraft(null)} /> : null}
  </div>;
}
function FavoriteButton(props: NotesPageOperations & { page: NotesPageSummary }) {
  const lock = useRef(false), [message, setMessage] = useState("");
  const toggle = async (): Promise<void> => {
    if (lock.current || busy(props) || !props.getCapabilities(props.page.id).includes("metadata.patch")) return;
    lock.current = true;
    try { const result = await props.onCommand({ kind: "page", pageId: props.page.id }, { kind: "metadata.patch", expectedWorkspaceRevision: props.workspace.revision, fields: { favorite: !props.page.favorite } }); setMessage(outcomeMessage(result.status, result.status === "committed" ? result.persistence : undefined)); if (result.status === "committed" && !await refreshWorkspace(props)) setMessage(outcomeMessage(result.status, result.persistence) + "。最新の一覧を再読込できませんでした"); }
    catch { setMessage("お気に入りの保存結果を確認できませんでした"); }
    finally { lock.current = false; }
  };
  return <><button type="button" disabled={busy(props)} aria-pressed={Boolean(props.page.favorite)} onClick={() => void toggle()}>{props.page.favorite ? "お気に入りを解除" : "お気に入りに追加"}</button><span role="status">{message}</span></>;
}

export function NotesNavigation(props: NotesNavigationProps) {
  const [localMode, setLocalMode] = useState<NotesNavigationMode>("pages"), [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set()), [focused, setFocused] = useState(props.activePageId ?? "");
  const [actionPageId, setActionPageId] = useState<string | null>(null), [message, setMessage] = useState("");
  const [preview, setPreview] = useState<NotesPagePreviewData | null>(null), [previewLoading, setPreviewLoading] = useState(false);
  const [section, setSection] = useState<"tree" | "favorites" | "recent" | "trash">("tree");
  const dragged = useRef<{ id: string; revision: string } | null>(null), tree = useRef<HTMLDivElement>(null);
  const previewRequest = useRef<{ controller: AbortController; generation: number; pageId: string } | null>(null), previewGeneration = useRef(0), previewOpener = useRef<HTMLElement | null>(null), suppressedPreview = useRef<string | null>(null);
  const currentPreviewScope = useRef(""); currentPreviewScope.current = scopeKey(props.workspace) + props.workspace.revision;
  useEffect(() => () => { previewGeneration.current++; previewRequest.current?.controller.abort(); }, []);
  useEffect(() => { previewGeneration.current++; previewRequest.current?.controller.abort(); previewRequest.current = null; suppressedPreview.current = null; setPreview(null); setPreviewLoading(false); }, [props.workspace.revision, props.workspace.scope.actorId, props.workspace.scope.workspaceId]);
  const mode = props.mode ?? localMode, sections = props.sections ?? ["tree", "library", "favorites", "recent", "trash"];
  const activeSection = sections.includes(section) ? section : sections.find(item => item !== "library");
  const setMode = (next: NotesNavigationMode): void => { setLocalMode(next); props.onModeChange?.(next); };
  const indexed = useMemo(() => new Map(props.workspace.pages.map(page => [page.id, page])), [props.workspace]);
  const expandedActiveIdentity = useRef("");
  useEffect(() => {
    if (!props.activePageId || !indexed.has(props.activePageId)) return;
    const identity = scopeKey(props.workspace) + props.activePageId;
    if (expandedActiveIdentity.current === identity) return;
    expandedActiveIdentity.current = identity;
    const ancestors: string[] = [], seen = new Set<string>([props.activePageId]); let parent = indexed.get(props.activePageId)?.parentId;
    while (parent && !seen.has(parent)) { seen.add(parent); ancestors.push(parent); parent = indexed.get(parent)?.parentId; }
    if (ancestors.length) setExpanded(current => new Set([...current, ...ancestors]));
  }, [props.activePageId, indexed, props.workspace.scope.actorId, props.workspace.scope.workspaceId]);
  const children = useMemo(() => {
    const result = new Map<string | null, NotesPageSummary[]>();
    for (const page of props.workspace.pages.filter(alive).sort(byPosition)) { const parent = page.parentId && indexed.has(page.parentId) && alive(indexed.get(page.parentId)!) ? page.parentId : null; const list = result.get(parent) ?? []; list.push(page); result.set(parent, list); }
    return result;
  }, [props.workspace, indexed]);
  const visible = useMemo(() => {
    if (!activeSection) return [];
    if (activeSection !== "tree" || query.trim()) {
      const candidates = activeSection === "trash" ? props.workspace.pages.filter(page => !alive(page))
        : activeSection === "favorites" ? props.workspace.pages.filter(page => alive(page) && page.favorite)
        : activeSection === "recent" ? (props.recentPageIds ?? []).flatMap(id => { const page = indexed.get(id); return page && alive(page) ? [page] : []; })
        : props.workspace.pages.filter(alive);
      return candidates.filter(page => matches(page, query, props.getPresentation?.(page))).map(page => ({ page, level: 1 }));
    }
    const rows: { page: NotesPageSummary; level: number }[] = [], seen = new Set<string>();
    const visit = (parent: string | null, level: number): void => {
      for (const page of children.get(parent) ?? []) { if (seen.has(page.id)) continue; seen.add(page.id); rows.push({ page, level }); if (expanded.has(page.id)) visit(page.id, level + 1); }
    };
    visit(null, 1);
    return rows;
  }, [activeSection, query, props.workspace, props.recentPageIds, indexed, children, expanded, props.getPresentation]);
  const actionPage = actionPageId ? indexed.get(actionPageId) : undefined;
  const showPreview = (page: NotesPageSummary, opener: HTMLElement): void => {
    if (!props.onPreview || suppressedPreview.current === page.id || previewRequest.current?.pageId === page.id) return;
    previewRequest.current?.controller.abort();
    const controller = new AbortController(), generation = ++previewGeneration.current;
    const requestScope = currentPreviewScope.current;
    previewRequest.current = { controller, generation, pageId: page.id }; previewOpener.current = opener;
    setPreview({ page }); setPreviewLoading(true);
    void props.onPreview({ kind: "page", pageId: page.id }, controller.signal).then(data => {
      if (!controller.signal.aborted && generation === previewGeneration.current && requestScope === currentPreviewScope.current && data.page.id === page.id) setPreview(data);
    }).catch(() => { if (!controller.signal.aborted && generation === previewGeneration.current) setMessage("プレビューを読み込めませんでした"); }).finally(() => { if (!controller.signal.aborted && generation === previewGeneration.current) setPreviewLoading(false); });
  };
  const closePreview = (restoreFocus = true): void => {
    suppressedPreview.current = preview?.page.id ?? previewRequest.current?.pageId ?? null;
    previewGeneration.current++; previewRequest.current?.controller.abort(); previewRequest.current = null;
    setPreview(null); setPreviewLoading(false); if (restoreFocus && previewOpener.current?.isConnected) previewOpener.current.focus();
  };
  const focus = (id: string): void => { setFocused(id); tree.current?.querySelectorAll<HTMLButtonElement>("[role=treeitem]").forEach(button => { if (button.dataset.pageId === id) button.focus(); }); };
  const toggle = (id: string): void => setExpanded(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const key = (event: KeyboardEvent<HTMLButtonElement>, id: string): void => {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === " " || event.key === "Enter") return;
    const index = visible.findIndex(row => row.page.id === id), page = indexed.get(id);
    if (!page) return;
    let next: string | undefined;
    if (event.key === "ArrowDown") next = visible[Math.min(index + 1, visible.length - 1)]?.page.id;
    else if (event.key === "ArrowUp") next = visible[Math.max(index - 1, 0)]?.page.id;
    else if (event.key === "Home") next = visible[0]?.page.id;
    else if (event.key === "End") next = visible[visible.length - 1]?.page.id;
    else if (event.key === "ArrowRight" && activeSection === "tree" && !query.trim() && children.has(id)) { if (!expanded.has(id)) toggle(id); else next = children.get(id)?.[0]?.id; }
    else if (event.key === "ArrowLeft" && activeSection === "tree" && !query.trim()) { if (expanded.has(id)) toggle(id); else next = page.parentId ?? undefined; }
    else if (event.key.length === 1 && !event.shiftKey) { next = [...visible.slice(index + 1), ...visible.slice(0, index + 1)].find(row => row.page.title.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()))?.page.id; }
    else return;
    event.preventDefault(); if (next) focus(next);
  };
  const move = async (parentId: string | null): Promise<void> => {
    const source = dragged.current; dragged.current = null;
    if (!source || busy(props) || !props.getCapabilities(source.id).includes("page.move")) return;
    if (source.revision !== props.workspace.revision) { setMessage("一覧が変わりました。移動をやり直してください"); return; }
    if (!canMoveNotesPage(props.workspace.pages, source.id, parentId)) { setMessage("自分自身や子孫には移動できません"); return; }
    try { const result = await props.onCommand({ kind: "page", pageId: source.id }, { kind: "page.move", parentId, position: nextPosition(props.workspace.pages, parentId, source.id), expectedWorkspaceRevision: source.revision }); setMessage(outcomeMessage(result.status, result.status === "committed" ? result.persistence : undefined)); if (result.status === "committed" && !await refreshWorkspace(props)) setMessage(outcomeMessage(result.status, result.persistence) + "。最新の一覧を再読込できませんでした"); }
    catch { setMessage("移動の結果を確認できませんでした"); }
  };
  return <aside className="oe-notes-navigation" aria-label="ノートのナビゲーション">
    <div className="oe-notes-navigation-modes" role="group" aria-label="ナビゲーション表示">{(["pages", "library", "document"] as const).filter(item => item !== "library" || sections.includes("library")).map(item => <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)}>{item === "pages" ? "ページ" : item === "library" ? "ライブラリ" : "ドキュメント"}</button>)}</div>
    {mode === "document" ? props.documentContent ?? <p>ページを開いてドキュメントを確認してください</p> : <>
      <label className="oe-notes-search">ページを検索<input type="search" aria-label="ページを検索" value={query} onChange={event => { setQuery(event.target.value); if (!(event.nativeEvent as InputEvent).isComposing) void props.onSearch?.(event.target.value).catch(() => setMessage("検索結果を読み込めませんでした")); }} onCompositionEnd={event => { void props.onSearch?.(event.currentTarget.value).catch(() => setMessage("検索結果を読み込めませんでした")); }} /></label>
      <div className="oe-notes-navigation-sections" role="group" aria-label="ページの一覧">{(["tree", "favorites", "recent", "trash"] as const).filter(item => sections.includes(item)).map(item => <button key={item} type="button" aria-pressed={activeSection === item} onClick={() => setSection(item)}>{item === "tree" ? "すべて" : item === "favorites" ? "お気に入り" : item === "recent" ? "最近開いた" : "ゴミ箱"}</button>)}</div>
      <div className="oe-notes-tree-root" onDragOver={event => { if (dragged.current && !busy(props)) event.preventDefault(); }} onDrop={event => { event.preventDefault(); void move(null); }}>最上位に移動</div>
      <div ref={tree} role="tree" aria-label="ページツリー" className="oe-notes-tree">{visible.map(({ page, level }) => {
        const hasChildren = activeSection === "tree" && !query.trim() && Boolean(children.get(page.id)?.length);
        const siblings = activeSection === "tree" && !query.trim() ? children.get(page.parentId) ?? children.get(null) ?? [] : visible.map(row => row.page);
        const tabStop = visible.some(row => row.page.id === focused) ? page.id === focused : page.id === visible[0]?.page.id;
        return <div key={page.id} className="oe-notes-tree-row" style={{ paddingInlineStart: (level - 1) * 16 }} onDragOver={event => { if (dragged.current && !busy(props) && canMoveNotesPage(props.workspace.pages, dragged.current.id, page.id)) event.preventDefault(); }} onDrop={event => { event.preventDefault(); event.stopPropagation(); void move(page.id); }}>
          {hasChildren ? <button type="button" tabIndex={-1} aria-label={page.title + (expanded.has(page.id) ? "を折りたたむ" : "を展開")} onClick={() => toggle(page.id)}>{expanded.has(page.id) ? "▾" : "▸"}</button> : <span className="oe-notes-tree-spacer" />}
          <button type="button" role="treeitem" data-page-id={page.id} aria-level={level} aria-setsize={siblings.length} aria-posinset={Math.max(1, siblings.findIndex(item => item.id === page.id) + 1)} aria-selected={page.id === props.activePageId} aria-expanded={hasChildren ? expanded.has(page.id) : undefined} tabIndex={tabStop ? 0 : -1} disabled={busy(props)} draggable={!busy(props) && props.getCapabilities(page.id).includes("page.move") && alive(page)} onFocus={event => { setFocused(page.id); showPreview(page, event.currentTarget); }} onMouseEnter={event => showPreview(page, event.currentTarget)} onMouseLeave={() => { if (suppressedPreview.current === page.id) suppressedPreview.current = null; }} onKeyDown={event => key(event, page.id)} onDragStart={event => { if (!props.getCapabilities(page.id).includes("page.move") || busy(props)) { event.preventDefault(); return; } dragged.current = { id: page.id, revision: props.workspace.revision }; event.dataTransfer.setData("application/x-openeditor-page", page.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { dragged.current = null; }} onClick={() => { if (!busy(props)) void props.onOpen({ kind: "page", pageId: page.id }); }}><span aria-hidden="true">{page.icon || "▤"}</span><span>{page.title}</span></button>
          <button type="button" className="oe-notes-tree-more" aria-label={page.title + "の操作を表示"} aria-expanded={actionPageId === page.id} disabled={busy(props)} onClick={() => setActionPageId(current => current === page.id ? null : page.id)}>…</button>
        </div>;
      })}</div>
      {!visible.length ? <p>一致するページはありません</p> : null}
      {!props.workspace.complete ? <p>読み込まれたページを表示しています。未読込のページはまだ一覧に含まれません</p> : null}
      {props.workspace.hasMore && props.onLoadMore ? <button type="button" disabled={props.loadingMore} onClick={() => void props.onLoadMore!().catch(() => setMessage("追加のページを読み込めませんでした"))}>{props.loadingMore ? "読み込み中" : "さらに読み込む"}</button> : null}
      {actionPage ? <NotesPageActions {...props} page={actionPage} /> : null}
    </>}
    {preview ? <NotesPagePreview data={preview} loading={previewLoading} onClose={closePreview} onOpen={async target => { const opened = await props.onOpen(target); if (opened) closePreview(false); return opened; }} blocked={busy(props)} /> : null}
    <p role="status">{message}</p><OperationStatus {...props} />
  </aside>;
}

export type NotesLibraryProps = NotesPageOperations & {
  pageSize?: number; hasMore?: boolean; loadingMore?: boolean; onLoadMore?(): Promise<void>;
  onAIClassify?(target: NotesTarget): Promise<void>;
};
export type NotesPagePreviewProps = {
  data: NotesPagePreviewData; loading?: boolean; blocked?: boolean; initialWidth?: number;
  onClose(): void; onOpen(target: NotesTarget): Promise<boolean>; onWidthChange?(width: number): void;
};
/** A read-only, non-modal preview. Hover never takes keyboard focus or opens the active editor. */
export function NotesPagePreview(props: NotesPagePreviewProps) {
  const [width, setWidth] = useState(props.initialWidth ?? 360), [message, setMessage] = useState("");
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null), openLock = useRef(false);
  const maxWidth = (): number => Math.max(160, Math.min(640, (typeof window === "undefined" ? 800 : window.innerWidth) - 32));
  const clamp = (value: number): number => Math.max(Math.min(240, maxWidth()), Math.min(value, maxWidth()));
  const open = async (target: NotesTarget): Promise<void> => {
    if (openLock.current || props.blocked) return;
    openLock.current = true;
    try { const opened = await props.onOpen(target); if (!opened) setMessage("編集内容を保存できていないため、ページを切り替えていません"); }
    catch { setMessage("ページを開けませんでした。編集中のページを保持しています"); }
    finally { openLock.current = false; }
  };
  return <aside role="complementary" aria-label={props.data.page.title + "のプレビュー"} className="oe-notes-page-preview" style={{ width: clamp(width), maxWidth: "calc(100vw - 32px)" }} onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.stopPropagation(); props.onClose(); } }}>
    <div className="oe-notes-preview-resize" role="separator" aria-label="プレビューの幅" aria-orientation="vertical" aria-valuemin={Math.min(240, maxWidth())} aria-valuemax={maxWidth()} aria-valuenow={clamp(width)} tabIndex={0} onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || event.nativeEvent.isComposing) return;
      event.preventDefault(); const next = clamp(event.key === "Home" ? 240 : event.key === "End" ? maxWidth() : width + (event.key === "ArrowLeft" ? 16 : -16)); setWidth(next); props.onWidthChange?.(next);
    }} onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); drag.current = { pointerId: event.pointerId, x: event.clientX, width }; event.currentTarget.setPointerCapture?.(event.pointerId); }} onPointerMove={event => { if (drag.current?.pointerId === event.pointerId) setWidth(clamp(drag.current.width + drag.current.x - event.clientX)); }} onPointerUp={event => { if (drag.current?.pointerId !== event.pointerId) return; drag.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId); props.onWidthChange?.(clamp(width)); }} onPointerCancel={() => { if (drag.current) setWidth(drag.current.width); drag.current = null; }} />
    <header><h2>{props.data.page.title}</h2><button type="button" aria-label="プレビューを閉じる" onClick={props.onClose}>閉じる</button></header>
    {props.loading ? <p role="status">プレビューを読み込んでいます</p> : <div className="oe-notes-preview-content">{props.data.content ?? <p>プレビューの内容はありません</p>}</div>}
    <button type="button" disabled={props.blocked} onClick={() => void open({ kind: "page", pageId: props.data.page.id })}>編集画面で開く</button>
    {props.data.related?.length ? <section aria-label="プレビューの関連ページ"><h3>関連ページ</h3>{props.data.related.filter(alive).map(page => <button key={page.id} type="button" disabled={props.blocked} onClick={() => void open({ kind: "page", pageId: page.id })}>{page.title}</button>)}</section> : null}
    <p role="status">{message}</p>
  </aside>;
}
/** Library view uses host-authorized summaries; classification is an explicit mutation. */
export function NotesLibrary(props: NotesLibraryProps) {
  const [query, setQuery] = useState(""), [kind, setKind] = useState<"all" | "page" | "database">("all"), [tag, setTag] = useState("");
  const [sort, setSort] = useState<"updated" | "title" | "workspace" | "children">("updated"), [ascending, setAscending] = useState(false);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable"), [limit, setLimit] = useState(props.pageSize ?? 24);
  const [actionPageId, setActionPageId] = useState<string | null>(null), [aiBusy, setAiBusy] = useState<string | null>(null), [message, setMessage] = useState("");
  const loadLock = useRef(false), [loading, setLoading] = useState(false);
  const size = Math.max(1, props.pageSize ?? 24);
  const pages = props.workspace.pages.filter(alive);
  const childCount = new Map<string, number>(); for (const page of pages) if (page.parentId) childCount.set(page.parentId, (childCount.get(page.parentId) ?? 0) + 1);
  const tags = [...new Set(pages.flatMap(page => [...(page.tags ?? [])]))].sort((a, b) => a.localeCompare(b));
  const visible = pages.filter(page => matches(page, query, props.getPresentation?.(page)) && (!tag || page.tags?.includes(tag)) && (kind === "all" || (props.getPresentation?.(page).kind ?? "page") === kind)).sort((a, b) => {
    const av = sort === "title" ? a.title : sort === "workspace" ? props.getPresentation?.(a).workspace ?? a.category ?? "" : sort === "children" ? childCount.get(a.id) ?? 0 : a.updatedAt ?? "";
    const bv = sort === "title" ? b.title : sort === "workspace" ? props.getPresentation?.(b).workspace ?? b.category ?? "" : sort === "children" ? childCount.get(b.id) ?? 0 : b.updatedAt ?? "";
    const compared = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return (ascending ? compared : -compared) || a.id.localeCompare(b.id);
  });
  const resetLimit = (): void => setLimit(size);
  const loadMore = async (): Promise<void> => {
    if (loadLock.current || props.loadingMore) return;
    setLimit(current => current + size);
    if (limit < visible.length || !props.hasMore || !props.onLoadMore) return;
    loadLock.current = true; setLoading(true);
    try { await props.onLoadMore(); } catch { setMessage("追加のページを読み込めませんでした。もう一度読み込めます"); }
    finally { loadLock.current = false; setLoading(false); }
  };
  return <section className={"oe-notes-library oe-notes-library-" + density} aria-label="ノートのライブラリ">
    <header><h2>ライブラリ <small>{visible.length}ページ</small></h2><div className="oe-notes-library-controls">
      <label>検索<input type="search" aria-label="ライブラリを検索" value={query} onChange={event => { setQuery(event.target.value); resetLimit(); }} /></label>
      <label>ページの種類<select aria-label="ページの種類" value={kind} onChange={event => { setKind(event.target.value as typeof kind); resetLimit(); }}><option value="all">すべて</option><option value="page">ページ</option><option value="database">データベース</option></select></label>
      <label>並び順<select aria-label="並び順" value={sort} onChange={event => { setSort(event.target.value as typeof sort); resetLimit(); }}><option value="updated">更新日</option><option value="title">タイトル</option><option value="workspace">分類</option><option value="children">子ページ数</option></select></label>
      <button type="button" aria-label={ascending ? "降順にする" : "昇順にする"} onClick={() => { setAscending(current => !current); resetLimit(); }}>{ascending ? "昇順" : "降順"}</button>
      <div role="group" aria-label="一覧の密度"><button type="button" aria-pressed={density === "comfortable"} onClick={() => setDensity("comfortable")}>ゆったり</button><button type="button" aria-pressed={density === "compact"} onClick={() => setDensity("compact")}>コンパクト</button></div>
    </div></header>
    <div className="oe-notes-tags" role="group" aria-label="タグで絞り込み">{tags.map(value => <button key={value} type="button" aria-pressed={tag === value} onClick={() => { setTag(current => current === value ? "" : value); resetLimit(); }}>#{value}</button>)}{tag ? <button type="button" onClick={() => { setTag(""); resetLimit(); }}>タグの絞り込みを解除</button> : null}</div>
    <div role="list" className="oe-notes-library-list">{visible.slice(0, limit).map(page => {
      const presentation = props.getPresentation?.(page), parent = pages.find(item => item.id === page.parentId);
      return <article role="listitem" key={page.id} className="oe-notes-library-row"><button type="button" className="oe-notes-page-card" aria-current={page.id === props.activePageId ? "page" : undefined} disabled={busy(props)} onClick={() => void props.onOpen({ kind: "page", pageId: page.id })}>
        <PageMedia page={page} presentation={presentation} /><div><small>{parent?.title ?? presentation?.workspace ?? page.category ?? "ページ"}</small><h3>{page.title}</h3><p>{presentation?.summary}</p>{presentation?.database ? <p>{presentation.database.title} · {presentation.database.rowCount}件 · {presentation.database.viewType}</p> : null}<small>{childCount.get(page.id) ?? 0} 子ページ · {page.updatedAt ?? ""} · {presentation?.privacy ?? ""}</small></div>
      </button><div className="oe-notes-page-tags">{page.tags?.map(value => <button key={value} type="button" aria-pressed={tag === value} onClick={() => { setTag(current => current === value ? "" : value); resetLimit(); }}>#{value}</button>)}</div>
        <button type="button" aria-label={page.title + "の操作を表示"} aria-expanded={actionPageId === page.id} disabled={busy(props)} onClick={() => setActionPageId(current => current === page.id ? null : page.id)}>操作</button>
        {actionPageId === page.id ? <NotesPageActions {...props} page={page} /> : null}
        {props.onAIClassify && props.getCapabilities(page.id).includes("metadata.patch") ? <button type="button" disabled={busy(props) || aiBusy !== null} onClick={() => { setAiBusy(page.id); void props.onAIClassify!({ kind: "page", pageId: page.id }).catch(() => setMessage("分類案を取得できませんでした")).finally(() => setAiBusy(null)); }}>{aiBusy === page.id ? "分類案を確認しています" : "AIの分類案を確認"}</button> : null}
      </article>;
    })}</div>
    {!visible.length ? <p>一致するページはありません</p> : null}
    {limit < visible.length || props.hasMore ? <button type="button" disabled={loading || props.loadingMore} onClick={() => void loadMore()}>{loading || props.loadingMore ? "読み込み中" : "さらに読み込む"}</button> : null}
    <p role="status">{message}</p><OperationStatus {...props} />
  </section>;
}

export type NotesPageHubProps = NotesPageOperations & { pageId: string; relatedPageIds?: readonly string[]; onShowPages?(): void };
/** Child-page home, with separate explicit child ordering and guarded navigation. */
export function NotesPageHub(props: NotesPageHubProps) {
  const [query, setQuery] = useState(""), [layout, setLayout] = useState<"grid" | "list">("grid"), [adding, setAdding] = useState<ActionDraft | null>(null), [message, setMessage] = useState("");
  const dragged = useRef<{ id: string; revision: string } | null>(null);
  const page = props.workspace.pages.find(item => item.id === props.pageId);
  if (!page) return <p>ページを表示できません</p>;
  const children = props.workspace.pages.filter(item => alive(item) && item.parentId === page.id).sort(byPosition);
  const visible = children.filter(item => matches(item, query, props.getPresentation?.(item)));
  const chain: NotesPageSummary[] = [], seen = new Set<string>(); let cursor: NotesPageSummary | undefined = page;
  while (cursor && !seen.has(cursor.id)) { seen.add(cursor.id); chain.unshift(cursor); cursor = cursor.parentId ? props.workspace.pages.find(item => item.id === cursor!.parentId && alive(item)) : undefined; }
  const related = (props.relatedPageIds ?? []).flatMap(id => { const candidate = props.workspace.pages.find(item => item.id === id && alive(item)); return candidate && candidate.id !== page.id ? [candidate] : []; });
  const reorder = async (before: NotesPageSummary): Promise<void> => {
    const source = dragged.current; dragged.current = null;
    if (!source || source.id === before.id || busy(props) || source.revision !== props.workspace.revision || !props.getCapabilities(source.id).includes("page.move") || !canMoveNotesPage(props.workspace.pages, source.id, page.id)) return;
    const index = children.findIndex(child => child.id === before.id), prior = children.slice(0, index).filter(child => child.id !== source.id).at(-1);
    const position = prior ? prior.position + (before.position - prior.position) / 2 : before.position - 1;
    if (!Number.isFinite(position) || position === before.position || position === prior?.position) { setMessage("この並び順は更新できません。移動先を選び直してください"); return; }
    try { const result = await props.onCommand({ kind: "page", pageId: source.id }, { kind: "page.move", parentId: page.id, position, expectedWorkspaceRevision: source.revision }); setMessage(outcomeMessage(result.status, result.status === "committed" ? result.persistence : undefined)); if (result.status === "committed" && !await refreshWorkspace(props)) setMessage(outcomeMessage(result.status, result.persistence) + "。最新の一覧を再読込できませんでした"); }
    catch { setMessage("並び順の保存結果を確認できませんでした"); }
  };
  return <section className={"oe-notes-page-hub oe-notes-page-hub-" + layout} aria-label={page.title + "の子ページ"}>
    <nav aria-label="ページの場所" className="oe-notes-breadcrumbs"><button type="button" onClick={props.onShowPages}>ページ</button>{chain.map(item => <button key={item.id} type="button" disabled={busy(props)} aria-current={item.id === page.id ? "page" : undefined} onClick={() => { if (item.id !== page.id) void props.onOpen({ kind: "page", pageId: item.id }); }}>{item.title}</button>)}</nav>
    <header><h2>子ページ <small>{visible.length} / {children.length}</small></h2><label>子ページを検索<input type="search" aria-label="子ページを検索" value={query} onChange={event => setQuery(event.target.value)} /></label><div role="group" aria-label="子ページの表示"><button type="button" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}>グリッド</button><button type="button" aria-pressed={layout === "list"} onClick={() => setLayout("list")}>リスト</button></div>{props.getCapabilities(page.id).includes("page.create") ? <button type="button" disabled={busy(props)} onClick={() => setAdding({ page, action: "create", workspaceRevision: props.workspace.revision, scopeKey: scopeKey(props.workspace) })}>子ページを追加</button> : null}</header>
    <div className="oe-notes-child-pages">{visible.map(child => <article key={child.id}><button type="button" draggable={!busy(props) && props.getCapabilities(child.id).includes("page.move")} disabled={busy(props)} onClick={() => void props.onOpen({ kind: "page", pageId: child.id })} onDragStart={event => { if (busy(props) || !props.getCapabilities(child.id).includes("page.move")) { event.preventDefault(); return; } dragged.current = { id: child.id, revision: props.workspace.revision }; event.dataTransfer.setData("application/x-openeditor-page", child.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { dragged.current = null; }} onDragOver={event => { if (dragged.current && !busy(props)) event.preventDefault(); }} onDrop={event => { event.preventDefault(); void reorder(child); }}><PageMedia page={child} presentation={props.getPresentation?.(child)} /><h3>{child.title}</h3><p>{props.getPresentation?.(child).summary}</p><small>{child.tags?.join(" · ")}</small></button><NotesPageActions {...props} page={child} /></article>)}</div>
    {!visible.length ? <p>{query ? "一致する子ページはありません" : "子ページはありません"}</p> : null}
    {!props.workspace.complete ? <p>子ページ数は読み込まれた範囲です</p> : null}
    {related.length ? <section aria-label="関連ページ"><h3>関連ページ</h3>{related.map(item => <button key={item.id} type="button" disabled={busy(props)} onClick={() => void props.onOpen({ kind: "page", pageId: item.id })}>{item.title}</button>)}</section> : null}
    {adding ? <PageActionDialog {...props} draft={adding} onClose={() => setAdding(null)} /> : null}
    <p role="status">{message}</p><OperationStatus {...props} />
  </section>;
}
