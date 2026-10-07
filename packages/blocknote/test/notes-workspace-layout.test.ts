// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createElement, act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createNotesLayout, openNotesTab, closeNotesTab, splitNotesTab, parseNotesLayout, notesLayoutPanes, notesLayoutStorageKey, loadNotesLayout, saveNotesLayout, repairNotesLayout, notesDropZone, type NotesLayoutStorage } from "../src/notes/layoutState.js";
import { createNotesCanvasController, NotesWorkspaceModes, type NotesCanvasHost, type NotesCanvasResult, type NotesCanvasSnapshot, type NotesWorkspaceModesProps } from "../src/react/NotesWorkspaceModes.js";
import { NotesWorkspaceTabs } from "../src/react/NotesWorkspaceTabs.js";

const scope = { actorId: "actor", workspaceId: "workspace" }, target = { kind: "page" as const, pageId: "a" };
const tab = (id: string) => ({ id, target: { kind: "page" as const, pageId: id }, title: id, pinned: false });
const layout = () => openNotesTab(openNotesTab(createNotesLayout(scope), tab("a")), tab("b"));
const draft = { layout: { root: "valid" }, view: {}, theme: "modern" as const };
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { resolve, reject, promise }; };
function canvasFixture() {
  let snapshot: NotesCanvasSnapshot = { scope, target, revision: "c1", documentRevision: "d1", layout: null, view: {}, theme: "modern", capabilities: ["canvas.save", "canvas.repair"] };
  const receipts = new Map<string, NotesCanvasResult>();
  const beforeSubmit = vi.fn(async () => {});
  const commit = vi.fn<NotesCanvasHost["commit"]>(async request => {
    snapshot = { ...snapshot, ...request.draft, revision: "c2" };
    const result: NotesCanvasResult = { scope, target, operationId: request.operationId, status: "committed", snapshot };
    receipts.set(request.operationId, result); return result;
  });
  const lookup = vi.fn<NotesCanvasHost["lookup"]>(async (_scope, _target, operationId) => receipts.get(operationId) ?? { scope, target, operationId, status: "not-found", terminal: true });
  const host: NotesCanvasHost = { read: async () => snapshot, commit, lookup, beforeSubmit };
  const controller = createNotesCanvasController({ scope, target, documentRevision: "d1", host, validate: value => (value as { root: string }).root === "valid" ? [] : ["invalid"], operationId: () => "operation", timeoutMs: 100 });
  return { host, controller, commit, beforeSubmit, lookup, receipts, setSnapshot: (next: NotesCanvasSnapshot) => { snapshot = next; } };
}

describe("Notes layout ownership and migration", () => {
  it("isolates identical resource IDs by actor, workspace and row database", () => {
    expect(notesLayoutStorageKey(scope)).not.toBe(notesLayoutStorageKey({ ...scope, actorId: "other" }));
    expect(() => parseNotesLayout(layout(), { ...scope, workspaceId: "other" })).toThrow(/scope/);
    const rows = { ...layout(), tabs: [tab("a"), { ...tab("b"), target: { kind: "row" as const, databaseId: "db", rowId: "a" } }] };
    expect(notesLayoutPanes(splitNotesTab(rows, "a", "left")).every(pane => !pane.readOnly)).toBe(true);
  });
  it("keeps pinned tabs and maps close/split/drop without orphan active IDs", () => {
    const current = layout(), pinned = { ...current, tabs: current.tabs.map(item => ({ ...item, pinned: item.id === "b" })) };
    expect(closeNotesTab(pinned, "b")).toBe(pinned);
    const split = splitNotesTab(current, "a", "left"); expect(split.split.axis).toBe("horizontal"); expect(split.split.tabIds).toEqual(["a"]);
    expect(notesLayoutPanes(split).map(pane => pane.tab.id)).toEqual(["a", "b"]);
    expect(notesLayoutPanes(splitNotesTab(current, "a", "right")).map(pane => pane.tab.id)).toEqual(["b", "a"]);
    const closed = closeNotesTab(split, "b"); expect(closed.activeTabId).toBe("a"); expect(closed.split.tabIds).toEqual([]);
    expect(notesDropZone(.1, .5)).toBe("left"); expect(notesDropZone(.5, .1)).toBe("top"); expect(notesDropZone(.5, .5)).toBe("center");
  });
  it("gives duplicate resource panes only one writer", () => {
    const current = { ...layout(), tabs: [tab("a"), { ...tab("b"), target: tab("a").target }] };
    expect(notesLayoutPanes(splitNotesTab(current, "a", "right")).map(pane => pane.readOnly)).toEqual([false, true]);
  });
  it("copies legacy tabs once without modifying original keys and retains exact raw bytes", async () => {
    const original = '[ "a", "b", "a" ]', values = new Map<string, string>([["legacy-tabs", original]]);
    const storage: NotesLayoutStorage = { read: async key => values.get(key) ?? null, write: async (key, value) => { values.set(key, value); } };
    const first = await loadNotesLayout(storage, scope, { key: "legacy-tabs" }); expect(first.status).toBe("migrated");
    expect(values.get("legacy-tabs")).toBe(original);
    const envelope = JSON.parse(values.get(notesLayoutStorageKey(scope))!); expect(envelope.legacyOriginal).toBe(original);
    if (first.status === "migrated") await saveNotesLayout(storage, first.layout);
    expect(JSON.parse(values.get(notesLayoutStorageKey(scope))!).legacyOriginal).toBe(original);
    expect((await loadNotesLayout(storage, scope, { key: "legacy-tabs" })).status).toBe("loaded");
  });
  it("preserves invalid state until explicit repair and rejects concurrent repair", async () => {
    const original = '{"version":999,"future":"keep"}', values = new Map([[notesLayoutStorageKey(scope), original]]);
    const storage: NotesLayoutStorage = { read: async key => values.get(key) ?? null, write: async (key, value) => { values.set(key, value); } };
    expect(await loadNotesLayout(storage, scope)).toMatchObject({ status: "invalid", original });
    await expect(saveNotesLayout(storage, layout())).rejects.toThrow(); expect(values.get(notesLayoutStorageKey(scope))).toBe(original);
    await expect(repairNotesLayout(storage, layout(), "different")).rejects.toThrow(/changed/);
    await repairNotesLayout(storage, layout(), original); expect(JSON.parse(values.get(notesLayoutStorageKey(scope))!).legacyOriginal).toBe(original);
  });
});

