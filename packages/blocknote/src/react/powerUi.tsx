import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import type { BatchPolicy, OpenEditorChangeBatch } from "../bridge/batchedSink.js";
import { createPendingAwareSink } from "../bridge/pendingAwareSink.js";
import {
  createBlockChangeBridge,
  type BlockChangeBridge
} from "../bridge/createBlockChangeBridge.js";
import type {
  CommandRegistry,
  EditorCommandContext,
  PaletteItem
} from "../commands/registry.js";
import type { PowerSeams } from "../seams/types.js";

type EditorLike = {
  onChange: (
    callback: (editor: unknown, ctx: { getChanges: () => unknown[] }) => void,
    includeUpdatesFromRemote?: boolean
  ) => () => void;
  domElement?: HTMLElement | null;
  getTextCursorPosition: () => { block: unknown };
  insertBlocks: (...args: never[]) => unknown;
  updateBlock: (...args: never[]) => unknown;
  transact: <T>(fn: () => T) => T;
};

export type UseOpenEditorBlockChangesOptions = {
  editor: EditorLike;
  includeUpdatesFromRemote?: boolean;
  onBatch: (batch: OpenEditorChangeBatch) => void;
  batch?: BatchPolicy;
};

function batchPolicyKey(batch: BatchPolicy | undefined): string {
  return JSON.stringify({
    strategy: batch?.strategy ?? "raf",
    delayMs: batch?.delayMs ?? 32,
    maxBuffer: batch?.maxBuffer ?? 256,
    coalesceUpdatesByBlockId: batch?.coalesceUpdatesByBlockId ?? true
  });
}

/**
 * Subscribes to incremental BlockNote changes via createBlockChangeBridge.
 * Recreates the bridge when editor / remote / batch policy change.
 * `pendingCount` is React state updated on enqueue/flush (not a frozen ref read).
 */
export function useOpenEditorBlockChanges(options: UseOpenEditorBlockChangesOptions): {
  flush: () => OpenEditorChangeBatch | null;
  pendingCount: number;
} {
  const onBatchRef = useRef(options.onBatch);
  onBatchRef.current = options.onBatch;

  const [pendingCount, setPendingCount] = useState(0);
  const bridgeRef = useRef<BlockChangeBridge | null>(null);

  const includeUpdatesFromRemote = options.includeUpdatesFromRemote ?? true;
  const policyKey = batchPolicyKey(options.batch);
  const batchPolicy = useMemo((): BatchPolicy => {
    return options.batch ?? { strategy: "raf" };
    // policyKey captures batch field identity for recreate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyKey]);

  useEffect(() => {
    const sink = createPendingAwareSink(
      (batch) => {
        onBatchRef.current(batch);
      },
      (count) => {
        setPendingCount(count);
      },
      batchPolicy
    );

    const bridge = createBlockChangeBridge({
      includeUpdatesFromRemote,
      sink
    });
    bridgeRef.current = bridge;

    const detach = bridge.attach(options.editor as never);
    return () => {
      bridge.flush();
      detach();
      bridge.clear();
      bridgeRef.current = null;
      setPendingCount(0);
    };
  }, [options.editor, includeUpdatesFromRemote, batchPolicy]);

  const flush = useCallback(() => {
    return bridgeRef.current?.flush() ?? null;
  }, []);

  return {
    flush,
    pendingCount
  };
}

export async function getPowerSlashItems(
  registry: CommandRegistry,
  ctx: EditorCommandContext,
  query: string
) {
  const items = registry.toSlashItems(ctx, query);
  return filterSuggestionItems(items, query);
}

export type PowerCommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registry: CommandRegistry;
  context: EditorCommandContext;
};

export function PowerCommandPalette(props: PowerCommandPaletteProps): ReactElement | null {
  const { open, onOpenChange, registry, context } = props;
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const items: PaletteItem[] = useMemo(
    () => registry.toPaletteItems(context, query),
    [registry, context, query]
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const runActive = useCallback(async () => {
    const item = items[activeIndex];
    if (!item || item.disabledReason) return;
    await registry.run(item.id, context);
    onOpenChange(false);
  }, [activeIndex, context, items, onOpenChange, registry]);

  if (!open) return null;

  let lastGroup = "";

  return (
    <div
      className="oe-command-palette"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className="oe-command-palette__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <input
          ref={inputRef}
          className="oe-command-palette__input"
          role="combobox"
          aria-expanded="true"
          aria-controls="oe-command-palette-list"
          aria-autocomplete="list"
          placeholder="Type a command…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onOpenChange(false);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, Math.max(items.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              void runActive();
            }
          }}
        />
        <ul id="oe-command-palette-list" className="oe-command-palette__list" role="listbox">
          {items.length === 0 ? (
            <li className="oe-command-palette__group">No matching commands</li>
          ) : (
            items.map((item, index) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <li key={item.id} role="presentation">
                  {showGroup ? (
                    <div className="oe-command-palette__group" role="presentation">
                      {item.group}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="oe-command-palette__item"
                    role="option"
                    aria-selected={index === activeIndex}
                    data-active={index === activeIndex ? "true" : "false"}
                    disabled={Boolean(item.disabledReason)}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      void (async () => {
                        if (item.disabledReason) return;
                        await registry.run(item.id, context);
                        onOpenChange(false);
                      })();
                    }}
                  >
                    <span>
                      {item.title}
                      {item.disabledReason ? ` — ${item.disabledReason}` : ""}
                    </span>
                    {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

export function usePowerCommandPaletteShortcut(
  editor: EditorLike | null | undefined,
  onToggle: () => void
): void {
  useEffect(() => {
    const target = editor?.domElement ?? (typeof window !== "undefined" ? window : null);
    if (!target) return;

    const onKeyDown = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;
      const mod = keyboardEvent.metaKey || keyboardEvent.ctrlKey;
      if (mod && keyboardEvent.key.toLowerCase() === "k") {
        keyboardEvent.preventDefault();
        onToggle();
      }
    };

    target.addEventListener("keydown", onKeyDown);
    return () => target.removeEventListener("keydown", onKeyDown);
  }, [editor, onToggle]);
}

export type PowerSeamsContextValue = PowerSeams;
