/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";
import { currentCodeDOMSelection, mountCodeSelectionSynchronization } from "../src/document/codeClipboardSelection.js";

const schema = new Schema({ nodes: {
  doc: { content: "block+" }, text: { group: "inline" },
  codeBlock: { content: "text*", group: "block", code: true, toDOM: () => ["pre", ["code", { class: "bn-inline-content" }, 0]] },
  paragraph: { content: "text*", group: "block", toDOM: () => ["p", { class: "bn-inline-content" }, 0] }
} });
const views: EditorView[] = [];
const releases: (() => void)[] = [];
afterEach(() => { for (const release of releases.splice(0)) release(); document.getSelection()?.removeAllRanges(); for (const view of views.splice(0)) { const dom = view.dom; view.destroy(); dom.remove(); } vi.clearAllTimers(); vi.useRealTimers(); });
function lagSelectionObserver() {
  // Controlled event-delivery lag, not a product workaround: without it JSDOM
  // flushes every range before the vendor timer and cannot reproduce Chrome's
  // coalesced native selection/model timing. The actual PM focus timer remains.
  const defer = (event: Event) => event.stopImmediatePropagation();
  document.addEventListener("selectionchange", defer, true);
  releases.push(() => document.removeEventListener("selectionchange", defer, true));
}
function fixture(type = "codeBlock", text = "const 日本語 = '🧪';\n  second();") {
  const doc = schema.node("doc", undefined, [schema.node(type, undefined, schema.text(text))]);
  // jsdom has no selection geometry; this suite verifies position mapping.
  const view = new EditorView(document.body, { state: EditorState.create({ schema, doc, selection: TextSelection.create(doc, 2, 3) }), handleScrollToSelection: () => true }); views.push(view);
  return { view, text, node: view.dom.querySelector(".bn-inline-content")!.firstChild! };
}
function select(node: Node, start: number, end: number) { const range = document.createRange(); range.setStart(node, start); range.setEnd(node, end); const selection = document.getSelection()!; selection.removeAllRanges(); selection.addRange(range); }

describe("current visible Code selection for clipboard", () => {
  it("maps a current multiline/Unicode DOM range while leaving the canonical document unchanged", () => {
    const { view, text, node } = fixture(), before = view.state.doc.toJSON(); select(node, 0, text.length);
    const next = currentCodeDOMSelection(view)!;
    expect(next.from).toBe(1); expect(next.to).toBe(1 + text.length); expect(view.state.doc.textBetween(next.from, next.to)).toBe(text);
    expect(view.state.selection.from).toBe(2); expect(view.state.doc.toJSON()).toEqual(before);
  });
  it("keeps exact partial selection offsets rather than finding an equal text occurrence", () => {
    const { view, node } = fixture("codeBlock", "same(); same();"); select(node, 8, 14);
    const next = currentCodeDOMSelection(view)!; expect(next.from).toBe(9); expect(next.to).toBe(15);
  });
  it("ignores another editor's selection and ordinary paragraph selection", () => {
    const a = fixture(), b = fixture(); select(b.node, 0, 5); expect(currentCodeDOMSelection(a.view)).toBeUndefined();
    const paragraph = fixture("paragraph", "Plain paragraph"); select(paragraph.node, 0, 5); expect(currentCodeDOMSelection(paragraph.view)).toBeUndefined();
  });
  it("does not use a transient DOM text value that differs from the current document", () => {
    const { view, node } = fixture("codeBlock", "original code"); node.textContent = "different DOM"; select(node, 0, 3);
    expect(currentCodeDOMSelection(view)).toBeUndefined();
  });
  it("leaves collapsed and noneditable-island selections to their existing handlers", () => {
    const { view, node } = fixture(); select(node, 2, 2); expect(currentCodeDOMSelection(view)).toBeUndefined();
    (node.parentElement as HTMLElement).setAttribute("contenteditable", "false"); select(node, 0, 3); expect(currentCodeDOMSelection(view)).toBeUndefined();
  });
});

