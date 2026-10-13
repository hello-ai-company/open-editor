import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node } from "@tiptap/pm/model";

const LIMIT = 1000;
const special = new Set([".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]", String.fromCharCode(92)]);
export const notesSearchRegex = (query: string): RegExp => new RegExp(Array.from(query, ch => special.has(ch) ? String.fromCharCode(92) + ch : ch).join(""), "giu");
export type NotesSearchState = { query: string; ranges: readonly { from: number; to: number }[]; capped: boolean; decorations: DecorationSet };
/** Literal, Unicode-aware matches. Marks do not break a run; atoms/custom inline nodes do.
 * Decorations never enter the source document, undo history or canonical save payload. */
export function notesSearchState(doc: Node, raw: string): NotesSearchState {
  const query = raw.trim(), ranges: { from: number; to: number }[] = [];
  if (!query || query.length > 500) return { query: "", ranges, capped: false, decorations: DecorationSet.empty };
  const regex = notesSearchRegex(query);
  let capped = false;
  doc.descendants((node, position) => {
    if (capped) return false;
    if (!node.isTextblock) return true;
    let run = "", start = 0;
    const flush = () => {
      regex.lastIndex = 0;
      for (let match = regex.exec(run); match; match = regex.exec(run)) {
        if (ranges.length === LIMIT) { capped = true; break; }
        ranges.push({ from: start + match.index, to: start + match.index + match[0].length });
      }
      run = "";
    };
    node.forEach((child, offset) => {
      if (capped) return;
      if (!child.isText) { flush(); return; }
      if (!run) start = position + 1 + offset;
      run += child.text!;
    });
    if (!capped) flush(); return false;
  });
  return { query, ranges, capped, decorations: DecorationSet.create(doc, ranges.map(range => Decoration.inline(range.from, range.to, { class: "oe-notes-search-match" }))) };
}
export function createNotesSearchPlugin() {
  const key = new PluginKey<NotesSearchState>("oe-notes-body-search");
  const plugin = new Plugin<NotesSearchState>({
    key,
    state: {
      init: (_, state) => notesSearchState(state.doc, ""),
      apply: (tr, prior) => {
        const query = tr.getMeta(key) as unknown;
        if (typeof query === "string" && query.trim() === prior.query && !tr.docChanged) return prior;
        if (typeof query === "string") return notesSearchState(tr.doc, query);
        return tr.docChanged && prior.query ? notesSearchState(tr.doc, prior.query) : prior;
      }
    },
    props: { decorations: state => key.getState(state)?.decorations ?? DecorationSet.empty }
  });
  return { key, plugin, selection(state: EditorState, index: number) {
    const ranges = key.getState(state)?.ranges, range = Number.isInteger(index) && index >= 0 ? ranges?.[index] : undefined;
    return range ? TextSelection.create(state.doc, range.from, range.to) : undefined;
  } };
}
