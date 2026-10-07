import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import type { NotesTarget } from "../notes/contracts.js";
import { closeNotesTab, notesDropZone, notesLayoutPanes, splitNotesTab, type NotesDropZone, type NotesLayoutState, type NotesWorkspaceTab } from "../notes/layoutState.js";

export type NotesNavigationIntent = "activate" | "split" | "preview" | "close" | "unsplit";
export type NotesWorkspaceTabsProps = {
  layout: NotesLayoutState;
  onChange(layout: NotesLayoutState): void;
  /** Must flush the resource writer, wait for nested editors/IME, then authorize navigation.
   * Cancellation never grants permission to abandon an uncertain commit. */
  onNavigate(target: NotesTarget, context: { intent: NotesNavigationIntent; signal: AbortSignal }): Promise<boolean>;
  beforeClose(target: NotesTarget, signal: AbortSignal): Promise<boolean>;
  renderPane(context: { tab: NotesWorkspaceTab; paneId: string; readOnly: boolean }): ReactNode;
  language?: "en" | "ja";
};

/** Controlled layout. No localStorage/authentication or host DOM events are used. */
export function NotesWorkspaceTabs({ layout, onChange, onNavigate, beforeClose, renderPane, language = "en" }: NotesWorkspaceTabsProps) {
  const ja = language === "ja";
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [dragged, setDragged] = useState<string | null>(null), [drop, setDrop] = useState<NotesDropZone | null>(null);
  const current = useRef(layout), operation = useRef<AbortController | null>(null), live = useRef(true);
  current.current = layout;
  useEffect(() => { live.current = true; return () => { live.current = false; operation.current?.abort(); }; }, []);
  async function change(id: string, intent: NotesNavigationIntent, zone: NotesDropZone = "center") {
    if (operation.current) return;
    const tab = layout.tabs.find(item => item.id === id);
    if (!tab || (intent === "close" && tab.pinned)) return;
    const captured = layout, abort = new AbortController(); operation.current = abort;
    setBusy(true); setMessage("");
    try {
      const next = intent === "close" ? closeNotesTab(captured, id) : intent === "activate" ? splitNotesTab(captured, id, "center") : intent === "split" ? splitNotesTab(captured, id, zone) : intent === "preview" ? { ...captured, previewTabId: id } : { ...captured, split: { ...captured.split, tabIds: [], primaryPosition: 0 } };
      const remaining = new Set(notesLayoutPanes(next).map(pane => pane.tab.id));
      const closing = intent === "close" ? [tab] : notesLayoutPanes(captured).filter(pane => !remaining.has(pane.tab.id)).map(pane => pane.tab);
      // Removing a split pane (including an evicted third pane) also requires its dirty writer guard.
      let approved = true;
      for (const item of closing) {
        if (!approved || abort.signal.aborted || current.current !== captured || !live.current) break;
        approved = await beforeClose(item.target, abort.signal);
      }
      if (approved && !abort.signal.aborted && current.current === captured && live.current && intent !== "close") approved = await onNavigate(tab.target, { intent, signal: abort.signal });
      if (!approved || abort.signal.aborted || current.current !== captured || !live.current) {
        if (live.current) setMessage(ja ? "編集内容を保持しています。切り替えは完了していません。" : "Edits are retained. Navigation did not complete.");
        return;
      }
      onChange(next);
    } catch { if (live.current) setMessage(ja ? "切り替えに失敗しました。編集内容は保持されています。" : "Navigation failed; edits are retained."); }
    finally { if (operation.current === abort) operation.current = null; if (live.current) setBusy(false); }
  }
  const paneErrors = (context: Parameters<NotesWorkspaceTabsProps["renderPane"]>[0]) => {
    try { return renderPane(context); } catch { return <p role="alert">{ja ? "このペインを表示できません。編集内容は保持されています。" : "This pane could not render. Edits are retained."}</p>; }
  };
  const preview = layout.tabs.find(tab => tab.id === layout.previewTabId);
  const panes = notesLayoutPanes(layout);
  return <section className="oe-notes-tabs" aria-label={ja ? "ノートのタブと分割" : "Notes tabs and panes"} aria-busy={busy} onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing && operation.current) { operation.current.abort(); setMessage(ja ? "切り替えをキャンセルしました。" : "Navigation cancelled."); } }}>
    <div role="tablist" aria-label={ja ? "開いているノート" : "Open notes"} className="oe-notes-tablist">
      {layout.tabs.map(tab => <div className="oe-notes-tab" key={tab.id} draggable={!busy} onDragStart={event => { setDragged(tab.id); event.dataTransfer.setData("application/x-open-editor-tab", tab.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setDragged(null); setDrop(null); }}>
        <button type="button" role="tab" aria-selected={tab.id === layout.activeTabId} disabled={busy} onClick={() => void change(tab.id, "activate")} onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || event.nativeEvent.isComposing) return;
          event.preventDefault();
          const tabs = Array.from(event.currentTarget.closest('[role="tablist"]')!.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
          const index = tabs.indexOf(event.currentTarget), next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          tabs[next]?.focus();
        }}>{tab.pinned ? "● " : ""}{tab.title}</button>
        <button type="button" aria-label={`${tab.pinned ? (ja ? "固定を解除" : "Unpin") : (ja ? "固定" : "Pin")} ${tab.title}`} aria-pressed={tab.pinned} disabled={busy} onClick={() => onChange({ ...layout, tabs: layout.tabs.map(item => item.id === tab.id ? { ...item, pinned: !item.pinned } : item) })}>{tab.pinned ? (ja ? "固定解除" : "Unpin") : (ja ? "固定" : "Pin")}</button>
        <button type="button" disabled={busy || tab.pinned} aria-label={`${ja ? "閉じる" : "Close"} ${tab.title}`} onClick={() => void change(tab.id, "close")}>×</button>
        <details><summary>{ja ? "表示" : "View"}</summary><div role="group" aria-label={`${tab.title} ${ja ? "表示位置" : "pane position"}`}>
          {(["left", "right", "top", "bottom"] as const).map(zone => <button type="button" key={zone} disabled={busy || tab.id === layout.activeTabId} onClick={() => void change(tab.id, "split", zone)}>{ja ? ({ left: "左に分割", right: "右に分割", top: "上に分割", bottom: "下に分割" }[zone]) : `Split ${zone}`}</button>)}
          <button type="button" disabled={busy} onClick={() => void change(tab.id, "preview")}>{ja ? "プレビュー" : "Preview"}</button>
        </div></details>
      </div>)}
    </div>
    {layout.split.tabIds.length && layout.activeTabId ? <button type="button" disabled={busy} onClick={() => void change(layout.activeTabId!, "unsplit")}>{ja ? "分割を閉じる" : "Close split view"}</button> : null}
    {busy ? <button type="button" onClick={() => operation.current?.abort()}>{ja ? "切り替えをキャンセル" : "Cancel navigation"}</button> : null}
    <p role="status">{message}</p>
    <div className="oe-notes-panes" data-axis={layout.split.axis} data-drop-zone={drop ?? undefined} style={{ display: "flex", flexDirection: layout.split.axis === "horizontal" ? "row" : "column", flexWrap: "wrap", gap: "1rem" }} onDragOver={event => {
      if (!dragged || busy) return; event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      setDrop(notesDropZone((event.clientX - rect.left) / Math.max(1, rect.width), (event.clientY - rect.top) / Math.max(1, rect.height)));
    }} onDrop={event => { event.preventDefault(); const id = dragged; setDragged(null); setDrop(null); if (id) void change(id, drop === "center" ? "activate" : "split", drop ?? "center"); }}>
      {panes.map(pane => <section className="oe-notes-pane" key={pane.tab.id} aria-label={pane.tab.title} style={{ flex: "1 1 280px", minWidth: 0 }}>{pane.readOnly ? <p>{ja ? "同じノートの読み取り専用表示" : "Read-only mirror of the same note"}</p> : null}<NotesPaneRenderBoundary resetKey={pane.tab.id} fallback={ja ? "ペインを表示できません。原本と入力は保持しています。" : "Pane renderer failed; original data and input are retained."}>{paneErrors(pane)}</NotesPaneRenderBoundary></section>)}
    </div>
    {preview ? <aside className="oe-notes-preview" aria-label={ja ? "ノートのプレビュー" : "Note preview"}><button type="button" onClick={() => onChange({ ...layout, previewTabId: null })}>{ja ? "プレビューを閉じる" : "Close preview"}</button><NotesPaneRenderBoundary resetKey={preview.id} fallback={ja ? "プレビューを表示できません。原本と入力は保持しています。" : "Preview renderer failed; original data and input are retained."}>{paneErrors({ tab: preview, paneId: "preview", readOnly: true })}</NotesPaneRenderBoundary></aside> : null}
  </section>;
}

class NotesPaneRenderBoundary extends Component<{ children: ReactNode; resetKey: string; fallback: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  componentDidUpdate(previous: Readonly<{ children: ReactNode; resetKey: string; fallback: string }>): void { if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false }); }
  render(): ReactNode { return this.state.failed ? <div role="alert"><p>{this.props.fallback}</p><button type="button" onClick={() => this.setState({ failed: false })}>Retry pane</button></div> : this.props.children; }
}
