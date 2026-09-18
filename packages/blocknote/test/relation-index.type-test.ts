/**
 * Compile-time RelationIndex target-query invariants (Phase 4F-2B R2).
 */
import type { RelationTargetQuery } from "@hello-ai-company/editor-core";
import { createRelationIndex } from "../src/workspace/relationIndex.js";

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const index = createRelationIndex();

index.listOutgoingTo({ targetType: "page", targetId: "p1" });
index.listOutgoingTo({ targetType: "block", targetId: "b1" });
index.listOutgoingTo({ targetType: "database", targetId: "db-a" });
index.listOutgoingTo({
  targetType: "database-row",
  targetDatabaseId: "db-a",
  targetId: "row-1"
});

// @ts-expect-error listOutgoingTo no longer accepts positional targetType/targetId
index.listOutgoingTo("page", "p1");

// @ts-expect-error database-row query requires targetDatabaseId
index.listOutgoingTo({ targetType: "database-row", targetId: "row-1" });

function narrowTarget(target: RelationTargetQuery): string {
  if (target.targetType === "database-row") {
    type _DbIdIsString = Expect<Equal<typeof target.targetDatabaseId, string>>;
    void 0 as unknown as _DbIdIsString;
    return target.targetDatabaseId;
  }
  return target.targetId;
}

void narrowTarget({
  targetType: "database-row",
  targetDatabaseId: "db-a",
  targetId: "row-1"
});
void index;
