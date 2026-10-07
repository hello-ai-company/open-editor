export type NoteOrganizationCardProps = {
  authorized: boolean; status: string; notice: string; composing: boolean; canUndo: boolean;
  pending: boolean; ambiguousParent?: string; onAuthorize(value: boolean): void;
  onStop(): void; onUndo(): void; onReconnect(): void; onReconcile(): void;
  onChooseParent(useProposed: boolean): void;
};
/** Opt-in auto organization is separate from ordinary proposal approval. Never takes editor focus. */
export function NoteOrganizationCard(p: NoteOrganizationCardProps) {
  return <section className="oe-note-organization" aria-label="このノートの自動整理">
    <label><input type="checkbox" checked={p.authorized} disabled={p.pending || p.status === "unknown"} onChange={e => p.onAuthorize(e.target.checked)} />このノートの本文整理・タイトル・配置の自動適用を許可</label>
    <p role="status">{p.composing ? "日本語変換中は整理しません" : p.notice}</p>
    {p.ambiguousParent ? <div role="group" aria-label="親ページの確認"><p>「{p.ambiguousParent}」の子ページにしますか？</p><button type="button" disabled={p.pending || p.composing} onClick={() => p.onChooseParent(true)}>この親に配置</button><button type="button" disabled={p.pending || p.composing} onClick={() => p.onChooseParent(false)}>現在の配置を保持</button></div> : null}
    <div className="oe-note-organization-actions">
      <button type="button" onMouseDown={e => e.preventDefault()} disabled={!p.authorized} onClick={p.onStop}>整理を停止</button>
      <button type="button" onMouseDown={e => e.preventDefault()} disabled={!p.canUndo || p.pending || p.status === "unknown" || p.composing} onClick={p.onUndo}>本文・タイトル・配置をUndo</button>
      {p.status === "unknown" ? <button type="button" disabled={p.pending} onClick={p.onReconcile}>保存結果を照会</button> : null}
      {p.status === "blocked" || p.status === "off" ? <button type="button" disabled={p.pending || !p.authorized} onClick={p.onReconnect}>現在のノートで再接続</button> : null}
    </div>
  </section>;
}
