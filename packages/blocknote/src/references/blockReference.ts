import {
  createInlineContentSpec,
  type InlineContentSpec
} from "@blocknote/core";

export const BLOCK_REFERENCE_TYPE = "blockReference" as const;

export type BlockReferenceProps = {
  blockId: string;
};

export type BlockReferenceResolver = (blockId: string) => {
  title: string;
  missing?: boolean;
} | null;

/**
 * Mutable runtime bag so React hosts can update resolve/navigate without
 * rebuilding the schema when the DocumentIndex changes.
 *
 * Pass `subscribe` (e.g. DocumentIndex.subscribe) so existing reference DOM
 * re-evaluates labels when targets are renamed or deleted.
 */
export type BlockReferenceRuntime = {
  resolve?: BlockReferenceResolver;
  onNavigate?: (blockId: string) => void;
  missingLabel?: string;
  untitledLabel?: string;
  /** Invalidate / re-resolve labels (DocumentIndex revision bumps). */
  subscribe?: (listener: () => void) => () => void;
};

export type BlockReferenceSpecOptions = {
  /** Static resolver (also usable via `runtime`). */
  resolve?: BlockReferenceResolver;
  onNavigate?: (blockId: string) => void;
  missingLabel?: string;
  untitledLabel?: string;
  subscribe?: (listener: () => void) => () => void;
  /** Shared mutable bag — preferred for live DocumentIndex wiring. */
  runtime?: BlockReferenceRuntime;
};

const cleanupByDom = new WeakMap<HTMLElement, () => void>();

/**
 * Apply the current resolved label onto an existing reference DOM node.
 * Safe to call repeatedly when DocumentIndex revision bumps.
 */
export function applyBlockReferenceLabel(
  span: HTMLSpanElement,
  blockId: string,
  runtime: BlockReferenceRuntime
): void {
  const { label, missing } = formatBlockReferenceLabel(
    blockId,
    runtime.resolve,
    runtime.missingLabel ?? "Missing block",
    runtime.untitledLabel ?? "Untitled"
  );

  span.dataset.blockId = blockId;
  span.dataset.missing = missing ? "true" : "false";
  span.setAttribute("role", missing ? "note" : "link");
  span.title = missing ? (runtime.missingLabel ?? "Missing block") : label;
  span.textContent = `→ ${label}`;
}

export function createBlockReferenceDom(
  blockId: string,
  runtime: BlockReferenceRuntime
): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "oe-block-reference";
  span.setAttribute("contenteditable", "false");
  span.tabIndex = 0;

  applyBlockReferenceLabel(span, blockId, runtime);

  const activate = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    if (span.dataset.missing === "true" || !blockId) return;
    runtime.onNavigate?.(blockId);
  };

  span.addEventListener("click", activate);
  span.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      activate(event);
    }
  });

  if (runtime.subscribe) {
    const unsubscribe = runtime.subscribe(() => {
      applyBlockReferenceLabel(span, blockId, runtime);
    });
    cleanupByDom.set(span, unsubscribe);
  }

  return span;
}

function destroyBlockReferenceDom(dom: HTMLElement): void {
  const cleanup = cleanupByDom.get(dom);
  if (cleanup) {
    cleanup();
    cleanupByDom.delete(dom);
  }
}

/**
 * Document-local block reference as custom inline content.
 * Trigger UX is command/palette-driven (not [[ or @) to avoid conflicts.
 *
 * Labels live-update when `runtime.subscribe` fires (typically DocumentIndex).
 */
export function createBlockReferenceInlineContentSpec(
  options?: BlockReferenceSpecOptions
): InlineContentSpec<{
  type: typeof BLOCK_REFERENCE_TYPE;
  propSchema: {
    blockId: { default: string };
  };
  content: "none";
}> {
  const runtime: BlockReferenceRuntime = options?.runtime ?? {
    resolve: options?.resolve,
    onNavigate: options?.onNavigate,
    missingLabel: options?.missingLabel,
    untitledLabel: options?.untitledLabel,
    subscribe: options?.subscribe
  };

  if (options?.resolve) runtime.resolve = options.resolve;
  if (options?.onNavigate) runtime.onNavigate = options.onNavigate;
  if (options?.missingLabel) runtime.missingLabel = options.missingLabel;
  if (options?.untitledLabel) runtime.untitledLabel = options.untitledLabel;
  if (options?.subscribe) runtime.subscribe = options.subscribe;

  return createInlineContentSpec(
    {
      type: BLOCK_REFERENCE_TYPE,
      propSchema: {
        blockId: { default: "" }
      },
      content: "none"
    },
    {
      render(inlineContent) {
        const dom = createBlockReferenceDom(
          inlineContent.props.blockId,
          runtime
        );
        return {
          dom,
          destroy: () => destroyBlockReferenceDom(dom)
        };
      },
      parse(element) {
        if (
          element.tagName === "SPAN" &&
          element.classList.contains("oe-block-reference")
        ) {
          return {
            blockId: element.getAttribute("data-block-id") ?? ""
          };
        }
        return undefined;
      }
    }
  );
}

export function formatBlockReferenceLabel(
  blockId: string,
  resolver?: BlockReferenceResolver,
  missingLabel = "Missing block",
  untitledLabel = "Untitled"
): { label: string; missing: boolean } {
  if (!blockId) {
    return { label: missingLabel, missing: true };
  }
  const resolved = resolver?.(blockId);
  if (!resolved) {
    return { label: missingLabel, missing: true };
  }
  if (resolved.missing) {
    return { label: missingLabel, missing: true };
  }
  const title = resolved.title.trim() || untitledLabel;
  return { label: title, missing: false };
}

export function createBlockReferenceResolverFromIndex(
  index: {
    getById: (blockId: string) => { text: string } | undefined;
  }
): BlockReferenceResolver {
  return (blockId) => {
    const entry = index.getById(blockId);
    if (!entry) return { title: "", missing: true };
    return { title: entry.text };
  };
}

/**
 * Wire resolve + subscribe onto a mutable runtime from a DocumentIndex.
 * Call once at host setup; keep the same runtime on the schema for live labels.
 */
export function bindBlockReferenceRuntimeToIndex(
  runtime: BlockReferenceRuntime,
  index: {
    getById: (blockId: string) => { text: string } | undefined;
    subscribe: (listener: () => void) => () => void;
  }
): void {
  runtime.resolve = createBlockReferenceResolverFromIndex(index);
  runtime.subscribe = (listener) => index.subscribe(listener);
}
