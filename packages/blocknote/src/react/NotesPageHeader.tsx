import { useNotesFeedback } from "./NotesFeedback.js";
import { useEffect, useRef, useState } from "react";
import { NotesPageIcon } from "./NotesPageIcon.js";
import { NotesIconPicker } from "./NotesIconPicker.js";
import type { NotesPageSummary, NotesWorkspaceController } from "../notes/contracts.js";
import { NotesPanelStatus, useLocalNotesDraft, useNotesComposition, useNotesPanelCommands } from "./notesWorkspacePanels.js";
import { NotesIcon, notesMetadataField, type NotesPageAppearanceOptions } from "./notesPresentation.js";
import { NotesStyleGalleryButton } from "./NotesStyleGallery.js";
import { notesSafeAssetUrl } from "./NotesContentTools.js";

export function NotesPageHeader(props: { controller: NotesWorkspaceController; appearance?: NotesPageAppearanceOptions; pages?: readonly NotesPageSummary[]; language: "ja" | "en"; onShowPages(): void; onOpen(pageId: string): Promise<boolean>; onFeedbackChange?(message: string): void }) {
  const ops = useNotesPanelCommands(props.controller), state = ops.state, snapshot = state.snapshot, ja = props.language === "ja";
  const feedback = useNotesFeedback();
  useEffect(() => { if (ops.message) feedback?.announce(ops.message, ops.messageTone); }, [feedback, ops.message, ops.messageTone]);
  const composition = useNotesComposition(props.controller);
  const [iconsOpen, setIconsOpen] = useState(false);
  const iconOpener = useRef<HTMLButtonElement>(null);
  useEffect(() => { props.onFeedbackChange?.(ops.message); return () => props.onFeedbackChange?.(""); }, [props.onFeedbackChange, ops.message]);
  const tagDraft = useLocalNotesDraft<{ baseRevision: string; command: { kind: "metadata.patch"; fields: { [key: string]: string[] } }; presentation: { text: string } }>(props.controller, "oe.header.tag");
  if (!snapshot) return null;
  const fields = props.appearance?.fields, iconKey = notesMetadataField(fields?.icon), tagsKey = notesMetadataField(fields?.tags), coverKey = notesMetadataField(fields?.cover);
  const icon = iconKey && typeof snapshot.metadata[iconKey] === "string" ? snapshot.metadata[iconKey] as string : "";
  const cover = coverKey && typeof snapshot.metadata[coverKey] === "string" ? snapshot.metadata[coverKey] as string : undefined;
  const altKey = notesMetadataField(fields?.coverAlt), layoutKey = notesMetadataField(fields?.coverLayout);
  const coverAlt = altKey && typeof snapshot.metadata[altKey] === "string" ? snapshot.metadata[altKey] as string : "";
  const coverLayout = layoutKey && typeof snapshot.metadata[layoutKey] === "string" ? snapshot.metadata[layoutKey] as string : "wide";
  const tagsValid = !tagsKey || snapshot.metadata[tagsKey] === undefined || Array.isArray(snapshot.metadata[tagsKey]) && (snapshot.metadata[tagsKey] as unknown[]).every(tag => typeof tag === "string");
  const tags = tagsKey && Array.isArray(snapshot.metadata[tagsKey]) ? (snapshot.metadata[tagsKey] as unknown[]).filter((tag): tag is string => typeof tag === "string") : [];
  const text = tagDraft.value?.presentation.text ?? "";
  const blocked = state.composing || state.status !== "ready" || ops.busy;
  const draftFields = tagDraft.value?.command.fields;
  const tagMappingCurrent = !!tagsKey && (!draftFields || Object.keys(draftFields).length === 1 && Object.hasOwn(draftFields, tagsKey));
  const editable = ops.available("metadata.patch"), tagEditable = tagMappingCurrent && tagsValid && ops.available("metadata.patch", tagDraft.id);
  const title = state.draftTitle ?? snapshot.title;
  const ancestors: NotesPageSummary[] = [], seen = new Set<string>();
  const target = snapshot.target;
  let parent = target.kind === "page" ? props.pages?.find(page => page.id === target.pageId)?.parentId : null;
  while (parent && !seen.has(parent)) { seen.add(parent); const page = props.pages?.find(item => item.id === parent && !item.deletedAt); if (!page) break; ancestors.unshift(page); parent = page.parentId; }
  const patch = async (key: string, value: string | string[]) => { if (await ops.execute({ kind: "metadata.patch", fields: { [key]: value } })) setIconsOpen(false); };
  const setTag = (value: string) => { if (!tagsKey || !tagsValid) return; tagDraft.set({ baseRevision: tagDraft.value?.baseRevision ?? snapshot.revision, command: { kind: "metadata.patch", fields: { [tagsKey]: [...new Set([...tags, value.trim()].filter(Boolean))] } }, presentation: { text: value } }); };
  return <>
    <div className="oe-notes-document-header oe-notes-page-meta">
      {cover && notesSafeAssetUrl(cover) ? <div className="oe-notes-page-cover" data-layout={coverLayout}><img src={cover} alt={coverAlt} referrerPolicy="no-referrer" /></div> : null}
      <nav className="oe-notes-breadcrumbs" aria-label={ja ? "ページの場所" : "Page location"}><button type="button" onClick={props.onShowPages}><NotesIcon name="pages" />{ja ? "ページ" : "Pages"}</button>{ancestors.map(page => <span key={page.id}><NotesIcon name="chevron" /><button type="button" disabled={blocked} onClick={() => void props.onOpen(page.id)}>{page.title}</button></span>)}<span><NotesIcon name="chevron" /><span>{title}</span></span></nav>
      <div className="oe-notes-title-editor"><button type="button" ref={iconOpener} className="oe-notes-title-icon" aria-label={ja ? "ページアイコンを追加" : "Add page icon"} aria-expanded={iconsOpen} disabled={!iconKey || !editable} onClick={() => setIconsOpen(value => !value)}><NotesPageIcon value={icon} fallback="＋" size={30} /></button><input aria-label={ja ? "タイトル" : "Page title"} value={title} disabled={blocked || !snapshot.capabilities.includes("document.save")} {...composition} onChange={event => props.controller.setDraft(state.draft ?? snapshot.document, event.target.value)} />
        {iconsOpen ? <NotesIconPicker anchor={iconOpener.current} value={icon} editable={editable} ja={ja} onClose={() => setIconsOpen(false)} onChoose={value => iconKey && void patch(iconKey, value)} /> : null}
      </div>
      <div className="oe-notes-meta-actions"><div className="oe-notes-cover-control">{props.appearance?.renderCoverControl?.({ controller: props.controller, editable: Boolean(coverKey && editable), cover }) ?? <NotesStyleGalleryButton controller={props.controller} appearance={props.appearance} language={props.language} coverOnly />}</div>
      <form className="oe-notes-tag-editor" onSubmit={event => { event.preventDefault(); if (tagEditable && text.trim() && tagDraft.value) void ops.execute(tagDraft.value.command, { localDraftId: tagDraft.id }); }}>
        <div className="oe-notes-tag-list">{tags.map((tag, index) => <span key={`${tag}:${index}`}>#{tag}<button type="button" disabled={!editable || !tagsKey || !tagsValid} aria-label={(ja ? "削除 " : "Remove ") + tag} onClick={() => tagsKey && void patch(tagsKey, tags.filter(value => value !== tag))}>×</button></span>)}</div>
        <input aria-label={ja ? "タグを追加" : "Add tag"} placeholder={ja ? "タグを追加..." : "Add tag..."} disabled={!tagsKey || !tagsValid || !ops.canEdit("metadata.patch")} value={text} {...composition} onChange={event => setTag(event.target.value)} /><button type="submit" aria-label={ja ? "タグを追加" : "Add tag"} disabled={!tagEditable || !text.trim()}><NotesIcon name="plus" /></button>
        {tagDraft.value ? <button type="button" disabled={ops.busy} onClick={() => tagDraft.set(undefined)}>{ja ? "キャンセル" : "Cancel"}</button> : null}
      </form></div>{!feedback && !props.onFeedbackChange && (ops.message || state.pendingEditors || state.status === "unknown" || state.status === "saving") ? <NotesPanelStatus controller={props.controller} message={ops.message} /> : null}
    </div>
  </>;
}
