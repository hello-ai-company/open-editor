/** @vitest-environment jsdom */
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { SharedDatabaseViewShell } from "../src/workspace/databaseView.js";
import { createDatabaseRuntimeStore } from "../src/workspace/databaseRuntimeStore.js";
import { NotesRevisionedTable } from "../src/workspace/notesTableView.js";
import { createNotesTableEditingRegistry, type NotesTableEditingRegistry } from "../src/notes/tableEditing.js";
import { fixtureBinding, fixtureTarget, tableFixture } from "./notes-table-fixture.js";

let container: HTMLDivElement, root: ReturnType<typeof createRoot>;
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT; });
const type = (input: HTMLInputElement, value: string) => act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
const click = async (label: string) => { const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === label || b.getAttribute("aria-label") === label); expect(button, label).toBeDefined(); await act(async () => button!.click()); };
const edit = () => container.querySelector<HTMLInputElement>('[aria-label="Edit Amount"]')!;
async function mount(registry: NotesTableEditingRegistry) { await act(async () => root.render(<StrictMode><NotesRevisionedTable registry={registry} binding={fixtureBinding()} blockId="db-block" fallback={<p>Read-only fallback</p>} /></StrictMode>)); }
describe("actual table body controls", () => {
  it("edits in the table cell, keeps input on Close/ESC, and double-save names only one property", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host); await mount(registry);
    await click("Edit Amount in Visible"); expect(edit().closest("td")).not.toBeNull(); type(edit(), "15"); await click("Close");
    expect(edit()).toBeNull(); expect(await registry.beforeLeave(fixtureTarget, new AbortController().signal)).toBe(false); await click("Resume input"); expect(edit().value).toBe("15");
    act(() => edit().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))); expect(edit()).toBeNull(); await click("Resume input");
    const save = [...container.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === "Save")!; await act(async () => { save.click(); save.click(); });
    expect(f.commit).toHaveBeenCalledTimes(1); expect(f.rows.get("visible")!.values.number).toBe(15); expect(container.textContent).not.toContain("Table input retained"); registry.dispose();
  });
  it("creates a row inside tbody from entered values, and cancellation never discards raw input", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host); await mount(registry); await click("New row");
    expect(container.querySelector('[data-table-new-row="1"]')?.closest("tbody")).not.toBeNull(); type(container.querySelector<HTMLInputElement>('[aria-label="Edit Title"]')!, "New"); type(edit(), "3x"); await click("Save");
    expect(f.commit).not.toHaveBeenCalled(); await click("Discard input…"); await click("Cancel"); expect(edit().value).toBe("3x");
    await click("Discard input…"); await click("Discard input"); expect(container.querySelector('[data-table-new-row="1"]')).toBeNull(); expect(f.commit).not.toHaveBeenCalled(); registry.dispose();
  });
  it("journals IME text before parse, ignores Cmd+Enter during composition, and restores after forced unmount", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host); await mount(registry); await click("Edit Amount in Visible");
    act(() => edit().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))); type(edit(), "途中12x");
    expect(edit().disabled).toBe(false);
    act(() => edit().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, isComposing: true, bubbles: true }))); expect(f.commit).not.toHaveBeenCalled();
    await act(async () => { expect(await registry.beforeLeave(fixtureTarget, new AbortController().signal)).toBe(false); });
    await act(async () => root.render(null)); expect([...f.stored.values()][0]?.rawInput).toBe("途中12x"); await mount(registry); expect(edit().value).toBe("途中12x"); expect(f.commit).not.toHaveBeenCalled(); registry.dispose();
  });
  it("renders unsupported values read-only and uses the old table when no port is authorized", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host); await mount(registry);
    const future = container.querySelector<HTMLButtonElement>('[aria-label="Edit Future in Visible"]')!; expect(future.disabled).toBe(true); expect(future.textContent).toContain("retain"); expect(container.querySelector<HTMLButtonElement>('[aria-label="Edit Computed in Visible"]')!.disabled).toBe(true);
    const other = createNotesTableEditingRegistry({ ...f.host, resolvePort: async () => undefined }); await mount(other); expect(container.textContent).toBe("Read-only fallback"); expect(f.commit).not.toHaveBeenCalled(); registry.dispose(); other.dispose();
  });
  it("mounts in SharedDatabaseViewShell and blocks query/sort/view changes while retaining cell input", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host), store = createDatabaseRuntimeStore(); store.ensureView("v", "db"); const changed = vi.fn();
    const render = () => root.render(<SharedDatabaseViewShell snap={{ ...store.getView("v"), status: "ready" }} store={store} viewKey="v" blockId="db-block" viewId="main" viewType="table" titleHint="DB" runtime={{ store, tableEditing: { registry, source: () => ({ scope: f.host.scope, parentTarget: fixtureTarget }) } }} onViewChange={changed} />);
    await act(async () => render()); expect(container.querySelector(".oe-database-view [data-notes-table-editing]")).not.toBeNull(); await click("Edit Amount in Visible"); type(edit(), "keep");
    const sort = container.querySelector<HTMLSelectElement>('select[aria-label="Sort"]') ?? container.querySelector<HTMLSelectElement>('label select');
    await act(async () => { sort!.value = "title:desc"; sort!.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(store.getView("v").queryState.sortBy).toBe("position"); expect(edit().value).toBe("keep"); expect(f.commit).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled(); registry.dispose();
  });
  it("a late connection cannot mount into another binding", async () => {
    const f = tableFixture(), original = f.host.resolvePort; let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    f.host.resolvePort = async binding => { if (binding.viewId === "old") await gate; return original(binding); }; const registry = createNotesTableEditingRegistry(f.host);
    await act(async () => root.render(<NotesRevisionedTable registry={registry} binding={fixtureBinding("", "old")} blockId="db-block" fallback={<p>Old</p>} />));
    await act(async () => root.render(<NotesRevisionedTable registry={registry} binding={fixtureBinding("", "new")} blockId="db-block" fallback={<p>New</p>} />));
    await act(async () => release()); await click("Edit Amount in Visible"); const current = (await registry.connect(fixtureBinding("", "new")))!; expect(current.getState().drafts).toHaveLength(1); expect((await registry.connect(fixtureBinding("", "old")))!.getState().drafts).toHaveLength(0); registry.dispose();
  });

  it("captures the final composing value even without an extra input event", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host); await mount(registry); await click("Edit Amount in Visible");
    act(() => edit().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
    expect(edit().disabled).toBe(false);
    const controller = (await registry.connect(fixtureBinding()))!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(edit(), "未確定の12x"); edit().dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })); await controller.persistInput(); });
    expect(controller.getState().drafts[0]?.rawInput).toBe("未確定の12x"); expect([...f.stored.values()][0]?.rawInput).toBe("未確定の12x"); expect(f.commit).not.toHaveBeenCalled(); registry.dispose();
  });

  it("keeps the raw field editable after storage failure and retries before submitting", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host); await mount(registry); await click("Edit Amount in Visible");
    f.faults.journal = true; type(edit(), "31x"); const controller = (await registry.connect(fixtureBinding()))!;
    await act(async () => { await controller.persistInput().catch(() => {}); }); expect(edit().disabled).toBe(false);
    type(edit(), "31"); await act(async () => { await controller.persistInput().catch(() => {}); });
    expect(controller.getState().drafts[0]?.rawInput).toBe("31"); expect(f.commit).not.toHaveBeenCalled();
    f.faults.journal = false; await click("Retry input storage"); expect([...f.stored.values()][0]?.rawInput).toBe("31"); await click("Save"); expect(f.rows.get("visible")!.values.number).toBe(31); registry.dispose();
  });

  it("hydrates an old-query input for review without changing current settings or auto-sending", async () => {
    const f = tableFixture(), first = createNotesTableEditingRegistry(f.host), old = (await first.connect(fixtureBinding("Visible", "old-view")))!;
    await old.beginCell("visible", "number"); old.setRaw("12x"); await old.persistInput(); first.dispose();
    const registry = createNotesTableEditingRegistry(f.host); await mount(registry);
    expect(edit()).toBeNull(); expect(container.textContent).toContain("Input retained in another view");
    await click("Review retained input"); expect(edit().value).toBe("12x"); expect(container.textContent).toContain("Current view settings are unchanged"); expect(f.commit).not.toHaveBeenCalled();
    await click("Save"); expect(edit().value).toBe("12x"); expect(f.commit).not.toHaveBeenCalled();
    await click("Discard input…"); await click("Discard input"); await click("Return to current view"); expect(edit()).toBeNull(); registry.dispose();
  });

  it("keeps the composing surface enabled and its same-binding peer read-only", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host);
    await act(async () => root.render(<><NotesRevisionedTable registry={registry} binding={fixtureBinding()} blockId="first" fallback={<p>Fallback</p>} /><NotesRevisionedTable registry={registry} binding={fixtureBinding()} blockId="second" fallback={<p>Fallback</p>} /></>));
    await click("Edit Amount in Visible");
    const inputs = [...container.querySelectorAll<HTMLInputElement>('[aria-label="Edit Amount"]')]; expect(inputs).toHaveLength(2);
    act(() => inputs[0]!.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
    expect(inputs[0]!.disabled).toBe(false); expect(inputs[1]!.disabled).toBe(true);
    const controller = (await registry.connect(fixtureBinding()))!;
    expect(() => controller.setRaw("peer overwrite", "another surface")).toThrow("another table surface");
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(inputs[0], "編集中12x"); inputs[0]!.dispatchEvent(new Event("input", { bubbles: true })); await controller.persistInput(); });
    expect(controller.getState().drafts[0]?.rawInput).toBe("編集中12x"); expect(f.commit).not.toHaveBeenCalled();
    await act(async () => { inputs[0]!.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })); await controller.persistInput(); });
    expect(inputs[1]!.disabled).toBe(false); registry.dispose();
  });
});
