/** @vitest-environment jsdom */
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { HtmlWidget } from "../src/document/workspaceFeature.js";
import { EditorDraftLifecycleProvider, editorLocalDraftKey } from "../src/document/draftLifecycle.js";
import { createNotesWorkspaceController } from "../src/notes/controller.js";
import type { NotesDocumentSnapshot, NotesTarget, NotesWorkspaceHost } from "../src/notes/contracts.js";

const original = { html: "<p>Saved source</p>", css: "p{color:teal}", javascript: "keptButNeverRun()" };
const target = (pageId = "a"): NotesTarget => ({ kind: "page", pageId });
function fixture(scope = { workspaceId: "workspace", actorId: "actor" }, page = target()) {
  const block = { id: "widget", type: "oeHtmlWidget", props: { title: "Widget", ...original } };
  const snapshot: NotesDocumentSnapshot = { scope, target: page, revision: "r1", contentRevision: "c1", document: createEditorDocument([block]), title: "Synthetic", metadata: {}, capabilities: ["document.save"], capabilitySemantics: { "document.save": "test-only" } };
  const host: NotesWorkspaceHost = {
    scope, readDocument: vi.fn(async next => ({ ...snapshot, target: next })), beforeSubmit: vi.fn(async () => undefined),
    commit: vi.fn<NotesWorkspaceHost["commit"]>(async request => ({ status: "committed", operationId: request.operationId, target: request.target, historyId: "history", persistence: "test-only", snapshot: { ...snapshot, revision: "r2", contentRevision: "c2", document: request.command.kind === "document.save" ? request.command.document : snapshot.document } })),
    lookupOperation: vi.fn<NotesWorkspaceHost["lookupOperation"]>(async (target, operationId) => ({ status: "not-found", target, operationId, terminal: true }))
  };
  const controller = createNotesWorkspaceController(host);
  const editor = {
    document: [block], isEditable: true,
    updateBlock: vi.fn((id: string, update: { props: Record<string, string | number | boolean> }) => { if (id !== block.id) throw new Error("Wrong block"); block.props = { ...block.props, ...update.props } as typeof block.props; controller.setDraft(createEditorDocument([block])); }),
    schema: { blockSchema: {} }, transact: (work: () => void) => work(), replaceBlocks: vi.fn(), getTextCursorPosition: () => ({ block: { id: block.id } }), setTextCursorPosition: vi.fn()
  };
  return { controller, editor, block, host };
}
let container: HTMLDivElement, root: ReturnType<typeof createRoot>;
let prior: boolean | undefined;
beforeEach(() => { const global = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }; prior = global.IS_REACT_ACT_ENVIRONMENT; global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = prior; });
function click(label: string) { const button = [...container.querySelectorAll("button")].find(button => button.textContent === label); if (!button) throw new Error(`Missing ${label}`); act(() => button.click()); }
function type(value: string) { const input = container.querySelector("textarea")!; act(() => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }); }
const mount = (f: ReturnType<typeof fixture>) => act(() => root.render(createElement(StrictMode, null, createElement(EditorDraftLifecycleProvider, { controller: f.controller, children: createElement(HtmlWidget, { block: f.block, editor: f.editor }) }))));

