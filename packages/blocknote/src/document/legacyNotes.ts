import { createEditorDocument, type EditorBlock, type EditorDocument, type JsonValue } from "@hello-ai-company/editor-core";
import { DOCUMENT_COLUMN_TYPE, DOCUMENT_COLUMNS_TYPE, validateDocumentColumns } from "./columns.js";
import { HTML_WIDGET_TYPE, parseHtmlWidgetSource } from "./htmlWidget.js";

type RecordData = Record<string, JsonValue>;
export type LegacyNotesArchive = {
  codecVersion: 1;
  records: Record<string, { original: RecordData; projected: EditorBlock }>;
  structure: string;
};
export type LegacyNotesImport = { document: EditorDocument; archive: LegacyNotesArchive };

/** Detached, bounded JSON without invoking accessors/toJSON. Archive is host-private. */
export function copyLegacyNotesJson(value: unknown): JsonValue {
  let nodes = 0, text = 0;
  const ancestors = new Set<object>();
  const visit = (item: unknown, depth: number): JsonValue => {
    if (++nodes > 100_000 || depth > 128) throw new Error("Legacy JSON exceeds the structural budget");
    if (item === null || typeof item === "boolean") return item;
    if (typeof item === "string") { text += item.length; if (text > 4_000_000) throw new Error("Legacy JSON exceeds the text budget"); return item; }
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (!item || typeof item !== "object" || ancestors.has(item)) throw new Error("Legacy value must be acyclic JSON data");
    const proto = Object.getPrototypeOf(item);
    if (!Array.isArray(item) && proto !== Object.prototype && proto !== null) throw new Error("Legacy value must be plain JSON data");
    ancestors.add(item);
    let output: JsonValue;
    if (Array.isArray(item)) {
      output = Array.from({ length: item.length }, (_, index) => {
        const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
        if (!descriptor || !("value" in descriptor)) throw new Error("Sparse arrays and accessors are unsupported");
        return visit(descriptor.value, depth + 1);
      });
    } else {
      const result: RecordData = Object.create(null) as RecordData;
      for (const key of Object.keys(item)) {
        const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
        if (!("value" in descriptor)) throw new Error("Accessors are unsupported");
        text += key.length;
        result[key] = visit(descriptor.value, depth + 1);
      }
      output = result;
    }
    ancestors.delete(item);
    return output;
  };
  return visit(value, 0);
}
const copyJson = copyLegacyNotesJson;
function record(value: JsonValue): RecordData {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a legacy record");
  return value as RecordData;
}
const aliases: Record<string, string> = {
  paragraph: "paragraph", heading: "heading", quote: "quote", code: "codeBlock", divider: "divider", image: "image", table: "table", callout: "callout",
  bullet_list: "bulletListItem", numbered_list: "numberedListItem", checklist: "checkListItem",
  column_list: DOCUMENT_COLUMNS_TYPE, columnList: DOCUMENT_COLUMNS_TYPE, column: DOCUMENT_COLUMN_TYPE
  , pageBreak: "oePageBreak"
};
const fields: Record<string, Record<string, string>> = {
  heading: { headingLevel: "level" }, code: { codeLanguage: "language" }, checklist: { checked: "checked" },
  column: { columnWidth: "width" }, image: { imageURL: "url", imageAlt: "caption" }
};
const reverseTypes: Record<string, string> = Object.fromEntries(Object.entries(aliases).filter(([type]) => type !== "columnList").map(([a, b]) => [b, a]));
function isWidget(raw: RecordData): boolean { return (raw.type === "editor_tool" || raw.type === "editorTool") && raw.toolKind === "htmlEmbed"; }
function project(raw: RecordData): EditorBlock {
  if (typeof raw.id !== "string" || !raw.id || typeof raw.type !== "string" || !raw.type) throw new Error("Legacy block requires id and type");
  const type = isWidget(raw) ? HTML_WIDGET_TYPE : Object.hasOwn(aliases, raw.type) ? aliases[raw.type]! : `notes:${raw.type}`;
  const block: EditorBlock = { id: raw.id, type };
  if (Object.hasOwn(aliases, raw.type) && ![DOCUMENT_COLUMN_TYPE, DOCUMENT_COLUMNS_TYPE, "divider"].includes(type)) {
    if (raw.type === "table") { if (raw.tableContent !== undefined) block.content = raw.tableContent; }
    else if (raw.inlineContent !== undefined) block.content = raw.inlineContent;
    else if (raw.text !== undefined) block.content = raw.text;
  }
  const props: RecordData = {};
  for (const [field, prop] of Object.entries(Object.hasOwn(fields, raw.type) ? fields[raw.type]! : {})) if (raw[field] !== undefined) props[prop] = raw[field]!;
  if (type === DOCUMENT_COLUMN_TYPE && props.width === undefined) props.width = 1;
  if (type === DOCUMENT_COLUMNS_TYPE) props.gap = 16;
  if (isWidget(raw)) {
    const data = typeof raw.toolData === "string" ? record(copyJson(JSON.parse(raw.toolData))) : record(raw.toolData ?? {});
    const source = parseHtmlWidgetSource({ html: data.html ?? "", css: data.css ?? "", javascript: data.javascript ?? data.js ?? "" });
    Object.assign(props, source, { title: typeof raw.toolTitle === "string" ? raw.toolTitle : "HTML widget" });
  }
  if (Object.keys(props).length) block.props = props;
  return block;
}
function treeShape(blocks: readonly EditorBlock[]): string {
  const shape = (items: readonly EditorBlock[]): JsonValue => items.map(block => [block.id, block.type, block.children ? shape(block.children) : null]);
  return JSON.stringify(shape(blocks));
}
function same(a: unknown, b: unknown): boolean {
  const normalize = (value: unknown): unknown => Array.isArray(value) ? value.map(normalize) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, normalize(v)])) : value;
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}
const nativeDefaults: Record<string, JsonValue> = { backgroundColor: "default", textColor: "default", textAlignment: "left", isToggleable: false, level: 1, language: "text", checked: false, url: "", caption: "" };
function sameContent(a: unknown, b: unknown): boolean {
  const inline = (value: unknown): unknown => typeof value === "string" ? value ? [{ type: "text", text: value, styles: {} }] : [] : value === undefined ? [] : value;
  return same(inline(a), inline(b));
}
function omitUnsupportedStyles(content: JsonValue | undefined, extra: readonly string[]): { value: JsonValue | undefined; omitted: boolean } {
  const supported = new Set(["bold", "italic", "underline", "strike", "code", "textColor", "backgroundColor", ...extra]);
  let omitted = false;
  const visit = (value: JsonValue): JsonValue => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    const result: RecordData = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === "styles" && entry && typeof entry === "object" && !Array.isArray(entry)) {
        const styles: RecordData = {};
        for (const [name, setting] of Object.entries(entry)) { if (supported.has(name)) styles[name] = setting; else omitted = true; }
        result[key] = styles;
      } else result[key] = visit(entry);
    }
    return result;
  };
  return { value: content === undefined ? undefined : visit(content), omitted };
}

