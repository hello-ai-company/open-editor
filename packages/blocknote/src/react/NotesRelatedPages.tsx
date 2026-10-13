import { NotesPageIcon } from "./NotesPageIcon.js";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BacklinkItem } from "@hello-ai-company/editor-core";
import type { NotesTarget, NotesWorkspaceController, NotesWorkspaceHost, NotesWorkspaceSnapshot } from "../notes/contracts.js";
import { extractRelationEdges } from "../workspace/relationIndex.js";
import { useNotesController } from "./notesWorkspacePanels.js";

export type NotesRelatedPagesProps = {
  controller: NotesWorkspaceController;
  host: NotesWorkspaceHost;
  workspace: NotesWorkspaceSnapshot;
  onOpen(target: NotesTarget): Promise<boolean>;
  language?: "ja" | "en";
};

/** Reuse the document relation index. Incoming body references belong to the
 * authorized host; never load or scan every page body to infer backlinks. */
export function NotesRelatedPages(props: NotesRelatedPagesProps) {
  const state = useNotesController(props.controller), snapshot = state.snapshot;
  const ja = props.language !== "en";
  const identity = JSON.stringify([snapshot?.scope, snapshot?.target, snapshot?.revision, props.workspace.revision]);
  const liveIdentity = () => { const live = props.controller.getState().snapshot; return JSON.stringify([live?.scope, live?.target, live?.revision, props.workspace.revision]); };
  const validScope = !!snapshot && snapshot.scope.actorId === props.host.scope.actorId && snapshot.scope.workspaceId === props.host.scope.workspaceId && props.workspace.scope.actorId === snapshot.scope.actorId && props.workspace.scope.workspaceId === snapshot.scope.workspaceId;
  const pageId = validScope && snapshot?.target.kind === "page" ? snapshot.target.pageId : undefined;
  const pages = useMemo(() => new Map(props.workspace.pages.filter(page => !page.deletedAt).map(page => [page.id, page])), [props.workspace.pages]);
  const document = state.draft ?? snapshot?.document;
  const outgoing = useMemo(() => {
    if (!pageId || !document) return [];
    const ids = new Set([...(pages.get(pageId)?.relatedPageIds ?? []), ...extractRelationEdges(pageId, document.blocks).filter(edge => edge.targetType === "page").map(edge => edge.targetId)]);
    ids.delete(pageId);
    return [...ids].flatMap(id => pages.get(id) ?? []);
  }, [pageId, document, pages]);
  const provider = props.host.providers?.backlinks;
  const [loaded, setLoaded] = useState<{ identity: string; provider: typeof provider; items: readonly BacklinkItem[]; status: "loading" | "ready" | "error" }>();
  const [refresh, setRefresh] = useState(0), [message, setMessage] = useState("");
  const generation = useRef(0), opening = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const current = ++generation.current;
    if (!pageId || !provider?.listBacklinks) { setLoaded(undefined); return; }
    let active = true;
    setLoaded({ identity, provider, items: [], status: "loading" });
    void Promise.resolve().then(() => !active || identity !== liveIdentity() ? [] : provider.listBacklinks!({ targetType: "page", targetId: pageId, limit: 100 })).then(items => {
      if (active && current === generation.current && identity === liveIdentity()) setLoaded({ identity, provider, items: items.slice(0, 100), status: "ready" });
    }).catch(() => { if (active && current === generation.current && identity === liveIdentity()) setLoaded({ identity, provider, items: [], status: "error" }); });
    return () => { active = false; };
  }, [props.host, props.controller, pageId, identity, provider, refresh]);
  const current = loaded?.identity === identity && loaded.provider === provider ? loaded : undefined;
  const incoming = useMemo(() => {
    if (!pageId) return [];
    const ids = new Set([...pages.values()].filter(page => page.parentId === pageId || page.relatedPageIds?.includes(pageId)).map(page => page.id));
    for (const item of current?.items ?? []) ids.add(item.sourceDocumentId);
    ids.delete(pageId);
    return [...ids].flatMap(id => pages.get(id) ?? []);
  }, [pageId, pages, current]);
  const disabled = state.status !== "ready" || state.composing || state.pendingEditors;
  const open = async (id: string) => {
    const live = props.controller.getState();
    if (!validScope || opening.current || disabled || live.status !== "ready" || live.composing || live.pendingEditors || identity !== liveIdentity() || !pages.has(id)) return;
    opening.current = true; setMessage("");
    try { if (!await props.onOpen({ kind: "page", pageId: id }) && mounted.current) setMessage(ja ? "ページを開けませんでした。入力は保持しています" : "Could not open the page. Your input is retained."); }
    catch { if (mounted.current) setMessage(ja ? "ページを開けませんでした。入力は保持しています" : "Could not open the page. Your input is retained."); }
    finally { opening.current = false; }
  };
  if (!pageId) return null;
  return <div className="oe-notes-page-relations">
    <section aria-label={ja ? "関連ページ" : "Related pages"}><h3>{ja ? "関連ページ" : "Related pages"} <small>{outgoing.length}</small></h3>{outgoing.length ? <ul>{outgoing.map(page => <li key={page.id}><button type="button" disabled={disabled} onClick={() => void open(page.id)}>{page.icon ? <NotesPageIcon value={page.icon} /> : null}{page.title}</button></li>)}</ul> : <p>{ja ? "読み込まれた一覧に関連ページはありません" : "No related pages in the loaded catalog."}</p>}</section>
    <section aria-label={ja ? "被リンク" : "Backlinks"}><header><h3>{ja ? "被リンク" : "Backlinks"} <small>{incoming.length}</small></h3>{provider?.listBacklinks ? <button type="button" disabled={current?.status === "loading"} onClick={() => setRefresh(value => value + 1)}>{ja ? "再読み込み" : "Refresh backlinks"}</button> : null}</header>{current?.status === "loading" ? <p role="status">{ja ? "被リンクを読み込んでいます" : "Loading backlinks…"}</p> : null}{current?.status === "error" ? <p role="alert">{ja ? "被リンクを読み込めませんでした" : "Could not load backlinks."}</p> : null}{incoming.length ? <ul>{incoming.map(page => <li key={page.id}><button type="button" disabled={disabled} onClick={() => void open(page.id)}>{page.title}</button></li>)}</ul> : current?.status !== "loading" ? <p>{ja ? "読み込まれた一覧に被リンクはありません" : "No backlinks in the loaded catalog."}</p> : null}</section>
    <p className="oe-notes-relations-scope">{ja ? "読み込まれたページのみ表示しています。" : "Showing loaded pages only."}{!provider?.listBacklinks ? ja ? " 他のページ本文からの参照は未確認です。" : " References in other page bodies have not been checked." : null}</p>
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
