import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createAheadSession, type AheadSession, type AheadPhase, type AheadDocumentWriter, type AheadProposal } from "@hello-ai-company/editor-ai";
import type { EditorDocument } from "@hello-ai-company/editor-core";
import { createSyntheticAheadAdapter } from "./syntheticAhead";
import "./aheadPanel.css";

export type AheadEditorPort = {
  getDocument(): EditorDocument;
  subscribe(listener: () => void): () => void;
  commit: AheadDocumentWriter;
};
const titles: Record<AheadPhase, string> = { outline: "構成", research: "確かめること", draft: "次の段落" };
const statuses = { idle: "目的を伝えて始める", working: "次を準備中", waiting: "確認を待っています", paused: "停止中", stopping: "停止を確認中", cancelled: "取消済み", limit: "実行上限に達しました", failed: "準備を停止しました", blocked: "停止を確認できません" };
function interpretation(text: string): string {
  if (/不気味|怖|eerie/i.test(text)) return "緊張感と余韻を強める文章の案を準備する、という方向で受け取りました。";
  if (/防御|security|defen[sc]e/i.test(text)) return "防御を強めるための確認項目を文章として整理する、という方向で受け取りました。コードは実行しません。";
  return `「${text.slice(0, 120)}${text.length > 120 ? "…" : ""}」に沿う構成と段落の案を準備します。`;
}

export function AheadPanel({ port, active, onClose }: { port: AheadEditorPort; active: boolean; onClose: () => void }) {
  const [synthetic, setSynthetic] = useState(false);
  const [goal, setGoal] = useState("");
  const [limit, setLimit] = useState(6);
  const [session, setSession] = useState<AheadSession>();
  const [startError, setStartError] = useState("");
  const current = useRef<AheadSession | undefined>(undefined);
  const startLatch = useRef(false);
  current.current = session;
  useEffect(() => () => current.current?.dispose(), []);
  useEffect(() => {
    const stop = () => { if (document.hidden) void current.current?.pause(); };
    document.addEventListener("visibilitychange", stop);
    return () => document.removeEventListener("visibilitychange", stop);
  }, []);
  const start = () => {
    if (!synthetic || !goal.trim() || session || startLatch.current) return;
    startLatch.current = true;
    try {
      const next = createAheadSession({ adapter: createSyntheticAheadAdapter(), document: port.getDocument(), maxRuns: limit });
      next.start(goal.trim()); setSession(next); setStartError("");
    } catch {
      startLatch.current = false;
      setStartError("この文書で準備を始められませんでした。本文は保持しています。");
    }
  };
  return <section className="ahead-panel" aria-label="先行AI共同作業" hidden={!active}>
    <header><div><p className="demo-eyebrow">一歩先を、一緒に。</p><h2>次を準備する</h2></div><button className="demo-panel-close" aria-label="先行作業を閉じる" onClick={() => { void session?.pause(); onClose(); }}>×</button></header>
    {!session ? <>
      <p>目的を一度伝え、構成・確かめる項目・次の段落を準備します。使う変更は、あなたが選びます。</p>
      <p className="ahead-connection">実モデルは未接続です。ここでは動作確認用の合成例を準備します。会話で方向を変えられます。</p>
      <label className="ahead-goal">今回の目的<textarea value={goal} maxLength={4000} rows={3} placeholder="例：新しい企画を、読み手が判断できる説明にまとめる" onChange={event => setGoal(event.target.value)} /></label>
      <div className="ahead-settings"><label>実行上限<select value={limit} onChange={event => setLimit(Number(event.target.value))}>{[3, 6, 9, 12].map(value => <option key={value} value={value}>{value}回</option>)}</select></label>
        <label><input type="checkbox" checked={synthetic} onChange={event => setSynthetic(event.target.checked)} />ローカルの合成例で試す</label></div>
      <small>外部送信・モデル呼び出しはありません。開始後も本文は自由に編集できます。</small>
      <button type="button" className="chip chip--on" disabled={!synthetic || !goal.trim()} onClick={start}>準備を始める</button>
      {startError ? <p role="alert">{startError}</p> : null}
    </> : <SessionReview session={session} port={port} active={active} onNewGoal={() => { session.dispose(); startLatch.current = false; setSession(undefined); }} />}
  </section>;
}

