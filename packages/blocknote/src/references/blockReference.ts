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
 */
export type BlockReferenceRuntime = {
  resolve?: BlockReferenceResolver;
  onNavigate?: (blockId: string) => void;
  missingLabel?: string;
  untitledLabel?: string;
};

export type BlockReferenceSpecOptions = {
  /** Static resolver (also usable via `runtime`). */
  resolve?: BlockReferenceResolver;
  onNavigate?: (blockId: string) => void;
  missingLabel?: string;
  untitledLabel?: string;
  /** Shared mutable bag — preferred for live DocumentIndex wiring. */
  runtime?: BlockReferenceRuntime;
};

export function createBlockReferenceDom(
  blockId: string,
  runtime: BlockReferenceRuntime
): HTMLSpanElement {
  const { label, missing } = formatBlockReferenceLabel(
    blockId,
    runtime.resolve,
    runtime.missingLabel ?? "Missing block",
    runtime.untitledLabel ?? "Untitled"
  );

  const span = document.createElement("span");
  span.className = "oe-block-reference";
  span.dataset.blockId = blockId;
  span.dataset.missing = missing ? "true" : "false";
  span.setAttribute("contenteditable", "false");
  span.setAttribute("role", missing ? "note" : "link");
  span.tabIndex = 0;
  span.title = missing ? (runtime.missingLabel ?? "Missing block") : label;
  span.textContent = `→ ${label}`;

  const activate = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    if (missing || !blockId) return;
    runtime.onNavigate?.(blockId);
  };

  span.addEventListener("click", activate);
  span.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      activate(event);
    }
  });

  return span;
}

/**
 * Document-local block reference as custom inline content.
 * Trigger UX is command/palette-driven (not [[ or @) to avoid conflicts.
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
    untitledLabel: options?.untitledLabel
  };

  if (options?.resolve) runtime.resolve = options.resolve;
  if (options?.onNavigate) runtime.onNavigate = options.onNavigate;
  if (options?.missingLabel) runtime.missingLabel = options.missingLabel;
  if (options?.untitledLabel) runtime.untitledLabel = options.untitledLabel;

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
        return {
          dom: createBlockReferenceDom(inlineContent.props.blockId, runtime)
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
