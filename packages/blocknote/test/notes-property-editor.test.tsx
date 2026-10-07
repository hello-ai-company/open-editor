/** @vitest-environment jsdom */
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { NotesPropertyEditor } from "../src/react/NotesPropertyEditor.js";
import { createRevisionedNotesResourceEditor, type NotesResourceResult, type NotesResourceRequest } from "../src/workspace/revisionedNotesResource.js";
it("isolates property drafts and ignores the old delayed callback while observing its write settlement", async () => {
  const global = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }; const prior = global.IS_REACT_ACT_ENVIRONMENT; global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  let request!: NotesResourceRequest, resolve!: (result: NotesResourceResult) => void;
  const onCommitted = vi.fn(), editor = createRevisionedNotesResourceEditor({ commit: async r => { request = r; return new Promise(r => { resolve = r; }); }, lookupOperation: vi.fn() }, { resourceId: "row" });
  const render = (propertyId: string, value: string[]) => root.render(createElement(StrictMode, null, createElement(NotesPropertyEditor, { propertyId, value, definition: { type: "relation" }, revision: "r1", editor, onCommitted })));
  try {
    act(() => render("tags", ["old-a"])); act(() => render("relation", ["page-b"]));
    expect(container.querySelector("textarea")!.value).toBe('["page-b"]');
    await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await Promise.resolve(); });
    expect(request.change).toEqual({ kind: "patch", fields: { relation: ["page-b"] } });
    act(() => render("new-property", ["new-value"])); expect(container.querySelector("textarea")!.disabled).toBe(true);
    await act(async () => { resolve({ status: "committed", resourceId: "row", operationId: request.operationId, snapshot: { revision: "r2", value: { relation: ["page-b"] } } }); });
    expect(onCommitted).not.toHaveBeenCalled(); expect(container.querySelector("textarea")!.value).toBe('["new-value"]'); expect(container.querySelector("textarea")!.disabled).toBe(false);
  } finally { act(() => root.unmount()); container.remove(); global.IS_REACT_ACT_ENVIRONMENT = prior; }
});
