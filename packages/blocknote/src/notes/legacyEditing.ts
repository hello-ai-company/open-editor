import { createEditorDocument, type EditorBlock, type EditorDocument, type JsonValue } from "@hello-ai-company/editor-core";
import { copyLegacyNotesJson, importLegacyNotesBlocks, exportLegacyNotesBlocks, type LegacyNotesArchive } from "../document/legacyNotes.js";
import { inspectNotesDrawingPayload, type NotesDrawingDocument } from "./documentWidgets.js";

type Data = Record<string, JsonValue>;
export type LegacyNotesEditingProfile = {
  /** Explicit source coordinate space. Never inferred from the current screen. */
  whiteboardViewport?: { width: number; height: number };
  /** Canonical authorized IDs supplied by the host, never guessed from block IDs. */
  databaseBindings?: Record<string, { databaseId: string; viewField: "databaseView" | "databaseConfig.view"; viewId?: string; viewIdField?: "databaseViewId" | "databaseConfig.viewId" }>;
};
type Binding = { kind: "drawing" | "shared" | "web" | "page" | "asset" | "database" | "table"; projected: EditorBlock };
export type LegacyNotesEditingArchive = { codecVersion: 2; profile: LegacyNotesEditingProfile; base: LegacyNotesArchive; bindings: Record<string, Binding> };
const data = (value: unknown): Data => { const copy = copyLegacyNotesJson(value); if (!copy || typeof copy !== "object" || Array.isArray(copy)) throw new Error("Expected legacy editing record"); return copy; };
const same = (a: unknown, b: unknown): boolean => {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, sort(value)])) : v;
  return JSON.stringify(sort(a)) === JSON.stringify(sort(b));
};
const string = (value: JsonValue | undefined, fallback = "") => typeof value === "string" ? value : fallback;
const defaults: Data = { backgroundColor: "default", textColor: "default", textAlignment: "left" };
const views = ["table", "board", "timeline", "gantt", "calendar", "list", "gallery", "chart", "feed", "map", "dashboard"];
const linkStyles = ["text", "card", "article", "portrait"];
function profileChecked(value: LegacyNotesEditingProfile): LegacyNotesEditingProfile {
  const profile = data(value) as unknown as LegacyNotesEditingProfile;
  if (Object.keys(profile).some(key => !["whiteboardViewport", "databaseBindings"].includes(key))) throw new Error("Unknown editing profile fields");
  if (profile.databaseBindings !== undefined && (!profile.databaseBindings || typeof profile.databaseBindings !== "object" || Array.isArray(profile.databaseBindings))) throw new Error("Database bindings must be an identity record");
  const viewport = profile.whiteboardViewport;
  if (viewport !== undefined && (!viewport || typeof viewport !== "object" || Array.isArray(viewport) || Object.keys(viewport).some(key => !["width", "height"].includes(key)) || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width < 96 || viewport.width > 2048 || viewport.height < 96 || viewport.height > 2048)) throw new Error("Explicit valid whiteboard coordinate space required");
  for (const binding of Object.values(profile.databaseBindings ?? {})) if (!binding || typeof binding.databaseId !== "string" || !binding.databaseId || binding.databaseId.length > 512 || !["databaseView", "databaseConfig.view"].includes(binding.viewField) || Object.keys(binding).some(key => !["databaseId", "viewField", "viewId", "viewIdField"].includes(key))) throw new Error("Explicit database identity/view ownership required");
  for (const binding of Object.values(profile.databaseBindings ?? {})) {
    if (binding.viewId !== undefined && (typeof binding.viewId !== "string" || !binding.viewId || binding.viewId.length > 256)) throw new Error("Explicit bounded viewId required");
    if (binding.viewIdField !== undefined && (!binding.viewId || !["databaseViewId", "databaseConfig.viewId"].includes(binding.viewIdField))) throw new Error("viewId field requires explicit host-owned viewId");
  }
  return profile;
}
/** Strict old array admission: no filtering, invented coordinates, stored IDs or version. */
export function legacyWhiteboardToDrawing(source: string, viewport: { width: number; height: number }): NotesDrawingDocument {
  if (source.length > 750_000) throw new Error("Legacy drawing exceeds editing budget");
  const strokes: unknown = JSON.parse(source);
  if (!Array.isArray(strokes)) throw new Error("Unknown legacy drawing format");
  const drawing = { version: 1, ...viewport, strokes: strokes.map((stroke: unknown, index) => {
    const item = data(stroke);
    if (Object.keys(item).length !== 4 || Object.keys(item).some(key => !["tool", "color", "width", "points"].includes(key))) throw new Error("Unknown legacy stroke fields");
    return { id: `legacy-stroke-${index}`, ...item };
  }) };
  const inspected = inspectNotesDrawingPayload(JSON.stringify(drawing));
  if (!inspected.editable) throw new Error(inspected.reason);
  return inspected.document;
}
export function drawingToLegacyWhiteboard(source: string, viewport: { width: number; height: number }): string {
  const inspected = inspectNotesDrawingPayload(source);
  if (!inspected.editable || inspected.document.width !== viewport.width || inspected.document.height !== viewport.height) throw new Error("Legacy drawing coordinate space changed");
  return JSON.stringify(inspected.document.strokes.map(({ id: _id, ...stroke }) => stroke));
}
function projection(raw: Data, profile: LegacyNotesEditingProfile): Binding | undefined {
  const id = string(raw.id); if (!id) throw new Error("Legacy block identity required");
  const block = (kind: Binding["kind"], type: string, props: Data): Binding => ({ kind, projected: { id, type, props } });
  try {
    const stringsOnly = (keys: readonly string[]) => keys.every(key => raw[key] === undefined || typeof raw[key] === "string");
    if (raw.type === "webLink" && !stringsOnly(["linkURL", "linkTitle", "linkDescription", "linkStyle", "imageURL", "imageAlt"])) return undefined;
    if (raw.type === "child_page" && !stringsOnly(["pageID", "text", "preview", "linkStyle", "imageURL", "imageAlt"])) return undefined;
    if (raw.type === "asset" && !stringsOnly(["assetURL", "assetName", "text", "assetType", "assetKind", "assetLayout", "imageAlt"])) return undefined;
    if (raw.type === "editorTool" && !stringsOnly(["toolTitle"])) return undefined;
    if (raw.type === "editorTool" && raw.toolKind === "whiteboard" && profile.whiteboardViewport && typeof raw.toolData === "string") {
      legacyWhiteboardToDrawing(raw.toolData, profile.whiteboardViewport);
      return block("drawing", "oeLegacyNotesDrawing", { payload: raw.toolData, title: string(raw.toolTitle, "Whiteboard"), ...profile.whiteboardViewport });
    }
    if (raw.type === "editorTool" && raw.toolKind === "syncedBlock" && typeof raw.toolData === "string") {
      const parsed = data(JSON.parse(raw.toolData)), sharedId = string(parsed.syncID);
      if (!sharedId || sharedId.length > 256 || (raw.toolBody !== undefined && typeof raw.toolBody !== "string") || string(raw.toolBody).length > 100_000) return undefined;
      return block("shared", "oeNotesSyncedBlock", { sharedId, body: string(raw.toolBody) });
    }
    if (raw.type === "webLink" && typeof raw.linkURL === "string" && linkStyles.includes(string(raw.linkStyle, "card"))) return block("web", "oeLegacyNotesLink", { url: raw.linkURL, title: string(raw.linkTitle), description: string(raw.linkDescription), style: string(raw.linkStyle, "card"), imageURL: string(raw.imageURL), imageAlt: string(raw.imageAlt) });
    if (raw.type === "child_page" && typeof raw.pageID === "string" && raw.pageID && linkStyles.includes(string(raw.linkStyle, "card"))) return block("page", "oeLegacyNotesPageLink", { pageId: raw.pageID, title: string(raw.text), description: string(raw.preview), style: string(raw.linkStyle, "card"), imageURL: string(raw.imageURL), imageAlt: string(raw.imageAlt) });
    if (raw.type === "asset" && typeof raw.assetURL === "string" && ["compact", "card"].includes(string(raw.assetLayout, "card"))) return block("asset", "oeLegacyNotesAsset", { url: raw.assetURL, name: string(raw.assetName, string(raw.text)), mimeType: string(raw.assetType), kind: string(raw.assetKind, "file"), layout: string(raw.assetLayout, "card"), caption: string(raw.imageAlt) });
    if (raw.type === "database" && profile.databaseBindings?.[id] && typeof raw.databaseConfig === "string") {
      const config = data(JSON.parse(raw.databaseConfig)), binding = profile.databaseBindings[id]!, view = string(binding.viewField === "databaseView" ? raw.databaseView : config.view);
      if (!views.includes(view)) return undefined;
      if (binding.viewIdField && (binding.viewIdField === "databaseViewId" ? raw.databaseViewId : config.viewId) !== binding.viewId) return undefined;
      return block("database", "databaseView", { databaseId: binding.databaseId, ...(binding.viewId ? { viewId: binding.viewId } : {}), viewType: view, titleHint: string(config.title) });
    }
    if (raw.type === "table" && raw.tableProps && typeof raw.tableProps === "object" && !Array.isArray(raw.tableProps)) {
      const original = importLegacyNotesBlocks([raw]).document.blocks[0]!, props = data(raw.tableProps);
      const owned: Data = {};
      for (const key of ["backgroundColor", "textColor"]) if (typeof props[key] === "string") owned[key] = props[key]!;
      return { kind: "table", projected: { ...original, props: { ...original.props, ...owned } } };
    }
  } catch { /* Unknown/malformed variant remains inert in the original codec. */ }
  return undefined;
}
/** Opt-in codec v2; the original v1 import/export APIs and archives remain unchanged. */
export function importLegacyNotesEditableBlocks(input: unknown, options: LegacyNotesEditingProfile = {}): { document: EditorDocument; archive: LegacyNotesEditingArchive } {
  const profile = profileChecked(options), base = importLegacyNotesBlocks(input), bindings: Record<string, Binding> = Object.create(null);
  const visit = (block: EditorBlock): EditorBlock => {
    const binding = projection(base.archive.records[block.id]!.original, profile);
    if (binding) bindings[block.id] = binding;
    return { ...(binding?.projected ?? block), ...(block.children ? { children: block.children.map(visit) } : {}) };
  };
  const result = { document: createEditorDocument(base.document.blocks.map(visit)), archive: { codecVersion: 2 as const, profile, base: base.archive, bindings } };
  copyLegacyNotesJson(result.archive); return result;
}
export function exportLegacyNotesEditableBlocks(document: EditorDocument, archive: LegacyNotesEditingArchive, currentHostBlocks: unknown, options: NonNullable<Parameters<typeof exportLegacyNotesBlocks>[3]> & { profile: LegacyNotesEditingProfile }): JsonValue[] {
  const checked = data(archive) as unknown as LegacyNotesEditingArchive;
  if (checked.codecVersion !== 2 || Object.keys(checked).some(key => !["codecVersion", "profile", "base", "bindings"].includes(key))) throw new Error("Unsupported editable legacy archive");
  const profile = profileChecked(checked.profile), current = importLegacyNotesBlocks(currentHostBlocks), changes = new Map<string, (raw: Data) => void>();
  if (!same(profile, profileChecked(options.profile))) throw new Error("Editing identity/profile must match authoritative host configuration");
  const expectedBindings = Object.fromEntries(Object.entries(checked.base.records).flatMap(([id, item]) => { const binding = projection(item.original, profile); return binding ? [[id, binding]] : []; }));
  if (!same(expectedBindings, checked.bindings)) throw new Error("Editable archive projection was modified");
  const visit = (block: EditorBlock): EditorBlock => {
    const binding = checked.bindings[block.id], children = block.children?.map(visit);
    if (!binding) return { ...block, ...(children ? { children } : {}) };
    const baseline = checked.base.records[block.id]!.original, now = current.archive.records[block.id]?.original, expected = binding.projected;
    if (!now || block.type !== expected.type || !same(projection(now, profile), binding)) throw new Error("Legacy editable fields changed concurrently; both versions retained");
    if (Object.keys(block).some(key => !["id", "type", "props", "content", "children"].includes(key)) || (binding.kind !== "table" && block.content !== undefined)) throw new Error("Unmapped extended legacy field");
    const wanted = block.props ?? {}, before = expected.props ?? {};
    if (Object.keys(wanted).some(key => !Object.hasOwn(before, key) && !(Object.hasOwn(defaults, key) && same(wanted[key], defaults[key])))) throw new Error("Unmapped extended legacy property");
    const patch: Data = {};
    const change = (prop: string, field: string) => {
      if (same(wanted[prop], before[prop])) return;
      if (!same(baseline[field], now[field])) throw new Error("Legacy raw field changed concurrently");
      if (typeof wanted[prop] !== "string") throw new Error("Legacy string property required");
      patch[field] = wanted[prop]!;
    };
    if (binding.kind === "drawing") {
      if (wanted.width !== before.width || wanted.height !== before.height) throw new Error("Legacy drawing coordinates are immutable");
      if (!same(wanted.payload, before.payload)) legacyWhiteboardToDrawing(string(wanted.payload), profile.whiteboardViewport!);
      change("payload", "toolData"); change("title", "toolTitle");
    } else if (binding.kind === "shared") { if (wanted.sharedId !== before.sharedId) throw new Error("Shared identity is immutable"); change("body", "toolBody"); }
    else if (binding.kind === "web" || binding.kind === "page") {
      if (!linkStyles.includes(string(wanted.style))) throw new Error("Unsupported legacy link presentation");
      if (binding.kind === "page" && wanted.pageId !== before.pageId) throw new Error("Page identity is immutable");
      const fields = binding.kind === "web" ? { url: "linkURL", title: "linkTitle", description: "linkDescription", style: "linkStyle", imageURL: "imageURL", imageAlt: "imageAlt" } : { title: "text", description: "preview", style: "linkStyle", imageURL: "imageURL", imageAlt: "imageAlt" };
      for (const [prop, field] of Object.entries(fields)) change(prop, field);
    } else if (binding.kind === "asset") {
      for (const key of ["url", "mimeType", "kind"]) if (wanted[key] !== before[key]) throw new Error("Asset source identity is host-owned");
      if (!["compact", "card"].includes(string(wanted.layout))) throw new Error("Unsupported asset layout");
      change("name", "assetName"); change("caption", "imageAlt"); change("layout", "assetLayout");
    } else if (binding.kind === "database") {
      if (wanted.databaseId !== before.databaseId || wanted.viewId !== before.viewId || !views.includes(string(wanted.viewType))) throw new Error("Database identity/view mismatch");
      const config = data(JSON.parse(string(now.databaseConfig))), owner = profile.databaseBindings![block.id]!;
      if (wanted.titleHint !== before.titleHint || (owner.viewField === "databaseConfig.view" && wanted.viewType !== before.viewType)) {
        if (baseline.databaseConfig !== now.databaseConfig) throw new Error("Database configuration changed concurrently");
        if (typeof wanted.titleHint !== "string") throw new Error("Database title required");
        if (wanted.titleHint !== before.titleHint) config.title = wanted.titleHint; if (owner.viewField === "databaseConfig.view") config.view = wanted.viewType!;
        patch.databaseConfig = JSON.stringify(config);
      }
      if (owner.viewField === "databaseView") change("viewType", "databaseView");
    } else {
      const props = data(now.tableProps ?? {});
      for (const key of ["backgroundColor", "textColor"]) if (!same(wanted[key], before[key]) && !(before[key] === undefined && wanted[key] === "default")) {
        if (!same(baseline.tableProps, now.tableProps) || typeof wanted[key] !== "string") throw new Error("Table properties changed concurrently or unsupported");
        props[key] = wanted[key]!; patch.tableProps = props;
      }
    }
    if (Object.keys(patch).length) changes.set(block.id, raw => Object.assign(raw, patch));
    const original = checked.base.records[block.id]!.projected;
    return { ...original, ...(binding.kind === "table" ? { content: block.content } : {}), ...(children ? { children } : {}) };
  };
  const baseDocument = createEditorDocument(document.blocks.map(visit), document.schemaVersion);
  const exported = exportLegacyNotesBlocks(baseDocument, checked.base, currentHostBlocks, options);
  const apply = (value: JsonValue): JsonValue => { const raw = data(value); changes.get(string(raw.id))?.(raw); if (Array.isArray(raw.children)) raw.children = raw.children.map(apply); return raw; };
  return exported.map(apply);
}
