/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { EditorDatabase } from "@hello-ai-company/editor-core";
import { DatabaseViewControls } from "../src/workspace/databaseView.js";
import { SharedDatabaseViewShell } from "../src/workspace/databaseView.js";
import { createDatabaseRuntimeStore } from "../src/workspace/databaseRuntimeStore.js";
import type { DatabaseViewPick } from "../src/react/databaseViewPicker.js";
import type { DatabaseViewConfig, DatabaseViewConfigProvider } from "../src/workspace/databaseViewConfig.js";

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

function durableViewProvider() {
  const saved = new Map<string, DatabaseViewConfig>();
  const key = (databaseId: string, viewId: string) => JSON.stringify([databaseId, viewId]);
  const provider: DatabaseViewConfigProvider = {
    async save(config) { saved.set(key(config.databaseId, config.viewId), config); },
    async list(databaseId) {
      return [...saved.values()].filter((config) => config.databaseId === databaseId)
        .map(({ databaseId: id, viewId, viewType }) => ({ databaseId: id, viewId, viewType }));
    }
  };
  return { provider, saved };
}

describe("DatabaseViewControls", () => {
  it("keeps hydration failure visible and exposes an explicit retry action", () => {
    const previousFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const store = createDatabaseRuntimeStore();
    store.ensureView("tasks-view", "tasks");
    const onRetry = vi.fn();
    const { container, cleanup } = mount(createElement(SharedDatabaseViewShell, {
      snap: store.getView("tasks-view"),
      store,
      viewKey: "tasks-view",
      viewId: "main",
      viewType: "table",
      titleHint: "Tasks",
      runtime: { store },
      configWarning: "Saved view settings could not be loaded. Changes are local until a retry succeeds.",
      canRetryConfigLoad: true,
      onRetryConfigLoad: onRetry
    }));
    expect(container.textContent).toContain("Changes are local");
    const retry = [...container.querySelectorAll("button")].find((button) => button.textContent === "Retry load")!;
    act(() => retry.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
    cleanup();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousFlag;
  });

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
    const { provider } = durableViewProvider();
    const { container, cleanup } = mount(createElement(DatabaseViewControls, {
      database,
      databaseId: "tasks",
      title: "Tasks",
      viewId: "main-table",
      viewType: "table",
      views: [{ databaseId: "tasks", viewId: "main-table", viewType: "table", titleHint: "Table", label: "Table" }],
      canChange: true,
      viewConfigProvider: provider,
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

  it("registers a new view before changing its identity", async () => {
    const previousFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onChange = vi.fn<(selection: DatabaseViewPick) => void>();
    const { provider, saved } = durableViewProvider();
    const { container, root, cleanup } = mount(createElement(DatabaseViewControls, {
      database,
      databaseId: "tasks",
      title: "Tasks",
      viewId: "main-table",
      viewType: "table",
      views: [{ databaseId: "tasks", viewId: "main-table", viewType: "table", titleHint: "Table", label: "Table" }],
      canChange: true,
      viewConfigProvider: provider,
      onChange
    }));
    const addButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "+ View")!;
    act(() => addButton.click());
    const viewType = container.querySelector<HTMLSelectElement>('select[aria-label="View type"]')!;
    viewType.value = "chart";
    act(() => viewType.dispatchEvent(new Event("change", { bubbles: true })));
    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.requestSubmit();
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toMatchObject({ databaseId: "tasks", viewType: "chart" });
    expect(onChange.mock.calls[0]?.[0].viewId).toMatch(/^view-/);
    expect(saved.has(JSON.stringify(["tasks", onChange.mock.calls[0]![0].viewId]))).toBe(true);
    const chart = onChange.mock.calls[0]![0];
    const discoveredViews = [
      ...database.views!.map(({ id, title, viewType }) => ({
        databaseId: "tasks", viewId: id, viewType: viewType as DatabaseViewPick["viewType"], titleHint: title ?? id, label: title ?? id
      })),
      ...[...saved.values()].map(({ databaseId, viewId, viewType }) => ({
        databaseId, viewId, viewType, titleHint: viewType, label: viewType
      }))
    ];
    const renderAt = (viewId: string, viewType: string) => act(() => root.render(createElement(DatabaseViewControls, {
      database,
      databaseId: "tasks",
      title: "Tasks",
      viewId,
      viewType,
      views: discoveredViews,
      canChange: true,
      viewConfigProvider: provider,
      onChange
    })));
    renderAt(chart.viewId, chart.viewType);
    const selector = container.querySelector<HTMLSelectElement>('select[aria-label="Database view"]')!;
    expect([...selector.options].some((option) => option.value === JSON.stringify(["tasks", chart.viewId]))).toBe(true);
    selector.value = JSON.stringify(["tasks", "main-table"]);
    act(() => selector.dispatchEvent(new Event("change", { bubbles: true })));
    renderAt("main-table", "table");
    expect([...container.querySelector<HTMLSelectElement>('select[aria-label="Database view"]')!.options]
      .some((option) => option.value === JSON.stringify(["tasks", chart.viewId]))).toBe(true);
    const afterReturn = container.querySelector<HTMLSelectElement>('select[aria-label="Database view"]')!;
    afterReturn.value = JSON.stringify(["tasks", chart.viewId]);
    act(() => afterReturn.dispatchEvent(new Event("change", { bubbles: true })));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ viewId: chart.viewId, viewType: "chart" }));
    cleanup();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousFlag;
  });

  it("disables + View without durable provider support but keeps host switching available", () => {
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
        { databaseId: "tasks", viewId: "main-board", viewType: "board", titleHint: "Board", label: "Board" }
      ],
      canChange: true,
      onChange
    }));
    expect([...container.querySelectorAll("button")].find((button) => button.textContent === "+ View")?.disabled).toBe(true);
    expect(container.textContent).toContain("cannot save and rediscover views");
    const selector = container.querySelector<HTMLSelectElement>('select[aria-label="Database view"]')!;
    selector.value = JSON.stringify(["tasks", "main-board"]);
    act(() => selector.dispatchEvent(new Event("change", { bubbles: true })));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ viewId: "main-board" }));
    cleanup();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousFlag;
  });

  it("disables + View for a save-only provider", () => {
    const previousFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { container, cleanup } = mount(createElement(DatabaseViewControls, {
      database,
      databaseId: "tasks",
      title: "Tasks",
      viewId: "main-table",
      viewType: "table",
      views: [{ databaseId: "tasks", viewId: "main-table", viewType: "table", titleHint: "Table", label: "Table" }],
      canChange: true,
      viewConfigProvider: { async save() {} }
    }));
    expect([...container.querySelectorAll("button")].find((button) => button.textContent === "+ View")?.disabled).toBe(true);
    cleanup();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousFlag;
  });

  it("keeps failed registration pending and retries the same durable identity", async () => {
    const previousFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onChange = vi.fn();
    const saved = new Map<string, DatabaseViewConfig>();
    const attempts: string[] = [];
    const provider: DatabaseViewConfigProvider = {
      async list(databaseId) {
        return [...saved.values()].filter((config) => config.databaseId === databaseId)
          .map(({ databaseId: id, viewId, viewType }) => ({ databaseId: id, viewId, viewType }));
      },
      async save(config) {
        attempts.push(config.viewId);
        if (attempts.length === 1) throw new Error("host unavailable");
        saved.set(JSON.stringify([config.databaseId, config.viewId]), config);
      }
    };
    const { container, cleanup } = mount(createElement(DatabaseViewControls, {
      database,
      databaseId: "tasks",
      title: "Tasks",
      viewId: "main-table",
      viewType: "table",
      views: [{ databaseId: "tasks", viewId: "main-table", viewType: "table", titleHint: "Table", label: "Table" }],
      canChange: true,
      viewConfigProvider: provider,
      onChange
    }));
    act(() => [...container.querySelectorAll("button")].find((button) => button.textContent === "+ View")!.click());
    const type = container.querySelector<HTMLSelectElement>('select[aria-label="View type"]')!;
    type.value = "chart";
    act(() => type.dispatchEvent(new Event("change", { bubbles: true })));
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await vi.waitFor(() => expect(container.textContent).toContain("not saved yet"));
    const pendingId = attempts[0];
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    const retry = [...container.querySelectorAll("button")].find((button) => button.textContent === "Retry registration")!;
    await act(async () => { retry.click(); });
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(attempts).toEqual([pendingId, pendingId]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ viewId: pendingId, viewType: "chart" }));
    cleanup();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousFlag;
  });
});
