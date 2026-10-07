import { createExtension, nodeToBlock } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { fromBlockNote } from "../adapter/fromBlockNote.js";
import { toBlockNoteForSchema } from "../adapter/toBlockNote.js";
import type { BlockLike } from "../types.js";
import { createDocumentColumns, DOCUMENT_COLUMN_TYPE, DOCUMENT_COLUMNS_TYPE, updateDocumentColumns, validateDocumentColumns, type DocumentColumnsAction } from "./columns.js";
import { createHtmlWidgetPreview, HTML_WIDGET_PRESETS, HTML_WIDGET_TYPE, parseHtmlWidgetSource, type HtmlWidgetSource } from "./htmlWidget.js";
import { useEditorLocalDraft, type EditorLocalDraftLifecycle } from "./draftLifecycle.js";

type WorkspaceEditor = {
  document: BlockLike[];
  schema: { blockSchema: Record<string, unknown> };
  isEditable: boolean;
  transact(callback: () => void): unknown;
  replaceBlocks(old: readonly BlockLike[], next: unknown[]): unknown;
  updateBlock(id: string, update: { props: Record<string, string | number | boolean> }): unknown;
  getTextCursorPosition(): { block: { id: string } };
  setTextCursorPosition(id: string, placement?: "start" | "end"): void;
};

