export type QuietCooperationCardProps = {
  enabled: boolean;
  actor: string;
  coordinator?: string;
  purpose: string;
  status: string;
  notice?: string;
  enableLabel?: string;
  hypothesis?: string;
  changes?: readonly { id: string; before: string; after: string }[];
  disabled?: boolean;
  canUndo?: boolean;
  onEnable(enabled: boolean): void;
  onAccept(): void;
  onDismiss(): void;
  onStop(): void;
  onUndo(): void;
};

/** A reserved review strip. Updates never focus, scroll, type, animate or write by themselves. */
export function QuietCooperationCard(props: QuietCooperationCardProps) {
  return <section className="oe-quiet-cooperation" aria-label="控えめな共同作業">
    <header><label><input type="checkbox" checked={props.enabled} disabled={props.disabled} onChange={event => props.onEnable(event.target.checked)} />{props.enableLabel ?? "入力が落ち着いた時に、案を見る"}</label><span>{props.status}</span></header>
    <small>{props.notice ?? "記載する変更は、あなたが確認して選びます。"}</small>
    {props.enabled || props.changes?.length || props.canUndo ? <div className="oe-quiet-cooperation-review">
      <p><strong>{props.actor}</strong>{props.coordinator ? ` · ${props.coordinator}の指示` : ""} · {props.purpose}</p>
      {props.hypothesis ? <p>意図の仮説：{props.hypothesis}</p> : null}
      {props.changes?.length ? <details><summary>変更案を確認する</summary><div className="oe-quiet-cooperation-diff">{props.changes.map(change => <div key={change.id}><p><small>変更前</small> {change.before}</p><p><small>変更案</small> {change.after}</p></div>)}</div></details> : null}
      <div className="oe-quiet-cooperation-actions">
        {props.changes?.length ? <><button type="button" disabled={props.disabled} onMouseDown={event => event.preventDefault()} onClick={props.onAccept}>許可して記載</button><button type="button" disabled={props.disabled} onMouseDown={event => event.preventDefault()} onClick={props.onDismiss}>この案を使わない</button></> : null}
        <button type="button" disabled={props.disabled || !props.enabled} onMouseDown={event => event.preventDefault()} onClick={props.onStop}>提案を停止</button>
        <button type="button" disabled={props.disabled || !props.canUndo} onMouseDown={event => event.preventDefault()} onClick={props.onUndo}>記載をUndo</button>
      </div>
    </div> : null}
  </section>;
}
