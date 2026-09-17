/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenEditorBlockChange } from "../src/bridge/batchedSink.js";
import { createPendingAwareSink } from "../src/bridge/pendingAwareSink.js";

function updateChange(id: string, text: string): OpenEditorBlockChange {
  const block = { id, type: "paragraph" as const, content: text };
  return {
    type: "update",
    blockId: id,
    block,
    prevBlock: { ...block, content: "prev" },
    source: "local"
  };
}

describe("createPendingAwareSink pendingCount", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("raf automatic flush notifies pendingCount back to 0", async () => {
    const pending: number[] = [];
    const flushed: unknown[] = [];
    const sink = createPendingAwareSink(
      (batch) => flushed.push(batch),
      (count) => pending.push(count),
      { strategy: "raf" }
    );

    sink.enqueue([updateChange("p1", "a")]);
    expect(sink.pendingCount).toBe(1);
    expect(pending.at(-1)).toBe(1);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    expect(flushed).toHaveLength(1);
    expect(sink.pendingCount).toBe(0);
    expect(pending.at(-1)).toBe(0);
  });

  it("timeout automatic flush notifies pendingCount back to 0", () => {
    vi.useFakeTimers();
    const pending: number[] = [];
    const flushed: unknown[] = [];
    const sink = createPendingAwareSink(
      (batch) => flushed.push(batch),
      (count) => pending.push(count),
      { strategy: "timeout", delayMs: 32 }
    );

    sink.enqueue([updateChange("p1", "a")]);
    expect(pending.at(-1)).toBe(1);
    expect(sink.pendingCount).toBe(1);

    vi.advanceTimersByTime(32);

    expect(flushed).toHaveLength(1);
    expect(sink.pendingCount).toBe(0);
    expect(pending.at(-1)).toBe(0);
  });

  it("manual flush notifies pendingCount back to 0", () => {
    vi.useFakeTimers();
    const pending: number[] = [];
    const sink = createPendingAwareSink(
      () => undefined,
      (count) => pending.push(count),
      { strategy: "timeout", delayMs: 1000 }
    );

    sink.enqueue([updateChange("p1", "a")]);
    expect(pending.at(-1)).toBe(1);

    const batch = sink.flush();
    expect(batch?.changes).toHaveLength(1);
    expect(sink.pendingCount).toBe(0);
    expect(pending.at(-1)).toBe(0);
  });

  it("clear notifies pendingCount back to 0", () => {
    vi.useFakeTimers();
    const pending: number[] = [];
    const sink = createPendingAwareSink(
      () => undefined,
      (count) => pending.push(count),
      { strategy: "timeout", delayMs: 1000 }
    );

    sink.enqueue([updateChange("p1", "a")]);
    expect(pending.at(-1)).toBe(1);

    sink.clear();
    expect(sink.pendingCount).toBe(0);
    expect(pending.at(-1)).toBe(0);
  });

  it("policy recreation starts at 0 and tracks the new policy", () => {
    vi.useFakeTimers();
    const pending: number[] = [];

    const first = createPendingAwareSink(
      () => undefined,
      (count) => pending.push(count),
      { strategy: "timeout", delayMs: 1000 }
    );
    first.enqueue([updateChange("p1", "a")]);
    expect(pending.at(-1)).toBe(1);

    // Simulate hook cleanup + recreate on batch policy change
    first.clear();
    expect(pending.at(-1)).toBe(0);

    const second = createPendingAwareSink(
      () => undefined,
      (count) => pending.push(count),
      { strategy: "timeout", delayMs: 20 }
    );
    expect(second.pendingCount).toBe(0);

    second.enqueue([updateChange("p2", "b")]);
    expect(pending.at(-1)).toBe(1);
    expect(second.pendingCount).toBe(1);

    vi.advanceTimersByTime(20);
    expect(second.pendingCount).toBe(0);
    expect(pending.at(-1)).toBe(0);
  });
});
