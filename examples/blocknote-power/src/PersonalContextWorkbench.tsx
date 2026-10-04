import { useEffect, useRef, useState } from "react";
import { accept, edit, newState, parseContext, propose, reject, restore, syntheticContext, syntheticVerifier, undo, type HostVerifier, type ReviewState, type SelectedContext } from "./selectedPersonalContext.mjs";
import "./personalContextWorkbench.css";

const storageKey = "open-editor.synthetic-selected-context.v1";
const messages: Record<string, string> = {
  human_edit_conflict: "その後に人が編集しています。本文は保持しました。文脈を確認し直して、新しい提案を作ってください。",
  document_version_changed: "文書の版が変わりました。合成文脈を確認し直してください。",
  source_or_document_changed: "出典または文書の版が変わりました。採用せず、現在の本文を保持しました。",
  approval_removed: "合成出典の承認が失効しています。提案・採用は停止しました。",
  source_deleted: "合成出典は削除されています。提案・採用は停止しました。",
  offline: "合成の接続失敗です。本文を保持しました。出典の状態を戻して確認し直してください。"
};

type SourceState = "approved" | "paused" | "deleted" | "changed" | "offline";
export function PersonalContextWorkbench({ active, onBack }: { active: boolean; onBack: () => void }) {
  const [state, setState] = useState(newState);
  const [context, setContext] = useState<SelectedContext>();
  const [synthetic, setSynthetic] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<ReviewState["proposal"]>(null);
  const [changes, setChanges] = useState<string[]>([]);
  const [sourceState, setSourceState] = useState<SourceState>("approved");
  const sourceStateRef = useRef(sourceState); sourceStateRef.current = sourceState;
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState<string>();
  const latest = useRef(state); latest.current = state;
  const ticket = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; ++ticket.current; }; }, []);
  useEffect(() => {
    if (!active) { ++ticket.current; busyRef.current = false; setBusy(false); if (!synthetic) setContext(undefined); }
  }, [active, synthetic]);
  function commit(next: ReviewState) { latest.current = next; setState(next); }
  const verifier: HostVerifier = async (request) => {
    const status = sourceStateRef.current;
    if (status === "paused") throw new Error("approval_removed");
    if (status === "deleted") throw new Error("source_deleted");
    if (status === "offline") throw new Error("offline");
    const fresh = await syntheticVerifier(request);
    if (status === "changed") fresh.memories[0].version += 1;
    return fresh;
  };
  async function run(action: (base: ReviewState) => Promise<ReviewState>) {
    if (busyRef.current || !synthetic || !active) return;
    const base = latest.current; const id = ++ticket.current;
    busyRef.current = true; setBusy(true); setMessage("");
    try {
      const result = await action(base);
      if (!alive.current || id !== ticket.current) return;
      if (latest.current !== base) { setMessage(messages.human_edit_conflict); return; }
      if (result.undo && base.proposal && !result.proposal) setReceipt(base.proposal);
      commit(result);
      if (result.proposal) setChanges(result.proposal.context.memories.map(m => m.memory_id));
      setMessage(result.proposal ? "合成出典を再検証しました。差分を確認し、採用する変更を選んでください。" : "選んだ変更を合成文書へ反映しました。実接続はありません。");
    } catch (error) {
      if (alive.current && id === ticket.current) setMessage(error instanceof Error ? messages[error.message] ?? "検証できなかったため停止しました。本文は保持しています。" : "検証できません。本文を保持しています。");
    } finally {
      if (alive.current && id === ticket.current) { busyRef.current = false; setBusy(false); }
    }
  }
  function activate() {
    if (busyRef.current) return;
    ++ticket.current; setSynthetic(true); setSourceState("approved");
    const c = syntheticContext(latest.current.version); setContext(c); setSelected(c.memories.map(m => m.memory_id));
    setMessage("固定の合成文脈だけを確認しています。実モデル・実記憶・APIへの接続はありません。");
  }
  async function importFile(file: File) {
    const id = ++ticket.current; setSynthetic(false); setContext(undefined); setReceipt(null); commit(reject(latest.current));
    if (file.size > 64000) { setMessage("64KB以内の文脈JSONを選んでください。本文は保持しています。"); return; }
    try {
      const c = parseContext(await file.text());
      if (!alive.current || id !== ticket.current) return;
      setContext(c); setSelected([]); setMessage("外部JSONは閲覧だけです。最新の承認・対象文書を実ホストで再検証するまで提案・採用・保存できません。");
    } catch { if (alive.current && id === ticket.current) setMessage("文脈JSONの形式を確認できません。現在の文書は保持しています。"); }
  }
  function toggle(list: string[], id: string, checked: boolean) { return checked ? [...list.filter(x => x !== id), id] : list.filter(x => x !== id); }
  const unchanged = JSON.stringify(state) === saved;
  const review = state.proposal ?? receipt;
  const canUse = synthetic && sourceState === "approved" && !busy;
  return <main lang="ja" className="demo-shell contextWorkbench">
    <header className="contextHeader"><button type="button" onClick={onBack}>← Documentに戻る</button><span>OpenEditor / Personal context</span></header>
    <div className="contextBody">
      <header><p className="demo-eyebrow">あなたを理解するPersonal-AI → OpenEditor</p><h1>選んだ文脈だけを、文書へ。</h1><p>根拠を読み、変更を選び、最後は自分で決める。</p></header>
      <aside className="contextBoundary"><strong>合成データのローカル確認 · 実接続なし</strong><p>この画面は独立した合成文書です。元のDocument本文は変更しません。外部JSONは閲覧のみ。ブラウザ保存はこの合成作業だけです。</p><button type="button" disabled={busy} onClick={activate}>合成文脈を確認する</button></aside>
      <div className="contextColumns">
        <section aria-labelledby="context-document-title"><div className="contextSectionHeading"><h2 id="context-document-title">文書</h2><span>版 {state.version}</span></div>
          <p className="contextSaveStatus">{unchanged ? "このブラウザに保存済み" : "未保存の合成作業"} · アカウント間の同期なし</p>
          <label>合成文書の本文<textarea maxLength={12000} disabled={busy} value={state.text} onChange={(e) => { ++ticket.current; commit(edit(latest.current, e.target.value)); }} /></label>
          <div className="contextActions"><button type="button" disabled={busy || !synthetic} onClick={() => { try { const raw = JSON.stringify(latest.current); restore(raw); localStorage.setItem(storageKey, raw); setSaved(raw); setMessage("合成作業をこのブラウザに保存しました。外部文脈は保存していません。"); } catch { setMessage("保存できません。現在の文書は保持しています。"); } }}>合成作業を保存</button><button type="button" disabled={busy} onClick={() => { try { const raw = localStorage.getItem(storageKey); if (!raw) { setMessage("保存された合成作業はありません。"); return; } const next = restore(raw); ++ticket.current; commit(next); setReceipt(null); setSaved(raw); setContext(next.proposal?.context); setSynthetic(false); setChanges(next.proposal?.context.memories.map(m => m.memory_id) ?? []); setMessage("復元しました。合成文脈を確認し直すまで採用は無効です。"); } catch { setMessage("保存状態を検証できません。現在の文書は保持しています。"); } }}>保存状態を復元</button></div>
        </section>
        <section aria-labelledby="context-source-title"><h2 id="context-source-title">この文書への文脈</h2>
          <label className="contextImport">文脈JSONを閲覧<input type="file" accept=".json,application/json" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void importFile(file); }} /></label>
          {!context ? <p className="contextEmpty">文脈は未選択です。合成文脈を確認するか、JSONを閲覧してください。</p> : <>
            <p>{synthetic ? "合成台帳の確認用スナップショット" : "未検証の外部スナップショット・閲覧のみ"}<br />対象: {context.document_title} · 版 {context.document_version}</p>
            <fieldset className="contextMemories" disabled={!synthetic || busy}><legend>文書に渡すものだけを選択</legend>{context.memories.map(m => <div key={m.memory_id}>
              <label><input type="checkbox" checked={selected.includes(m.memory_id)} onChange={e => setSelected(toggle(selected, m.memory_id, e.target.checked))} /><span><strong>{m.assertion === "ai_inference" ? "推測・提案" : "本人の明言"} · 記憶版 {m.version}</strong><span>{m.content}</span></span></label>
              <details><summary>根拠と出典</summary><p>{m.rationale}</p><p>{m.source_date}<br />出典: {m.source_turn_id}<br />記憶: {m.memory_id}</p>{m.recording_source && <p>{JSON.stringify(m.recording_source)}</p>}</details>
            </div>)}</fieldset>
            {synthetic && <label>合成出典の状態（失敗確認用）<select value={sourceState} disabled={busy} onChange={e => setSourceState(e.target.value as SourceState)}><option value="approved">確認済み</option><option value="paused">承認失効</option><option value="deleted">削除済み</option><option value="changed">版の変更</option><option value="offline">接続失敗</option></select></label>}
            {synthetic && sourceState !== "approved" && <p role="status">合成出典を再確認できないため、提案・採用を停止しています。</p>}
            <button type="button" disabled={!canUse || !selected.length} onClick={() => void run(base => propose(base, { ...context, memories: context.memories.filter(m => selected.includes(m.memory_id)) }, verifier))}>選んだ文脈から提案を作る</button>
          </>}
        </section>
      </div>
      {review && <section className="contextReview" aria-label="根拠付き提案の確認"><h2>採用する前に、読み比べる。</h2><p>合成の定型提案です。実モデルによる生成ではありません。採用時に文書と出典の版を再検証します。</p>
        <div className="contextDiff"><div><h3>変更前</h3><p>{review.base}</p></div><div><h3>追加する変更</h3><fieldset disabled={busy || !synthetic || !state.proposal}><legend>採用する内容</legend>{review.context.memories.map(m => <label key={m.memory_id}><input type="checkbox" checked={changes.includes(m.memory_id)} onChange={e => setChanges(toggle(changes, m.memory_id, e.target.checked))} /><span><strong>{m.assertion === "ai_inference" ? "推測・提案" : "本人の明言"}</strong><span>{m.content}</span><small>出典 {m.source_turn_id} · 記憶版 {m.version}</small></span></label>)}</fieldset></div></div>
        <div className="contextActions"><button type="button" disabled={!state.proposal || !canUse || !changes.length || review.base_version !== state.version} onClick={() => void run(base => accept(base, verifier, changes))}>{state.proposal ? "選んだ変更を採用" : state.undo ? "採用済み" : "取り消し済み"}</button><button type="button" disabled={busy || !state.proposal} onClick={() => { ++ticket.current; commit(reject(latest.current)); setMessage("提案を使わず、現在の本文を保持しました。"); }}>提案を使わない</button></div>
        {state.proposal && review.base_version !== state.version && <p role="status">人の編集で版が変わっています。この提案は採用できません。</p>}
      </section>}
      {(state.undo || receipt) && <button type="button" disabled={!state.undo || busy || !synthetic || state.undo.after_version !== state.version} onClick={() => { try { commit(undo(latest.current)); setMessage("直前の採用を取り消しました。元の本文を復元しました。"); } catch { setMessage(messages.human_edit_conflict); } }}>直前の採用を取り消す</button>}
      {busy && <p role="status">合成文書と選択出典を確認しています…</p>}
      {message && <p className="contextMessage" role="status" aria-live="polite">{message}</p>}
    </div>
  </main>;
}
