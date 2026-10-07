// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createNotesWorkspaceController, NOTES_COMMAND_KINDS, parseNotesCommand, parseNotesDocumentSnapshot } from "../src/notes/controller.js";
import { createOpenEditorNotesPreset, parseNotesWorkspaceConfig } from "../src/notes/preset.js";
import type { NotesCommandRequest, NotesCommandResult, NotesDocumentSnapshot, NotesRecovery, NotesTarget, NotesWorkspaceHost } from "../src/notes/contracts.js";

const doc = (text: string) => createEditorDocument([{ id: "body", type: "paragraph", content: [{ type: "text", text, styles: { bold: true } }], props: { future: "retained" } }]);
const page = (pageId: string): NotesTarget => ({ kind: "page", pageId });
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
function fixture() {
  const key = (target: NotesTarget) => JSON.stringify(target);
  const snapshots = new Map<string, NotesDocumentSnapshot>();
  const receipts = new Map<string, NotesCommandResult>();
  let serial = 1;
  for (const target of [page("a"), page("b"), { kind: "row", databaseId: "one", rowId: "1" }, { kind: "row", databaseId: "two", rowId: "1" }] as NotesTarget[]) snapshots.set(key(target), { scope: { actorId: "synthetic", workspaceId: "test" }, target, revision: "r1", contentRevision: "c1", document: doc(key(target)), title: key(target), metadata: { unknown: { nested: true } }, capabilities: [...NOTES_COMMAND_KINDS], capabilitySemantics: Object.fromEntries(NOTES_COMMAND_KINDS.map(kind => [kind, "test-only"])), legacyArchiveRef: "host-private-archive" });
  const read = vi.fn(async (target: NotesTarget) => copy(snapshots.get(key(target))!));
  const before = vi.fn(async (_recovery: NotesRecovery, _signal: AbortSignal) => {});
  const commit = vi.fn(async (request: NotesCommandRequest): Promise<NotesCommandResult> => {
    const current = snapshots.get(key(request.target))!;
    if (current.revision !== request.expectedRevision) return { status: "conflict", operationId: request.operationId, target: request.target };
    let snapshot = copy(current);
    if (request.command.kind === "document.save") snapshot = { ...snapshot, document: copy(request.command.document), title: request.command.title };
    if (request.command.kind === "page.rename") snapshot.title = request.command.title;
    if (request.command.kind === "metadata.patch") snapshot.metadata = { ...snapshot.metadata, ...request.command.fields };
    if (request.command.kind === "property.patch") snapshot.metadata = { ...snapshot.metadata, properties: { ...(snapshot.metadata.properties as Record<string, never> ?? {}), [request.command.propertyId]: request.command.value } };
    snapshot.revision = `r${++serial}`; if (request.command.kind === "document.save") snapshot.contentRevision = `c${serial}`;
    snapshots.set(key(request.target), copy(snapshot));
    const evidence = request.command.kind === "comment.add" ? { kind: "comment.add" as const, revision: `comments${serial}`, commentId: `comment${serial}`, comment: { id: `comment${serial}`, blockId: request.command.blockId, text: request.command.text, resolved: false, createdAt: "2026-10-07" } } : undefined;
    const receipt: NotesCommandResult = { status: "committed", operationId: request.operationId, target: request.target, snapshot, historyId: `h${serial}`, persistence: "test-only", ...(evidence ? { evidence } : {}) };
    receipts.set(request.operationId, copy(receipt)); return receipt;
  });
  const lookup = vi.fn(async (target: NotesTarget, operationId: string): Promise<NotesCommandResult> => copy(receipts.get(operationId) ?? { status: "not-found", target, operationId, terminal: true }));
  const host: NotesWorkspaceHost = { scope: { actorId: "synthetic", workspaceId: "test" }, readDocument: read, beforeSubmit: before, commit, lookupOperation: lookup };
  let op = 0;
  const controller = createNotesWorkspaceController(host, { operationId: () => `op${++op}`, timeoutMs: 100 });
  return { host, controller, read, before, commit, lookup, snapshots, receipts, key };
}
async function conflictingFixture() {
  const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("local human"), "Local");
  const remote = f.snapshots.get(f.key(page("a")))!; remote.revision = "remote-r"; remote.contentRevision = "remote-c"; remote.document = doc("remote human"); remote.title = "Remote";
  expect((await f.controller.save())?.status).toBe("conflict"); return f;
}

