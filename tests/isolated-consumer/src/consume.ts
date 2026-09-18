import {
  EDITOR_DOCUMENT_SCHEMA_VERSION,
  createEditorDocument,
  deserializeEditorDocument,
  isEditorDocument,
  isJsonValue,
  isSupportedSchemaVersion,
  relationEdgeId,
  serializeEditorDocument,
  withRelationEdgeId,
  type BacklinkProvider,
  type DatabaseProvider,
  type EditorProviders,
  type JsonValue,
  type NativeBridge,
  type PageProvider,
  type RelationEdge,
  type RelationKind
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

const pages: PageProvider = {};
const database: DatabaseProvider = {};
const backlinks: BacklinkProvider = {};
const providers: EditorProviders = {
  nativeBridge: bridge,
  pages,
  database,
  backlinks
};

const kind: RelationKind = "database-row-relation";
const edge: RelationEdge = {
  sourceDocumentId: "doc",
  targetType: "database-row",
  targetId: "row-1",
  targetDatabaseId: "db-a",
  kind
};
const edged = withRelationEdgeId(edge);
const otherId = relationEdgeId({
  ...edge,
  targetDatabaseId: "db-b"
});

export const isolatedConsumerReady =
  document.schemaVersion === EDITOR_DOCUMENT_SCHEMA_VERSION
  && isSupportedSchemaVersion(restored.schemaVersion)
  && isEditorDocument(restored)
  && providers.nativeBridge !== undefined
  && providers.pages !== undefined
  && providers.database !== undefined
  && providers.backlinks !== undefined
  && isJsonValue(payload)
  && edged.edgeId !== undefined
  && edged.edgeId !== otherId;
