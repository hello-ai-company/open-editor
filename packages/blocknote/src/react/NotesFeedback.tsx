import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { NotesFloatingSurface } from "./NotesFloatingSurface.js";
import type { NotesWorkspaceState } from "../notes/contracts.js";

export type NotesFeedbackTone = "success" | "notice" | "error";
/** Host/workspace messages share the pane's dock with document recovery and backup. */
export type NotesFeedbackMessage = { text: string; tone: NotesFeedbackTone; persistent?: boolean };
type Notice = { id: number; text: string; tone: NotesFeedbackTone };
type Feedback = { announce(text: string, tone?: NotesFeedbackTone): void; register(key: string, control: ReactNode): () => void };
const Context = createContext<Feedback | undefined>(undefined);
export const useNotesFeedback = () => useContext(Context);

/** One transient message per pane. Recovery/actions stay controlled and never expire. */
export function NotesFeedbackProvider({ ownerRef, identity, persistent, message, inputRect, children }: {
  ownerRef: RefObject<HTMLElement | null>; identity: string; persistent?: ReactNode; message?: NotesFeedbackMessage; inputRect?(): import("./NotesFloatingSurface.js").NotesFloatingRect | undefined; children: ReactNode;
}) {
  const [notice, setNotice] = useState<Notice>(), [leaving, setLeaving] = useState(false), [controls, setControls] = useState(new Map<string, ReactNode>());
  const serial = useRef(0);
  const announce = useCallback((text: string, tone: NotesFeedbackTone = "notice") => {
    if (!text) return;
    setLeaving(false); const next = { id: ++serial.current, text, tone };
    setNotice(old => old?.tone === "error" && tone !== "error" ? old : next);
  }, []);
  const register = useCallback((key: string, control: ReactNode) => {
    setControls(old => { const next = new Map(old); next.set(key, control); return next; });
    return () => setControls(old => { const next = new Map(old); if (next.get(key) === control) next.delete(key); return next; });
  }, []);
  const value = useMemo(() => ({ announce, register }), [announce, register]);
  useLayoutEffect(() => { setNotice(undefined); setControls(new Map()); }, [identity]);
  useEffect(() => {
    if (message?.text && !message.persistent) announce(message.text, message.tone);
  }, [identity, message?.text, message?.tone, message?.persistent, announce]);
  useEffect(() => {
    if (!notice || notice.tone === "error") return;
    const fade = setTimeout(() => setLeaving(true), 2800), clear = setTimeout(() => setNotice(old => old?.id === notice.id ? undefined : old), 3000);
    return () => { clearTimeout(fade); clearTimeout(clear); };
  }, [notice]);
  const retainedMessage = message?.persistent && message.text ? message : undefined;
  return <Context.Provider value={value}>{children}
    {(persistent || retainedMessage || notice || controls.size > 0) ? <NotesFloatingSurface ownerRef={ownerRef} selectionRect={inputRect} version={`${notice?.id}:${controls.size}:${Boolean(persistent)}:${retainedMessage?.text}`} className="oe-notes-feedback-dock">
      {persistent}
      {retainedMessage ? <div role={retainedMessage.tone === "error" ? "alert" : "status"} aria-live={retainedMessage.tone === "error" ? "assertive" : "polite"} aria-atomic="true" className="oe-notes-feedback-recovery" data-source="workspace" data-tone={retainedMessage.tone}>{retainedMessage.text}</div> : null}
      {notice && ((!persistent && !retainedMessage) || notice.tone === "error") ? <div key={notice.id} role={notice.tone === "error" ? "alert" : "status"} aria-live={notice.tone === "error" ? "assertive" : "polite"} aria-atomic="true" className="oe-notes-feedback-toast" data-tone={notice.tone} data-leaving={leaving}>{notice.text}{notice.tone === "error" ? <button type="button" aria-label="通知を閉じる" onClick={() => setNotice(undefined)}>×</button> : null}</div> : null}
      {controls.size ? <div className="oe-notes-feedback-actions">{[...controls].map(([key, node]) => <span key={key}>{node}</span>)}</div> : null}
    </NotesFloatingSurface> : null}
  </Context.Provider>;
}

export function NotesFeedbackControl({ id, children }: { id: string; children: ReactNode }) {
  const feedback = useNotesFeedback();
  useEffect(() => feedback?.register(id, children), [feedback, id, children]);
  return feedback ? null : <div className="oe-notes-feedback-actions">{children}</div>;
}

export function NotesDocumentFeedback({ state, onBackup }: { state: NotesWorkspaceState; onBackup(): void }) {
  const feedback = useNotesFeedback(), previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (state.status !== "ready" || !state.lastPersistence || !state.snapshot) return;
    const key = JSON.stringify([state.snapshot.scope, state.snapshot.target, state.snapshot.revision, state.lastPersistence]);
    if (previous.current === key) return;
    previous.current = key;
    const queued = state.lastPersistence === "offline-queued";
    feedback?.announce(queued ? "同期待ちです" : "保存を確認しました", queued ? "notice" : "success");
  }, [feedback, state.status, state.lastPersistence, state.snapshot?.revision, state.snapshot?.scope, state.snapshot?.target]);
  return state.dirty || state.pendingEditors ? <NotesFeedbackControl id="draft-backup"><button type="button" className="oe-notes-ambient-action" title="未保存入力をこの端末へ書き出す" onClick={() => { onBackup(); feedback?.announce("退避ファイルを用意しました", "success"); }}>入力を退避</button></NotesFeedbackControl> : null;
}