/** One validated replacement inside one public editor transaction; never mutates PM DOM. */
export function applyDocumentColumnsAction(editor: WorkspaceEditor, action: DocumentColumnsAction): void {
  if (!editor.isEditable) throw new Error("Document is read-only");
  const before = fromBlockNote(editor.document), next = updateDocumentColumns(before, action);
  if (action.type === "width") { editor.updateBlock(action.columnId, { props: { width: action.width } }); return; }
  const content = toBlockNoteForSchema(next, editor.schema);
  const cursor = editor.getTextCursorPosition().block.id;
  editor.transact(() => {
    editor.replaceBlocks(editor.document, content);
    if (findBlock(next.blocks, cursor)) editor.setTextCursorPosition(cursor);
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

function ColumnsHeading({ block, editor }: { block: BlockLike & { id: string }; editor: WorkspaceEditor }): ReactElement {
  const [error, setError] = useState<string | null>(null);
  return <div className="oe-document-columns-heading" contentEditable={false}>
    <span>Columns · {(block.children ?? []).length}</span>
    <button type="button" disabled={!editor.isEditable} onMouseDown={event => event.preventDefault()} onClick={() => { try { applyDocumentColumnsAction(editor, { type: "unwrap", groupId: block.id }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to unwrap columns"); } }}>Stack content</button>
    {error ? <span role="alert">{error}</span> : null}
  </div>;
}

function ColumnHeading({ block, editor }: { block: BlockLike & { id: string }; editor: WorkspaceEditor }): ReactElement {
  const width = Number(block.props?.width ?? 1), [draft, setDraft] = useState(width), [error, setError] = useState<string | null>(null);
  useEffect(() => setDraft(width), [width]);
  const group = findColumnGroup(editor.document, block.id), columns = group?.children ?? [], index = columns.findIndex(child => child.id === block.id);
  const run = (action: DocumentColumnsAction): void => { try { applyDocumentColumnsAction(editor, action); setError(null); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to change columns"); } };
  const commitWidth = (): void => {
    if (draft === width) return;
    if (Number(findBlock(editor.document, block.id)?.props?.width ?? 1) !== width) { setError("The width changed elsewhere. Reopen this control."); return; }
    run({ type: "width", columnId: block.id, width: draft });
  };
  return <div className="oe-document-column-heading" contentEditable={false} onKeyDown={event => event.stopPropagation()}>
    <span>Column {index + 1}</span>
    <label>Width <input aria-label={`Column ${index + 1} relative width`} type="range" min="0.1" max="4" step="0.1" disabled={!editor.isEditable} value={draft} onChange={event => setDraft(Number(event.target.value))} onPointerUp={commitWidth} onPointerCancel={() => setDraft(width)} onKeyUp={commitWidth} onBlur={commitWidth} /></label>
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
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}

export const createDocumentColumnsBlockSpec = createReactBlockSpec({ type: DOCUMENT_COLUMNS_TYPE, propSchema: { gap: { default: 16 } }, content: "none" }, {
  render: ({ block, editor }) => <ColumnsHeading block={block} editor={editor as unknown as WorkspaceEditor} />
});
export const createDocumentColumnBlockSpec = createReactBlockSpec({ type: DOCUMENT_COLUMN_TYPE, propSchema: { width: { default: 1 } }, content: "none" }, {
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
  return { version: 1, base: cached.base, draft: parseHtmlWidgetSource(cached.draft), part: cached.part as keyof HtmlWidgetSource };
}

function HtmlWidgetDraft({ block, editor, lifecycle }: { block: BlockLike & { id: string }; editor: WorkspaceEditor; lifecycle: EditorLocalDraftLifecycle }): ReactElement {
  const source = sourceFor(block), key = JSON.stringify(source);
  let recovered: HtmlWidgetDraftCache | undefined, recoveryError: string | null = null;
  try { recovered = htmlDraftCache(lifecycle.value); } catch (error) { recoveryError = error instanceof Error ? error.message : "Original cached draft retained"; }
  const [draft, setDraft] = useState<HtmlWidgetSource | null>(() => recovered?.draft ?? (recoveryError ? source : null)), [base, setBase] = useState(() => recovered?.base ?? (recoveryError ? key : "")), [part, setPart] = useState<keyof HtmlWidgetSource>(() => recovered?.part ?? "html"), [mobile, setMobile] = useState(false), [error, setError] = useState<string | null>(() => recoveryError), [invalidCache, setInvalidCache] = useState(() => Boolean(recoveryError)), [composing, setComposing] = useState(false);
  const opener = useRef<HTMLButtonElement>(null), input = useRef<HTMLTextAreaElement>(null), file = useRef<HTMLInputElement>(null), importGeneration = useRef(0), restoreFocus = useRef(false), composingRef = useRef(false);
  useEffect(() => () => { importGeneration.current++; }, []);
  useEffect(() => { if (draft) input.current?.focus(); }, [Boolean(draft), part]);
  useEffect(() => { if (!draft && restoreFocus.current) { restoreFocus.current = false; opener.current?.focus(); } }, [Boolean(draft)]);
  const cache = (next: HtmlWidgetSource, nextBase = base, nextPart = part): void => { lifecycle.set({ version: 1, base: nextBase, draft: { ...next }, part: nextPart }); };
  const changeDraft = (next: HtmlWidgetSource): void => { if (invalidCache) return; try { cache(next); setDraft(next); setError(null); } catch (reason) { setError(reason instanceof Error ? reason.message : "Source draft could not be retained"); } };
  const close = (): void => {
    if (composingRef.current) return;
    try { lifecycle.set(undefined); importGeneration.current++; restoreFocus.current = true; setDraft(null); setError(null); setInvalidCache(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Original cached draft retained"); }
  };
  let preview = "";
  try { preview = createHtmlWidgetPreview(draft ?? source); } catch { /* Oversized/corrupt sources remain visible/editable, never silently truncated. */ }
  const download = (): void => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ schemaVersion: 1, ...source }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "openeditor-widget.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return <section className="oe-html-widget" contentEditable={false} aria-label="HTML widget" onKeyDown={event => { event.stopPropagation(); if (event.key === "Escape" && draft && !event.nativeEvent.isComposing && !composingRef.current) { event.preventDefault(); close(); } }}>
    <header><strong>{String(block.props?.title || "HTML widget")}</strong><span>Isolated preview · scripts and network disabled</span></header>
    <div className="oe-html-widget-controls">
      <button ref={opener} type="button" disabled={!editor.isEditable || Boolean(draft) || !lifecycle.available} onClick={() => { try { cache(source, key, part); importGeneration.current++; setBase(key); setDraft(source); setError(null); } catch (reason) { setError(reason instanceof Error ? reason.message : "Source draft could not be retained"); } }}>Edit source</button>
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
      <div className="oe-html-widget-controls" role="group" aria-label="Source language">{(["html", "css", "javascript"] as const).map(language => <button type="button" aria-pressed={part === language} disabled={invalidCache || composing} key={language} onClick={() => { try { cache(draft, base, language); setPart(language); } catch (reason) { setError(reason instanceof Error ? reason.message : "Source draft could not be retained"); } }}>{language.toUpperCase()}</button>)}</div>
      <textarea ref={input} aria-label={`${part.toUpperCase()} source`} spellCheck={false} disabled={invalidCache} value={draft[part]} onCompositionStart={() => { composingRef.current = true; setComposing(true); lifecycle.setComposition(true); }} onCompositionEnd={() => { composingRef.current = false; setComposing(false); lifecycle.setComposition(false); }} onChange={event => changeDraft({ ...draft, [part]: event.target.value })} />
      <div className="oe-html-widget-controls"><button type="button" disabled={!editor.isEditable || invalidCache || composing} onClick={() => {
        if (composingRef.current) return;
        try {
          lifecycle.assertCurrent();
          const current = findBlock(editor.document, block.id);
          if (!current || JSON.stringify(sourceFor(current)) !== base) throw new Error("The widget changed elsewhere. Cancel and reopen to keep both edits.");
          editor.updateBlock(block.id, { props: parseHtmlWidgetSource(draft) }); close();
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Source could not be saved"); }
      }}>Apply source</button><button type="button" disabled={composing} onClick={close}>Cancel</button></div>
    </div> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}

export const createHtmlWidgetBlockSpec = createReactBlockSpec({ type: HTML_WIDGET_TYPE, propSchema: { title: { default: "HTML widget" }, html: { default: "" }, css: { default: "" }, javascript: { default: "" } }, content: "none" }, {
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
      const cached = layouts.get(state.doc);
      if (cached) return cached;
      const decorations: Decoration[] = [];
      state.doc.descendants((node, position) => {
        if (node.type.name !== "blockContainer" || node.firstChild?.type.name !== DOCUMENT_COLUMNS_TYPE) return;
        const group = node.lastChild;
        if (!group || group.type.name !== "blockGroup") return;
        const widths: number[] = [];
        group.forEach(column => widths.push(Number(column.firstChild?.attrs.width ?? 1)));
        if (widths.some(width => !Number.isFinite(width) || width <= 0 || width > 10)) return;
        const gap = Number(node.firstChild.attrs.gap ?? 16);
        if (!Number.isFinite(gap) || gap < 0 || gap > 64) return;
        decorations.push(Decoration.node(position, position + node.nodeSize, { "data-oe-document-columns": "true", style: `--oe-document-column-tracks:${widths.map(width => `minmax(0,${width}fr)`).join(" ")};--oe-document-column-gap:${gap}px` }));
      });
      const result = DecorationSet.create(state.doc, decorations);
      layouts.set(state.doc, result);
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
    extensions: [DocumentColumnsGuard()],
    commands: [
      { id: "document-columns", title: "Columns", group: "document" as const, surfaces: ["slash", "palette"] as import("../commands/registry.js").CommandSurface[], run: ({ editor }: import("../commands/registry.js").EditorCommandContext) => {
        const group = createDocumentColumns([[{ id: crypto.randomUUID(), type: "paragraph", content: "" }], [{ id: crypto.randomUUID(), type: "paragraph", content: "" }]]);
        editor.insertBlocks([group], editor.getTextCursorPosition().block, "after");
      } },
      { id: "document-html-widget", title: "HTML widget", group: "document" as const, surfaces: ["slash", "palette"] as import("../commands/registry.js").CommandSurface[], run: ({ editor }: import("../commands/registry.js").EditorCommandContext) => {
        editor.insertBlocks([{ type: HTML_WIDGET_TYPE, props: { ...HTML_WIDGET_PRESETS[1]!.source } }], editor.getTextCursorPosition().block, "after");
      } }
    ]
  };
}
