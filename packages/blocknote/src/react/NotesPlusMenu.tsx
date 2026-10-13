import { useRef, useState } from "react";
import { notesInsertionCommands } from "./NotesInsertionCommands.js";
import { NotesOverlayPortal } from "./NotesOverlayPortal.js";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";
import { NotesIcon } from "./notesPresentation.js";
import type { NotesEditorBridge, NotesInsertKind } from "./notesWorkspacePanels.js";
/** Non-text blocks have no slash query caret. Their + keeps an explicit scoped anchor. */
export function NotesPlusMenu({ bridge, language, anchor, choose, cancel }: { bridge: NotesEditorBridge; language: "ja" | "en"; anchor: HTMLElement | null; choose(kind: NotesInsertKind): void; cancel(): void }) {
  const root = useRef<HTMLDivElement>(null), [query, setQuery] = useState(""); useDialogFocusTrap(true, root);
  const items = notesInsertionCommands(bridge, language).filter(item => item.aliases.some(alias => alias.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  return <NotesOverlayPortal anchor={anchor} onDismiss={cancel}><div ref={root} className="oe-notes-table-picker oe-notes-plus-menu" data-notes-plus-menu role="dialog" aria-modal="true" aria-label={language === "ja" ? "ブロックを挿入" : "Insert block"} tabIndex={-1} onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); event.stopPropagation(); cancel(); } }}>
    <header><strong>{language === "ja" ? "ブロックを挿入" : "Insert block"}</strong><button type="button" onClick={cancel}>{language === "ja" ? "閉じる" : "Close"}</button></header>
    <input type="search" aria-label={language === "ja" ? "挿入するブロックを検索" : "Search insert commands"} value={query} onChange={event => setQuery(event.target.value)} />
    <div className="oe-notes-plus-commands">{items.map(item => <button type="button" key={item.kind} data-notes-insert-kind={item.kind} disabled={!bridge.editable || bridge.composing || bridge.commandsAvailable === false} onClick={() => choose(item.kind)}><NotesIcon name={item.kind} />{item.label}</button>)}</div>
  </div></NotesOverlayPortal>;
}
