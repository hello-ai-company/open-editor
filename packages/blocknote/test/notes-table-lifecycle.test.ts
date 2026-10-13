/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createNotesTableEditingRegistry } from "../src/notes/tableEditing.js";
import { createOpenEditorNotesPreset } from "../src/notes/preset.js";
import { createNotesTabbedWorkspaceSession } from "../src/react/NotesTabbedWorkspace.js";
import type { NotesWorkspaceHost } from "../src/notes/contracts.js";
import { fixtureBinding, fixtureScope, fixtureTarget, tableFixture } from "./notes-table-fixture.js";
const signal = () => new AbortController().signal;
const gate = () => { let release!: () => void; const promise = new Promise<void>(r => { release = r; }); return { promise, release }; };
function bodyHost(): NotesWorkspaceHost {
  return { scope: fixtureScope, readDocument: async target => ({ scope: fixtureScope, target, revision: "body-r1", contentRevision: "body-c1", document: createEditorDocument([{ id: "body", type: "paragraph", content: "Protected synthetic body" }]), title: "Synthetic table parent", metadata: {}, capabilities: [], capabilitySemantics: {} }), beforeSubmit: async () => {}, commit: async request => ({ status: "denied", target: request.target, operationId: request.operationId }), lookupOperation: async (target, operationId) => ({ status: "not-found", target, operationId, terminal: true }) };
}