describe("public Notes workspace controller", () => {
  it("opens exact page and exposes a stable deeply immutable snapshot", async () => {
    const { controller } = fixture(); expect(await controller.open(page("a"))).toBe(true);
    expect(controller.getState()).toBe(controller.getState()); expect(Object.isFrozen(controller.getState().draft!.blocks[0])).toBe(true);
    expect(controller.getState().snapshot!.legacyArchiveRef).toBe("host-private-archive");
  });
  it("preserves unknown block fields, metadata and host archive handle during confirmed save/reload", async () => {
    const { controller } = fixture(); await controller.open(page("a")); controller.setDraft(doc("human"), "Title");
    expect((await controller.save())?.status).toBe("committed"); await controller.open(page("a"));
    expect(controller.getState().draft).toEqual(doc("human")); expect(controller.getState().snapshot!.metadata.unknown).toEqual({ nested: true }); expect(controller.getState().dirty).toBe(false);
  });
  it("does not replace new human input with an old save acknowledgement", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("first"));
    const gate = deferred<NotesCommandResult>(); const original = f.commit.getMockImplementation()!;
    f.commit.mockImplementationOnce(async request => { const result = await original(request); await gate.promise; return result; });
    const save = f.controller.save(); await vi.waitFor(() => expect(f.commit).toHaveBeenCalledTimes(1));
    f.controller.setDraft(doc("second")); gate.resolve({ status: "unknown", target: page("a"), operationId: "unused" }); await save;
    expect(f.controller.getState().draft).toEqual(doc("second")); expect(f.controller.getState().dirty).toBe(true);
    expect(f.controller.getState().snapshot!.document).toEqual(doc("first")); expect((await f.controller.save())?.status).toBe("committed");
  });
  it("serializes double clicks to one host commit", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("once"));
    const gate = deferred<void>(); f.before.mockImplementationOnce(() => gate.promise);
    const first = f.controller.save(); await expect(f.controller.save()).rejects.toThrow(/unavailable/); gate.resolve(); await first; expect(f.commit).toHaveBeenCalledTimes(1);
  });
  it("saves dirty body before navigation and leaves no invented page", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("saved first")); expect(await f.controller.open(page("b"))).toBe(true);
    expect(f.commit).toHaveBeenCalledTimes(1); expect(f.snapshots.get(f.key(page("a")))!.document).toEqual(doc("saved first")); expect(f.controller.getState().snapshot!.target).toEqual(page("b"));
  });
  it("keeps current draft when input resumes during navigation read", async () => {
    const f = fixture(); await f.controller.open(page("a")); const gate = deferred<NotesDocumentSnapshot>(); f.read.mockImplementationOnce(() => gate.promise);
    const navigation = f.controller.open(page("b")); f.controller.setDraft(doc("late human")); gate.resolve(f.snapshots.get(f.key(page("b")))!);
    expect(await navigation).toBe(false); expect(f.controller.getState().snapshot!.target).toEqual(page("a")); expect(f.controller.getState().draft).toEqual(doc("late human"));
  });
  it("rejects a switch after an IME composition begins and ends during the read", async () => {
    const f = fixture(); await f.controller.open(page("a")); const gate = deferred<NotesDocumentSnapshot>(); f.read.mockImplementationOnce(() => gate.promise);
    const navigation = f.controller.open(page("b")); f.controller.setComposing(true); f.controller.setComposing(false); gate.resolve(f.snapshots.get(f.key(page("b")))!);
    expect(await navigation).toBe(false); expect(f.controller.getState().snapshot!.target).toEqual(page("a"));
  });
  it("allows drafting while composing and prohibits submission/navigation", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setComposing(true); f.controller.setDraft(doc("日本語"));
    await expect(f.controller.save()).rejects.toThrow(/unavailable/); expect(await f.controller.open(page("b"))).toBe(false); expect(f.commit).not.toHaveBeenCalled(); f.controller.setComposing(false); expect((await f.controller.save())?.status).toBe("committed");
  });
  it("cancel before durable ticket completion prevents submission, including a late ticket callback", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("safe")); const gate = deferred<void>(); f.before.mockImplementationOnce(() => gate.promise);
    const save = f.controller.save(); await vi.waitFor(() => expect(f.before).toHaveBeenCalled()); f.controller.cancel(); expect((await save)?.status).toBe("cancelled"); gate.resolve(); await Promise.resolve(); expect(f.commit).not.toHaveBeenCalled(); expect(f.controller.getState().dirty).toBe(true);
  });
  it("failed durable ticket never submits", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("safe")); f.before.mockRejectedValueOnce(new Error("unavailable"));
    expect((await f.controller.save())?.status).toBe("cancelled"); expect(f.commit).not.toHaveBeenCalled();
  });
  it("lost acknowledgement becomes unknown, refuses resend and reconciles committed operation", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("durable")); const original = f.commit.getMockImplementation()!;
    f.commit.mockImplementationOnce(async request => { await original(request); throw new Error("response lost"); });
    expect((await f.controller.save())?.status).toBe("unknown"); await expect(f.controller.save()).rejects.toThrow(/unavailable/); expect(await f.controller.open(page("b"))).toBe(false);
    expect((await f.controller.reconcile()).status).toBe("committed"); expect(f.commit).toHaveBeenCalledTimes(1); expect(f.lookup).toHaveBeenCalledTimes(1); expect(f.controller.getState().dirty).toBe(false);
  });
  it("retains human input typed while save result was unknown", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("before")); const original = f.commit.getMockImplementation()!;
    f.commit.mockImplementationOnce(async request => { await original(request); throw new Error("lost"); }); await f.controller.save(); f.controller.setDraft(doc("after")); await f.controller.reconcile();
    expect(f.controller.getState().draft).toEqual(doc("after")); expect(f.controller.getState().dirty).toBe(true);
  });
  it("restores durable recovery into a new controller and looks up rather than resubmitting", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("restart")); const original = f.commit.getMockImplementation()!;
    f.commit.mockImplementationOnce(async request => { await original(request); throw new Error("lost"); }); await f.controller.save();
    const second = createNotesWorkspaceController(f.host, { recovery: f.controller.getRecovery() }); expect(second.getState().status).toBe("unknown"); expect(await second.open(page("b"))).toBe(false); await second.reconcile(); expect(second.getState().draft).toEqual(doc("restart")); expect(f.commit).toHaveBeenCalledTimes(1);
  });
  it("does not trust mismatched operation receipts", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("safe")); f.commit.mockImplementationOnce(async request => ({ status: "denied", target: request.target, operationId: "another" }));
    expect((await f.controller.save())?.status).toBe("unknown"); expect(f.controller.getRecovery()).toBeDefined(); expect(f.controller.getState().draft).toEqual(doc("safe"));
  });
  it("does not accept a forged committed document as proof of saving", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("reviewed")); f.commit.mockImplementationOnce(async request => ({ status: "committed", target: request.target, operationId: request.operationId, historyId: "h", persistence: "test-only", snapshot: { ...f.snapshots.get(f.key(page("a")))!, revision: "r2", document: doc("different") } }));
    expect((await f.controller.save())?.status).toBe("unknown"); expect(f.controller.getState().dirty).toBe(true);
  });
  it.each(["denied", "conflict"] as const)("keeps draft and blocks navigation on final %s", async status => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("kept")); f.commit.mockImplementationOnce(async request => ({ status, target: request.target, operationId: request.operationId }));
    expect((await f.controller.save())?.status).toBe(status); expect(f.controller.getState().draft).toEqual(doc("kept")); expect(f.controller.getRecovery()).toBeUndefined(); expect(await f.controller.open(page("b"))).toBe(false);
  });
  it("missing capability is unavailable even if host implementation exists", async () => {
    const f = fixture(); f.snapshots.get(f.key(page("a")))!.capabilities = []; f.snapshots.get(f.key(page("a")))!.capabilitySemantics = {}; await f.controller.open(page("a"));
    await expect(f.controller.execute({ kind: "page.trash", expectedWorkspaceRevision: "w1" })).rejects.toThrow(/capability/); expect(f.before).not.toHaveBeenCalled(); expect(f.commit).not.toHaveBeenCalled();
  });
  it("keeps row scope as database+row tuple and rejects a read for another database", async () => {
    const f = fixture(), row: NotesTarget = { kind: "row", databaseId: "one", rowId: "1" }; await f.controller.open(row); f.controller.setDraft(doc("row one")); await f.controller.save();
    expect(f.commit.mock.calls[0]![0].target).toEqual(row); expect(f.snapshots.get(f.key({ kind: "row", databaseId: "two", rowId: "1" }))!.document).not.toEqual(doc("row one"));
    f.read.mockResolvedValueOnce(f.snapshots.get(f.key({ kind: "row", databaseId: "two", rowId: "1" }))!); expect(await f.controller.open(row)).toBe(false); expect(f.controller.getState().snapshot!.target).toEqual(row);
  });
  it("refuses a non-save resource command over an unsaved draft", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("keep")); await expect(f.controller.execute({ kind: "history.restore", versionId: "v", expectedVersionRevision: "vr" })).rejects.toThrow(/Save/); expect(f.commit).not.toHaveBeenCalled();
  });
  it("patches only named metadata fields through the host", async () => {
    const f = fixture(); await f.controller.open(page("a")); await f.controller.execute({ kind: "metadata.patch", fields: { icon: "🌱" } }); expect(f.controller.getState().snapshot!.metadata).toEqual({ unknown: { nested: true }, icon: "🌱" });
  });
  it("keeps input resumed during a comment/resource commit", async () => {
    const f = fixture(); await f.controller.open(page("a")); const gate = deferred<NotesCommandResult>(); const original = f.commit.getMockImplementation()!;
    f.commit.mockImplementationOnce(async request => { const result = await original(request); await gate.promise; return result; });
    const command = f.controller.execute({ kind: "comment.add", blockId: "body", text: "review" }); await vi.waitFor(() => expect(f.commit).toHaveBeenCalled());
    f.controller.setDraft(doc("human after comment")); gate.resolve({ status: "unknown", target: page("a"), operationId: "unused" }); expect((await command).status).toBe("committed");
    expect(f.controller.getState().draft).toEqual(doc("human after comment")); expect(f.controller.getState().dirty).toBe(true);
  });
  it("cannot report property success without the exact canonical named value", async () => {
    const f = fixture(); await f.controller.open(page("a")); const original = f.commit.getMockImplementation()!; f.commit.mockImplementationOnce(async request => { const result = await original(request); if (result.status === "committed") result.snapshot.metadata.properties = { status: "different" }; return result; }); expect((await f.controller.execute({ kind: "property.patch", propertyId: "status", value: "done" })).status).toBe("unknown"); expect(f.controller.getRecovery()).toBeDefined();
  });
  it("requires actual canonical effect evidence for a restored history", async () => {
    const f = fixture(); await f.controller.open(page("a")); const original = f.commit.getMockImplementation()!;
    f.commit.mockImplementationOnce(async request => ({ ...await original(request), evidence: { kind: "history.restore", revision: "history2", versionId: "v", version: { id: "v", revision: "vr", createdAt: "2026-10-07", title: "old", document: doc("old") } } }) as NotesCommandResult);
    expect((await f.controller.execute({ kind: "history.restore", versionId: "v", expectedVersionRevision: "vr" })).status).toBe("unknown");
  });
  it("refuses incomplete schema collections as proof of deletion", async () => {
    const f = fixture(); await f.controller.open(page("a")); const original = f.commit.getMockImplementation()!;
    f.commit.mockImplementationOnce(async request => ({ ...await original(request), evidence: { kind: "schema.delete-property", databaseId: "db", revision: "s2", properties: [], complete: false } }) as unknown as NotesCommandResult);
    expect((await f.controller.execute({ kind: "schema.delete-property", databaseId: "db", propertyId: "hidden", expectedSchemaRevision: "s1" })).status).toBe("unknown");
  });
  it("refuses a template ACK whose body differs from the reviewed result", async () => {
    const f = fixture(); await f.controller.open(page("a")); const original = f.commit.getMockImplementation()!;
    f.commit.mockImplementationOnce(async request => ({ ...await original(request), evidence: { kind: "template.apply", templateId: "t", revision: "tr", template: { id: "t", revision: "tr", title: "T", document: doc("template") } } }) as NotesCommandResult);
    expect((await f.controller.execute({ kind: "template.apply", templateId: "t", expectedTemplateRevision: "tr", afterDocument: doc("reviewed combined document") })).status).toBe("unknown");
  });
  it("checks row resource database before invoking any provider", async () => {
    const f = fixture(); await f.controller.open({ kind: "row", databaseId: "one", rowId: "1" }); await expect(f.controller.execute({ kind: "database.action", databaseId: "two", rowId: "1", actionId: "button" })).rejects.toThrow(/scope/); expect(f.commit).not.toHaveBeenCalled();
  });
  it("binds durable journal and requests to actor/workspace and both canonical revisions", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("new")); await f.controller.save();
    expect(f.before.mock.calls[0]![0].request).toMatchObject({ scope: { actorId: "synthetic", workspaceId: "test" }, expectedRevision: "r1", expectedContentRevision: "c1", expectedPersistence: "test-only" });
    expect(f.commit.mock.calls[0]![0]).toEqual(f.before.mock.calls[0]![0].request);
  });
  it("refuses journal recovery across actors/workspaces", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("safe")); f.commit.mockRejectedValueOnce(new Error("lost")); await f.controller.save();
    expect(() => createNotesWorkspaceController({ ...f.host, scope: { actorId: "other", workspaceId: "test" } }, { recovery: f.controller.getRecovery() })).toThrow(/scope/);
  });
  it("does not open a document from another host workspace", async () => {
    const f = fixture(); f.snapshots.get(f.key(page("a")))!.scope = { actorId: "synthetic", workspaceId: "other" }; expect(await f.controller.open(page("a"))).toBe(false); expect(f.controller.getState().snapshot).toBeUndefined();
  });
  it("does not mistake an offline queue acknowledgement for canonical commit", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("queued")); const original = f.commit.getMockImplementation()!;
    f.commit.mockImplementationOnce(async request => ({ ...await original(request), persistence: "offline-queued" }) as NotesCommandResult);
    expect((await f.controller.save())?.status).toBe("unknown"); expect(f.controller.getState().dirty).toBe(true); expect(f.controller.getRecovery()).toBeDefined();
  });
  it("accepts explicitly local persistence without labeling it remote", async () => {
    const f = fixture(); f.snapshots.get(f.key(page("a")))!.capabilitySemantics["document.save"] = "local-only"; await f.controller.open(page("a")); f.controller.setDraft(doc("local")); const original = f.commit.getMockImplementation()!;
    f.commit.mockImplementationOnce(async request => ({ ...await original(request), persistence: "local-only" }) as NotesCommandResult);
    expect(await f.controller.save()).toMatchObject({ status: "committed", persistence: "local-only" }); expect(f.commit.mock.calls[0]![0].expectedPersistence).toBe("local-only");
  });
  it("rejects implicit capability persistence and invalid schema order", () => {
    const snapshot = fixture().snapshots.values().next().value!; expect(() => parseNotesDocumentSnapshot({ ...snapshot, capabilitySemantics: {} })).toThrow(/persistence/);
    expect(() => parseNotesCommand({ kind: "schema.reorder-properties", databaseId: "db", propertyIds: ["a", "a"], expectedSchemaRevision: "s" })).toThrow();
  });
  it("requires fenced terminal non-commit before clearing unknown recovery", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("safe")); f.commit.mockRejectedValueOnce(new Error("lost")); await f.controller.save();
    f.lookup.mockResolvedValueOnce({ status: "not-found", target: page("a"), operationId: "op1", terminal: false } as unknown as NotesCommandResult);
    expect((await f.controller.reconcile()).status).toBe("unknown"); expect(f.controller.getRecovery()).toBeDefined(); expect((await f.controller.reconcile()).status).toBe("not-found"); expect(f.controller.getRecovery()).toBeUndefined();
  });
  it("timeout after submission retains recovery and never blindly retries", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("safe")); const gate = deferred<NotesCommandResult>(); f.commit.mockImplementationOnce(() => gate.promise);
    expect((await f.controller.save())?.status).toBe("unknown"); expect(f.controller.getRecovery()).toBeDefined(); await expect(f.controller.save()).rejects.toThrow(/unavailable/); expect(f.commit).toHaveBeenCalledTimes(1);
  });
  it("disposed controllers suppress late reads and subscribers", async () => {
    const f = fixture(); const gate = deferred<NotesDocumentSnapshot>(); f.read.mockImplementationOnce(() => gate.promise); const listener = vi.fn(); f.controller.subscribe(listener); const open = f.controller.open(page("a")); f.controller.dispose(); const count = listener.mock.calls.length; gate.resolve(f.snapshots.get(f.key(page("a")))!); expect(await open).toBe(false); expect(listener).toHaveBeenCalledTimes(count);
  });
  it("JSON boundaries reject accessors/functions and unknown operation fields", () => {
    const spy = vi.fn(); expect(() => parseNotesCommand({ kind: "metadata.patch", fields: { get secret() { spy(); return "x"; } } })).toThrow(); expect(spy).not.toHaveBeenCalled();
    expect(() => parseNotesCommand({ kind: "page.trash", expectedWorkspaceRevision: "w1", grant: true })).toThrow(); expect(() => parseNotesCommand({ kind: "comment.update", commentId: "c" })).toThrow(); expect(() => parseNotesCommand({ kind: "document.save", title: "x", document: { schemaVersion: undefined, blocks: [] } })).toThrow();
    expect(() => parseNotesDocumentSnapshot({ ...fixture().snapshots.values().next().value!, capabilities: ["unsupported"] })).toThrow();
  });
  it("config cannot grant permissions, carry host functions, or select an unavailable panel", () => {
    expect(() => parseNotesWorkspaceConfig({ version: 1, permissions: ["all"] })).toThrow(); expect(() => parseNotesWorkspaceConfig({ version: 1, title: () => "x" })).toThrow(); expect(() => parseNotesWorkspaceConfig({ version: 1, documentPanels: ["info"], defaultDocumentPanel: "history" })).toThrow(); expect(parseNotesWorkspaceConfig({ version: 1, density: "compact" })).toEqual({ version: 1, density: "compact" });
  });
  it("creates isolated public Notes presets with real schema and no global providers", () => {
    const a = fixture(), b = fixture(); const first = createOpenEditorNotesPreset({ host: a.host }), second = createOpenEditorNotesPreset({ host: b.host });
    expect(first.controller).not.toBe(second.controller); expect(first.pageStore).not.toBe(second.pageStore); expect(first.databaseStore).not.toBe(second.databaseStore); expect(Object.keys(first.schema.blockSchema)).toContain("oeColumns"); expect(Object.keys(first.schema.blockSchema)).toContain("oeHtmlWidget"); expect(Object.keys(first.schema.blockSchema)).toContain("oeNotesDrawing"); expect(Object.keys(first.schema.blockSchema)).toContain("oeNotesSyncedBlock"); first.dispose(); second.dispose();
  });
  it("reads latest without rebasing or losing original draft, then prepares an explicitly reviewed merge", async () => {
    const f = await conflictingFixture(); const latest = await f.controller.readLatest(); expect(latest!.document).toEqual(doc("remote human")); expect(f.controller.getState().draft).toEqual(doc("local human")); expect(f.controller.getState().snapshot!.revision).toBe("r1");
    expect(await f.controller.acceptMergedDraft(latest!.revision, doc("local human + remote human"), "Merged")).toBe(true);
    expect(f.controller.getState().manualSaveRequired).toBe(true); expect(f.controller.getState().originalDraft!.document).toEqual(doc("local human")); expect(f.commit).toHaveBeenCalledTimes(1);
    expect(await f.controller.save()).toBeUndefined(); expect(await f.controller.open(page("b"))).toBe(false); expect(f.commit).toHaveBeenCalledTimes(1);
    expect((await f.controller.save({ explicit: true }))?.status).toBe("committed"); expect(f.before.mock.calls[1]![0].originalDraft!.document).toEqual(doc("local human")); expect(f.controller.getState().originalDraft).toBeUndefined(); expect(f.controller.getState().manualSaveRequired).toBe(false);
  });
  it("does not auto-submit even when the reviewed merge is exactly the current canonical document", async () => {
    const f = await conflictingFixture(); const latest = (await f.controller.readLatest())!; expect(await f.controller.acceptMergedDraft(latest.revision, latest.document, latest.title)).toBe(true);
    expect(await f.controller.save()).toBeUndefined(); expect(await f.controller.open(page("b"))).toBe(false); expect((await f.controller.save({ explicit: true }))?.status).toBe("committed");
  });
  it("rejects stale latest review after new human input", async () => {
    const f = await conflictingFixture(); const latest = (await f.controller.readLatest())!; f.controller.setDraft(doc("new local input"));
    expect(await f.controller.acceptMergedDraft(latest.revision, doc("obsolete merged draft"), "Merged")).toBe(false); expect(f.controller.getState().draft).toEqual(doc("new local input"));
  });
  it("does not expose a latest read that finished after resumed human input", async () => {
    const f = await conflictingFixture(); const gate = deferred<NotesDocumentSnapshot>(); f.read.mockImplementationOnce(() => gate.promise); const read = f.controller.readLatest();
    f.controller.setDraft(doc("later typing")); gate.resolve(f.snapshots.get(f.key(page("a")))!); expect(await read).toBeUndefined(); expect(f.controller.getState().latest).toBeUndefined(); expect(f.controller.getState().draft).toEqual(doc("later typing"));
  });
  it("rejects a latest read for the wrong scope/target", async () => {
    const f = await conflictingFixture(); f.read.mockResolvedValueOnce(f.snapshots.get(f.key(page("b")))!); expect(await f.controller.readLatest()).toBeUndefined();
    f.read.mockResolvedValueOnce({ ...f.snapshots.get(f.key(page("a")))!, scope: { actorId: "other", workspaceId: "test" } }); expect(await f.controller.readLatest()).toBeUndefined(); expect(f.controller.getState().draft).toEqual(doc("local human"));
  });
  it("rechecks content and permission changes before accepting a merged draft", async () => {
    const f = await conflictingFixture(); const latest = (await f.controller.readLatest())!; f.snapshots.get(f.key(page("a")))!.contentRevision = "new content token";
    expect(await f.controller.acceptMergedDraft(latest.revision, doc("merged"), "M")).toBe(false); expect(f.controller.getState().draft).toEqual(doc("local human"));
    const reviewed = (await f.controller.readLatest())!; f.snapshots.get(f.key(page("a")))!.capabilities = []; f.snapshots.get(f.key(page("a")))!.capabilitySemantics = {};
    expect(await f.controller.acceptMergedDraft(reviewed.revision, doc("merged"), "M")).toBe(false); expect(f.commit).toHaveBeenCalledTimes(1);
  });
  it("rejects merge acceptance if IME starts and ends while the last permission read is pending", async () => {
    const f = await conflictingFixture(); const latest = (await f.controller.readLatest())!; const gate = deferred<NotesDocumentSnapshot>(); f.read.mockImplementationOnce(() => gate.promise);
    const accept = f.controller.acceptMergedDraft(latest.revision, doc("merged"), "M"); f.controller.setComposing(true); f.controller.setComposing(false); gate.resolve(f.snapshots.get(f.key(page("a")))!);
    expect(await accept).toBe(false); expect(f.controller.getState().draft).toEqual(doc("local human")); expect(f.controller.getState().originalDraft).toBeDefined();
  });
  it("keeps source backup and prepared merge on failed explicit persistence", async () => {
    const f = await conflictingFixture(); const latest = (await f.controller.readLatest())!; await f.controller.acceptMergedDraft(latest.revision, doc("merged"), "M"); f.before.mockRejectedValueOnce(new Error("journal failure"));
    expect((await f.controller.save({ explicit: true }))?.status).toBe("cancelled"); expect(f.controller.getState().draft).toEqual(doc("merged")); expect(f.controller.getState().originalDraft!.document).toEqual(doc("local human")); expect(f.controller.getState().manualSaveRequired).toBe(true);
  });
  it("blocks latest review while an uncertain operation must be reconciled", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setDraft(doc("uncertain")); f.commit.mockRejectedValueOnce(new Error("lost")); await f.controller.save(); const reads = f.read.mock.calls.length;
    expect(await f.controller.readLatest()).toBeUndefined(); expect(await f.controller.acceptMergedDraft("r", doc("replace"), "x")).toBe(false); expect(f.read).toHaveBeenCalledTimes(reads);
  });
  it("holds cloned editor-local input without committing, including invalid JSON source", async () => {
    const f = fixture(); await f.controller.open(page("a")); const value = { kind: "property", propertyId: "status", baseRevision: "r1", source: "{" }, prior = f.controller.getState(); f.controller.setLocalDraft("property", value); value.source = "changed outside";
    expect(f.controller.getState()).not.toBe(prior); expect(f.controller.getState().localDrafts.property).toMatchObject({ source: "{" }); expect(Object.isFrozen(f.controller.getState().localDrafts.property)).toBe(true); expect(f.controller.getState().pendingEditors).toBe(true); expect(f.controller.getState().dirty).toBe(false); expect(f.commit).not.toHaveBeenCalled(); expect(f.before).not.toHaveBeenCalled();
  });
  it("blocks navigation and unrelated mutations until an explicit local editor cancel", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setLocalDraft("property", { kind: "property", propertyId: "status", baseRevision: "r1", source: '"draft"' });
    expect(await f.controller.open(page("b"))).toBe(false); await expect(f.controller.execute({ kind: "comment.add", blockId: "body", text: "comment" })).rejects.toThrow(/local Notes editors/); expect(f.read).toHaveBeenCalledTimes(1); expect(f.commit).not.toHaveBeenCalled();
    f.controller.setLocalDraft("property", undefined); expect(f.controller.getState().pendingEditors).toBe(false); expect(await f.controller.open(page("b"))).toBe(true);
  });
  it("can save document body while retaining local property inputs", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setLocalDraft("property", { kind: "property", propertyId: "status", baseRevision: "r1", source: '"draft"' }); f.controller.setDraft(doc("body update"));
    expect((await f.controller.save())?.status).toBe("committed"); expect(f.controller.getState().dirty).toBe(false); expect(f.controller.getState().pendingEditors).toBe(true); expect(f.controller.getState().localDrafts.property).toMatchObject({ source: '"draft"' });
  });
  it("submits only a reviewed matching local property and clears that cache after exact committed evidence", async () => {
    const f = fixture(); await f.controller.open({ kind: "row", databaseId: "one", rowId: "1" }); f.controller.setLocalDraft("property", { kind: "property", propertyId: "status", baseRevision: "r1", source: '"done"', presentation: { raw: "done" }, schemaFingerprint: "allowed" });
    expect((await f.controller.execute({ kind: "property.patch", propertyId: "status", value: "done" }, { localDraftId: "property" })).status).toBe("committed"); expect(f.controller.getState().localDrafts.property).toBeUndefined(); expect(f.controller.getState().pendingEditors).toBe(false); expect(f.before.mock.calls[0]![0].localDraftRef?.id).toBe("property");
  });
  it("retains other local editors when a single named editor commits", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setLocalDraft("first", { kind: "property", propertyId: "status", baseRevision: "r1", source: '"done"' }); f.controller.setLocalDraft("other", { kind: "property", propertyId: "future", baseRevision: "r1", source: '"other input"' });
    await f.controller.execute({ kind: "property.patch", propertyId: "status", value: "done" }, { localDraftId: "first" }); expect(f.controller.getState().localDrafts.first).toBeUndefined(); expect(f.controller.getState().localDrafts.other).toMatchObject({ source: '"other input"' }); expect(f.controller.getState().pendingEditors).toBe(true);
  });
  it("rejects mismatched/stale local payload before any durable operation", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setLocalDraft("property", { kind: "property", propertyId: "status", baseRevision: "r1", source: '"human"' });
    await expect(f.controller.execute({ kind: "property.patch", propertyId: "status", value: "different" }, { localDraftId: "property" })).rejects.toThrow(/reviewed value/); f.controller.setLocalDraft("property", { kind: "property", propertyId: "status", baseRevision: "obsolete", source: '"human"' });
    await expect(f.controller.execute({ kind: "property.patch", propertyId: "status", value: "human" }, { localDraftId: "property" })).rejects.toThrow(/latest revision/); expect(f.before).not.toHaveBeenCalled(); expect(f.commit).not.toHaveBeenCalled();
  });
  it("cancels before submission if reviewed local input changes while its ticket is being stored", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setLocalDraft("property", { kind: "property", propertyId: "status", baseRevision: "r1", source: '"first"' }); const gate = deferred<void>(); f.before.mockImplementationOnce(() => gate.promise);
    const operation = f.controller.execute({ kind: "property.patch", propertyId: "status", value: "first" }, { localDraftId: "property" }); await vi.waitFor(() => expect(f.before).toHaveBeenCalled()); f.controller.setLocalDraft("property", { kind: "property", propertyId: "status", baseRevision: "r1", source: '"later"' }); gate.resolve();
    expect((await operation).status).toBe("cancelled"); expect(f.commit).not.toHaveBeenCalled(); expect(f.controller.getState().localDrafts.property).toMatchObject({ source: '"later"' });
  });
  it("does not clear new local input when an older property receipt arrives", async () => {
    const f = fixture(); await f.controller.open(page("a")); const cache = { kind: "property", propertyId: "status", baseRevision: "r1", source: '"first"' }; f.controller.setLocalDraft("property", cache); const original = f.commit.getMockImplementation()!, gate = deferred<void>();
    f.commit.mockImplementationOnce(async request => { const result = await original(request); await gate.promise; return result; }); const operation = f.controller.execute({ kind: "property.patch", propertyId: "status", value: "first" }, { localDraftId: "property" }); await vi.waitFor(() => expect(f.commit).toHaveBeenCalled()); f.controller.setLocalDraft("property", { ...cache, source: '"later"' }); gate.resolve();
    expect((await operation).status).toBe("committed"); expect(f.controller.getState().localDrafts.property).toMatchObject({ source: '"later"' }); expect(f.controller.getState().pendingEditors).toBe(true);
  });
  it("does not clear an ABA local form that was cancelled and reopened with equal text", async () => {
    const f = fixture(); await f.controller.open(page("a")); const cache = { kind: "property", propertyId: "status", baseRevision: "r1", source: '"first"' }; f.controller.setLocalDraft("property", cache); const original = f.commit.getMockImplementation()!, gate = deferred<void>();
    f.commit.mockImplementationOnce(async request => { const result = await original(request); await gate.promise; return result; }); const operation = f.controller.execute({ kind: "property.patch", propertyId: "status", value: "first" }, { localDraftId: "property" }); await vi.waitFor(() => expect(f.commit).toHaveBeenCalled()); f.controller.setLocalDraft("property", undefined); f.controller.setLocalDraft("property", cache); gate.resolve(); await operation;
    expect(f.controller.getState().localDrafts.property).toEqual(cache); expect(f.controller.getState().pendingEditors).toBe(true);
  });
  it("restores local editor recovery and clears it only after authoritative matching lookup", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setLocalDraft("property", { kind: "property", propertyId: "status", baseRevision: "r1", source: '"done"' }); const original = f.commit.getMockImplementation()!; f.commit.mockImplementationOnce(async request => { await original(request); throw new Error("lost"); });
    await f.controller.execute({ kind: "property.patch", propertyId: "status", value: "done" }, { localDraftId: "property" }); const restored = createNotesWorkspaceController(f.host, { recovery: f.controller.getRecovery() }); expect(restored.getState().pendingEditors).toBe(true); expect((await restored.reconcile()).status).toBe("committed"); expect(restored.getState().pendingEditors).toBe(false); expect(f.commit).toHaveBeenCalledTimes(1);
  });
  it("can reopen only the cached original target after restart lookup proves non-commit", async () => {
    const f = fixture(); await f.controller.open(page("a")); f.controller.setLocalDraft("property", { kind: "property", propertyId: "status", baseRevision: "r1", source: '"retained"' }); f.commit.mockRejectedValueOnce(new Error("lost before outcome"));
    await f.controller.execute({ kind: "property.patch", propertyId: "status", value: "retained" }, { localDraftId: "property" }); const restored = createNotesWorkspaceController(f.host, { recovery: f.controller.getRecovery() }); expect((await restored.reconcile()).status).toBe("not-found");
    expect(await restored.open(page("b"))).toBe(false); expect(await restored.open(page("a"))).toBe(true); expect(restored.getState().localDrafts.property).toMatchObject({ source: '"retained"' }); expect(restored.getState().pendingEditors).toBe(true);
  });
  it("retains local cache on denied/cancelled resource outcomes and through controller disposal", async () => {
    const f = fixture(); await f.controller.open(page("a")); const cache = { baseRevision: "r1", command: { kind: "comment.add", blockId: "body", text: "draft" } }; f.controller.setLocalDraft("comment", cache); f.commit.mockImplementationOnce(async request => ({ status: "denied", target: request.target, operationId: request.operationId }));
    expect((await f.controller.execute({ kind: "comment.add", blockId: "body", text: "draft" }, { localDraftId: "comment" })).status).toBe("denied"); f.controller.dispose(); expect(f.controller.getState().localDrafts.comment).toEqual(cache);
  });
  it("invalidates navigation/latest review after any local editor activity", async () => {
    const f = fixture(); await f.controller.open(page("a")); const gate = deferred<NotesDocumentSnapshot>(); f.read.mockImplementationOnce(() => gate.promise); const navigation = f.controller.open(page("b")); f.controller.setLocalDraft("comment", { source: "human" }); f.controller.setLocalDraft("comment", undefined); gate.resolve(f.snapshots.get(f.key(page("b")))!);
    expect(await navigation).toBe(false); expect(f.controller.getState().snapshot!.target).toEqual(page("a"));
  });
  it("only explicitly backs up local drafts and retains input on host storage failure", async () => {
    const f = fixture(), persist = vi.fn(async () => {}); f.host.persistDraft = persist; await f.controller.open(page("a")); f.controller.setLocalDraft("property", { source: "not saved" }); expect(persist).not.toHaveBeenCalled(); expect(await f.controller.persistLocalDrafts()).toBe(true);
    expect(persist.mock.calls[0]?.slice(0, 3)).toMatchObject([{ actorId: "synthetic", workspaceId: "test" }, page("a"), { property: { source: "not saved" } }]); persist.mockRejectedValueOnce(new Error("quota")); expect(await f.controller.persistLocalDrafts()).toBe(false); expect(f.controller.getState().localDrafts.property).toMatchObject({ source: "not saved" }); expect(f.commit).not.toHaveBeenCalled();
  });
  it("does not claim a stale draft backup saved newer editor input", async () => {
    const f = fixture(), gate = deferred<void>(); f.host.persistDraft = vi.fn(() => gate.promise); await f.controller.open(page("a")); f.controller.setLocalDraft("property", { source: "before" }); const saving = f.controller.persistLocalDrafts(); f.controller.setLocalDraft("property", { source: "after" }); gate.resolve(); expect(await saving).toBe(false); expect(f.controller.getState().localDrafts.property).toMatchObject({ source: "after" });
  });
  it("supports composite IDs without scope-shortening and rejects unsafe JSON without invoking accessors", async () => {
    const f = fixture(); await f.controller.open(page("a")); const key = JSON.stringify(["notes-property", "d".repeat(512), "r".repeat(512), "p".repeat(512)]); f.controller.setLocalDraft(key, { source: "invalid raw input" }); expect(f.controller.getState().localDrafts[key]).toBeDefined();
    const spy = vi.fn(); expect(() => f.controller.setLocalDraft(key, { get secret() { spy(); return "x"; } })).toThrow(); expect(spy).not.toHaveBeenCalled(); expect(() => f.controller.setLocalDraft("__proto__", "bad")).toThrow(); expect(f.controller.getState().localDrafts[key]).toMatchObject({ source: "invalid raw input" });
  });
});
