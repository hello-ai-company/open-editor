/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { EditorDatabase } from "@hello-ai-company/editor-core";
import { DatabaseViewControls } from "../src/workspace/databaseView.js";
import type { DatabaseViewPick } from "../src/react/databaseViewPicker.js";

const database: EditorDatabase = {
  id: "tasks",
  title: "Tasks",
  views: [
    { id: "main-table", title: "Table", viewType: "table" },
    { id: "main-board", title: "Board", viewType: "board" },
    { id: "main-calendar", title: "Calendar", viewType: "calendar" }
  ]
};

function mount(ui: ReturnType<typeof createElement>) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  return {
    container,
    root,
    cleanup() {
      act(() => root.unmount());
      container.remove();
    }
  };
}

describe("DatabaseViewControls", () => {
  it("switches view identity for the same database without issuing row mutations", () => {
    const previousFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onChange = vi.fn();
    const { container, cleanup } = mount(createElement(DatabaseViewControls, {
      database,
      databaseId: "tasks",
      title: "Tasks",
      viewId: "main-table",
      viewType: "table",
      views: [
        { databaseId: "tasks", viewId: "main-table", viewType: "table", titleHint: "Table", label: "Table" },
        { databaseId: "tasks", viewId: "main-board", viewType: "board", titleHint: "Board", label: "Board" },
        { databaseId: "tasks", viewId: "main-calendar", viewType: "calendar", titleHint: "Calendar", label: "Calendar" }
      ],
      canChange: true,
      onChange
    }));

    const selector = container.querySelector<HTMLSelectElement>('select[aria-label="Database view"]')!;
    expect(selector.value).toBe(JSON.stringify(["tasks", "main-table"]));
    selector.value = JSON.stringify(["tasks", "main-board"]);
    act(() => selector.dispatchEvent(new Event("change", { bubbles: true })));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      databaseId: "tasks",
      viewId: "main-board",
      viewType: "board"
    } satisfies Partial<DatabaseViewPick>));
    cleanup();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousFlag;
  });

  it("adds a new view for the fixed host database and restores focus on cancel", () => {
    const previousFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onChange = vi.fn();
    const { container, cleanup } = mount(createElement(DatabaseViewControls, {
      database,
      databaseId: "tasks",
      title: "Tasks",
      viewId: "main-table",
      viewType: "table",
      views: [{ databaseId: "tasks", viewId: "main-table", viewType: "table", titleHint: "Table", label: "Table" }],
      canChange: true,
      onChange
    }));
    const addButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "+ View")!;
    addButton.focus();
    act(() => addButton.click());
    const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement;
    expect(document.activeElement).toBe(container.querySelector('select[aria-label="View type"]'));
    expect(container.querySelector(".oe-database-picker__database-name")?.textContent).toBe("Tasks");

    act(() => dialog.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape", bubbles: true, cancelable: true
    })));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(addButton);
    cleanup();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousFlag;
  });

  it("creates a new view ID and keeps the selected host database identity", () => {
    const previousFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onChange = vi.fn<(selection: DatabaseViewPick) => void>();
    const { container, cleanup } = mount(createElement(DatabaseViewControls, {
      database,
      databaseId: "tasks",
      title: "Tasks",
      viewId: "main-table",
      viewType: "table",
      views: [{ databaseId: "tasks", viewId: "main-table", viewType: "table", titleHint: "Table", label: "Table" }],
      canChange: true,
      onChange
    }));
    const addButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "+ View")!;
    act(() => addButton.click());
    const viewType = container.querySelector<HTMLSelectElement>('select[aria-label="View type"]')!;
    viewType.value = "chart";
    act(() => viewType.dispatchEvent(new Event("change", { bubbles: true })));
    const form = container.querySelector("form") as HTMLFormElement;
    act(() => form.requestSubmit());

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toMatchObject({ databaseId: "tasks", viewType: "chart" });
    expect(onChange.mock.calls[0]?.[0].viewId).toMatch(/^view-/);
    cleanup();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousFlag;
  });
});
