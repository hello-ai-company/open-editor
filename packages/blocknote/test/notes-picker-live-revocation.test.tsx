/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditorDocument, type EditorBlock } from "@hello-ai-company/editor-core";
import { NotesInsertDialog, type NotesInsertEditor, type NotesInsertionHost } from "../src/react/NotesInsertDialog.js";
import type { NotesDocumentSnapshot, NotesWorkspaceController, NotesWorkspaceHost, NotesWorkspaceState } from "../src/notes/contracts.js";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

/** Independent dialog fixture: real picker UI, an observable local writer, and
 * one controllable authorized-page lookup. No BlockNote component mocks. */
function fixture(kind: "card" | "link" = "card", isValidLink?: (href: string) => boolean, selectedText = "") {
  const scope = { actorId: "picker-owner", workspaceId: "picker-workspace" };
  const source = createEditorDocument([{ id: "anchor", type: "paragraph", content: "Retain this source" }]);
  const snapshot: NotesDocumentSnapshot = {
    scope, target: { kind: "page", pageId: "source-page" },
    revision: "r1", contentRevision: "c1", document: source,
    title: "Source", metadata: {}, capabilities: ["document.save"],
    capabilitySemantics: { "document.save": "test-only" },
  };
  let state: NotesWorkspaceState = {
    snapshot, status: "ready", dirty: false, composing: false,
    pendingEditors: false, localDrafts: {}, message: "",
  };
  const listeners = new Set<() => void>();
  const update = (patch: Partial<NotesWorkspaceState>) => {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  };
  const controller: NotesWorkspaceController = {
    getState: () => state,
    getDraftSessionId: () => 1,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setDraft: vi.fn(document => update({ draft: document, dirty: true })),
    setComposing: composing => update({ composing }),
    setLocalDraft: vi.fn(), open: vi.fn(), save: vi.fn(), execute: vi.fn(),
    persistLocalDrafts: vi.fn(), readLatest: vi.fn(), acceptMergedDraft: vi.fn(),
    cancel: vi.fn(), reconcile: vi.fn(), getRecovery: vi.fn(), dispose: vi.fn(),
  };
  const lookup = deferred<NotesDocumentSnapshot>();
  const pickedSnapshot: NotesDocumentSnapshot = {
    ...snapshot, target: { kind: "page", pageId: "picked-page" }, title: "Authorized page",
  };
  const host: NotesWorkspaceHost = {
    scope,
    readDocument: vi.fn(() => lookup.promise),
    readWorkspace: vi.fn(async () => ({
      scope, revision: "workspace-r1", complete: true, nextCursor: null, hasMore: false,
      pages: [{ id: "picked-page", title: "Authorized page", parentId: null, position: 0 }],
    })),
    commit: vi.fn(), lookupOperation: vi.fn(), beforeSubmit: vi.fn(),
  };
  const insertion: NotesInsertionHost = { scope, pickerInsertKinds: [kind], ...(isValidLink ? { isValidLink } : {}) };
  const editor: NotesInsertEditor = {
    installedBlockTypes: ["paragraph", "pageCard"],
    getSelectedBlockId: () => "anchor",
    getSelectionFingerprint: () => "unchanged-selection",
    getSelectedText: () => selectedText,
    getSelectedBlockTypes: () => ["paragraph"],
    getSelectedBlocksHaveHardBreaks: () => /[\r\n]/.test(selectedText),
    insertBlocks: vi.fn((blocks: readonly EditorBlock[]) => {
      controller.setDraft(createEditorDocument([...source.blocks, ...blocks]));
    }),
    insertLink: vi.fn((href, label) => {
      controller.setDraft(createEditorDocument([{ ...source.blocks[0]!, content: [{ type: "link", href, content: [{ type: "text", text: label, styles: {} }] }] }]));
    }),
  };
  const onClose = vi.fn();
  const request = { id: "picker-request", kind, signal: new AbortController().signal };
  const draw = (policy = insertion) => root.render(<NotesInsertDialog
    request={request} controller={controller} host={host} editor={editor} insertion={policy} onClose={onClose}
  />);
  const mount = async () => {
    await act(async () => { draw(); });
    if (kind === "link") return;
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="挿入する項目"]')!;
    expect([...select.options].some(option => option.value === "picked-page")).toBe(true);
    act(() => {
      select.value = "picked-page";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  };
  const replacePolicy = async (policy: NotesInsertionHost) => { await act(async () => { draw(policy); }); };
  const confirm = () => [...container.querySelectorAll<HTMLButtonElement>("button")]
    .find(button => button.textContent === "確認して本文に挿入")!;
  return { controller, host, insertion, editor, lookup, pickedSnapshot, onClose, source, mount, replacePolicy, confirm };
}

describe("an open picker rechecks its live insertion policy", () => {
  it("still inserts after the authorized lookup when the policy stays allowed", async () => {
    const f = fixture(); await f.mount();
    expect(f.confirm().disabled).toBe(false);
    await act(async () => { f.confirm().click(); });
    expect(f.host.readDocument).toHaveBeenCalledWith({ kind: "page", pageId: "picked-page" }, expect.any(AbortSignal));
    await act(async () => { f.lookup.resolve(f.pickedSnapshot); });
    expect(f.editor.insertBlocks).toHaveBeenCalledOnce();
    expect(f.controller.getState().draft?.blocks.at(-1)?.type).toBe("pageCard");
    expect(f.onClose).toHaveBeenCalledWith({ status: "inserted" });
    expect(f.host.commit).not.toHaveBeenCalled();
  });

  it("does not insert when the same mutable policy revokes the kind during a pending lookup", async () => {
    const f = fixture(); await f.mount();
    await act(async () => { f.confirm().click(); });
    expect(f.host.readDocument).toHaveBeenCalledOnce();
    expect(f.editor.insertBlocks).not.toHaveBeenCalled();
    // Deliberately do not rerender or notify the controller: the post-await
    // mutation boundary must read the current policy, not render-time available.
    f.insertion.pickerInsertKinds = [];
    await act(async () => { f.lookup.resolve(f.pickedSnapshot); });
    expect(f.editor.insertBlocks).not.toHaveBeenCalled();
    expect(f.editor.insertLink).not.toHaveBeenCalled();
    expect(f.controller.setDraft).not.toHaveBeenCalled();
    expect(f.controller.getState().snapshot?.document).toEqual(f.source);
    expect(f.controller.getState().dirty).toBe(false);
    expect(f.onClose).not.toHaveBeenCalled();
    expect(f.host.commit).not.toHaveBeenCalled();
  });

  it("does not start a queued lookup when the policy is revoked in the click turn", async () => {
    const f = fixture(); await f.mount();
    await act(async () => {
      f.confirm().click();
      f.insertion.pickerInsertKinds = [];
    });
    expect(f.host.readDocument).not.toHaveBeenCalled();
    expect(f.editor.insertBlocks).not.toHaveBeenCalled();
    expect(f.controller.setDraft).not.toHaveBeenCalled();
    expect(f.onClose).not.toHaveBeenCalled();
  });

  it("rechecks a replacement policy object when the old lookup closure resumes", async () => {
    const f = fixture(); await f.mount();
    await act(async () => { f.confirm().click(); });
    expect(f.host.readDocument).toHaveBeenCalledOnce();
    // The original object remains allowed. Only the next render's policy revokes
    // the picker, so a closure that retains old props must not pass this check.
    await f.replacePolicy({ ...f.insertion, pickerInsertKinds: [] });
    expect(f.insertion.pickerInsertKinds).toEqual(["card"]);
    await act(async () => { f.lookup.resolve(f.pickedSnapshot); });
    expect(f.editor.insertBlocks).not.toHaveBeenCalled();
    expect(f.editor.insertLink).not.toHaveBeenCalled();
    expect(f.controller.setDraft).not.toHaveBeenCalled();
    expect(f.controller.getState().snapshot?.document).toEqual(f.source);
    expect(f.onClose).not.toHaveBeenCalled();
    expect(f.host.commit).not.toHaveBeenCalled();
  });
});


function enterLinkUrl(value: string) {
  act(() => {
    const input = container.querySelector<HTMLInputElement>('input[aria-label="リンク先URL"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const ownerUrl = (href: string) => href === "https://example.invalid/allowed";
describe("owner-restricted link picker", () => {
  it.each([" label ", "  "])("retains the literal nonempty selected label %j", async label => {
    const f = fixture("link", ownerUrl, label); await f.mount(); enterLinkUrl("https://example.invalid/allowed");
    expect(container.querySelector<HTMLInputElement>('input[aria-label="リンクの表示文字"]')!.value).toBe(label);
    await act(async () => f.confirm().click());
    expect(f.editor.insertLink).toHaveBeenCalledWith("https://example.invalid/allowed", label, expect.any(AbortSignal));
  });
  it("does not advertise link insertion in a nonrepresentable block context", async () => {
    const f = fixture("link", ownerUrl); f.insertion.linkBlockTypes = ["paragraph"];
    f.editor.getSelectedBlockTypes = () => ["paragraph", "table"];
    await f.mount(); enterLinkUrl("https://example.invalid/allowed");
    expect(f.confirm().disabled).toBe(true); expect(f.editor.insertLink).not.toHaveBeenCalled();
  });
  it("offers explicit safe external URL input, hiding unapproved internal page references", async () => {
    const f = fixture("link", ownerUrl); await f.mount();
    expect([...container.querySelectorAll('select[aria-label="リンク先の種類"] option')].map(option => option.getAttribute("value"))).toEqual(["url"]);
    for (const href of ["openeditor://page/unapproved", "mailto:owner@example.invalid", "https://example.invalid/other", " https://example.invalid/allowed "]) {
      enterLinkUrl(href); expect(f.confirm().disabled).toBe(true); await act(async () => f.confirm().click()); expect(f.editor.insertLink).not.toHaveBeenCalled();
    }
    enterLinkUrl("https://example.invalid/allowed"); expect(f.confirm().disabled).toBe(false);
    await act(async () => f.confirm().click());
    expect(f.editor.insertLink).toHaveBeenCalledWith("https://example.invalid/allowed", "https://example.invalid/allowed", expect.any(AbortSignal));
    expect(f.onClose).toHaveBeenCalledWith({ status: "inserted" }); expect(f.host.commit).not.toHaveBeenCalled();
  });
  it("checks same-turn URL policy revocation before its queued local insertion", async () => {
    const f = fixture("link", ownerUrl); await f.mount(); enterLinkUrl("https://example.invalid/allowed");
    await act(async () => { f.confirm().click(); f.insertion.isValidLink = () => false; });
    expect(f.editor.insertLink).not.toHaveBeenCalled(); expect(f.controller.setDraft).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLInputElement>('input[aria-label="リンク先URL"]')!.value).toBe("https://example.invalid/allowed");
    expect(f.controller.getState().snapshot?.document).toEqual(f.source);
  });
  it("retains entered input and rejects a replacement policy or foreign scope", async () => {
    const f = fixture("link", ownerUrl); await f.mount(); enterLinkUrl("https://example.invalid/allowed");
    await f.replacePolicy({ ...f.insertion, isValidLink: () => false }); expect(f.confirm().disabled).toBe(true);
    await f.replacePolicy({ ...f.insertion, scope: { ...f.insertion.scope, actorId: "foreign" } }); expect(f.confirm().disabled).toBe(true);
    expect(container.querySelector<HTMLInputElement>('input[aria-label="リンク先URL"]')!.value).toBe("https://example.invalid/allowed");
    expect(f.controller.setDraft).not.toHaveBeenCalled();
  });
  it("makes a selected multiline block unavailable when the host forbids linked hard breaks", async () => {
    const f = fixture("link", ownerUrl, "First\nsecond"); f.insertion.allowLinkHardBreaks = false;
    await f.mount(); enterLinkUrl("https://example.invalid/allowed");
    expect(f.confirm().disabled).toBe(true); expect(f.editor.insertLink).not.toHaveBeenCalled();
    expect(f.controller.getState().snapshot?.document).toEqual(f.source);
  });
  it("preserves unrestricted SDK internal-page choice", async () => {
    const f = fixture("link"); await f.mount();
    expect(container.querySelector('select[aria-label="リンク先の種類"] option[value="page"]')).not.toBeNull();
    enterLinkUrl("openeditor://page/authorized"); expect(f.confirm().disabled).toBe(false);
  });
});
