/**
 * Outgoing semantic relationships extracted from an EditorDocument.
 *
 * DocumentIndex stays structural (outline / block text).
 * RelationIndex models references (pages, child pages, blocks, databases).
 *
 * Workspace-wide *incoming* backlinks are NOT computed here — hosts supply
 * them via BacklinkProvider.
 *
 * `RelationEdge` is a **discriminated union**. Invalid targetType/kind
 * combinations are rejected by TypeScript.
 *
 * A database row reference is identified by the tuple `(databaseId, rowId)`.
 * `rowId` alone is never a globally valid database-row target:
 * db-a/row-1 ≠ db-b/row-1.
 *
 * Distinguish:
 * - database-view-reference → a databaseView block pointing at a database
 * - database-row-relation → a reference to a specific row within a database
 */

type RelationEdgeBase = {
  /** Owning document that contains the reference. */
  sourceDocumentId: string;
  /** Block that holds the reference (when known). */
  sourceBlockId?: string;
  /** Optional stable edge key for incremental upserts. */
  edgeId?: string;
};

export type PageReferenceEdge = RelationEdgeBase & {
  targetType: "page";
  targetId: string;
  kind: "page-reference" | "child-page";
};

export type BlockReferenceEdge = RelationEdgeBase & {
  targetType: "block";
  targetId: string;
  kind: "block-reference";
};

export type DatabaseViewReferenceEdge = RelationEdgeBase & {
  targetType: "database";
  targetId: string;
  kind: "database-view-reference";
};

export type DatabaseRowRelationEdge = RelationEdgeBase & {
  targetType: "database-row";
  /** Database that scopes `targetId` (required; row keys are not global). */
  targetDatabaseId: string;
  targetId: string;
  kind: "database-row-relation";
};

/**
 * Outgoing semantic edge. Discriminated on `targetType` (and constrained
 * `kind` per variant).
 */
export type RelationEdge =
  | PageReferenceEdge
  | BlockReferenceEdge
  | DatabaseViewReferenceEdge
  | DatabaseRowRelationEdge;

export type RelationKind = RelationEdge["kind"];
export type RelationTargetType = RelationEdge["targetType"];

/**
 * Typed target selector for RelationIndex queries.
 * `database-row` always requires `targetDatabaseId`.
 */
export type RelationTargetQuery =
  | {
      targetType: "page" | "block" | "database";
      targetId: string;
    }
  | {
      targetType: "database-row";
      targetDatabaseId: string;
      targetId: string;
    };

/** Distributive Omit — plain Omit collapses union keys incorrectly. */
type RelationEdgeInput = RelationEdge extends infer E
  ? E extends RelationEdge
    ? Omit<E, "edgeId">
    : never
  : never;

export function relationEdgeId(edge: RelationEdgeInput): string {
  const databaseScope =
    edge.targetType === "database-row" ? edge.targetDatabaseId : "";
  return [
    edge.sourceDocumentId,
    edge.sourceBlockId ?? "",
    edge.kind,
    edge.targetType,
    databaseScope,
    edge.targetId
  ].join("\0");
}

export function withRelationEdgeId(edge: RelationEdge): RelationEdge {
  if (edge.edgeId) return edge;
  return { ...edge, edgeId: relationEdgeId(edge) };
}
