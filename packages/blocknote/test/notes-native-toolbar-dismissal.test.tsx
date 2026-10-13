/** @vitest-environment jsdom */
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { BlockNoteContext, GenericPopover } from "@blocknote/react";
import { notesToolbarCloseTransition } from "../src/react/NotesFormattingToolbar.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// JSDOM has no layout observers. Keep the installed popup state/transition code,
// and stub automatic geometry tracking only.
vi.mock("@floating-ui/react", async original => ({ ...await original<typeof import("@floating-ui/react")>(), autoUpdate: (_reference: unknown, _floating: unknown, update: () => void) => { update(); return () => {}; } }));
const disposers: (() => void)[] = [];
const rect = () => ({ x: 10, y: 100, top: 100, left: 10, right: 210, bottom: 130, width: 200, height: 30, toJSON() {} });
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(rect); });
afterEach(() => { disposers.splice(0).reverse().forEach(dispose => dispose()); vi.restoreAllMocks(); delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; });
async function settle(ms = 35) { await act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); }); }
describe("native popover primitive", () => {
  it.each([false, true])("native close retains transition HTML only without Notes immediate close (%s)", async immediate => {
    const container = document.createElement("div"), anchor = document.createElement("div"); document.body.append(container, anchor); const root = createRoot(container);
    const editor = { portalElement: container, isWithinEditor: () => false };
    const reference = { element: anchor };
    let toggle!: (open: boolean) => void;
    function Example() { const [open, setOpen] = useState(true); toggle = setOpen; return <BlockNoteContext.Provider value={{ editor } as never}><GenericPopover {...(immediate ? notesToolbarCloseTransition : {})} reference={reference} useFloatingOptions={{ open, onOpenChange: setOpen }} focusManagerProps={{ disabled: true }}>{open ? <div data-observed-toolbar><button>Action</button></div> : null}</GenericPopover></BlockNoteContext.Provider>; }
    disposers.push(() => { act(() => root.unmount()); container.remove(); anchor.remove(); });
    act(() => root.render(<Example />)); await settle();
    expect(container.querySelector('[data-observed-toolbar]')).not.toBeNull();
    act(() => toggle(false));
    const closing = container.querySelector<HTMLElement>('[data-observed-toolbar]')?.parentElement;
    if (immediate) {
      if (closing) { expect(closing.style.visibility).toBe("hidden"); expect(closing.style.pointerEvents).toBe("none"); expect(closing.style.transitionDuration).toBe("0ms"); }
      await settle(); expect(container.querySelector('[data-observed-toolbar]')).toBeNull();
      act(() => toggle(true)); await settle();
      const reopened = container.querySelector<HTMLElement>('[data-observed-toolbar]')?.parentElement;
      expect(reopened).toBeDefined(); expect(reopened!.style.visibility).not.toBe("hidden");
      expect(reopened!.style.pointerEvents).not.toBe("none"); expect(reopened!.style.transitionDuration).toBe("250ms");
      act(() => toggle(false));
    } else expect(closing).toBeDefined();
    await settle(300); expect(container.querySelector('[data-observed-toolbar]')).toBeNull();
  }, 15000);
});
