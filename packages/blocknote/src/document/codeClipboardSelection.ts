import { createExtension } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/** Read the visible selection only when both endpoints belong to one current,
 * editable Code inline surface. Never infer ranges from selected text alone. */
export function currentCodeDOMSelection(view: EditorView, includeCaret = false): TextSelection | undefined {
  const root = view.dom.getRootNode() as Document | ShadowRoot;
  const selection = "getSelection" in root && typeof root.getSelection === "function"
    ? root.getSelection() : view.dom.ownerDocument.getSelection();
  if (view.composing || !selection || (!includeCaret && selection.isCollapsed) || !selection.anchorNode || !selection.focusNode || !view.dom.contains(selection.anchorNode) || !view.dom.contains(selection.focusNode)) return;
  const element = (node: Node) => node.nodeType === 1 ? node as Element : node.parentElement;
  const anchor = element(selection.anchorNode)?.closest(".bn-inline-content");
  const head = element(selection.focusNode)?.closest(".bn-inline-content");
  if (!anchor || anchor !== head || anchor.closest('[contenteditable="false"]')) return;
  try {
    const anchorPos = view.posAtDOM(selection.anchorNode, selection.anchorOffset);
    const headPos = view.posAtDOM(selection.focusNode, selection.focusOffset);
    const next = TextSelection.create(view.state.doc, anchorPos, headPos);
    if (!next.$anchor.sameParent(next.$head) || next.$anchor.parent.type.name !== "codeBlock" || anchor.textContent !== next.$anchor.parent.textContent || view.state.doc.textBetween(next.from, next.to) !== selection.toString()) return;
    return next;
  } catch { return; } // Detached or transient render; keep ordinary handling.
}

/** Keep native Code caret/range current before a pending focus selection reset.
 * Pointerup/keyup see the browser's completed movement; keydown preserves the
 * previous movement before the next one. No native input is implemented or
 * canceled here, and copy continues to require a nonempty range. */
export function mountCodeSelectionSynchronization(
  view: EditorView,
  select: (selection: TextSelection) => void,
  editable: () => boolean
) {
  const synchronize = (event: Event, includeCaret = false) => {
    if (event.defaultPrevented || !editable()) return;
    // A native widget textarea can retain an old document DOM range. Its
    // own clipboard operation must not synchronize or refocus body selection.
    if (!view.hasFocus()) return;
    const next = currentCodeDOMSelection(view, includeCaret);
    if (!next || next.eq(view.state.selection)) return;
    select(next);
  };
  const navigation = (event: KeyboardEvent) => {
    if (!event.isComposing && /^(Arrow(Left|Right|Up|Down)|Home|End|Page(Up|Down))$/.test(event.key)) synchronize(event, true);
  };
  const pointer = (event: Event) => {
    const target = event.target as Node | null;
    const element = target?.nodeType === 1 ? target as Element : target?.parentElement;
    const surface = element?.closest('.bn-block-content[data-content-type="codeBlock"], pre');
    // A canvas or widget may retain a previous Code DOM range. Only an actual
    // pointer completion on that Code surface can synchronize its caret.
    const anchor = view.dom.ownerDocument.getSelection()?.anchorNode;
    if (surface && anchor && surface.contains(anchor)) synchronize(event, true);
  };
  const dom = view.dom;
  dom.addEventListener("copy", synchronize, true);
  dom.addEventListener("keydown", navigation, true);
  dom.addEventListener("keyup", navigation, true);
  dom.addEventListener("pointerup", pointer, true);
  return () => {
    dom.removeEventListener("copy", synchronize, true);
    dom.removeEventListener("keydown", navigation, true);
    dom.removeEventListener("keyup", navigation, true);
    dom.removeEventListener("pointerup", pointer, true);
  };
}

const CodeClipboardSelection = createExtension(({ editor }) => ({
  key: "openeditor-code-clipboard-selection",
  mount: () => mountCodeSelectionSynchronization(
    editor.prosemirrorView,
    selection => editor.transact(tr => tr.setSelection(selection).setMeta("addToHistory", false)),
    () => editor.isEditable
  )
}));

/** Shared factory identity makes optional Code + Document installation dedupe. */
export function createCodeClipboardSelectionExtension() { return CodeClipboardSelection(); }