/** Only reviewed editor fields enter the semantic document; everything else stays in archive. */
export function importLegacyNotesBlocks(input: unknown): LegacyNotesImport {
  const raw = copyJson(input);
  if (!Array.isArray(raw)) throw new Error("Legacy input must be a block array");
  const records: LegacyNotesArchive["records"] = Object.create(null) as LegacyNotesArchive["records"];
  const visit = (value: JsonValue): EditorBlock => {
    const original = record(value), block = project(original);
    if (Object.hasOwn(records, block.id)) throw new Error(`Duplicate legacy block id: ${block.id}`);
    const withoutChildren = { ...original }; delete withoutChildren.children;
    records[block.id] = { original: withoutChildren, projected: { ...block } };
    if (original.children !== undefined) {
      if (!Array.isArray(original.children)) throw new Error("Legacy children must be an array");
      block.children = original.children.map(visit);
    }
    return block;
  };
  const document = createEditorDocument(raw.map(visit));
  const errors = validateDocumentColumns(document);
  if (errors.length) throw new Error(`Invalid legacy columns: ${errors.join("; ")}`);
  const archive: LegacyNotesArchive = { codecVersion: 1, records, structure: treeShape(document.blocks) };
  // Admission covers the generated archive too: accepted imports must be saveable unchanged.
  copyJson(archive);
  return { document, archive };
}

