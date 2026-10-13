import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node } from "@tiptap/pm/model";
import type { NotesInsertionHost } from "./NotesInsertDialog.js";
import type { NotesLinkPolicy } from "./notesLinkPolicy.js";

/** Color marks belong to ordinary inline text, not block properties/table cells. */
export function notesInlineColorSelectionAllowed(insertion: NotesInsertionHost | undefined, types: readonly string[], hardBreaks: boolean): boolean {
  return (insertion?.inlineColorBlockTypes === undefined || types.length > 0 && types.every(type => insertion.inlineColorBlockTypes!.includes(type))) && !(insertion?.allowInlineColorHardBreaks === false && hardBreaks);
}
/** Native hard-breaks redistribute marks between adjacent text runs. For a host
 * opting into the bounded color contract, reject that transaction atomically.
 * Unrestricted hosts and unchanged raw nodes are not rewritten or stripped. */
export function createNotesInlineColorPolicy(read: () => NotesLinkPolicy): Plugin {
  const blocks = (document: Node) => {
    const result = new Map<string, Node>();
    document.descendants((node, position, parent) => {
      if (node.type.spec.group?.split(" ").includes("blockContent")) result.set(String(parent?.attrs.id ?? position), node);
    });
    return result;
  };
  return new Plugin({
    key: new PluginKey("openeditor-notes-inline-color-policy"),
    filterTransaction(transaction, previous) {
      if (!transaction.docChanged) return true;
      const { scope, insertion } = read();
      if (!insertion || insertion.inlineColorBlockTypes === undefined && insertion.allowInlineColorHardBreaks !== false) return true;
      const scoped = scope?.actorId === insertion.scope.actorId && scope?.workspaceId === insertion.scope.workspaceId;
      const before = blocks(previous.doc);
      for (const [id, node] of blocks(transaction.doc)) {
        if (node.eq(before.get(id) ?? previous.doc)) continue;
        let colored = false, hardBreak = false;
        node.descendants(child => {
          if (child.marks.some(mark => mark.type.name === "textColor" || mark.type.name === "backgroundColor")) colored = true;
          if (child.type.name === "hardBreak" || child.isText && /[\r\n]/.test(child.text ?? "")) hardBreak = true;
        });
        if (colored && (!scoped || !notesInlineColorSelectionAllowed(insertion, [node.type.name], hardBreak))) return false;
      }
      return true;
    },
  });
}
