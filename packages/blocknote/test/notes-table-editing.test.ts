import { describe, expect, it, vi } from "vitest";
import { createNotesTableEditingRegistry, isNotesTablePropertyEditable, notesTableBindingKey, parseNotesTableCellInput } from "../src/notes/tableEditing.js";
import { fixtureBinding, fixtureTarget, tableFixture } from "./notes-table-fixture.js";
const signal = () => new AbortController().signal;
describe("versioned table-view writing and raw-input protection", () => {
  it("simultaneous New row starts retain one fixed raw record before any transport", async () => {
    const f = tableFixture(), table = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding()))!;
    const starts = await Promise.allSettled([table.beginCreate(), table.beginCreate()]);
    expect(starts.map(result => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    await table.persistInput(); expect(f.stored.size).toBe(1);
    const rowKey = table.getState().drafts[0]!.rowKey; table.setRaw('{"title":"One row"}');
    expect(await table.submit()).toBe(true); expect(f.rows.get(rowKey)?.values).toEqual({ title: "One row" });
    expect(f.commit).toHaveBeenCalledTimes(1); expect(f.stored.size).toBe(0);
  });
  it("patches one named cell, retains unknown and query-hidden rows, and double click sends once", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host), table = (await registry.connect(fixtureBinding("Visible")))!;
    const hidden = JSON.stringify(f.rows.get("hidden")), opaque = JSON.stringify(f.rows.get("visible")!.values.future);
    await table.beginCell("visible", "number"); table.setRaw("12.5"); const result = await Promise.all([table.submit(), table.submit()]);
    expect(result).toEqual([true, false]); expect(f.commit).toHaveBeenCalledTimes(1); expect(f.rows.get("visible")!.values.number).toBe(12.5);
    expect(JSON.stringify(f.rows.get("hidden"))).toBe(hidden); expect(JSON.stringify(f.rows.get("visible")!.values.future)).toBe(opaque); expect(f.rows.get("visible")!.values.hiddenField).toBe("exact unknown bytes");
    const request = f.commit.mock.calls[0]![0]; expect(request.change).toEqual({ kind: "patch", fields: { command: { kind: "row.patch", rowKey: "visible", fields: { number: 12.5 } } } });
    expect(table.getState().drafts).toEqual([]); expect(await registry.beforeLeave(fixtureTarget, signal())).toBe(true);
  });
  it("creates a fixed row identity from entered properties only", async () => {
    const f = tableFixture(), table = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding()))!;
    await table.beginCreate(); const key = table.getState().drafts[0]!.rowKey; table.setRaw(JSON.stringify({ title: "New row", number: "3" }));
    expect(await table.submit()).toBe(true); expect(f.rows.get(key)?.values).toEqual({ title: "New row", number: 3 }); expect(f.commit).toHaveBeenCalledTimes(1);
  });
  it("persists invalid raw text before parsing and blocks composition and navigation without sending", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host), table = (await registry.connect(fixtureBinding()))!;
    await table.beginCell("visible", "number"); table.setRaw("途中12x"); table.setComposing("native-input", true);
    expect(await table.submit()).toBe(false); expect(await registry.beforeLeave(fixtureTarget, signal())).toBe(false); table.setComposing("native-input", false);
    expect(await table.submit()).toBe(false); expect([...f.stored.values()][0]?.rawInput).toBe("途中12x"); expect(f.commit).not.toHaveBeenCalled(); expect(f.rows.get("visible")!.values.number).toBe(2);
  });
  it("hydrates stale schema/revision raw input without rebasing or sending", async () => {
    const f = tableFixture(), first = createNotesTableEditingRegistry(f.host), table = (await first.connect(fixtureBinding()))!;
    await table.beginCell("visible", "number"); table.setRaw("12x"); await table.persistInput(); first.dispose(); f.bumpSchema();
    const restored = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding()))!;
    expect(restored.getState().drafts[0]?.rawInput).toBe("12x"); expect(restored.getState().drafts[0]?.expectedSchemaRevision).toBe("s1"); expect(await restored.submit()).toBe(false); expect(f.commit).not.toHaveBeenCalled();
  });
  it("lost ACK restores exact submitted ID and uses lookup only in a fresh registry", async () => {
    const f = tableFixture(), first = createNotesTableEditingRegistry(f.host), table = (await first.connect(fixtureBinding()))!;
    await table.beginCell("visible", "number"); table.setRaw("4"); f.faults.lostAck = true; expect(await table.submit()).toBe(false); const ticket = table.getState().drafts[0]!.submitted!; first.dispose();
    const restored = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding()))!;
    expect(f.commit).toHaveBeenCalledTimes(1); expect(f.lookup).toHaveBeenCalledTimes(1); expect(f.lookup).toHaveBeenCalledWith(ticket.request.resourceId, ticket.request.operationId); expect(restored.getState().drafts).toEqual([]); expect(f.rows.get("visible")!.values.number).toBe(4);
  });
  it("failed raw or operation ticket storage prevents transport and retains input", async () => {
    for (const failure of ["journal", "ticket"] as const) {
      const f = tableFixture(), table = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding()))!;
      await table.beginCell("visible", "number"); await table.persistInput(); f.faults[failure] = true; table.setRaw("8"); expect(await table.submit()).toBe(false); expect(f.commit).not.toHaveBeenCalled(); expect(table.getState().drafts[0]?.rawInput).toBe("8");
    }
  });
  it("foreign receipt remains unknown; a verified lookup can reconcile the original commit", async () => {
    const f = tableFixture(), table = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding()))!;
    await table.beginCell("visible", "number"); table.setRaw("7"); f.faults.foreignProof = true; expect(await table.submit()).toBe(false); expect(table.getState().unknown).toBe(true); expect(table.getState().drafts[0]?.rawInput).toBe("7");
    expect(await table.reconcile()).toBe(true); expect(f.commit).toHaveBeenCalledTimes(1); expect(f.lookup).toHaveBeenCalledTimes(1);
  });
  it("keeps successful input during refresh failure; recovery never sends a second operation", async () => {
    const f = tableFixture(), table = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding()))!;
    await table.beginCell("visible", "number"); table.setRaw("10"); f.faults.rows = true; expect(await table.submit()).toBe(false); expect(f.rows.get("visible")!.values.number).toBe(10); expect(table.getState().drafts[0]?.submitted).toBeTruthy();
    f.faults.rows = false; expect(await table.reconcile()).toBe(true); expect(f.commit).toHaveBeenCalledTimes(1); expect(table.getState().drafts).toEqual([]);
  });
  it("denial retains raw input until explicit terminal release; it is never replayed", async () => {
    const f = tableFixture(), table = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding()))!;
    await table.beginCell("visible", "number"); table.setRaw("5"); f.faults.denied = true; expect(await table.submit()).toBe(false); expect(await table.submit()).toBe(false); expect(f.commit).toHaveBeenCalledTimes(1);
    expect(table.getState().drafts[0]?.rawInput).toBe("5"); expect(await table.discardInput()).toBe(true); expect(f.tickets.size).toBe(0);
  });
  it("all views share one resource input lease and old-query input is discovered after restart", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host), a = (await registry.connect(fixtureBinding("Visible", "a")))!, b = (await registry.connect(fixtureBinding("", "b")))!;
    await a.beginCell("visible", "number"); a.setRaw("stale unparsed"); await a.persistInput(); await expect(b.beginCreate()).rejects.toThrow(); registry.dispose();
    const next = createNotesTableEditingRegistry(f.host), other = (await next.connect(fixtureBinding("", "b")))!;
    expect(other.getState().otherDrafts[0]?.rawInput).toBe("stale unparsed"); await expect(other.beginCreate()).rejects.toThrow(/another view/); expect(await next.beforeLeave(fixtureTarget, signal())).toBe(false); expect(f.commit).not.toHaveBeenCalled();
  });
  it("queries and scope are immutable and future/computed/hosted properties remain readonly", () => {
    expect(notesTableBindingKey(fixtureBinding("x", "a"))).not.toBe(notesTableBindingKey(fixtureBinding("x", "b")));
    expect(() => notesTableBindingKey({ ...fixtureBinding(), query: { ...fixtureBinding().query, limit: 51 } })).toThrow();
    for (const type of ["formula", "user", "files", "multi_select", "relation", "location", "future-native"]) expect(isNotesTablePropertyEditable({ id: type, name: type, type })).toBe(false);
    expect(() => parseNotesTableCellInput({ id: "n", name: "Amount", type: "number" }, "12x")).toThrow();
  });
  it("drains every registered writer even when an earlier input flush rejects", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host), a = (await registry.connect(fixtureBinding("", "a")))!, b = (await registry.connect(fixtureBinding("", "b")))!;
    vi.spyOn(a, "persistInput").mockRejectedValue(new Error("QuotaExceededError")); const second = vi.spyOn(b, "persistInput");
    expect(await registry.beforeLeave(fixtureTarget, signal())).toBe(false); expect(second).toHaveBeenCalledTimes(1); expect(f.commit).not.toHaveBeenCalled();
  });
  it("fences new registration and composition ABA while navigation is awaiting storage", async () => {
    for (const change of ["register", "composition"] as const) {
      const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host), a = (await registry.connect(fixtureBinding("", "a")))!;
      let release!: () => void, entered!: () => void; const gate = new Promise<void>(r => { release = r; }), reached = new Promise<void>(r => { entered = r; });
      vi.mocked(f.journal.list).mockImplementationOnce(async () => { entered(); await gate; return []; });
      const leaving = registry.beforeLeave(fixtureTarget, signal()); await reached;
      if (change === "register") await registry.connect(fixtureBinding("", "b")); else { a.setComposing("ime", true); a.setComposing("ime", false); }
      release(); expect(await leaving).toBe(false); expect(await registry.beforeLeave(fixtureTarget, signal())).toBe(true);
    }
  });
  it("two fresh readers race with one canonical commit and one conflict, retaining both unknown inputs until lookup", async () => {
    const f = tableFixture(), a = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding("", "a")))!, b = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding("", "b")))!;
    await Promise.all([a.beginCell("visible", "number"), b.beginCell("visible", "number")]); a.setRaw("21"); b.setRaw("22"); f.faults.lostAck = true;
    expect(await Promise.all([a.submit(), b.submit()])).toEqual([false, false]); expect(f.commit).toHaveBeenCalledTimes(2); expect([...f.receipts.values()].map(r => r.status).sort()).toEqual(["committed", "conflict"]);
    expect(a.getState().drafts[0]?.rawInput).toBe("21"); expect(b.getState().drafts[0]?.rawInput).toBe("22"); expect(f.stored.size).toBe(2);
    const winner = f.rows.get("visible")!.values.number; await a.reconcile(); await b.reconcile(); expect(f.commit).toHaveBeenCalledTimes(2); expect(f.rows.get("visible")!.values.number).toBe(winner); expect(f.stored.size).toBe(1);
  });
  it("same-binding journal CAS rejects a second session rather than overwriting its raw input", async () => {
    const f = tableFixture(), a = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding()))!, b = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding()))!;
    await Promise.all([a.beginCell("visible", "number"), b.beginCell("visible", "number")]); await Promise.allSettled([a.persistInput(), b.persistInput()]);
    expect([a.getState().journalError, b.getState().journalError].filter(Boolean)).toHaveLength(1); expect(f.stored.size).toBe(1); expect(f.commit).not.toHaveBeenCalled();
  });
  it("parent/Whiteboard revision change blocks old raw input before any row transport", async () => {
    const f = tableFixture(), table = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding()))!;
    await table.beginCell("visible", "number"); table.setRaw("31"); await table.persistInput(); f.bumpRevision();
    expect(await table.submit()).toBe(false); expect(table.getState().drafts[0]?.expectedRevision).toBe("r1"); expect(f.commit).not.toHaveBeenCalled(); expect(f.rows.get("visible")!.values.number).toBe(2);
  });
  it("an incomplete history proof cannot confirm a successful row write", async () => {
    const f = tableFixture(), original = f.host.resolvePort;
    f.host.resolvePort = async binding => { const port = (await original(binding))!; return { ...port, provider: { ...port.provider, commit: async (request, abort) => { const receipt = await port.provider.commit(request, abort); return { ...receipt, proof: { ...receipt.proof, historyId: undefined } }; } } }; };
    const table = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding()))!; await table.beginCell("visible", "number"); table.setRaw("41");
    expect(await table.submit()).toBe(false); expect(table.getState().unknown).toBe(true); expect(table.getState().drafts[0]?.submitted).toBeTruthy(); expect(await table.reconcile()).toBe(true); expect(f.commit).toHaveBeenCalledTimes(1);
  });
  it("a successful write followed by cleanup quota failure restarts with GET only", async () => {
    const f = tableFixture(), registry = createNotesTableEditingRegistry(f.host), table = (await registry.connect(fixtureBinding()))!;
    await table.beginCell("visible", "number"); table.setRaw("51"); await table.persistInput();
    const remove = vi.mocked(f.journal.remove), original = remove.getMockImplementation()!; remove.mockRejectedValueOnce(new Error("QuotaExceededError"));
    expect(await table.submit()).toBe(false); expect(table.getState().journalError).toBe(true); const ticket = table.getState().drafts[0]!.submitted!; f.tickets.clear(); registry.dispose();
    remove.mockImplementation(original); const restored = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding()))!;
    expect(f.commit).toHaveBeenCalledTimes(1); expect(f.lookup).toHaveBeenCalledWith(ticket.request.resourceId, ticket.request.operationId); expect(restored.getState().drafts).toEqual([]); expect(f.rows.get("visible")!.values.number).toBe(51);
  });
  it("storage failure before transport is reconciled by same-ID terminal lookup, never replay", async () => {
    const f = tableFixture(), table = (await createNotesTableEditingRegistry(f.host).connect(fixtureBinding()))!;
    await table.beginCell("visible", "number"); table.setRaw("61"); f.faults.ticket = true; expect(await table.submit()).toBe(false); const operationId = table.getState().drafts[0]!.submitted!.request.operationId;
    expect(await table.reconcile()).toBe(false); expect(f.lookup).toHaveBeenCalledWith("notes-db-edit:db", operationId); expect(f.commit).not.toHaveBeenCalled(); expect(await table.submit()).toBe(false); expect(table.getState().drafts[0]?.rawInput).toBe("61"); expect(await table.discardInput()).toBe(true);
  });
});
