/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import {
  changeNotesDrawing, createEmptyNotesDrawing, createNotesDrawingHistory, createNotesSharedBlockController, createNotesDocumentWidgetsFeature,
  hitNotesDrawingStroke, inspectNotesDrawingPayload, instantiateNotesBlockTemplate,
  NotesDrawingWidget, NotesSharedBlockWidget, NotesHtmlPresetPicker, paintNotesDrawing, renderNotesHtmlPresetPreview,
  type NotesDrawingDocument, type NotesDrawingStroke, type NotesSharedBlockHost, type NotesSharedBlockSnapshot, type NotesHtmlPreset, type NotesHtmlPresetStore
} from "../src/notes/documentWidgets.js";
import type { NotesResourceResult } from "../src/workspace/revisionedNotesResource.js";
import { createOpenEditorPowerPreset } from "../src/features/compose.js";

const stroke = (id = "one", tool: NotesDrawingStroke["tool"] = "pen"): NotesDrawingStroke => ({ id, tool, color: "#176b64", width: 4, points: [{ x: 10, y: 20 }, { x: 30, y: 40 }] });
const source = (strokes: NotesDrawingStroke[] = [stroke()]): string => JSON.stringify({ version: 1, width: 960, height: 540, strokes }, null, 2);
describe("drawing payload preservation and operations", () => {
  it("composes real public schema specs for drawing and scoped shared content", () => {
    const feature = createNotesDocumentWidgetsFeature(), preset = createOpenEditorPowerPreset({ features: [feature] as const });
    expect(preset.schema.blockSchema.oeNotesDrawing?.type).toBe("oeNotesDrawing"); expect(preset.schema.blockSchema.oeNotesSyncedBlock?.type).toBe("oeNotesSyncedBlock");
    expect(preset.schema.blockSchema.oeNotesDrawing?.propSchema.payload.default).toBe(createEmptyNotesDrawing());
  });
  it("retains the exact original string through add/move/delete/clear and Undo/Redo", () => {
    const original = source(), history = createNotesDrawingHistory(original);
    const added = history.apply(original, { kind: "add", stroke: stroke("two", "rectangle") });
    const moved = history.apply(added, { kind: "move", id: "two", dx: 100, dy: -100 });
    expect(JSON.parse(moved).strokes[1].points).toEqual([{ x: 110, y: 0 }, { x: 130, y: 20 }]);
    const deleted = history.apply(moved, { kind: "delete", id: "one" });
    const cleared = history.apply(deleted, { kind: "clear", confirmed: true });
    expect(JSON.parse(cleared).strokes).toEqual([]);
    expect(history.undo(cleared)).toBe(deleted); expect(history.undo(deleted)).toBe(moved); expect(history.undo(moved)).toBe(added); expect(history.undo(added)).toBe(original);
    expect(history.redo(original)).toBe(added); expect(history.redo(added)).toBe(moved);
  });
  it.each(["not JSON", '{"version":2,"future":"retain"}', JSON.stringify({ version: 1, width: 960, height: 540, strokes: [], futurePayload: ["do not drop"] }), " ".repeat(750_001)])("keeps invalid/unknown/oversize payload inert and exact", original => {
    const result = inspectNotesDrawingPayload(original);
    expect(result.editable).toBe(false); expect(result.original).toBe(original);
    expect(() => changeNotesDrawing(original, { kind: "clear", confirmed: true })).toThrow();
  });
  it("refuses unknown stroke/point fields, duplicate IDs, coordinates and unsafely interpreted color", () => {
    for (const value of [
      { ...stroke(), extension: { unknown: true } }, { ...stroke(), points: [{ x: 2, y: 3, pressure: 1 }] },
      { ...stroke(), points: [{ x: Infinity, y: 1 }] }, { ...stroke(), points: [{ x: -1, y: 1 }] },
      { ...stroke(), color: "url(https://example.invalid)" }, { ...stroke(), width: 33 }, { ...stroke(), tool: "script" }
    ]) expect(inspectNotesDrawingPayload(source([value as NotesDrawingStroke])).editable).toBe(false);
    expect(inspectNotesDrawingPayload(source([stroke(), stroke()])).editable).toBe(false);
  });
  it("refuses point/stroke budget overflow and does not modify the prior history", () => {
    const original = createEmptyNotesDrawing(), history = createNotesDrawingHistory(original);
    expect(() => history.apply(original, { kind: "add", stroke: { ...stroke(), points: Array.from({ length: 4097 }, () => ({ x: 1, y: 1 })) } })).toThrow();
    expect(history.getSource()).toBe(original); expect(history.canUndo()).toBe(false);
    expect(inspectNotesDrawingPayload(source(Array.from({ length: 257 }, (_, i) => stroke(String(i))))).editable).toBe(false);
    expect(inspectNotesDrawingPayload(source(Array.from({ length: 5 }, (_, i) => ({ ...stroke(String(i)), points: Array.from({ length: 4096 }, () => ({ x: 1, y: 1 })) })))).editable).toBe(false);
  });
  it("blocks clear without explicit confirmation and stale Undo after a human edit", () => {
    const original = source(), history = createNotesDrawingHistory(original), next = history.apply(original, { kind: "delete", id: "one" });
    expect(() => changeNotesDrawing(original, { kind: "clear", confirmed: false } as never)).toThrow(/Confirm/);
    expect(() => history.undo(source([stroke("human")]))).toThrow(/changed elsewhere/); expect(history.getSource()).toBe(next);
  });
  it("moves complete strokes within the board bounds without reshaping them", () => {
    const next = JSON.parse(changeNotesDrawing(source(), { kind: "move", id: "one", dx: 9999, dy: 9999 }));
    expect(next.strokes[0].points).toEqual([{ x: 940, y: 520 }, { x: 960, y: 540 }]);
    expect(() => changeNotesDrawing(source(), { kind: "move", id: "one", dx: NaN, dy: 0 })).toThrow();
  });
  it("selects the topmost line/path/shape and misses remote coordinates", () => {
    const inspected = inspectNotesDrawingPayload(source([stroke("bottom"), stroke("top", "ellipse")]));
    if (!inspected.editable) throw new Error("fixture");
    expect(hitNotesDrawingStroke(inspected.document, { x: 20, y: 30 })).toBe("top");
    expect(hitNotesDrawingStroke(inspected.document, { x: 900, y: 500 })).toBeUndefined();
  });
  it("draws validated vector data to PNG canvas without external images", () => {
    const methods = Object.fromEntries(["fillRect", "save", "restore", "beginPath", "rect", "ellipse", "arc", "fill", "moveTo", "lineTo", "stroke"].map(name => [name, vi.fn()]));
    const drawing: NotesDrawingDocument = { version: 1, width: 960, height: 540, strokes: drawingKinds() };
    paintNotesDrawing(methods as unknown as CanvasRenderingContext2D, drawing);
    expect(methods.rect).toHaveBeenCalled(); expect(methods.ellipse).toHaveBeenCalled(); expect(methods.lineTo).toHaveBeenCalled(); expect(methods.stroke).toHaveBeenCalledTimes(5);
    expect(() => paintNotesDrawing(methods as unknown as CanvasRenderingContext2D, { ...drawing, version: 2 } as never)).toThrow();
  });
});
function drawingKinds(): NotesDrawingStroke[] { return (["pen", "highlighter", "line", "rectangle", "ellipse"] as const).map((tool, i) => stroke(String(i), tool)); }

