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
  type BacklinkQuery,
  type DatabaseFilter,
  type DatabasePropertyDefinition,
  type DatabasePropertySort,
  type DatabaseProvider,
  type DatabaseQueryCapabilities,
  type EditorDatabase,
  type EditorProviders,
  type JsonValue,
  type NativeBridge,
  type PageProvider,
  type RelationEdge,
  type RelationKind,
  type RelationTargetQuery
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
/** Legacy consumer — no 4F-3B fields required. */
const database: DatabaseProvider = {
  listRows: async (databaseId, options) => ({
    databaseId,
    rows: [],
    items: [],
    schema: { title: "text" },
    config: {},
    pagination: {
      limit: options?.limit ?? 20,
      nextCursor: null,
      hasMore: false,
      total: 0
    }
  })
};

const propertyDefinitions: readonly DatabasePropertyDefinition[] = [
  {
    id: "status",
    name: "Status",
    type: "status",
    options: [{ value: "doing", label: "Doing" }]
  },
  { id: "score", name: "Score", type: "number" }
];
const queryCapabilities: DatabaseQueryCapabilities = {
  propertyFilters: true,
  propertySort: true
};
const typedDatabase: EditorDatabase = {
  id: "tasks",
  title: "Tasks",
  propertyDefinitions,
  queryCapabilities
};
const scoreFilter: DatabaseFilter = {
  propertyId: "score",
  propertyType: "number",
  operator: "gte",
  value: 5
};
const propertySort: DatabasePropertySort = {
  propertyId: "score",
  direction: "desc"
};
void typedDatabase;
void scoreFilter;
void propertySort;

const backlinks: BacklinkProvider = {
  async listBacklinks(query: BacklinkQuery) {
    if (query.targetType === "database-row") {
      return [
        {
          sourceDocumentId: "other",
          kind: "database-row-relation",
          sourceTitle: `${query.targetDatabaseId}/${query.targetId}`
        }
      ];
    }
    return [];
  }
};
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
  targetDatabaseId: "db-a",
  targetId: "row-1",
  kind
};
const edged = withRelationEdgeId(edge);
const otherId = relationEdgeId({
  ...edge,
  targetDatabaseId: "db-b"
});
const rowTarget: RelationTargetQuery = {
  targetType: "database-row",
  targetDatabaseId: "db-a",
  targetId: "row-1"
};

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
  && edged.edgeId !== otherId
  && rowTarget.targetDatabaseId === "db-a"
  && propertyDefinitions[0]?.type === "status"
  && queryCapabilities.propertyFilters === true;