describe("optional Notes HTML source cache", () => {
  it("keeps all HTML/CSS/JS, exact base and active language through unmount; pending cache blocks navigation", async () => {
    const f = fixture(); await f.controller.open(target()); mount(f); click("Edit source"); type("<p>Unsaved human HTML</p>"); click("CSS"); type("p{color:purple}"); click("JAVASCRIPT"); type("preserveUnsavedJapanese('日本語')");
    const state = f.controller.getState(), key = editorLocalDraftKey(state.snapshot!, "widget", "html-widget-source");
    expect(state.localDrafts[key]).toEqual({ version: 1, base: JSON.stringify(original), part: "javascript", draft: { html: "<p>Unsaved human HTML</p>", css: "p{color:purple}", javascript: "preserveUnsavedJapanese('日本語')" } });
    expect(state.pendingEditors).toBe(true); expect(await f.controller.open(target("b"))).toBe(false); expect(f.host.commit).not.toHaveBeenCalled();
    act(() => root.render(null)); expect(f.controller.getState().localDrafts[key]).toEqual(state.localDrafts[key]); mount(f);
    expect(container.querySelector("textarea")!.getAttribute("aria-label")).toBe("JAVASCRIPT source"); expect(container.querySelector("textarea")!.value).toBe("preserveUnsavedJapanese('日本語')");
    click("CSS"); expect(container.querySelector("textarea")!.value).toBe("p{color:purple}"); click("HTML"); expect(container.querySelector("textarea")!.value).toBe("<p>Unsaved human HTML</p>"); expect(f.editor.updateBlock).not.toHaveBeenCalled();
  });
  it("Cancel clears only this cache, keeps the canonical body unchanged and restores opener focus", async () => {
    const f = fixture(); await f.controller.open(target()); mount(f); click("Edit source"); type("Unsaved"); act(() => f.controller.setLocalDraft("other-panel", { keep: "another pending input" })); click("Cancel");
    const key = editorLocalDraftKey(f.controller.getState().snapshot!, "widget", "html-widget-source"); expect(f.controller.getState().localDrafts[key]).toBeUndefined(); expect(f.controller.getState().localDrafts["other-panel"]).toEqual({ keep: "another pending input" }); expect(f.block.props).toEqual({ title: "Widget", ...original }); expect(f.editor.updateBlock).not.toHaveBeenCalled(); expect(document.activeElement?.textContent).toBe("Edit source");
    act(() => f.controller.setLocalDraft("other-panel", undefined)); await act(async () => { expect(await f.controller.open(target("b"))).toBe(true); });
  });
  it("Apply validates original source, updates only the local editor, and clears cache after success", async () => {
    const f = fixture(); await f.controller.open(target()); mount(f); click("Edit source"); type("<p>Reviewed HTML</p>"); click("JAVASCRIPT"); type("NeverExecuteThis()"); click("Apply source");
    expect(f.editor.updateBlock).toHaveBeenCalledTimes(1); expect(f.block.props).toEqual({ title: "Widget", html: "<p>Reviewed HTML</p>", css: original.css, javascript: "NeverExecuteThis()" }); expect(f.controller.getState().pendingEditors).toBe(false); expect(f.controller.getState().dirty).toBe(true); expect(f.host.commit).not.toHaveBeenCalled(); expect(container.querySelector("textarea")).toBeNull();
  });
  it("rejects Apply after remote/local block changes and retains both draft and new canonical source", async () => {
    const f = fixture(); await f.controller.open(target()); mount(f); click("Edit source"); type("Local source retained"); f.block.props.html = "Newer remote source"; click("Apply source");
    expect(f.editor.updateBlock).not.toHaveBeenCalled(); expect(container.textContent).toContain("changed elsewhere"); expect(container.querySelector("textarea")!.value).toBe("Local source retained"); expect(f.controller.getState().pendingEditors).toBe(true); expect(f.block.props.html).toBe("Newer remote source");
  });
  it("IME prevents Escape/Apply/Cancel; unmount ends composition without clearing raw input", async () => {
    const f = fixture(); await f.controller.open(target()); mount(f); click("Edit source"); const input = container.querySelector("textarea")!;
    act(() => input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))); type("未確定の日本語");
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }))); click("Cancel"); click("Apply source"); expect(container.querySelector("textarea")).not.toBeNull(); expect(f.controller.getState().composing).toBe(true); expect(f.editor.updateBlock).not.toHaveBeenCalled();
    act(() => root.render(null)); expect(f.controller.getState().composing).toBe(false); expect(f.controller.getState().pendingEditors).toBe(true); expect(await f.controller.open(target("b"))).toBe(false); mount(f); expect(container.querySelector("textarea")!.value).toBe("未確定の日本語");
    act(() => container.querySelector("textarea")!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }))); expect(f.controller.getState().pendingEditors).toBe(false); expect(f.editor.updateBlock).not.toHaveBeenCalled();
  });
  it("scope, actor, page/row/database/block and cache namespace identities never collide", () => {
    const scope = { workspaceId: "w", actorId: "a" }, keys = new Set([
      editorLocalDraftKey({ scope, target: target("same") }, "widget", "html-widget-source"),
      editorLocalDraftKey({ scope, target: { kind: "row", databaseId: "same", rowId: "same" } }, "widget", "html-widget-source"),
      editorLocalDraftKey({ scope, target: { kind: "row", databaseId: "other", rowId: "same" } }, "widget", "html-widget-source"),
      editorLocalDraftKey({ scope: { ...scope, actorId: "b" }, target: target("same") }, "widget", "html-widget-source"),
      editorLocalDraftKey({ scope: { ...scope, workspaceId: "other" }, target: target("same") }, "widget", "html-widget-source"),
      editorLocalDraftKey({ scope, target: target("same") }, "other-block", "html-widget-source"),
      editorLocalDraftKey({ scope, target: target("same") }, "widget", "other-widget")
    ]); expect(keys.size).toBe(7);
  });
  it("accepts the controller's 512-character ID boundary and enforces the total cache key bound", () => {
    const id = "a".repeat(512), snapshot = { scope: { workspaceId: id, actorId: id }, target: { kind: "row" as const, databaseId: id, rowId: id } };
    expect(editorLocalDraftKey(snapshot, id, id).length).toBeLessThanOrEqual(4096);
    expect(() => editorLocalDraftKey(snapshot, "a".repeat(513), "html-widget-source")).toThrow("Invalid editor draft identity");
    const escapedId = "\u0000".repeat(512);
    expect(() => editorLocalDraftKey({ scope: { workspaceId: escapedId, actorId: escapedId }, target: target(escapedId) }, escapedId, "html-widget-source")).toThrow("cache key limit");
  });
  it("mounts without crashing when valid escaped IDs exceed the cache key budget, retaining source and explaining disabled editing", async () => {
    const id = '"'.repeat(512), row: NotesTarget = { kind: "row", databaseId: id, rowId: id };
    const f = fixture({ workspaceId: id, actorId: id }, row); expect(await f.controller.open(row)).toBe(true);
    expect(() => mount(f)).not.toThrow();
    expect(container.textContent).toContain("cache key limit"); expect(container.textContent).toContain("Source editing is disabled; original source is retained");
    const edit = [...container.querySelectorAll("button")].find(button => button.textContent === "Edit source")!; expect(edit.disabled).toBe(true); click("Edit source");
    expect(container.querySelector("textarea")).toBeNull(); expect(container.querySelector("iframe")!.getAttribute("srcdoc")).toContain("Saved source");
    expect(f.block.props).toEqual({ title: "Widget", ...original }); expect(f.controller.getState().localDrafts).toEqual({}); expect(f.controller.getState().pendingEditors).toBe(false); expect(f.editor.updateBlock).not.toHaveBeenCalled(); expect(f.host.commit).not.toHaveBeenCalled();
  });
  it("replacing the controller with a different target cannot copy the old draft into the new target", async () => {
    const a = fixture(), b = fixture({ workspaceId: "other", actorId: "actor" }, target("b")); await a.controller.open(target()); await b.controller.open(target("b")); mount(a); click("Edit source"); type("Actor A private draft"); mount(b);
    expect(container.querySelector("textarea")).toBeNull(); expect(b.controller.getState().pendingEditors).toBe(false); click("Edit source"); expect(container.querySelector("textarea")!.value).toBe(original.html); type("Separate B draft"); expect(JSON.stringify(a.controller.getState().localDrafts)).toContain("Actor A private draft"); expect(JSON.stringify(b.controller.getState().localDrafts)).not.toContain("Actor A private draft");
  });
  it("unknown cached formats stay preserved and cannot Apply until explicit Cancel", async () => {
    const f = fixture(); await f.controller.open(target()); const key = editorLocalDraftKey(f.controller.getState().snapshot!, "widget", "html-widget-source"), cached = { futureVersion: 9, originalUnknown: { keep: "raw human input" } }; f.controller.setLocalDraft(key, cached); mount(f);
    expect(container.textContent).toContain("cache is retained"); expect(container.querySelector("textarea")!.disabled).toBe(true); click("Apply source"); expect(f.editor.updateBlock).not.toHaveBeenCalled(); expect(f.controller.getState().localDrafts[key]).toEqual(cached); click("Cancel"); expect(f.controller.getState().localDrafts[key]).toBeUndefined();
  });
  it("standalone source editing keeps its old local behavior without cache/controller dependencies", () => {
    const f = fixture(); act(() => root.render(createElement(HtmlWidget, { block: f.block, editor: { ...f.editor, updateBlock: vi.fn() } }))); click("Edit source"); type("Standalone text"); click("CSS"); click("Cancel"); expect(container.querySelector("textarea")).toBeNull(); click("Edit source"); expect(container.querySelector("textarea")!.getAttribute("aria-label")).toBe("CSS source"); expect(container.querySelector("textarea")!.value).toBe(original.css); expect(f.controller.getState().pendingEditors).toBe(false);
  });
});
