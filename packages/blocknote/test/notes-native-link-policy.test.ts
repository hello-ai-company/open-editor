/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { LinkToolbarExtension } from "@blocknote/core/extensions";
import { TextSelection } from "@tiptap/pm/state";
import { Fragment, Slice } from "@tiptap/pm/model";
import { closeHistory } from "@tiptap/pm/history";
import { serializeEditorDocument } from "@hello-ai-company/editor-core";
import { createOpenEditorPowerPreset } from "../src/features/compose.js";
import { fromBlockNote } from "../src/adapter/fromBlockNote.js";
import { toBlockNoteForSchema } from "../src/adapter/toBlockNote.js";
import { importLegacyNotesBlocks, exportLegacyNotesBlocks } from "../src/document/legacyNotes.js";
import { guardNotesLinkCommands, guardNotesLinkShortcut, notesLinkValidator, notesLinkSelectionAllowed, notesLinkBlocksHaveHardBreaks } from "../src/react/notesLinkPolicy.js";
import { createNotesLinkBlockPolicy } from "../src/react/notesLinkBlockPolicy.js";
import type { NotesInsertionHost } from "../src/react/NotesInsertDialog.js";

const cleanup: (() => void)[] = [];
afterEach(() => { for (const dispose of cleanup.splice(0)) dispose(); });
const scope = { actorId: "owner", workspaceId: "workspace" };
const externalOnly = (href: string) => /^https?:\/\/example\.(?:com|org)(?:\/[^\s]*)?$/.test(href);
function fixture(raw = [
  { id: "first", type: "paragraph", inlineContent: [{ type: "text", text: "Selected label", styles: { bold: true, italic: true } }], future: { retain: true } },
  { id: "other", type: "paragraph", inlineContent: [{ type: "text", text: "Other paragraph", styles: {} }], version: 7 },
]) {
  const imported = importLegacyNotesBlocks(raw), options = createOpenEditorPowerPreset().editorOptions();
  const insertion: NotesInsertionHost = { scope: { ...scope }, pickerInsertKinds: ["link"], isValidLink: externalOnly, linkBlockTypes: ["paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "quote", "callout"], allowLinkHardBreaks: false };
  let available = true;
  const validate = notesLinkValidator(() => ({ scope, insertion }));
  const editor = BlockNoteEditor.create({ ...options, links: { isValidLink: validate }, initialContent: toBlockNoteForSchema(imported.document, options.schema) as never });
  const element = document.createElement("div"); document.body.append(element); editor.mount(element);
  editor._tiptapEditor.registerPlugin(createNotesLinkBlockPolicy(() => ({ scope, insertion })));
  const restore = guardNotesLinkCommands(editor, validate, () => available && insertion.pickerInsertKinds!.includes("link") && notesLinkSelectionAllowed(insertion, (editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block]).map(block => block.type), notesLinkBlocksHaveHardBreaks(editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block])), text => insertion.allowLinkHardBreaks !== false || !/[\r\n]/.test(text));
  cleanup.push(() => { restore(); editor.unmount(); editor._tiptapEditor.destroy(); element.remove(); });
  const select = (text = "Selected label") => {
    const view = editor.prosemirrorView;
    let start = -1, end = -1;
    view.state.doc.descendants((node, pos) => { if (node.isText && node.text === text) { start = pos; end = pos + node.nodeSize; } });
    if (start < 0) throw new Error(`Missing ${text}`);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, start, end)));
    return start;
  };
  const links = () => {
    const output: { text: string; href: string }[] = [];
    editor.prosemirrorState.doc.descendants(node => { const mark = node.marks.find(mark => mark.type.name === "link"); if (mark) output.push({ text: node.text ?? "", href: mark.attrs.href }); });
    return output;
  };
  const serialized = () => serializeEditorDocument(fromBlockNote(editor.document));
  const separate = () => editor.prosemirrorView.dispatch(closeHistory(editor.prosemirrorState.tr));
  return { editor, insertion, validate, select, links, serialized, separate, setAvailable: (value: boolean) => { available = value; }, raw, imported };
}

