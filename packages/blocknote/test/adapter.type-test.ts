import { createEditorDocument, type EditorDocument } from "@hello-ai-company/editor-core";
import { fromBlockNote, toBlockNote, UNKNOWN_ENVELOPE_TYPE } from "../src/index.js";
import type { OpenEditorBlockChange, OpenEditorChangeBatch } from "../src/index.js";

// Type-level smoke: round-trip assignability
const doc: EditorDocument = createEditorDocument([
  { id: "p1", type: "paragraph", content: "x" }
]);
const partials = toBlockNote(doc, { knownBlockTypes: ["paragraph", UNKNOWN_ENVELOPE_TYPE] });
const again: EditorDocument = fromBlockNote(partials as never);

const _change: OpenEditorBlockChange = {
  type: "update",
  blockId: "p1",
  block: again.blocks[0]!,
  prevBlock: again.blocks[0]!,
  source: "local"
};
const _batch: OpenEditorChangeBatch = {
  seq: 1,
  flushedAt: 0,
  changes: [_change],
  coalesced: false
};

void _batch;