function sharedFixture() {
  let body = "Original shared text", revision = "r1", writable = true;
  const receipts = new Map<string, NotesResourceResult>();
  const host: NotesSharedBlockHost = {
    scope: { workspaceId: "workspace", actorId: "actor" },
    read: vi.fn(async sharedId => ({ sharedId, body, revision, writable, persistence: "test-only" as const })),
    beforeSubmit: vi.fn(async () => undefined),
    commit: vi.fn(async request => {
      const prior = receipts.get(request.operationId); if (prior) return prior;
      let result: NotesResourceResult;
      if (!writable) result = { status: "denied", resourceId: request.resourceId, operationId: request.operationId };
      else if (request.expectedRevision !== revision) result = { status: "conflict", resourceId: request.resourceId, operationId: request.operationId };
      else {
        if (request.change.kind !== "patch" || typeof request.change.fields.body !== "string") throw new Error("Invalid shared patch");
        body = request.change.fields.body; revision = `r${Number(revision.slice(1)) + 1}`;
        result = { status: "committed", resourceId: request.resourceId, operationId: request.operationId, snapshot: { revision, value: { body, unknownLegacy: { untouched: true } } } };
      }
      receipts.set(request.operationId, result); return result;
    }),
    lookupOperation: vi.fn(async (resourceId, operationId): Promise<NotesResourceResult> => receipts.get(operationId) ?? { status: "unknown", resourceId, operationId })
  };
  return { host, setWritable: (next: boolean) => { writable = next; }, receipts };
}
describe("shared-content durable bridge", () => {
  it("binds scope and patches only body after a durable ticket, retaining unknown host data", async () => {
    const { host } = sharedFixture(), controller = createNotesSharedBlockController(host, "shared");
    await controller.read(); controller.setDraft("Human revised text"); const result = await controller.save();
    expect(result.status).toBe("committed"); expect(controller.getState().dirty).toBe(false);
    const request = vi.mocked(host.commit).mock.calls[0]![0];
    expect(request.resourceId).toBe('["shared","workspace","actor","shared"]'); expect(request.expectedRevision).toBe("r1"); expect(request.change).toEqual({ kind: "patch", fields: { body: "Human revised text" } });
    expect(vi.mocked(host.beforeSubmit).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(host.commit).mock.invocationCallOrder[0]!);
    if (result.status === "committed") expect(result.snapshot.value).toEqual({ body: "Human revised text", unknownLegacy: { untouched: true } });
  });
  it("two views use CAS and preserve the conflicted draft rather than replacing newer content", async () => {
    const { host } = sharedFixture(), a = createNotesSharedBlockController(host, "shared"), b = createNotesSharedBlockController(host, "shared");
    await Promise.all([a.read(), b.read()]); a.setDraft("A"); b.setDraft("B"); await a.save(); expect((await b.save()).status).toBe("conflict"); expect(b.getState().draft).toBe("B"); expect(b.getState().dirty).toBe(true); await expect(b.read()).rejects.toThrow(/retain/); b.discardDraft(); await b.read(); expect(b.getState().draft).toBe("A"); expect(host.commit).toHaveBeenCalledTimes(2);
  });
  it("checks host denial without losing human input or displaying a success", async () => {
    const { host, setWritable } = sharedFixture(), c = createNotesSharedBlockController(host, "shared");
    await c.read(); c.setDraft("Human text"); setWritable(false); expect((await c.save()).status).toBe("denied"); expect(c.getState().draft).toBe("Human text"); expect(c.getState().message).toContain("denied");
  });
  it("cancels before submission and never writes, while preserving the draft", async () => {
    const { host } = sharedFixture(); let ticket!: () => void; host.beforeSubmit = vi.fn(() => new Promise<void>(resolve => { ticket = resolve; }));
    const c = createNotesSharedBlockController(host, "shared"); await c.read(); c.setDraft("Keep draft"); const pending = c.save(); await Promise.resolve(); c.cancel(); ticket();
    expect((await pending).status).toBe("cancelled"); expect(host.commit).not.toHaveBeenCalled(); expect(c.getState().draft).toBe("Keep draft"); expect(c.getRecovery()).toBeUndefined();
  });
  it("a lost acknowledgement blocks resend and recovers only via matching authoritative receipt", async () => {
    const { host } = sharedFixture(), commit = host.commit; host.commit = vi.fn(async (request, signal) => { await commit(request, signal); throw new Error("ACK lost"); });
    const c = createNotesSharedBlockController(host, "shared"); await c.read(); c.setDraft("Saved once"); expect((await c.save()).status).toBe("unknown"); const recovery = c.getRecovery(); expect(recovery).toBeDefined();
    await expect(c.save()).rejects.toThrow(/cannot/); await expect(c.read()).rejects.toThrow(/retain/); expect((await c.reconcile()).status).toBe("committed"); expect(host.commit).toHaveBeenCalledTimes(1); expect(host.lookupOperation).toHaveBeenCalledTimes(1); expect(c.getState().draft).toBe("Saved once");
    const restored = createNotesSharedBlockController(host, "shared", { recovery }); expect((await restored.reconcile()).status).toBe("committed"); expect(restored.getRecovery()).toBeUndefined(); expect(restored.getState().snapshot?.writable).toBe(false);
  });
  it("failed durable ticket never submits; mismatched receipts remain unresolved", async () => {
    const { host } = sharedFixture(); host.beforeSubmit = vi.fn(async () => { throw new Error("Journal unavailable"); });
    const c = createNotesSharedBlockController(host, "shared"); await c.read(); c.setDraft("draft"); expect((await c.save()).status).toBe("cancelled"); expect(host.commit).not.toHaveBeenCalled();
    const fixture = sharedFixture(); fixture.host.commit = vi.fn(async (): Promise<NotesResourceResult> => ({ status: "committed", resourceId: "wrong", operationId: "wrong", snapshot: { revision: "r2", value: { body: "draft" } } }));
    const other = createNotesSharedBlockController(fixture.host, "shared"); await other.read(); other.setDraft("draft"); expect((await other.save()).status).toBe("unknown"); expect(other.getRecovery()).toBeDefined();
  });
  it("cancelled/disposed reads and writes cannot update a replaced widget state", async () => {
    const { host } = sharedFixture(); let resolve!: (value: Awaited<ReturnType<typeof host.read>>) => void;
    host.read = vi.fn(() => new Promise<NotesSharedBlockSnapshot>(r => { resolve = r; })); const c = createNotesSharedBlockController(host, "shared"); const read = c.read(); c.cancel(); resolve({ sharedId: "shared", revision: "r2", body: "Late result", writable: true, persistence: "test-only" }); await read; expect(c.getState().draft).toBe(""); expect(c.getState().status).toBe("empty");
    const next = c.read(); c.dispose(); resolve({ sharedId: "shared", revision: "r3", body: "Late after dispose", writable: true, persistence: "test-only" }); await next; expect(c.getState().draft).toBe("");
  });
  it("holds oversize shared data inert without truncating or claiming edit permission", async () => {
    const { host } = sharedFixture(); host.read = vi.fn(async (sharedId): Promise<NotesSharedBlockSnapshot> => ({ sharedId, revision: "r1", body: "x".repeat(100001), writable: true, persistence: "local-only" }));
    const c = createNotesSharedBlockController(host, "shared"); await c.read(); expect(c.getState().status).toBe("error"); expect(host.commit).not.toHaveBeenCalled();
  });
  it("refuses a changed host actor/workspace without submitting the old scoped draft", async () => {
    const { host } = sharedFixture(), c = createNotesSharedBlockController(host, "shared"); await c.read(); c.setDraft("Keep previous actor's draft"); host.scope.actorId = "different-actor";
    await expect(c.save()).rejects.toThrow(/scope changed/); expect(host.commit).not.toHaveBeenCalled(); expect(c.getState().draft).toBe("Keep previous actor's draft"); expect(() => c.setDraft("new actor edit")).toThrow(/scope changed/);
  });
});

