import { describe, expect, it } from "vitest";
import { notesMoveBlock, type NotesBlockMove } from "../src/react/notesMoveBlock.js";

const fixture = () => [
  { id: "parent", props: { unknown: { retained: true } }, children: [
    { id: "a", children: [] },
    { id: "b", children: [{ id: "grandchild", children: [] }] },
    { id: "c", children: [] }
  ] },
  { id: "other", props: { unknown: { retained: true } }, children: [] }
];
describe("Notes sibling movement", () => {
  it.each<[NotesBlockMove, string[]]>([["moveUp", ["b", "a", "c"]], ["moveDown", ["a", "c", "b"]], ["moveTop", ["b", "a", "c"]], ["moveBottom", ["a", "c", "b"]]])("%s keeps the parent and complete child subtree", (move, expected) => {
    const source = fixture(), before = JSON.stringify(source), next = notesMoveBlock(source, "b", move);
    expect(next[0]!.children.map(block => block.id)).toEqual(expected);
    expect(next.map(block => block.id)).toEqual(["parent", "other"]);
    expect(next[0]!.children.find(block => block.id === "b")).toBe(source[0]!.children[1]);
    expect(next[0]!.props).toBe(source[0]!.props); expect(next[1]).toBe(source[1]); expect(JSON.stringify(source)).toBe(before);
  });
  it.each<[string, NotesBlockMove]>([["a", "moveUp"], ["c", "moveDown"], ["a", "moveTop"], ["c", "moveBottom"], ["missing", "moveTop"]])("keeps %s in place at the %s boundary", (id, move) => {
    const source = fixture(); expect(notesMoveBlock(source, id, move)).toBe(source);
  });
  it("retains top-level behavior and moves descendants only within their own siblings", () => {
    const source = fixture(); expect(notesMoveBlock(source, "other", "moveUp").map(block => block.id)).toEqual(["other", "parent"]);
    expect(notesMoveBlock(source, "grandchild", "moveTop")).toBe(source);
  });
});
