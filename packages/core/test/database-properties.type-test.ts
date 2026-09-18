/**
 * Compile-time contracts for Phase 4F-3B typed filters / property metadata.
 * Included via package tsconfig — no runtime runner.
 */
import type {
  DatabaseFilter,
  DatabaseListOptions,
  DatabasePropertyDefinition,
  DatabasePropertySort,
  DatabaseProvider,
  DatabaseQueryCapabilities,
  EditorDatabase
} from "../src/index.js";

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

// --- Valid filters compile ---

const numberGt: DatabaseFilter = {
  propertyId: "score",
  propertyType: "number",
  operator: "gt",
  value: 10
};

const textContains: DatabaseFilter = {
  propertyId: "title",
  propertyType: "text",
  operator: "contains",
  value: "hello"
};

const booleanIs: DatabaseFilter = {
  propertyId: "done",
  propertyType: "boolean",
  operator: "is",
  value: true
};

const dateOn: DatabaseFilter = {
  propertyId: "due",
  propertyType: "date",
  operator: "on",
  value: "2026-09-18"
};

const statusEquals: DatabaseFilter = {
  propertyId: "status",
  propertyType: "status",
  operator: "equals",
  value: "doing"
};

const isEmpty: DatabaseFilter = {
  propertyId: "link",
  propertyType: "url",
  operator: "isEmpty"
};

void numberGt;
void textContains;
void booleanIs;
void dateOn;
void statusEquals;
void isEmpty;

// --- Invalid combinations fail ---

// @ts-expect-error number property cannot use text operator "contains"
const badNumberContains: DatabaseFilter = {
  propertyId: "score",
  propertyType: "number",
  operator: "contains",
  value: "x"
};

// @ts-expect-error boolean "is" requires boolean value, not string
const badBooleanValue: DatabaseFilter = {
  propertyId: "done",
  propertyType: "boolean",
  operator: "is",
  value: "true"
};

// @ts-expect-error status cannot use numeric operator "gt"
const badStatusGt: DatabaseFilter = {
  propertyId: "status",
  propertyType: "status",
  operator: "gt",
  value: "done"
};

void badNumberContains;
void badBooleanValue;
void badStatusGt;

// --- Property sort / capabilities / definitions ---

const propertySort: DatabasePropertySort = {
  propertyId: "score",
  direction: "desc"
};

const caps: DatabaseQueryCapabilities = {
  propertyFilters: true,
  propertySort: true
};

const definition: DatabasePropertyDefinition = {
  id: "status",
  name: "Status",
  type: "status",
  options: [
    { value: "todo", label: "To do" },
    { value: "doing", label: "Doing" },
    { value: "done", label: "Done" }
  ]
};

const db: EditorDatabase = {
  id: "tasks",
  title: "Tasks",
  propertyDefinitions: [definition],
  queryCapabilities: caps
};

const listOpts: DatabaseListOptions = {
  query: "x",
  filters: [numberGt],
  propertySort
};

void propertySort;
void caps;
void definition;
void db;
void listOpts;

// --- Legacy provider still compiles (no 4F-3B fields required) ---

const legacyProvider: DatabaseProvider = {
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

void legacyProvider;

type _LegacyOptsOptional = Expect<
  Equal<DatabaseListOptions["filters"], readonly DatabaseFilter[] | undefined>
>;
type _PropertySortOptional = Expect<
  Equal<
    DatabaseListOptions["propertySort"],
    DatabasePropertySort | undefined
  >
>;
void 0 as unknown as _LegacyOptsOptional;
void 0 as unknown as _PropertySortOptional;
