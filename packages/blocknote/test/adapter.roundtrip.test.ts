import { createEditorDocument, serializeEditorDocument } from "@hello-ai-company/editor-core";
import { describe, expect, it } from "vitest";
import { fromBlockNote } from "../src/adapter/fromBlockNote.js";
import { toBlockNote } from "../src/adapter/toBlockNote.js";
import { UNKNOWN_ENVELOPE_TYPE } from "../src/types.js";

const DEFAULT_KNOWN = [
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "codeBlock",
  "table",
  "image",
  "file",
  "audio",
  "video",
  "quote",
  "divider",
  "toggleListItem",
  "callout",
  "status",
  UNKNOWN_ENVELOPE_TYPE
];

describe("adapter round-trip", () => {
  it("round-trips default-like blocks through EditorDocument", () => {
    const bn = [
      {
        id: "p1",
        type: "paragraph",
        props: { textColor: "default" },
        content: [{ type: "text", text: "Hello", styles: {} }],
        children: []
      },
      {
        id: "h1",
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "Title", styles: { bold: true } }],
        children: []
      }
    ];

    const doc = fromBlockNote(bn);
    expect(doc.schemaVersion).toBe(1);
    expect(doc.blocks).toHaveLength(2);
    expect(doc.blocks[0]?.children).toBeUndefined();

    const json = serializeEditorDocument(doc);
    expect(json).toContain('"schemaVersion":1');

    const back = toBlockNote(doc, { knownBlockTypes: DEFAULT_KNOWN });
    expect(back[0]?.id).toBe("p1");
    expect(back[0]?.type).toBe("paragraph");
    expect(back[1]?.type).toBe("heading");
  });

  it("preserves unknown nested props via envelope on OE→BN→OE", () => {
    const doc = createEditorDocument([
      {
        id: "u1",
        type: "customWidget",
        props: {
          payload: { nested: true, count: 2 },
          label: "x"
        },
        content: [{ type: "text", text: "keep", styles: {} }]
      }
    ]);

    const bn = toBlockNote(doc, { knownBlockTypes: DEFAULT_KNOWN });
    expect(bn[0]?.type).toBe(UNKNOWN_ENVELOPE_TYPE);
    expect(bn[0]?.props?.originalType).toBe("customWidget");

    const restored = fromBlockNote(bn);
    expect(restored.blocks[0]?.type).toBe("customWidget");
    expect(restored.blocks[0]?.props).toEqual({
      payload: { nested: true, count: 2 },
      label: "x"
    });
    expect(restored.blocks[0]?.type).not.toBe(UNKNOWN_ENVELOPE_TYPE);
  });

  it("keeps callout and status as first-class known types", () => {
    const doc = createEditorDocument([
      {
        id: "c1",
        type: "callout",
        props: { variant: "warning", title: "Heads up" },
        content: [{ type: "text", text: "Careful", styles: {} }]
      },
      {
        id: "s1",
        type: "status",
        props: { state: "doing", label: "WIP" }
      }
    ]);

    const bn = toBlockNote(doc, { knownBlockTypes: DEFAULT_KNOWN });
    expect(bn.map((b) => b.type)).toEqual(["callout", "status"]);
    const again = fromBlockNote(bn);
    expect(again.blocks[0]?.type).toBe("callout");
    expect(again.blocks[1]?.props?.state).toBe("doing");
  });
});
