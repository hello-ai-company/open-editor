import { createEditorDocument, type JsonValue } from "@hello-ai-company/editor-core";
import { describe, expect, it } from "vitest";
import { exportLegacyNotesBlocks, importLegacyNotesBlocks } from "../src/document/legacyNotes.js";
import { importLegacyNotesEditableBlocks, exportLegacyNotesEditableBlocks } from "../src/notes/legacyEditing.js";
const types = [["paragraph", "paragraph"], ["heading", "heading"], ["bullet_list", "bulletListItem"], ["numbered_list", "numberedListItem"], ["checklist", "checkListItem"], ["quote", "quote"], ["callout", "callout"]] as const;
const values = ["left", "center", "right", "justify"] as const;
const rich: JsonValue = [{ type: "text", text: "日本語 é 😀\n", styles: { bold: true, textColor: "red" } }, { type: "link", href: "https://example.invalid", content: [{ type: "text", text: "label", styles: { italic: true } }] }];
const raw = (type: string, props: Record<string, JsonValue> = {}) => [{ id: "p", type, inlineContent: rich, text: "Exact fallback", sourceId: "source", sourceType: "human", version: 2, unknown: { retain: true }, ...props }];
describe("ordinary legacy text alignment", () => {
  it.each(types)("maps all four values only for %s", (legacy, native) => {
    for (const textAlignment of values) {
      const source = raw(legacy, { textAlignment }), f = importLegacyNotesBlocks(source);
      expect(f.document.blocks[0]).toMatchObject({ type: native, props: { textAlignment } });
      expect(exportLegacyNotesBlocks(f.document, f.archive, source)).toEqual(source);
      const editable = importLegacyNotesEditableBlocks(source);
      expect(exportLegacyNotesEditableBlocks(editable.document, editable.archive, source, { profile: {} })).toEqual(source);
    }
  });
  it.each(types)("preserves absence and explicit left separately for %s", (legacy) => {
    for (const props of [{}, { textAlignment: "left" }] as Record<string, JsonValue>[]) {
      const source = raw(legacy, props), f = importLegacyNotesBlocks(source);
      f.document.blocks[0]!.props = { ...f.document.blocks[0]!.props, textAlignment: "left" };
      expect(exportLegacyNotesBlocks(f.document, f.archive, source)).toEqual(source);
      delete f.document.blocks[0]!.props!.textAlignment;
      expect(exportLegacyNotesBlocks(f.document, f.archive, source)).toEqual(source);
    }
  });
  it.each(types)("edits, resets, creates and reopens %s without changing other raw fields", (legacy, native) => {
    const source = raw(legacy, { textAlignment: "center" }), f = importLegacyNotesBlocks(source), current = structuredClone(source);
    current[0]!.version = 3;
    for (const value of ["right", "justify", "left", undefined]) {
      f.document.blocks[0]!.props = value === undefined ? {} : { textAlignment: value };
      const saved = exportLegacyNotesBlocks(f.document, f.archive, current);
      expect(saved).toEqual([{ ...current[0], textAlignment: value ?? "left" }]);
      expect(importLegacyNotesBlocks(saved).document.blocks[0]!.props!.textAlignment).toBe(value ?? "left");
    }
    for (const textAlignment of values) {
      const document = createEditorDocument([{ id: "new", type: native, props: { textAlignment }, content: rich }]);
      const saved = exportLegacyNotesBlocks(document, importLegacyNotesBlocks([]).archive, []);
      expect(saved[0]).toMatchObject({ id: "new", type: legacy, textAlignment });
      expect(importLegacyNotesBlocks(saved).document).toEqual(document);
    }
  });
  it.each([null, false, 1, {}, [], "", "LEFT", "start", "end", " center "])("rejects invalid alignment %j at every ordinary codec boundary", textAlignment => {
    for (const [legacy, native] of types) {
      expect(() => importLegacyNotesBlocks(raw(legacy, { textAlignment }))).toThrow(/alignment/);
      const source = raw(legacy), f = importLegacyNotesBlocks(source); f.document.blocks[0]!.props = { textAlignment };
      expect(() => exportLegacyNotesBlocks(f.document, f.archive, source)).toThrow(/alignment/);
      expect(() => exportLegacyNotesBlocks(createEditorDocument([{ id: "new", type: native, props: { textAlignment } }]), importLegacyNotesBlocks([]).archive, [])).toThrow(/alignment/);
    }
  });
  it("rejects concurrent raw alignment/source/identity changes including missing versus explicit default", () => {
    for (const patch of [{ textAlignment: "left" }, { textAlignment: "center" }, { sourceId: "new" }, { sourceType: "remote" }, { id: "new" }, { type: "quote" }]) {
      const source = raw("paragraph"), f = importLegacyNotesBlocks(source), current = [{ ...source[0]!, ...patch }];
      f.document.blocks[0]!.props = { textAlignment: "right" };
      expect(() => exportLegacyNotesBlocks(f.document, f.archive, current)).toThrow();
      f.document.blocks = []; expect(() => exportLegacyNotesBlocks(f.document, f.archive, current)).toThrow();
    }
  });
  it.each(["code", "table", "image", "divider", "future-widget"])("keeps %s alignment opaque and refuses ordinary nondefault edits", type => {
    const source = raw(type, { textAlignment: { future: "keep" } }), f = importLegacyNotesBlocks(source);
    expect(f.document.blocks[0]!.props?.textAlignment).toBeUndefined();
    expect(exportLegacyNotesBlocks(f.document, f.archive, source)).toEqual(source);
    f.document.blocks[0]!.props = { textAlignment: "right" };
    expect(() => exportLegacyNotesBlocks(f.document, f.archive, source)).toThrow();
  });
  it("does not admit unrelated font, size, block-color or arbitrary props", () => {
    const unsupported: Record<string, JsonValue>[] = [{ fontFamily: "serif" }, { fontSize: "large" }, { textColor: "red" }, { backgroundColor: "blue" }, { alignment: "right" }];
    for (const props of unsupported) {
      const source = raw("paragraph"), f = importLegacyNotesBlocks(source); f.document.blocks[0]!.props = { textAlignment: "center", ...props };
      expect(() => exportLegacyNotesBlocks(f.document, f.archive, source)).toThrow(/Unmapped/);
    }
  });
});