describe("real native link ingress under an owner host policy", () => {
  it("preserves formatted label runs and full-document local Undo for add, edit, remove", () => {
    const f = fixture(), original = f.serialized();
    f.select(); f.separate(); f.editor.createLink("https://example.com"); f.separate();
    const added = f.serialized();
    expect(f.links()).toEqual([{ text: "Selected label", href: "https://example.com" }]);
    expect(JSON.parse(added).blocks[0].content[0].content[0].styles).toEqual({ bold: true, italic: true });
    expect(f.editor.undo()).toBe(true); expect(f.serialized()).toBe(original);
    expect(exportLegacyNotesBlocks(fromBlockNote(f.editor.document), f.imported.archive, f.raw)).toEqual(f.raw);
    expect(f.editor.redo()).toBe(true); expect(f.serialized()).toBe(added);
    const position = f.select(); f.separate();
    // Native hover toolbar and Mod-K form both submit through this extension.
    f.editor.getExtension(LinkToolbarExtension)!.editLink("https://example.org/edited", "Selected label", position); f.separate();
    const edited = f.serialized(); expect(edited).not.toBe(added);
    expect(f.editor.undo()).toBe(true); expect(f.serialized()).toBe(added);
    expect(f.editor.redo()).toBe(true); expect(f.serialized()).toBe(edited);
    f.separate(); f.editor.deleteLink(position); f.separate();
    const removed = f.serialized(); expect(f.links()).toEqual([]);
    expect(f.editor.undo()).toBe(true); expect(f.serialized()).toBe(edited);
    expect(f.editor.redo()).toBe(true); expect(f.serialized()).toBe(removed);
    // This is native local Undo/Redo, with no controller or persisted-history restore.
  });

  it.each(["openeditor://page/unapproved", "javascript:alert(1)", "mailto:owner@example.com", "https://example.com/has space", "https://bad.example/path"])("rejects create and native edit routes for %s without changing serialized body", href => {
    const f = fixture(); const position = f.select(), before = f.serialized();
    f.editor.createLink(href); f.editor.getExtension(LinkToolbarExtension)!.editLink(href, "Replaced label", position);
    expect(f.serialized()).toBe(before); expect(f.links()).toEqual([]);
  });

  it("rechecks mutable policy, scope and editing availability for retained native commands", () => {
    const f = fixture(); const position = f.select(), before = f.serialized();
    const retainedCreate = f.editor.createLink.bind(f.editor), edit = f.editor.getExtension(LinkToolbarExtension)!.editLink;
    f.insertion.isValidLink = () => false; retainedCreate("https://example.com"); expect(f.serialized()).toBe(before);
    f.insertion.isValidLink = externalOnly; f.setAvailable(false); edit("https://example.com", "Changed", position); expect(f.serialized()).toBe(before);
    f.setAvailable(true); f.insertion.scope = { ...scope, actorId: "foreign" }; retainedCreate("https://example.com"); expect(f.serialized()).toBe(before);
    f.insertion.scope = { ...scope }; f.insertion.pickerInsertKinds = []; edit("https://example.com", "Changed", position); expect(f.serialized()).toBe(before);
  });

  it("refuses empty native labels without deleting the selected source", () => {
    const f = fixture(), position = f.select(), before = f.serialized();
    f.editor.createLink("https://example.com", ""); f.editor.editLink("https://example.com", "", position);
    expect(f.serialized()).toBe(before);
  });

  it("validates actual typed autolinks and pasted URL-over-selection using the live policy", () => {
    const f = fixture();
    const type = (text: string) => { f.editor.setTextCursorPosition("other", "end"); const view = f.editor.prosemirrorView; view.dispatch(view.state.tr.insertText(text, view.state.selection.from)); view.dispatch(view.state.tr.insertText(" ", view.state.selection.from)); };
    type(" https://example.com"); expect(f.links()).toContainEqual({ text: "https://example.com", href: "https://example.com" });
    f.insertion.isValidLink = () => false;
    type("https://example.org"); expect(f.links().some(link => link.href === "https://example.org")).toBe(false);
    f.select(); const before = f.serialized(), view = f.editor.prosemirrorView;
    const slice = new Slice(Fragment.from(view.state.schema.text("https://example.org")), 0, 0);
    expect(view.someProp("handlePaste", handler => handler(view, new Event("paste") as ClipboardEvent, slice))).toBeFalsy();
    expect(f.serialized()).toBe(before);
    f.insertion.isValidLink = externalOnly;
    expect(view.someProp("handlePaste", handler => handler(view, new Event("paste") as ClipboardEvent, slice))).toBe(true);
    expect(f.links()).toContainEqual({ text: "Selected label", href: "https://example.org" });
  });

  it("rejects disallowed HTML link marks while retaining their text", () => {
    const f = fixture(); f.editor.setTextCursorPosition("other", "end");
    f.editor._tiptapEditor.commands.insertContent('<a href="openeditor://page/unapproved">Raw label</a>');
    expect(f.links()).toEqual([]); expect(f.editor.prosemirrorState.doc.textContent).toContain("Raw label");
    f.editor._tiptapEditor.commands.insertContent('<a href="https://example.org">Allowed label</a>');
    expect(f.links()).toContainEqual({ text: "Allowed label", href: "https://example.org" });
  });
  it("retains exact surrounding whitespace and whitespace-only native labels", () => {
    const f = fixture(); f.select(); f.editor.createLink("https://example.com", " label ");
    expect(f.links()).toEqual([{ href: "https://example.com", text: " label " }]);
    const position = f.select(" label "); f.editor.editLink("https://example.org", "  ", position);
    expect(f.links()).toEqual([{ href: "https://example.org", text: "  " }]);
  });

  it("keeps unsupported table-cell text plain across create, native keyboard form, HTML paste and autolink", () => {
    const f = fixture();
    f.editor.insertBlocks([{ id: "table", type: "table", content: { type: "tableContent", rows: [{ cells: [[{ type: "text", text: "Cell label", styles: {} }]] }] } }] as never, "other", "after");
    const position = f.select("Cell label"), before = f.serialized();
    f.editor.createLink("https://example.com");
    f.editor.getExtension(LinkToolbarExtension)!.editLink("https://example.com", "Cell label", position);
    expect(f.serialized()).toBe(before);
    f.editor._tiptapEditor.commands.insertContent('<a href="https://example.org">Paste label</a>');
    expect(f.serialized()).toBe(before);
    const view = f.editor.prosemirrorView;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position + "Cell label".length)));
    view.dispatch(view.state.tr.insertText(" https://example.com", view.state.selection.from));
    view.dispatch(view.state.tr.insertText(" ", view.state.selection.from));
    expect(f.links()).toEqual([]); expect(f.editor.prosemirrorState.doc.textContent).toContain("Cell label https://example.com ");
    f.select(); f.editor.createLink("https://example.com"); expect(f.links()).toEqual([{ href: "https://example.com", text: "Selected label" }]);
  });

  it("keeps code text outside the inline-link codec across create, native form and typing", () => {
    const f = fixture(); f.editor.insertBlocks([{ id: "code", type: "codeBlock", content: "Code label" }], "other", "after");
    const position = f.select("Code label"), before = f.serialized();
    f.editor.createLink("https://example.com"); f.editor.getExtension(LinkToolbarExtension)!.editLink("https://example.com", "Code label", position);
    expect(f.serialized()).toBe(before);
    const view = f.editor.prosemirrorView;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position + "Code label".length)));
    view.dispatch(view.state.tr.insertText(" https://example.com", view.state.selection.from));
    view.dispatch(view.state.tr.insertText(" ", view.state.selection.from));
    expect(f.links()).toEqual([]); expect(f.editor.prosemirrorState.doc.textContent).toContain("Code label https://example.com ");
  });

  it("rejects a cross-block link range that includes a table and rechecks revoked block types", () => {
    const f = fixture(); f.editor.insertBlocks([{ id: "table", type: "table", content: { type: "tableContent", rows: [{ cells: [[{ type: "text", text: "Cell", styles: {} }]] }] } }] as never, "other", "after");
    const start = f.select(), end = f.select("Cell") + 4, view = f.editor.prosemirrorView;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, start, end)));
    const before = f.serialized(); f.editor.createLink("https://example.com"); expect(f.serialized()).toBe(before);
    // Even a lower-level mark transaction cannot bypass the native block policy.
    view.dispatch(view.state.tr.addMark(start, end, view.state.schema.marks.link!.create({ href: "https://example.com" })));
    expect(f.serialized()).toBe(before);
    f.select(); f.insertion.linkBlockTypes = []; f.editor.createLink("https://example.com"); expect(f.serialized()).toBe(before);
  });

  it("rejects adding a link to any multiline selected block while retaining plain multiline content", () => {
    const f = fixture(); f.editor.updateBlock("first", { content: "First\nsecond" });
    const start = f.select("First"), before = f.serialized();
    f.editor.createLink("https://example.com"); f.editor.getExtension(LinkToolbarExtension)!.editLink("https://example.com", "First", start);
    expect(f.serialized()).toBe(before); expect(f.links()).toEqual([]);
    const view = f.editor.prosemirrorView;
    view.dispatch(view.state.tr.addMark(start, start + 5, view.state.schema.marks.link!.create({ href: "https://example.com" })));
    expect(f.serialized()).toBe(before);
  });

  it("rejects hardbreak labels and typed hardbreaks anywhere in an already linked block", () => {
    const f = fixture(); const start = f.select(); f.editor.createLink("https://example.com");
    const before = f.serialized();
    for (const label of ["\n", "x\ny", "x\ry"]) {
      f.editor.getExtension(LinkToolbarExtension)!.editLink("https://example.org", label, start);
      expect(f.serialized()).toBe(before);
    }
    const view = f.editor.prosemirrorView;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, start + "Selected label".length)));
    view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.hardBreak!.create()));
    expect(f.serialized()).toBe(before);
    f.editor._tiptapEditor.commands.insertContent(' tail<br>after');
    expect(f.serialized()).toBe(before);
    expect(f.links()).toEqual([{ href: "https://example.com", text: "Selected label" }]);
  });

  it("blocks autolinks and pasted linked hardbreaks without modifying a safe original", () => {
    const f = fixture(); f.editor.updateBlock("other", { content: "First\nsecond" });
    f.editor.setTextCursorPosition("other", "end"); const view = f.editor.prosemirrorView;
    view.dispatch(view.state.tr.insertText(" https://example.com", view.state.selection.from));
    view.dispatch(view.state.tr.insertText(" ", view.state.selection.from));
    expect(f.links()).toEqual([]); expect(f.editor.prosemirrorState.doc.textContent).toContain("https://example.com");
    f.select(); const before = f.serialized();
    f.editor._tiptapEditor.commands.insertContent('<a href="https://example.com">x</a><br><a href="https://example.com">y</a>');
    expect(f.serialized()).toBe(before);
  });

});


