import { describe, expect, it } from "vitest";
import { resolveChildPageDisplay } from "../src/workspace/childPage.js";
import { resolvePageCardDisplay } from "../src/workspace/pageCard.js";
import { safeResolveRowMedia } from "../src/workspace/databaseRowPresentation.js";
import { isSafeMediaUrl } from "../src/security/safeUrl.js";

describe("untrusted media URLs", () => {
  it.each([
    ["https://example.test/image.png", true],
    ["/assets/image.png", true],
    ["image.png", true],
    ["javascript:alert(1)", false],
    ["data:image/svg+xml,<svg onload=alert(1)>", false],
    ["//tracker.example/image.png", false],
    ["https://user:secret@example.test/image.png", false],
    ["https:example.test/image.png", false],
    ["https:\\tracker.example\\image.png", false],
    ["https://example.test/\nimage.png", false]
  ])("checks %s", (url, expected) => {
    expect(isSafeMediaUrl(url)).toBe(expected);
  });

  it("drops unsafe page and child-page images before rendering", () => {
    const runtime = { resolve: () => ({ title: "Page", imageUrl: "javascript:alert(1)" }) };
    expect(resolvePageCardDisplay(runtime, "page").imageUrl).toBeUndefined();
    expect(resolveChildPageDisplay(runtime, "page").imageUrl).toBeUndefined();
  });

  it("fails closed when a gallery media resolver returns an unsafe URL", () => {
    expect(safeResolveRowMedia({ resolveRowMedia: () => ({ src: "data:text/html,unsafe" }) }, {
      databaseId: "db",
      rowKey: "row",
      row: {},
      viewId: "gallery",
      viewType: "gallery"
    })).toBeNull();
  });
});
