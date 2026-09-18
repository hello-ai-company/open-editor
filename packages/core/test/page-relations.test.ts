import { describe, expect, it } from "vitest";
import {
  PAGE_HREF_PREFIX,
  decodePageHref,
  encodePageHref,
  isPageHref
} from "../src/pageLink.js";
import {
  relationEdgeId,
  withRelationEdgeId,
  type RelationEdge
} from "../src/relations.js";

describe("page link codec", () => {
  it("round-trips arbitrary string ids", () => {
    const ids = [
      "plain",
      "with space",
      "slash/id",
      "hash#frag",
      "ユニコード",
      "uuid-550e8400-e29b-41d4-a716-446655440000"
    ];
    for (const id of ids) {
      const href = encodePageHref(id);
      expect(href.startsWith(PAGE_HREF_PREFIX)).toBe(true);
      expect(decodePageHref(href)).toBe(id);
      expect(isPageHref(href)).toBe(true);
    }
  });

  it("rejects malformed input", () => {
    expect(decodePageHref("")).toBeNull();
    expect(decodePageHref("#page:")).toBeNull();
    expect(decodePageHref("#note:abc")).toBeNull();
    expect(decodePageHref("page:abc")).toBeNull();
    expect(decodePageHref("#page:%E0%A4%A")).toBeNull();
    expect(isPageHref("https://example.com")).toBe(false);
  });
});

describe("relation edge helpers", () => {
  it("builds stable edge ids", () => {
    const edge: RelationEdge = {
      sourceDocumentId: "doc-1",
      sourceBlockId: "b1",
      targetType: "page",
      targetId: "page-a",
      kind: "page-reference"
    };
    const id = relationEdgeId(edge);
    expect(withRelationEdgeId(edge).edgeId).toBe(id);
    expect(withRelationEdgeId({ ...edge, edgeId: "custom" }).edgeId).toBe(
      "custom"
    );
  });

  it("treats same row id in two databases as distinct targets", () => {
    const a = relationEdgeId({
      sourceDocumentId: "doc",
      sourceBlockId: "b1",
      targetType: "database-row",
      targetId: "row-1",
      targetDatabaseId: "db-a",
      kind: "database-row-relation"
    });
    const b = relationEdgeId({
      sourceDocumentId: "doc",
      sourceBlockId: "b1",
      targetType: "database-row",
      targetId: "row-1",
      targetDatabaseId: "db-b",
      kind: "database-row-relation"
    });
    expect(a).not.toBe(b);
  });

  it("narrows targetDatabaseId to string on database-row edges", () => {
    const edge: RelationEdge = {
      sourceDocumentId: "doc",
      targetType: "database-row",
      targetDatabaseId: "db-a",
      targetId: "row-1",
      kind: "database-row-relation"
    };
    expect(edge.targetType).toBe("database-row");
    if (edge.targetType === "database-row") {
      // Runtime + type narrow: string, not string | undefined
      expect(edge.targetDatabaseId.length).toBeGreaterThan(0);
      expect(edge.targetDatabaseId).toBe("db-a");
    }
  });
});
