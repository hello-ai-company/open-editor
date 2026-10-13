import { Plugin, PluginKey } from "@tiptap/pm/state";
import { isHistoryTransaction } from "@tiptap/pm/history";
import type { Node } from "@tiptap/pm/model";
import { isNotesTextAlignment, isOrdinaryTextAlignmentBlock } from "../document/textAlignment.js";
import type { NotesInsertionHost } from "./NotesInsertDialog.js";
import type { NotesScope } from "../notes/contracts.js";

/** Exact keys installed by BlockNote 0.54.2. Justify is durable but has no default button. */
export const NOTES_NATIVE_TEXT_ALIGNMENT_ITEMS = ["textAlignLeftButton", "textAlignCenterButton", "textAlignRightButton"] as const;
type SelectedBlock = { id: string; type: string; props?: Record<string, unknown> };
export function notesTextAlignmentSelectionAllowed(insertion: NotesInsertionHost | undefined, blocks: readonly SelectedBlock[]): boolean {
  return blocks.length > 0 && blocks.every(block => isOrdinaryTextAlignmentBlock(block.type)
    && (insertion?.nativeFormattingBlockTypes === undefined || insertion.nativeFormattingBlockTypes.includes(block.type))
    && (block.props?.textAlignment === undefined || isNotesTextAlignment(block.props.textAlignment)));
}
export function notesTextAlignmentItemAllowed(key: string, allowed: boolean): boolean {
  return !key.startsWith("textAlign") || allowed && (NOTES_NATIVE_TEXT_ALIGNMENT_ITEMS as readonly string[]).includes(key);
}
export type NotesTextAlignmentAccess = {
  insertion?: NotesInsertionHost;
  scope?: NotesScope;
  /** Live Save/composition state and applied source/target identity. */
  available: boolean;
  /** Trusted controller projection must not be mistaken for a user command. */
  applying?: boolean;
  selected: readonly SelectedBlock[];
};
export function notesTextAlignmentAccessAllowed(access: NotesTextAlignmentAccess): boolean {
  const { insertion, scope } = access;
  return access.available && !!insertion && !!scope && scope.actorId === insertion.scope.actorId && scope.workspaceId === insertion.scope.workspaceId
    && NOTES_NATIVE_TEXT_ALIGNMENT_ITEMS.some(key => insertion.nativeFormattingItems?.includes(key))
    && notesTextAlignmentSelectionAllowed(insertion, access.selected);
}
/** Check ordinary alignment at native transaction ingress as well as toolbar click
 * time. Table cells/media have separate contracts and are deliberately untouched. */
export function createNotesTextAlignmentPolicy(read: () => NotesTextAlignmentAccess): Plugin {
  const ordinary = (document: Node) => {
    const result = new Map<string, Node>();
    document.descendants((node, position, parent) => {
      if (node.type.spec.group?.split(" ").includes("blockContent") && isOrdinaryTextAlignmentBlock(node.type.name)) result.set(String(parent?.attrs.id ?? position), node);
    });
    return result;
  };
  return new Plugin({
    key: new PluginKey("openeditor-notes-text-alignment-policy"),
    filterTransaction(transaction, previous) {
      if (!transaction.docChanged) return true;
      const access = read();
      if (access.applying || access.insertion?.nativeFormattingItems === undefined) return true;
      const before = ordinary(previous.doc);
      for (const [id, node] of ordinary(transaction.doc)) {
        const old = before.get(id);
        if (old?.attrs.textAlignment === node.attrs.textAlignment) continue;
        if (!isNotesTextAlignment(node.attrs.textAlignment)) return false;
        // Default props on ordinary insertions do not grant or require alignment.
        if (!old && node.attrs.textAlignment === "left") continue;
        const selected = isHistoryTransaction(transaction) || !old ? [{ id, type: node.type.name, props: node.attrs }] : access.selected;
        if (!notesTextAlignmentAccessAllowed({ ...access, selected }) || old && !isHistoryTransaction(transaction) && !access.selected.some(block => block.id === id)) return false;
      }
      return true;
    },
  });
}