describe("templates and safe HTML source", () => {
  it("assigns new structural IDs and keeps all page/sync/unknown fields exactly", () => {
    const original = { id: "original", type: "paragraph", props: { pageId: "page", syncID: "shared", sourceId: "source", unknown: { x: 1 } }, children: [{ id: "child", type: "custom", unknownPayload: ["keep"] }] };
    let id = 0; const instantiated = instantiateNotesBlockTemplate(original, () => `new-${++id}`);
    expect(instantiated).toEqual({ ...original, id: "new-1", children: [{ ...original.children[0], id: "new-2" }] }); expect(original.id).toBe("original");
    expect(() => instantiateNotesBlockTemplate(original, () => "duplicate")).toThrow(/unique/); expect(() => instantiateNotesBlockTemplate({ type: "paragraph", children: "bad" })).toThrow();
  });
  it("rejects unsafe/oversize/deep template structures instead of dropping fields", () => {
    expect(() => instantiateNotesBlockTemplate({ type: "paragraph", extension: () => "secret" })).toThrow();
    let nested: unknown = { type: "paragraph" }; for (let i = 0; i < 18; i++) nested = { type: "paragraph", children: [nested] };
    expect(() => instantiateNotesBlockTemplate(nested)).toThrow(/budget/);
  });
  it("reuses isolated no-script/no-network HTML preview while preserving JS source", () => {
    const value = { html: '<p>note</p><script>alert(1)</script><img src="https://example.invalid">', css: "p{color:red}", javascript: "retainExactSource()" };
    const preview = renderNotesHtmlPresetPreview(value); expect(preview).toContain("script-src 'none'"); expect(preview).toContain("connect-src 'none'"); expect(preview).not.toContain("alert(1)"); expect(preview).not.toContain("example.invalid"); expect(value.javascript).toBe("retainExactSource()");
  });
});

