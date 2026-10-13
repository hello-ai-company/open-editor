import { parseNotesHtmlRawSource } from "../notes/htmlSourceDraft.js";
import { createExtension, nodeToBlock } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactElement } from "react";
import { fromBlockNote } from "../adapter/fromBlockNote.js";
import { toBlockNoteForSchema } from "../adapter/toBlockNote.js";
import type { BlockLike } from "../types.js";
import { createDocumentColumns, DOCUMENT_COLUMN_TYPE, DOCUMENT_COLUMNS_TYPE, MAX_DOCUMENT_COLUMNS, updateDocumentColumns, validateDocumentColumns, type DocumentColumnsAction } from "./columns.js";
import { DocumentColumnResizing, documentColumnResizeKey } from "./columnResize.js";
import { applyDocumentBlockMove, DocumentBlockMovement } from "./blockMovement.js";
import { createHtmlWidgetPreview, HTML_WIDGET_PRESETS, HTML_WIDGET_TYPE, parseHtmlWidgetSource, type HtmlWidgetSource } from "./htmlWidget.js";
import { useEditorLocalDraft, type EditorLocalDraftLifecycle } from "./draftLifecycle.js";
import { interactiveBlockMeta } from "./widgetInteraction.js";
import { createCodeClipboardSelectionExtension } from "./codeClipboardSelection.js";
import { NotesIcon } from "../react/notesPresentation.js";

type WorkspaceEditor = {
  document: BlockLike[];
  schema: { blockSchema: Record<string, unknown> };
  isEditable: boolean;
  transact(callback: () => void): unknown;
  replaceBlocks(old: readonly BlockLike[], next: unknown[]): unknown;
  updateBlock(id: string, update: { props?: Record<string, string | number | boolean>; children?: BlockLike[] }): unknown;
  getTextCursorPosition(): { block: { id: string } };
  setTextCursorPosition(id: string, placement?: "start" | "end"): void;
  onChange?(listener: () => void): () => void;
  focus?(): void;
  prosemirrorView?: { dom: HTMLElement };
  removeBlocks?(ids: string[]): unknown;
  insertBlocks?(blocks: unknown[], anchor: string, placement: "before" | "after"): unknown;
};

