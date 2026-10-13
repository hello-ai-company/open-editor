/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { beginNotesToolDrag, consumeNotesToolDrag, currentNotesToolDrag, endNotesToolDrag, notesDropAnchor, subscribeNotesToolDrags } from "../src/react/notesToolDrag.js";

afterEach(endNotesToolDrag);
describe("scoped insertion drags", () => {
  it("accepts one matching in-process drag, rejecting forged, cross-writer and repeated payloads", () => {
    const value = beginNotesToolDrag("actor/workspace/page/writer-1", "tableInsert");
    expect(consumeNotesToolDrag(value, "actor/workspace/page/writer-2")).toBeUndefined();
    expect(consumeNotesToolDrag(value.replace('tableInsert', 'columns'), "actor/workspace/page/writer-1")).toBeUndefined();
    expect(consumeNotesToolDrag(value, "actor/workspace/page/writer-1")).toBe("tableInsert");
    expect(consumeNotesToolDrag(value, "actor/workspace/page/writer-1")).toBeUndefined();
  });
  it("cancels the source token without converting external JSON or text into an insertion", () => {
    const value = beginNotesToolDrag("same", "code"); endNotesToolDrag();
    expect(currentNotesToolDrag("same")).toBeUndefined(); expect(consumeNotesToolDrag(value, "same")).toBeUndefined();
  });
  it("source cleanup does not cancel a newer drag from a different inspector", () => {
    const old = beginNotesToolDrag("old", "text"), next = beginNotesToolDrag("next", "columns");
    endNotesToolDrag(old);
    expect(consumeNotesToolDrag(next, "next")).toBe("columns");
  });
  it("notifies the receiver when the drag is cancelled so the insertion marker can close", () => {
    let count = 0; const unsubscribe = subscribeNotesToolDrags(() => count++);
    beginNotesToolDrag("same", "text"); endNotesToolDrag(); expect(count).toBe(2);
    unsubscribe(); beginNotesToolDrag("same", "text"); expect(count).toBe(2);
  });
  it("resolves before/after from the hit block, including nested blocks and whitespace", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div class="bn-block-outer" data-id="parent"><div class="bn-block-outer" data-id="child"><span>Nested</span></div></div><div class="bn-block-outer" data-id="last"></div>';
    const [parent, child, last] = [...root.querySelectorAll<HTMLElement>("[data-id]")];
    for (const [node, top, height] of [[parent!, 10, 100], [child!, 40, 30], [last!, 120, 30]] as const) node.getBoundingClientRect = () => ({ x: 0, y: top, top, bottom: top + height, left: 0, right: 200, width: 200, height, toJSON() {} });
    expect(notesDropAnchor(root, child!.firstChild, 30, 42)).toEqual({ blockId: "child", placement: "before" });
    expect(notesDropAnchor(root, child!.firstChild, 30, 68)).toEqual({ blockId: "child", placement: "after" });
    expect(notesDropAnchor(root, root, 30, 180)).toEqual({ blockId: "last", placement: "after" });
    expect(notesDropAnchor(document.createElement("div"), null, 0, 0)).toBeUndefined();
  });
  it("resolves a column's header hit to a child boundary rather than inserting an orphan column sibling", () => {
    const root = document.createElement("div"); root.innerHTML = '<div class="bn-block-outer" data-id="column"><div data-content-type="oeColumn"><span>Header</span></div><div class="bn-block-outer" data-id="text"><div data-content-type="paragraph"></div></div></div>';
    const child = root.querySelector<HTMLElement>('[data-id="text"]')!;
    child.getBoundingClientRect = () => ({ x: 20, y: 40, top: 40, bottom: 80, left: 20, right: 200, width: 180, height: 40, toJSON() {} });
    expect(notesDropAnchor(root, root.querySelector("span"), 30, 20)).toEqual({ blockId: "text", placement: "before" });
    expect(notesDropAnchor(root, root.querySelector("span"), 30, 100)).toEqual({ blockId: "text", placement: "after" });
  });
});
