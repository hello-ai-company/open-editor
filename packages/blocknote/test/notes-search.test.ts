import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { history, undo } from "@tiptap/pm/history";
import { createNotesSearchPlugin, notesSearchState } from "../src/react/notesSearch.js";
const schema = new Schema({ nodes: { doc: { content: "block+" }, paragraph: { group: "block", content: "inline*" }, text: { group: "inline" }, atom: { group: "inline", inline: true, atom: true } }, marks: { strong: {} } });
const doc = (text: string) => schema.node("doc", null, [schema.node("paragraph", null, text ? schema.text(text) : [])]);
describe("ephemeral literal body search", () => {
 it("finds adjacent marked text without modifying its source or marks", () => {
  const source = schema.node("doc", null, [schema.node("paragraph", null, [schema.text("Hello "),schema.text("WORLD",[schema.mark("strong")]),schema.text(" hello world")])]);
  const before = source.toJSON(), result = notesSearchState(source,"hello world");
  expect(result.ranges).toEqual([{from:1,to:12},{from:13,to:24}]);expect(source.toJSON()).toEqual(before);expect(result.decorations.find()).toHaveLength(2);
 });
 it.each(["[a]", ".*", "$", "\\", "👩‍💻", "İ", "a+b"])('matches literal %s and uses source UTF-16 positions', query => {
  const text = "prefix " + query + " tail", result = notesSearchState(doc(text),query);
  expect(result.ranges).toEqual([{from:8,to:8+query.length}]);
 });
 it("does not join text across inline atoms", () => {
  const source=schema.node("doc",null,[schema.node("paragraph",null,[schema.text("a"),schema.node("atom"),schema.text("b")])]);
  expect(notesSearchState(source,"ab").ranges).toEqual([]);expect(notesSearchState(source,"b").ranges).toEqual([{from:3,to:4}]);
 });
 it("bounds matches without pretending the total is complete", () => { const result=notesSearchState(doc("x ".repeat(1200)),"x");expect(result.ranges).toHaveLength(1000);expect(result.capped).toBe(true);expect(notesSearchState(doc("x ".repeat(1000)),"x").capped).toBe(false); });
 it("empty/overlong search performs no document walk", () => { const source=doc("Keep");expect(notesSearchState(source," ").decorations.find()).toEqual([]);expect(notesSearchState(source,"x".repeat(501)).ranges).toEqual([]); });
 it("rebuilds ranges on editing, clears on query removal and keeps empty-search state inert", () => {
  const search=createNotesSearchPlugin();let state=EditorState.create({schema,doc:doc("hello"),plugins:[search.plugin]});const empty=search.key.getState(state);
  state=state.apply(state.tr.insertText("!",6));expect(search.key.getState(state)).toBe(empty);
  state=state.apply(state.tr.setMeta(search.key,"hello"));expect(search.key.getState(state)?.ranges).toEqual([{from:1,to:6}]);
  state=state.apply(state.tr.insertText("no ",1));expect(search.key.getState(state)?.ranges).toEqual([{from:4,to:9}]);expect(search.selection(state,0)?.from).toBe(4);expect(search.selection(state,-1)).toBeUndefined();
  state=state.apply(state.tr.setMeta(search.key,""));expect(search.key.getState(state)?.decorations.find()).toEqual([]);
 });
 it("query/highlight/navigation transactions never consume or add an undo step", () => {
  const search=createNotesSearchPlugin();let state=EditorState.create({schema,doc:doc("before"),plugins:[history(),search.plugin]});const apply=(tr: Parameters<typeof state.apply>[0])=>{state=state.apply(tr);};
  apply(state.tr.insertText(" after",7));const edited=state.doc.toJSON();apply(state.tr.setMeta(search.key,"after").setMeta("addToHistory",false));apply(state.tr.setSelection(search.selection(state,0)!).setMeta("addToHistory",false));expect(state.doc.toJSON()).toEqual(edited);
  expect(undo(state,apply)).toBe(true);expect(state.doc.textContent).toBe("before");expect(search.key.getState(state)?.ranges).toEqual([]);
 });
});
