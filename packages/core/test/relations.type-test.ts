/**
 * Compile-time RelationEdge / BacklinkQuery / RelationTargetQuery invariants
 * (Phase 4F-2B R2).
 */
import type {
  BacklinkQuery,
  RelationEdge,
  RelationTargetQuery
} from "../src/index.js";

type Expect<T extends true> = T;
type Extends<A, B> = A extends B ? true : false;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const validPage: RelationEdge = {
  sourceDocumentId: "doc",
  targetType: "page",
  targetId: "page-a",
  kind: "page-reference"
};

const validChild: RelationEdge = {
  sourceDocumentId: "doc",
  targetType: "page",
  targetId: "page-b",
  kind: "child-page"
};

const validBlock: RelationEdge = {
  sourceDocumentId: "doc",
  targetType: "block",
  targetId: "block-a",
  kind: "block-reference"
};

const validDatabase: RelationEdge = {
  sourceDocumentId: "doc",
  targetType: "database",
  targetId: "db-a",
  kind: "database-view-reference"
};

const validRow: RelationEdge = {
  sourceDocumentId: "doc",
  targetType: "database-row",
  targetDatabaseId: "db-a",
  targetId: "row-1",
  kind: "database-row-relation"
};

// @ts-expect-error database-row requires targetDatabaseId
const missingDatabase: RelationEdge = {
  sourceDocumentId: "doc",
  targetType: "database-row",
  targetId: "row-1",
  kind: "database-row-relation"
};

// @ts-expect-error invalid kind for page
const wrongPageKind: RelationEdge = {
  sourceDocumentId: "doc",
  targetType: "page",
  targetId: "page-a",
  kind: "database-row-relation"
};

// @ts-expect-error invalid kind for database
const wrongDatabaseKind: RelationEdge = {
  sourceDocumentId: "doc",
  targetType: "database",
  targetId: "db-a",
  kind: "page-reference"
};

const validRowQuery: BacklinkQuery = {
  targetType: "database-row",
  targetDatabaseId: "db-a",
  targetId: "row-1"
};

// @ts-expect-error database-row query requires targetDatabaseId
const invalidRowQuery: BacklinkQuery = {
  targetType: "database-row",
  targetId: "row-1"
};

const validRowTarget: RelationTargetQuery = {
  targetType: "database-row",
  targetDatabaseId: "db-a",
  targetId: "row-1"
};

// @ts-expect-error database-row target query requires targetDatabaseId
const invalidRowTarget: RelationTargetQuery = {
  targetType: "database-row",
  targetId: "row-1"
};

function assertRowNarrow(edge: RelationEdge): string {
  if (edge.targetType === "database-row") {
    type _DbIdIsString = Expect<Equal<typeof edge.targetDatabaseId, string>>;
    void 0 as unknown as _DbIdIsString;
    return edge.targetDatabaseId;
  }
  return "";
}

function assertBacklinkNarrow(query: BacklinkQuery): string {
  if (query.targetType === "database-row") {
    type _DbIdIsString = Expect<Equal<typeof query.targetDatabaseId, string>>;
    void 0 as unknown as _DbIdIsString;
    return query.targetDatabaseId;
  }
  return query.targetId;
}

void validPage;
void validChild;
void validBlock;
void validDatabase;
void validRow;
void missingDatabase;
void wrongPageKind;
void wrongDatabaseKind;
void validRowQuery;
void invalidRowQuery;
void validRowTarget;
void invalidRowTarget;
void assertRowNarrow(validRow);
void assertBacklinkNarrow(validRowQuery);
void 0 as unknown as Expect<Extends<typeof validRow.targetType, "database-row">>;
