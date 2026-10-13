import { NOTES_INSERT_LABELS_EN as INSERT_EN, notesInsertionCatalog, notesInsertionCommands, notesRequestInsertion } from "./NotesInsertionCommands.js";
import { useNotesFeedback } from "./NotesFeedback.js";
import { beginNotesToolDrag, endNotesToolDrag, NOTES_TOOL_DRAG_MIME } from "./notesToolDrag.js";
import { NotesToolPreview } from "./NotesToolPreview.js";
import { useEffect, useId, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { NotesIcon, NOTES_PAGE_STYLES, notesMetadataField, type NotesPageAppearanceOptions } from "./notesPresentation.js";
import { textFromBlock } from "../index/textFromBlock.js";
import { NotesOverlayPortal } from "./NotesOverlayPortal.js";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";
import { NotesStyleGalleryButton } from "./NotesStyleGallery.js";
import type { NotesInspectorPanel, NotesWorkspaceController } from "../notes/contracts.js";
import { NOTES_STYLE_CATALOG, NotesPanelStatus, notesAvailableCatalog, notesCatalogUnavailable, notesIsComposing, notesPanelIdentity, useNotesController, useNotesEntries, useNotesPanelCommands, type NotesEditorBridge, type NotesInsertKind, type NotesStyleKind } from "./notesWorkspacePanels.js";

export type NotesInspectorProps = { controller: NotesWorkspaceController; bridge: NotesEditorBridge; tabs?: readonly NotesInspectorPanel[]; initialTab?: NotesInspectorPanel; className?: string; classic?: boolean; language?: "en" | "ja"; pageAppearance?: NotesPageAppearanceOptions; pageStyle?: string; infoTools?: ReactNode; onFocusMode?(): void; onPanelChange?(panel: NotesInspectorPanel): void; activePanel?: NotesInspectorPanel; hideTabs?: boolean };

const STYLE_EN: Record<NotesStyleKind, string> = { heading: "Heading", quote: "Quote", bullet: "Bullet list", numbered: "Numbered list", checklist: "Checklist", callout: "Callout", alignLeft: "Align left", alignCenter: "Align center", alignRight: "Align right", indent: "Indent", outdent: "Outdent", fontSans: "Sans serif", fontSerif: "Serif", fontMono: "Monospace", textSmall: "Small text", textLarge: "Large text", clearFormatting: "Clear formatting", moveUp: "Move up", moveDown: "Move down", moveTop: "Move to top", moveBottom: "Move to bottom" };
const STYLE_HINTS: Record<NotesStyleKind, string> = { heading: "Start a section", quote: "Highlight a quotation", bullet: "Create a bullet list", numbered: "Create a numbered list", checklist: "Track a list of items", callout: "Emphasize a note", alignLeft: "Align selected blocks to the left", alignCenter: "Center selected blocks", alignRight: "Align selected blocks to the right", indent: "Nest the selected blocks", outdent: "Move selected blocks back a level", fontSans: "Use a clean sans-serif font", fontSerif: "Use an editorial serif font", fontMono: "Use a focused monospace font", textSmall: "Reduce the selected text size", textLarge: "Increase the selected text size", clearFormatting: "Remove text styles from the selection", moveUp: "Move the selected block up one step", moveDown: "Move the selected block down one step", moveTop: "Move the selection to the start of the document", moveBottom: "Move the selection to the end of the document" };
const LABELS: Record<NotesInspectorPanel, string> = { insert: "挿入", style: "書式", info: "情報" };
export function NotesInspector(props: NotesInspectorProps) {
  const state = useNotesController(props.controller);
  return <InspectorPanel key={notesPanelIdentity(props.controller, state.snapshot)} {...props} />;
}
function InspectorPanel(props: NotesInspectorProps) {
  const feedback = useNotesFeedback();
  const state = useNotesController(props.controller), uid = useId(), tabs = props.tabs ?? ["insert", "style", "info"];
  const [tab, setTab] = useState<NotesInspectorPanel>(() => props.initialTab && tabs.includes(props.initialTab) ? props.initialTab : tabs[0] ?? "insert");
  const selected = props.activePanel && tabs.includes(props.activePanel) ? props.activePanel : tabs.includes(tab) ? tab : tabs[0];
  const metadata = useNotesPanelCommands(props.controller), entries = useNotesEntries(props.bridge.index);
  const [toolsDialogOpen, setToolsDialogOpen] = useState(false);
  const toolsRoot = useRef<HTMLDivElement>(null);
  useEffect(() => { const root = toolsRoot.current; if (!root) return; const update = () => setToolsDialogOpen(Boolean(root.querySelector('[role="dialog"]'))); const observer = new MutationObserver(update); observer.observe(root, { childList: true, subtree: true }); update(); return () => observer.disconnect(); }, [props.classic]);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retainHover = () => { clearTimeout(hoverTimer.current); };
  const leaveHover = () => { retainHover(); hoverTimer.current = setTimeout(() => setHover(null), 120); };
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  const [hover, setHover] = useState<{ kind: string; left: number; top: number } | null>(null);
  const showHover = (kind: string, opener: HTMLElement) => {
    if (!opener.isConnected) return;
    const rect = opener.getBoundingClientRect(), viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
    const right = left + (viewport?.width ?? window.innerWidth), bottom = top + (viewport?.height ?? window.innerHeight);
    setHover({ kind, left: Math.max(left + 12, Math.min(right - 264, rect.left - 260)), top: Math.max(top + 12, Math.min(bottom - 210, rect.top - 80)) });
  };
  const queueHover = (kind: string, opener: HTMLElement) => {
    retainHover();
    // Passing through the rail should not flash a large preview over the writer.
    if (window.matchMedia?.("(hover: none)").matches) return;
    hoverTimer.current = setTimeout(() => showHover(kind, opener), 350);
  };
  useEffect(() => {
    const dismiss = (event: Event) => { if (event instanceof KeyboardEvent && (event.key !== "Escape" || event.isComposing || event.keyCode === 229)) return; retainHover(); setHover(null); };
    window.addEventListener("resize", dismiss); window.addEventListener("scroll", dismiss, true); document.addEventListener("keydown", dismiss);
    return () => { window.removeEventListener("resize", dismiss); window.removeEventListener("scroll", dismiss, true); document.removeEventListener("keydown", dismiss); };
  }, []);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false), [tableSize, setTableSize] = useState({ rows: 2, columns: 2 });
  const tableRoot = useRef<HTMLDivElement>(null), tableOpener = useRef<HTMLButtonElement | null>(null);
  useDialogFocusTrap(tableOpen || htmlOpen, tableRoot);
  const dragClickUntil = useRef(0), dragPayload = useRef<string | undefined>(undefined);
  useEffect(() => () => { if (dragPayload.current) endNotesToolDrag(dragPayload.current); dragPayload.current = undefined; }, [props.controller, notesPanelIdentity(props.controller, state.snapshot), state.snapshot?.revision, state.snapshot?.contentRevision, state.draft]);
  const flight = useRef<AbortController | null>(null), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; flight.current?.abort(); }; }, []);
  const insertCatalog = notesInsertionCatalog(props.bridge, props.language ?? "ja");
  const insert = notesInsertionCommands(props.bridge, props.language ?? "ja");
  const styles = notesAvailableCatalog(NOTES_STYLE_CATALOG, props.bridge.supportedStyleActions, props.bridge.installedBlockTypes);
  const editable = props.bridge.commandsAvailable !== false && props.bridge.editable && !props.bridge.composing && !state.composing && state.status === "ready" && !!state.snapshot && !state.pendingEditors && !state.recovery && !state.manualSaveRequired && !busy;
  const run = (kind: NotesInsertKind | NotesStyleKind, type: "insert" | "style", table?: { rows: number; columns: number }, html?: { empty: boolean }) => {
    if (!editable || flight.current) return;
    // Revalidate against this render's installed catalog, even when invoked programmatically.
    if (!(type === "insert" ? insert : styles).some(item => item.kind === kind)) return;
    const abort = new AbortController(); flight.current = abort; setBusy(true); setMessage("");
    const before = JSON.stringify(props.controller.getState().draft ?? props.controller.getState().snapshot?.document);
    void Promise.resolve().then(() => { if (!abort.signal.aborted) return type === "insert" ? notesRequestInsertion(props.bridge, kind as NotesInsertKind, abort.signal, table || html ? { ...(table ? { table } : {}), ...(html ? { html } : {}) } : undefined) : props.bridge.format(kind as NotesStyleKind, abort.signal); }).then(() => {
      if (!mounted.current || abort.signal.aborted) return;
      const latest = props.controller.getState();
      if (type === "insert" && before === JSON.stringify(latest.draft ?? latest.snapshot?.document)) throw new Error("挿入結果を確認できませんでした。本文の挿入位置を選び直してください");
      const message = latest.dirty ? "本文に反映しました。未保存です" : "本文と保存状態を確認しました";
      feedback ? feedback.announce(message, "success") : setMessage(message);
    }).catch(error => { if (mounted.current && !abort.signal.aborted && !(error instanceof Error && error.message === "Insertion cancelled")) { const message = error instanceof Error && /^(本文の挿入位置|挿入結果)/.test(error.message) ? error.message : "本文を変更できませんでした"; feedback ? feedback.announce(message, "error") : setMessage(message); } }).finally(() => { if (flight.current === abort) { flight.current = null; if (mounted.current) setBusy(false); } });
  };
  const closeTable = () => { setHtmlOpen(false); setTableOpen(false); tableOpener.current?.focus({ preventScroll: true }); };
  const chooseInsert = (kind: NotesInsertKind, opener: HTMLButtonElement) => {
    if (props.bridge.requestInsert) { run(kind, "insert"); return; }
    if (kind === "htmlEmbed") { tableOpener.current = opener; setHtmlOpen(true); setHover(null); return; }
    if (kind !== "tableInsert") { run(kind, "insert"); return; }
    if (!editable || !insert.some(item => item.kind === kind)) return;
    tableOpener.current = opener; setTableSize({ rows: 2, columns: 2 }); setTableOpen(true); setHover(null);
  };
  const htmlPicker = htmlOpen ? <NotesOverlayPortal anchor={tableOpener.current} onDismiss={closeTable}><div className="oe-notes-table-picker" role="dialog" aria-modal="true" aria-label="HTML ウィジェットの初期表示" tabIndex={-1} ref={tableRoot} onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event)) { event.preventDefault(); event.stopPropagation(); closeTable(); } }}><header><strong>HTML ウィジェット</strong><button type="button" onClick={closeTable}>キャンセル</button></header><p>組込みデザインは挿入後に編集できます</p><button type="button" disabled={!editable} onClick={() => { closeTable(); run("htmlEmbed", "insert", undefined, { empty: false }); }}>デザイン付きで挿入</button><button type="button" disabled={!editable} onClick={() => { closeTable(); run("htmlEmbed", "insert", undefined, { empty: true }); }}>空で挿入</button></div></NotesOverlayPortal> : null;
  const tablePicker = tableOpen ? <NotesOverlayPortal anchor={tableOpener.current} onDismiss={closeTable}><div className="oe-notes-table-picker" role="dialog" aria-modal="true" aria-label="表のサイズ" tabIndex={-1} ref={tableRoot} onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event)) { event.preventDefault(); event.stopPropagation(); closeTable(); } }}>
    <header><strong>表のサイズ</strong><button type="button" onClick={closeTable}>キャンセル</button></header><p>{tableSize.rows}行 × {tableSize.columns}列</p>
    <div className="oe-notes-table-grid">{Array.from({ length: 25 }, (_, index) => { const rows = Math.floor(index / 5) + 1, columns = index % 5 + 1; return <button type="button" key={index} aria-label={`${rows}行 ${columns}列の表を挿入`} data-selected={rows <= tableSize.rows && columns <= tableSize.columns} disabled={!editable} onMouseEnter={() => setTableSize({ rows, columns })} onFocus={() => setTableSize({ rows, columns })} onMouseDown={event => event.preventDefault()} onClick={() => { closeTable(); run("tableInsert", "insert", { rows, columns }); }}>{rows}×{columns}</button>; })}</div>
  </div></NotesOverlayPortal> : null;
  if (props.classic) {
    const ja = props.language === "ja", labels = ja ? LABELS : { insert: "Insert", style: "Style", info: "Info" };
    const styleKey = notesMetadataField(props.pageAppearance?.fields?.style);
    const blocks = (state.draft ?? state.snapshot?.document)?.blocks ?? [];
    const text = entries.map(entry => entry.text).filter(Boolean).join(" ");
    const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
    const count = (types: string[]) => entries.filter(entry => types.includes(entry.type)).length;
    const items = selected === "insert" ? insertCatalog : NOTES_STYLE_CATALOG;
    const available = selected === "insert" ? insert : styles;
    const chooseStyle = (value: string) => { if (styleKey && metadata.available("metadata.patch")) void metadata.execute({ kind: "metadata.patch", fields: { [styleKey]: value } }); };
    const cards = <div className="oe-notes-page-style-grid">{NOTES_PAGE_STYLES.map(value => <button type="button" key={value} aria-label={value[0]!.toUpperCase() + value.slice(1)} aria-pressed={props.pageStyle === value} disabled={!styleKey || !metadata.available("metadata.patch")} onClick={() => chooseStyle(value)}><span className="oe-notes-style-preview" data-style={value}><strong>Aa</strong><small>{value[0]!.toUpperCase() + value.slice(1)}</small><i /></span><span className="oe-notes-style-name"><NotesIcon name={value === "mono" || value === "blueprint" ? "code" : "text"} />{value[0]!.toUpperCase() + value.slice(1)}</span></button>)}</div>;
    return <aside onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event)) { retainHover(); setHover(null); } }} className="oe-notes-inspector oe-notes-classic-inspector" aria-label={ja ? "文書のツール" : "Document tools"}>
      <header className="oe-notes-rail-header"><div><strong>{ja ? "文書のツール" : "Document tools"}</strong><button type="button" aria-label={ja ? "集中モード" : "Focus mode"} disabled={!props.onFocusMode} onClick={props.onFocusMode}><NotesIcon name="focus" /></button></div><span>{ja ? "クリックで追加・ドラッグで配置" : "Click to add · drag to place"}</span></header>
      <div className="oe-notes-tabs" hidden={props.hideTabs} role="tablist" aria-label={ja ? "ツールの種類" : "Tool categories"}>{tabs.map(id => <button type="button" key={id} role="tab" aria-label={labels[id]} aria-selected={selected === id} aria-controls={`${uid}-panel-${id}`} id={`${uid}-tab-${id}`} tabIndex={selected === id ? 0 : -1} disabled={toolsDialogOpen} onClick={() => { setTab(id); props.onPanelChange?.(id); }} onKeyDown={event => { if (toolsDialogOpen || notesIsComposing(event)) return; const index = tabs.indexOf(id), next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : undefined; if (next === undefined) return; event.preventDefault(); setTab(tabs[next]!); props.onPanelChange?.(tabs[next]!); event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus(); }}><NotesIcon name={id} /><span>{labels[id]}</span></button>)}</div>
      {selected ? <section className="oe-notes-panel oe-notes-rail-list" role="tabpanel" id={`${uid}-panel-${selected}`} aria-labelledby={props.hideTabs ? undefined : `${uid}-tab-${selected}`} aria-label={props.hideTabs ? labels[selected] : undefined} tabIndex={0} data-panel={selected}>
        {selected === "style" ? <section className="oe-notes-appearance-panel"><div><strong>{ja ? "ページ書式" : "Page style"}</strong><small>{ja ? "ノートの雰囲気を変更" : "Change the feel of this note"}</small></div><NotesStyleGalleryButton controller={props.controller} appearance={props.pageAppearance} language={ja ? "ja" : "en"} />{cards}</section> : null}
        {selected !== "info" ? items.map(item => { const supported = available.some(value => value.kind === item.kind), label = ja ? item.label : selected === "insert" ? INSERT_EN[item.kind as NotesInsertKind] : STYLE_EN[item.kind as NotesStyleKind]; return <div className="oe-notes-tool-item" key={item.kind}><button type="button" className={selected === "style" ? "oe-notes-tool-button oe-notes-style-button" : "oe-notes-tool-button"} data-notes-insert-kind={selected === "insert" ? item.kind : undefined} disabled={!editable || !supported} aria-describedby={hover?.kind === item.kind ? `${uid}-tool-preview` : undefined} title={supported ? undefined : notesCatalogUnavailable(item, selected === "insert" ? props.bridge.supportedInsertActions : props.bridge.supportedStyleActions, props.bridge.installedBlockTypes) === "feature" ? (ja ? "この編集機能は未設定です" : "Requires an installed editor feature") : (ja ? "ホスト接続が必要です" : "Requires an authorized host binding")} aria-label={label} draggable={selected === "insert" && editable && supported} onDragStart={event => {
          if (selected !== "insert" || !editable || !supported || !state.snapshot) { event.preventDefault(); return; }
          retainHover(); setHover(null); dragClickUntil.current = Date.now() + 700;
          dragPayload.current = beginNotesToolDrag(notesPanelIdentity(props.controller, state.snapshot), item.kind as NotesInsertKind); event.dataTransfer.setData(NOTES_TOOL_DRAG_MIME, dragPayload.current); event.dataTransfer.effectAllowed = "copy";
        }} onDragEnd={() => { if (dragPayload.current) endNotesToolDrag(dragPayload.current); dragPayload.current = undefined; dragClickUntil.current = Date.now() + 700; }} onMouseDown={event => { if (!event.currentTarget.draggable) event.preventDefault(); }} onMouseEnter={event => queueHover(item.kind, event.currentTarget)} onMouseLeave={leaveHover} onFocus={event => { retainHover(); showHover(item.kind, event.currentTarget); }} onBlur={() => { retainHover(); setHover(null); }} onClick={event => { retainHover(); setHover(null); if (Date.now() < dragClickUntil.current) return; selected === "insert" ? chooseInsert(item.kind as NotesInsertKind, event.currentTarget) : run(item.kind, "style"); }}><NotesIcon name={item.kind} /><span>{selected === "style" ? <><strong>{label}</strong><small>{ja ? "選択したブロックに反映" : STYLE_HINTS[item.kind as NotesStyleKind]}</small></> : label}</span></button>{hover?.kind === item.kind ? <div id={`${uid}-tool-preview`} className="oe-notes-tool-hover" role="tooltip" onMouseEnter={retainHover} onMouseLeave={leaveHover} style={{ "--oe-hover-left": `${hover.left}px`, "--oe-hover-top": `${hover.top}px` } as CSSProperties}><strong>{label}</strong><NotesToolPreview kind={item.kind} /><p>{supported ? (ja ? selected === "insert" ? "クリックで追加・ドラッグで位置を指定" : "選択した本文に適用" : selected === "insert" ? "Click to add · drag to place" : "Apply to selected content") : (ja ? "対応するホスト機能を接続してください" : "Connect the corresponding host capability")}</p></div> : null}</div>; }) : <>
          <div className="oe-notes-metrics">{[[blocks.length, ja ? "ブロック" : "blocks"], [words, ja ? "単語" : "words"], [text.length, ja ? "文字" : "chars"]].map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
          <section className="oe-notes-structure"><header className="oe-notes-info-section-header"><strong>{ja ? "文書の構造" : "Document structure"}</strong><small>{ja ? "現在の文書の概要" : "Live document overview"}</small></header><dl>{[[ja ? "見出し" : "Headings", count(["heading"])], [ja ? "タスク" : "Tasks", `${entries.filter(entry => entry.type === "checkListItem" && blocks.find(block => block.id === entry.blockId)?.props?.checked).length}/${count(["checkListItem"])}`], [ja ? "メディア" : "Media", count(["image", "video", "audio", "file"])], [ja ? "表" : "Tables", count(["table"])], [ja ? "リンク" : "Links", blocks.filter(block => /https?:\/\//.test(textFromBlock(block))).length], [ja ? "読む時間" : "Read time", `${Math.max(1, Math.ceil(words / 200))}m`]].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></section>
        </>}
        <div className="oe-notes-retained-info-tools" hidden={selected !== "info"}>{props.infoTools ? <div ref={toolsRoot}>{props.infoTools}</div> : null}<p className="oe-notes-tool-help">{ja ? "保存状態は上部で確認できます" : "Check the save state above. Export preserves the current document."}</p></div>
      </section> : null}
      {busy ? <button type="button" onClick={() => { flight.current?.abort(); flight.current = null; setBusy(false); }}>{ja ? "キャンセル" : "Cancel tool action"}</button> : null}{message || metadata.message || state.pendingEditors || state.dirty || state.status === "unknown" || state.status === "saving" ? <NotesPanelStatus controller={props.controller} message={message || metadata.message} tone={metadata.messageTone} ambient /> : null}
      {tablePicker}{htmlPicker}
  </aside>;
  }
  return <aside className={["oe-notes-inspector", props.className].filter(Boolean).join(" ")} aria-label="編集のツール">
    <header><h2>編集</h2></header><div className="oe-notes-tabs" role="tablist" aria-label="編集のツール">{tabs.map((id, index) => <button type="button" key={id} role="tab" id={`${uid}-tab-${id}`} aria-controls={`${uid}-panel-${id}`} aria-selected={selected === id} tabIndex={selected === id ? 0 : -1} data-notes-tab-index={index} disabled={toolsDialogOpen} onClick={() => { setTab(id); props.onPanelChange?.(id); }} onKeyDown={event => {
      if (notesIsComposing(event)) return;
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % tabs.length : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index + tabs.length - 1) % tabs.length : undefined;
      if (next === undefined) return; event.preventDefault(); setTab(tabs[next]!); props.onPanelChange?.(tabs[next]!); event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-notes-tab-index="${next}"]`)?.focus();
    }}>{LABELS[id]}</button>)}</div>
    {selected ? <section className="oe-notes-panel" role="tabpanel" id={`${uid}-panel-${selected}`} aria-labelledby={`${uid}-tab-${selected}`} tabIndex={0}>
      {selected === "insert" ? <><h3>挿入</h3>{insert.length ? <div className="oe-notes-catalog">{insert.map(item => <button type="button" key={item.kind} disabled={!editable} onMouseDown={event => event.preventDefault()} onClick={event => chooseInsert(item.kind, event.currentTarget)} aria-label={item.label} title={item.label}><NotesIcon name={item.kind} /><span>{item.label}</span></button>)}</div> : <p>挿入ツールが接続されていません</p>}<p>選択位置に挿入します。HTML の JavaScript は実行されません。</p></> : null}
      {selected === "style" ? <><h3>選択した本文の書式</h3>{styles.length ? <div className="oe-notes-catalog">{styles.map(item => <button type="button" key={item.kind} disabled={!editable} onMouseDown={event => event.preventDefault()} onClick={() => run(item.kind, "style")} aria-label={item.label} title={item.label}><NotesIcon name={item.kind} /><span>{item.label}</span></button>)}</div> : <p>書式ツールが接続されていません</p>}</> : null}
      {selected === "info" ? <><h3>現在の文書</h3><dl><dt>タイトル</dt><dd>{state.draftTitle ?? state.snapshot?.title ?? "—"}</dd><dt>ブロック</dt><dd>{props.bridge.index.size()}</dd><dt>状態</dt><dd>{!props.bridge.editable ? "読み取り専用" : state.dirty ? "未保存の変更" : state.status === "ready" ? "保存を確認済み" : state.message || state.status}</dd></dl></> : null}
    </section> : null}
    {busy ? <button type="button" onClick={() => { flight.current?.abort(); flight.current = null; setBusy(false); setMessage("操作を中断しました。本文と保存状態を確認してください"); }}>挿入・書式をキャンセル</button> : null}
    <NotesPanelStatus controller={props.controller} message={message} ambient />
    {tablePicker}{htmlPicker}
  </aside>;
}
