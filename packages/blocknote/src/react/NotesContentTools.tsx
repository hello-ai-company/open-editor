import { useEffect, useId, useRef, useState } from "react";
import { deserializeEditorDocument, isEditorDocument, serializeEditorDocument, type EditorAsset, type EditorDocument, type EditorUploadFile, type ImageSearchResult } from "@hello-ai-company/editor-core";
import type { NotesPanelSnapshot, NotesScope, NotesTarget, NotesTemplateRecord, NotesWorkspaceController } from "../notes/contracts.js";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";
import { textFromBlock } from "../index/textFromBlock.js";
import { NotesPanelStatus, notesIsComposing, notesPanelIdentity, useNotesComposition, useNotesController, useNotesPanelCommands } from "./notesWorkspacePanels.js";

export type NotesContentFormat = "json" | "markdown" | "html";
export type NotesContentCodecs = {
  parse(format: NotesContentFormat, source: string, signal: AbortSignal): Promise<EditorDocument>;
  serialize(format: NotesContentFormat, document: EditorDocument, signal: AbortSignal): Promise<string>;
};
/** Account/workspace/row identities are explicit. Credentials remain inside the host closure.
 * Legacy AssetUploadScope(documentId/blockId) alone cannot safely identify a row or actor.
 */
export type NotesMediaScope = { scope: NotesScope; target: NotesTarget; blockId: string };
export type NotesScopedMediaHost = {
  upload?(file: EditorUploadFile, scope: NotesMediaScope, signal: AbortSignal): Promise<EditorAsset>;
  listCloud?(scope: NotesMediaScope, query: string, signal: AbortSignal): Promise<readonly EditorAsset[]>;
  searchImages?(scope: NotesMediaScope, query: string, page: number, signal: AbortSignal): Promise<{ results: readonly ImageSearchResult[]; hasMore: boolean }>;
  /** Converts a selected image result into an authorized, host-owned resource with a stable id. */
  acceptImage?(image: ImageSearchResult, scope: NotesMediaScope, signal: AbortSignal): Promise<EditorAsset>;
};
export type NotesContentToolsProps = {
  controller: NotesWorkspaceController;
  codecs?: NotesContentCodecs;
  panels?: NotesPanelSnapshot;
  onRefreshPanels?(): void;
  media?: NotesScopedMediaHost;
  mediaBlockId?: string;
  /** Successful local insertion publishes controller.setDraft and checks this scope/signal again. */
  onAssetAccepted?(asset: EditorAsset, scope: NotesMediaScope, signal: AbortSignal, presentation: "compact" | "card"): Promise<void>;
  /** Public editor composition callback; owns template id/reference adaptation for append. */
  prepareTemplateInsertion?(current: EditorDocument, template: NotesTemplateRecord, signal: AbortSignal): Promise<EditorDocument>;
  onExport?(filename: string, text: string, mimeType: string): void;
  maxImportBytes?: number;
  className?: string;
};
export function notesSafeAssetUrl(value: string): boolean {
  try { const url = new URL(value); return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password; } catch { return false; }
}
function identity(controller: NotesWorkspaceController): string {
  const state = controller.getState(), snapshot = state.snapshot;
  if (!snapshot) return "empty";
  return JSON.stringify([notesPanelIdentity(controller, snapshot), snapshot.revision, snapshot.contentRevision, serializeEditorDocument(state.draft ?? snapshot.document), state.draftTitle ?? snapshot.title]);
}
const FORMAT: Record<NotesContentFormat, { label: string; extension: string; mime: string }> = {
  json: { label: "JSON", extension: "json", mime: "application/json" }, markdown: { label: "Markdown", extension: "md", mime: "text/markdown" }, html: { label: "HTML", extension: "html", mime: "text/html" }
};
function ContentPreview({ document }: { document: EditorDocument }) {
  return <div className="oe-notes-content-preview" aria-label="反映する本文のプレビュー"><ol>{document.blocks.slice(0, 8).map(block => <li key={block.id}><small>{block.type}</small><p>{textFromBlock(block).slice(0, 400) || "(本文のないブロック)"}</p></li>)}</ol>{document.blocks.length > 8 ? <p>先頭の8ブロックを表示しています。反映時には全文を保持します。</p> : null}</div>;
}
export function NotesContentTools(props: NotesContentToolsProps) {
  const state = useNotesController(props.controller);
  return <ContentTools key={notesPanelIdentity(props.controller, state.snapshot)} {...props} />;
}
function ContentTools(props: NotesContentToolsProps) {
  const ops = useNotesPanelCommands(props.controller), uid = useId();
  const [tool, setTool] = useState<"import" | "export" | "templates" | "media" | null>(null), [format, setFormat] = useState<NotesContentFormat>("json");
  const [source, setSource] = useState(""), [candidate, setCandidate] = useState<EditorDocument | null>(null), [candidateBase, setCandidateBase] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [templateName, setTemplateName] = useState(""), [templateReview, setTemplateReview] = useState<{ template: NotesTemplateRecord; after: EditorDocument; base: string } | null>(null), [deleteTemplate, setDeleteTemplate] = useState<NotesTemplateRecord | null>(null);
  const [presentation, setPresentation] = useState<"compact" | "card">("card");
  const [mediaSource, setMediaSource] = useState<"local" | "cloud" | "images">("local"), [query, setQuery] = useState(""), [assets, setAssets] = useState<readonly EditorAsset[]>([]), [images, setImages] = useState<readonly ImageSearchResult[]>([]), [imagePage, setImagePage] = useState(1), [moreImages, setMoreImages] = useState(false), [pickedAsset, setPickedAsset] = useState<{ asset: EditorAsset; scope: NotesMediaScope; base: string } | null>(null);
  const dialog = useRef<HTMLDivElement>(null), file = useRef<HTMLInputElement>(null), mounted = useRef(true), pending = useRef<AbortController | null>(null), opener = useRef<HTMLButtonElement | null>(null), restoreFocus = useRef(false);
  const composition = useNotesComposition(props.controller, tool ?? "closed");
  useDialogFocusTrap(tool !== null, dialog);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; pending.current?.abort(); }; }, []);
  useEffect(() => { if (!tool && restoreFocus.current) { restoreFocus.current = false; opener.current?.focus(); } }, [tool]);
  const editing = !!ops.state.snapshot?.capabilities.includes("document.save") && !!ops.state.snapshot.capabilitySemantics["document.save"] && ops.state.status === "ready";
  const canEditNow = () => { const state = props.controller.getState(); return state.status === "ready" && !state.composing && !!state.snapshot?.capabilities.includes("document.save") && !!state.snapshot.capabilitySemantics["document.save"]; };
  const formats: NotesContentFormat[] = props.codecs ? ["json", "markdown", "html"] : ["json"];
  const begin = (next: NonNullable<typeof tool>, button: HTMLButtonElement) => { pending.current?.abort(); pending.current = null; setBusy(false); setMessage(""); setCandidate(null); setTemplateReview(null); setDeleteTemplate(null); setPickedAsset(null); setAssets([]); setImages([]); opener.current = button; if (next === "media") setMediaSource(props.media?.upload ? "local" : props.media?.listCloud ? "cloud" : "images"); setTool(next); };
  const refresh = () => { try { props.onRefreshPanels?.(); } catch { setMessage("保存済みです。表示を再読み込みしてください"); } };
  const cancel = () => { pending.current?.abort(); pending.current = null; setBusy(false); setMessage("操作を中断しました。入力と保存状態を確認してください"); };
  const close = () => { cancel(); setTool(null); restoreFocus.current = true; };
  const asyncWork = (work: (signal: AbortSignal) => Promise<void>) => {
    if (pending.current || busy) return;
    const abort = new AbortController(); pending.current = abort; setBusy(true); setMessage("");
    void Promise.resolve().then(() => work(abort.signal)).catch(() => { if (mounted.current && !abort.signal.aborted) setMessage("操作を完了できませんでした。元の文書と入力を保持しています"); }).finally(() => { if (pending.current === abort) { pending.current = null; if (mounted.current) setBusy(false); } });
  };
  const currentScope = (): NotesMediaScope | undefined => {
    const snapshot = props.controller.getState().snapshot;
    if (!snapshot || !props.mediaBlockId) return undefined;
    const find = (blocks: EditorDocument["blocks"]): boolean => blocks.some(block => block.id === props.mediaBlockId || block.children && find(block.children));
    if (!find((props.controller.getState().draft ?? snapshot.document).blocks)) return undefined;
    return { scope: { ...snapshot.scope }, target: { ...snapshot.target }, blockId: props.mediaBlockId };
  };
  const safePick = (asset: EditorAsset, scope: NotesMediaScope, base: string, signal: AbortSignal) => {
    if (signal.aborted || !mounted.current) return;
    if (!asset.attachmentId || !notesSafeAssetUrl(asset.url)) { setMessage("このメディアの保存先と安全なURLを確認できませんでした"); return; }
    setPickedAsset({ asset, scope, base });
  };
  const performMediaSearch = (page = 1) => {
    if (!query.trim() || !canEditNow()) return;
    const scope = currentScope(), base = identity(props.controller), requestedQuery = query.trim(), requestedSource = mediaSource;
    if (!scope) return;
    asyncWork(async signal => {
      if (requestedSource === "cloud" && props.media?.listCloud) { const results = await props.media.listCloud(scope, requestedQuery, signal); if (!signal.aborted && mounted.current) setAssets(results.filter(asset => notesSafeAssetUrl(asset.url))); }
      if (requestedSource === "images" && props.media?.searchImages) { const result = await props.media.searchImages(scope, requestedQuery, page, signal); if (!signal.aborted && mounted.current && identity(props.controller) === base) { setImages(result.results.filter(image => notesSafeAssetUrl(image.url))); setImagePage(page); setMoreImages(result.hasMore); } }
    });
  };
  const download = (text: string) => {
    const title = (ops.state.draftTitle ?? ops.state.snapshot?.title ?? "document").replace(/[\\/\u0000-\u001f]/g, "-").slice(0, 120) || "document", filename = `${title}.${FORMAT[format].extension}`;
    if (props.onExport) { props.onExport(filename, text, FORMAT[format].mime); return; }
    const url = URL.createObjectURL(new Blob([text], { type: FORMAT[format].mime })), anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return <section className={["oe-notes-content-tools", props.className].filter(Boolean).join(" ")} aria-label="文書と素材の操作">
    <div className="oe-notes-content-actions">{([["import", "読み込む"], ["export", "書き出す"], ["templates", "テンプレート"], ["media", "メディアを追加"]] as const).map(([id, label]) => <button type="button" key={id} disabled={ops.state.status !== "ready" || id === "import" && !editing || id === "media" && (!editing || !props.media || !currentScope())} onClick={event => begin(id, event.currentTarget)}>{label}</button>)}</div>
    {tool ? <div ref={dialog} className="oe-notes-content-dialog" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} tabIndex={-1} onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event) && !ops.busy) { event.preventDefault(); close(); } }}>
      <header><h3 id={`${uid}-title`}>{tool === "import" ? "文書を読み込む" : tool === "export" ? "文書を書き出す" : tool === "templates" ? "テンプレート" : "メディアを追加"}</h3><button type="button" disabled={ops.busy} onClick={close}>閉じる</button></header>
      {tool === "import" || tool === "export" ? <label>形式<select aria-label="文書の形式" value={format} disabled={busy} onChange={event => { setFormat(event.target.value as NotesContentFormat); setCandidate(null); setMessage(""); }}>{formats.map(value => <option value={value} key={value}>{FORMAT[value].label}</option>)}</select></label> : null}
      {tool === "import" ? <><p>内容を確認して本文に反映します。反映後に保存してください。</p><input ref={file} type="file" aria-label="読み込む文書ファイル" accept=".json,.md,.markdown,.html,.htm" disabled={busy} onChange={event => {
        const chosen = event.target.files?.[0]; event.target.value = ""; if (!chosen) return;
        if (chosen.size > (props.maxImportBytes ?? 8_000_000)) { setMessage("ファイルが読み込みサイズの上限を超えています。元のファイルは保持されています"); return; }
        asyncWork(async signal => { const text = await chosen.text(); if (!signal.aborted && mounted.current) { setSource(text); setCandidate(null); } });
      }} /><label>読み込む内容<textarea aria-label="読み込む文書の内容" value={source} disabled={busy} onChange={event => { setSource(event.target.value); setCandidate(null); }} {...composition} /></label><button type="button" disabled={busy || !source.trim() || ops.state.composing || !editing} onClick={() => {
        const base = identity(props.controller), selectedFormat = format, text = source;
        asyncWork(async signal => { const parsed = props.codecs ? await props.codecs.parse(selectedFormat, text, signal) : deserializeEditorDocument(text); if (!signal.aborted && mounted.current) { if (!isEditorDocument(parsed)) throw new Error("Invalid document"); setCandidate(structuredClone(parsed)); setCandidateBase(base); } });
      }}>内容を確認</button>{candidate ? <div className="oe-notes-content-review"><p>{candidate.blocks.length} ブロックで現在の本文を置き換えます</p><ContentPreview document={candidate} />{identity(props.controller) !== candidateBase ? <p role="status">文書が変更されました。読み込み内容を保持しています。もう一度確認してください</p> : null}<button type="button" disabled={!editing || busy || ops.state.composing || identity(props.controller) !== candidateBase} onClick={() => {
        if (identity(props.controller) !== candidateBase || !canEditNow()) return; try { props.controller.setDraft(structuredClone(candidate)); setCandidate(null); setMessage("読み込み内容を本文に反映しました。保存はまだ行っていません"); } catch { setMessage("本文を変更できませんでした。読み込み内容を保持しています"); }
      }}>確認して本文を置き換える</button><button type="button" onClick={() => setCandidate(null)}>反映をキャンセル</button></div> : null}</> : null}
      {tool === "export" ? <><p>現在の本文を書き出します</p><button type="button" disabled={busy || ops.state.composing} onClick={() => {
        const document = structuredClone(props.controller.getState().draft ?? props.controller.getState().snapshot!.document), selectedFormat = format;
        asyncWork(async signal => { const text = props.codecs ? await props.codecs.serialize(selectedFormat, document, signal) : serializeEditorDocument(document); if (!signal.aborted && mounted.current) { download(text); setMessage("文書を書き出しました"); } });
      }}>ファイルを書き出す</button></> : null}
      {tool === "templates" ? <><form onSubmit={event => { event.preventDefault(); if (!templateName.trim() || ops.state.composing || !ops.available("template.save")) return; void ops.execute({ kind: "template.save", templateId: crypto.randomUUID(), title: templateName.trim(), document: structuredClone(ops.state.snapshot!.document) }).then(ok => { if (ok && mounted.current) { setTemplateName(""); refresh(); } }); }}><label>テンプレート名<input aria-label="テンプレート名" value={templateName} disabled={ops.busy} onChange={event => setTemplateName(event.target.value)} {...composition} /></label><button type="submit" disabled={!templateName.trim() || !ops.available("template.save")}>現在の文書をテンプレートに保存</button></form>{props.panels?.templates ? <ul>{props.panels.templates.map(template => <li key={template.id}><strong>{template.title}</strong><button type="button" disabled={busy || !ops.available("template.apply") || !props.prepareTemplateInsertion} onClick={() => {
        const base = identity(props.controller), current = structuredClone(ops.state.snapshot!.document);
        asyncWork(async signal => { const after = await props.prepareTemplateInsertion!(current, template, signal); if (!signal.aborted && mounted.current) { if (!isEditorDocument(after)) throw new Error("Invalid template result"); setTemplateReview({ template: structuredClone(template), after: structuredClone(after), base }); } });
      }}>テンプレートを挿入</button><button type="button" disabled={!ops.available("template.apply") || busy} onClick={() => setTemplateReview({ template: structuredClone(template), after: structuredClone(template.document), base: identity(props.controller) })}>テンプレートで置き換える</button><button type="button" disabled={!ops.available("template.delete")} onClick={() => setDeleteTemplate(template)}>テンプレートを削除</button></li>)}</ul> : <p>テンプレート一覧がホストに接続されていません</p>}{templateReview ? <div><p>「{templateReview.template.title}」を反映すると本文は {templateReview.after.blocks.length} ブロックになります</p><ContentPreview document={templateReview.after} /><button type="button" disabled={!ops.available("template.apply") || identity(props.controller) !== templateReview.base || !props.panels?.templates?.some(item => item.id === templateReview.template.id && item.revision === templateReview.template.revision)} onClick={() => {
        if (identity(props.controller) !== templateReview.base) return; void ops.execute({ kind: "template.apply", templateId: templateReview.template.id, expectedTemplateRevision: templateReview.template.revision, afterDocument: templateReview.after }).then(ok => { if (ok && mounted.current) { setTemplateReview(null); refresh(); } });
      }}>確認してテンプレートを反映</button><button type="button" disabled={ops.busy} onClick={() => setTemplateReview(null)}>反映をキャンセル</button></div> : null}{deleteTemplate ? <div role="group" aria-label="テンプレート削除の確認"><p>「{deleteTemplate.title}」を削除しますか</p><button type="button" disabled={!ops.available("template.delete")} onClick={() => void ops.execute({ kind: "template.delete", templateId: deleteTemplate.id }).then(ok => { if (ok && mounted.current) { setDeleteTemplate(null); refresh(); } })}>確認してテンプレートを削除</button><button type="button" disabled={ops.busy} onClick={() => setDeleteTemplate(null)}>削除をキャンセル</button></div> : null}</> : null}
      {tool === "media" ? <><label>素材の場所<select aria-label="素材の場所" value={mediaSource} disabled={busy} onChange={event => { setMediaSource(event.target.value as typeof mediaSource); setAssets([]); setImages([]); setPickedAsset(null); setMoreImages(false); }}>{props.media?.upload ? <option value="local">この端末</option> : null}{props.media?.listCloud ? <option value="cloud">クラウド</option> : null}{props.media?.searchImages && props.media.acceptImage ? <option value="images">画像検索</option> : null}</select></label>{mediaSource === "local" ? <input type="file" aria-label="アップロードする素材" disabled={busy || !editing || ops.state.composing || !props.media?.upload} onChange={event => { const selected = event.target.files?.[0]; event.target.value = ""; const scope = currentScope(); if (!selected || !scope || !props.media?.upload || !canEditNow()) return; const base = identity(props.controller); asyncWork(async signal => { const asset = await props.media!.upload!(selected, scope, signal); safePick(asset, scope, base, signal); }); }} /> : <><label>素材を検索<input aria-label="素材の検索語" value={query} disabled={busy} onChange={event => { setQuery(event.target.value); setAssets([]); setImages([]); setPickedAsset(null); setMoreImages(false); setImagePage(1); }} {...composition} /></label><button type="button" disabled={busy || !editing || !query.trim() || ops.state.composing} onClick={() => performMediaSearch()}>素材を検索</button></>}
        <ul>{assets.map((asset, index) => <li key={`${asset.attachmentId ?? asset.url}:${index}`}><button type="button" disabled={busy || !editing || ops.state.composing} onClick={() => { const scope = currentScope(); if (scope) safePick(asset, scope, identity(props.controller), new AbortController().signal); }}>{asset.name}</button></li>)}{images.map(image => <li key={image.id}><button type="button" disabled={busy || !editing || ops.state.composing} onClick={() => { const scope = currentScope(); if (!scope || !props.media?.acceptImage) return; const base = identity(props.controller); asyncWork(async signal => { const asset = await props.media!.acceptImage!(image, scope, signal); safePick(asset, scope, base, signal); }); }}>{image.title}</button></li>)}</ul>{mediaSource === "images" && moreImages ? <button type="button" disabled={busy} onClick={() => performMediaSearch(imagePage + 1)}>次の画像</button> : null}
        {pickedAsset ? <div><p>{pickedAsset.asset.name}</p><p>{pickedAsset.asset.mimeType} {pickedAsset.asset.size ?? ""}</p><p>選択した素材を現在のブロックに追加します</p><label>表示形式<select aria-label="素材の表示形式" value={presentation} disabled={busy || ops.busy} onChange={event => setPresentation(event.target.value as "compact" | "card")}><option value="compact">コンパクト</option><option value="card">カード</option></select></label><button type="button" disabled={busy || !editing || ops.state.composing || identity(props.controller) !== pickedAsset.base || JSON.stringify(currentScope()) !== JSON.stringify(pickedAsset.scope) || !props.onAssetAccepted && !ops.available("media.attach")} onClick={() => {
          if (!canEditNow() || identity(props.controller) !== pickedAsset.base || !currentScope() || JSON.stringify(currentScope()) !== JSON.stringify(pickedAsset.scope)) return;
          if (props.onAssetAccepted) asyncWork(async signal => { await props.onAssetAccepted!(pickedAsset.asset, pickedAsset.scope, signal, presentation); if (!signal.aborted && mounted.current) { setPickedAsset(null); setMessage("素材を本文に反映しました。保存状態を確認してください"); } });
          else void ops.execute({ kind: "media.attach", blockId: pickedAsset.scope.blockId, assetId: pickedAsset.asset.attachmentId!, presentation }).then(ok => { if (ok && mounted.current) { setPickedAsset(null); refresh(); } });
        }}>確認して素材を追加</button><button type="button" disabled={ops.busy} onClick={() => setPickedAsset(null)}>追加をキャンセル</button></div> : null}
      </> : null}
      {busy ? <button type="button" onClick={cancel}>進行中の操作をキャンセル</button> : null}<NotesPanelStatus controller={props.controller} message={message || ops.message} />
    </div> : null}
  </section>;
}
