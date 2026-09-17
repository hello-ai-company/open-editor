import { describe, expect, it } from "vitest";
import { createBatchedChangeSink } from "../src/bridge/batchedSink.js";
import { createBlockChangeBridge } from "../src/bridge/createBlockChangeBridge.js";
import type { BlockLike } from "../src/types.js";

function fakeBlock(id: string, text: string): BlockLike {
  return {
    id,
    type: "paragraph",
    props: {},
    content: [{ type: "text", text, styles: {} }],
    children: []
  };
}

describe("incremental change bridge", () => {
  it("uses getChanges and never reads editor.document on the hot path", () => {
    const batches: Array<{ changes: Array<{ type: string; blockId: string }> }> = [];
    const bridge = createBlockChangeBridge({
      batch: { strategy: "sync" },
      onBatch: (batch) => batches.push(batch as never)
    });

    let documentReads = 0;
    const editor = {
      get document() {
        documentReads += 1;
        return [fakeBlock("p1", "full")];
      },
      onChange(
        cb: (
          editor: unknown,
          ctx: { getChanges: () => Array<Record<string, unknown>> }
        ) => void
      ) {
        for (let i = 0; i < 20; i += 1) {
          cb(editor, {
            getChanges: () => [
              {
                type: "update",
                block: fakeBlock("p1", `t${i}`),
                prevBlock: fakeBlock("p1", `t${i - 1}`),
                source: { type: "local" }
              }
            ]
          });
        }
        return () => undefined;
      }
    };

    const detach = bridge.attach(editor as never);
    detach();

    expect(documentReads).toBe(0);
    expect(batches.length).toBe(20);
    expect(batches[0]?.changes[0]?.type).toBe("update");
    expect(batches[0]?.changes[0]?.blockId).toBe("p1");
  });

  it("coalesces consecutive updates to the same block id within one enqueue", () => {
    const flushed: Array<{ changes: Array<{ type: string; blockId: string }>; coalesced: boolean }> =
      [];
    const sink = createBatchedChangeSink((batch) => flushed.push(batch as never), {
      strategy: "timeout",
      delayMs: 50,
      coalesceUpdatesByBlockId: true
    });

    const block = {
      id: "p1",
      type: "paragraph" as const,
      content: "x"
    };

    sink.enqueue([
      {
        type: "update",
        blockId: "p1",
        block: { ...block, content: "a" },
        prevBlock: block,
        source: "local"
      },
      {
        type: "update",
        blockId: "p1",
        block: { ...block, content: "b" },
        prevBlock: { ...block, content: "a" },
        source: "local"
      }
    ]);
    const batch = sink.flush();
    expect(batch?.changes).toHaveLength(1);
    expect(batch?.changes[0]?.type).toBe("update");
    expect(batch?.coalesced).toBe(true);
  });

  it("delete cancels pending ops for the same id", () => {
    const sink = createBatchedChangeSink(() => undefined, {
      strategy: "timeout",
      delayMs: 100
    });
    const block = { id: "p1", type: "paragraph" as const };
    sink.enqueue([
      { type: "insert", blockId: "p1", block, source: "local" },
      {
        type: "update",
        blockId: "p1",
        block: { ...block, content: "x" },
        prevBlock: block,
        source: "local"
      },
      { type: "delete", blockId: "p1", block, source: "local" }
    ]);
    const batch = sink.flush();
    expect(batch?.changes).toHaveLength(1);
    expect(batch?.changes[0]?.type).toBe("delete");
  });

  it("can skip yjs-remote when includeUpdatesFromRemote is false", () => {
    let skips = 0;
    const batches: unknown[] = [];
    const bridge = createBlockChangeBridge({
      includeUpdatesFromRemote: false,
      batch: { strategy: "sync" },
      onBatch: (batch) => batches.push(batch),
      onDebugSkip: (reason) => {
        if (reason === "filtered-remote") skips += 1;
      }
    });

    const editor = {
      onChange(
        cb: (
          editor: unknown,
          ctx: { getChanges: () => Array<Record<string, unknown>> }
        ) => void
      ) {
        cb(editor, {
          getChanges: () => [
            {
              type: "update",
              block: fakeBlock("p1", "remote"),
              prevBlock: fakeBlock("p1", "old"),
              source: { type: "yjs-remote" }
            }
          ]
        });
        return () => undefined;
      }
    };

    bridge.attach(editor as never)();
    expect(batches).toHaveLength(0);
    expect(skips).toBe(1);
  });
});
