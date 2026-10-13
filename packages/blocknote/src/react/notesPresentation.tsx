import { DOCUMENT_GRIP_DOTS } from "../document/controlGlyphs.js";
import { NotesPageIcon } from "./NotesPageIcon.js";
import type { ReactNode } from "react";
import type { NotesPageStyle, NotesWorkspaceController, NotesScope, NotesTarget } from "../notes/contracts.js";

export type NotesCoverPreset = { id: string; label: string; url: string; alt: string; style?: NotesPageStyle; layout?: "wide" | "portrait" | "postcard" | "cinematic" | "compact" | "edge" };
export type NotesCoverCatalogRequest = { scope: NotesScope; target: NotesTarget; revision: string; signal: AbortSignal };
/** Authorized, bounded references only. Upload/Unsplash authorization remains with the host. */
export type NotesCoverCatalog = { read(request: NotesCoverCatalogRequest): Promise<{ scope: NotesScope; target: NotesTarget; revision: string; items: readonly NotesCoverPreset[] }> };

/** Presentation keys are explicitly bound by the host. Binding never grants a capability. */
export type NotesPageAppearanceOptions = {
  fields?: { icon?: string; cover?: string; coverAlt?: string; coverLayout?: string; tags?: string; style?: string };
  coverCatalog?: NotesCoverCatalog;
  renderCoverControl?(context: { controller: NotesWorkspaceController; editable: boolean; cover: string | undefined }): ReactNode;
};
export const NOTES_PAGE_STYLES: readonly NotesPageStyle[] = ["clean", "editorial", "journal", "mono", "compact", "midnight", "paperback", "postcard", "studio", "blueprint", "gallery", "minimal"];
export function notesMetadataField(value: string | undefined): string | undefined {
  return value && /^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(value) && !["constructor", "prototype", "__proto__"].includes(value) ? value : undefined;
}
/** A single Lucide stroke family for Notes controls and page icons. */
const UI_ICONS: Record<string, string> = {
  ai: "sparkles", comment: "message-circle", refresh: "refresh-cw", filter: "list-filter", plus: "plus", close: "x", chevron: "chevron-right", pages: "folder-open", document: "file-text", library: "library", insert: "panels-top-left", style: "palette", info: "info", focus: "maximize", star: "star", trash: "trash-2", text: "type", link: "link", image: "image", table: "table-2", code: "code-2", minus: "minus", check: "check", canvas: "panels-top-left", present: "monitor-play", site: "globe",
  select: "mouse-pointer-2", pen: "pen-tool", highlighter: "highlighter", eraser: "eraser", line: "minus", rectangle: "square", ellipse: "circle", undo: "undo-2", redo: "redo-2", export: "download", duplicate: "copy", hidden: "eye-off", visible: "eye", lock: "lock", unlock: "lock-open",
  page: "file-text", card: "sticky-note", attachment: "paperclip", video: "video", audio: "headphones", pdf: "file-text", unsplash: "image", equation: "sigma", mermaid: "network", whiteboard: "square-pen", htmlEmbed: "code-2", syncedBlock: "copy", collection: "database", gallery: "images", kanban: "columns-3", columns: "columns-2", divider: "separator-horizontal", pageBreak: "file-minus-2", tableInsert: "table-2",
  heading: "heading", quote: "quote", bullet: "list", numbered: "list-ordered", checklist: "list-todo", callout: "message-circle", alignLeft: "align-left", alignCenter: "align-center", alignRight: "align-right", indent: "indent-increase", outdent: "indent-decrease", fontSans: "type", fontSerif: "baseline", fontMono: "code-2", textSmall: "a-large-small", textLarge: "a-large-small", clearFormatting: "remove-formatting", moveUp: "arrow-up", moveDown: "arrow-down", moveTop: "arrow-up-to-line", moveBottom: "arrow-down-to-line"
};
const uiIconElements = new Map<string, ReactNode>();
export function NotesIcon({ name }: { name: string }) {
  if (name === "grip" || name === "more") {
    const dots = name === "grip" ? DOCUMENT_GRIP_DOTS : [[5, 12], [12, 12], [19, 12]];
    return <svg aria-hidden="true" focusable="false" pointerEvents="none" data-oe-control-icon={name} width={name === "grip" ? 24 : 22} height={name === "grip" ? 24 : 22} viewBox="0 0 24 24" fill="currentColor">{dots.map(([cx, cy], index) => <circle key={index} cx={cx} cy={cy} r={name === "grip" ? 2 : 1.8} />)}</svg>;
  }
  const id = UI_ICONS[name] ?? "file-text";
  let element = uiIconElements.get(id);
  if (!element) {
    element = <NotesPageIcon value={`lucide:${id}`} size={18} />;
    uiIconElements.set(id, element);
  }
  return element;
}
