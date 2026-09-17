import type { EditorBlock } from "@hello-ai-company/editor-core";

export type OpenEditorChangeSource =
  | "local"
  | "paste"
  | "drop"
  | "undo"
  | "redo"
  | "undo-redo"
  | "yjs-remote"
  | "unknown";

export type OpenEditorBlockChange =
  | {
      type: "insert" | "delete";
      blockId: string;
      block: EditorBlock;
      prevBlock?: undefined;
      source: OpenEditorChangeSource;
      parentId?: string | null;
      indexHint?: number;
    }
  | {
      type: "update";
      blockId: string;
      block: EditorBlock;
      prevBlock: EditorBlock;
      source: OpenEditorChangeSource;
    }
  | {
      type: "move";
      blockId: string;
      block: EditorBlock;
      prevBlock: EditorBlock;
      source: OpenEditorChangeSource;
      prevParentId?: string | null;
      currentParentId?: string | null;
    };

export type OpenEditorChangeBatch = {
  seq: number;
  flushedAt: number;
  changes: readonly OpenEditorBlockChange[];
  coalesced: boolean;
};

export type BatchPolicy = {
  /** Default: "raf" */
  strategy?: "sync" | "raf" | "timeout";
  /** For strategy "timeout" — default 32ms */
  delayMs?: number;
  /** Max changes buffered before forced flush — default 256 */
  maxBuffer?: number;
  /** Coalesce consecutive updates to the same blockId (keep latest only) */
  coalesceUpdatesByBlockId?: boolean;
};

export type OpenEditorChangeSink = {
  enqueue(changes: readonly OpenEditorBlockChange[]): void;
  flush(): OpenEditorChangeBatch | null;
  clear(): void;
  readonly pendingCount: number;
};

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function schedule(policy: Required<Pick<BatchPolicy, "strategy" | "delayMs">>, run: () => void): () => void {
  if (policy.strategy === "sync") {
    run();
    return () => undefined;
  }
  if (policy.strategy === "timeout") {
    const id = setTimeout(run, policy.delayMs);
    return () => clearTimeout(id);
  }
  if (typeof requestAnimationFrame === "function") {
    const id = requestAnimationFrame(() => run());
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(run, 16);
  return () => clearTimeout(id);
}

function coalesceBuffer(
  buffer: OpenEditorBlockChange[],
  incoming: readonly OpenEditorBlockChange[],
  coalesceUpdates: boolean
): OpenEditorBlockChange[] {
  const next = [...buffer];

  for (const change of incoming) {
    if (change.type === "delete") {
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i]?.blockId === change.blockId) {
          next.splice(i, 1);
        }
      }
      next.push(change);
      continue;
    }

    if (change.type === "update" && coalesceUpdates) {
      const existingIndex = next.findIndex(
        (item) => item.blockId === change.blockId && item.type === "update"
      );
      if (existingIndex >= 0) {
        const existing = next[existingIndex];
        if (existing && existing.type === "update") {
          next[existingIndex] = {
            ...change,
            prevBlock: existing.prevBlock
          };
          continue;
        }
      }

      const insertIndex = next.findIndex(
        (item) => item.blockId === change.blockId && item.type === "insert"
      );
      if (insertIndex >= 0) {
        const inserted = next[insertIndex];
        if (inserted && inserted.type === "insert") {
          next[insertIndex] = {
            ...inserted,
            block: change.block
          };
          continue;
        }
      }
    }

    next.push(change);
  }

  return next;
}

export function createBatchedChangeSink(
  onFlush: (batch: OpenEditorChangeBatch) => void,
  policy?: BatchPolicy
): OpenEditorChangeSink {
  const strategy = policy?.strategy ?? "raf";
  const delayMs = policy?.delayMs ?? 32;
  const maxBuffer = policy?.maxBuffer ?? 256;
  const coalesceUpdatesByBlockId = policy?.coalesceUpdatesByBlockId ?? true;

  let buffer: OpenEditorBlockChange[] = [];
  let seq = 0;
  let cancelScheduled: (() => void) | undefined;
  let coalesced = false;

  const sink: OpenEditorChangeSink = {
    get pendingCount() {
      return buffer.length;
    },
    enqueue(changes) {
      if (changes.length === 0) return;
      const before = buffer.length;
      buffer = coalesceBuffer(buffer, changes, coalesceUpdatesByBlockId);
      if (before > 0 || changes.length > 1 || buffer.length < before + changes.length) {
        coalesced = true;
      }
      if (buffer.length >= maxBuffer || strategy === "sync") {
        sink.flush();
        return;
      }
      if (!cancelScheduled) {
        cancelScheduled = schedule({ strategy, delayMs }, () => {
          cancelScheduled = undefined;
          sink.flush();
        });
      }
    },
    flush() {
      if (cancelScheduled) {
        cancelScheduled();
        cancelScheduled = undefined;
      }
      if (buffer.length === 0) return null;
      seq += 1;
      const batch: OpenEditorChangeBatch = {
        seq,
        flushedAt: nowMs(),
        changes: buffer,
        coalesced
      };
      buffer = [];
      coalesced = false;
      onFlush(batch);
      return batch;
    },
    clear() {
      if (cancelScheduled) {
        cancelScheduled();
        cancelScheduled = undefined;
      }
      buffer = [];
      coalesced = false;
    }
  };

  return sink;
}