describe("restricted editor Mod-K focus gate", () => {
  it("keeps the live editor focused on IME, keyCode229, repeated blocked shortcuts and stale contexts", () => {
    const root = document.createElement("div"); root.tabIndex = 0; root.setAttribute("contenteditable", "true"); document.body.append(root);
    const popup = document.createElement("input"); document.body.append(popup);
    let available = true;
    const nativeOpen = vi.fn((event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key === "k") popup.focus(); });
    root.addEventListener("keydown", nativeOpen);
    const release = guardNotesLinkShortcut(root, () => available);
    cleanup.push(() => { release(); root.remove(); popup.remove(); });
    const press = (extra: KeyboardEventInit = {}) => { const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true, ...extra }); root.dispatchEvent(event); return event; };
    root.focus();
    expect(press({ isComposing: true }).defaultPrevented).toBe(false);
    expect(press({ keyCode: 229 }).defaultPrevented).toBe(false);
    expect(nativeOpen).not.toHaveBeenCalled(); expect(document.activeElement).toBe(root);
    available = false;
    expect(press().defaultPrevented).toBe(true); expect(press({ repeat: true }).defaultPrevented).toBe(true);
    expect(nativeOpen).not.toHaveBeenCalled(); expect(document.activeElement).toBe(root);
    // No-op blocked keys do not eat Enter or alter composition commit behavior.
    const enter = new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true }); root.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false); expect(nativeOpen).toHaveBeenCalledOnce(); nativeOpen.mockClear();
    available = true; expect(press({ ctrlKey: false, metaKey: true }).defaultPrevented).toBe(false);
    expect(nativeOpen).toHaveBeenCalledOnce(); expect(document.activeElement).toBe(popup);
    nativeOpen.mockClear(); root.focus(); available = false; release(); press();
    expect(nativeOpen).toHaveBeenCalledOnce();
  });

  it("does not intercept nested fields, nested editors, other editors, or inactive roots", () => {
    const root = document.createElement("div"); root.tabIndex = 0; root.setAttribute("contenteditable", "true");
    const input = document.createElement("input"), nested = document.createElement("div"), other = document.createElement("div"); nested.tabIndex = other.tabIndex = 0; nested.setAttribute("contenteditable", "true"); other.setAttribute("contenteditable", "true");
    root.append(input, nested); document.body.append(root, other);
    const release = guardNotesLinkShortcut(root, () => false), observed = vi.fn();
    root.addEventListener("keydown", observed); other.addEventListener("keydown", observed);
    cleanup.push(() => { release(); root.remove(); other.remove(); });
    for (const target of [input, nested, other]) {
      target.focus(); const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true }); target.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
    }
    other.focus(); root.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true }));
    expect(observed).toHaveBeenCalledTimes(4);
  });
});
