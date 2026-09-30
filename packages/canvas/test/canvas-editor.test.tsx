/** @vitest-environment jsdom */
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { DEFAULT_CANVAS_BREAKPOINTS, type CanvasLayoutSpec } from "../src/index.js";
import { CanvasEditor, type CanvasEditorViewState } from "../src/react/index.js";

const documentModel = createEditorDocument([
  {
    id: "intro",
    type: "paragraph",
    content: [{ type: "text", text: "Hello <script>document.cookie</script>" }],
    children: [{ id: "nested", type: "paragraph", content: [{ type: "text", text: "Nested content" }] }]
  },
  { id: "photo", type: "image", props: { url: "javascript:alert(1)", alt: "Photo" } },
  { id: "ending", type: "paragraph", content: [{ type: "text", text: "End" }] }
]);

function spec(): CanvasLayoutSpec {
  return {
    template: "report",
    breakpoints: { ...DEFAULT_CANVAS_BREAKPOINTS },
    theme: "editorial",
    root: {
      id: "root",
      type: "stack",
      direction: "vertical",
      gap: { mobile: 12, tablet: 20, desktop: 32 },
      children: [
        { id: "section", type: "section", children: [
          { id: "intro-ref", type: "text", blockId: "intro" },
          { id: "nested-ref", type: "text", blockId: "nested" }
        ] },
        { id: "image-ref", type: "image", blockId: "photo" },
        { id: "ending-ref", type: "text", blockId: "ending" }
      ]
    }
  };
}

function mount(element: ReactElement) {
  const previousActFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return {
    container,
    rerender: (next: ReactElement) => act(() => root.render(next)),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousActFlag;
    }
  };
}

function click(container: HTMLElement, selector: string): void {
  const target = container.querySelector(selector);
  if (!(target instanceof HTMLElement)) throw new Error(`Missing interactive element: ${selector}`);
  act(() => target.click());
}

function clickButton(container: HTMLElement, label: string): void {
  const target = Array.from(container.querySelectorAll("button")).find((button) =>
    button.getAttribute("aria-label") === label || button.textContent?.trim() === label
  );
  if (!(target instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  act(() => target.click());
}

function pressKey(target: HTMLElement, key: string): void {
  act(() => target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })));
}

