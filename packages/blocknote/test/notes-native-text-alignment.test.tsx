/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { BlockNoteEditor, createQuoteBlockSpec } from "@blocknote/core";
import { BlockNoteViewRaw, BlockNoteContext, ComponentsContext, getFormattingToolbarItems } from "@blocknote/react";
import { TextSelection } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { serializeEditorDocument } from "@hello-ai-company/editor-core";
import { createOpenEditorPowerPreset } from "../src/features/compose.js";
import { createAlignedQuoteBlockSpec } from "../src/schema/quote.js";
import { fromBlockNote } from "../src/adapter/fromBlockNote.js";
import { toBlockNoteForSchema } from "../src/adapter/toBlockNote.js";
import { importLegacyNotesBlocks, exportLegacyNotesBlocks } from "../src/document/legacyNotes.js";
import { createNotesTextAlignmentPolicy, NOTES_NATIVE_TEXT_ALIGNMENT_ITEMS, notesTextAlignmentAccessAllowed, notesTextAlignmentItemAllowed, type NotesTextAlignmentAccess } from "../src/react/notesTextAlignmentPolicy.js";
import { NotesFormattingToolbar, NotesSelectionActionsContext } from "../src/react/NotesFormattingToolbar.js";
const dispose: (() => void)[] = [];
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { dispose.splice(0).reverse().forEach(fn => fn()); delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; });
const scope = { actorId: "owner", workspaceId: "workspace" };
const types = [["paragraph", "paragraph"], ["heading", "heading"], ["bullet_list", "bulletListItem"], ["numbered_list", "numberedListItem"], ["checklist", "checkListItem"], ["quote", "quote"], ["callout", "callout"]] as const;
const components = { FormattingToolbar: { Button: ({ onClick, label, isSelected, ...props }: any) => <button aria-label={label} aria-pressed={isSelected} data-test={props["data-test"]} onClick={onClick}>{label}</button> } };
function fixture(type = "paragraph", textAlignment?: string, toolbar = false) {
  const source = [{ id: "p", type, ...(textAlignment === undefined ? {} : { textAlignment }), inlineContent: [{ type: "text", text: "First 日本語 é 😀", styles: { bold: true } }, { type: "link", href: "https://example.invalid", content: [{ type: "text", text: " label", styles: { italic: true, textColor: "red" } }] }], unknown: { retain: true } }, { id: "other", type: "paragraph", text: "Other untouched" }];
  const imported = importLegacyNotesBlocks(source), options = createOpenEditorPowerPreset().editorOptions();
  const editor = BlockNoteEditor.create({ ...options, initialContent: toBlockNoteForSchema(imported.document, options.schema) as never }) as BlockNoteEditor<any, any, any>;
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const access: NotesTextAlignmentAccess = { scope: { ...scope }, insertion: { scope: { ...scope }, nativeFormattingItems: [...NOTES_NATIVE_TEXT_ALIGNMENT_ITEMS], nativeFormattingBlockTypes: types.map(([, native]) => native) }, selected: [], available: true };
  const read = () => ({ ...access, selected: editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block] });
  act(() => root.render(<BlockNoteContext.Provider value={{ editor }}><ComponentsContext.Provider value={components as never}>
    <BlockNoteViewRaw editor={editor} sideMenu={false} slashMenu={false} formattingToolbar={false} linkToolbar={false} filePanel={false} tableHandles={false} emojiPicker={false} />
    {toolbar ? <NotesSelectionActionsContext.Provider value={{ controls: null, language: "en", suppressed: false, canFormat: () => access.available, canFormatItem: key => access.insertion!.nativeFormattingItems!.includes(key) && notesTextAlignmentItemAllowed(key, notesTextAlignmentAccessAllowed(read())), dismiss() {} }}><NotesFormattingToolbar /></NotesSelectionActionsContext.Provider> : null}
  </ComponentsContext.Provider></BlockNoteContext.Provider>));
  // BlockNoteView mounts a new native view; register guards against that view.
  act(() => { editor._tiptapEditor.registerPlugin(createNotesTextAlignmentPolicy(read)); });
  // JSDOM has no Range geometry. Skip native scroll measurement only.
  act(() => { editor.prosemirrorView.setProps({ handleScrollToSelection: () => true }); });
  dispose.push(() => { act(() => { root.unmount(); editor._tiptapEditor.destroy(); }); container.remove(); });
  const select = (id = "p") => act(() => { editor.setTextCursorPosition(id, "start"); const view = editor.prosemirrorView, pos = view.state.selection.from; view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos, pos + 5))); });
  select();
  const serialized = () => serializeEditorDocument(fromBlockNote(editor.document));
  const set = (alignment: unknown) => act(() => { editor.updateBlock("p", { props: { textAlignment: alignment } } as never); });
  const separate = () => act(() => { editor.prosemirrorView.dispatch(closeHistory(editor.prosemirrorState.tr)); });
  return { editor, source, imported, access, container, select, serialized, set, separate };
}
describe("actual native ordinary text alignment", () => {
  it("advertises exactly the installed left, center and right buttons", () => {
    expect(getFormattingToolbarItems().map(item => String(item.key)).filter(key => key.startsWith("textAlign"))).toEqual([...NOTES_NATIVE_TEXT_ALIGNMENT_ITEMS]);
    const f = fixture("paragraph", undefined, true);
    expect([...f.container.querySelectorAll("[data-notes-native-item]")].map(node => node.getAttribute("data-notes-native-item"))).toEqual([...NOTES_NATIVE_TEXT_ALIGNMENT_ITEMS]);
    for (const [suffix, alignment] of [["Center", "center"], ["Right", "right"], ["Left", "left"]]) {
      act(() => f.container.querySelector<HTMLButtonElement>(`[data-test="alignText${suffix}"]`)!.click());
      expect(f.editor.getBlock("p")!.props).toMatchObject({ textAlignment: alignment });
    }
    expect(f.editor.getSelectedText()).toBe("First");
    f.access.available = false;
    act(() => f.container.querySelector<HTMLButtonElement>('[data-test="alignTextCenter"]')!.click());
    expect(f.editor.getBlock("p")!.props).toMatchObject({ textAlignment: "left" });
  });
  it("isolates repeated and keyboard-generated native clicks from adjacent typing in local history", () => {
    const f = fixture("paragraph", undefined, true), baseline = f.serialized();
    act(() => { f.editor._tiptapEditor.commands.insertContent("Typed "); }); const typed = f.serialized();
    expect(typed).not.toBe(baseline);
    const click = (name: string, detail = 1) => act(() => { f.container.querySelector<HTMLButtonElement>(`[data-test="alignText${name}"]`)!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail })); });
    click("Center", 0); const centered = f.serialized();
    click("Center", 0); expect(f.serialized()).toBe(centered);
    click("Right"); const right = f.serialized();
    act(() => { f.editor._tiptapEditor.commands.insertContent("After "); }); const after = f.serialized();
    for (const expected of [right, centered, typed, baseline]) { act(() => { expect(f.editor.undo()).toBe(true); }); expect(f.serialized()).toBe(expected); }
    for (const expected of [typed, centered, right, after]) { act(() => { expect(f.editor.redo()).toBe(true); }); expect(f.serialized()).toBe(expected); }
  });
  it.each(["center", "right", "justify"])("retains quote %s in native attrs/render/HTML/reopen with exactly one content wrapper", alignment => {
    const f = fixture("quote", alignment), block = f.editor.getBlock("p")!;
    expect(block.props.textAlignment).toBe(alignment);
    expect(f.editor.prosemirrorState.schema.nodes.quote!.spec.attrs!.textAlignment!.default).toBe("left");
    expect(f.editor.prosemirrorState.schema.nodes.quote!.spec.isolating).toBe(false);
    const wrapper = f.container.querySelector('[data-id="p"]')!;
    expect(wrapper.querySelectorAll('[data-content-type="quote"]')).toHaveLength(1);
    expect(wrapper.querySelector('blockquote.bn-inline-content')?.textContent).toContain("First 日本語");
    expect(wrapper.querySelector('[data-content-type="quote"]')!.getAttribute("data-text-alignment")).toBe(alignment);
    const full = f.editor.blocksToFullHTML([block]), reopened = f.editor.tryParseHTMLToBlocks(full);
    expect(reopened).toHaveLength(1); expect(reopened[0]).toMatchObject({ type: "quote", props: { textAlignment: alignment }, content: block.content });
    const external = f.editor.blocksToHTMLLossy([block]);
    const dom = new DOMParser().parseFromString(external, "text/html"); expect(dom.querySelector("blockquote")?.style.textAlign).toBe(alignment);
    expect(f.editor.tryParseHTMLToBlocks(external)[0]).toMatchObject({ type: "quote", props: { textAlignment: alignment }, content: block.content });
    expect(exportLegacyNotesBlocks(fromBlockNote(f.editor.document), f.imported.archive, f.source)).toEqual(f.source);
  });
  it("keeps upstream quote shortcuts/input rules and normalizes unsupported external HTML alignment", () => {
    const upstream = createQuoteBlockSpec(), aligned = createAlignedQuoteBlockSpec(), f = fixture();
    expect(aligned.extensions).toBe(upstream.extensions); expect(aligned.implementation.meta).toBe(upstream.implementation.meta);
    const extension = aligned.extensions![0]!, actual = typeof extension === "function" ? extension({ editor: f.editor }) : extension;
    expect(actual.key).toBe("quote-block-shortcuts"); expect(Object.keys(actual.keyboardShortcuts!)).toEqual(["Mod-Alt-q"]);
    expect(actual.inputRules?.map(rule => String(rule.find))).toEqual(["/^>\\s$/", "/^\\p{Quotation_Mark}\\s$/u"]);
    act(() => { expect(f.editor._tiptapEditor.commands.keyboardShortcut("Mod-Alt-q")).toBe(true); });
    expect(f.editor.getBlock("p")!.type).toBe("quote");
    for (const value of ["start", "end", "inherit", "match-parent", "nonsense"]) {
      const parsed = f.editor.tryParseHTMLToBlocks(`<blockquote style="text-align:${value}">Text</blockquote>`);
      expect(parsed[0]).toMatchObject({ type: "quote", props: { textAlignment: "left" } });
    }
  });
  it.each(types)("renders, saves and exactly undoes every alignment for %s", (legacy, native) => {
    const f = fixture(legacy);
    expect(f.editor.getBlock("p")!.type).toBe(native);
    expect(exportLegacyNotesBlocks(fromBlockNote(f.editor.document), f.imported.archive, f.source)).toEqual(f.source);
    let previous = f.serialized();
    for (const alignment of ["center", "right", "justify", "left"]) {
      f.separate(); f.set(alignment); f.separate(); const changed = f.serialized(); expect(changed).not.toBe(previous);
      const block = f.container.querySelector('[data-id="p"]')!;
      if (native === "callout") expect((block.querySelector(".oe-callout__body") as HTMLElement).style.textAlign).toBe(alignment);
      else expect(block.querySelector("[data-content-type]")?.getAttribute("data-text-alignment") ?? "left").toBe(alignment);
      const saved = exportLegacyNotesBlocks(fromBlockNote(f.editor.document), f.imported.archive, f.source);
      expect(saved[0]).toEqual({ ...f.source[0], ...(alignment === "left" ? {} : { textAlignment: alignment }) });
      expect(saved[1]).toEqual(f.source[1]);
      act(() => { expect(f.editor.undo()).toBe(true); }); expect(f.serialized()).toBe(previous);
      act(() => { expect(f.editor.redo()).toBe(true); }); expect(f.serialized()).toBe(changed); previous = changed;
    }
  });
  it.each(["left", "center", "right", "justify"])("reopens %s with raw-presence preservation and deliberate reset", alignment => {
    const f = fixture("callout", alignment);
    expect(exportLegacyNotesBlocks(fromBlockNote(f.editor.document), f.imported.archive, f.source)).toEqual(f.source);
    f.set("left"); expect(exportLegacyNotesBlocks(fromBlockNote(f.editor.document), f.imported.archive, f.source)[0]).toEqual({ ...f.source[0], textAlignment: "left" });
  });
  it.each([null, false, 1, "start", "RIGHT", ""])("rejects lower-level invalid native alignment %j without a draft mutation", value => {
    const f = fixture(), before = f.serialized(); f.set(value); expect(f.serialized()).toBe(before);
  });
  it("rechecks live scope, all selected types, availability and policy revocation at transaction ingress", () => {
    const f = fixture(), before = f.serialized();
    f.access.available = false; f.set("right"); expect(f.serialized()).toBe(before);
    f.access.available = true; f.access.insertion!.scope.actorId = "foreign"; f.set("right"); expect(f.serialized()).toBe(before);
    f.access.insertion!.scope.actorId = "owner"; f.access.insertion!.nativeFormattingItems = []; f.set("right"); expect(f.serialized()).toBe(before);
    f.access.insertion!.nativeFormattingItems = [...NOTES_NATIVE_TEXT_ALIGNMENT_ITEMS]; f.access.insertion!.nativeFormattingBlockTypes = []; f.set("right"); expect(f.serialized()).toBe(before);
    f.access.insertion!.nativeFormattingBlockTypes = ["paragraph"]; f.select("other"); f.set("right"); expect(f.serialized()).toBe(before);
    f.select(); f.set("right"); expect(f.serialized()).not.toBe(before);
  });
  it("aligns every ordinary block in a native multi-block selection without changing rich content", () => {
    const f = fixture("paragraph", undefined, true);
    act(() => {
      const view = f.editor.prosemirrorView; let start = -1, end = -1;
      view.state.doc.descendants((node, pos) => { if (node.isText) { if (start < 0) start = pos; end = pos + node.nodeSize; } });
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, start, end)));
    });
    const before = f.editor.document.map(block => block.content), baseline = f.serialized(); f.separate();
    act(() => f.container.querySelector<HTMLButtonElement>('[data-test="alignTextCenter"]')!.click());
    expect(f.editor.document.map(block => block.props.textAlignment)).toEqual(["center", "center"]);
    expect(f.editor.document.map(block => block.content)).toEqual(before);
    f.separate(); const changed = f.serialized();
    act(() => { expect(f.editor.undo()).toBe(true); }); expect(f.serialized()).toBe(baseline);
    act(() => { expect(f.editor.redo()).toBe(true); }); expect(f.serialized()).toBe(changed);
  });
  it("allows exact native history even after the cursor leaves the changed block", () => {
    const f = fixture(), before = f.serialized(); f.separate(); f.set("center"); f.separate(); const changed = f.serialized(); f.select("other");
    act(() => { expect(f.editor.undo()).toBe(true); }); expect(f.serialized()).toBe(before);
    act(() => { expect(f.editor.redo()).toBe(true); }); expect(f.serialized()).toBe(changed);
  });
  it("keeps aligned paragraph Enter split and Backspace join on native keyboard/history paths", () => {
    const f = fixture("paragraph", "right"), baseline = f.serialized();
    act(() => {
      f.editor.setTextCursorPosition("p", "start"); const view = f.editor.prosemirrorView;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, view.state.selection.from + 5)));
    });
    f.separate(); act(() => { expect(f.editor._tiptapEditor.commands.keyboardShortcut("Enter")).toBe(true); }); f.separate();
    expect(f.editor.document).toHaveLength(3);
    expect(f.editor.getBlock("p")!.props.textAlignment).toBe("right");
    const split = f.serialized(), exported = exportLegacyNotesBlocks(fromBlockNote(f.editor.document), f.imported.archive, f.source);
    expect(importLegacyNotesBlocks(exported).document.blocks).toHaveLength(3);
    act(() => { expect(f.editor.undo()).toBe(true); }); expect(f.serialized()).toBe(baseline);
    act(() => { expect(f.editor.redo()).toBe(true); }); expect(f.serialized()).toBe(split);
    const second = f.editor.document[1]!;
    act(() => f.editor.setTextCursorPosition(second.id, "start")); f.separate();
    act(() => { expect(f.editor._tiptapEditor.commands.keyboardShortcut("Backspace")).toBe(true); }); f.separate();
    expect(f.serialized()).toBe(baseline);
    act(() => { expect(f.editor.undo()).toBe(true); }); expect(f.serialized()).toBe(split);
    act(() => { expect(f.editor.redo()).toBe(true); }); expect(f.serialized()).toBe(baseline);
  });
  it("does not grant ordinary buttons table/media access or alter their separate contracts", () => {
    const f = fixture(); f.access.applying = true;
    act(() => { f.editor.insertBlocks([{ id: "table", type: "table", content: { type: "tableContent", rows: [{ cells: [[{ type: "text", text: "Table cell", styles: {} }]] }] } }, { id: "image", type: "image", props: { url: "https://example.invalid/a.png" } }] as never, "other", "after"); });
    f.access.applying = false;
    act(() => {
      const view = f.editor.prosemirrorView; let start = -1, end = -1;
      view.state.doc.descendants((node, pos) => { if (node.isText) { if (start < 0) start = pos; if (node.text === "Table cell") end = pos + node.nodeSize; } });
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, start, end)));
    });
    const beforeMixed = f.serialized(); f.set("center"); expect(f.serialized()).toBe(beforeMixed);
    const table = f.editor.getBlock("table")!, media = f.editor.getBlock("image")!;
    expect(notesTextAlignmentAccessAllowed({ ...f.access, selected: [table] })).toBe(false);
    expect(notesTextAlignmentAccessAllowed({ ...f.access, selected: [f.editor.getBlock("p")!, table] })).toBe(false);
    expect(notesTextAlignmentAccessAllowed({ ...f.access, selected: [media] })).toBe(false);
    act(() => { f.editor.updateBlock("image", { props: { textAlignment: "right" } } as never); });
    expect(f.editor.getBlock("image")!.props).toMatchObject({ textAlignment: "right" });
  });
});
