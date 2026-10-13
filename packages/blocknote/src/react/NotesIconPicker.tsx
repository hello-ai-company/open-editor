import { useRef, useState } from "react";
import { NOTES_LUCIDE_ICONS } from "./notesLucideIcons.js";
import { NotesPageIcon } from "./NotesPageIcon.js";
import { NotesOverlayPortal } from "./NotesOverlayPortal.js";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";
import { notesIsComposing } from "./notesWorkspacePanels.js";

const categories = { all: ["すべて", "All"], documents: ["文書", "Documents"], work: ["仕事", "Work"], technology: ["技術", "Technology"], life: ["生活", "Life"], nature: ["自然", "Nature"], travel: ["旅行", "Travel"], symbols: ["記号", "Symbols"], emoji: ["絵文字", "Emoji"] } as const;
const emojis = ["📄", "📚", "💡", "⭐", "✅", "🎯", "📝", "📅", "📌", "🚀", "🎨", "💻", "🏠", "🌱", "☀️", "☕", "🎵", "🎁", "🌍", "✈️", "🧭", "❤️", "🔬", "🗂️"];
export function NotesIconPicker(props: { anchor: HTMLButtonElement | null; value: string; editable: boolean; ja: boolean; onChoose(value: string): void; onClose(): void }) {
  const root = useRef<HTMLDivElement>(null), [query, setQuery] = useState(""), [category, setCategory] = useState<keyof typeof categories>("all");
  useDialogFocusTrap(true, root);
  const items = [...NOTES_LUCIDE_ICONS.filter(icon => icon.category !== "interface").map(icon => ({ value: `lucide:${icon.id}`, label: icon.label, keywords: icon.keywords, category: icon.category })), ...emojis.map(value => ({ value, label: value, keywords: "emoji 絵文字", category: "emoji" }))].filter(icon => (category === "all" || icon.category === category) && `${icon.label} ${icon.keywords}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <NotesOverlayPortal anchor={props.anchor} onDismiss={props.onClose}><div ref={root} tabIndex={-1} className="oe-notes-icon-picker-dialog" role="dialog" aria-modal="true" aria-label={props.ja ? "ページアイコンを選択" : "Choose page icon"} onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event)) { event.preventDefault(); event.stopPropagation(); props.onClose(); } }}>
    <header><strong>{props.ja ? "ページアイコン" : "Page icon"}</strong><button type="button" aria-label={props.ja ? "閉じる" : "Close"} onClick={props.onClose}>×</button></header>
    <input type="search" aria-label={props.ja ? "アイコンを検索" : "Search icons"} placeholder={props.ja ? "例: 本、仕事、star" : "Search: book, work, star"} value={query} onChange={event => setQuery(event.target.value)} />
    <select aria-label={props.ja ? "アイコンの分類" : "Icon category"} value={category} onChange={event => setCategory(event.target.value as keyof typeof categories)}>{Object.entries(categories).map(([key, labels]) => <option key={key} value={key}>{labels[props.ja ? 0 : 1]}</option>)}</select>
    <div className="oe-notes-icon-grid">{items.map(icon => <button type="button" key={icon.value} disabled={!props.editable} aria-label={icon.label} title={icon.label} aria-pressed={props.value === icon.value} onClick={() => props.onChoose(icon.value)}><NotesPageIcon value={icon.value} size={24} /></button>)}</div>
    {!items.length ? <p role="status">{props.ja ? "一致するアイコンがありません" : "No matching icons"}</p> : null}
    <footer><small>{items.length} {props.ja ? "件" : "icons"}</small><button type="button" disabled={!props.editable || !props.value} onClick={() => props.onChoose("")}>{props.ja ? "アイコンを削除" : "Remove icon"}</button></footer>
  </div></NotesOverlayPortal>;
}