it("real React drawing controls confirm clear, cancel gestures and restore exact original with Undo", () => {
  const global = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }; const prior = global.IS_REACT_ACT_ENVIRONMENT; global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); let saved = source(); const original = saved, changes = vi.fn();
  const render = (): void => root.render(createElement(NotesDrawingWidget, { source: saved, onChange: (next: string, expected: string) => { expect(expected).toBe(saved); saved = next; changes(next); render(); } }));
  const click = (label: string): void => { const button = [...container.querySelectorAll("button")].find(button => button.textContent === label); if (!button) throw new Error(`Button ${label}`); act(() => button.click()); };
  try {
    act(render); click("Clear drawing"); click("Cancel clear"); expect(changes).not.toHaveBeenCalled(); click("Clear drawing"); click("Confirm clear"); expect(JSON.parse(saved).strokes).toEqual([]); click("Undo drawing"); expect(saved).toBe(original);
    const svg = container.querySelector("svg")!; svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 540 } as DOMRect);
    const pointer = (type: string, x: number, y: number): void => { const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }); Object.defineProperty(event, "pointerId", { value: 1 }); act(() => svg.dispatchEvent(event)); };
    const calls = changes.mock.calls.length; pointer("pointerdown", 100, 100); pointer("pointermove", 120, 120); pointer("pointercancel", 120, 120); pointer("pointerup", 120, 120); expect(changes).toHaveBeenCalledTimes(calls); expect(saved).toBe(original);
    for (const tool of ["pen", "highlighter", "line", "rectangle", "ellipse"]) { click(tool); pointer("pointerdown", 100, 100); pointer("pointermove", 120, 120); pointer("pointerup", 140, 140); const added = JSON.parse(saved).strokes.at(-1); expect(added.tool).toBe(tool); expect(added.points.at(-1)).toEqual({ x: 140, y: 140 }); click("Undo drawing"); expect(saved).toBe(original); }
    click("eraser"); pointer("pointerdown", 20, 30); pointer("pointermove", 25, 35); pointer("pointercancel", 25, 35); expect(saved).toBe(original); pointer("pointerdown", 20, 30); pointer("pointerup", 20, 30); expect(JSON.parse(saved).strokes).toEqual([]); click("Undo drawing"); expect(saved).toBe(original);
    click("select"); pointer("pointerdown", 20, 30); pointer("pointerup", 20, 30); act(() => svg.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }))); expect(JSON.parse(saved).strokes[0].points[0].x).toBe(11); act(() => svg.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Delete" }))); expect(JSON.parse(saved).strokes).toEqual([]); click("Undo drawing"); click("Undo drawing"); expect(saved).toBe(original);
  } finally { act(() => root.unmount()); container.remove(); global.IS_REACT_ACT_ENVIRONMENT = prior; }
});

