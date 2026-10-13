// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createDocumentIndex } from "../src/index/documentIndex.js";
import { createOpenEditorNotesPreset } from "../src/notes/preset.js";
import type { NotesCommandResult, NotesDocumentSnapshot, NotesWorkspaceHost } from "../src/notes/contracts.js";
import { NotesPageHeader } from "../src/react/NotesPageHeader.js";
import { NotesInspector } from "../src/react/NotesInspector.js";
import { NotesWorkspace } from "../src/react/NotesWorkspace.js";
import type { NotesEditorBridge } from "../src/react/notesWorkspacePanels.js";

const writerLifecycle = vi.hoisted(() => ({ mounted: 0, unmounted: 0, rendered: 0 }));
// Isolate shell ownership from BlockNote browser APIs. The actual shell, header, inspector,
// metadata controller, capabilities, receipts and navigation remain unmocked.
vi.mock("../src/react/NotesBlockNoteDocument.js", async () => {
  const React = await import("react"), { createDocumentIndex } = await import("../src/index/documentIndex.js");
  return { NotesBlockNoteDocument: (props: { onBridge(bridge: NotesEditorBridge): void }) => {
    const index = React.useMemo(() => createDocumentIndex(), []);
    React.useEffect(() => { writerLifecycle.mounted++; return () => { writerLifecycle.unmounted++; }; }, []);
    React.useEffect(() => props.onBridge({ index, installedBlockTypes: ["paragraph"], supportedInsertActions: ["text"], supportedStyleActions: [], editable: true, focusBlock: () => {}, toggleTask: () => {}, insert: async () => {}, format: async () => {} }), [props.onBridge, index]);
    writerLifecycle.rendered++;
    return <textarea aria-label="Independent mounted writer" defaultValue="Writer input" />;
  } };
});

