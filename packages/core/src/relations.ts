/**
 * Outgoing semantic relationships extracted from an EditorDocument.
 *
 * DocumentIndex stays structural (outline / block text).
 * RelationIndex models references (pages, child pages, blocks, databases).
 *
 * Workspace-wide *incoming* backlinks are NOT computed here — hosts supply
 * them via BacklinkProvider.
 */

export type RelationKind =
  | "page-reference"
  | "child-page"
  | "block-reference"
  | "database-relation";

export type RelationTargetType = "page" | "block" | "database" | "row";

export type RelationEdge = {
  /** Owning document that contains the reference. */
  sourceDocumentId: string;
  /** Block that holds the reference (when known). */
  sourceBlockId?: string;
  targetType: RelationTargetType;
  targetId: string;
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
    edge.targetId
  ].join("\0");
}

export function withRelationEdgeId(edge: RelationEdge): RelationEdge {
  if (edge.edgeId) return edge;
  return { ...edge, edgeId: relationEdgeId(edge) };
}
