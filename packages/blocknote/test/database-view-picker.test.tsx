/** @vitest-environment jsdom */
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { EditorDatabase } from "@hello-ai-company/editor-core";
import { DatabaseViewPicker, type DatabaseViewPick } from "../src/react/databaseViewPicker.js";

const databases: EditorDatabase[] = [
  {
    id: "tasks",
    title: "Tasks",
    views: [{ id: "main-board", title: "Board", viewType: "board" }]
  },
  { id: "notes", title: "Notes" }
];

function Harness(props: {
  onPick: (selection: DatabaseViewPick | null) => void;
  initialDatabaseId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-testid="opener" onClick={() => setOpen(true)}>Open</button>
      <DatabaseViewPicker
        open={open}
        databases={databases}
        initialDatabaseId={props.initialDatabaseId}
        onPick={(selection) => {
          props.onPick(selection);
          setOpen(false);
        }}
      />
    </>
  );
}

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

function changeValue(select: HTMLSelectElement, value: string) {
  select.value = value;
  act(() => select.dispatchEvent(new Event("change", { bubbles: true })));
}

describe("DatabaseViewPicker", () => {
  it("uses only host database identities and inserts a selected built-in view type", () => {
    const priorActFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onPick = vi.fn();
    const { container, cleanup } = mount(createElement(Harness, { onPick, initialDatabaseId: "tasks" }));

    const opener = container.querySelector('[data-testid="opener"]') as HTMLButtonElement;
    opener.focus();
    act(() => opener.click());
    const database = container.querySelector('select[aria-label="Database"]') as HTMLSelectElement;
    const view = container.querySelector('select[aria-label="View"]') as HTMLSelectElement;
    const type = container.querySelector('select[aria-label="View type"]') as HTMLSelectElement;
    expect(document.activeElement).toBe(database);
    expect([...type.options].map((option) => option.value)).toEqual([
      "table", "board", "calendar", "list", "gallery", "timeline", "gantt", "chart", "feed", "map", "dashboard"
    ]);

    changeValue(database, "notes");
    expect(view.value).toBe("new");
    changeValue(type, "timeline");
    const insert = [...container.querySelectorAll("button")].find((button) => button.textContent === "Insert")!;
    act(() => insert.click());

    expect(onPick).toHaveBeenCalledTimes(1);
    const selection = onPick.mock.calls[0]?.[0] as DatabaseViewPick;
    expect(selection).toMatchObject({ databaseId: "notes", viewType: "timeline", titleHint: "Notes · Timeline" });
    expect(selection.viewId).toMatch(/^view-/);
    expect(document.activeElement).toBe(opener);
    cleanup();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = priorActFlag;
  });

  it("returns existing host view IDs without inventing a new view identity", () => {
    const priorActFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onPick = vi.fn();
    const { container, cleanup } = mount(createElement(Harness, { onPick, initialDatabaseId: "tasks" }));
    const opener = container.querySelector('[data-testid="opener"]') as HTMLButtonElement;
    opener.focus();
    act(() => opener.click());
    const view = container.querySelector('select[aria-label="View"]') as HTMLSelectElement;
    changeValue(view, "main-board");
    const insert = [...container.querySelectorAll("button")].find((button) => button.textContent === "Insert")!;
    act(() => insert.click());
    expect(onPick).toHaveBeenLastCalledWith({
      databaseId: "tasks",
      viewId: "main-board",
      viewType: "board",
      titleHint: "Board"
    });

    expect(document.activeElement).toBe(opener);
    cleanup();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = priorActFlag;
  });

  it("cancels on Escape and restores focus to the opener", () => {
    const priorActFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onPick = vi.fn();
    const { container, cleanup } = mount(createElement(Harness, { onPick, initialDatabaseId: "tasks" }));
    const opener = container.querySelector('[data-testid="opener"]') as HTMLButtonElement;
    opener.focus();
    act(() => opener.click());
    const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement;
    act(() => dialog.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape", bubbles: true, cancelable: true
    })));
    expect(onPick).toHaveBeenCalledWith(null);
    expect(document.activeElement).toBe(opener);
    cleanup();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = priorActFlag;
  });

  it("does not fall back to a different database when a fixed host ID is unavailable", () => {
    const priorActFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onPick = vi.fn();
    const { container, cleanup } = mount(createElement(DatabaseViewPicker, {
      open: true,
      databases,
      fixedDatabaseId: "private-db-not-listed",
      allowExistingViews: false,
      onPick
    }));
    expect(container.textContent).toContain("No databases are available from the host.");
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    cleanup();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = priorActFlag;
  });

  it("keeps keyboard focus on the persistent cancel action as host databases load", () => {
    const priorActFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onPick = vi.fn();
    const { container, root, cleanup } = mount(createElement(DatabaseViewPicker, {
      open: true,
      databases: [],
      loading: true,
      onPick
    }));
    const cancel = container.querySelector<HTMLButtonElement>('button[type="button"]')!;
    expect(document.activeElement).toBe(cancel);
    act(() => root.render(createElement(DatabaseViewPicker, {
      open: true,
      databases,
      loading: false,
      onPick
    })));
    expect(container.querySelector('button[type="button"]')).toBe(cancel);
    expect(document.activeElement).toBe(cancel);
    cleanup();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = priorActFlag;
  });

  it("disables malformed saved views and still allows a safe new view", () => {
    const priorActFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onPick = vi.fn();
    const malformed = [{
      id: "tasks",
      title: "Tasks",
      views: [{ id: "legacy", title: { untrusted: true }, viewType: "future-view" }]
    }] as unknown as EditorDatabase[];
    const { container, cleanup } = mount(createElement(DatabaseViewPicker, {
      open: true,
      databases: malformed,
      onPick
    }));

    const view = container.querySelector('select[aria-label="View"]') as HTMLSelectElement;
    expect(view.querySelector<HTMLOptionElement>('option[value="legacy"]')?.disabled).toBe(true);
    changeValue(view, "legacy");
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    changeValue(view, "new");
    changeValue(container.querySelector('select[aria-label="View type"]') as HTMLSelectElement, "chart");
    const form = container.querySelector("form") as HTMLFormElement;
    act(() => form.requestSubmit());

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ databaseId: "tasks", viewType: "chart" }));
    cleanup();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = priorActFlag;
  });
});
