/** @vitest-environment jsdom */
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditorDocument, type JsonValue } from "@hello-ai-company/editor-core";
import { createNotesWorkspaceController } from "../src/notes/controller.js";
import type { NotesDocumentSnapshot, NotesWorkspaceHost } from "../src/notes/contracts.js";
import { EditorDraftLifecycleProvider, editorLocalDraftKey } from "../src/document/draftLifecycle.js";
import { SharedDatabaseViewShell, StoreBackedDatabaseView } from "../src/workspace/databaseView.js";
import { readDatabaseInputDraft } from "../src/workspace/databaseViewDraft.js";
import { createDatabaseRuntimeStore } from "../src/workspace/databaseRuntimeStore.js";
import { createOpenEditorNotesPreset } from "../src/notes/preset.js";
import type { DatabaseProvider } from "@hello-ai-company/editor-core";
import { createDefaultDatabaseViewConfig, type DatabaseViewConfigProvider } from "../src/workspace/databaseViewConfig.js";

function fixture() {
  const scope = { workspaceId: "synthetic-workspace", actorId: "synthetic-actor" };
  const snapshot: NotesDocumentSnapshot = { scope, target: { kind: "page", pageId: "a" }, revision: "r1", contentRevision: "c1", document: createEditorDocument([{ id: "p", type: "paragraph", content: "Retained body" }]), title: "Synthetic", metadata: {}, capabilities: ["document.save"], capabilitySemantics: { "document.save": "test-only" } };
  const host: NotesWorkspaceHost = { scope, readDocument: vi.fn<NotesWorkspaceHost["readDocument"]>(async target => ({ ...snapshot, target })), beforeSubmit: vi.fn(async () => undefined), commit: vi.fn(async () => { throw new Error("No test mutation permitted"); }), lookupOperation: vi.fn<NotesWorkspaceHost["lookupOperation"]>(async (target, operationId) => ({ status: "not-found", target, operationId, terminal: true })) };
  return { controller: createNotesWorkspaceController(host), host };
}
let container: HTMLDivElement, root: ReturnType<typeof createRoot>, prior: boolean | undefined;
beforeEach(() => { const flags = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }; prior = flags.IS_REACT_ACT_ENVIRONMENT; flags.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = prior; });
function mount(controller: ReturnType<typeof fixture>["controller"]) {
  const store = createDatabaseRuntimeStore(); store.ensureView("view", "db");
  const changed = vi.fn();
  act(() => root.render(createElement(StrictMode, {}, createElement(EditorDraftLifecycleProvider, { controller, children: createElement(SharedDatabaseViewShell, { snap: { ...store.getView("view"), status: "ready" }, store, viewKey: "view", blockId: "db-block", viewId: "main", viewType: "table", titleHint: "Synthetic", runtime: { store }, onViewConfigChange: changed }) }))));
  return { store, changed, input: container.querySelector<HTMLInputElement>('input[type="search"]')! };
}
function type(input: HTMLInputElement, value: string) { act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }); }
function key(controller: ReturnType<typeof fixture>["controller"]) { return editorLocalDraftKey(controller.getState().snapshot!, "db-block", "database-view-input:main"); }
const emptyRows = { databaseId: "db", rows: [], items: [], schema: {}, config: {}, pagination: { limit: 4, total: 0, hasMore: false, nextCursor: null } };
describe("Notes database input lifecycle", () => {
  it("fences settings review while search is pending or composing", async () => {
    const f = fixture(); await f.controller.open({ kind: "page", pageId: "a" }); vi.useFakeTimers();
    const store = createDatabaseRuntimeStore(); store.ensureView("view", "db"); let guard: (() => void) | undefined;
    act(() => root.render(createElement(EditorDraftLifecycleProvider, { controller: f.controller, children: createElement(SharedDatabaseViewShell, { snap: store.getView("view"), store, viewKey: "view", blockId: "db-block", viewId: "main", viewType: "table", titleHint: "DB", runtime: { store }, onConfigReviewGuard: value => { guard = value; } }) })));
    expect(() => guard!()).not.toThrow(); const input = container.querySelector<HTMLInputElement>('input[type="search"]')!;
    type(input, "Pending"); expect(() => guard!()).toThrow(/input/);
    act(() => input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); }); expect(() => guard!()).toThrow(/input/);
    act(() => input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); }); expect(() => guard!()).not.toThrow(); f.controller.dispose();
  });
  it("retains preferences when a delayed review completes after provider replacement", async () => {
    const f = fixture(); await f.controller.open({ kind: "page", pageId: "a" });
    const configValue = createDefaultDatabaseViewConfig({ databaseId: "db", viewId: "main", viewType: "table" });
    const preferenceKey = editorLocalDraftKey(f.controller.getState().snapshot!, "db-block", "database-view-preferences:main");
    const retained = { databaseId: "db", viewId: "main", config: { ...configValue, query: "Original" }, version: { readId: "old-reader", revision: "r1" } };
    f.controller.setLocalDraft(preferenceKey, JSON.parse(JSON.stringify(retained)));
    let resolve!: (value: { config: typeof configValue; version: { readId: string; revision: string } }) => void;
    const delayed = new Promise<{ config: typeof configValue; version: { readId: string; revision: string } }>(done => { resolve = done; });
    let loads = 0; const old: DatabaseViewConfigProvider = { loadVersioned: vi.fn(async () => ++loads === 1 ? { config: configValue, version: retained.version } : delayed), saveVersioned: vi.fn(async () => {}) };
    const next: DatabaseViewConfigProvider = { loadVersioned: vi.fn(async () => ({ config: { ...configValue, query: "Remote" }, version: { readId: "new-reader", revision: "r2" } })), saveVersioned: vi.fn(async () => {}) };
    const database: DatabaseProvider = { getDatabase: vi.fn(async () => ({ id: "db", title: "DB", propertyDefinitions: [] })), listRows: vi.fn(async () => emptyRows) }, store = createDatabaseRuntimeStore({ provider: database });
    const render = (provider: DatabaseViewConfigProvider) => root.render(createElement(EditorDraftLifecycleProvider, { controller: f.controller, children: createElement(StoreBackedDatabaseView, { runtime: { store, database, databaseViewConfig: provider }, block: { id: "db-block", props: { databaseId: "db", viewId: "main", viewType: "table", titleHint: "DB" } }, canChangeViews: true }) }));
    await act(async () => { render(old); });
    act(() => [...container.querySelectorAll("button")].find(b => b.textContent === "Review latest settings")!.click());
    await act(async () => { render(next); });
    await act(async () => { resolve({ config: configValue, version: retained.version }); await delayed; });
    expect(container.querySelector('[aria-label="Review latest view settings"]')).toBeNull();
    expect(f.controller.getState().localDrafts[preferenceKey]).toEqual(retained);
    expect(old.saveVersioned).not.toHaveBeenCalled(); expect(next.saveVersioned).not.toHaveBeenCalled(); f.controller.dispose();
  });
  it("caches search synchronously before debouncing and prevents another writer opening", async () => {
    const f = fixture(); await f.controller.open({ kind: "page", pageId: "a" }); vi.useFakeTimers();
    const ui = mount(f.controller); type(ui.input, "未確定の検索");
    expect(f.controller.getState().localDrafts[key(f.controller)]).toEqual({ databaseId: "db", viewId: "main", fields: { search: "未確定の検索" } });
    expect(f.controller.getState().pendingEditors).toBe(true); expect(await f.controller.open({ kind: "page", pageId: "b" })).toBe(false); expect(ui.changed).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(ui.store.getView("view").queryState.query).toBe("未確定の検索"); expect(ui.changed).toHaveBeenCalledWith({ query: "未確定の検索" }); expect(f.controller.getState().pendingEditors).toBe(false); expect(f.host.commit).not.toHaveBeenCalled();
  });
  it("keeps IME input across forced unmount without committing an intermediate query", async () => {
    const f = fixture(); await f.controller.open({ kind: "page", pageId: "a" }); vi.useFakeTimers(); const ui = mount(f.controller);
    act(() => ui.input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))); type(ui.input, "未確定");
    await act(async () => { await vi.advanceTimersByTimeAsync(300); }); expect(ui.changed).not.toHaveBeenCalled(); expect(f.controller.getState().composing).toBe(true);
    act(() => root.render(null)); expect(f.controller.getState().composing).toBe(false); expect(f.controller.getState().pendingEditors).toBe(true);
    const resumed = mount(f.controller); expect(resumed.input.value).toBe("未確定"); expect(resumed.changed).not.toHaveBeenCalled(); expect(await f.controller.open({ kind: "page", pageId: "b" })).toBe(false);
    type(resumed.input, ""); await act(async () => { await vi.advanceTimersByTimeAsync(200); }); expect(f.controller.getState().pendingEditors).toBe(false);
  });
  it("checks newer cached input before the timer can mutate query or persist view settings", async () => {
    const f = fixture(); await f.controller.open({ kind: "page", pageId: "a" }); vi.useFakeTimers(); const ui = mount(f.controller); type(ui.input, "Older query");
    const newer = { databaseId: "db", viewId: "main", fields: { search: "Newer editor input" } };
    act(() => f.controller.setLocalDraft(key(f.controller), newer));
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(ui.store.getView("view").queryState.query).toBe(""); expect(ui.changed).not.toHaveBeenCalled(); expect(f.controller.getState().localDrafts[key(f.controller)]).toEqual(newer); expect(ui.input.disabled).toBe(true);
    act(() => root.render(null)); expect(f.controller.getState().localDrafts[key(f.controller)]).toEqual(newer); expect(f.host.commit).not.toHaveBeenCalled();
  });
  it("retains pending search across controller identity replacement with the same database and block", async () => {
    const old = fixture(), next = fixture(); await old.controller.open({ kind: "page", pageId: "a" }); await next.controller.open({ kind: "page", pageId: "a" }); vi.useFakeTimers();
    const oldUI = mount(old.controller); type(oldUI.input, "Old source input"); const nextUI = mount(next.controller);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(nextUI.input.value).toBe(""); expect(oldUI.changed).not.toHaveBeenCalled(); expect(nextUI.changed).not.toHaveBeenCalled(); expect(old.controller.getState().pendingEditors).toBe(true); expect(next.controller.getState().pendingEditors).toBe(false);
    expect(mount(old.controller).input.value).toBe("Old source input");
  });
  it("retains input before a view-preference identity conflict can change the query", async () => {
    const f = fixture(); await f.controller.open({ kind: "page", pageId: "a" }); vi.useFakeTimers();
    const store = createDatabaseRuntimeStore(); store.ensureView("view", "db"); const changed = vi.fn();
    act(() => root.render(createElement(EditorDraftLifecycleProvider, { controller: f.controller, children: createElement(SharedDatabaseViewShell, { snap: store.getView("view"), store, viewKey: "view", blockId: "db-block", viewId: "main", viewType: "table", titleHint: "Synthetic", runtime: { store }, onViewConfigChange: changed, beforeViewConfigChange: () => { throw new Error("Newer preference input retained"); } }) })));
    type(container.querySelector<HTMLInputElement>('input[type="search"]')!, "Retain query"); await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(store.getView("view").queryState.query).toBe(""); expect(changed).not.toHaveBeenCalled(); expect(f.controller.getState().pendingEditors).toBe(true);
  });
  it("protects custom navigation from pending input and source changes between click and dispatch", async () => {
    const f = fixture(), onNavigate = vi.fn(async () => true), preset = createOpenEditorNotesPreset({ host: f.host, onNavigate }); await preset.controller.open({ kind: "page", pageId: "a" });
    const request = { databaseId: "db", rowKey: "row-exact", viewId: "main", viewType: "table" as const };
    preset.databaseViewRuntime!.onOpenRow!(request); preset.controller.setLocalDraft("pending", "Retain"); await act(async () => { await Promise.resolve(); }); expect(onNavigate).not.toHaveBeenCalled();
    preset.controller.setLocalDraft("pending", undefined); preset.databaseViewRuntime!.onOpenRow!(request); await act(async () => { await Promise.resolve(); }); expect(onNavigate).toHaveBeenCalledWith({ kind: "row", databaseId: "db", rowId: "row-exact" }); preset.controller.dispose();
  });
  it("stops missing-config registration when newer preference input arrives during hydration", async () => {
    const f = fixture(); await f.controller.open({ kind: "page", pageId: "a" });
    let resolve!: (value: undefined) => void; const loaded = new Promise<undefined>(done => { resolve = done; });
    const config: DatabaseViewConfigProvider = { load: vi.fn(async () => loaded), save: vi.fn(async () => undefined), list: vi.fn(async () => []) };
    const database: DatabaseProvider = { getDatabase: vi.fn(async () => ({ id: "db", title: "DB", propertyDefinitions: [] })), listRows: vi.fn(async () => emptyRows) };
    const store = createDatabaseRuntimeStore({ provider: database });
    act(() => root.render(createElement(EditorDraftLifecycleProvider, { controller: f.controller, children: createElement(StoreBackedDatabaseView, { runtime: { store, database, databaseViewConfig: config }, block: { id: "db-block", props: { databaseId: "db", viewId: "main", viewType: "table", titleHint: "DB" } }, canChangeViews: true }) })));
    const preferenceKey = editorLocalDraftKey(f.controller.getState().snapshot!, "db-block", "database-view-preferences:main");
    const newer = { databaseId: "db", viewId: "main", config: { ...createDefaultDatabaseViewConfig({ databaseId: "db", viewId: "main", viewType: "table" }), query: "Newer retained" } };
    act(() => f.controller.setLocalDraft(preferenceKey, JSON.parse(JSON.stringify(newer)))); await act(async () => { resolve(undefined); await loaded; });
    expect(config.save).not.toHaveBeenCalled(); expect(database.listRows).not.toHaveBeenCalled(); expect(f.controller.getState().localDrafts[preferenceKey]).toEqual(newer); expect(container.textContent).toContain("Original database view settings are retained"); expect(container.querySelector<HTMLInputElement>('input[type="search"]')!.disabled).toBe(true);
  });
  it("recovers retained preferences against current metadata and writes only on explicit Retry", async () => {
    const f = fixture(); await f.controller.open({ kind: "page", pageId: "a" });
    const preferenceKey = editorLocalDraftKey(f.controller.getState().snapshot!, "db-block", "database-view-preferences:main"); const configValue = createDefaultDatabaseViewConfig({ databaseId: "db", viewId: "main", viewType: "table" }); configValue.query = "Retained"; configValue.filters = [{ propertyId: "score", propertyType: "number", operator: "gt", value: 50 }]; configValue.propertySort = { propertyId: "score", direction: "desc" };
    f.controller.setLocalDraft(preferenceKey, JSON.parse(JSON.stringify({ databaseId: "db", viewId: "main", config: configValue })));
    const config: DatabaseViewConfigProvider = { load: vi.fn(async () => undefined), save: vi.fn(async () => undefined), list: vi.fn(async () => []) };
    const database: DatabaseProvider = { getDatabase: vi.fn(async () => ({ id: "db", title: "DB", propertyDefinitions: [{ id: "score", name: "Score", type: "number" as const }], queryCapabilities: { propertyFilters: true, propertySort: true } })), listRows: vi.fn(async () => emptyRows) }, store = createDatabaseRuntimeStore({ provider: database });
    await act(async () => { root.render(createElement(EditorDraftLifecycleProvider, { controller: f.controller, children: createElement(StoreBackedDatabaseView, { runtime: { store, database, databaseViewConfig: config }, block: { id: "db-block", props: { databaseId: "db", viewId: "main", viewType: "table", titleHint: "DB" } }, canChangeViews: true }) })); });
    expect(container.querySelector<HTMLInputElement>('input[type="search"]')!.value).toBe("Retained"); expect(config.save).not.toHaveBeenCalled(); expect(f.controller.getState().pendingEditors).toBe(true);
    await act(async () => { [...container.querySelectorAll("button")].find(button => button.textContent === "Retry save")!.click(); }); expect(config.save).toHaveBeenCalledWith(configValue); expect(f.controller.getState().localDrafts[preferenceKey]).toBeUndefined(); expect(f.controller.getState().pendingEditors).toBe(false);
  });
  it.each([null, [], "raw", { databaseId: "foreign", viewId: "main", fields: { search: "Keep" } }, { databaseId: "db", viewId: "main", fields: { filters: [null] } }, { databaseId: "db", viewId: "main", fields: { search: "x".repeat(501) } }, { databaseId: "db", viewId: "main", fields: { unknown: "Keep" } }])("retains malformed or foreign cache without overwriting it: %j", async value => {
    const f = fixture(); await f.controller.open({ kind: "page", pageId: "a" }); f.controller.setLocalDraft(key(f.controller), value as JsonValue);
    const ui = mount(f.controller); expect(ui.input.disabled).toBe(true); expect(container.textContent).toContain("Original database input is retained"); expect(f.controller.getState().localDrafts[key(f.controller)]).toEqual(value); expect(f.controller.getState().pendingEditors).toBe(true); expect(ui.changed).not.toHaveBeenCalled();
  });
  it("rejects duplicate filter identities and admits raw unsupported operators without silently applying them", () => {
    const row = { id: "f", propertyId: "score", operator: "future-operation", value: "Keep" };
    expect(readDatabaseInputDraft({ databaseId: "db", viewId: "main", fields: { filters: [row, row] } }, "db", "main").blocked).toBe(true);
    expect(readDatabaseInputDraft({ databaseId: "db", viewId: "main", fields: { filters: [row] } }, "db", "main")).toEqual({ blocked: false, fields: { filters: [row] } });
  });
  it("routes default public row-open through the Notes controller and respects pending raw input", async () => {
    const f = fixture(), preset = createOpenEditorNotesPreset({ host: f.host }); await preset.controller.open({ kind: "page", pageId: "a" });
    preset.controller.setLocalDraft("pending", "Retain"); preset.databaseViewRuntime!.onOpenRow!({ databaseId: "db", rowKey: "row-exact", viewId: "main", viewType: "table" }); await act(async () => { await Promise.resolve(); });
    expect(preset.controller.getState().snapshot?.target).toEqual({ kind: "page", pageId: "a" }); expect(f.host.readDocument).toHaveBeenCalledTimes(1);
    preset.controller.setLocalDraft("pending", undefined); preset.databaseViewRuntime!.onOpenRow!({ databaseId: "db", rowKey: "row-exact", viewId: "main", viewType: "table" }); await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(f.host.readDocument).toHaveBeenLastCalledWith({ kind: "row", databaseId: "db", rowId: "row-exact" }, expect.anything()); expect(f.host.commit).not.toHaveBeenCalled(); preset.controller.dispose();
  });
});