/** Merge into CURRENT host records. No provider/server metadata can be supplied by the editor. */
export function exportLegacyNotesBlocks(document: EditorDocument, archive: LegacyNotesArchive, currentHostBlocks: unknown, options: { allowUnknownDeletion?: boolean; supportedStyles?: readonly string[] } = {}): JsonValue[] {
  const safeDocument = createEditorDocument(document.blocks, document.schemaVersion);
  const safeArchive = record(copyJson(archive));
  if (safeArchive.codecVersion !== 1) throw new Error("Unsupported legacy archive version");
  const archiveRecords = record(safeArchive.records!);
  const current = importLegacyNotesBlocks(currentHostBlocks);
  if (current.archive.structure !== safeArchive.structure) throw new Error("Host structure changed; refresh the compatibility archive before saving");
  if (!same(Object.keys(archiveRecords).sort(), Object.keys(current.archive.records).sort())) throw new Error("Legacy archive records are incomplete or contain unexpected identities");
  if (validateDocumentColumns(safeDocument).length) throw new Error("Invalid document columns");
  const retained = new Set<string>();
  const collect = (blocks: EditorBlock[]): void => { for (const block of blocks) { retained.add(block.id); if (block.children) collect(block.children); } };
  collect(safeDocument.blocks);
  // Check deleted blocks too: a local delete must never erase a concurrent human edit.
  for (const [id, value] of Object.entries(archiveRecords)) {
    const archived = record(value), original = record(archived.original!), projected = record(archived.projected!), now = current.archive.records[id];
    if (!now || original.id !== id || projected.id !== id || original.type !== now.original.type || !same(original.sourceType, now.original.sourceType) || !same(original.sourceId, now.original.sourceId) || !same(now.projected, projected) || !same(project(original), projected)) throw new Error("Host editor fields or legacy identity changed; refresh before saving");
    if (!retained.has(id) && !same(original, now.original)) throw new Error("Host metadata changed; refusing concurrent deletion");
    if (!retained.has(id) && String(projected.type).startsWith("notes:") && !options.allowUnknownDeletion) throw new Error("Unknown legacy deletion requires explicit host approval");
  }
  const visit = (block: EditorBlock): JsonValue => {
    const archived = Object.hasOwn(archiveRecords, block.id) ? record(archiveRecords[block.id]!) : undefined;
    let result: RecordData;
    if (archived) {
      const baseline = record(archived.original!), projected = record(archived.projected!), now = current.archive.records[block.id];
      if (!now || projected.id !== block.id || projected.type !== block.type || baseline.id !== block.id || baseline.type !== now.original.type || !same(baseline.sourceType, now.original.sourceType) || !same(baseline.sourceId, now.original.sourceId)) throw new Error("Legacy identity/type changed; refusing an ambiguous save");
      if (!same(now.projected, projected)) throw new Error("Host editor fields changed; refresh before saving");
      // Verify the archive projection against its own original; archives are not trusted write instructions.
      if (!same(project(baseline), projected)) throw new Error("Legacy archive projection was modified");
      result = { ...now.original };
      if (block.type.startsWith("notes:")) {
        if (!same({ ...block, children: undefined }, { ...projected, children: undefined })) throw new Error("Unknown legacy blocks must remain inert");
      } else {
        const expected = project(result), desired = { ...block }; delete desired.children;
        const permitted = new Set(["id", "type", "content", "props"]);
        if (Object.keys(desired).some(key => !permitted.has(key))) throw new Error("Unmapped block field");
        const allowedProps = new Set(Object.values(fields[String(result.type)] ?? {}));
        if (block.type === DOCUMENT_COLUMNS_TYPE) allowedProps.add("gap");
        if (block.type === HTML_WIDGET_TYPE) for (const key of ["html", "css", "javascript", "title"]) allowedProps.add(key);
        if (Object.keys(block.props ?? {}).some(key => !allowedProps.has(key) && !same(block.props?.[key], expected.props?.[key]) && !(Object.hasOwn(nativeDefaults, key) && same(block.props?.[key], nativeDefaults[key])))) throw new Error("Unmapped editor property; extend the host codec explicitly");
        const contentProjection = omitUnsupportedStyles(expected.content, options.supportedStyles ?? []);
        const contentUnchanged = sameContent(block.content, expected.content) || contentProjection.omitted && sameContent(block.content, contentProjection.value);
        if (!contentUnchanged) {
          if (contentProjection.omitted) throw new Error("Legacy content has unsupported styles; provide a supporting schema before editing it");
          if (!["paragraph", "heading", "quote", "codeBlock", "bulletListItem", "numberedListItem", "checkListItem", "table", "callout"].includes(block.type)) throw new Error("Content is not writable for this legacy type");
          if (block.type === "table") { if (block.content === undefined) delete result.tableContent; else result.tableContent = block.content; }
          else { if (block.content === undefined) delete result.inlineContent; else result.inlineContent = block.content; delete result.text; }
        }
        for (const [field, prop] of Object.entries(fields[String(result.type)] ?? {})) {
          if (same(block.props?.[prop], expected.props?.[prop])) continue;
          if (expected.props?.[prop] === undefined && Object.hasOwn(nativeDefaults, prop) && same(block.props?.[prop], nativeDefaults[prop])) continue;
          if (block.props?.[prop] === undefined) delete result[field]; else result[field] = block.props[prop]!;
        }
        if (block.type === DOCUMENT_COLUMNS_TYPE && !same(block.props?.gap, expected.props?.gap)) throw new Error("Legacy format has no column gap field");
        if (block.type === HTML_WIDGET_TYPE) {
          const source = parseHtmlWidgetSource(block.props);
          if (!same(source, { html: expected.props?.html, css: expected.props?.css, javascript: expected.props?.javascript })) {
            const data = typeof result.toolData === "string" ? record(copyJson(JSON.parse(result.toolData))) : record(result.toolData ?? {});
            const next = { ...data, html: source.html, css: source.css, ...(Object.hasOwn(data, "js") && !Object.hasOwn(data, "javascript") ? { js: source.javascript } : { javascript: source.javascript }) };
            result.toolData = typeof result.toolData === "string" ? JSON.stringify(next) : next;
          }
          if (!same(block.props?.title, expected.props?.title)) result.toolTitle = block.props?.title ?? "";
        }
      }
    } else {
      const legacyType = block.type === HTML_WIDGET_TYPE ? "editorTool" : reverseTypes[block.type];
      if (!legacyType) throw new Error("New block type requires an explicit host creation codec");
      // Reuse the same checked write mapping, using a synthetic empty original, then recurse once.
      const fresh: RecordData = { id: block.id, type: legacyType, text: "" };
      if (block.content !== undefined) fresh[block.type === "table" ? "tableContent" : "inlineContent"] = block.content;
      const allowed = new Set(Object.values(fields[legacyType] ?? {}));
      if (block.type === DOCUMENT_COLUMNS_TYPE) allowed.add("gap");
      if (block.type === HTML_WIDGET_TYPE) for (const key of ["title", "html", "css", "javascript"]) allowed.add(key);
      if (Object.keys(block.props ?? {}).some(key => !allowed.has(key) && !(Object.hasOwn(nativeDefaults, key) && same(block.props?.[key], nativeDefaults[key])))) throw new Error("New block contains unmapped properties");
      if (block.type === DOCUMENT_COLUMNS_TYPE && block.props?.gap !== undefined && block.props.gap !== 16) throw new Error("Legacy format has no column gap field");
      if (block.type === HTML_WIDGET_TYPE) {
        if (block.content !== undefined) throw new Error("Widget content must use its source fields");
        fresh.toolKind = "htmlEmbed";
        fresh.toolTitle = block.props?.title ?? "HTML widget";
        fresh.toolData = JSON.stringify(parseHtmlWidgetSource(block.props));
      }
      for (const [field, prop] of Object.entries(fields[legacyType] ?? {})) if (block.props?.[prop] !== undefined) fresh[field] = block.props[prop]!;
      result = fresh;
    }
    if (block.children !== undefined) result.children = block.children.map(visit);
    else if (Object.hasOwn(current.archive.records[block.id]?.original ?? {}, "children")) result.children = [];
    return result;
  };
  return safeDocument.blocks.map(visit);
}