describe("scoped revisioned Canvas host", () => {
  it("journals before commit and only reports saved from a canonical receipt", async () => {
    const f = canvasFixture(); await f.controller.read(); f.controller.edit(draft); expect(f.controller.getState().dirty).toBe(true);
    expect(await f.controller.save()).toBe(true);
    expect(f.beforeSubmit.mock.invocationCallOrder[0]).toBeLessThan(f.commit.mock.invocationCallOrder[0]!);
    expect(f.controller.getState()).toMatchObject({ status: "ready", dirty: false, snapshot: { revision: "c2" } });
    await f.controller.read(); expect(f.controller.getState().draft).toEqual(draft);
  });
  it("recovers lost ACK by read-only lookup without resubmitting or clearing drafts", async () => {
    const f = canvasFixture(); await f.controller.read(); f.controller.edit(draft);
    const original = f.commit.getMockImplementation()!;
    f.commit.mockImplementationOnce(async (...args) => { await original(...args); throw new Error("lost ACK"); });
    expect(await f.controller.save()).toBe(false); expect(f.controller.getState().status).toBe("unknown");
    expect(await f.controller.save()).toBe(false); expect(f.commit).toHaveBeenCalledTimes(1);
    const recovery = f.controller.getState().recovery!;
    expect(() => createNotesCanvasController({ scope: { ...scope, actorId: "wrong" }, target, documentRevision: "d1", host: f.host, recovery, validate: () => [] })).toThrow(/scope/);
    expect(await f.controller.reconcile()).toBe(true); expect(f.lookup).toHaveBeenCalledTimes(1); expect(f.commit).toHaveBeenCalledTimes(1);
  });
  it("cannot overwrite invalid raw Canvas without explicit repair and capability", async () => {
    const f = canvasFixture(); const invalid = { scope, target, revision: "c1", documentRevision: "d1", layout: { root: "unknown", future: "kept" }, view: {}, theme: "modern" as const, capabilities: ["canvas.save", "canvas.repair"] as const };
    f.setSnapshot(invalid); await f.controller.read(); expect(f.controller.getState().snapshot!.layout).toEqual(invalid.layout);
    expect(() => f.controller.edit(draft)).toThrow(/repair/); expect(await f.controller.save()).toBe(false); expect(f.commit).not.toHaveBeenCalled();
    f.controller.edit(draft, { repair: true }); expect(await f.controller.save()).toBe(true); expect(f.commit.mock.calls[0]![0].repair).toBe(true);
  });
  it("cancels preflight without commit and blocks changed document revision", async () => {
    const f = canvasFixture(); await f.controller.read(); f.controller.edit(draft);
    const gate = deferred<void>(); f.beforeSubmit.mockImplementationOnce(() => gate.promise);
    const save = f.controller.save(); f.controller.cancel(); gate.resolve(); expect(await save).toBe(false); expect(f.commit).not.toHaveBeenCalled();
    f.controller.setDocumentRevision("d2"); expect(await f.controller.save()).toBe(false); expect(f.controller.getState().status).toBe("conflict"); expect(f.commit).not.toHaveBeenCalled();
  });
  it("promptly retains unknown outcome when cancelling a submitted host that ignores AbortSignal", async () => {
    const f = canvasFixture(), controller = createNotesCanvasController({ scope, target, documentRevision: "d1", host: f.host, validate: () => [] });
    await controller.read(); controller.edit(draft); f.commit.mockImplementationOnce(() => new Promise(() => {}));
    const save = controller.save(); await vi.waitFor(() => expect(f.commit).toHaveBeenCalledTimes(1)); controller.cancel();
    expect(await save).toBe(false); expect(controller.getState()).toMatchObject({ status: "unknown", dirty: true, draft }); expect(controller.getState().recovery).toBeDefined(); expect(await controller.save()).toBe(false); expect(f.commit).toHaveBeenCalledTimes(1); controller.dispose();
  }, 1000);
  it("holds unknown status for mismatched receipt identity and fences double click", async () => {
    const f = canvasFixture(); await f.controller.read(); f.controller.edit(draft);
    const gate = deferred<NotesCanvasResult>(); f.commit.mockImplementationOnce(() => gate.promise);
    const save = f.controller.save(); await vi.waitFor(() => expect(f.commit).toHaveBeenCalledTimes(1)); expect(await f.controller.save()).toBe(false);
    gate.resolve({ operationId: "operation", target, scope: { ...scope, actorId: "other" }, status: "denied" }); await save;
    expect(f.controller.getState().status).toBe("unknown"); expect(f.controller.getState().dirty).toBe(true);
  });
  it.each(["layout", "view", "theme"] as const)("keeps the reviewed Canvas draft when committed %s differs", async field => {
    const f = canvasFixture(); await f.controller.read(); f.controller.edit(draft);
    const original = f.commit.getMockImplementation()!;
    f.commit.mockImplementationOnce(async (...args) => {
      const result = await original(...args);
      if (result.status !== "committed") throw new Error("Fixture error");
      return { ...result, snapshot: { ...result.snapshot, ...(field === "theme" ? { theme: "technical" as const } : { [field]: field === "layout" ? { root: "valid", unrelated: true } : { selected: "other" } }) } };
    });
    expect(await f.controller.save()).toBe(false); expect(f.controller.getState()).toMatchObject({ status: "unknown", dirty: true, draft }); expect(f.controller.getState().recovery).toBeDefined(); expect(await f.controller.save()).toBe(false); expect(f.commit).toHaveBeenCalledTimes(1);
  });
  it("local drafts never advertise persisted success", async () => {
    const controller = createNotesCanvasController({ scope, target, documentRevision: "d1", validate: () => [] });
    controller.edit(draft); expect(await controller.save()).toBe(false); expect(controller.getState()).toMatchObject({ status: "local", dirty: true });
  });
});