let container: HTMLDivElement, root: Root; const global = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }; let prior: boolean | undefined;
beforeEach(() => { prior = global.IS_REACT_ACT_ENVIRONMENT; global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); writerLifecycle.mounted = 0; writerLifecycle.unmounted = 0; writerLifecycle.rendered = 0; });
afterEach(() => { act(() => root.unmount()); container.remove(); global.IS_REACT_ACT_ENVIRONMENT = prior; });
const scope = { actorId: "independent-classic", workspaceId: "synthetic" }, target = { kind: "page" as const, pageId: "page-a" };
const appearance = { fields: { icon: "pageIcon", tags: "pageTags", cover: "pageCover", style: "pageStyle" } };
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { resolve, promise }; };
function fixture(options: { metadata?: Record<string, import("@hello-ai-company/editor-core").JsonValue>; capability?: boolean; classic?: boolean } = {}) {
  let snapshot: NotesDocumentSnapshot = { scope, target, revision: "r1", contentRevision: "d1", title: "Synthetic page", document: createEditorDocument([{ id: "body", type: "paragraph", content: "Synthetic body" }]), metadata: options.metadata ?? { pageIcon: "📄", pageTags: ["existing"], pageCover: "local:synthetic-cover", pageStyle: "clean", future: { keep: true } }, capabilities: options.capability === false ? ["document.save"] : ["document.save", "metadata.patch"], capabilitySemantics: options.capability === false ? { "document.save": "test-only" } : { "document.save": "test-only", "metadata.patch": "test-only" } };
  const receipts = new Map<string, NotesCommandResult>(); let serial = 1;
  const commit = vi.fn<NotesWorkspaceHost["commit"]>(async request => {
    if (request.expectedRevision !== snapshot.revision) return { status: "conflict", operationId: request.operationId, target };
    if (request.command.kind !== "metadata.patch") throw new Error("Unsupported independent fixture mutation");
    snapshot = { ...snapshot, revision: `r${++serial}`, metadata: { ...snapshot.metadata, ...request.command.fields } };
    const result: NotesCommandResult = { status: "committed", operationId: request.operationId, target, snapshot: copy(snapshot), historyId: `h${serial}`, persistence: "test-only" }; receipts.set(request.operationId, result); return result;
  });
  const lookup = vi.fn<NotesWorkspaceHost["lookupOperation"]>(async (_target, operationId) => receipts.get(operationId) ?? { target, operationId, status: "not-found", terminal: true });
  const host: NotesWorkspaceHost = { scope, readDocument: async () => copy(snapshot), beforeSubmit: async () => {}, commit, lookupOperation: lookup, readWorkspace: async () => ({ scope, revision: "w1", pages: [{ id: "page-a", title: "Synthetic page", parentId: null, position: 0, tags: ["existing"] }], nextCursor: null, hasMore: false, total: 1, complete: true }) };
  const preset = createOpenEditorNotesPreset({ host, config: { version: 1, locale: "en", ...(options.classic ? { appearance: "classic" } : {}) } });
  const index = createDocumentIndex(); index.replaceFromBlocks(snapshot.document.blocks);
  const bridge: NotesEditorBridge = { index, installedBlockTypes: ["paragraph", "heading"], supportedInsertActions: ["text"], supportedStyleActions: ["heading"], editable: true, focusBlock: vi.fn(), toggleTask: vi.fn(), insert: vi.fn(async () => {}), format: vi.fn(async () => {}) };
  return { preset, controller: preset.controller, commit, lookup, bridge, snapshot: () => snapshot, setSnapshot: (value: NotesDocumentSnapshot) => { snapshot = value; } };
}
function button(label: string): HTMLButtonElement { const found = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`) ?? [...container.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent?.trim() === label); if (!found) throw new Error(`Missing ${label}`); return found; }
function input(value: string) { act(() => { const element = container.querySelector<HTMLInputElement>('input[aria-label="Add tag"]')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); }); }
const submit = async () => { await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); };
async function header(f: ReturnType<typeof fixture>, mapped = true) { await f.controller.open(target); await act(async () => root.render(<NotesPageHeader controller={f.controller} appearance={mapped ? appearance : undefined} language="en" onShowPages={() => {}} onOpen={async () => false} />)); }

describe("independent classic host-bound presentation", () => {
  it("uses a pages drawer in a host sidebar while retaining the document and its raw input", async () => {
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1440), f = fixture({ classic: true });
    try {
      await f.controller.open(target); await act(async () => root.render(<NotesWorkspace preset={f.preset} navigationPresentation="drawer" pageAppearance={appearance} />));
      const writer = container.querySelector<HTMLTextAreaElement>('[aria-label="Independent mounted writer"]')!; writer.value = "Keep this pending input";
      expect(container.querySelector('.oe-notes-workspace')!.getAttribute('data-compact')).toBe('false');
      expect(container.querySelector('.oe-notes-workspace-left')!.getAttribute('data-compact')).toBe('true');
      await act(async () => button('ノート').click());
      expect(container.querySelector('[role="dialog"][aria-label="ノートを選択"]')).not.toBeNull();
      expect(container.querySelector('.oe-notes-workspace-document')!.getAttribute('inert')).not.toBeNull();
      await act(async () => button('閉じる').click());
      expect(container.querySelector('[role="dialog"][aria-label="ノートを選択"]')).toBeNull();
      expect(container.querySelector('.oe-notes-workspace-document')!.getAttribute('inert')).toBeNull();
      expect(container.querySelector('[aria-label="Independent mounted writer"]')).toBe(writer); expect(writer.value).toBe("Keep this pending input"); expect(f.commit).not.toHaveBeenCalled();
    } finally { f.preset.dispose(); width.mockRestore(); }
  });
  it("opens configured narrow tools and closes with Escape without losing writer input", async () => {
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
    const f = fixture({ classic: true });
    try {
      await f.controller.open(target); await act(async () => root.render(<NotesWorkspace preset={f.preset} pageAppearance={appearance} />));
      const writer = container.querySelector<HTMLTextAreaElement>('[aria-label="Independent mounted writer"]')!;
      writer.value = "Keep raw input"; const rendersBefore = writerLifecycle.rendered;
      const rail = container.querySelector<HTMLElement>(".oe-notes-tools-overlay")!, trigger = container.querySelector<HTMLButtonElement>('.oe-notes-tools-icons [aria-label="Insert"]')!;
      expect(rail.hidden).toBe(true); expect(trigger.getAttribute("aria-selected")).toBe("false");
      expect(container.querySelectorAll(".oe-notes-tools-icons button")).toHaveLength(3);
      await act(async () => trigger.click()); expect(rail.hidden).toBe(false);
      await act(async () => button("Close tools").click()); expect(rail.hidden).toBe(true);
      await act(async () => trigger.click()); button("Close tools").focus();
      await act(async () => button("Close tools").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, isComposing: true })));
      expect(rail.hidden).toBe(false);
      await act(async () => button("Close tools").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
      expect(rail.hidden).toBe(true); expect(document.activeElement).toBe(trigger);
      await act(async () => trigger.click()); writer.focus();
      await act(async () => writer.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })));
      expect(rail.hidden).toBe(true); expect(document.activeElement).toBe(writer);
      expect(container.querySelector('[aria-label="Independent mounted writer"]')).toBe(writer); expect(writer.value).toBe("Keep raw input");
      expect(writerLifecycle.unmounted).toBe(0); expect(writerLifecycle.rendered).toBe(rendersBefore); expect(f.commit).not.toHaveBeenCalled();
    } finally { f.preset.dispose(); width.mockRestore(); }
  });
  it.each(["no capability", "no mapping"])("disables icon/tag/style mutation with %s", async reason => {
    const f = fixture({ capability: reason !== "no capability" }); await header(f, reason !== "no mapping");
    expect(button("Add page icon").disabled).toBe(true); expect(container.querySelector<HTMLInputElement>('input[aria-label="Add tag"]')!.disabled).toBe(true);
    await act(async () => root.render(<NotesInspector controller={f.controller} bridge={f.bridge} classic language="en" initialTab="style" pageAppearance={reason === "no mapping" ? undefined : appearance} />));
    expect(button("Editorial").disabled).toBe(true); await act(async () => button("Editorial").click()); expect(f.commit).not.toHaveBeenCalled(); f.preset.dispose();
  });
  it("patches only mapped icon and style fields and retains opaque metadata", async () => {
    const f = fixture(); await header(f); await act(async () => button("Add page icon").click()); await act(async () => document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="💡"]')!.click());
    expect(f.commit.mock.calls[0]![0].command).toEqual({ kind: "metadata.patch", fields: { pageIcon: "💡" } });
    await act(async () => root.render(<NotesInspector controller={f.controller} bridge={f.bridge} classic language="en" initialTab="style" pageAppearance={appearance} />)); await act(async () => button("Editorial").click());
    expect(f.commit.mock.calls[1]![0].command).toEqual({ kind: "metadata.patch", fields: { pageStyle: "editorial" } }); expect(f.snapshot().metadata.future).toEqual({ keep: true }); f.preset.dispose();
  });
  it("blocks unrelated metadata actions during body dirty, IME or another local draft", async () => {
    const f = fixture(); await header(f); act(() => f.controller.setDraft(createEditorDocument([{ id: "body", type: "paragraph", content: "Human body" }]))); expect(button("Add page icon").disabled).toBe(true);
    f.preset.dispose(); const g = fixture(); await header(g); act(() => g.controller.setComposing(true)); expect(button("Add page icon").disabled).toBe(true); act(() => g.controller.setComposing(false));
    act(() => g.controller.setLocalDraft("another-editor", { text: "Preserved other draft" })); expect(button("Add page icon").disabled).toBe(true); expect(f.commit).not.toHaveBeenCalled(); expect(g.commit).not.toHaveBeenCalled(); g.preset.dispose();
  });
  it("submits the own tag draft once and clears it only on the matching receipt", async () => {
    const f = fixture(); await header(f); input("new-tag"); expect(f.controller.getState().pendingEditors).toBe(true); expect(button("Add page icon").disabled).toBe(true); expect(button("Add tag").disabled).toBe(false);
    const gate = deferred<NotesCommandResult>(), commit = f.commit.getMockImplementation()!; f.commit.mockImplementationOnce(async (...args) => { const result = await commit(...args); await gate.promise; return result; });
    await act(async () => { const form = container.querySelector("form")!; form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(f.commit).toHaveBeenCalledTimes(1); expect(f.controller.getState().pendingEditors).toBe(true); expect(f.commit.mock.calls[0]![0].command).toEqual({ kind: "metadata.patch", fields: { pageTags: ["existing", "new-tag"] } });
    await act(async () => gate.resolve({ target, operationId: "unused", status: "denied" })); expect(f.controller.getState().pendingEditors).toBe(false); expect(container.querySelector<HTMLInputElement>('input[aria-label="Add tag"]')!.value).toBe(""); f.preset.dispose();
  });
  it("keeps own tag editable through IME and retains it across header unmount", async () => {
    const f = fixture(); await header(f); input("draft tag"); const element = container.querySelector<HTMLInputElement>('input[aria-label="Add tag"]')!;
    act(() => element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))); expect(element.disabled).toBe(false); expect(button("Add tag").disabled).toBe(true); await submit(); expect(f.commit).not.toHaveBeenCalled();
    await act(async () => root.render(null)); expect(f.controller.getState().composing).toBe(false); expect(f.controller.getState().pendingEditors).toBe(true); await header(f); expect(container.querySelector<HTMLInputElement>('input[aria-label="Add tag"]')!.value).toBe("draft tag"); f.preset.dispose();
  });
  it("retains unknown ACK tag recovery after unmount and reconciles without resend", async () => {
    const f = fixture(); await header(f); input("saved once"); const commit = f.commit.getMockImplementation()!; f.commit.mockImplementationOnce(async (...args) => { await commit(...args); throw new Error("Synthetic ACK loss"); });
    await submit(); expect(f.controller.getState().status).toBe("unknown"); expect(f.controller.getState().pendingEditors).toBe(true); await submit(); expect(f.commit).toHaveBeenCalledTimes(1);
    await act(async () => root.render(null)); await header(f); expect(container.querySelector<HTMLInputElement>('input[aria-label="Add tag"]')!.value).toBe("saved once");
    await act(async () => button("保存結果を照会").click()); expect(f.lookup).toHaveBeenCalledTimes(1); expect(f.commit).toHaveBeenCalledTimes(1); expect(f.controller.getState().pendingEditors).toBe(false); f.preset.dispose();
  });
  it("does not grant gallery cover editability without an explicit cover field mapping", async () => {
    const f = fixture(); await f.controller.open(target); const renderCoverControl = vi.fn(({ editable }: { editable: boolean }) => <span data-cover-editable={editable} />);
    await act(async () => root.render(<NotesInspector controller={f.controller} bridge={f.bridge} classic language="en" initialTab="style" pageAppearance={{ fields: { style: "pageStyle" }, renderCoverControl }} />));
    await act(async () => container.querySelector<HTMLButtonElement>(".oe-notes-style-gallery-trigger")!.click()); expect(renderCoverControl).toHaveBeenCalled(); expect(document.body.querySelector('[data-cover-editable]')!.getAttribute("data-cover-editable")).toBe("false"); f.preset.dispose();
  });
  it("passes the exact mapped cover to the gallery and removes editability during IME", async () => {
    const f = fixture(); await f.controller.open(target); const renderCoverControl = vi.fn(({ editable, cover }: { editable: boolean; cover: string | undefined }) => <span data-cover-editable={editable} data-cover={cover} />);
    await act(async () => root.render(<NotesInspector controller={f.controller} bridge={f.bridge} classic language="en" initialTab="style" pageAppearance={{ ...appearance, renderCoverControl }} />));
    await act(async () => container.querySelector<HTMLButtonElement>(".oe-notes-style-gallery-trigger")!.click()); expect(document.body.querySelector('[data-cover]')!.getAttribute("data-cover")).toBe("local:synthetic-cover"); expect(document.body.querySelector('[data-cover-editable]')!.getAttribute("data-cover-editable")).toBe("true");
    act(() => f.controller.setComposing(true)); expect(document.body.querySelector('[data-cover-editable]')!.getAttribute("data-cover-editable")).toBe("false"); expect(button("Editorial").disabled).toBe(true); f.preset.dispose();
  });
  it.each(["removed", "rebound"])("retains own tag draft without submitting a stale field when mapping is %s", async change => {
    const f = fixture(); await header(f); input("Human pending tag"); const cached = copy(f.controller.getState().localDrafts);
    await act(async () => root.render(<NotesPageHeader controller={f.controller} appearance={{ fields: change === "removed" ? {} : { tags: "newTags" } }} language="en" onShowPages={() => {}} onOpen={async () => false} />));
    await submit(); expect(f.commit).not.toHaveBeenCalled(); expect(button("Add tag").disabled).toBe(true); expect(f.controller.getState().localDrafts).toEqual(cached); expect(container.querySelector<HTMLInputElement>('input[aria-label="Add tag"]')!.value).toBe("Human pending tag"); f.preset.dispose();
  });
  it("preserves unsupported tag elements when adding/removing or keeps the field inert", async () => {
    const original = ["existing", { futureTag: true }], f = fixture({ metadata: { pageTags: original } }); await header(f);
    const editable = !container.querySelector<HTMLInputElement>('input[aria-label="Add tag"]')!.disabled;
    if (editable) { input("new"); await submit(); expect((f.snapshot().metadata.pageTags as unknown[])).toContainEqual({ futureTag: true }); }
    else expect(f.commit).not.toHaveBeenCalled(); f.preset.dispose();
  });
  it("renders classic Library in the detail area while preserving the same writer node and input", async () => {
    const f = fixture({ classic: true }); await f.controller.open(target); await act(async () => root.render(<NotesWorkspace preset={f.preset} pageAppearance={appearance} />));
    const writer = container.querySelector<HTMLTextAreaElement>('[aria-label="Independent mounted writer"]')!; writer.value = "Unsaved local writer input";
    await act(async () => button("Library").click()); const library = container.querySelector(".oe-notes-library")!;
    expect(library.parentElement!.classList.contains("oe-notes-workspace-grid")).toBe(true); expect(container.querySelector(".oe-notes-workspace-left .oe-notes-library")).toBeNull();
    expect(container.querySelector<HTMLElement>(".oe-notes-workspace-document")!.hidden).toBe(true); expect(container.querySelector('[aria-label="Independent mounted writer"]')).toBe(writer); expect(writer.value).toBe("Unsaved local writer input"); expect(writerLifecycle.unmounted).toBe(0);
    await act(async () => button("Pages").click()); expect(container.querySelector<HTMLElement>(".oe-notes-workspace-document")!.hidden).toBe(false); expect(writerLifecycle.mounted).toBe(1);
    await act(async () => button("Library").click());
    await act(async () => container.querySelector<HTMLButtonElement>('.oe-notes-page-card[aria-current="page"]')!.click());
    expect(container.querySelector<HTMLElement>(".oe-notes-workspace-document")!.hidden).toBe(false);
    expect(container.querySelector('[aria-label="Independent mounted writer"]')).toBe(writer);
    expect(writerLifecycle.unmounted).toBe(0); f.preset.dispose();
  });
  it("keeps default presentation independent of classic header/style controls", async () => {
    const f = fixture(); await f.controller.open(target); await act(async () => root.render(<NotesWorkspace preset={f.preset} pageAppearance={appearance} />));
    expect(container.querySelector(".oe-notes-classic")).toBeNull(); expect(container.querySelector(".oe-notes-page-meta")).toBeNull(); expect(container.querySelector(".oe-notes-classic-inspector")).toBeNull(); expect(container.querySelector(".oe-notes-workspace-right")!.parentElement!.classList.contains("oe-notes-workspace-grid")).toBe(true); expect(writerLifecycle.mounted).toBe(1); f.preset.dispose();
  });
});
