import { useRef, useState, type ReactNode } from "react";

/** Presentation only: a host/session must validate all permissions, revisions and receipts.
 * A visible proposal never grants permission to write or enables a provider. */
export type NotesProposalRailProps = {
  status: "off" | "idle" | "preparing" | "review" | "saving" | "unknown" | "blocked";
  title?: string; summary?: string; details?: ReactNode; notice?: string;
  composing?: boolean; pending?: boolean; canUndo?: boolean; canApprove?: boolean;
  onEnable?(): void | Promise<void>; onApprove?(): void | Promise<void>;
  onReject?(): void | Promise<void>; onUndo?(): void | Promise<void>;
  onStop?(): void | Promise<void>; onReconcile?(): void | Promise<void>;
};
export function NotesProposalRail(props: NotesProposalRailProps) {
  const flight = useRef(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const run = async (action: NotesProposalRailProps["onApprove"]) => {
    if (!action || flight.current || props.pending || props.composing) return;
    flight.current = true; setBusy(true); setError("");
    try { await action(); } catch { setError("操作を確認できませんでした。入力は保持されています"); }
    finally { flight.current = false; setBusy(false); }
  };
  const disabled = busy || props.pending || props.composing;
  return <aside className="oe-notes-proposal-rail" aria-label="編集の提案">
    <header><strong>そっと整える</strong>{props.onStop ? <button type="button" disabled={disabled} onClick={() => void run(props.onStop)}>一時停止</button> : null}</header>
    <p role="status">{props.notice ?? (props.status === "off" ? "提案はオフです" : props.status === "preparing" ? "一区切りで提案を準備しています" : props.status === "unknown" ? "保存結果は未確認です" : "自分の言葉で書く時間を優先します")}</p>
    {props.status === "review" ? <><h3>{props.title ?? "小さな編集案"}</h3><p>{props.summary}</p>{props.details ? <details><summary>変更の内訳</summary>{props.details}</details> : null}<button type="button" disabled={disabled || !props.canApprove || !props.onApprove} onClick={() => void run(props.onApprove)}>採用する</button><button type="button" disabled={disabled || !props.onReject} onClick={() => void run(props.onReject)}>見送る</button></> : null}
    {props.status === "unknown" ? <button type="button" disabled={disabled || !props.onReconcile} onClick={() => void run(props.onReconcile)}>保存結果を照会</button> : null}
    {props.canUndo ? <button type="button" disabled={disabled || !props.onUndo} onClick={() => void run(props.onUndo)}>原文へ戻す</button> : null}
    {props.status === "off" && props.onEnable ? <button type="button" disabled={disabled} onClick={() => void run(props.onEnable)}>提案をオンにする</button> : null}
    {error ? <p role="alert">{error}</p> : null}
  </aside>;
}
