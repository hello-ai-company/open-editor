/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FormattingToolbarExtension, SideMenuExtension } from "@blocknote/core/extensions";
import { NotesSelectionActionsContext } from "../src/react/NotesFormattingToolbar.js";
import { DocumentSideMenuController } from "../src/react/DocumentSideMenuController.js";
const mocks = vi.hoisted(() => ({ editor: null as any, menu: null as any, colorAction: vi.fn(), showMenu: false, formatting: true, hasFormatting: true, side: { show: true, block: { id: "text", type: "paragraph", props: {}, content: [] } } }));
vi.mock("@blocknote/react", async original => ({ ...await original<typeof import("@blocknote/react")>(),
  useBlockNoteEditor: () => mocks.editor,
  useExtension: () => mocks.menu,
  useExtensionState: (extension: any, options?: any) => { const value = extension === FormattingToolbarExtension ? mocks.formatting : mocks.side; return options?.selector ? options.selector(value) : value; },
  SideMenuController: ({ sideMenu: Menu }: any) => <Menu />,
  SideMenu: ({ children }: any) => <div>{children}</div>,
  AddBlockButton: () => <button>Add block</button>, DragHandleButton: ({ dragHandleMenu: Menu }: any) => <><button>Move block</button>{mocks.showMenu && <Menu />}</>,
  DragHandleMenu: ({ children }: any) => <div role="menu">{children}</div>,
  RemoveBlockItem: ({ children }: any) => <button>{children}</button>, BlockColorsItem: ({ children }: any) => <button onClick={mocks.colorAction}>{children}</button>,
  TableRowHeaderItem: ({ children }: any) => <button>{children}</button>, TableColumnHeaderItem: ({ children }: any) => <button>{children}</button>,
  useDictionary: () => ({ drag_handle: { delete_menuitem: "Delete", colors_menuitem: "Colors", header_row_menuitem: "Header row", header_column_menuitem: "Header column" } }),
}));
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  mocks.colorAction.mockClear(); mocks.showMenu = false; mocks.formatting = true; mocks.hasFormatting = true;
  mocks.menu = { menuFrozen: false, freezeMenu: vi.fn(() => { mocks.menu.menuFrozen = true; }), unfreezeMenu: vi.fn(() => { mocks.menu.menuFrozen = false; }), store: { subscribe: vi.fn(() => () => {}) } };
  mocks.editor = { isEditable: true, schema: { blockSpecs: { paragraph: { implementation: {} } } }, prosemirrorView: { dom: document.createElement("div") }, getExtension: (extension: any) => extension === SideMenuExtension ? mocks.menu : mocks.hasFormatting ? { store: { get state() { return mocks.formatting; }, subscribe: () => () => {} } } : undefined };
});
afterEach(() => { act(() => root.unmount()); container.remove(); delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; });
function render(suppressed = false, hasContext = true, integrated = true, canFormatItem?: (key: string) => boolean) {
  act(() => root.render(hasContext ? <NotesSelectionActionsContext.Provider value={{ controls: null, language: "en", integrated, suppressed, canFormatItem, canFormat: () => true, dismiss() {} }}><DocumentSideMenuController /></NotesSelectionActionsContext.Provider> : <DocumentSideMenuController />));
}
describe("selection bar owns its editor's transient gutter", () => {
  it("keeps default gutter actions but omits owner-unbound block colors", () => {
    mocks.formatting = false; mocks.showMenu = true; render(false, true, true, key => key !== "blockColors");
    expect(container.textContent).not.toContain("Colors"); expect(container.textContent).toContain("Delete"); expect(container.textContent).toContain("Header row");
    render(false, false); expect(container.textContent).toContain("Colors");
  });
  it("rechecks a queued gutter color event after policy revocation", () => {
    mocks.formatting = false; mocks.showMenu = true; let allowed = true; render(false, true, true, () => allowed);
    const color = container.querySelector<HTMLButtonElement>('[data-notes-gutter-colors] button')!; allowed = false;
    act(() => color.click()); expect(mocks.colorAction).not.toHaveBeenCalled();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => color.dispatchEvent(enter)); expect(enter.defaultPrevented).toBe(true);
  });
  it("hides the gutter only for an actually shown unified selection bar and restores it after Escape", () => {
    render(); expect(container.querySelector('.oe-document-side-menu')).toBeNull();
    render(true); expect(container.querySelector('.oe-document-side-menu')).not.toBeNull();
    mocks.formatting = false; render(); expect(container.querySelector('.oe-document-side-menu')).not.toBeNull();
  });
  it("leaves standalone editor gutters available without the Notes selection context", () => {
    render(false, false); expect(container.querySelector('.oe-document-side-menu')).not.toBeNull();
  });
  it("preserves a custom renderer gutter when the supplied formatting controller was not mounted", () => {
    render(false, true, false); expect(container.querySelector('.oe-document-side-menu')).not.toBeNull();
  });
  it("supports standalone hosts with the formatting extension disabled", () => {
    mocks.hasFormatting = false; render(false, false); expect(container.querySelector('.oe-document-side-menu')).not.toBeNull();
  });
  it("releases only its own hover freeze when a selection takes over", () => {
    mocks.formatting = false; render();
    act(() => container.querySelector('.oe-document-side-menu')!.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })));
    expect(mocks.menu.freezeMenu).toHaveBeenCalledOnce();
    mocks.formatting = true; render(); expect(mocks.menu.unfreezeMenu).toHaveBeenCalledOnce();
    expect(container.querySelector('.oe-document-side-menu')).toBeNull();
  });
  it("does not unfreeze a menu it did not freeze", () => {
    mocks.menu.menuFrozen = true; render(); expect(mocks.menu.unfreezeMenu).not.toHaveBeenCalled();
    expect(container.querySelector('.oe-document-side-menu')).not.toBeNull();
  });
  it("keeps narrow wrapping rules more specific than the vendor toolbar rule", () => {
    const css = readFileSync('src/power/notesDesign.css', 'utf8');
    const rule = css.match(/\.oe-notes-unified-selection\s*>\s*\.bn-toolbar\.bn-formatting-toolbar\{([^}]+)\}/)?.[1];
    expect(rule).toContain('flex-wrap:wrap'); expect(rule).toContain('max-width:min(680px,calc(100vw - 24px))'); expect(rule).toContain('overflow:visible'); expect(rule).toContain('padding:6px');
  });
});
