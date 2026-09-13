import {
  EDITOR_DOCUMENT_SCHEMA_VERSION,
  createEditorDocument,
  deserializeEditorDocument,
  isEditorDocument,
  isJsonValue,
  isSupportedSchemaVersion,
  serializeEditorDocument,
  type EditorProviders,
  type JsonValue,
  type NativeBridge
} from "@hello-ai-company/editor-core";

const blocks = [
  {
    id: "p1",
    type: "paragraph",
    props: { text: "isolated" },
    content: [{ type: "text", text: "isolated" }]
  }
];

const document = createEditorDocument(blocks);
const serialized = serializeEditorDocument(document);
const restored = deserializeEditorDocument(serialized);

const payload: JsonValue = { ok: true, count: 1 };
const bridge: NativeBridge = {
  ready(documentId) {
    if (documentId.length === 0) {
      throw new Error("documentId required");
    }
  },
  commit(next) {
    if (!isJsonValue(next)) {
      throw new Error("commit payload must be JsonValue");
    }
  }
};

const providers: EditorProviders = {
  nativeBridge: bridge
};

export const isolatedConsumerReady =
  document.schemaVersion === EDITOR_DOCUMENT_SCHEMA_VERSION
  && isSupportedSchemaVersion(restored.schemaVersion)
  && isEditorDocument(restored)
  && providers.nativeBridge !== undefined
  && isJsonValue(payload);
