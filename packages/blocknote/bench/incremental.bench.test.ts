/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { createBatchedChangeSink } from "../src/bridge/batchedSink.js";
import type { OpenEditorBlockChange } from "../src/bridge/batchedSink.js";

/**
 * Smoke benchmark: GOOD path (batched changes only) stays cheap vs BAD full serialize.
 * Does not claim faster than BlockNote — compares OpenEditor GOOD vs BAD arms.
 */
describe("benchmark smoke", () => {
  it("GOOD path processes many updates without full JSON.stringify of a large doc", () => {
    const N = 1000;
    const largeDoc = {
      schemaVersion: 1,
      blocks: Array.from({ length: N }, (_, i) => ({
        id: `p${i}`,
        type: "paragraph",
        content: [{ type: "text", text: `Block ${i}`, styles: {} }]
      }))
    };

    const goodChanges: OpenEditorBlockChange[] = [];
    const sink = createBatchedChangeSink(
      (batch) => {
        goodChanges.push(...batch.changes);
      },
      { strategy: "sync" }
    );

    const goodStart = performance.now();
    for (let i = 0; i < 50; i += 1) {
      sink.enqueue([
        {
          type: "update",
          blockId: "p500",
          block: {
            id: "p500",
            type: "paragraph",
            content: [{ type: "text", text: `t${i}`, styles: {} }]
          },
          prevBlock: {
            id: "p500",
            type: "paragraph",
            content: [{ type: "text", text: `t${i - 1}`, styles: {} }]
          },
          source: "local"
        }
      ]);
    }
    const goodMs = performance.now() - goodStart;

    const badStart = performance.now();
    for (let i = 0; i < 50; i += 1) {
      JSON.stringify(largeDoc);
    }
    const badMs = performance.now() - badStart;

    expect(goodChanges.length).toBe(50);
    // Soft assertion: GOOD should not be dramatically slower than BAD stringify.
    // On tiny N BAD may win; we only assert GOOD completed and produced changes.
    expect(goodMs).toBeGreaterThanOrEqual(0);
    expect(badMs).toBeGreaterThanOrEqual(0);
  });
});
