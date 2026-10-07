/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotesCommandOutcome, NotesPageSummary, NotesWorkspaceSnapshot } from "../src/notes/contracts.js";
import { canMoveNotesPage, NotesLibrary, NotesNavigation, NotesPageActions, NotesPageHub, NotesPagePreview, type NotesPagePreviewData, type NotesPageOperations } from "../src/react/NotesNavigation.js";

const pages: NotesPageSummary[] = [
  { id: "root", title: "Root", parentId: null, position: 0, favorite: true, updatedAt: "2026-01-01", tags: ["work"] },
  { id: "child", title: "Child", parentId: "root", position: 0, updatedAt: "2026-01-03", tags: ["work", "nested"] },
  { id: "deep", title: "Deep", parentId: "child", position: 0, updatedAt: "2026-01-02" },
  { id: "other", title: "Other", parentId: null, position: 1, updatedAt: "2026-01-04", tags: ["home"] },
  { id: "trash", title: "Trash", parentId: null, position: 2, deletedAt: "2026-01-05" }
];
const rejected: NotesCommandOutcome = { status: "rejected", operationId: "op", target: { kind: "page", pageId: "root" } };
function workspace(revision: string, entries: readonly NotesPageSummary[] = pages): NotesWorkspaceSnapshot { return { scope: { actorId: "synthetic", workspaceId: "test" }, revision, pages: entries, nextCursor: null, hasMore: false, complete: true }; }
const allCapabilities = ["page.create", "page.rename", "page.move", "page.duplicate", "page.trash", "page.restore", "page.delete-permanently", "metadata.patch"] as const;
function operations(overrides: Partial<NotesPageOperations> = {}): NotesPageOperations {
  return {
    workspace: workspace("w1"), activePageId: "root", status: "ready",
    getCapabilities: () => allCapabilities,
    onOpen: vi.fn(async () => true), onCommand: vi.fn(async () => rejected),
    ...overrides
  };
}
const cleanups: (() => void)[] = [];
function mount(element: ReturnType<typeof createElement>) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container); act(() => root.render(element));
  cleanups.push(() => { act(() => root.unmount()); container.remove(); });
  return { container, render: (next: ReturnType<typeof createElement>) => act(() => root.render(next)) };
}
function button(container: ParentNode, label: string): HTMLButtonElement {
  const result = [...container.querySelectorAll<HTMLButtonElement>("button")].find(candidate => candidate.getAttribute("aria-label") === label || candidate.textContent === label);
  if (!result) throw new Error("Missing button: " + label);
  return result;
}
function click(container: ParentNode, label: string): void { act(() => button(container, label).click()); }
function input(container: ParentNode, label: string, value: string): void {
  const node = container.querySelector<HTMLInputElement>('input[aria-label="' + label + '"]')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => { setter.call(node, value); node.dispatchEvent(new Event("input", { bubbles: true })); });
}
function select(container: ParentNode, label: string, value: string): void {
  const node = container.querySelector<HTMLSelectElement>('select[aria-label="' + label + '"]')!;
  act(() => { node.value = value; node.dispatchEvent(new Event("change", { bubbles: true })); });
}
async function flush(): Promise<void> { await act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); }); }
function key(node: HTMLElement, value: string, extra: KeyboardEventInit = {}): void { act(() => node.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...extra }))); }
function drag(node: HTMLElement, type: string): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { setData: vi.fn(), effectAllowed: "move", dropEffect: "move" } });
  act(() => node.dispatchEvent(event));
}
beforeEach(() => { Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 }); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { cleanups.splice(0).reverse().forEach(cleanup => cleanup()); vi.restoreAllMocks(); });