function SessionReview({ session, port, active, onNewGoal }: { session: AheadSession; port: AheadEditorPort; active: boolean; onNewGoal: () => void }) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [error, setError] = useState("");
  const [direction, setDirection] = useState("");
  const [receipt, setReceipt] = useState<{ proposal: AheadProposal; indices: number[]; decision: "accepted" | "rejected" | "undone" }>();
  const applyLatch = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => { clearTimeout(timer); timer = setTimeout(() => {
      try { session.updateDocument(port.getDocument()); } catch { void session.pause(); setError("この文書の提案を安全に準備できません。本文は保持しています。"); }
    }, 350); };
    const unsubscribe = port.subscribe(update);
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [session, port]);
  useEffect(() => { if (!active) void session.pause(); }, [session, active]);
  const action = (callback: () => void) => {
    if (applyLatch.current || !active) return;
    applyLatch.current = true;
    try { callback(); setError(""); }
    catch { setError("採用を確認できませんでした。現在の本文を保持し、最新の状態を確認してください。");
      try { session.updateDocument(port.getDocument()); } catch { void session.pause(); } }
    finally { applyLatch.current = false; }
  };
  const busy = snapshot.status === "stopping";
  const resumable = ["paused", "failed"].includes(snapshot.status) && snapshot.runsUsed < snapshot.maxRuns;
  return <>
    <div className="ahead-purpose"><strong>{snapshot.goal}</strong><small>合成例 · {snapshot.runsUsed} / {snapshot.maxRuns}回 · 文書版 {snapshot.revision}</small></div>
    <div className="ahead-conversation" aria-label="AIパートナーとの会話"><p><strong>あなた</strong>：{snapshot.goal}</p>{snapshot.directions.map((turn, index) => <p key={index}><strong>あなた</strong>：{turn}</p>)}
      <p><strong>仮の解釈（合成例）</strong>：{interpretation(snapshot.direction || snapshot.goal)}</p><small>対象：この文書の文章。変更範囲：確認した段落の追加。大きな方針変更は、解釈を確認して伝え直せます。</small>
      <form onSubmit={event => { event.preventDefault(); if (!direction.trim()) return; action(() => { session.updateDocument(port.getDocument()); session.refine(direction.trim()); setDirection(""); }); }}>
        <label className="ahead-goal">会話で方向を伝える<textarea value={direction} maxLength={3000} rows={2} placeholder="例：もっと不気味な雰囲気にして" disabled={busy || ["cancelled", "blocked"].includes(snapshot.status)} onChange={event => setDirection(event.target.value)} /></label>
        <button className="chip" disabled={!direction.trim() || busy || ["cancelled", "blocked"].includes(snapshot.status)}>方向を伝える</button>
      </form>
      <small>目的と最近の会話を使います。この会話は保存されません。</small>
    </div>
    <ol className="ahead-plan" aria-label="準備の計画">{(["outline", "research", "draft"] as const).map(phase => <li key={phase} data-ready={snapshot.prepared.includes(phase)}>{titles[phase]}<span>{snapshot.prepared.includes(phase) ? "準備済み" : snapshot.phase === phase && snapshot.status === "working" ? "準備中" : "次に準備"}</span></li>)}</ol>
    <p role="status" className="ahead-status">{statuses[snapshot.status]}{snapshot.status === "working" ? " · 編集は続けられます" : ""}</p>
    <div className="ahead-actions"><button className="chip" disabled={busy || !["working", "waiting"].includes(snapshot.status)} onClick={() => { void session.pause(); }}>停止</button><button className="chip" disabled={!resumable} onClick={() => action(() => session.resume())}>再開</button><button className="chip" disabled={busy || snapshot.status === "cancelled"} onClick={() => { void session.cancel(); }}>未採用の作業を取消</button></div>
    {snapshot.status === "blocked" ? <p role="alert">停止を確認できないため、新しい実行は始めません。</p> : snapshot.status === "failed" ? <p role="alert">提案を検証できないか、この文書が実行可能な範囲を超えています。本文はそのままです。</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {receipt ? <ProposalCard key={`receipt-${receipt.proposal.group.id}`} proposal={receipt.proposal} disabled decision={receipt.decision} initialSelection={receipt.indices} onAccept={() => {}} onReject={() => {}} /> : null}
    {snapshot.proposals.map(proposal => <ProposalCard key={proposal.group.id} proposal={proposal} disabled={!active || busy} onAccept={indices => action(() => { session.adopt(proposal.group.id, indices, port.getDocument(), port.commit, "local-browser-user"); setReceipt({ proposal, indices, decision: "accepted" }); })} onReject={() => action(() => { session.reject(proposal.group.id); setReceipt({ proposal, indices: [], decision: "rejected" }); })} />)}
    <button className="chip" disabled={!snapshot.canUndo || !active || busy} onClick={() => action(() => { session.undo(port.getDocument(), port.commit); setReceipt(current => current?.decision === "accepted" ? { ...current, decision: "undone" } : current); })}>採用をUndo</button>
    <p className="ahead-note">選んだ変更だけ本文に入ります。編集すると以前の提案を取り下げ、最新の文書から準備し直します。取消は、採用済みの本文を戻しません。</p>
    <small>Canvasの配置変更・コード生成や実行・音声入力は未接続です。入力済みの作品内容は、実行権限として扱いません。</small>
    {snapshot.status === "cancelled" ? <button className="chip" onClick={onNewGoal}>新しい目的で始める</button> : null}
  </>;
}
function ProposalCard({ proposal, disabled, onAccept, onReject, decision, initialSelection }: { proposal: AheadProposal; disabled: boolean; onAccept: (indices: number[]) => void; onReject: () => void; decision?: "accepted" | "rejected" | "undone"; initialSelection?: number[] }) {
  const [selected, setSelected] = useState(initialSelection ?? proposal.group.changes.map((_, index) => index));
  return <article className="ahead-proposal" data-decision={decision ?? "pending"}><h3>{proposal.group.title}</h3><p>{proposal.group.summary}</p>
    <p className="ahead-before">変更前：現在の本文を保持し、選んだ段落を末尾に追加します。</p>
    <fieldset disabled={disabled}><legend>追加する変更を選ぶ</legend>{proposal.group.changes.map((change, index) => <label key={index}><input type="checkbox" checked={selected.includes(index)} onChange={event => setSelected(items => event.target.checked ? [...items, index].sort((a, b) => a - b) : items.filter(item => item !== index))} /><span>{change.op === "insert" ? blockText(change.block.content) : "この変更はホスト側の差分確認が必要です。"}</span></label>)}</fieldset>
    <div className="ahead-actions"><button className="chip chip--on" disabled={disabled || !selected.length} onClick={() => onAccept(selected)}>{decision === "accepted" ? "採用済み" : decision === "undone" ? "Undo済み" : decision === "rejected" ? "使わないと決定済み" : "選んだ変更を採用"}</button><button className="chip" disabled={disabled} onClick={onReject}>提案を使わない</button></div>
    <details className="ahead-preview"><summary>採用後の追加段落をプレビュー</summary>{selected.map(index => { const change = proposal.group.changes[index]; return change?.op === "insert" ? <p key={index}>{blockText(change.block.content)}</p> : null; })}</details>
  </article>;
}
function blockText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(item => item && typeof item === "object" && "text" in item ? String(item.text) : "").join("");
  return "";
}
