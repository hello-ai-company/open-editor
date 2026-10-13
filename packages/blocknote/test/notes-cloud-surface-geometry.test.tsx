/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotesFloatingSurface } from "../src/react/NotesFloatingSurface.js";
import { NotesOverlayPortal } from "../src/react/NotesOverlayPortal.js";

let root: Root, container: HTMLDivElement, owner: HTMLDivElement, cell: HTMLDivElement, anchor: HTMLSpanElement;
const rect = (left: number, top: number, width: number, height: number): DOMRect => ({ left, top, right: left + width, bottom: top + height, x: left, y: top, width, height, toJSON: () => ({}) });
let ownerRect: DOMRect, cellRect: DOMRect;
let viewport: EventTarget & { offsetLeft: number; offsetTop: number; width: number; height: number };
const surface = () => document.querySelector<HTMLElement>(".oe-notes-floating-surface")!;
const overlay = () => document.querySelector<HTMLElement>(".oe-notes-overlay-layer")!;
const frame = () => act(() => vi.advanceTimersByTime(20));

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  viewport = Object.assign(new EventTarget(), { offsetLeft: 0, offsetTop: 0, width: 1000, height: 800 });
  vi.stubGlobal("visualViewport", viewport);
  container = document.createElement("div"); owner = document.createElement("div"); cell = document.createElement("div"); anchor = document.createElement("span");
  owner.className = "oe-notes-workspace"; cell.className = "oe-notes-document-cell";
  ownerRect = rect(100, 80, 700, 600); cellRect = rect(140, 200, 400, 450);
  owner.getBoundingClientRect = () => ownerRect; cell.getBoundingClientRect = () => cellRect;
  cell.append(anchor); owner.append(cell); document.body.append(owner, container); root = createRoot(container);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) { return this.classList.contains("oe-notes-floating-surface") ? rect(0, 0, 280, 44) : rect(0, 0, 0, 0); });
});
afterEach(() => {
  act(() => root.unmount()); container.remove(); owner.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});

describe("owner-bound visible-viewport portal geometry", () => {
  it("keeps a modal inside the owner and reflows above the software keyboard without moving focus", () => {
    act(() => root.render(<NotesOverlayPortal anchor={anchor} onDismiss={() => {}}><div role="dialog"><textarea aria-label="retained" defaultValue="Keep input" /></div></NotesOverlayPortal>));
    expect(overlay().style.left).toBe("100px"); expect(overlay().style.top).toBe("80px"); expect(overlay().style.height).toBe("600px");
    const input = document.querySelector<HTMLTextAreaElement>("textarea")!; input.focus();
    viewport.height = 390; act(() => viewport.dispatchEvent(new Event("resize"))); frame();
    expect(overlay().style.height).toBe("310px"); expect(document.activeElement).toBe(input); expect(input.value).toBe("Keep input");
  });
  it("includes visual viewport offsets and hides an owner with no visible intersection", () => {
    viewport.offsetLeft = 150; viewport.offsetTop = 120; viewport.width = 400; viewport.height = 300;
    act(() => root.render(<NotesOverlayPortal anchor={anchor} onDismiss={() => {}}><div role="dialog">Contents</div></NotesOverlayPortal>));
    expect(overlay().style.left).toBe("150px"); expect(overlay().style.top).toBe("120px"); expect(overlay().style.width).toBe("400px"); expect(overlay().style.height).toBe("300px");
    ownerRect = rect(100, 900, 700, 600); act(() => window.dispatchEvent(new Event("scroll"))); frame();
    expect(overlay().style.visibility).toBe("hidden"); expect(overlay().style.height).toBe("0px");
  });
  it("coalesces viewport event bursts and cleans pending measurements on unmount", () => {
    const measure = vi.spyOn(owner, "getBoundingClientRect");
    act(() => root.render(<NotesOverlayPortal anchor={anchor} onDismiss={() => {}}><div role="dialog">Contents</div></NotesOverlayPortal>));
    const before = measure.mock.calls.length;
    act(() => { viewport.dispatchEvent(new Event("resize")); viewport.dispatchEvent(new Event("scroll")); window.dispatchEvent(new Event("scroll")); });
    frame(); expect(measure.mock.calls.length - before).toBe(1);
    act(() => viewport.dispatchEvent(new Event("resize"))); act(() => root.render(null)); frame();
    expect(measure.mock.calls.length - before).toBe(1);
  });
  it("bounds standalone selection controls to the document column and flips above the bottom edge", () => {
    const selectionRect = () => ({ left: 510, top: 610, right: 530, bottom: 630 });
    const selection = window.getSelection()!, text = document.createTextNode("selected words"); cell.append(text);
    const input = document.createElement("input"); owner.append(input); input.focus();
    const range = document.createRange(); range.selectNodeContents(text); selection.removeAllRanges(); selection.addRange(range);
    expect(selection.toString()).toBe("selected words");
    act(() => root.render(<NotesFloatingSurface ownerRef={{ current: anchor }} placement="selection" selectionRect={selectionRect}><button>Comment</button></NotesFloatingSurface>));
    expect(surface().style.left).toBe("248px"); expect(surface().style.top).toBe("558px"); expect(surface().style.maxWidth).toBe("376px");
    expect(selection.toString()).toBe("selected words"); expect(document.activeElement).toBe(input);
  });
  it("hides a horizontally offscreen selection instead of parking its actions on unrelated text", () => {
    act(() => root.render(<NotesFloatingSurface ownerRef={{ current: anchor }} placement="selection" selectionRect={() => ({ left: 700, right: 730, top: 300, bottom: 320 })}><button>Comment</button></NotesFloatingSurface>));
    expect(surface().style.visibility).toBe("hidden");
  });
  it("keeps feedback workspace-bound while inheriting the complete owner palette", () => {
    owner.style.setProperty("--note-accent", "#176b64");
    act(() => root.render(<NotesFloatingSurface ownerRef={{ current: anchor }}><button>Resume</button></NotesFloatingSurface>));
    expect(surface().style.left).toBe("508px"); expect(surface().style.top).toBe("624px"); expect(surface().style.getPropertyValue("--note-accent")).toBe("#176b64");
  });
});
