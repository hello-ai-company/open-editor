/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorDocument, type JsonValue } from "@hello-ai-company/editor-core";
import { NotesDatabaseProperties } from "../src/react/NotesDatabaseProperties.js";
import { NotesDatabaseSchema } from "../src/react/NotesDatabaseSchema.js";
import { NOTES_DATABASE_PROPERTY_KINDS, notesPropertyAuthority, parseNotesDatabasePropertyDefinition, validateNotesDatabasePropertyValue, type NotesDatabasePropertyDefinition } from "../src/notes/propertyCatalog.js";
import { createNotesWorkspaceController } from "../src/notes/controller.js";
import type { NotesCommandKind, NotesCommandRequest, NotesCommandResult, NotesDocumentSnapshot, NotesMutationEvidence, NotesWorkspaceHost } from "../src/notes/contracts.js";

const scope = { actorId: "synthetic-actor", workspaceId: "synthetic-workspace" };
const target = { kind: "row", databaseId: "db", rowId: "row" } as const;
const kinds: NotesCommandKind[] = ["property.patch", "schema.create-property", "schema.update-property", "schema.delete-property", "schema.reorder-properties", "database.action"];
const definition = (type: string, id = type): NotesDatabasePropertyDefinition => ({ id, name: id, type, options: [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }], config: {} });
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function fixture(capabilities = kinds) {
  let snapshot: NotesDocumentSnapshot = { scope, target, revision: "r1", contentRevision: "c1", title: "Synthetic row", document: createEditorDocument([]), metadata: { properties: { text: "old" }, future: { retained: true } }, capabilities, capabilitySemantics: Object.fromEntries(capabilities.map(kind => [kind, "test-only"])) };
  let serial = 1;
  let properties = [definition("text"), definition("number")].map(property => ({ ...property, extra: { keep: true } }) as unknown as Record<string, JsonValue>);
  const receipts = new Map<string, NotesCommandResult>();
  const commit = vi.fn(async (request: NotesCommandRequest): Promise<NotesCommandResult> => {
    if (request.expectedRevision !== snapshot.revision) return { status: "conflict", target, operationId: request.operationId };
    snapshot = copy(snapshot);
    if (request.command.kind === "property.patch") snapshot.metadata.properties = { ...(snapshot.metadata.properties as Record<string, JsonValue>), [request.command.propertyId]: request.command.value };
    snapshot.revision = `r${++serial}`;
    let evidence: NotesMutationEvidence | undefined;
    const command = request.command;
    if (command.kind === "schema.create-property") properties = [...properties, copy(command.definition)];
    if (command.kind === "schema.update-property") properties = properties.map(property => property.id === command.propertyId ? { ...property, ...copy(command.fields) } : property);
    if (command.kind === "schema.delete-property") properties = properties.filter(property => property.id !== command.propertyId);
    if (command.kind === "schema.reorder-properties") properties = command.propertyIds.map(id => properties.find(property => property.id === id)!);
    if (command.kind === "schema.create-property" || command.kind === "schema.update-property" || command.kind === "schema.delete-property" || command.kind === "schema.reorder-properties") evidence = { kind: command.kind, databaseId: "db", revision: `s${serial}`, properties: copy(properties), complete: true };
    if (command.kind === "database.action") evidence = { kind: command.kind, databaseId: command.databaseId, rowId: command.rowId, actionId: command.actionId, revision: `a${serial}`, result: { synthetic: true } };
    const result: NotesCommandResult = { status: "committed", target, operationId: request.operationId, snapshot: copy(snapshot), historyId: `h${serial}`, persistence: "test-only", ...(evidence ? { evidence } : {}) };
    receipts.set(request.operationId, result); return result;
  });
  const beforeSubmit = vi.fn(async () => {}), lookupOperation = vi.fn(async (_target, operationId: string) => receipts.get(operationId)!);
  const host: NotesWorkspaceHost = { scope, readDocument: async () => copy(snapshot), beforeSubmit, commit, lookupOperation };
  const controller = createNotesWorkspaceController(host);
  return { controller, commit, beforeSubmit, lookupOperation, host };
}
let cleanup: (() => void) | undefined;
function mount(element: ReturnType<typeof createElement>) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  act(() => root.render(element));
  cleanup = () => { act(() => root.unmount()); container.remove(); delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT; };
  return { container, render: (next: ReturnType<typeof createElement>) => act(() => root.render(next)) };
}
afterEach(() => { cleanup?.(); cleanup = undefined; });
function click(container: HTMLElement, label: string) { const button = [...container.querySelectorAll("button")].find(button => button.textContent === label); expect(button).toBeDefined(); act(() => button!.click()); }
function change(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  act(() => { const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
async function submit(form: HTMLFormElement) { await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await Promise.resolve(); }); }

describe("all 22 Notes database properties", () => {
  it("classifies every observed kind without normalizing unknown definitions", () => {
    expect(NOTES_DATABASE_PROPERTY_KINDS).toHaveLength(22);
    const counts = { editable: 0, "host-picker": 0, "host-computed": 0, action: 0, unknown: 0 };
    for (const kind of NOTES_DATABASE_PROPERTY_KINDS) counts[notesPropertyAuthority(definition(kind))]++;
    expect(counts).toEqual({ editable: 10, "host-picker": 4, "host-computed": 7, action: 1, unknown: 0 });
    const unknown = { id: "future", name: "Future", type: "future_kind", options: { opaque: true }, config: ["legacy"], future: { nested: [1, false] } };
    const preserved = parseNotesDatabasePropertyDefinition(unknown);
    expect(preserved).toEqual(unknown); expect(notesPropertyAuthority(preserved)).toBe("unknown");
    expect(() => validateNotesDatabasePropertyValue(preserved, { anything: true })).toThrow(/読取専用/);
  });
  const editable: [string, JsonValue][] = [["text", "A"], ["number", 1.5], ["select", "a"], ["multi_select", ["a", "b"]], ["status", "b"], ["date", "2024-02-29"], ["checkbox", false], ["url", "https://example.invalid/a"], ["email", "a@example.invalid"], ["phone", "+81 000"]];
  it.each(editable)("validates %s without converting values", (kind, value) => { expect(validateNotesDatabasePropertyValue(definition(kind), value)).toEqual(value); expect(validateNotesDatabasePropertyValue(definition(kind), null)).toBe(null); });
  it("validates typed provider references without unscoped URLs, duplicate IDs or external execution", () => {
    expect(validateNotesDatabasePropertyValue(definition("user"), [{ id: "u1", label: "Synthetic" }])).toEqual([{ id: "u1", label: "Synthetic" }]);
    expect(validateNotesDatabasePropertyValue(definition("files"), [{ assetId: "f1", name: "Sample" }])).toEqual([{ assetId: "f1", name: "Sample" }]);
    expect(validateNotesDatabasePropertyValue(definition("relation"), ["p1"])).toEqual(["p1"]);
    expect(validateNotesDatabasePropertyValue(definition("location"), { latitude: 0, longitude: 180, label: "Synthetic" })).toEqual({ latitude: 0, longitude: 180, label: "Synthetic" });
    for (const [kind, value] of [["user", [{ id: "u", role: "admin" }]], ["files", [{ assetId: "f", url: "https://example.invalid" }]], ["relation", ["p", "p"]], ["location", { latitude: 91, longitude: 0 }], ["date", "2024-02-30"], ["number", "2"], ["multi_select", ["other"]], ["url", "javascript:alert(1)"]] as [string, unknown][]) expect(() => validateNotesDatabasePropertyValue(definition(kind), value)).toThrow();
    for (const kind of ["formula", "rollup", "created_time", "created_by", "last_edited_time", "last_edited_by", "id", "button"]) expect(() => validateNotesDatabasePropertyValue(definition(kind), "x")).toThrow(/読取専用/);
  });
  it("retains extra schema keys and validates bounded option/config formats without evaluating expressions", () => {
    const record = { ...definition("formula"), config: { expression: "process.exit()", future: { retained: true } }, extra: ["keep"] };
    expect(parseNotesDatabasePropertyDefinition(record)).toEqual(record);
    expect(() => parseNotesDatabasePropertyDefinition({ ...definition("select"), options: [{ id: "a", label: "A" }, { id: "a", label: "B" }] })).toThrow();
    expect(() => parseNotesDatabasePropertyDefinition({ ...definition("number"), config: { numberFormat: "unknown" } })).toThrow();
    expect(() => parseNotesDatabasePropertyDefinition({ ...definition("rollup"), config: { aggregation: ["sum"] } })).toThrow();
    expect(parseNotesDatabasePropertyDefinition({ ...definition("number"), config: { numberFormat: "currency", currency: "JPY" } }).config).toEqual({ numberFormat: "currency", currency: "JPY" });
  });
  it("renders every kind and keeps unavailable host editors/actions and all audit values inert", async () => {
    const f = fixture([]); await f.controller.open(target);
    const unknown = { ...definition("future_kind"), opaque: { kept: true } };
    const { container } = mount(createElement(NotesDatabaseProperties, { databaseId: "db", rowId: "row", controller: f.controller, definitions: [...NOTES_DATABASE_PROPERTY_KINDS.map(kind => definition(kind)), unknown], values: {} }));
    expect(container.querySelectorAll("form")).toHaveLength(23);
    expect(container.querySelectorAll("output")).toHaveLength(13);
    expect([...container.querySelectorAll("button")].filter(button => button.type === "submit" || button.textContent === "操作を確認して実行").every(button => button.disabled)).toBe(true);
    expect(container.textContent).toContain("未対応の定義と値をそのまま保持"); expect(f.commit).not.toHaveBeenCalled();
  });
  it("sends one exact property patch and preserves unrelated canonical fields after reload", async () => {
    const f = fixture(); await f.controller.open(target);
    const { container } = mount(createElement(NotesDatabaseProperties, { databaseId: "db", rowId: "row", controller: f.controller, definitions: [definition("text")], values: { text: "old" } }));
    change(container.querySelector("textarea")!, "new"); await submit(container.querySelector("form")!);
    expect(f.commit.mock.calls[0]![0].command).toEqual({ kind: "property.patch", propertyId: "text", value: "new" }); expect(f.beforeSubmit).toHaveBeenCalledTimes(1);
    await act(async () => { await f.controller.open(target); });
    expect(f.controller.getState().snapshot!.metadata).toEqual({ properties: { text: "new" }, future: { retained: true } });
  });
  it("invalid input stays typed and never reaches the host; Escape cancels without saving", async () => {
    const f = fixture(); await f.controller.open(target); const onCancel = vi.fn();
    const { container } = mount(createElement(NotesDatabaseProperties, { databaseId: "db", rowId: "row", controller: f.controller, definitions: [definition("number")], values: { number: 3 }, onCancel }));
    const input = container.querySelector("input")!; change(input, "2oops"); await submit(container.querySelector("form")!);
    expect(input.value).toBe("2oops"); expect(f.commit).not.toHaveBeenCalled(); expect(container.textContent).toContain("有限の数値");
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, isComposing: true }))); expect(input.value).toBe("2oops");
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))); expect(input.value).toBe("3"); expect(onCancel).toHaveBeenCalledTimes(1);
  });
  it.each(["conflict", "denied", "rejected"] as const)("retains the draft on %s without optimistic row replacement", async status => {
    const f = fixture(); await f.controller.open(target); f.commit.mockImplementationOnce(async request => ({ status, target, operationId: request.operationId }));
    const { container } = mount(createElement(NotesDatabaseProperties, { databaseId: "db", rowId: "row", controller: f.controller, definitions: [definition("text")], values: { text: "old" } }));
    change(container.querySelector("textarea")!, "keep"); await submit(container.querySelector("form")!);
    expect(container.querySelector("textarea")!.value).toBe("keep"); expect(f.controller.getState().snapshot!.metadata.properties).toEqual({ text: "old" });
    expect(f.controller.getState().pendingEditors).toBe(true); click(container, "最新値に戻す"); expect(f.controller.getState().pendingEditors).toBe(false); expect(container.querySelector("textarea")!.value).toBe("old");
  });
  it("suppresses writes for another row/database and preserves drafts when the revision changes", async () => {
    const f = fixture(); await f.controller.open(target);
    const props = { databaseId: "other", rowId: "row", controller: f.controller, definitions: [definition("text")], values: { text: "old" } };
    const { container, render } = mount(createElement(NotesDatabaseProperties, props)); expect(container.querySelector("textarea")!.disabled).toBe(true);
    render(createElement(NotesDatabaseProperties, { ...props, databaseId: "db" })); change(container.querySelector("textarea")!, "keep");
    await act(async () => { f.controller.setLocalDraft("other-form", { kind: "property", propertyId: "another", baseRevision: "r1", source: '"remote"' }); await f.controller.execute({ kind: "property.patch", propertyId: "another", value: "remote" }, { localDraftId: "other-form" }); });
    expect(container.querySelector("textarea")!.value).toBe("keep"); expect(container.textContent).toContain("別の変更を検出");
    expect([...container.querySelectorAll("button")].find(button => button.type === "submit")!.disabled).toBe(true);
  });
  it("uses explicit provider selection as a draft and cancels without committing", async () => {
    const f = fixture(); await f.controller.open(target); const pick = vi.fn(async () => [{ assetId: "asset", name: "Synthetic" }]);
    const { container } = mount(createElement(NotesDatabaseProperties, { databaseId: "db", rowId: "row", controller: f.controller, definitions: [definition("files")], values: { files: [] }, adapters: { files: { pick } } }));
    expect(pick).not.toHaveBeenCalled(); await act(async () => { click(container, "選択する"); await Promise.resolve(); });
    expect(container.querySelector("output")!.textContent).toBe('[{"assetId":"asset","name":"Synthetic"}]'); expect(f.commit).not.toHaveBeenCalled(); await submit(container.querySelector("form")!);
    expect(f.commit.mock.calls[0]![0].command).toEqual({ kind: "property.patch", propertyId: "files", value: [{ assetId: "asset", name: "Synthetic" }] });
  });
  it("cancels an in-flight host picker and ignores a late result without replacing the existing value", async () => {
    const f = fixture(); await f.controller.open(target); let resolve!: (value: { id: string }[]) => void; let signal!: AbortSignal;
    const pick = vi.fn(async (request: { signal: AbortSignal }) => { signal = request.signal; return new Promise<{ id: string }[]>(done => { resolve = done; }); });
    const { container } = mount(createElement(NotesDatabaseProperties, { databaseId: "db", rowId: "row", controller: f.controller, definitions: [definition("user")], values: { user: [{ id: "existing" }] }, adapters: { user: { pick } } }));
    click(container, "選択する"); click(container, "選択をキャンセル"); expect(signal.aborted).toBe(true);
    await act(async () => { resolve([{ id: "late" }]); await Promise.resolve(); });
    expect(container.querySelector("output")!.textContent).toBe('[{"id":"existing"}]'); expect(f.commit).not.toHaveBeenCalled();
  });
  it("runs a configured button only through a scoped host command and remains usable after its confirmed receipt", async () => {
    const f = fixture(); await f.controller.open(target); const button = { ...definition("button"), config: { actionId: "synthetic-action", label: "確認して実行" } };
    const { container } = mount(createElement(NotesDatabaseProperties, { databaseId: "db", rowId: "row", controller: f.controller, definitions: [button], values: { button: null } }));
    expect(f.commit).not.toHaveBeenCalled();
    await act(async () => { click(container, "確認して実行"); await Promise.resolve(); });
    expect(f.commit.mock.calls[0]![0].command).toEqual({ kind: "database.action", databaseId: "db", rowId: "row", actionId: "synthetic-action" });
    expect([...container.querySelectorAll("button")].find(item => item.textContent === "確認して実行")!.disabled).toBe(false);
    await act(async () => { click(container, "確認して実行"); await Promise.resolve(); }); expect(f.commit).toHaveBeenCalledTimes(2);
  });
  it("lost ACK disables resend and performs operation lookup only", async () => {
    const f = fixture(); await f.controller.open(target); const original = f.commit.getMockImplementation()!;
    f.commit.mockImplementationOnce(async request => { await original(request); throw new Error("lost ACK"); });
    const { container } = mount(createElement(NotesDatabaseProperties, { databaseId: "db", rowId: "row", controller: f.controller, definitions: [definition("text")], values: { text: "old" } }));
    change(container.querySelector("textarea")!, "durable"); await submit(container.querySelector("form")!);
    expect(container.querySelector("textarea")!.value).toBe("durable"); expect(f.controller.getState().status).toBe("unknown");
    await submit(container.querySelector("form")!); expect(f.commit).toHaveBeenCalledTimes(1);
    await act(async () => { click(container, "保存結果を照会"); await Promise.resolve(); }); expect(f.lookupOperation).toHaveBeenCalledTimes(1); expect(f.commit).toHaveBeenCalledTimes(1);
    expect(f.controller.getState().pendingEditors).toBe(false);
  });
  it("retains a typed property across unmount/remount and blocks Back until explicit cancellation", async () => {
    const f = fixture(); await f.controller.open(target);
    const element = createElement(NotesDatabaseProperties, { databaseId: "db", rowId: "row", controller: f.controller, definitions: [definition("number")], values: { number: 3 } });
    const { container, render } = mount(element); change(container.querySelector("input")!, "invalid number");
    expect(f.controller.getState().pendingEditors).toBe(true); expect(await f.controller.open({ kind: "page", pageId: "back" })).toBe(false);
    render(createElement("div")); expect(f.controller.getState().pendingEditors).toBe(true); render(element);
    expect(container.querySelector("input")!.value).toBe("invalid number");
    click(container, "最新値に戻す"); expect(f.controller.getState().pendingEditors).toBe(false); expect(container.querySelector("input")!.value).toBe("3"); expect(f.commit).not.toHaveBeenCalled();
  });
  it("keeps the composing property input enabled and blocks save and navigation until composition finishes", async () => {
    const f = fixture(); await f.controller.open(target);
    const { container } = mount(createElement(NotesDatabaseProperties, { databaseId: "db", rowId: "row", controller: f.controller, definitions: [definition("text")], values: { text: "old" } }));
    const input = container.querySelector("textarea")!;
    act(() => input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
    expect(f.controller.getState().composing).toBe(true); expect(input.disabled).toBe(false); change(input, "日本語");
    await submit(container.querySelector("form")!); expect(f.commit).not.toHaveBeenCalled(); expect(await f.controller.open({ kind: "page", pageId: "back" })).toBe(false);
    act(() => input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })));
    await submit(container.querySelector("form")!); expect(f.commit).toHaveBeenCalledTimes(1); expect(f.controller.getState().pendingEditors).toBe(false);
  });
  it("confirmed delayed saves cannot clear or replace a newer cached property draft", async () => {
    const f = fixture(); await f.controller.open(target); const original = f.commit.getMockImplementation()!; let finish!: () => void;
    f.commit.mockImplementationOnce(async request => { const receipt = await original(request); await new Promise<void>(done => { finish = done; }); return receipt; });
    const element = createElement(NotesDatabaseProperties, { databaseId: "db", rowId: "row", controller: f.controller, definitions: [definition("text")], values: { text: "old" } });
    const { container, render } = mount(element);
    change(container.querySelector("textarea")!, "reviewed");
    await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await Promise.resolve(); });
    const key = Object.keys(f.controller.getState().localDrafts)[0]!;
    const reviewed = f.controller.getState().localDrafts[key] as Record<string, JsonValue>;
    act(() => f.controller.setLocalDraft(key, { ...reviewed, source: '"new input"', presentation: { draft: "new input", base: { revision: "r1", definition: JSON.stringify(definition("text")), value: "old" } } }));
    await act(async () => { finish(); await Promise.resolve(); });
    expect(f.controller.getState().pendingEditors).toBe(true);
    expect((f.controller.getState().localDrafts[key] as Record<string, JsonValue>).source).toBe('"new input"');
    expect(container.querySelector("textarea")!.value).toBe("reviewed");
    // A remount restores the newer cache, while the old callback leaves it untouched.
    render(createElement("div")); render(element); expect(container.querySelector("textarea")!.value).toBe("new input");
  });
});

