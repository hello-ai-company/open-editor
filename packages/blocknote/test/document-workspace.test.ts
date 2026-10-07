import { describe, expect, it } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createDocumentColumns, updateDocumentColumns, validateDocumentColumns } from "../src/document/columns.js";
import { createHtmlWidgetPreview, parseHtmlWidgetSource, sanitizeWidgetMarkup } from "../src/document/htmlWidget.js";

function fixture() {
  let n = 0;
  const group = createDocumentColumns([[{ id: "a", type: "paragraph", content: "A" }], [{ id: "b", type: "futureWidget", props: { payload: { keep: true } } }], [{ id: "c", type: "paragraph", content: "C" }]], { id: "group", idFactory: () => `col${n++}` });
  return createEditorDocument([group]);
}

describe("independently authored Document columns", () => {
  it("moves opaque content between columns without mutating input or losing order", () => {
    const before = fixture(), snapshot = structuredClone(before);
    const next = updateDocumentColumns(before, { type: "move", blockId: "b", columnId: "col0", index: 1 });
    expect(next.blocks[0]!.children![0]!.children!.map(b => b.id)).toEqual(["a", "b"]);
    expect(next.blocks[0]!.children![1]!.children).toEqual([]);
    expect(next.blocks[0]!.children![0]!.children![1]).toEqual(snapshot.blocks[0]!.children![1]!.children![0]);
    expect(before).toEqual(snapshot);
  });
  it("removes a column only with an explicit destination; unwrap retains ordered children", () => {
    const next = updateDocumentColumns(fixture(), { type: "remove-column", groupId: "group", columnId: "col1", destinationId: "col0" });
    expect(next.blocks[0]!.children).toHaveLength(2);
    expect(() => updateDocumentColumns(next, { type: "remove-column", groupId: "group", columnId: "col0", destinationId: "col2" })).toThrow();
    const flat = updateDocumentColumns(next, { type: "unwrap", groupId: "group" });
    expect(flat.blocks.map(b => b.id)).toEqual(["a", "b", "c"]);
  });
  it("keeps column widths with identity when reordered", () => {
    const wide = updateDocumentColumns(fixture(), { type: "width", columnId: "col0", width: 2 });
    const next = updateDocumentColumns(wide, { type: "reorder", groupId: "group", columnId: "col0", index: 2 });
    expect(next.blocks[0]!.children!.map(b => [b.id, b.props?.width])).toEqual([["col1", 1], ["col2", 1], ["col0", 2]]);
  });
  it.each([NaN, Infinity, 0, -1, 11])("rejects invalid width %s without a partial result", width => {
    const before = fixture(), snapshot = structuredClone(before);
    expect(() => updateDocumentColumns(before, { type: "width", columnId: "col0", width })).toThrow();
    expect(before).toEqual(snapshot);
  });
  it("rejects orphan columns, duplicates, invalid group children and cycles", () => {
    const orphan = fixture().blocks[0]!.children![0]!;
    expect(validateDocumentColumns(createEditorDocument([orphan]))).not.toEqual([]);
    const doc = fixture(); doc.blocks[0]!.children!.push({ id: "a", type: "paragraph" });
    expect(validateDocumentColumns(doc).length).toBeGreaterThan(1);
    expect(() => updateDocumentColumns(fixture(), { type: "move", blockId: "group", columnId: "col0", index: 0 })).toThrow(/cycle/);
  });
  it("supports nested groups and rejects more than six columns", () => {
    let n = 0;
    const nested = createDocumentColumns([[{ id: "nestedA", type: "paragraph" }], []], { id: "nested", idFactory: () => `nestedCol${n++}` });
    const doc = fixture(); doc.blocks[0]!.children![0]!.children!.push(nested);
    expect(validateDocumentColumns(doc)).toEqual([]);
    expect(() => createDocumentColumns(Array(7).fill([]))).toThrow();
  });
});

describe("inert HTML widget preview", () => {
  it("keeps source JS while removing executable/remote markup from preview", () => {
    const source = { html: '<div id="card" onclick="alert(1)"><strong>Hello</strong><script>fetch("https://evil.test")</script><iframe src="https://evil.test"></iframe><img src="https://evil.test/x"><a href="https://evil.test">Go</a></div>', css: '@import "https://evil.test/style";div{background:url(https://evil.test/image)}', javascript: 'while(true){}' };
    const before = structuredClone(source), html = createHtmlWidgetPreview(source);
    expect(source).toEqual(before);
    expect(parseHtmlWidgetSource(source).javascript).toBe('while(true){}');
    expect(html).toContain("script-src 'none'"); expect(html).toContain("connect-src 'none'");
    expect(html).not.toMatch(/<(script|iframe|img)\b/i);
    expect(html).not.toMatch(/onclick=|href=/i); expect(html).not.toContain('while(true){}');
    expect(html).toContain('<div id="card"><strong>Hello</strong><a>Go</a></div>');
  });
  it.each(['<svg><script>bad()</script></svg>', '<math><mtext><img src=x onerror=bad()></mtext></math>', '<div title="class=\"onclick\"" onpointerdown=bad()>Text</div>', '<script/src=x>bad()</script>', '<!--<script>bad()</script>--><p>OK</p>', '<iframe srcdoc="<script>bad()</script>"></iframe>'])('does not leak active attributes/tags: %s', input => {
    const clean = sanitizeWidgetMarkup(input);
    expect(clean).not.toMatch(/<(script|svg|math|iframe|img)\b|onerror=|onpointerdown=|srcdoc=/i);
  });
  it("prevents stylesheet termination from injecting a document and rejects accessors/oversized inputs", () => {
    const html = createHtmlWidgetPreview({ html: '<p>Hello</p>', css: '</style><script>bad()</script>', javascript: '' });
    expect(html).not.toMatch(/<script\b/i);
    expect(() => parseHtmlWidgetSource({ html: 'x'.repeat(200001), css: '', javascript: '' })).toThrow(/budget/);
    expect(() => parseHtmlWidgetSource({ get html() { throw new Error('must not run'); }, css: '', javascript: '' })).toThrow(/data property/);
  });
});