describe("guarded tabs", () => {
  it("keeps dirty tab on denied close and cancels pending navigation", async () => {
    const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
    const onChange = vi.fn(), beforeClose = vi.fn(async () => false), gate = deferred<boolean>(), onNavigate = vi.fn(() => gate.promise);
    const flag = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }; flag.IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () => root.render(createElement(NotesWorkspaceTabs, { layout: layout(), onChange, beforeClose, onNavigate, renderPane: () => "body" })));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close b"]')!.click()); expect(onChange).not.toHaveBeenCalled(); expect(beforeClose).toHaveBeenCalledTimes(1);
    await act(async () => container.querySelector<HTMLButtonElement>('[role="tab"]')!.click());
    await act(async () => container.querySelector("section")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await act(async () => gate.resolve(true)); expect(onChange).not.toHaveBeenCalled();
    await act(async () => root.unmount()); container.remove(); flag.IS_REACT_ACT_ENVIRONMENT = false;
  });
  it("guards dirty split removal and catches nested renderer component errors", async () => {
    const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
    const flag = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }; flag.IS_REACT_ACT_ENVIRONMENT = true;
    const onChange = vi.fn(), beforeClose = vi.fn(async () => false), onNavigate = vi.fn(async () => true);
    function Broken(): never { throw new Error("Synthetic descendant failure"); }
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => root.render(createElement(NotesWorkspaceTabs, { layout: splitNotesTab(layout(), "a", "right"), onChange, beforeClose, onNavigate, renderPane: () => createElement(Broken) })));
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(2);
    const closeSplit = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent === "Close split view")!;
    await act(async () => closeSplit.click()); expect(beforeClose).toHaveBeenCalledWith({ kind: "page", pageId: "a" }, expect.any(AbortSignal)); expect(onNavigate).not.toHaveBeenCalled(); expect(onChange).not.toHaveBeenCalled();
    await act(async () => root.unmount()); log.mockRestore(); container.remove(); flag.IS_REACT_ACT_ENVIRONMENT = false;
  });
});