function changeSelect(container: HTMLElement, label: string, value: string): void {
  const select = Array.from(container.querySelectorAll("select")).find((entry) => entry.getAttribute("aria-label") === label);
  if (!(select instanceof HTMLSelectElement)) throw new Error(`Missing select: ${label}`);
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function changeInput(container: HTMLElement, label: string, value: string): void {
  const input = Array.from(container.querySelectorAll("input")).find((entry) => entry.getAttribute("aria-label") === label);
  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing input: ${label}`);
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("HTMLInputElement value setter is unavailable");
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function dispatchPointer(target: HTMLElement, type: string, clientX: number, clientY: number, pointerId = 1, button = 0, pointerType = "mouse"): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
    isPrimary: { value: true },
    button: { value: button },
    clientX: { value: clientX },
    clientY: { value: clientY }
  });
  act(() => target.dispatchEvent(event));
}

function setBounds(target: HTMLElement, left: number, top: number, width: number, height: number): void {
  Object.defineProperty(target, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) } as DOMRect)
  });
}

function mockPointerCapture(target: HTMLElement) {
  let capturedPointer: number | null = null;
  Object.defineProperties(target, {
    setPointerCapture: { configurable: true, value: (pointerId: number) => { capturedPointer = pointerId; } },
    hasPointerCapture: { configurable: true, value: (pointerId: number) => capturedPointer === pointerId },
    releasePointerCapture: { configurable: true, value: (pointerId: number) => { if (capturedPointer === pointerId) capturedPointer = null; } }
  });
  return () => capturedPointer;
}

function positionedFixture(lockedNodeIds: string[] = []) {
  const positionedSpec: CanvasLayoutSpec = {
    template: "report",
    breakpoints: { ...DEFAULT_CANVAS_BREAKPOINTS },
    theme: "editorial",
    root: {
      id: "overlay-root",
      type: "absolute",
      items: [{
        element: { id: "absolute-action", type: "button", blockId: "action" },
        rect: { mobile: { x: 4, y: 4, width: 40, height: 20 } }
      }]
    }
  };
  const positionedDocument = createEditorDocument([
    { id: "action", type: "button", content: [{ type: "text", text: "Open details" }] }
  ]);
  const viewState: CanvasEditorViewState = {
    selectedNodeId: "absolute-action", hiddenNodeIds: [], lockedNodeIds, alignmentByNodeId: {}, breakpoint: "mobile"
  };
  const layoutChanges: CanvasLayoutSpec[] = [];
  const render = (nextSpec: CanvasLayoutSpec) => createElement(CanvasEditor, {
    document: positionedDocument,
    spec: nextSpec,
    viewState,
    onLayoutChange: (next) => layoutChanges.push(next)
  });
  const view = mount(render(positionedSpec));
  const item = view.container.querySelector<HTMLElement>(".oe-canvas__absolute-item");
  const absolute = view.container.querySelector<HTMLElement>(".oe-canvas__absolute");
  if (!item || !absolute) throw new Error("Missing positioned Canvas item");
  setBounds(absolute, 100, 50, 200, 100);
  setBounds(item, 108, 54, 80, 20);
  const capturedPointer = mockPointerCapture(item);
  return {
    view,
    item,
    layoutChanges,
    capturedPointer,
    render
  };
}

describe("CanvasEditor", () => {
  it("keeps workspace reference labels visible in the document preview", () => {
    const referencedDocument = createEditorDocument([
      {
        id: "references",
        type: "paragraph",
        content: [
          { type: "pageMention", props: { pageId: "architecture" } },
          { type: "text", text: " ", styles: {} },
          { type: "blockReference", props: { blockId: "heading-1" } },
          { type: "text", text: " ", styles: {} },
          { type: "databaseRelation", props: { databaseId: "tasks", rowId: "task-1" } }
        ]
      }
    ]);
    const referencedSpec: CanvasLayoutSpec = {
      template: "report",
      breakpoints: { ...DEFAULT_CANVAS_BREAKPOINTS },
      theme: "editorial",
      root: {
        id: "reference-root",
        type: "stack",
        direction: "vertical",
        children: [{ id: "reference-text", type: "text", blockId: "references" }]
      }
    };
    const view = mount(createElement(CanvasEditor, { document: referencedDocument, spec: referencedSpec }));
    try {
      expect(view.container.textContent).toContain("@architecture");
      expect(view.container.textContent).toContain("→ heading-1");
      expect(view.container.textContent).toContain("↗ tasks/task-1");
    } finally {
      view.unmount();
    }
  });

  it("keeps inspector labels unique when multiple editors are mounted", () => {
    const view = mount(createElement("div", null,
      createElement(CanvasEditor, { document: documentModel, spec: spec() }),
      createElement(CanvasEditor, { document: documentModel, spec: spec() })
    ));
    try {
      const sections = Array.from(view.container.querySelectorAll(".oe-canvas__section[aria-labelledby]"));
      const ids = sections.map((section) => section.getAttribute("aria-labelledby"));
      expect(sections.every((section) => section.querySelector("h3")?.id === section.getAttribute("aria-labelledby"))).toBe(true);
      expect(ids.every(Boolean)).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
    } finally {
      view.unmount();
    }
  });

  it("renders nested layout and semantic child content as escaped text with unsafe media blocked", () => {
    const view = mount(createElement(CanvasEditor, { document: documentModel, spec: spec() }));
    try {
      expect(view.container.textContent).toContain("Hello <script>document.cookie</script>");
      expect(view.container.textContent).toContain("Nested content");
      expect(view.container.querySelector("script")).toBeNull();
      expect(view.container.querySelector("img")).toBeNull();
      expect(view.container.textContent).toContain("Image unavailable");
      expect(view.container.querySelectorAll("[data-canvas-node-id]").length).toBe(6);
    } finally {
      view.unmount();
    }
  });

  it("renders host text stored in canonical EditorBlock props", () => {
    const hostDocument = createEditorDocument([
      { id: "host-paragraph", type: "paragraph", props: { text: "Research brief from Personal AI" } }
    ]);
    const hostSpec: CanvasLayoutSpec = {
      ...spec(),
      root: { id: "host-root", type: "stack", direction: "vertical", children: [
        { id: "host-paragraph-ref", type: "text", blockId: "host-paragraph" }
      ] }
    };
    const view = mount(createElement(CanvasEditor, { document: hostDocument, spec: hostSpec }));
    try {
      expect(view.container.textContent).toContain("Research brief from Personal AI");
    } finally {
      view.unmount();
    }
  });

  it("fails closed on duplicate layout IDs and shows missing semantic refs as safe placeholders", () => {
    const invalid: CanvasLayoutSpec = {
      ...spec(),
      root: { id: "root", type: "stack", direction: "vertical", children: [
        { id: "same", type: "text", blockId: "intro" },
        { id: "same", type: "text", blockId: "ending" }
      ] }
    };
    const invalidView = mount(createElement(CanvasEditor, { document: documentModel, spec: invalid }));
    try {
      expect(invalidView.container.textContent).toContain("Canvas unavailable");
      expect(invalidView.container.textContent).not.toContain("Hello");
    } finally {
      invalidView.unmount();
    }

    const stale: CanvasLayoutSpec = {
      ...spec(),
      root: { id: "root", type: "stack", direction: "vertical", children: [
        { id: "available", type: "text", blockId: "ending" },
        { id: "deleted", type: "text", blockId: "deleted-block" }
      ] }
    };
    const staleView = mount(createElement(CanvasEditor, { document: documentModel, spec: stale }));
    try {
      expect(staleView.container.textContent).toContain("End");
      expect(staleView.container.textContent).toContain("Referenced content is unavailable.");
      expect(staleView.container.textContent).toContain("no longer available");
    } finally {
      staleView.unmount();
    }
  });

  it("fails closed for malformed cyclic layout data", () => {
    const cyclic = { id: "cycle", type: "section", children: [] } as unknown as CanvasLayoutSpec["root"];
    (cyclic as { children: CanvasLayoutSpec["root"][] }).children.push(cyclic);
    const badSpec = { ...spec(), root: cyclic };
    const view = mount(createElement(CanvasEditor, { document: documentModel, spec: badSpec }));
    try {
      expect(view.container.textContent).toContain("Canvas unavailable");
      expect(view.container.querySelector("[data-canvas-node-id]")).toBeNull();
    } finally {
      view.unmount();
    }
  });

  it("reflects document edits immediately and permits repeated semantic references", () => {
    const editedDocument = createEditorDocument([
      { ...documentModel.blocks[0]!, content: [{ type: "text", text: "Updated source text" }] },
      documentModel.blocks[1]!,
      documentModel.blocks[2]!
    ]);
    const view = mount(createElement(CanvasEditor, { document: documentModel, spec: spec() }));
    try {
      expect(view.container.textContent).toContain("Hello <script>document.cookie</script>");
      view.rerender(createElement(CanvasEditor, { document: editedDocument, spec: spec() }));
      expect(view.container.textContent).toContain("Updated source text");
      expect(view.container.textContent).not.toContain("Hello <script>document.cookie</script>");
    } finally {
      view.unmount();
    }

    const duplicateRefs: CanvasLayoutSpec = {
      ...spec(),
      root: { id: "root", type: "stack", direction: "vertical", children: [
        { id: "first-copy", type: "text", blockId: "intro" },
        { id: "second-copy", type: "card", blockId: "intro" }
      ] }
    };
    const repeated = mount(createElement(CanvasEditor, { document: documentModel, spec: duplicateRefs }));
    try {
      const occurrences = repeated.container.textContent?.split("Hello <script>document.cookie</script>").length ?? 0;
      expect(occurrences - 1).toBe(2);
    } finally {
      repeated.unmount();
    }
  });

  it("renders grids, columns, frames, overlays, and supported block previews responsively", () => {
    const content = createEditorDocument([
      { id: "copy", type: "paragraph", content: [{ type: "text", text: "Card copy" }] },
      { id: "rule", type: "divider" },
      { id: "action", type: "button", content: [{ type: "text", text: "Open details" }] },
      { id: "chart", type: "chartPlaceholder", props: { title: "Quarterly" } },
      { id: "embed", type: "embed", content: [{ type: "text", text: "Video preview" }] },
      { id: "photo", type: "image", props: { url: "https://example.test/photo.png", alt: "Report photo" } }
    ]);
    const responsiveSpec: CanvasLayoutSpec = {
      template: "landing-page",
      breakpoints: { tablet: 640, desktop: 960 },
      theme: "minimal",
      root: {
        id: "root", type: "stack", direction: "vertical", children: [
          { id: "grid", type: "grid", columns: { mobile: 1, tablet: 2, desktop: 3 }, gap: { mobile: 8, desktop: 24 }, children: [
            { id: "card-copy", type: "card", blockId: "copy" },
            { id: "divider-ref", type: "divider", blockId: "rule" },
            { id: "button-ref", type: "button", blockId: "action" }
          ] },
          { id: "columns", type: "columns", gap: { mobile: 12, desktop: 20 }, columns: [
            [{ id: "chart-ref", type: "chart", blockId: "chart" }],
            [{ id: "embed-ref", type: "embed", blockId: "embed" }]
          ] },
          { id: "frame", type: "frame", children: [{ id: "photo-ref", type: "image", blockId: "photo" }] },
          { id: "overlay", type: "absolute", items: [{
            element: { id: "absolute-action", type: "button", blockId: "action" },
            rect: { mobile: { x: 4, y: 4, width: 40, height: 20 }, desktop: { x: 60, y: 10, width: 30, height: 15 } }
          }] }
        ]
      }
    };
    const viewState: CanvasEditorViewState = {
      selectedNodeId: "grid", hiddenNodeIds: [], lockedNodeIds: [], alignmentByNodeId: {}, breakpoint: "mobile"
    };
    const view = mount(createElement(CanvasEditor, { document: content, spec: responsiveSpec, viewState }));
    try {
      expect(view.container.querySelector(".oe-canvas__grid")?.getAttribute("style")).toContain("repeat(1");
      expect(view.container.querySelector(".oe-canvas__columns")?.getAttribute("style")).toContain("repeat(1");
      expect((view.container.querySelector(".oe-canvas__surface") as HTMLElement).style.maxWidth).toBe("min(390px, 100%)");
      expect(view.container.querySelector('[data-kind="frame"]')).not.toBeNull();
      expect(view.container.querySelector(".oe-canvas__absolute-item")?.getAttribute("style")).toContain("left: 4%");
      expect(view.container.textContent).toContain("Card copy");
      expect(view.container.textContent).toContain("Open details");
      expect(view.container.textContent).toContain("Quarterly preview");
      expect(view.container.textContent).toContain("Video preview");
      expect(view.container.querySelector('img[src="https://example.test/photo.png"]')?.getAttribute("alt")).toBe("Report photo");
      expect(view.container.querySelectorAll("hr").length).toBeGreaterThan(0);
      expect(view.container.querySelector("iframe")).toBeNull();
    } finally {
      view.unmount();
    }
  });

  it("moves positioned Canvas items with captured pointers and keeps inspector controls", () => {
    const fixture = positionedFixture();
    const { view, item, layoutChanges, capturedPointer, render } = fixture;
    try {
      expect(item.hasAttribute("draggable")).toBe(false);
      expect(item.getAttribute("data-draggable")).toBe("true");
      dispatchPointer(item, "pointerdown", 148, 59, 7);
      expect(capturedPointer()).toBe(7);
      dispatchPointer(item, "pointermove", 200, 100, 7);
      expect(item.style.left).toBe("30%");
      expect(item.style.top).toBe("45%");
      expect(layoutChanges).toHaveLength(0);
      dispatchPointer(item, "pointerup", 200, 100, 7);
      expect(layoutChanges).toHaveLength(1);
      const movedSpec = layoutChanges[0]!;
      expect(movedSpec.root.type === "absolute" && movedSpec.root.items[0]?.rect.mobile).toEqual({ x: 30, y: 45, width: 40, height: 20 });
      expect(capturedPointer()).toBeNull();
      view.rerender(render(movedSpec));
      expect(item.style.left).toBe("30%");

      changeInput(view.container, "Position X mobile", "18");
      expect(layoutChanges).toHaveLength(2);
      view.rerender(render(layoutChanges.at(-1)!));
      changeInput(view.container, "Width mobile", "55");
      const resizedSpec = layoutChanges.at(-1)!;
      expect(resizedSpec.root.type === "absolute" && resizedSpec.root.items[0]?.rect.mobile).toEqual({ x: 18, y: 45, width: 55, height: 20 });
      view.rerender(render(resizedSpec));
      expect(item.style.left).toBe("18%");
      expect(item.style.width).toBe("55%");
    } finally {
      view.unmount();
    }
  });

  it("clamps pointer movement to the positioned item bounds", () => {
    const fixture = positionedFixture();
    try {
      dispatchPointer(fixture.item, "pointerdown", 148, 59, 11, 0, "touch");
      dispatchPointer(fixture.item, "pointermove", 500, 400, 11, 0, "touch");
      expect(fixture.item.style.left).toBe("60%");
      expect(fixture.item.style.top).toBe("80%");
      dispatchPointer(fixture.item, "pointerup", 500, 400, 11, 0, "touch");
      const rect = fixture.layoutChanges[0]?.root.type === "absolute" ? fixture.layoutChanges[0].root.items[0]?.rect.mobile : undefined;
      expect(rect).toEqual({ x: 60, y: 80, width: 40, height: 20 });
    } finally {
      fixture.view.unmount();
    }
  });

  it("blocks locked items and clears cancelled pointer drags", () => {
    const locked = positionedFixture(["absolute-action"]);
    try {
      expect(locked.item.getAttribute("data-draggable")).toBeNull();
      dispatchPointer(locked.item, "pointerdown", 148, 59, 12);
      dispatchPointer(locked.item, "pointermove", 200, 100, 12);
      dispatchPointer(locked.item, "pointerup", 200, 100, 12);
      expect(locked.capturedPointer()).toBeNull();
      expect(locked.layoutChanges).toHaveLength(0);
      expect(locked.item.style.left).toBe("4%");
    } finally {
      locked.view.unmount();
    }

    const fixture = positionedFixture();
    let mounted = true;
    try {
      dispatchPointer(fixture.item, "pointerdown", 148, 59, 13);
      dispatchPointer(fixture.item, "pointermove", 200, 100, 13);
      expect(fixture.item.style.left).toBe("30%");
      dispatchPointer(fixture.item, "pointercancel", 200, 100, 13);
      expect(fixture.item.style.left).toBe("4%");
      expect(fixture.capturedPointer()).toBeNull();
      expect(fixture.layoutChanges).toHaveLength(0);

      dispatchPointer(fixture.item, "pointerdown", 148, 59, 14, 0, "pen");
      expect(fixture.capturedPointer()).toBe(14);
      fixture.view.unmount();
      mounted = false;
      expect(fixture.capturedPointer()).toBeNull();
    } finally {
      if (mounted) fixture.view.unmount();
    }
  });

  it("exposes selected and locked inspector states with reduced-motion feedback", () => {
    const fixture = positionedFixture(["absolute-action"]);
    try {
      const selected = fixture.view.container.querySelector<HTMLElement>('[data-canvas-node-id="absolute-action"]');
      const lockedToggle = Array.from(fixture.view.container.querySelectorAll(".oe-canvas__actions button")).find((button) => button.textContent?.trim() === "Locked");
      const selectedLayer = fixture.view.container.querySelector(".oe-canvas__layers button[aria-pressed=true]");
      const css = fixture.view.container.querySelector("style")?.textContent ?? "";
      expect(selected?.getAttribute("aria-selected")).toBe("true");
      expect(selected?.getAttribute("data-locked")).toBe("true");
      expect(lockedToggle?.getAttribute("aria-pressed")).toBe("true");
      expect(lockedToggle?.textContent?.trim()).toBe("Locked");
      expect(selectedLayer).not.toBeNull();
      expect(css).toContain(".oe-canvas__alignments button[aria-pressed=true]");
      expect(css).toContain(".oe-canvas__actions button[aria-pressed=true]");
      expect(css).toContain(".oe-canvas__layers button[aria-pressed=true]");
      expect(css).toContain("@media(prefers-reduced-motion:reduce)");
      expect(css).toContain("--oe-ui-motion-shift-small:0px");
      expect(css).toContain("--oe-ui-motion-scale-subtle:1");
    } finally {
      fixture.view.unmount();
    }
  });

  it("supports keyboard selection and movement through the preview", () => {
    const view = mount(createElement(CanvasEditor, { document: documentModel, spec: spec() }));
    try {
      const tree = view.container.querySelector<HTMLElement>("[role=tree]");
      const root = view.container.querySelector<HTMLElement>('[data-canvas-node-id="root"]');
      const section = view.container.querySelector<HTMLElement>('[data-canvas-node-id="section"]');
      const intro = view.container.querySelector<HTMLElement>('[data-canvas-node-id="intro-ref"]');
      expect(tree?.querySelector("[role=button]")).toBeNull();
      expect(root?.getAttribute("role")).toBe("treeitem");
      expect(root?.getAttribute("aria-level")).toBe("1");
      expect(Array.from(root?.children ?? []).some((child) => child.getAttribute("role") === "group")).toBe(true);
      expect(section?.getAttribute("role")).toBe("treeitem");
      expect(section?.getAttribute("aria-level")).toBe("2");
      expect(root?.tabIndex).toBe(0);
      expect(section?.tabIndex).toBe(-1);
      if (!root || !section || !intro) throw new Error("Missing preview node");

      root.focus();
      pressKey(root, "ArrowDown");
      expect(section.getAttribute("data-selected")).toBe("true");
      expect(section.getAttribute("aria-selected")).toBe("true");
      expect(section.tabIndex).toBe(0);
      expect(document.activeElement).toBe(section);

      pressKey(section, "ArrowDown");
      expect(intro.getAttribute("data-selected")).toBe("true");
      pressKey(intro, " ");
      expect(intro.getAttribute("aria-selected")).toBe("true");
    } finally {
      view.unmount();
    }
  });

  it("provides touch-friendly non-drag layout actions and keeps document data unchanged", () => {
    const documentBefore = JSON.stringify(documentModel);
    const view = mount(createElement(CanvasEditor, { document: documentModel, spec: spec() }));
    try {
      click(view.container, '[aria-label="Select text · ending · ending-ref"]');
      clickButton(view.container, "Align center");
      click(view.container, 'button[aria-label="Select text · ending · ending-ref"]');
      clickButton(view.container, "Duplicate");
      expect(view.container.querySelectorAll('.oe-canvas__element').length).toBe(5);

      click(view.container, 'button[aria-label="Select text · ending · ending-ref"]');
      const hiddenToggle = () => Array.from(view.container.querySelectorAll(".oe-canvas__actions button")).find((button) => button.textContent?.trim() === "Hidden");
      expect(hiddenToggle()?.getAttribute("aria-pressed")).toBe("false");
      clickButton(view.container, "Hidden");
      expect(hiddenToggle()?.getAttribute("aria-pressed")).toBe("true");
      expect(view.container.querySelector('[data-canvas-node-id="ending-ref"]')).toBeNull();
      click(view.container, 'button[aria-label="Select text · ending · ending-ref, hidden"]');
      clickButton(view.container, "Hidden");
      expect(hiddenToggle()?.getAttribute("aria-pressed")).toBe("false");
      expect(view.container.querySelector('[data-canvas-node-id="ending-ref"]')).not.toBeNull();

      click(view.container, 'button[aria-label="Select text · ending · ending-ref"]');
      const lockedToggle = () => Array.from(view.container.querySelectorAll(".oe-canvas__actions button")).find((button) => button.textContent?.trim() === "Locked");
      expect(lockedToggle()?.getAttribute("aria-pressed")).toBe("false");
      clickButton(view.container, "Locked");
      expect(lockedToggle()?.getAttribute("aria-pressed")).toBe("true");
      expect(Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Move up")?.hasAttribute("disabled")).toBe(true);
      clickButton(view.container, "Locked");
      expect(lockedToggle()?.getAttribute("aria-pressed")).toBe("false");
      changeSelect(view.container, "Canvas theme", "modern");
      changeSelect(view.container, "Canvas preview size", "mobile");
      expect(view.container.querySelector('[aria-label="Canvas preview"]')?.getAttribute("data-breakpoint")).toBe("mobile");
      expect(view.container.querySelector("[draggable=true]")).toBeNull();
      expect(JSON.stringify(documentModel)).toBe(documentBefore);
    } finally {
      view.unmount();
    }
  });

  it("sends host-owned state and layout changes through callbacks", () => {
    const initialView: CanvasEditorViewState = {
      selectedNodeId: "ending-ref",
      hiddenNodeIds: [],
      lockedNodeIds: [],
      alignmentByNodeId: {},
      breakpoint: "tablet"
    };
    const stateChanges: CanvasEditorViewState[] = [];
    const layoutChanges: CanvasLayoutSpec[] = [];
    const themeChanges: string[] = [];
    const view = mount(createElement(CanvasEditor, {
      document: documentModel,
      spec: spec(),
      viewState: initialView,
      onViewStateChange: (state) => stateChanges.push(state),
      onLayoutChange: (next) => layoutChanges.push(next),
      onThemeChange: (theme) => themeChanges.push(typeof theme === "string" ? theme : "custom")
    }));
    try {
      clickButton(view.container, "Align center");
      expect(stateChanges.at(-1)?.alignmentByNodeId["ending-ref"]).toBe("center");
      clickButton(view.container, "Duplicate");
      const changedSpec = layoutChanges.at(-1);
      expect(changedSpec?.root.type).toBe("stack");
      expect(changedSpec?.root.type === "stack" && changedSpec.root.children.some(({ id }) => id === "ending-ref:copy:1")).toBe(true);
      changeSelect(view.container, "Canvas theme", "modern");
      expect(themeChanges).toEqual(["modern"]);
      changeInput(view.container, "Gap tablet", "24");
      const spaced = layoutChanges.at(-1);
      expect(spaced?.root.type).toBe("stack");
      expect(spaced?.root.type === "stack" ? spaced.root.gap : undefined).toEqual({ mobile: 12, tablet: 24, desktop: 32 });
      expect(JSON.stringify(documentModel)).toBe(JSON.stringify(createEditorDocument(documentModel.blocks)));
    } finally {
      view.unmount();
    }
  });

  it("keeps descendants locked until their locked container is unlocked", () => {
    const viewState: CanvasEditorViewState = {
      selectedNodeId: "intro-ref",
      hiddenNodeIds: [],
      lockedNodeIds: ["section"],
      alignmentByNodeId: {},
      breakpoint: "desktop"
    };
    const view = mount(createElement(CanvasEditor, { document: documentModel, spec: spec(), viewState }));
    try {
      const actions = Array.from(view.container.querySelectorAll("button"));
      expect(actions.find((button) => button.textContent?.trim() === "Move up")?.disabled).toBe(true);
      const parentLock = actions.find((button) => button.textContent?.trim() === "Locked by parent");
      expect(parentLock?.disabled).toBe(true);
      expect(parentLock?.getAttribute("aria-pressed")).toBeNull();
      expect(view.container.querySelector('[data-canvas-node-id="intro-ref"]')?.getAttribute("data-locked")).toBe("true");
    } finally {
      view.unmount();
    }
  });
});
