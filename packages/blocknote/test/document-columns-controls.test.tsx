/** @vitest-environment jsdom */
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// The browser suite exercises the actual BlockNote node-view boundary. These
// tests isolate menu/input behavior from that boundary and actual CSS geometry.
vi.mock("@blocknote/react", () => ({ createReactBlockSpec: (config: unknown, implementation: unknown) => () => ({ config, implementation }) }));
import { createDocumentColumnBlockSpec } from "../src/document/workspaceFeature.js";
import type { BlockLike } from "../src/types.js";
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT; });
function mount(readOnly = false) {
  const column = { id: "c1", type: "oeColumn", props: { width: 1 }, children: [{ id: "p1", type: "paragraph", content: "Preserved" }] };
  const document: BlockLike[] = [{ id: "columns", type: "oeColumns", props: { gap: 16 }, children: [column, { id: "c2", type: "oeColumn", props: { width: 1 }, children: [{ id: "p2", type: "paragraph", content: "Unknown properties stay" }] }] }];
  const listeners = new Set<() => void>();
  const editor = { document, isEditable: !readOnly, onChange: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, updateBlock: vi.fn(), insertBlocks: vi.fn(), focus: vi.fn(), getTextCursorPosition: () => ({ block: { id: "p1" } }), schema: { blockSchema: {} }, transact: (work: () => void) => work(), replaceBlocks: vi.fn(), setTextCursorPosition: vi.fn() };
  const render = (createDocumentColumnBlockSpec() as unknown as { implementation: { render(props: { block: typeof column; editor: typeof editor }): ReactElement } }).implementation.render;
  act(() => root.render(render({ block: column, editor }))); return { editor, column, changed: () => { for (const listener of listeners) listener(); } };
}
describe("quiet Columns controls", () => {
  it("opens by keyboard, closes with Escape and restores its discovery control without editing content", () => {
    const f = mount(), details = container.querySelector("details")!, summary = container.querySelector("summary")!;
    expect(details.open).toBe(false); act(() => summary.click()); expect(details.open).toBe(true);
    const input = container.querySelector("input")!; input.focus(); act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(details.open).toBe(false); expect(document.activeElement).toBe(summary); expect(f.editor.updateBlock).not.toHaveBeenCalled(); expect(f.editor.replaceBlocks).not.toHaveBeenCalled();
  });
  it("commits one named width property on keyboard release without replacing the document", () => {
    const f = mount(), input = container.querySelector<HTMLInputElement>("input")!;
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "1.7"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    act(() => input.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true })));
    expect(f.editor.updateBlock).toHaveBeenCalledWith("c1", { props: { width: 1.7 } }); expect(f.editor.replaceBlocks).not.toHaveBeenCalled(); expect(f.column.children[0]!.content).toBe("Preserved");
  });
  it("fences a concurrent width change and keeps the input reviewable", () => {
    const f = mount(), input = container.querySelector<HTMLInputElement>("input")!;
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "1.7"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    f.column.props.width = 2;
    act(() => input.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true })));
    expect(f.editor.updateBlock).not.toHaveBeenCalled(); expect(container.querySelector('[role="alert"]')?.textContent).toContain("changed elsewhere"); expect(input.value).toBe("1.7");
  });
  it("updates keyboard labels and movement availability when a sibling moves without rewriting dirty input", () => {
    const f = mount(), input = container.querySelector<HTMLInputElement>("input")!;
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "1.7"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Move column 1 earlier"]')!.disabled).toBe(true);
    act(() => { f.editor.document[0]!.children = [...f.editor.document[0]!.children!].reverse(); f.changed(); });
    expect(container.querySelector('summary')!.getAttribute("aria-label")).toBe("Column 2 options");
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Move column 2 earlier"]')!.disabled).toBe(false);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Move column 2 later"]')!.disabled).toBe(true);
    expect(input.value).toBe("1.7"); expect(f.editor.updateBlock).not.toHaveBeenCalled(); expect(f.editor.replaceBlocks).not.toHaveBeenCalled();
  });
  it("keeps a genuinely empty column discoverable and adds a paragraph only on explicit action", () => {
    const f = mount(); act(() => { f.column.children = []; f.changed(); });
    const add = container.querySelector<HTMLButtonElement>('[aria-label="Add text to column 1"]')!;
    expect(add).not.toBeNull(); expect(f.editor.updateBlock).not.toHaveBeenCalled();
    act(() => add.click()); expect(f.editor.updateBlock).toHaveBeenCalledWith("c1", { children: [expect.objectContaining({ type: "paragraph", content: "" })] }); expect(f.editor.focus).toHaveBeenCalledOnce(); expect(f.editor.replaceBlocks).not.toHaveBeenCalled();
  });
});