describe("native Code selection across pending focus work", () => {
  it("reproduces the vendor timer restoring a stale model without synchronization", () => {
    vi.useFakeTimers();
    lagSelectionObserver();
    const { view, node, text } = fixture();
    view.dom.focus(); select(node, 0, text.length);
    expect(document.getSelection()!.toString()).toBe(text);
    vi.advanceTimersByTime(20);
    expect(document.getSelection()!.toString()).not.toBe(text);
  });

  it("preserves a new Shift range through the real ProseMirror focus timer", () => {
    vi.useFakeTimers();
    lagSelectionObserver();
    const { view, node, text } = fixture(), before = view.state.doc.toJSON();
    const release = mountCodeSelectionSynchronization(view, next => view.dispatch(view.state.tr.setSelection(next).setMeta("addToHistory", false)), () => true);
    view.dom.focus(); // Real handler queues the vendor's 20ms callback.
    select(node, 0, text.length);
    view.dom.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowLeft", shiftKey: true, bubbles: true }));
    expect(view.state.doc.textBetween(view.state.selection.from, view.state.selection.to)).toBe(text);
    vi.advanceTimersByTime(20);
    expect(document.getSelection()!.toString()).toBe(text);
    expect(view.state.doc.toJSON()).toEqual(before);
    release();
  });

  it("keeps a clicked Code caret before the first Shift key and an old focus timer", () => {
    vi.useFakeTimers(); lagSelectionObserver();
    const { view, node, text } = fixture();
    const release = mountCodeSelectionSynchronization(view, next => view.dispatch(view.state.tr.setSelection(next).setMeta("addToHistory", false)), () => true);
    view.dom.focus(); select(node, text.length, text.length);
    node.parentElement!.dispatchEvent(new Event("pointerup", { bubbles: true }));
    expect(view.state.selection.head).toBe(1 + text.length);
    expect(currentCodeDOMSelection(view)).toBeUndefined();
    vi.advanceTimersByTime(20);
    expect(document.getSelection()!.focusOffset).toBe(text.length);
    release();
  });

  it("does not consume a retained Code range for another widget's pointer completion", () => {
    vi.useFakeTimers();
    const { view, node, text } = fixture();
    const commit = vi.fn();
    const release = mountCodeSelectionSynchronization(view, commit, () => true);
    view.dom.focus(); select(node, 0, text.length);
    view.dom.dispatchEvent(new Event("pointerup", { bubbles: true }));
    expect(commit).not.toHaveBeenCalled();
    release();
  });

  it("does not let an unfocused editor synchronize another editor's range", () => {
    vi.useFakeTimers();
    const a = fixture(), b = fixture("codeBlock", "Other code");
    const release = mountCodeSelectionSynchronization(a.view, next => a.view.dispatch(a.view.state.tr.setSelection(next)), () => true);
    a.view.dom.focus();
    b.view.dom.focus(); select(b.node, 0, 5);
    const before = a.view.state.selection;
    a.view.dom.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowLeft", shiftKey: true, bubbles: true }));
    expect(a.view.state.selection).toBe(before);
    vi.advanceTimersByTime(20);
    expect(b.view.hasFocus()).toBe(true);
    release();
  });

  it("retains native input, composition, readonly and disposed-handler ownership", () => {
    vi.useFakeTimers();
    const { view, node, text } = fixture();
    let editable = false;
    const commit = vi.fn((next: TextSelection) => view.dispatch(view.state.tr.setSelection(next)));
    const release = mountCodeSelectionSynchronization(view, commit, () => editable);
    view.dom.focus(); select(node, 0, text.length);
    const key = (isComposing = false) => new KeyboardEvent("keyup", { key: "ArrowLeft", shiftKey: true, isComposing, bubbles: true });
    view.dom.dispatchEvent(key()); expect(commit).not.toHaveBeenCalled();
    editable = true; view.dom.dispatchEvent(key(true)); expect(commit).not.toHaveBeenCalled();
    const input = document.createElement("textarea"); document.body.append(input); input.focus();
    view.dom.dispatchEvent(key()); expect(commit).not.toHaveBeenCalled(); input.remove();
    view.dom.focus(); select(node, 0, text.length); release();
    view.dom.dispatchEvent(key()); expect(commit).not.toHaveBeenCalled();
  });
});
