import { useRef } from "react";
import { NotesOverlayPortal } from "./NotesOverlayPortal.js";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";
import type { NotesInsertOptions } from "./notesWorkspacePanels.js";
export function NotesInsertChoiceDialog({ kind, anchor, editable, choose, cancel }: { kind: "htmlEmbed" | "tableInsert"; anchor: HTMLElement | null; editable: boolean; choose(options: NotesInsertOptions): void; cancel(): void }) {
  const root = useRef<HTMLDivElement>(null); useDialogFocusTrap(true, root);
  return <NotesOverlayPortal anchor={anchor} onDismiss={cancel}><div className="oe-notes-table-picker" role="dialog" aria-modal="true" aria-label={kind === "htmlEmbed" ? "HTML ウィジェットの初期表示" : "表のサイズ"} tabIndex={-1} ref={root} onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); cancel(); } }}>
    <header><strong>{kind === "htmlEmbed" ? "HTML ウィジェット" : "表のサイズ"}</strong><button type="button" onClick={cancel}>キャンセル</button></header>
    {kind === "htmlEmbed" ? <><p>組込みデザインは挿入後に編集できます</p><button type="button" disabled={!editable} onClick={() => choose({ html: { empty: false } })}>デザイン付きで挿入</button><button type="button" disabled={!editable} onClick={() => choose({ html: { empty: true } })}>空で挿入</button></> : <div className="oe-notes-table-grid">{Array.from({ length: 25 }, (_, index) => { const rows = Math.floor(index / 5) + 1, columns = index % 5 + 1; return <button type="button" key={index} aria-label={`${rows}行 ${columns}列の表を挿入`} disabled={!editable} onClick={() => choose({ table: { rows, columns } })}>{rows}×{columns}</button>; })}</div>}
  </div></NotesOverlayPortal>;
}
