import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node } from "@tiptap/pm/model";
import type { NotesLinkPolicy } from "./notesLinkPolicy.js";

/** Link validation also runs while rendering, so selection-specific codec
 * restrictions belong at the mutation boundary instead. Invalid native paste,
 * Mod-K, direct link commands and autolink transactions are rejected atomically.
 * Existing unsupported content is never stripped or rewritten by this policy. */
export function createNotesLinkBlockPolicy(read: () => NotesLinkPolicy): Plugin {
  const blocks = (document: Node) => {
    const result = new Map<string, Node>();
    document.descendants((node, position, parent) => {
      if (node.type.spec.group?.split(" ").includes("blockContent")) result.set(String(parent?.attrs.id ?? position), node);
    });
    return result;
  };
  return new Plugin({
    key: new PluginKey("openeditor-notes-link-block-policy"),
    filterTransaction(transaction, previous) {
      if (!transaction.docChanged) return true;
      const { scope, insertion } = read();
      if (!insertion || insertion.linkBlockTypes === undefined && insertion.allowLinkHardBreaks !== false) return true;
      const allowed = scope && scope.actorId === insertion.scope.actorId && scope.workspaceId === insertion.scope.workspaceId ? insertion.linkBlockTypes : [];
      const before = blocks(previous.doc);
      for (const [id, node] of blocks(transaction.doc)) {
        if (node.eq(before.get(id) ?? previous.doc)) continue;
        let linked = false, hardBreak = false;
        node.descendants(child => {
          if (child.marks.some(mark => mark.type.name === "link")) linked = true;
          if (child.type.name === "hardBreak" || child.isText && /[\r\n]/.test(child.text ?? "")) hardBreak = true;
        });
        if (linked && (allowed !== undefined && !allowed.includes(node.type.name) || insertion.allowLinkHardBreaks === false && hardBreak)) return false;
      }
      return true;
    },
  });
}
