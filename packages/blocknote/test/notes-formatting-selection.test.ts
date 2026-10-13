import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { notesFormattingSelectionAvailable } from "../src/react/notesFormattingSelection.js";
const schema = new Schema({ nodes: {
  doc: { content: "block+" }, paragraph: { content: "inline*", group: "block" },
  code: { content: "text*", group: "block", code: true }, image: { group: "block", atom: true },
  text: { group: "inline" },
} });
const block = (type: "paragraph" | "code", text: string) => schema.node(type, null, text ? schema.text(text) : undefined);
const available = (children: Parameters<typeof schema.node>[2], from: number, to = from) => {
  const doc = schema.node("doc", null, children);
  return notesFormattingSelectionAvailable(EditorState.create({ schema, doc, selection: TextSelection.create(doc, from, to) }));
};
describe("F8 respects native formatting eligibility", () => {
  it("keeps nonempty inline text eligible including whitespace", () => {
    expect(available([block("paragraph", "Human text")], 1, 6)).toBe(true);
    expect(available([block("paragraph", "   ")], 1, 3)).toBe(true);
  });
  it("keeps multiblock inline ranges eligible", () => {
    expect(available([block("paragraph", "one"), block("paragraph", "two")], 1, 9)).toBe(true);
  });
  it("rejects code and ranges crossing plain content", () => {
    expect(available([block("code", "const x")], 1, 6)).toBe(false);
    expect(available([block("paragraph", "one"), block("code", "two")], 1, 9)).toBe(false);
  });
  it("rejects empty selections and a text range containing only block boundaries", () => {
    expect(available([block("paragraph", "one")], 1)).toBe(false);
    expect(available([block("paragraph", ""), block("paragraph", "")], 1, 3)).toBe(false);
  });
  it("preserves native non-text node selection controls", () => {
    const doc = schema.node("doc", null, [schema.node("image")]);
    expect(notesFormattingSelectionAvailable(EditorState.create({ schema, doc, selection: NodeSelection.create(doc, 0) }))).toBe(true);
  });
});
