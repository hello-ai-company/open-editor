import {
  createBatchedChangeSink,
  type BatchPolicy,
  type OpenEditorChangeBatch,
  type OpenEditorChangeSink
} from "./batchedSink.js";

/**
 * Wraps createBatchedChangeSink so pendingCount observers stay in sync after
 * enqueue, manual flush/clear, and automatic raf/timeout/sync/maxBuffer flush.
 */
export function createPendingAwareSink(
  onFlush: (batch: OpenEditorChangeBatch) => void,
  onPendingChange: (count: number) => void,
  policy?: BatchPolicy
): OpenEditorChangeSink {
  const inner = createBatchedChangeSink((batch) => {
    onFlush(batch);
    // Auto-flush (raf / timeout / sync / maxBuffer) goes through this path only.
    onPendingChange(inner.pendingCount);
  }, policy);

  return {
    get pendingCount() {
      return inner.pendingCount;
    },
    enqueue(changes) {
      inner.enqueue(changes);
      onPendingChange(inner.pendingCount);
    },
    flush() {
      const batch = inner.flush();
      // When batch was null, onFlush did not run — still report current count.
      onPendingChange(inner.pendingCount);
      return batch;
    },
    clear() {
      inner.clear();
      onPendingChange(0);
    }
  };
}
