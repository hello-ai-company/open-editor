import { describe, expect, it } from "vitest";
import { createDocumentIndex } from "../src/index/documentIndex.js";
import type { EditorBlock } from "@hello-ai-company/editor-core";

function makeBlocks(n: number): EditorBlock[] {
  const blocks: EditorBlock[] = [];
  for (let i = 0; i < n; i += 1) {
    const isHeading = i % 17 === 0;
    blocks.push({
      id: `b${i}`,
      type: isHeading ? "heading" : "paragraph",
      props: isHeading ? { level: (i % 3) + 1 } : undefined,
      content: [{ type: "text", text: `Block ${i} content about architecture`, styles: {} }]
    });
  }
  return blocks;
}

describe("document index bench smoke", () => {
  it.each([100, 1000, 5000])("builds and queries %s blocks", (n) => {
    const index = createDocumentIndex();
    const blocks = makeBlocks(n);
    const t0 = performance.now();
    index.replaceFromBlocks(blocks);
    const buildMs = performance.now() - t0;

    const t1 = performance.now();
    index.applyChanges([
      {
        type: "update",
        blockId: "b1",
        block: {
          id: "b1",
          type: "paragraph",
          content: [{ type: "text", text: "updated", styles: {} }]
        },
        prevBlock: blocks[1]!,
        source: "local"
      }
    ]);
    const updateMs = performance.now() - t1;

    const t2 = performance.now();
    const hits = index.query({ query: "architecture", limit: 20 });
    const queryMs = performance.now() - t2;

    // Structural only — record timings for humans, no brittle thresholds.
    console.info(
      JSON.stringify({
        n,
        buildMs: Number(buildMs.toFixed(2)),
        updateMs: Number(updateMs.toFixed(2)),
        queryMs: Number(queryMs.toFixed(2)),
        hits: hits.length,
        size: index.size()
      })
    );

    expect(index.size()).toBe(n);
    expect(hits.length).toBeGreaterThan(0);
    expect(index.getById("b1")?.text).toContain("updated");
  });
});