describe("Notes database schema commands", () => {
  it("exposes all 22 kinds, preserves unknown records, and emits exact create settings", async () => {
    const f = fixture(); await f.controller.open(target); const unknown = { ...definition("future_kind", "unknown"), extra: { keep: true } };
    const { container } = mount(createElement(NotesDatabaseSchema, { databaseId: "db", schema: { revision: "s1", properties: [unknown] }, controller: f.controller }));
    expect([...container.querySelectorAll("button")].find(button => button.textContent === "設定: unknown")!.disabled).toBe(true);
    click(container, "プロパティを追加"); expect(container.querySelectorAll("select option")).toHaveLength(22);
    change(container.querySelector('[aria-label="プロパティID"]') as HTMLInputElement, "new-property"); change(container.querySelector('[aria-label="プロパティ名"]') as HTMLInputElement, "New property");
    await submit(container.querySelector("form")!); expect(f.commit.mock.calls[0]![0].command).toEqual({ kind: "schema.create-property", databaseId: "db", expectedSchemaRevision: "s1", definition: { id: "new-property", name: "New property", type: "text", readOnly: false, options: [], config: {} } }); expect(unknown.extra).toEqual({ keep: true });
  });
  it("updates only named settings without copying unknown schema fields or row values", async () => {
    const f = fixture(); await f.controller.open(target); const property = { ...definition("text"), extra: { keep: true } };
    const { container } = mount(createElement(NotesDatabaseSchema, { databaseId: "db", schema: { revision: "s1", properties: [property] }, controller: f.controller }));
    click(container, "設定: text"); change(container.querySelector('[aria-label="プロパティ名"]') as HTMLInputElement, "Renamed"); await submit(container.querySelector("form")!);
    expect(f.commit.mock.calls[0]![0].command).toMatchObject({ kind: "schema.update-property", propertyId: "text", expectedSchemaRevision: "s1", fields: { name: "Renamed" } });
    const command = f.commit.mock.calls[0]![0].command; expect(command.kind === "schema.update-property" && command.fields.extra).toBeUndefined();
  });
  it("requires deletion review and persists keyboard-accessible sibling reorder intent", async () => {
    const f = fixture(); await f.controller.open(target);
    const { container } = mount(createElement(NotesDatabaseSchema, { databaseId: "db", schema: { revision: "s1", properties: [definition("text"), definition("number")] }, controller: f.controller }));
    click(container, "削除: text"); expect(f.commit).not.toHaveBeenCalled(); click(container, "キャンセル"); expect(f.commit).not.toHaveBeenCalled();
    await act(async () => { const button = container.querySelector('[aria-label="numberを上へ"]') as HTMLButtonElement; button.click(); await Promise.resolve(); });
    expect(f.commit.mock.calls[0]![0].command).toEqual({ kind: "schema.reorder-properties", databaseId: "db", propertyIds: ["number", "text"], expectedSchemaRevision: "s1" });
    click(container, "削除: text"); await act(async () => { click(container, "確認して削除"); await Promise.resolve(); }); expect(f.commit.mock.calls[1]![0].command.kind).toBe("schema.delete-property");
  });
  it("retains invalid schema input and stale drafts; cancellation never emits a mutation", async () => {
    const f = fixture(); await f.controller.open(target); const schema = { revision: "s1", properties: [definition("text")] };
    const { container, render } = mount(createElement(NotesDatabaseSchema, { databaseId: "db", schema, controller: f.controller }));
    click(container, "設定: text"); const config = container.querySelector('[aria-label="プロパティ設定のJSON"]') as HTMLTextAreaElement; change(config, "bad JSON"); await submit(container.querySelector("form")!);
    expect(config.value).toBe("bad JSON"); expect(f.commit).not.toHaveBeenCalled();
    render(createElement(NotesDatabaseSchema, { databaseId: "db", schema: { ...schema, revision: "s2" }, controller: f.controller })); expect(config.value).toBe("bad JSON"); expect(container.textContent).toContain("別の設定変更");
    click(container, "キャンセル"); expect(container.querySelector("form")).toBeNull(); expect(f.commit).not.toHaveBeenCalled();
  });
  it("restores invalid schema drafts after remount and keeps row leave blocked until explicit cancel", async () => {
    const f = fixture(); await f.controller.open(target); const schema = { revision: "s1", properties: [definition("text")] };
    const element = createElement(NotesDatabaseSchema, { databaseId: "db", schema, controller: f.controller });
    const { container, render } = mount(element); click(container, "設定: text"); change(container.querySelector('[aria-label="プロパティ設定のJSON"]') as HTMLTextAreaElement, "unfinished {");
    expect(f.controller.getState().pendingEditors).toBe(true); expect(await f.controller.open({ kind: "page", pageId: "back" })).toBe(false);
    render(createElement("div")); render(element);
    expect((container.querySelector('[aria-label="プロパティ設定のJSON"]') as HTMLTextAreaElement).value).toBe("unfinished {");
    click(container, "キャンセル"); expect(f.controller.getState().pendingEditors).toBe(false); expect(f.commit).not.toHaveBeenCalled();
  });
  it.each(["conflict", "denied"] as const)("allows an explicit schema cancellation after %s without losing other canonical values", async status => {
    const f = fixture(); await f.controller.open(target); f.commit.mockImplementationOnce(async request => ({ status, target, operationId: request.operationId }));
    const { container } = mount(createElement(NotesDatabaseSchema, { databaseId: "db", schema: { revision: "s1", properties: [definition("text")] }, controller: f.controller }));
    click(container, "設定: text"); change(container.querySelector('[aria-label="プロパティ名"]') as HTMLInputElement, "Retain until cancel"); await submit(container.querySelector("form")!);
    expect((container.querySelector('[aria-label="プロパティ名"]') as HTMLInputElement).value).toBe("Retain until cancel"); expect(f.controller.getState().pendingEditors).toBe(true);
    click(container, "キャンセル"); expect(f.controller.getState().pendingEditors).toBe(false); expect(f.controller.getState().snapshot!.metadata.future).toEqual({ retained: true }); expect(f.commit).toHaveBeenCalledTimes(1);
  });
});
