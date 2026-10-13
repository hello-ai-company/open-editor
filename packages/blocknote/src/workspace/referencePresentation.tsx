import type { ReactElement } from "react";

/** Presentation only: never copy, fetch, rename or replace the referenced page. */
export function ReferencePresentation({ value, child, onChange, onHistory }: { value: string; child?: boolean; onChange?: (value: string) => void; onHistory?: (redo: boolean) => void }): ReactElement | null {
  if (!onChange) return null;
  return <details className="oe-reference-presentation" onKeyDown={event => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "z" && !event.nativeEvent.isComposing && onHistory) { event.preventDefault(); event.stopPropagation(); onHistory(event.shiftKey); return; }
    if (event.key === "Escape" && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
  }}><summary aria-label={child ? "子ページの表示" : "カードの表示"}>⋯</summary><div role="group" aria-label="表示形式">
    {([["modern", "Modern"], ["simple", "Simple"], ...(child ? [["link", "青いリンク"]] : [])]).map(([mode, label]) => <button type="button" key={mode} aria-pressed={value === mode} onClick={event => { onChange(mode!); const details = event.currentTarget.closest("details"); if (details) { details.open = false; details.querySelector("summary")?.focus(); } }}>{label}</button>)}
  </div></details>;
}