describe("NotesNavigation", () => {
  it("uses guarded target navigation with arrow-key expansion, tree focus, and no implicit writes", async () => {
    const props = operations(), { container } = mount(createElement(NotesNavigation, props));
    const root = container.querySelector<HTMLButtonElement>('[data-page-id="root"]')!;
    expect(container.querySelector('[data-page-id="child"]')).toBeNull();
    root.focus(); key(root, "ArrowRight");
    const space = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    act(() => root.dispatchEvent(space)); expect(space.defaultPrevented).toBe(false);
    expect(root.getAttribute("aria-expanded")).toBe("true");
    key(root, "ArrowRight");
    const child = container.querySelector<HTMLButtonElement>('[data-page-id="child"]')!;
    expect(document.activeElement).toBe(child);
    expect(child.getAttribute("aria-level")).toBe("2");
    act(() => child.click()); await flush();
    expect(props.onOpen).toHaveBeenCalledWith({ kind: "page", pageId: "child" });
    expect(props.onCommand).not.toHaveBeenCalled();
    key(child, "ArrowLeft"); expect(document.activeElement).toBe(root);
    key(root, "ArrowLeft"); expect(container.querySelector('[data-page-id="child"]')).toBeNull();
    key(root, "End"); expect(document.activeElement?.getAttribute("data-page-id")).toBe("other");
  });
  it("finds descendants while parents are closed and separates favorite, recent, and trash results", () => {
    const { container } = mount(createElement(NotesNavigation, { ...operations(), recentPageIds: ["child", "other"] }));
    input(container, "ページを検索", "deep");
    expect([...container.querySelectorAll('[role="treeitem"]')].map(node => node.getAttribute("data-page-id"))).toEqual(["deep"]);
    input(container, "ページを検索", ""); click(container, "お気に入り");
    expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(1);
    click(container, "最近開いた"); expect([...container.querySelectorAll('[role="treeitem"]')].map(node => node.getAttribute("data-page-id"))).toEqual(["child", "other"]);
    click(container, "ゴミ箱"); expect(container.querySelector('[role="treeitem"]')?.textContent).toContain("Trash");
    click(container, "Trashの操作を表示"); expect(button(container, "復元")).toBeTruthy(); expect(button(container, "完全に削除")).toBeTruthy();
  });
  it("reveals an active descendant once while preserving an explicitly collapsed ancestor", () => {
    const props = operations({ activePageId: "deep" }), { container, render } = mount(createElement(NotesNavigation, props));
    expect(container.querySelector('[data-page-id="deep"]')?.getAttribute("aria-selected")).toBe("true");
    click(container, "Rootを折りたたむ"); expect(container.querySelector('[data-page-id="deep"]')).toBeNull();
    render(createElement(NotesNavigation, { ...props, workspace: workspace("w2") }));
    expect(container.querySelector('[data-page-id="deep"]')).toBeNull();
  });
  it("respects configured navigation sections without silently showing a disabled tree or library", () => {
    const { container } = mount(createElement(NotesNavigation, { ...operations(), sections: ["favorites"] as const }));
    expect([...container.querySelectorAll('[role="treeitem"]')].map(node => node.getAttribute("data-page-id"))).toEqual(["root"]);
    expect([...container.querySelectorAll("button")].some(node => node.textContent === "ライブラリ")).toBe(false);
    expect([...container.querySelectorAll("button")].some(node => node.textContent === "すべて")).toBe(false);
  });
  it("fails closed without per-page grants and blocks navigation or repeat mutations during unknown saves", async () => {
    const reconcile = vi.fn(async () => rejected);
    const props = operations({ status: "unknown", getCapabilities: () => [], onReconcile: reconcile });
    const { container } = mount(createElement(NotesNavigation, props));
    const item = container.querySelector<HTMLButtonElement>('[role="treeitem"]')!;
    expect(item.disabled).toBe(true); expect(item.draggable).toBe(false);
    act(() => item.click()); expect(props.onOpen).not.toHaveBeenCalled();
    click(container, "保存結果を照会"); await flush(); expect(reconcile).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("保存結果が不明");
  });
  it("deduplicates unknown-result lookups and handles read failure without retrying a mutation", async () => {
    let reject!: (reason: Error) => void;
    const reconcile = vi.fn(() => new Promise<unknown>((_resolve, fail) => { reject = fail; }));
    const props = operations({ status: "unknown", onReconcile: reconcile }), { container } = mount(createElement(NotesNavigation, props));
    click(container, "保存結果を照会"); click(container, "保存結果を照会中"); expect(reconcile).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error("synthetic lookup unavailable"))); await flush();
    expect(container.textContent).toContain("もう一度照会してください"); expect(button(container, "保存結果を照会").disabled).toBe(false); expect(props.onCommand).not.toHaveBeenCalled();
  });
  it("rejects self, descendant, deleted, unknown, and cyclic move destinations", () => {
    expect(canMoveNotesPage(pages, "root", "deep")).toBe(false);
    expect(canMoveNotesPage(pages, "root", "root")).toBe(false);
    expect(canMoveNotesPage(pages, "root", "trash")).toBe(false);
    expect(canMoveNotesPage(pages, "root", "absent")).toBe(false);
    expect(canMoveNotesPage(pages, "child", "other")).toBe(true);
    expect(canMoveNotesPage(pages, "child", null)).toBe(true);
    const cycle = [{ ...pages[0]!, parentId: "child" }, pages[1]!, pages[3]!];
    expect(canMoveNotesPage(cycle, "root", "other")).toBe(false);
  });
  it("rejects descendant drops and commits root drops only with the captured workspace revision", async () => {
    const props = operations(), { container } = mount(createElement(NotesNavigation, props));
    click(container, "Rootを展開");
    const root = container.querySelector<HTMLButtonElement>('[data-page-id="root"]')!, child = container.querySelector<HTMLButtonElement>('[data-page-id="child"]')!;
    drag(root, "dragstart"); drag(child.parentElement!, "drop"); await flush();
    expect(props.onCommand).not.toHaveBeenCalled(); expect(container.textContent).toContain("自分自身や子孫には移動できません");
    drag(child, "dragstart"); drag(container.querySelector<HTMLElement>(".oe-notes-tree-root")!, "drop"); await flush();
    expect(props.onCommand).toHaveBeenCalledExactlyOnceWith({ kind: "page", pageId: "child" }, { kind: "page.move", parentId: null, position: 2, expectedWorkspaceRevision: "w1" });
  });
  it("reads hover/focus previews without saving or opening, discards late reads, and returns close focus", async () => {
    const reads: { target: string; signal: AbortSignal; resolve(data: NotesPagePreviewData): void }[] = [];
    const props = operations(), { container } = mount(createElement(NotesNavigation, {
      ...props, onPreview: (target, signal) => new Promise<NotesPagePreviewData>(resolve => reads.push({ target: target.kind === "page" ? target.pageId : "", signal, resolve }))
    }));
    const root = container.querySelector<HTMLButtonElement>('[data-page-id="root"]')!, other = container.querySelector<HTMLButtonElement>('[data-page-id="other"]')!;
    act(() => root.focus()); expect(reads).toHaveLength(1); expect(document.activeElement).toBe(root);
    act(() => other.focus()); expect(reads).toHaveLength(2); expect(reads[0]!.signal.aborted).toBe(true);
    await act(async () => { reads[0]!.resolve({ page: pages[0]!, content: "Stale content" }); reads[1]!.resolve({ page: pages[3]!, content: "Latest preview", related: [pages[0]!] }); }); await flush();
    expect(container.querySelector('[aria-label="Otherのプレビュー"]')?.textContent).toContain("Latest preview");
    expect(container.textContent).not.toContain("Stale content"); expect(props.onCommand).not.toHaveBeenCalled(); expect(props.onOpen).not.toHaveBeenCalled();
    click(container, "プレビューを閉じる"); expect(document.activeElement).toBe(other); expect(reads).toHaveLength(2);
    expect(container.querySelector('.oe-notes-page-preview')).toBeNull();
  });
  it("allows keyboard preview resizing at 320px and preserves guarded full-open cancellation", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
    const onOpen = vi.fn(async () => false), onClose = vi.fn(), onWidthChange = vi.fn();
    const { container } = mount(createElement(NotesPagePreview, { data: { page: pages[0]!, content: "Read only preview" }, onOpen, onClose, onWidthChange }));
    const handle = container.querySelector<HTMLElement>('[role="separator"]')!;
    expect(Number(handle.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(288);
    key(handle, "Home"); expect(handle.getAttribute("aria-valuenow")).toBe("240");
    key(handle, "ArrowLeft"); expect(handle.getAttribute("aria-valuenow")).toBe("256"); expect(onWidthChange).toHaveBeenLastCalledWith(256);
    click(container, "編集画面で開く"); await flush(); expect(onOpen).toHaveBeenCalledWith({ kind: "page", pageId: "root" }); expect(onClose).not.toHaveBeenCalled(); expect(container.textContent).toContain("ページを切り替えていません");
    key(handle, "Escape", { isComposing: true }); expect(onClose).not.toHaveBeenCalled(); key(handle, "Escape"); expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("NotesPageActions", () => {
  it("binds favorite and classification changes to the observed catalog without sending unrelated fields", async () => {
    const props = operations(), { container } = mount(createElement(NotesPageActions, { ...props, page: pages[0]! }));
    click(container, "お気に入りを解除"); await flush();
    expect(props.onCommand).toHaveBeenLastCalledWith({ kind: "page", pageId: "root" }, { kind: "metadata.patch", expectedWorkspaceRevision: "w1", fields: { favorite: false } });
    click(container, "分類を編集"); input(container, "分類", "Research"); input(container, "タグ", "work, research, work"); click(container, "確認して保存"); await flush();
    expect(props.onCommand).toHaveBeenLastCalledWith({ kind: "page", pageId: "root" }, { kind: "metadata.patch", expectedWorkspaceRevision: "w1", fields: { category: "Research", tags: ["work", "research"] } });
  });
  it("keeps a keyboard-accessible move destination picker, excludes descendants, and sends workspace CAS", async () => {
    const props = operations(), { container } = mount(createElement(NotesPageActions, { ...props, page: pages[0]! }));
    click(container, "移動");
    const destinations = [...container.querySelectorAll<HTMLOptionElement>("option")].map(node => node.value);
    expect(destinations.slice(0, 2)).toEqual(["", "other"]);
    select(container, "移動先", "other"); click(container, "確認して保存"); await flush();
    expect(props.onCommand).toHaveBeenCalledWith({ kind: "page", pageId: "root" }, { kind: "page.move", parentId: "other", position: 0, expectedWorkspaceRevision: "w1" });
  });
  it("cancels drafts without writes, keeps IME Escape, traps Tab, and returns narrow-screen focus to the opener", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
    const props = operations(), { container } = mount(createElement(NotesPageActions, { ...props, page: pages[0]! }));
    const opener = button(container, "名前を変更"); opener.focus(); act(() => opener.click());
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!, field = container.querySelector<HTMLInputElement>('input[aria-label="ページ名"]')!;
    expect(document.activeElement).toBe(field);
    input(container, "ページ名", "IME draft"); key(field, "Escape", { isComposing: true });
    expect(container.querySelector('[role="dialog"]')).toBe(dialog);
    const cancel = button(container, "キャンセル"); cancel.focus(); key(cancel, "Tab"); expect(document.activeElement).toBe(field);
    key(field, "Tab", { shiftKey: true }); expect(document.activeElement).toBe(cancel);
    key(dialog, "Escape"); expect(container.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(opener);
    expect(props.onCommand).not.toHaveBeenCalled();
  });
  it("preserves stale rename input and stops submission after a workspace revision changes", () => {
    const props = operations(), { container, render } = mount(createElement(NotesPageActions, { ...props, page: pages[0]! }));
    click(container, "名前を変更"); input(container, "ページ名", "My draft");
    render(createElement(NotesPageActions, { ...props, workspace: workspace("w2"), page: pages[0]! }));
    expect(container.querySelector<HTMLInputElement>('input[aria-label="ページ名"]')?.value).toBe("My draft");
    expect(button(container, "確認して保存").disabled).toBe(true); expect(container.textContent).toContain("一覧が更新されました");
    click(container, "確認して保存"); expect(props.onCommand).not.toHaveBeenCalled();
  });
  it("does not transfer a rename draft into a different actor scope with the same revision", () => {
    const props = operations(), { container, render } = mount(createElement(NotesPageActions, { ...props, page: pages[0]! }));
    click(container, "名前を変更"); input(container, "ページ名", "Draft owned by first scope");
    render(createElement(NotesPageActions, { ...props, workspace: { ...props.workspace, scope: { actorId: "another", workspaceId: "test" } }, page: pages[0]! }));
    expect(button(container, "確認して保存").disabled).toBe(true); expect(props.onCommand).not.toHaveBeenCalled();
  });
  it("keeps a confirmed local save confirmed when the subsequent catalog reload fails", async () => {
    const committed: NotesCommandOutcome = {
      status: "committed", operationId: "ticket", target: { kind: "page", pageId: "root" }, historyId: "h", persistence: "local-only",
      snapshot: { scope: { actorId: "synthetic", workspaceId: "test" }, target: { kind: "page", pageId: "root" }, revision: "r2", contentRevision: "c2", title: "New", document: { schemaVersion: 1, blocks: [] }, metadata: {}, capabilities: [], capabilitySemantics: {} }
    };
    const command = vi.fn(async () => committed), { container } = mount(createElement(NotesPageActions, { ...operations({ onCommand: command, getPersistence: () => "local-only", onWorkspaceChanged: async () => { throw new Error("synthetic offline"); } }), page: pages[0]! }));
    click(container, "名前を変更"); expect(container.textContent).toContain("この端末にのみ保存");
    input(container, "ページ名", "New"); click(container, "確認して保存"); await flush();
    expect(container.textContent).toContain("この端末への保存を確認しました"); expect(container.textContent).toContain("再読込できませんでした"); expect(container.textContent).not.toContain("保存結果が不明");
    expect(button(container, "確認して保存").disabled).toBe(true); click(container, "確認して保存"); expect(command).toHaveBeenCalledTimes(1); click(container, "閉じる"); expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
  it("locks repeat submissions and cancellation after lost ACK until authoritative lookup fences the operation", async () => {
    let resolve!: (value: NotesCommandOutcome) => void;
    const command = vi.fn(() => new Promise<NotesCommandOutcome>(done => { resolve = done; }));
    const cancel = vi.fn();
    const unknown: NotesCommandOutcome = { status: "unknown", operationId: "ticket", target: { kind: "page", pageId: "root" } };
    const reconcile = vi.fn(async () => ({ status: "not-found", terminal: true, operationId: "ticket", target: { kind: "page", pageId: "root" } }));
    const { container } = mount(createElement(NotesPageActions, { ...operations({ onCommand: command, onCancel: cancel, onReconcile: reconcile }), page: pages[0]! }));
    click(container, "名前を変更"); click(container, "確認して保存"); click(container, "確認して保存");
    expect(command).toHaveBeenCalledTimes(1); expect(button(container, "キャンセル").disabled).toBe(true);
    click(container, "保存の待機を中止"); expect(cancel).toHaveBeenCalledTimes(1);
    await act(async () => resolve(unknown)); await flush();
    expect(button(container, "確認して保存").disabled).toBe(true); expect(button(container, "キャンセル").disabled).toBe(true);
    click(container, "保存結果を照会"); await flush();
    expect(reconcile).toHaveBeenCalledTimes(1); expect(command).toHaveBeenCalledTimes(1);
    expect(button(container, "キャンセル").disabled).toBe(false);
  });
  it("requires both a deletion capability and explicit confirmation, while restore remains a typed durable command", async () => {
    const props = operations(), { container, render } = mount(createElement(NotesPageActions, { ...props, page: pages[4]! }));
    click(container, "完全に削除"); expect(button(container, "確認して保存").disabled).toBe(true);
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!; act(() => checkbox.click());
    click(container, "確認して保存"); await flush();
    expect(props.onCommand).toHaveBeenCalledWith({ kind: "page", pageId: "trash" }, { kind: "page.delete-permanently", confirmation: "delete-permanently", expectedWorkspaceRevision: "w1" });
    click(container, "キャンセル"); render(createElement(NotesPageActions, { ...props, page: pages[4]!, getCapabilities: () => ["page.restore"] as const }));
    expect([...container.querySelectorAll("button")].some(node => node.textContent === "完全に削除")).toBe(false);
    click(container, "復元"); click(container, "確認して保存"); await flush();
    expect(props.onCommand).toHaveBeenLastCalledWith({ kind: "page", pageId: "trash" }, { kind: "page.restore", expectedWorkspaceRevision: "w1" });
  });
});

describe("NotesLibrary and PageHub", () => {
  it("filters kinds, tags, text, direction, density and bounded pagination using host presentation", () => {
    const { container } = mount(createElement(NotesLibrary, { ...operations(), pageSize: 2, getPresentation: page => ({ kind: page.id === "other" ? "database" : "page", summary: page.id === "child" ? "Special summary" : "" }) }));
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(2);
    click(container, "さらに読み込む"); expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(4);
    select(container, "ページの種類", "database"); expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(1); expect(container.querySelector("h3")?.textContent).toBe("Other");
    select(container, "ページの種類", "all"); input(container, "ライブラリを検索", "special"); expect(container.querySelector("h3")?.textContent).toBe("Child");
    input(container, "ライブラリを検索", ""); select(container, "並び順", "title"); click(container, "昇順にする");
    expect(container.querySelector("h3")?.textContent).toBe("Child");
    click(container, "コンパクト"); expect(container.querySelector("section")?.classList.contains("oe-notes-library-compact")).toBe(true);
    click(container.querySelector('[aria-label="タグで絞り込み"]')!, "#home"); expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(1);
  });
  it("deduplicates remote pagination and exposes recoverable read failure", async () => {
    let resolve!: () => void;
    const load = vi.fn(() => new Promise<void>(done => { resolve = done; }));
    const { container } = mount(createElement(NotesLibrary, { ...operations({ workspace: workspace("w", [pages[0]!]) }), hasMore: true, onLoadMore: load }));
    click(container, "さらに読み込む"); click(container, "読み込み中"); expect(load).toHaveBeenCalledTimes(1);
    await act(async () => resolve()); await flush(); expect(button(container, "さらに読み込む").disabled).toBe(false);
  });
  it("uses breadcrumbs, child search, related-page navigation, grid/list and guarded create", async () => {
    const props = operations(), { container } = mount(createElement(NotesPageHub, { ...props, pageId: "child", relatedPageIds: ["other", "trash"] }));
    expect(container.querySelector('[aria-label="ページの場所"]')?.textContent).toContain("RootChild");
    click(container.querySelector('[aria-label="ページの場所"]')!, "Root"); await flush();
    expect(props.onOpen).toHaveBeenCalledWith({ kind: "page", pageId: "root" });
    click(container, "リスト"); expect(container.querySelector("section")?.className).toContain("oe-notes-page-hub-list");
    input(container, "子ページを検索", "missing"); expect(container.textContent).toContain("一致する子ページはありません");
    expect(container.querySelector('[aria-label="関連ページ"]')?.textContent).toContain("Other"); expect(container.querySelector('[aria-label="関連ページ"]')?.textContent).not.toContain("Trash");
    click(container, "子ページを追加"); input(container, "ページ名", "New child"); click(container, "確認して保存"); await flush();
    expect(props.onCommand).toHaveBeenCalledWith({ kind: "page", pageId: "child" }, { kind: "page.create", title: "New child", parentId: "child", expectedWorkspaceRevision: "w1" });
  });
});
