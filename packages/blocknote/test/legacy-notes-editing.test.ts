import { describe, expect, it } from "vitest";
import { exportLegacyNotesBlocks, importLegacyNotesBlocks } from "../src/document/legacyNotes.js";
import { drawingToLegacyWhiteboard, exportLegacyNotesEditableBlocks, importLegacyNotesEditableBlocks, legacyWhiteboardToDrawing, type LegacyNotesEditingProfile } from "../src/notes/legacyEditing.js";

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const whiteboard = '[ { "tool": "pen", "color": "#176b64", "width": 3, "points": [{"x":10,"y":20},{"x":30,"y":40}] } ]';
const profile: LegacyNotesEditingProfile = { whiteboardViewport: { width: 960, height: 540 }, databaseBindings: { db: { databaseId: "authorized-db", viewField: "databaseConfig.view" } } };
function fixture(): Record<string, unknown>[] {
  return [
    { id: "drawing", type: "editorTool", text: "", toolKind: "whiteboard", toolData: whiteboard, toolTitle: "Board", toolIcon: "retained", version: 4, opaque: { future: true } },
    { id: "shared", type: "editorTool", text: "", toolKind: "syncedBlock", toolBody: "Before", toolData: '{ "syncID":"shared-ref", "future":true }', sourceId: "host-ref" },
    { id: "web", type: "webLink", text: "cached", linkURL: "https://example.test/old", linkTitle: "Old", linkDescription: "Description", linkStyle: "card", unknown: [1, true] },
    { id: "page", type: "child_page", text: "Page", pageID: "page-ref", preview: "Preview", linkStyle: "text" },
    { id: "asset", type: "asset", text: "cached", assetURL: "local:synthetic", attachmentID: "attachment-ref", assetName: "File", assetType: "text/plain", assetSize: 10, assetKind: "file", assetLayout: "compact" },
    { id: "db", type: "database", text: "cached", databaseRowsLoaded: false, databaseRowCount: 42, databaseRows: [{ id: 1, opaque: true }], databaseView: "table", databaseConfig: '{ "view":"table", "title":"Tasks", "properties":"[]", "future":{"keep":true} }' },
    { id: "table", type: "table", text: "cached", tableProps: { textColor: "default", future: { keep: true } }, tableContent: { type: "tableContent", rows: [{ cells: [[{ type: "text", text: "Cell", styles: {} }]] }] } },
    { id: "unknown", type: "future-format", payload: { keep: "exact" }, children: [{ id: "child", type: "paragraph", text: "Child", extension: [true] }] }
  ];
}
const props = (document: ReturnType<typeof importLegacyNotesEditableBlocks>["document"], id: string) => document.blocks.find(block => block.id === id)!.props!;

