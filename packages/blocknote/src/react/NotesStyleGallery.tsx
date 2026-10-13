import { useEffect, useRef, useState } from "react";
import type { JsonValue } from "@hello-ai-company/editor-core";
import type { NotesWorkspaceController } from "../notes/contracts.js";
import { NotesOverlayPortal } from "./NotesOverlayPortal.js";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";
import { notesSafeAssetUrl } from "./NotesContentTools.js";
import { NOTES_PAGE_STYLES, notesMetadataField, type NotesCoverCatalog, type NotesCoverPreset, type NotesPageAppearanceOptions } from "./notesPresentation.js";
import { notesIsComposing, notesPanelIdentity, notesTargetKey, NotesPanelStatus, useLocalNotesDraft, useNotesController, useNotesPanelCommands } from "./notesWorkspacePanels.js";

type GalleryDraft = { baseRevision: string; command: { kind: "metadata.patch"; fields: Record<string, JsonValue> }; source: string; mapping: string; catalog: string; style: string; cover: string; alt: string; layout: string };
const label = (style: string) => style.charAt(0).toUpperCase() + style.slice(1);
function validCovers(items: readonly NotesCoverPreset[]): boolean {
  const ids = new Set<string>();
  return Array.isArray(items) && items.length <= 100 && items.every(item => {
    if (!item || typeof item.id !== "string" || !item.id || item.id.length > 128 || ids.has(item.id)) return false;
    ids.add(item.id);
    return typeof item.label === "string" && item.label.length > 0 && item.label.length <= 200 && typeof item.alt === "string" && item.alt.length <= 1000 && typeof item.url === "string" && item.url.length <= 4096 && !!notesSafeAssetUrl(item.url) && (!item.style || NOTES_PAGE_STYLES.includes(item.style)) && (!item.layout || ["wide", "portrait", "postcard", "cinematic", "compact", "edge"].includes(item.layout));
  });
}
export function NotesStyleGalleryButton(props: { controller: NotesWorkspaceController; appearance?: NotesPageAppearanceOptions; language: "ja" | "en"; coverOnly?: boolean }) {
  const state = useNotesController(props.controller);
  return <GalleryButton key={notesPanelIdentity(props.controller, state.snapshot)} {...props} />;
}
function GalleryButton({ controller, appearance, language, coverOnly }: Parameters<typeof NotesStyleGalleryButton>[0]) {
  const state = useNotesController(controller), [open, setOpen] = useState(false), opener = useRef<HTMLButtonElement>(null);
  const own = useLocalNotesDraft<GalleryDraft>(controller, "oe.page.design"), ja = language === "ja";
  const canOpen = !!state.snapshot;
  return <><button ref={opener} type="button" className={coverOnly ? "oe-notes-cover-picker-trigger" : "oe-notes-style-gallery-trigger"} disabled={!canOpen} aria-expanded={open} onClick={() => setOpen(true)}>{coverOnly ? ja ? "カバー画像を変更" : "Change cover image" : ja ? "書式とカバーを変更" : "Change style + cover"}{own.value ? " •" : ""}</button>{open ? <Gallery controller={controller} appearance={appearance} language={language} anchor={opener.current} onClose={() => setOpen(false)} /> : null}</>;
}
function Gallery({ controller, appearance, language, anchor, onClose }: { controller: NotesWorkspaceController; appearance?: NotesPageAppearanceOptions; language: "ja" | "en"; anchor: HTMLElement | null; onClose(): void }) {
  const ops = useNotesPanelCommands(controller), state = ops.state, snapshot = state.snapshot!, ja = language === "ja";
  const draft = useLocalNotesDraft<GalleryDraft>(controller, "oe.page.design");
  const root = useRef<HTMLDivElement>(null); useDialogFocusTrap(true, root);
  const [covers, setCovers] = useState<readonly NotesCoverPreset[]>([]), [catalog, setCatalog] = useState(""), [message, setMessage] = useState("");
  const [loadedService, setLoadedService] = useState<NotesCoverCatalog>();
  const [loadedSource, setLoadedSource] = useState("");
  const styleKey = notesMetadataField(appearance?.fields?.style), coverKey = notesMetadataField(appearance?.fields?.cover), altKey = notesMetadataField(appearance?.fields?.coverAlt), layoutKey = notesMetadataField(appearance?.fields?.coverLayout);
  const mapping = JSON.stringify([styleKey, coverKey, altKey, layoutKey]), source = JSON.stringify([snapshot.scope, snapshot.target, snapshot.revision, snapshot.document, snapshot.metadata]);
  const activeCovers = loadedService === appearance?.coverCatalog && loadedSource === source ? covers : [];
  const keys = [styleKey, coverKey, altKey, layoutKey].filter((key): key is string => Boolean(key)), unique = new Set(keys).size === keys.length;
  const retained = draft.value;
  const valid = !retained || typeof retained === "object" && typeof retained.baseRevision === "string" && typeof retained.source === "string" && typeof retained.mapping === "string" && typeof retained.catalog === "string" && [retained.style, retained.cover, retained.alt, retained.layout].every(value => typeof value === "string") && retained.command?.kind === "metadata.patch" && !!retained.command.fields && typeof retained.command.fields === "object" && !Array.isArray(retained.command.fields) && Object.keys(retained.command.fields).length > 0 && Object.entries(retained.command.fields).every(([key, value]) => keys.includes(key) && typeof value === "string" && value === (key === styleKey ? retained.style : key === coverKey ? retained.cover : key === altKey ? retained.alt : retained.layout));
  const readString = (key?: string) => key && typeof snapshot.metadata[key] === "string" ? snapshot.metadata[key] as string : "";
  const selected = valid && retained ? retained : { style: readString(styleKey) || "clean", cover: readString(coverKey), alt: readString(altKey), layout: readString(layoutKey) || "wide" };
  const patch = valid && retained ? retained.command.fields : {}, selectedCover = activeCovers.find(item => item.url === selected.cover);
  const previewCover = selected.cover === readString(coverKey) || selectedCover ? selected.cover : "";
  const valuesValid = (!styleKey || !Object.hasOwn(patch, styleKey) || NOTES_PAGE_STYLES.includes(patch[styleKey] as never)) && (!layoutKey || !Object.hasOwn(patch, layoutKey) || ["wide", "portrait", "postcard", "cinematic", "compact", "edge"].includes(patch[layoutKey] as string)) && (!altKey || !Object.hasOwn(patch, altKey) || (patch[altKey] as string).length <= 1000) && (!coverKey || !Object.hasOwn(patch, coverKey) || !patch[coverKey] || (patch[coverKey] as string).length <= 4096 && notesSafeAssetUrl(patch[coverKey] as string) && !!retained?.catalog && !!selectedCover && selectedCover.url === patch[coverKey]);
  const current = unique && valid && valuesValid && (!retained || retained.baseRevision === snapshot.revision && retained.source === source && retained.mapping === mapping && (!retained.catalog || loadedService === appearance?.coverCatalog && retained.catalog === catalog));
  const otherInput = Object.keys(state.localDrafts).some(key => key !== draft.id);
  const editable = !state.recovery && !state.manualSaveRequired && !otherInput && ops.available("metadata.patch", draft.id) && current;
  useEffect(() => {
    const abort = new AbortController(); setCovers([]); setCatalog(""); setLoadedService(undefined); setLoadedSource(""); setMessage("");
    const service = appearance?.coverCatalog;
    if (!service) return () => abort.abort();
    void Promise.resolve().then(() => service.read({ scope: snapshot.scope, target: snapshot.target, revision: snapshot.revision, signal: abort.signal })).then(result => {
      if (abort.signal.aborted) return;
      if (result.scope.actorId !== snapshot.scope.actorId || result.scope.workspaceId !== snapshot.scope.workspaceId || notesTargetKey(result.target) !== notesTargetKey(snapshot.target) || result.revision !== snapshot.revision || !validCovers(result.items)) throw new Error("Invalid catalog");
      setCovers(result.items); setCatalog(JSON.stringify(result.items)); setLoadedService(service); setLoadedSource(source);
    }).catch(() => { if (!abort.signal.aborted) setMessage(ja ? "カバー一覧を確認できませんでした" : "Could not verify the cover catalog"); });
    return () => abort.abort();
  }, [appearance?.coverCatalog, snapshot.revision, controller, source, ja]);
  const stage = (change: Partial<Pick<GalleryDraft, "style" | "cover" | "alt" | "layout">>, fromCatalog = false) => {
    if (!editable) return;
    if (!styleKey) delete change.style;
    const next = { ...selected, ...change }, fields: Record<string, JsonValue> = { ...(draft.value?.command.fields ?? {}) };
    if (change.style !== undefined && styleKey) fields[styleKey] = change.style;
    if (change.cover !== undefined && coverKey) fields[coverKey] = change.cover;
    if (change.alt !== undefined && altKey) fields[altKey] = change.alt;
    if (change.layout !== undefined && layoutKey) fields[layoutKey] = change.layout;
    if (!Object.keys(fields).length) return;
    if (!draft.compareSet({ ...next, baseRevision: draft.value?.baseRevision ?? snapshot.revision, source: draft.value?.source ?? source, mapping, catalog: fromCatalog ? catalog : draft.value?.catalog ?? "", command: { kind: "metadata.patch", fields } })) setMessage(ja ? "新しい入力を保持しています" : "Newer input is retained");
  };
  return <NotesOverlayPortal anchor={anchor} onDismiss={onClose}><div className="oe-notes-design-gallery" role="dialog" aria-modal="true" aria-label={ja ? "ページ書式ギャラリー" : "Page design gallery"} ref={root} tabIndex={-1} onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event)) { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <header><div><small>PAGE DESIGN</small><h2>{ja ? "ページ書式とカバー" : "Page style + cover"}</h2></div><button type="button" onClick={onClose}>{ja ? "閉じる" : "Close"}</button></header>
    <section className="oe-notes-design-hero" data-style={selected.style} data-layout={selected.layout}><div className="oe-notes-design-media">{notesSafeAssetUrl(previewCover) ? <img src={previewCover} alt={selected.alt} referrerPolicy="no-referrer" /> : <span>Aa</span>}</div><div><small>{label(selected.style)}</small><h3>{snapshot.title}</h3><p>{ja ? "適用するまで原文は変わりません" : "Review the design before applying"}</p><i /><i /><i /></div></section>
    <div className="oe-notes-design-grid" aria-label={ja ? "ページ書式" : "Page styles"}>{NOTES_PAGE_STYLES.map(style => <button type="button" className="oe-notes-design-card" data-style={style} key={style} aria-label={label(style)} aria-pressed={selected.style === style} disabled={!styleKey || !editable} onClick={() => stage({ style })}><span className="oe-notes-design-book"><strong>Aa</strong><small>{label(style)}</small><i /><i /></span><span>{label(style)}</span></button>)}</div>
    <section className="oe-notes-cover-catalog"><h3>{ja ? "カバー" : "Covers"}</h3>{activeCovers.length ? <div>{activeCovers.map(cover => <button type="button" key={cover.id} aria-label={cover.label} aria-pressed={selected.cover === cover.url} disabled={!coverKey || !editable} onClick={() => stage({ cover: cover.url, alt: cover.alt, layout: cover.layout ?? "wide", ...(cover.style ? { style: cover.style } : {}) }, true)}><img src={cover.url} alt={cover.alt} referrerPolicy="no-referrer" /><span>{cover.label}</span></button>)}</div> : <p>{ja ? "ホストが許可したカバー一覧を接続してください" : "Connect an authorized host cover catalog"}</p>}<button type="button" disabled={!coverKey || !editable || !selected.cover} onClick={() => stage({ cover: "", alt: "", layout: "wide" })}>{ja ? "カバーを削除" : "Remove cover"}</button>{appearance?.renderCoverControl?.({ controller, editable: Boolean(coverKey && editable && !draft.value), cover: previewCover || undefined })}</section>
    {!current ? <p role="status">{ja ? "元データまたは一覧が変わりました。入力を保持しています" : "The source or catalog changed. Your input is retained."}</p> : null}
    <footer><button type="button" disabled={ops.busy || state.composing} onClick={() => { if (draft.compareSet(undefined)) onClose(); else setMessage(ja ? "新しい入力を保持しています" : "Newer input is retained"); }}>{ja ? "キャンセル" : "Cancel"}</button><button type="button" disabled={!draft.value || !editable} onClick={async () => { if (draft.value && draft.isCurrent() && await ops.execute(draft.value.command, { localDraftId: draft.id })) onClose(); }}>{ja ? "確認して適用" : "Apply reviewed design"}</button></footer><NotesPanelStatus controller={controller} message={message || ops.message} />
  </div></NotesOverlayPortal>;
}
