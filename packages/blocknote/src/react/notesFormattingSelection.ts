import { TextSelection, type EditorState } from "@tiptap/pm/state";

/** Match the installed native toolbar eligibility without forcing an editor transaction.
 * In particular, a nonempty code/plain-text range must not acquire rich-text controls. */
export function notesFormattingSelectionAvailable(state: Pick<EditorState, "doc" | "selection">): boolean {
  const { doc, selection } = state;
  if (selection.empty || selection instanceof TextSelection && doc.textBetween(selection.from, selection.to).length === 0) return false;
  let plain = false;
  selection.content().content.descendants(node => {
    if (node.type.spec.content === "text*") plain = true;
    return !plain;
  });
  return !plain;
}