describe("table owner and enclosing navigation fences", () => {
  it("rejects a rows page for another query and preserves the existing page and raw input", async () => {
    const f = tableFixture(), resolve = f.host.resolvePort;
    let foreign = false;
    f.host.resolvePort = async binding => { const port = (await resolve(binding))!; return { ...port, rows: async (cursor, abort) => { const rows = await port.rows(cursor, abort); return foreign ? { ...rows, binding: fixtureBinding("another query") } : rows; } }; };
    const table = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding()))!;
    await table.beginCell("visible", "number"); table.setRaw("not yet parsed"); await table.persistInput();
    const rows = table.getState().rows; foreign = true;
    expect(await table.refresh()).toBe(false); expect(table.getState().rows).toBe(rows);
    expect(table.getState().drafts[0]?.rawInput).toBe("not yet parsed"); expect(f.commit).not.toHaveBeenCalled();
  });

  it("does not apply a port's other operation receipt to a retained submitted input", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host), table = (await registry.connect(fixtureBinding()))!;
    await table.beginCell("visible", "number"); table.setRaw("17"); f.faults.lostAck = true; await table.submit(); registry.dispose();
    const raw = JSON.stringify([...f.stored.values()]), resolve = f.host.resolvePort;
    const ticket = structuredClone([...f.stored.values()][0]!.submitted!); ticket.request.operationId = "other-ticket";
    f.host.resolvePort = async binding => ({ ...(await resolve(binding))!, recovery: ticket });
    await expect(createNotesTableEditingRegistry(f.host).connect(fixtureBinding())).rejects.toThrow("Different retained operations");
    expect(JSON.stringify([...f.stored.values()])).toBe(raw); expect(f.lookup).not.toHaveBeenCalled(); expect(f.commit).toHaveBeenCalledTimes(1);
  });

  it("only the captured view can reconcile an unresolved resource operation", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host);
    const a = (await registry.connect(fixtureBinding("", "a")))!, b = (await registry.connect(fixtureBinding("", "b")))!;
    await a.beginCell("visible", "number"); a.setRaw("18"); f.faults.lostAck = true; await a.submit();
    expect(await b.reconcile()).toBe(false); expect(f.lookup).not.toHaveBeenCalled();
    expect(a.getState().drafts[0]?.rawInput).toBe("18"); expect(await a.reconcile()).toBe(true); expect(f.commit).toHaveBeenCalledTimes(1);
  });

  it("a clean leave ticket is invalid after input, registration, composition ABA or disposal", async () => {
    for (const action of ["input", "registration", "composition", "dispose"] as const) {
      const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host), table = (await registry.connect(fixtureBinding()))!;
      expect(registry.captureLeaveGuard(fixtureTarget)()).toBe(false);
      expect(await registry.beforeLeave(fixtureTarget, signal())).toBe(true); const current = registry.captureLeaveGuard(fixtureTarget); expect(current()).toBe(true);
      if (action === "input") await table.beginCell("visible", "number");
      if (action === "registration") await registry.connect(fixtureBinding("", "late"));
      if (action === "composition") { table.setComposing("ime", true); table.setComposing("ime", false); }
      if (action === "dispose") registry.dispose();
      expect(current()).toBe(false); expect(f.commit).not.toHaveBeenCalled();
    }
  });

  it("cancellation while raw ticket storage is pending prevents late host submission", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host), table = (await registry.connect(fixtureBinding()))!;
    await table.beginCell("visible", "number"); table.setRaw("19"); await table.persistInput();
    const entered = gate(), waiting = gate(), put = f.journal.put;
    f.journal.put = async (draft, expected) => { if (draft.submitted) { entered.release(); await waiting.promise; } await put(draft, expected); };
    const submission = table.submit(); await entered.promise; table.cancel(); waiting.release(); expect(await submission).toBe(false);
    expect(f.commit).not.toHaveBeenCalled(); expect(f.tickets.size).toBe(0);
    const operationId = table.getState().drafts[0]!.submitted!.request.operationId;
    expect(await table.reconcile()).toBe(false); expect(f.lookup).toHaveBeenCalledWith("notes-db-edit:db", operationId); expect(f.commit).not.toHaveBeenCalled();
  });

  it("direct preset controller navigation retains a dirty nested table without needing a mounted marker", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host), preset = createOpenEditorNotesPreset({ host: bodyHost(), tableEditing: registry });
    expect(await preset.controller.open(fixtureTarget)).toBe(true); const table = (await registry.connect(fixtureBinding()))!;
    await table.beginCell("visible", "number"); table.setRaw("raw retained");
    expect(await preset.controller.open({ kind: "page", pageId: "other" })).toBe(false);
    expect(preset.controller.getState().snapshot?.target).toEqual(fixtureTarget); expect(table.getState().drafts[0]?.rawInput).toBe("raw retained"); expect(f.commit).not.toHaveBeenCalled();
    preset.dispose(); registry.dispose();
  });

  it("late table input during destination read does not replace the source controller", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host), host = bodyHost(), read = host.readDocument, entered = gate(), waiting = gate();
    host.readDocument = async (target, abort) => { if (target.kind === "page" && target.pageId === "other") { entered.release(); await waiting.promise; } return read(target, abort); };
    const preset = createOpenEditorNotesPreset({ host, tableEditing: registry }); expect(await preset.controller.open(fixtureTarget)).toBe(true);
    const table = (await registry.connect(fixtureBinding()))!, opening = preset.controller.open({ kind: "page", pageId: "other" });
    await entered.promise; await table.beginCell("visible", "number"); table.setRaw("late raw"); waiting.release();
    expect(await opening).toBe(false); expect(preset.controller.getState().snapshot?.target).toEqual(fixtureTarget); expect(table.getState().drafts[0]?.rawInput).toBe("late raw");
    preset.dispose(); registry.dispose();
  });

  it("new nested table input during layout storage restores the original exact layout", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host), host = bodyHost(), entered = gate(), waiting = gate();
    let stored: string | null = null, pause = false;
    const session = createNotesTabbedWorkspaceSession({ host, tableEditing: registry, initialTarget: fixtureTarget, layoutStorage: { read: async () => stored, write: async (_key, value, expected) => { expect(stored).toBe(expected); if (pause) { pause = false; entered.release(); await waiting.promise; } stored = value; } } });
    await session.initialize(); const before = session.getState().layout, table = (await registry.connect(fixtureBinding()))!;
    pause = true; const opening = session.open({ kind: "page", pageId: "other" }); await entered.promise;
    await table.beginCell("visible", "number"); table.setRaw("input while layout was saving"); waiting.release();
    expect(await opening).toBe(false); expect(session.getState().layout).toBe(before); expect(JSON.parse(stored!).layout).toEqual(before); expect(f.commit).not.toHaveBeenCalled();
    session.dispose(); registry.dispose();
  });
});
