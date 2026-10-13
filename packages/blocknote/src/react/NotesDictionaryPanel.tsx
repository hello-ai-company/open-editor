import { useMemo, useState } from "react";
import { useNotesEntries, type NotesEditorBridge } from "./notesWorkspacePanels.js";

/** Authorized text supplied by the host; no implicit dictionary fetch or HTML interpretation. */
export type NotesDictionaryEntry = { id: string; term: string; definition: string };
export function NotesDictionaryPanel({ bridge, entries, language = "ja" }: { bridge: NotesEditorBridge; entries: readonly NotesDictionaryEntry[]; language?: "ja" | "en" }) {
  const blocks = useNotesEntries(bridge.index), [query, setQuery] = useState("");
  const matches = useMemo(() => entries.slice(0, 1000).filter(entry => entry.term.trim() && entry.term.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(entry => ({ entry, blocks: blocks.filter(block => block.text.toLocaleLowerCase().includes(entry.term.toLocaleLowerCase())).slice(0, 100) })).filter(item => item.blocks.length).slice(0, 100), [entries, blocks, query]);
  const ja = language === "ja";
  return <section className="oe-notes-dictionary" aria-label={ja ? "辞書のヒント" : "Dictionary hints"}><h3>{ja ? "辞書のヒント" : "Dictionary hints"}</h3><input type="search" aria-label={ja ? "辞書の用語を検索" : "Find dictionary term"} value={query} onChange={event => setQuery(event.target.value)} />
    {matches.length ? matches.map(({ entry, blocks }) => <article key={entry.id}><strong>{entry.term}</strong><p>{entry.definition}</p><ul>{blocks.map(block => <li key={block.blockId}><button type="button" onClick={() => bridge.focusBlock(block.blockId)}>{block.text}</button></li>)}</ul></article>) : <p>{ja ? "この文書に一致する用語はありません" : "No matching terms in this document."}</p>}
  </section>;
}