describe("public workspace modes", () => {
  it("supports local previews, static slides, widths and script-disabled frames under StrictMode", async () => {
    const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
    const flag = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }; flag.IS_REACT_ACT_ENVIRONMENT = true;
    const props: NotesWorkspaceModesProps = { scope, target, document: createEditorDocument([]), documentRevision: "d1", title: "Synthetic", beforeModeChange: async () => "d1", children: "Document body", renderers: {
      createLayout: () => draft, validateLayout: () => [], canvas: () => "Canvas body", site: () => "<h1>Site</h1><script>window.bad=true</script>", presentation: () => ["<h1>One</h1>", "<h1>Two</h1>"]
    } };
    await act(async () => root.render(createElement(StrictMode, null, createElement(NotesWorkspaceModes, props))));
    const button = (text: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(item => item.textContent === text)!;
    await act(async () => button("Create layout").click());
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(container.textContent).toContain("Canvas body"); expect(container.textContent).toContain("Local draft, not persisted");
    await act(async () => button("Site").click()); expect(container.querySelector("iframe")!.getAttribute("sandbox")).toBe("");
    await act(async () => button("390px").click()); expect(container.querySelector("iframe")!.style.width).toContain("390px");
    await act(async () => button("Present").click()); expect(container.querySelector("iframe")!.getAttribute("srcdoc")).toBe("<h1>One</h1>");
    await act(async () => button("Next").click()); expect(container.querySelector("iframe")!.getAttribute("srcdoc")).toBe("<h1>Two</h1>");
    expect(container.querySelector("iframe")!.getAttribute("sandbox")).toBe("");
    await act(async () => root.render(createElement(StrictMode, null, createElement(NotesWorkspaceModes, { ...props, composing: true })))); expect(button("Document").disabled).toBe(true);
    await act(async () => root.render(createElement(StrictMode, null, createElement(NotesWorkspaceModes, { ...props, pendingEditors: true })))); expect(button("Canvas").disabled).toBe(true);
    await act(async () => root.render(createElement(StrictMode, null, createElement(NotesWorkspaceModes, { ...props, manualSaveRequired: true })))); expect(button("Site").disabled).toBe(true);
    await act(async () => root.unmount()); container.remove(); flag.IS_REACT_ACT_ENVIRONMENT = false;
  });
  it("keeps Document visible when saved Canvas recovery belongs to another scope", async () => {
    const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
    const flag = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }; flag.IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () => root.render(createElement(NotesWorkspaceModes, { scope, target, document: createEditorDocument([]), documentRevision: "d1", title: "Synthetic", beforeModeChange: async () => "d1", children: "Original body preserved", canvasRecovery: { version: 1, request: { operationId: "op", scope: { ...scope, actorId: "other" }, target, expectedRevision: "c1", expectedDocumentRevision: "d1", draft, repair: false } }, renderers: { createLayout: () => draft, validateLayout: () => [], canvas: () => "Canvas" } })));
    expect(container.textContent).toContain("Original body preserved"); expect(container.querySelector('[role="alert"]')!.textContent).toContain("recovery scope is invalid"); expect(Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent === "Canvas")!.disabled).toBe(true);
    await act(async () => root.unmount()); container.remove(); flag.IS_REACT_ACT_ENVIRONMENT = false;
  });
  it("rejects a late mode switch across IME and exposes renderer failures", async () => {
    const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
    const flag = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }; flag.IS_REACT_ACT_ENVIRONMENT = true;
    const gate = deferred<string | false>(), beforeModeChange = vi.fn(() => gate.promise);
    const snapshot: NotesCanvasSnapshot = { scope, target, revision: "c1", documentRevision: "d1", ...draft, capabilities: ["canvas.save"] };
    const props: NotesWorkspaceModesProps = { scope, target, document: createEditorDocument([]), documentRevision: "d1", title: "Synthetic", beforeModeChange, canvasSnapshot: snapshot, children: "Original body", renderers: { createLayout: () => draft, validateLayout: () => [], canvas: () => { throw new Error("private renderer failure"); } } };
    await act(async () => root.render(createElement(NotesWorkspaceModes, props)));
    const canvas = () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(item => item.textContent === "Canvas")!;
    await act(async () => canvas().click());
    await act(async () => root.render(createElement(NotesWorkspaceModes, { ...props, composing: true })));
    await act(async () => root.render(createElement(NotesWorkspaceModes, { ...props, composing: false })));
    await act(async () => gate.resolve("d1")); expect(canvas().getAttribute("aria-selected")).toBe("false");
    beforeModeChange.mockImplementationOnce(async () => "d1"); await act(async () => canvas().click());
    expect(container.querySelector('[role="alert"]')!.textContent).toContain("Renderer failed"); expect(container.textContent).not.toContain("private renderer failure");
    await act(async () => root.unmount()); container.remove(); flag.IS_REACT_ACT_ENVIRONMENT = false;
  });
});