it("a changed HTML preset host drops the former scope's entries and ignores delayed former reads", async () => {
  const global = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }; const prior = global.IS_REACT_ACT_ENVIRONMENT; global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); const source = { html: "<p>current note</p>", css: "", javascript: "preservedJS" }, onApply = vi.fn();
  let finish!: (records: NotesHtmlPreset[]) => void;
  const a: NotesHtmlPresetStore = { list: () => new Promise(resolve => { finish = resolve; }), save: vi.fn(async () => { throw new Error("not invoked"); }) };
  const b: NotesHtmlPresetStore = { list: vi.fn(async () => { throw new Error("New scope unavailable"); }), save: vi.fn(async () => { throw new Error("not invoked"); }) };
  try {
    await act(async () => root.render(createElement(NotesHtmlPresetPicker, { store: a, source, onApply })));
    await act(async () => root.render(createElement(NotesHtmlPresetPicker, { store: b, source, onApply })));
    await act(async () => finish([{ id: "former", revision: "r1", title: "Former scope preset", source: { html: "<p>former</p>", css: "", javascript: "" } }]));
    expect(container.textContent).not.toContain("Former scope preset"); expect(container.textContent).toContain("New scope unavailable"); expect(onApply).not.toHaveBeenCalled(); expect(a.save).not.toHaveBeenCalled();
  } finally { act(() => root.unmount()); container.remove(); global.IS_REACT_ACT_ENVIRONMENT = prior; }
});

it("the shared React widget respects document read-only and composition even when its host permits shared writes", async () => {
  const global = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }; const prior = global.IS_REACT_ACT_ENVIRONMENT; global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); const { host } = sharedFixture(), controller = createNotesSharedBlockController(host, "shared"); await controller.read(); controller.setDraft("Human composition");
  const save = (): HTMLButtonElement => [...container.querySelectorAll("button")].find(button => button.textContent === "Save shared content")!;
  try {
    await act(async () => root.render(createElement(NotesSharedBlockWidget, { controller, readOnly: true })));
    expect(container.querySelector("textarea")!.disabled).toBe(true); expect(save().disabled).toBe(true); act(() => save().click()); expect(host.commit).not.toHaveBeenCalled();
    await act(async () => root.render(createElement(NotesSharedBlockWidget, { controller, readOnly: false })));
    act(() => container.querySelector("textarea")!.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))); expect(save().disabled).toBe(true); act(() => save().click()); expect(host.commit).not.toHaveBeenCalled();
    act(() => container.querySelector("textarea")!.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }))); expect(save().disabled).toBe(false); await act(async () => save().click()); expect(host.commit).toHaveBeenCalledTimes(1); expect(controller.getState().dirty).toBe(false);
  } finally { act(() => root.unmount()); controller.dispose(); container.remove(); global.IS_REACT_ACT_ENVIRONMENT = prior; }
});
