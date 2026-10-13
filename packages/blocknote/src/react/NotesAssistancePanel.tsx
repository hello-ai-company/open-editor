import { useEffect, useRef, useState } from "react";
import type { NotesScope, NotesTarget, NotesWorkspaceController } from "../notes/contracts.js";
import { notesIsComposing, notesPanelIdentity, notesTargetKey, useNotesController } from "./notesWorkspacePanels.js";

export type NotesAssistanceRequest = {
  scope: NotesScope; target: NotesTarget; revision: string;
  kind: "search" | "ask-page"; query: string; includeWeb: boolean; signal: AbortSignal;
};
/** Only an authorization-filtered host projection. No body, credentials, provider or writer is inferred. */
export type NotesAssistanceResult = {
  scope: NotesScope; target: NotesTarget; revision: string; text: string;
  hits?: readonly { id: string; target: NotesTarget; title: string; excerpt?: string }[];
};
export type NotesAssistanceService = {
  allowWeb?: boolean;
  run(request: NotesAssistanceRequest): Promise<NotesAssistanceResult>;
};
export type NotesAssistancePanelProps = {
  controller: NotesWorkspaceController; scope: NotesScope;
  kind: "search" | "ask-page"; service?: NotesAssistanceService;
  onOpen?(target: NotesTarget): Promise<boolean>; language?: "ja" | "en";
};
function validTarget(target: NotesTarget): boolean {
  const id = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 512;
  return !!target && (target.kind === "page" ? id(target.pageId) : target.kind === "row" && id(target.databaseId) && id(target.rowId));
}
export function NotesAssistancePanel(props: NotesAssistancePanelProps) {
  const state = useNotesController(props.controller);
  return <Assistance key={JSON.stringify([props.scope.actorId, props.scope.workspaceId, props.kind, notesPanelIdentity(props.controller, state.snapshot)])} {...props} />;
}
function Assistance(props: NotesAssistancePanelProps) {
  const state = useNotesController(props.controller), ja = props.language !== "en";
  const [query, setQuery] = useState(""), [includeWeb, setIncludeWeb] = useState(false);
  const [result, setResult] = useState<NotesAssistanceResult>(), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const flight = useRef<AbortController | undefined>(undefined), openerFlight = useRef(false), composing = useRef(false);
  const cancel = () => { flight.current?.abort(); flight.current = undefined; setBusy(false); };
  useEffect(() => { cancel(); setResult(undefined); }, [state.snapshot?.revision, state.draft, state.draftTitle, state.composing, props.service, props.scope.actorId, props.scope.workspaceId]);
  useEffect(() => () => { flight.current?.abort(); }, []);
  const blocked = state.status !== "ready" || state.dirty || state.pendingEditors || state.composing || !!state.recovery;
  const submit = async () => {
    if (state.snapshot?.scope.actorId !== props.scope.actorId || state.snapshot?.scope.workspaceId !== props.scope.workspaceId || composing.current || flight.current || blocked || !props.service || !state.snapshot || !query.trim() || query.length > 4000) return;
    const snapshot = state.snapshot, abort = new AbortController(); flight.current = abort; setBusy(true); setMessage(""); setResult(undefined);
    try {
      const response = await props.service.run({ scope: props.scope, target: snapshot.target, revision: snapshot.revision, kind: props.kind, query: query.trim(), includeWeb: Boolean(props.service.allowWeb && includeWeb), signal: abort.signal });
      if (flight.current !== abort || abort.signal.aborted) return;
      const latest = props.controller.getState();
      if (latest.snapshot?.scope.actorId !== props.scope.actorId || latest.snapshot?.scope.workspaceId !== props.scope.workspaceId || latest.snapshot && notesTargetKey(latest.snapshot.target) !== notesTargetKey(snapshot.target) || latest.status !== "ready" || latest.snapshot?.revision !== snapshot.revision || latest.dirty || latest.composing || latest.pendingEditors) return;
      if (response.scope.actorId !== props.scope.actorId || response.scope.workspaceId !== props.scope.workspaceId || !validTarget(response.target) || notesTargetKey(response.target) !== notesTargetKey(snapshot.target) || response.revision !== snapshot.revision || typeof response.text !== "string" || response.text.length > 100000 || response.hits && (!Array.isArray(response.hits) || response.hits.length > 100 || new Set(response.hits.map(hit => hit.id)).size !== response.hits.length || response.hits.some(hit => typeof hit.id !== "string" || !hit.id || hit.id.length > 512 || typeof hit.title !== "string" || hit.title.length > 4000 || hit.excerpt !== undefined && (typeof hit.excerpt !== "string" || hit.excerpt.length > 10000) || !validTarget(hit.target)))) throw new Error("Invalid host projection");
      setResult(response);
    } catch { if (flight.current === abort && !abort.signal.aborted) setMessage(ja ? "結果を読み込めませんでした。質問を保持しています" : "Could not load results. Your question is retained."); }
    finally { if (flight.current === abort) { flight.current = undefined; setBusy(false); } }
  };
  const title = props.kind === "search" ? (ja ? "検索アシスタント" : "Search assistant") : (ja ? "このページに質問" : "Ask this page");
  return <section className="oe-notes-assistance" aria-label={title}><h3>{title}</h3>
    <form onSubmit={event => { event.preventDefault(); if (!composing.current) void submit(); }}>
      <label>{ja ? "質問" : "Question"}<textarea aria-label={title + (ja ? "の質問" : " question")} value={query} maxLength={4000} onCompositionStart={() => { composing.current = true; cancel(); }} onCompositionEnd={() => { composing.current = false; }} onChange={event => { cancel(); setQuery(event.target.value); setResult(undefined); }} onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event)) { event.stopPropagation(); cancel(); } }} /></label>
      {props.service?.allowWeb ? <label><input type="checkbox" checked={includeWeb} onChange={event => { cancel(); setIncludeWeb(event.target.checked); setResult(undefined); }} />{ja ? "Webも含める" : "Include web"}</label> : null}
      <button type="submit" disabled={busy || blocked || !props.service || !query.trim()}>{ja ? "送信" : "Send"}</button>
      {busy ? <button type="button" onClick={() => { cancel(); setMessage(ja ? "中止しました" : "Cancelled"); }}>{ja ? "中止" : "Cancel"}</button> : null}
    </form>
    {!props.service ? <p>{ja ? "サービスは接続されていません" : "Service is not connected."}</p> : null}
    {busy ? <p role="status">{ja ? "確認しています" : "Working…"}</p> : null}
    {result ? <div className="oe-notes-assistance-result"><p>{result.text}</p>{result.hits?.map(hit => <article key={hit.id}><button type="button" disabled={blocked || !props.onOpen} onClick={() => { if (openerFlight.current || blocked || !props.onOpen) return; openerFlight.current = true; void props.onOpen(hit.target).then(opened => { if (!opened) setMessage(ja ? "入力と保存状態を確認してください" : "Check edits and save state."); }).catch(() => setMessage(ja ? "開けませんでした" : "Could not open.")).finally(() => { openerFlight.current = false; }); }}>{hit.title}</button>{hit.excerpt ? <p>{hit.excerpt}</p> : null}</article>)}</div> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
