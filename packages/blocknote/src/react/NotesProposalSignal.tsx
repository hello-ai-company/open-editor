import { useRef, useState, type ReactNode } from "react";
import { NotesFeedbackControl } from "./NotesFeedback.js";
import { NotesFloatingSurface } from "./NotesFloatingSurface.js";
import { notesIsComposing } from "./notesWorkspacePanels.js";

/** Keep a host proposal mounted, but reveal its review UI only on an explicit action. */
export function NotesProposalSignal({ children }: { children: ReactNode }) {
  const owner = useRef<HTMLSpanElement>(null), button = useRef<HTMLButtonElement>(null), panel = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => { setOpen(false); button.current?.focus({ preventScroll: true }); };
  return <><span ref={owner} hidden />
    <NotesFeedbackControl id="agent-proposal"><button ref={button} type="button" className="oe-notes-ambient-action" aria-expanded={open} onClick={() => { setOpen(value => !value); if (!open) requestAnimationFrame(() => panel.current?.focus({ preventScroll: true })); }}>エージェントの提案</button></NotesFeedbackControl>
    <NotesFloatingSurface ownerRef={owner} placement="panel" version={open} className="oe-notes-floating-proposal"><section ref={panel} hidden={!open} className="oe-notes-proposal-review" tabIndex={-1} aria-label="エージェントの提案を確認" onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event)) { event.preventDefault(); event.stopPropagation(); close(); } }}><header><strong>エージェントの提案</strong><button type="button" aria-label="提案を閉じる" onClick={close}>×</button></header>{children}</section></NotesFloatingSurface>
  </>;
}