/** One validated replacement inside one public editor transaction; never mutates PM DOM. */
export function applyDocumentColumnsAction(editor: WorkspaceEditor, action: DocumentColumnsAction): void {
  if (!editor.isEditable) throw new Error("Document is read-only");
  const before = fromBlockNote(editor.document), next = updateDocumentColumns(before, action);
  if (action.type === "resize-pair") {
    const group = [...(editor.prosemirrorView?.dom.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]") ?? [])].find(el => el.dataset.id === action.groupId);
    if (group?.querySelector("[data-oe-width-draft=true]")) throw Error("Finish or cancel the retained width input before resizing. Your input is retained.");
    editor.transact(() => { editor.updateBlock(action.leftId, { props: { width: action.leftWidth } }); editor.updateBlock(action.rightId, { props: { width: action.rightWidth } }); }); return;
  }
  if (action.type === "width") { editor.updateBlock(action.columnId, { props: { width: action.width } }); return; }
  if (action.type === "move" && editor.removeBlocks && editor.insertBlocks) {
    const children = findBlock(next.blocks, action.columnId)?.children ?? [], following = children[action.index + 1], previous = children[action.index - 1];
    applyDocumentBlockMove(editor as Parameters<typeof applyDocumentBlockMove>[0], { blockId: action.blockId, anchorId: following?.id ?? previous?.id ?? action.columnId, placement: following ? "before" : previous ? "after" : "inside-end" }); return;
  }
  const guardIds = action.type === "move" ? undefined : [action.groupId];
  if (editor.prosemirrorView && [...editor.prosemirrorView.dom.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]")].some(el => (!guardIds || guardIds.includes(el.dataset.id!)) && el.querySelector(".oe-html-widget-editor,[data-oe-width-draft=true]"))) throw Error("Finish or cancel source editing before changing these columns. Your input is retained.");
  const content = toBlockNoteForSchema(next, editor.schema);
  let cursor: string | undefined;
  try { cursor = editor.getTextCursorPosition().block.id; } catch { /* Structural handles do not require a text selection. */ }
  editor.transact(() => {
    if (action.type !== "move") {
      const oldGroup = findBlock(editor.document, action.groupId)!;
      if (action.type === "unwrap") {
        const flat = oldGroup.children?.flatMap(column => column.children ?? []) ?? [];
        editor.replaceBlocks([oldGroup], toBlockNoteForSchema(fromBlockNote(flat), editor.schema));
      } else {
        const group = findBlock(content, action.groupId)!;
        editor.updateBlock(action.groupId, { children: [...group.children ?? []] });
      }
    } else editor.replaceBlocks(editor.document, content);
    if (cursor && findBlock(next.blocks, cursor)) editor.setTextCursorPosition(cursor);
  });
}

function findBlock(blocks: readonly BlockLike[], id: string): BlockLike | undefined {
  for (const block of blocks) {
    if (block.id === id) return block;
    const nested = findBlock(block.children ?? [], id);
    if (nested) return nested;
  }
  return undefined;
}

function findColumnGroup(blocks: readonly BlockLike[], id: string): BlockLike | undefined {
  for (const block of blocks) {
    if (block.type === DOCUMENT_COLUMNS_TYPE && block.children?.some(child => child.id === id)) return block;
    const nested = findColumnGroup(block.children ?? [], id);
    if (nested) return nested;
  }
  return undefined;
}
function closeColumnsMenu(event: import("react").KeyboardEvent<HTMLElement>): void {
  if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
  const details = event.currentTarget.querySelector<HTMLDetailsElement>("details[open]");
  if (!details) return;
  event.preventDefault(); event.stopPropagation(); details.open = false; details.querySelector<HTMLElement>("summary")?.focus();
}
function useColumnMembership(editor: WorkspaceEditor, id: string, group: boolean): readonly string[] {
  const subscribe = useCallback((listener: () => void) => editor.onChange?.(listener) ?? (() => undefined), [editor]);
  const read = () => JSON.stringify({ members: (group ? findBlock(editor.document, id) : findColumnGroup(editor.document, id))?.children?.map(child => child.id) ?? [], content: group ? [] : findBlock(editor.document, id)?.children?.map(child => child.id) ?? [] });
  return (JSON.parse(useSyncExternalStore(subscribe, read, read)) as { members: string[] }).members;
}

function ColumnsHeading({ block, editor }: { block: BlockLike & { id: string }; editor: WorkspaceEditor }): ReactElement {
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLDivElement>(null), [gutter, setGutter] = useState({ left: -62, top: 0 });
  const members = useColumnMembership(editor, block.id, true);
  useEffect(() => {
    const element = heading.current, owner = element?.closest<HTMLElement>(".bn-block-outer"), win = element?.ownerDocument.defaultView;
    if (!owner || !win) return;
    const update = () => { const rect = owner.getBoundingClientRect(), coarse = win.matchMedia("(pointer:coarse)").matches, width = coarse ? 88 : 48, height = coarse ? 44 : 28;
      const left = Math.max(-width - 14, 8 - rect.left), top = Math.max(rect.left >= width + 12 ? 0 : -height - 4, 8 - rect.top);
      setGutter(before => before.left === left && before.top === top ? before : { left, top }); };
    const observer = typeof win.ResizeObserver === "function" ? new win.ResizeObserver(update) : undefined; observer?.observe(owner); win.addEventListener("resize", update); win.addEventListener("scroll", update, true); update();
    return () => { observer?.disconnect(); win.removeEventListener("resize", update); win.removeEventListener("scroll", update, true); };
  }, []);
  return <div ref={heading} className="oe-document-columns-heading" style={{ left: gutter.left, top: gutter.top }} contentEditable={false} onKeyDown={closeColumnsMenu}>
    <button className="oe-block-move-handle" type="button" data-oe-move-id={block.id} aria-label="Move Columns. Use Alt and arrow keys" title="Drag Columns · Alt + arrows" disabled={!editor.isEditable}><NotesIcon name="grip" /></button>
    <details className="oe-document-columns-menu"><summary aria-label="Columns options" title="Columns options"><NotesIcon name="columns" /></summary><div className="oe-document-columns-menu-panel">
    <strong>{members.length} columns</strong>
    <button type="button" disabled={!editor.isEditable || members.length >= MAX_DOCUMENT_COLUMNS} onMouseDown={event => event.preventDefault()} onClick={event => { try { applyDocumentColumnsAction(editor, { type: "add-column", groupId: block.id, columnId: crypto.randomUUID(), index: members.length }); setError(null); const details = event.currentTarget.closest("details"); if (details) { details.open = false; details.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true }); } } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to add column"); } }}>Add column</button>
    <button type="button" disabled={!editor.isEditable} onMouseDown={event => event.preventDefault()} onClick={() => { try { applyDocumentColumnsAction(editor, { type: "unwrap", groupId: block.id }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to unwrap columns"); } }}>Stack content</button>
    {error ? <span role="alert">{error}</span> : null}</div></details>
  </div>;
}

function ColumnHeading({ block, editor }: { block: BlockLike & { id: string }; editor: WorkspaceEditor }): ReactElement {
  const members = useColumnMembership(editor, block.id, false);
  const width = Number(block.props?.width ?? 1), [draft, setDraft] = useState(width), [error, setError] = useState<string | null>(null);
  const baseWidth = useRef(width), draftWidth = useRef(width);
  useEffect(() => {
    if (draftWidth.current === baseWidth.current) { baseWidth.current = width; draftWidth.current = width; setDraft(width); }
    else if (width !== baseWidth.current) setError("The width changed elsewhere. Your input is retained. Review the latest width before editing again.");
  }, [width]);
  const group = findColumnGroup(editor.document, block.id), columns = group?.children ?? [], index = members.indexOf(block.id), empty = !findBlock(editor.document, block.id)?.children?.length;
  const run = (action: DocumentColumnsAction): void => { try { applyDocumentColumnsAction(editor, action); setError(null); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to change columns"); } };
  const commitWidth = (): void => {
    if (draft === baseWidth.current) return;
    if (Number(findBlock(editor.document, block.id)?.props?.width ?? 1) !== baseWidth.current) { setError("The width changed elsewhere. Your input is retained. Review the latest width before editing again."); return; }
    try { applyDocumentColumnsAction(editor, { type: "width", columnId: block.id, width: draft }); baseWidth.current = draft; setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to change columns"); }
  };
  return <div className="oe-document-column-heading" data-empty={empty || undefined} data-oe-width-draft={draft !== baseWidth.current || undefined} contentEditable={false} onKeyDown={event => { closeColumnsMenu(event); event.stopPropagation(); }}>
    {empty ? <button className="oe-document-column-empty" type="button" aria-label={`Add text to column ${index + 1}`} disabled={!editor.isEditable} onMouseDownCapture={event => event.stopPropagation()} onClick={() => {
      try {
        if (!editor.isEditable || !findBlock(editor.document, block.id) || findBlock(editor.document, block.id)?.children?.length) return;
        const id = crypto.randomUUID();
        editor.transact(() => { editor.updateBlock(block.id, { children: [{ id, type: "paragraph", content: "" }] }); editor.setTextCursorPosition(id); });
        editor.focus?.(); setError(null);
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to add text"); }
    }}>Add text</button> : null}
    <details className="oe-document-columns-menu"><summary aria-label={`Column ${index + 1} options`} title={`Column ${index + 1} options`}><NotesIcon name="more" /></summary><div className="oe-document-columns-menu-panel">
    <span>Column {index + 1}</span>
    <button className="oe-block-move-handle" type="button" data-oe-move-id={block.id} aria-label={`Move column ${index + 1}. Use Alt and arrow keys`} title="Drag column · Alt + arrows" disabled={!editor.isEditable}><NotesIcon name="grip" /></button>
    <label>Width <input aria-label={`Column ${index + 1} relative width`} type="range" min="0.1" max="4" step="0.1" disabled={!editor.isEditable} value={draft} onChange={event => { draftWidth.current = Number(event.target.value); setDraft(draftWidth.current); }} onPointerUp={commitWidth} onPointerCancel={() => { draftWidth.current = baseWidth.current; setDraft(baseWidth.current); }} onKeyUp={commitWidth} onBlur={commitWidth} /></label>
    <span aria-live="polite">{draft.toFixed(1)}</span>
    <div className="oe-document-column-actions">
      <button type="button" aria-label={`Move column ${index + 1} earlier`} disabled={!editor.isEditable || index <= 0} onMouseDown={event => event.preventDefault()} onClick={() => group?.id && run({ type: "reorder", groupId: group.id, columnId: block.id, index: index - 1 })}>←</button>
      <button type="button" aria-label={`Move column ${index + 1} later`} disabled={!editor.isEditable || index >= columns.length - 1} onMouseDown={event => event.preventDefault()} onClick={() => group?.id && run({ type: "reorder", groupId: group.id, columnId: block.id, index: index + 1 })}>→</button>
      <button type="button" disabled={!editor.isEditable} onMouseDown={event => event.preventDefault()} onClick={() => {
        const cursor = editor.getTextCursorPosition().block.id;
        const alreadyHere = block.children?.some(child => child.id === cursor) ? 1 : 0;
        run({ type: "move", blockId: cursor, columnId: block.id, index: (block.children?.length ?? 0) - alreadyHere });
      }}>Move selected block here</button>
      <button type="button" disabled={!editor.isEditable || columns.length <= 2} onMouseDown={event => event.preventDefault()} onClick={() => {
        const destination = columns[index === 0 ? 1 : index - 1];
        if (group?.id && destination?.id) run({ type: "remove-column", groupId: group.id, columnId: block.id, destinationId: destination.id });
      }}>Merge into neighbour</button>
    </div>
    {error ? <><p role="alert">{error}</p><button type="button" onClick={() => { baseWidth.current = Number(findBlock(editor.document, block.id)?.props?.width ?? width); draftWidth.current = baseWidth.current; setDraft(baseWidth.current); setError(null); }}>Use latest width</button></> : null}</div></details>
  </div>;
}

export const createDocumentColumnsBlockSpec = createReactBlockSpec({ type: DOCUMENT_COLUMNS_TYPE, propSchema: { gap: { default: 16 } }, content: "none" }, {
  meta: interactiveBlockMeta,
  render: ({ block, editor }) => <ColumnsHeading block={block} editor={editor as unknown as WorkspaceEditor} />
});
export const createDocumentColumnBlockSpec = createReactBlockSpec({ type: DOCUMENT_COLUMN_TYPE, propSchema: { width: { default: 1 } }, content: "none" }, {
  meta: interactiveBlockMeta,
  render: ({ block, editor }) => <ColumnHeading block={block} editor={editor as unknown as WorkspaceEditor} />
});

function sourceFor(block: BlockLike): HtmlWidgetSource {
  return { html: String(block.props?.html ?? ""), css: String(block.props?.css ?? ""), javascript: String(block.props?.javascript ?? "") };
}

export function HtmlWidget({ block, editor }: { block: BlockLike & { id: string }; editor: WorkspaceEditor }): ReactElement {
  const lifecycle = useEditorLocalDraft(block.id, "html-widget-source");
  return <HtmlWidgetDraft key={lifecycle.identity} block={block} editor={editor} lifecycle={lifecycle} />;
}

type HtmlWidgetDraftCache = { version: 1; base: string; draft: HtmlWidgetSource; part: keyof HtmlWidgetSource };
function htmlDraftCache(value: unknown): HtmlWidgetDraftCache | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Cached HTML draft is unavailable; original cache is retained. Cancel explicitly to discard it.");
  const cached = value as Record<string, unknown>;
  if (Object.keys(cached).length !== 4 || Object.keys(cached).some(key => !["version", "base", "draft", "part"].includes(key)) || cached.version !== 1 || typeof cached.base !== "string" || cached.base.length > 1_000_000 || !["html", "css", "javascript"].includes(String(cached.part))) throw new Error("Unsupported HTML draft cache; original cache is retained. Cancel explicitly to discard it.");
  return { version: 1, base: cached.base, draft: parseNotesHtmlRawSource(cached.draft), part: cached.part as keyof HtmlWidgetSource };
}

function HtmlWidgetDraft({ block, editor, lifecycle }: { block: BlockLike & { id: string }; editor: WorkspaceEditor; lifecycle: EditorLocalDraftLifecycle }): ReactElement {
  const source = sourceFor(block), key = JSON.stringify(source);
  let recovered: HtmlWidgetDraftCache | undefined, recoveryError: string | null = null;
  try { recovered = htmlDraftCache(lifecycle.value); } catch (error) { recoveryError = error instanceof Error ? error.message : "Original cached draft retained"; }
  const [draft, setDraft] = useState<HtmlWidgetSource | null>(() => recovered?.draft ?? (recoveryError ? source : null)), [base, setBase] = useState(() => recovered?.base ?? (recoveryError ? key : "")), [part, setPart] = useState<keyof HtmlWidgetSource>(() => recovered?.part ?? "html"), [mobile, setMobile] = useState(false), [error, setError] = useState<string | null>(() => recoveryError), [invalidCache, setInvalidCache] = useState(() => Boolean(recoveryError)), [composing, setComposing] = useState(false), [closing, setClosing] = useState(false);
  const opener = useRef<HTMLButtonElement>(null), input = useRef<HTMLTextAreaElement>(null), file = useRef<HTMLInputElement>(null), importGeneration = useRef(0), restoreFocus = useRef(false), composingRef = useRef(false);
  useEffect(() => () => { importGeneration.current++; }, []);
  useEffect(() => { if (draft) input.current?.focus({ preventScroll: true }); }, [Boolean(draft), part]);
  useEffect(() => { if (!draft && restoreFocus.current) { restoreFocus.current = false; opener.current?.focus({ preventScroll: true }); } }, [Boolean(draft)]);
  const cache = (next: HtmlWidgetSource, nextBase = base, nextPart = part): void => { lifecycle.set({ version: 1, base: nextBase, draft: { ...next }, part: nextPart }); };
  const changeDraft = (next: HtmlWidgetSource): void => { if (invalidCache) return; importGeneration.current++; try { cache(next); setDraft(next); setError(null); } catch (reason) { setDraft(next); setError(reason instanceof Error ? reason.message : "Source draft could not be retained"); } };
  const finishClose = (): void => { importGeneration.current++; restoreFocus.current = true; setDraft(null); setError(null); setInvalidCache(false); };
  const close = (): void => {
    if (composingRef.current || closing) return;
    if (!lifecycle.durable) { try { lifecycle.set(undefined); finishClose(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Original cached draft retained"); } return; }
    setClosing(true);
    void lifecycle.discard().then(confirmed => {
      if (!confirmed) throw new Error("Source draft could not be discarded. Original input is retained.");
      // Identity and input may have changed while storage was awaiting.
      lifecycle.assertCurrent(); finishClose();
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Original cached draft retained")).finally(() => setClosing(false));
  };
  let preview = "";
  try { preview = createHtmlWidgetPreview(draft ?? source); } catch { /* Oversized/corrupt sources remain visible/editable, never silently truncated. */ }
  const download = (): void => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ schemaVersion: 1, ...(draft ?? source) }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "openeditor-widget.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return <section className="oe-html-widget" contentEditable={false} aria-label="HTML widget" onKeyDown={event => { event.stopPropagation(); if (event.key === "Escape" && draft && !event.nativeEvent.isComposing && !composingRef.current) { event.preventDefault(); close(); } }}>
    <header><strong>{String(block.props?.title || "HTML widget")}</strong><details className="oe-html-widget-help"><summary>Preview details</summary><span>Isolated preview · scripts and network disabled</span></details></header>
    <div className="oe-html-widget-controls">
      <button ref={opener} type="button" disabled={!editor.isEditable || Boolean(draft) || !lifecycle.available || Boolean(lifecycle.durable?.records.some(record => record.blockId === block.id && record.stage === "applied"))} onClick={() => { try { cache(source, key, part); importGeneration.current++; setBase(key); setDraft(source); setError(null); } catch (reason) { setError(reason instanceof Error ? reason.message : "Source draft could not be retained"); } }}>Edit source</button>
      {!draft && lifecycle.durable?.records.some(record => record.blockId === block.id && record.stage === "applied") ? <button type="button" onClick={() => {
        try { lifecycle.resume(); const retained = lifecycle.durable!.records.find(record => record.blockId === block.id)!; setDraft(retained.input); setBase(JSON.stringify(retained.original)); setPart(retained.part); setError(null); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Retained source could not be resumed"); }
      }}>Review retained source</button> : null}
      <button type="button" aria-pressed={mobile} onClick={() => setMobile(!mobile)}>{mobile ? "Wide preview" : "Mobile preview"}</button>
      <button type="button" onClick={download}>Export source</button>
    </div>
    {lifecycle.unavailableReason ? <p role="status">{lifecycle.unavailableReason}</p> : null}
    {preview ? <iframe title="Isolated HTML widget preview" sandbox="" referrerPolicy="no-referrer" srcDoc={preview} style={{ width: mobile ? "min(100%,320px)" : "100%", height: 240 }} /> : <p role="status">Source exceeds the safe preview budget. Original source is retained.</p>}
    {draft ? <div className="oe-html-widget-editor" role="region" aria-label="Edit widget source">
      <p>HTML and CSS are previewed safely. JavaScript is retained as editable source and never runs here.</p>
      <div className="oe-html-widget-controls">{HTML_WIDGET_PRESETS.map(preset => <button type="button" key={preset.id} disabled={invalidCache || composing} onClick={() => changeDraft({ ...preset.source })}>{preset.title}</button>)}
        <button type="button" disabled={invalidCache || composing} onClick={() => file.current?.click()}>Import source</button>
        <input ref={file} hidden type="file" accept=".json,.html,.htm,application/json,text/html" onChange={event => {
          const selected = event.target.files?.[0]; event.target.value = "";
          if (!selected) return;
          if (selected.size > 800_000) { setError("File exceeds the source budget"); return; }
          const generation = ++importGeneration.current;
          void selected.text().then(text => { if (generation !== importGeneration.current || composingRef.current) return; const imported = selected.name.toLowerCase().endsWith(".json") ? JSON.parse(text) as unknown : { html: text, css: "", javascript: "" }; changeDraft(parseHtmlWidgetSource(imported)); }).catch(reason => { if (generation === importGeneration.current) setError(reason instanceof Error ? reason.message : "Import failed"); });
        }} />
      </div>
      <div className="oe-html-widget-controls" role="group" aria-label="Source language">{(["html", "css", "javascript"] as const).map(language => <button type="button" aria-pressed={part === language} disabled={invalidCache || composing} key={language} onClick={() => { try { cache(draft, base, language); importGeneration.current++; setPart(language); } catch (reason) { setError(reason instanceof Error ? reason.message : "Source draft could not be retained"); } }}>{language.toUpperCase()}</button>)}</div>
      <textarea ref={input} aria-label={`${part.toUpperCase()} source`} spellCheck={false} disabled={invalidCache} value={draft[part]} onCompositionStart={event => { event.stopPropagation(); importGeneration.current++; composingRef.current = true; setComposing(true); lifecycle.setComposition(true); }} onCompositionEnd={event => { event.stopPropagation(); changeDraft({ ...draft, [part]: event.currentTarget.value }); composingRef.current = false; setComposing(false); lifecycle.setComposition(false); }} onInput={event => changeDraft({ ...draft, [part]: event.currentTarget.value })} onChange={event => changeDraft({ ...draft, [part]: event.target.value })} />
      <div className="oe-html-widget-controls"><button type="button" disabled={!editor.isEditable || invalidCache || composing} onMouseDown={event => event.preventDefault()} onClick={() => {
        if (composingRef.current) return;
        try {
          lifecycle.assertSourceCurrent();
          const current = findBlock(editor.document, block.id);
          if (!current || JSON.stringify(sourceFor(current)) !== base) throw new Error("The widget changed elsewhere. Cancel and reopen to keep both edits.");
          const next = parseHtmlWidgetSource(draft);
          if (JSON.stringify(next) === JSON.stringify(sourceFor(current))) { close(); return; }
          editor.updateBlock(block.id, { props: next });
          const applied = findBlock(editor.document, block.id);
          if (!applied || JSON.stringify(sourceFor(applied)) !== JSON.stringify(next)) throw new Error("Source was not applied. Your input is retained; retry or cancel explicitly.");
          lifecycle.applied(); finishClose();
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Source could not be saved"); }
      }}>Apply source</button><button type="button" disabled={composing || closing} onMouseDown={event => event.preventDefault()} onClick={close}>Cancel</button></div>
    </div> : null}
    {lifecycle.durable ? <div className="oe-html-widget-durability" role="status">
      {lifecycle.durable.message}
      {lifecycle.durable.records.some(record => record.blockId === block.id) ? <details><summary>Retained source details</summary>{lifecycle.durable.records.filter(record => record.blockId === block.id).map(record => <div key={record.sequence}><p>{record.stage === "applied" ? "Applied source backup" : "Unapplied source input"} · original revision {record.revision}</p>{(["html", "css", "javascript"] as const).map(language => <details key={language}><summary>{language.toUpperCase()} · original / retained input</summary><pre>{record.original[language]}</pre><pre>{record.input[language]}</pre></details>)}</div>)}</details> : null}
      {lifecycle.durable.records.some(record => record.blockId === block.id && record.stage === "applied") ? <p>Applied locally. The retained source backup remains until this exact body is saved.</p> : null}
      {["error", "conflict"].includes(lifecycle.durable.status) ? <button type="button" disabled={composing} onClick={() => void lifecycle.retry()}>Retry source storage</button> : null}
    </div> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}

export const createHtmlWidgetBlockSpec = createReactBlockSpec({ type: HTML_WIDGET_TYPE, propSchema: { title: { default: "HTML widget" }, html: { default: "" }, css: { default: "" }, javascript: { default: "" } }, content: "none" }, {
  meta: interactiveBlockMeta,
  render: ({ block, editor }) => <HtmlWidget block={block} editor={editor as unknown as WorkspaceEditor} />
});

/** Public editor extension rejects malformed structure before typing/paste/drag/history commits. */
export const DocumentColumnsGuard = createExtension(({ editor }) => {
  const layouts = new WeakMap<object, DecorationSet>();
  return {
  key: "openeditor-document-columns-guard",
  prosemirrorPlugins: [new Plugin({
    key: new PluginKey("openeditor-document-columns-layout"),
    props: { decorations: state => {
      const preview = documentColumnResizeKey.getState(state);
      const cached = !preview && layouts.get(state.doc);
      if (cached) return cached;
      const decorations: Decoration[] = [];
      state.doc.descendants((node, position) => {
        if (node.type.name !== "blockContainer" || node.firstChild?.type.name !== DOCUMENT_COLUMNS_TYPE) return;
        const group = node.lastChild;
        if (!group || group.type.name !== "blockGroup") return;
        const widths: number[] = [];
        group.forEach(column => widths.push(Number(column.firstChild?.attrs.width ?? 1)));
        if (preview && preview.groupId === node.attrs.id) { const ids: string[] = []; group.forEach(column => ids.push(String(column.attrs.id))); const index = ids.indexOf(preview.leftId); if (ids[index + 1] === preview.rightId) { widths[index] = preview.leftWidth; widths[index + 1] = preview.rightWidth; } }
        if (widths.some(width => !Number.isFinite(width) || width <= 0 || width > 10)) return;
        const gap = Number(node.firstChild.attrs.gap ?? 16);
        if (!Number.isFinite(gap) || gap < 0 || gap > 64) return;
        const groupPosition = position + 1 + node.firstChild.nodeSize;
        group.forEach((column, offset, index) => {
          const shares = [2, 3].map(count => { const start = Math.floor(index / count) * count, row = widths.slice(start, start + count), total = row.reduce((a, b) => a + b, 0); return `--oe-column-share-${count}:${widths[index]! / total};--oe-column-gaps-${count}:${row.length - 1}`; }).join(";");
          decorations.push(Decoration.node(groupPosition + 1 + offset, groupPosition + 1 + offset + column.nodeSize, { style: shares }));
        });
        decorations.push(Decoration.node(position, position + node.nodeSize, { "data-oe-document-columns": "true", "data-oe-column-count": String(widths.length), style: `--oe-document-column-tracks:${widths.map(width => `minmax(0,${width}fr)`).join(" ")};--oe-document-column-gap:${gap}px` }));
      });
      const result = DecorationSet.create(state.doc, decorations);
      if (!preview) layouts.set(state.doc, result);
      return result;
    } }
  })],
  mount: () => editor.onBeforeChange(({ tr }) => {
    if (!tr.docChanged) return;
    try {
      // Ordinary documents do not need a full rich-content JSON conversion.
      // Still scan structural nodes so pasted orphan columns cannot bypass the guard.
      let hasColumns = false;
      tr.doc.descendants(node => {
        if (node.type.name === DOCUMENT_COLUMNS_TYPE || node.type.name === DOCUMENT_COLUMN_TYPE) hasColumns = true;
        return !hasColumns && !node.isTextblock;
      });
      if (!hasColumns) return true;
      const group = tr.doc.firstChild;
      if (!group || group.type.name !== "blockGroup") return false;
      const blocks: BlockLike[] = [];
      group.forEach(node => blocks.push(nodeToBlock(node, tr.doc)));
      return validateDocumentColumns(fromBlockNote(blocks)).length === 0;
    } catch { return false; }
  })
  };
});

/** Opt-in independent Document feature; existing 0.2 schemas remain unchanged. */
export function createDocumentWorkspaceFeature() {
  return {
    id: "document-workspace",
    blockSpecs: { oeColumns: createDocumentColumnsBlockSpec(), oeColumn: createDocumentColumnBlockSpec(), oeHtmlWidget: createHtmlWidgetBlockSpec() },
    extensions: [DocumentColumnsGuard(), DocumentBlockMovement(), createCodeClipboardSelectionExtension(), DocumentColumnResizing(applyDocumentColumnsAction)],
    commands: [
      { id: "document-columns", title: "Columns", group: "document" as const, surfaces: ["slash", "palette"] as import("../commands/registry.js").CommandSurface[], run: ({ editor }: import("../commands/registry.js").EditorCommandContext) => {
        const group = createDocumentColumns([[{ id: crypto.randomUUID(), type: "paragraph", content: "" }], [{ id: crypto.randomUUID(), type: "paragraph", content: "" }]]);
        editor.insertBlocks([group], editor.getTextCursorPosition().block, "after");
      } },
      { id: "document-html-widget", title: "HTML widget", group: "document" as const, surfaces: ["slash", "palette"] as import("../commands/registry.js").CommandSurface[], run: ({ editor }: import("../commands/registry.js").EditorCommandContext) => {
        editor.insertBlocks([{ type: HTML_WIDGET_TYPE, props: { ...HTML_WIDGET_PRESETS.find(preset => preset.id === "modern")!.source } }], editor.getTextCursorPosition().block, "after");
      } }
    ]
  };
}
