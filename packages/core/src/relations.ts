/**
 * Outgoing semantic relationships extracted from an EditorDocument.
 *
 * DocumentIndex stays structural (outline / block text).
 * RelationIndex models references (pages, child pages, blocks, databases).
 *
 * Workspace-wide *incoming* backlinks are NOT computed here — hosts supply
 * them via BacklinkProvider.
 *
 * Distinguish:
 * - database-view-reference → a databaseView block pointing at a database
 * - database-row-relation → a reference to a specific row within a database
 *
 * Row keys are only unique within a database: db-a/row-1 ≠ db-b/row-1.
 */

export type RelationKind =
  | "page-reference"
  | "child-page"
  | "block-reference"
  | "database-view-reference"
  | "database-row-relation";

export type RelationTargetType =
  | "page"
  | "block"
  | "database"
  | "database-row";

export type RelationEdge = {
  /** Owning document that contains the reference. */
  sourceDocumentId: string;
  /** Block that holds the reference (when known). */
  sourceBlockId?: string;
  targetType: RelationTargetType;
  /**
   * Target identity. For `database-row`, this is the row key/id scoped by
   * `targetDatabaseId` (required for that target type).
   */
  targetId: string;
  /** Required when targetType is `database-row`. */
  targetDatabaseId?: string;
  kind: RelationKind;
  /** Optional stable edge key for incremental upserts. */
  edgeId?: string;
};

export function relationEdgeId(edge: Omit<RelationEdge, "edgeId">): string {
  return [
    edge.sourceDocumentId,
    edge.sourceBlockId ?? "",
    edge.kind,
    edge.targetType,
    edge.targetDatabaseId ?? "",
    edge.targetId
  ].join("\0");
}

export function withRelationEdgeId(edge: RelationEdge): RelationEdge {
  if (edge.edgeId) return edge;
  return { ...edge, edgeId: relationEdgeId(edge) };
}