describe("independent editable legacy codec lossless regression", () => {
  it.each(["databaseViewId", "databaseConfig.viewId"] as const)("owns exact immutable viewId through %s without changing raw config", field => {
    const input = fixture(), raw = input[5]!; if (field === "databaseViewId") raw.databaseViewId = "host-view"; else raw.databaseConfig = JSON.stringify({ ...JSON.parse(raw.databaseConfig as string), viewId: "host-view" });
    const owned: LegacyNotesEditingProfile = { ...profile, databaseBindings: { db: { databaseId: "authorized-db", viewField: "databaseConfig.view", viewId: "host-view", viewIdField: field } } };
    const imported = importLegacyNotesEditableBlocks(input, owned); expect(props(imported.document, "db").viewId).toBe("host-view"); expect(exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile: owned })).toEqual(input);
    props(imported.document, "db").viewType = "map"; const output = exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile: owned }); expect(JSON.parse((output[5] as Record<string,string>).databaseConfig!).view).toBe("map");
    props(imported.document, "db").viewId = "injected-view"; expect(() => exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile: owned })).toThrow(/identity/);
  });
  it("declines mismatched raw view identity without discarding original bytes", () => {
    const input = fixture(); input[5]!.databaseViewId = "other";
    const owned: LegacyNotesEditingProfile = { databaseBindings: { db: { databaseId: "authorized-db", viewField: "databaseView", viewId: "authorized-view", viewIdField: "databaseViewId" } } };
    const imported = importLegacyNotesEditableBlocks(input, owned); expect(imported.document.blocks[5]?.type).toBe("notes:database"); expect(exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile: owned })).toEqual(input);
  });
  it("fences concurrent identity changes and host-profile changes", () => {
    const input = fixture(); input[5]!.databaseViewId = "view";
    const owned: LegacyNotesEditingProfile = { databaseBindings: { db: { databaseId: "authorized-db", viewField: "databaseView", viewId: "view", viewIdField: "databaseViewId" } } };
    const imported = importLegacyNotesEditableBlocks(input, owned), current = copy(input); current[5]!.databaseViewId = "new-view";
    expect(() => exportLegacyNotesEditableBlocks(imported.document, imported.archive, current, { profile: owned })).toThrow(/concurrent/);
    expect(() => exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile: { databaseBindings: { db: { databaseId: "authorized-db", viewField: "databaseView", viewId: "other" } } } })).toThrow(/profile/);
  });
  it("supports explicit projection-only viewId while retaining old profiles", () => { const input = fixture(), owned: LegacyNotesEditingProfile = { databaseBindings: { db: { databaseId: "authorized-db", viewField: "databaseView", viewId: "view" } } }; const imported = importLegacyNotesEditableBlocks(input, owned); expect(props(imported.document, "db").viewId).toBe("view"); expect(exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile: owned })).toEqual(input); expect(props(importLegacyNotesEditableBlocks(input, profile).document, "db")).not.toHaveProperty("viewId"); });

  it("keeps exact raw strings, presence, unknown records, metadata and nested children on no-op", () => {
    const input = fixture(), imported = importLegacyNotesEditableBlocks(input, profile);
    expect(imported.archive.codecVersion).toBe(2);
    expect(exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile })).toEqual(input);
    expect(JSON.stringify(imported.document)).not.toContain("host-ref"); expect(JSON.stringify(imported.document)).not.toContain("authorized-db-credentials");
    const original = fixture(), v1 = importLegacyNotesBlocks(original); expect(exportLegacyNotesBlocks(v1.document, v1.archive, original)).toEqual(original);
  });
  it("patches only edited link field and merges current host unknown/source/version changes", () => {
    const input = fixture(), imported = importLegacyNotesEditableBlocks(input, profile), current = copy(input);
    props(imported.document, "web").title = "Human title";
    Object.assign(current[2]!, { version: 99, unknown: { current: true }, sourceProvider: "host-only" });
    const output = exportLegacyNotesEditableBlocks(imported.document, imported.archive, current, { profile });
    expect(output[2]).toEqual({ ...current[2], linkTitle: "Human title" }); expect(output.slice(0, 2)).toEqual(current.slice(0, 2));
  });
  it("writes shared body only and preserves exact sync metadata string and identity", () => {
    const input = fixture(), imported = importLegacyNotesEditableBlocks(input, profile); props(imported.document, "shared").body = "Human body";
    expect(exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile })[1]).toEqual({ ...input[1], toolBody: "Human body" });
    props(imported.document, "shared").sharedId = "other"; expect(() => exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile })).toThrow(/identity/);
  });
  it("keeps raw array drawing format and strips only generated editor stroke IDs on explicit edit", () => {
    const input = fixture(), imported = importLegacyNotesEditableBlocks(input, profile), drawing = legacyWhiteboardToDrawing(whiteboard, profile.whiteboardViewport!);
    drawing.strokes[0]!.points[0]!.x = 20; const next = drawingToLegacyWhiteboard(JSON.stringify(drawing), profile.whiteboardViewport!); props(imported.document, "drawing").payload = next;
    const output = exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile });
    expect(output[0]).toEqual({ ...input[0], toolData: next }); const parsed = JSON.parse(next); expect(Array.isArray(parsed)).toBe(true); expect(parsed[0]).not.toHaveProperty("id"); expect(parsed[0].points[0]).toEqual({ x: 20, y: 20 });
  });
  it.each(["not JSON", '{"version":2,"unknown":true}', '[{"tool":"pen","color":"#176b64","width":3,"points":[{"x":1,"y":2,"pressure":0.5}]}]', '[{"tool":"eraser","color":"#176b64","width":3,"points":[{"x":1,"y":2}]}]'])("retains unsupported drawing inert and exact: %s", source => {
    const input = [{ id: "drawing", type: "editorTool", toolKind: "whiteboard", toolData: source }], imported = importLegacyNotesEditableBlocks(input, profile);
    expect(imported.document.blocks[0]!.type).toBe("notes:editorTool"); expect(exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile })).toEqual(input);
  });
  it("requires explicit viewport and database bindings instead of guessing identities", () => {
    const input = fixture(), imported = importLegacyNotesEditableBlocks(input);
    expect(imported.document.blocks.find(block => block.id === "drawing")!.type).toBe("notes:editorTool"); expect(imported.document.blocks.find(block => block.id === "db")!.type).toBe("notes:database");
    expect(exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile: {} })).toEqual(input);
  });
  it.each([
    { id: "bad-web", type: "webLink", linkURL: "https://example.test", linkTitle: { future: true } },
    { id: "bad-page", type: "child_page", pageID: "page-ref", preview: ["future"] },
    { id: "bad-shared", type: "editorTool", toolKind: "syncedBlock", toolData: '{"syncID":"ref"}', toolBody: { unknown: true } },
    { id: "bad-asset", type: "asset", assetURL: "local:synthetic", assetName: ["future"] },
    { id: "db", type: "database", databaseConfig: "malformed" }
  ])("retains malformed source field shape inert without fallback conversion: $id", raw => {
    const input = [raw], imported = importLegacyNotesEditableBlocks(input, profile);
    expect(imported.document.blocks[0]!.type.startsWith("notes:")).toBe(true);
    expect(exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile })).toEqual(input);
  });
  it("preserves lazy rows/count and config unknowns when only database title changes", () => {
    const input = fixture(), imported = importLegacyNotesEditableBlocks(input, profile); props(imported.document, "db").titleHint = "Human tasks";
    const output = exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile }) as Record<string, unknown>[];
    const config = JSON.parse(output[5]!.databaseConfig as string); expect(config).toEqual({ view: "table", title: "Human tasks", properties: "[]", future: { keep: true } }); expect(output[5]).toMatchObject({ databaseRowsLoaded: false, databaseRowCount: 42, databaseRows: input[5]!.databaseRows });
  });
  it.each([{}, { title: { futureTitle: true } }])("does not create or overwrite unchanged database title during view-only patch: %j", extra => {
    const input = [{ id: "db", type: "database", databaseConfig: JSON.stringify({ view: "table", future: true, ...extra }) }], imported = importLegacyNotesEditableBlocks(input, profile);
    props(imported.document, "db").viewType = "board"; const output = exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile }) as Record<string, unknown>[];
    expect(JSON.parse(output[0]!.databaseConfig as string)).toEqual({ view: "board", future: true, ...extra });
  });
  it("patches table color while preserving unknown props and content", () => {
    const input = fixture(), imported = importLegacyNotesEditableBlocks(input, profile); props(imported.document, "table").textColor = "red";
    const output = exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile }); expect(output[6]).toEqual({ ...input[6], tableProps: { textColor: "red", future: { keep: true } } });
  });
  it.each(["linkTitle", "linkURL", "type"])("rejects concurrent reviewed web field %s", field => {
    const input = fixture(), imported = importLegacyNotesEditableBlocks(input, profile), current = copy(input); props(imported.document, "web").title = "Human"; current[2]![field] = "Concurrent";
    expect(() => exportLegacyNotesEditableBlocks(imported.document, imported.archive, current, { profile })).toThrow();
  });
  it("refuses raw field concurrent changes even when their projected fallback is identical", () => {
    const input = [{ id: "web", type: "webLink", linkURL: "https://example.test" }], imported = importLegacyNotesEditableBlocks(input); props(imported.document, "web").title = "Human";
    expect(() => exportLegacyNotesEditableBlocks(imported.document, imported.archive, [{ ...input[0], linkTitle: "" }], { profile: {} })).toThrow(/raw field/);
  });
  it("rejects modified projection, profile identity forgery and unmapped editor properties", () => {
    const input = fixture(), imported = importLegacyNotesEditableBlocks(input, profile), forged = copy(imported.archive);
    forged.bindings.db!.projected.props!.databaseId = "other-db"; expect(() => exportLegacyNotesEditableBlocks(imported.document, forged, input, { profile })).toThrow(/modified/);
    const changedProfile = copy(imported.archive); changedProfile.profile.databaseBindings!.db!.databaseId = "other-db"; expect(() => exportLegacyNotesEditableBlocks(imported.document, changedProfile, input, { profile })).toThrow(/profile/);
    props(imported.document, "web").providerMetadata = "must not write"; expect(() => exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile })).toThrow(/Unmapped/);
  });
  it("cannot forge host authoritative coordinate space or mutate page/asset/database identity", () => {
    const input = fixture(), imported = importLegacyNotesEditableBlocks(input, profile), forged = copy(imported.archive);
    forged.profile.whiteboardViewport!.width = 1024;
    expect(() => exportLegacyNotesEditableBlocks(imported.document, forged, input, { profile })).toThrow(/profile/);
    for (const [id, key, value] of [["page", "pageId", "other-page"], ["asset", "url", "local:other"], ["db", "databaseId", "other-db"]]) {
      const next = importLegacyNotesEditableBlocks(input, profile); props(next.document, id!)[key!] = value!;
      expect(() => exportLegacyNotesEditableBlocks(next.document, next.archive, input, { profile })).toThrow(/identity/);
    }
  });
  it.each([{ databaseBindings: [] }, { databaseBindings: null }, { whiteboardViewport: null }])("rejects malformed profile record shape: %j", malformed => {
    expect(() => importLegacyNotesEditableBlocks(fixture(), malformed as unknown as LegacyNotesEditingProfile)).toThrow();
  });
  it("rejects unsupported archive version and deleted unknown payload without explicit option", () => {
    const input = fixture(), imported = importLegacyNotesEditableBlocks(input, profile), forged = copy(imported.archive); (forged as { codecVersion: number }).codecVersion = 3;
    expect(() => exportLegacyNotesEditableBlocks(imported.document, forged, input, { profile })).toThrow(/archive/);
    imported.document.blocks = imported.document.blocks.filter(block => block.id !== "unknown"); expect(() => exportLegacyNotesEditableBlocks(imported.document, imported.archive, input, { profile })).toThrow(/approval/);
  });
});
