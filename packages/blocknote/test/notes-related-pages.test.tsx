/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditorDocument, type BacklinkItem } from "@hello-ai-company/editor-core";
import { NotesRelatedPages } from "../src/react/NotesRelatedPages.js";
import type { NotesWorkspaceController, NotesWorkspaceHost, NotesWorkspaceSnapshot, NotesWorkspaceState } from "../src/notes/contracts.js";
let root: Root, container: HTMLDivElement;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; });
function fixture() {
  const scope = { actorId: "actor", workspaceId: "workspace" };
  let state: NotesWorkspaceState = { status: "ready", dirty: false, composing: false, pendingEditors: false, localDrafts: {}, message: "", snapshot: { scope, target: { kind: "page", pageId: "a" }, revision: "r1", contentRevision: "c1", title: "A", metadata: {}, capabilities: [], capabilitySemantics: {}, document: createEditorDocument([{ id: "card", type: "pageCard", props: { pageId: "b" } }, { id: "parent", type: "paragraph", children: [{ id: "mention", type: "pageCard", props: { pageId: "c" } }] }, { id: "self", type: "pageCard", props: { pageId: "a" } }]) } };
  const listeners = new Set<() => void>(); const update = (next: Partial<NotesWorkspaceState>) => { state = { ...state, ...next }; listeners.forEach(fn => fn()); };
  const controller = { getState: () => state, subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, setDraft: vi.fn(), execute: vi.fn() } as unknown as NotesWorkspaceController;
  const host = { scope } as NotesWorkspaceHost;
  const workspace: NotesWorkspaceSnapshot = { scope, revision: "w1", complete: false, hasMore: true, nextCursor: "more", pages: [
    { id: "a", title: "A", parentId: null, position: 0, relatedPageIds: ["b", "b", "deleted"] },
    { id: "b", title: "B", parentId: null, position: 1, relatedPageIds: ["a"] },
    { id: "c", title: "C", parentId: "a", position: 0 },
    { id: "d", title: "D", parentId: null, position: 4 },
    { id: "deleted", title: "Deleted", parentId: "a", position: 3, deletedAt: "deleted" }
  ] };
  const onOpen = vi.fn(async () => true);
  const render = () => root.render(<NotesRelatedPages controller={controller} host={host} workspace={workspace} onOpen={onOpen} language="en" />);
  return { scope, host, controller, workspace, onOpen, update, render };
}
const group = (label: string) => container.querySelector<HTMLElement>(`section[aria-label="${label}"]`)!;
const links = (label: string) => [...group(label).querySelectorAll("li button")].map(button => button.textContent);
describe("read-only Notes related pages", () => {
  it("combines explicit and nested outgoing references and known incoming hierarchy without duplicate/self/deleted pages", () => {
    const f = fixture(); act(f.render); expect(links("Related pages")).toEqual(["B", "C"]); expect(links("Backlinks")).toEqual(["B", "C"]); expect(container.textContent).not.toContain("Deleted"); expect(container.textContent).toContain("Showing loaded pages only."); expect(container.textContent).toContain("have not been checked"); expect(f.controller.execute).not.toHaveBeenCalled();
  });
  it("filters provider results to authorized loaded pages, never adopts their supplied titles", async () => {
    const f = fixture(); f.host.providers = { backlinks: { listBacklinks: vi.fn(async () => [{ sourceDocumentId: "b", sourceTitle: "Spoofed", kind: "link" }, { sourceDocumentId: "hidden", sourceTitle: "Secret", kind: "link" }]) } };
    await act(async () => { f.render(); }); expect(links("Backlinks")).toEqual(["B", "C"]); expect(container.textContent).not.toContain("Spoofed"); expect(container.textContent).not.toContain("Secret"); expect(f.host.providers.backlinks!.listBacklinks).toHaveBeenCalledWith({ targetType: "page", targetId: "a", limit: 100 });
  });
  it.each(["scope", "target", "revision", "unmount"])("drops a late provider result after %s changes", async field => {
    const f = fixture(); let resolve!: (items: BacklinkItem[]) => void;
    f.host.providers = { backlinks: { listBacklinks: () => new Promise(done => { resolve = done; }) } }; await act(async () => { f.render(); });
    await act(async () => { const snapshot = f.controller.getState().snapshot!; if (field === "unmount") root.render(null); else f.update({ snapshot: { ...snapshot, ...(field === "scope" ? { scope: { ...snapshot.scope, actorId: "other" } } : field === "target" ? { target: { kind: "page", pageId: "other" } } : { revision: "r2" }) } }); resolve([{ sourceDocumentId: "d", sourceTitle: "Late result", kind: "link" }]); });
    expect([...container.querySelectorAll("section[aria-label=Backlinks] li button")].map(button => button.textContent)).not.toContain("D"); expect(f.controller.execute).not.toHaveBeenCalled();
  });
  it("retains the document on denied navigation and coalesces repeated clicks", async () => {
    const f = fixture(); let finish!: (allowed: boolean) => void; f.onOpen.mockImplementation(() => new Promise(done => { finish = done; })); act(f.render);
    const button = group("Related pages").querySelector<HTMLButtonElement>("li button")!; act(() => { button.click(); button.click(); }); expect(f.onOpen).toHaveBeenCalledTimes(1);
    await act(async () => finish(false)); expect(container.textContent).toContain("Your input is retained"); expect(f.controller.setDraft).not.toHaveBeenCalled();
  });
  it("rejects a same-turn composition or target change before React rerenders", () => {
    const f = fixture(); act(f.render); const button = group("Related pages").querySelector<HTMLButtonElement>("li button")!;
    act(() => { f.update({ composing: true }); button.click(); }); expect(f.onOpen).not.toHaveBeenCalled();
    act(() => f.update({ composing: false })); act(() => { f.update({ snapshot: { ...f.controller.getState().snapshot!, target: { kind: "page", pageId: "other" } } }); button.click(); }); expect(f.onOpen).not.toHaveBeenCalled();
  });
  it("fails closed on catalog scope mismatch and labels failed provider reads without losing known relations", async () => {
    const f = fixture(); f.host.providers = { backlinks: { listBacklinks: async () => { throw new Error("private transport details"); } } }; await act(async () => { f.render(); });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not load backlinks."); expect(links("Backlinks")).toEqual(["B", "C"]); expect(container.textContent).not.toContain("private");
    f.workspace.scope = { ...f.scope, workspaceId: "foreign" }; act(f.render); expect(container.textContent).toBe("");
  });
});
