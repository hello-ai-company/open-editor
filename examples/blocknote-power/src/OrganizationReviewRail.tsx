import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { OrganizationSnapshot, OrganizationState } from "@hello-ai-company/editor-ai";

export function OrganizationIcon({ name }: { name: "spark" | "close" | "arrow" | "settings" | "undo" | "check" | "edit" }) {
  const paths = { spark: "m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z", close: "m6 6 12 12M6 18 18 6", arrow: "m14 6-6 6 6 6", settings: "M4 7h16M4 17h16M9 4v6M15 14v6", undo: "M8 7H3v-5M3 7a8 8 0 1 1 0 10", check: "m5 12 4 4L19 6", edit: "m15 4 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14v6Z" };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

type Props = {
  state: OrganizationState; saved: OrganizationSnapshot; busy: boolean; writing: boolean; saveIssue?: string;
  onApprove(parentId?: string | null): void; onDismiss(): void; onUndo(): void;
  onEnable(): void; onSettings(): void; onReconcile(): void; onReconnect(): void; onStop(): void;
};
export function organizationDialogKeys(e: KeyboardEvent<HTMLDialogElement>) {
  if (e.key === "Escape" && (e.nativeEvent.isComposing || e.keyCode === 229)) { e.preventDefault(); e.stopPropagation(); return; }
  if (e.key !== "Tab") return;
  const buttons = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,a[href],[tabindex]:not([tabindex="-1"])')].filter(el => el.getClientRects().length);
  const first = buttons[0], last = buttons[buttons.length - 1], focused = document.activeElement;
  const target = !buttons.includes(focused as HTMLElement) ? (e.shiftKey ? last : first) : e.shiftKey && focused === first ? last : !e.shiftKey && focused === last ? first : undefined;
  if (target) { e.preventDefault(); target.focus({ preventScroll: true }); }
}
export function useOrganizationViewport() {
  const read = () => ({ width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight, left: window.visualViewport?.offsetLeft ?? 0, top: window.visualViewport?.offsetTop ?? 0 });
  const [viewport, setViewport] = useState(read);
  useEffect(() => { const update = () => { const next = read(); setViewport(old => Object.keys(next).every(k => next[k as keyof typeof next] === old[k as keyof typeof old]) ? old : next); }; window.addEventListener("resize", update); window.visualViewport?.addEventListener("resize", update); window.visualViewport?.addEventListener("scroll", update); return () => { window.removeEventListener("resize", update); window.visualViewport?.removeEventListener("resize", update); window.visualViewport?.removeEventListener("scroll", update); }; }, []);
  return viewport;
}
/** A permanent reserved desktop rail; a mobile sheet opens only by an explicit user action. */
export function OrganizationReviewRail(p: Props) {
  const viewport = useOrganizationViewport(), compact = viewport.width <= 1100 || viewport.height <= 560;
  const [open, setOpen] = useState(false), dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const hasProposal = p.state.status === "confirming" && !!p.state.plan;
  const enabled = p.saved.autoOrganize || p.saved.assistance?.proposalsAllowed || p.saved.assistance?.autoLinks;
  useEffect(() => { if (!compact && dialog.current?.open) dialog.current.close(); }, [compact]);
  useEffect(() => { const d = dialog.current, active = document.activeElement; if (d?.open && !d.contains(active) && !active?.closest("dialog") && !p.state.composing) d.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }); }, [p.state.status, open, p.state.composing]);
  const close = () => {
    if (hasProposal && !p.busy) p.onDismiss();
    dialog.current?.close();
  };
  const launch = () => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : trigger.current; setOpen(true); dialog.current?.showModal(); };
  const label = p.state.status === "unknown" ? "保存結果の確認が必要" : p.saveIssue ? "入力は保持・保存は未確認" : p.state.status === "applying" ? "保存を確認中" : hasProposal ? "確認できる提案があります" : p.writing || p.state.composing ? "書く時間を優先しています" : p.state.canUndo ? "原文を保って整えました" : enabled && p.state.status !== "off" ? "一区切りで、そっと提案" : "提案はオフです";
  const content = <>
    <div className="organization-rail-heading"><span className="organization-spark"><OrganizationIcon name="spark" /></span><div><strong>そっと整える</strong><span>合成提案 · 外部送信なし</span></div>{hasProposal || compact ? <button type="button" className="organization-icon-button" aria-label="提案を閉じる" onMouseDown={e => e.preventDefault()} disabled={p.busy && hasProposal} onClick={() => compact ? close() : p.onDismiss()}><OrganizationIcon name="close" /></button> : null}</div>
    {hasProposal && !p.writing && !p.state.composing ? <div role="group" aria-label="整理案の確認" className="organization-proposal">
      <div className="organization-proposal-scroll">
        <span className="organization-eyebrow">原文からの小さな編集案</span><h2>読み返しやすく、少しだけ。</h2>
        <p className="organization-proposal-intro">内容を付け足さず、書いた言葉を整えます。</p>
        <div className="organization-change-summary">
          {p.state.plan!.formats.length > 0 ? <p><span>構成</span>見出し・箇条書き {p.state.plan!.formats.length} 件</p> : null}
          {p.state.plan!.title !== p.saved.title ? <p><span>タイトル</span><span className="organization-before">{p.saved.title === "Untitled" ? "無題" : p.saved.title}</span><span aria-hidden="true">→</span><strong>{p.state.plan!.title}</strong></p> : null}
          {p.state.plan!.parentId !== p.saved.parentId ? <p><span>配置</span>{p.saved.pages.find(x => x.id === p.saved.parentId)?.title ?? "トップレベル"}<span aria-hidden="true">→</span><strong>{p.saved.pages.find(x => x.id === p.state.plan!.parentId)?.title ?? "トップレベル"}</strong></p> : null}
          {p.state.plan!.assistance?.links.length ? <p><span>リンク</span>{p.state.plan!.assistance.links.length} 件 · 参照先は未確認</p> : null}
        </div>
        <details className="organization-proposal-details"><summary>変更の内訳</summary><p>理由（未検証の推論）：{p.state.plan!.assistance?.reason ?? "配置の確認が必要です。"}</p><ul>{p.state.plan!.assistance?.links.map(l => <li key={`${l.blockId}:${l.index}`}>{l.action === "add" ? "リンク追加" : l.action === "edit" ? "リンク修正" : "リンク解除（表示文は保持）"}<span>{l.href ?? (p.saved.document.blocks.find(b => b.id === l.blockId)?.content as { href?: string }[] | undefined)?.[l.index]?.href}</span>{l.label ? <span>表示名「{l.label}」</span> : null}</li>)}</ul></details>
      </div>
      <div className="organization-proposal-actions"><button type="button" className="organization-primary" aria-label="この案を承認" onMouseDown={e => e.preventDefault()} disabled={p.busy || p.state.composing} onClick={() => p.onApprove()}><OrganizationIcon name="check" />採用する</button><button type="button" className="organization-quiet-button" onMouseDown={e => e.preventDefault()} disabled={p.busy} onClick={() => { p.onDismiss(); if (compact) dialog.current?.close(); }}>今回は見送る</button>{p.state.plan!.placement === "ambiguous" ? <button type="button" className="organization-quiet-button" disabled={p.busy || p.state.composing} onClick={() => p.onApprove(p.saved.parentId)}>現在の配置で承認</button> : null}</div>
    </div> : <div className="organization-rail-idle"><p>{label}</p>{p.saveIssue ? <><p className="organization-rail-help">{p.saveIssue}</p>{p.state.status === "unknown" ? <button type="button" className="organization-primary" onClick={p.onReconcile}>保存結果を照会</button> : null}<button type="button" onClick={p.onSettings}>保存と退避の設定を開く</button></> : p.state.status === "unknown" ? <><p className="organization-rail-help">原文と保存記録を保持しています。再送せず結果を確認します。</p><button type="button" className="organization-primary" onClick={p.onReconcile}>保存結果を照会</button></> : p.state.canUndo ? <><p className="organization-rail-help">本文・リンク・タイトル・配置をまとめて戻せます。</p><button type="button" disabled={p.busy || p.state.composing} onMouseDown={e => e.preventDefault()} aria-label="原文へ戻す" onClick={p.onUndo}><OrganizationIcon name="undo" />この整理を戻す</button></> : !enabled ? <><p className="organization-rail-help">自分の言葉で書く。一区切りついたら、小さな提案を確認。</p><button type="button" disabled={p.busy || p.state.composing} onClick={p.onEnable}>提案をオンにする</button></> : p.state.status === "off" || p.state.status === "blocked" ? <><p className="organization-rail-help">{p.state.notice}</p><button type="button" disabled={p.busy || p.state.composing} aria-label="提案とリンク整理を再開" onClick={p.onReconnect}>提案を再開</button></> : null}</div>}
    <div className="organization-rail-bottom"><button type="button" className="organization-quiet-button" disabled={p.state.composing} onClick={p.onSettings}><OrganizationIcon name="settings" />設定</button>{enabled && p.state.status !== "off" ? <button type="button" className="organization-quiet-button" aria-label="提案とリンク整理を停止" onMouseDown={e => e.preventDefault()} onClick={p.onStop}>一時停止</button> : null}</div>
  </>;
  return <>
    <aside className="organization-rail" aria-label="ノートの提案" data-compact={compact} data-writing={p.writing || p.state.composing} data-save-issue={!!p.saveIssue || p.state.status === "unknown"} style={compact ? { top: viewport.top + 12, width: "auto", right: Math.max(20, window.innerWidth - viewport.width - viewport.left + 20), bottom: "auto" } : undefined}>
      {compact ? <button type="button" ref={trigger} className="organization-proposal-chip" aria-label="提案を開く" aria-haspopup="dialog" aria-expanded={open} disabled={p.state.composing} onClick={launch}><OrganizationIcon name="spark" /><span>{p.saveIssue ? "保存を確認" : hasProposal ? "提案を確認" : p.state.status === "unknown" ? "保存を確認" : p.state.canUndo ? "元に戻す" : "提案"}</span>{hasProposal ? <span className="organization-count">1</span> : null}</button> : <div className="organization-rail-card">{content}</div>}
    </aside>
    <dialog ref={dialog} className="organization-review-sheet" aria-label="ノートの提案" style={{ "--organization-visible-height": `${viewport.height}px`, margin: 0, left: viewport.left + Math.max(12, (viewport.width - 440) / 2), top: viewport.top + Math.max(12, viewport.height - Math.min(600, viewport.height - 24) - 12), width: Math.min(440, viewport.width - 24), maxHeight: viewport.height - 24 } as CSSProperties} onKeyDown={organizationDialogKeys} onCancel={e => { if (p.state.composing) { e.preventDefault(); return; } if (hasProposal && !p.busy) p.onDismiss(); }} onClose={() => { setOpen(false); if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true }); }}>
      {compact && open ? content : null}
    </dialog>
    <span className="organization-sr-only" role="status">{hasProposal ? "確認できる編集案があります。本文は変更していません。" : p.state.status === "unknown" ? "保存結果の確認が必要です。" : ""}</span>
  </>;
}
