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
 * Document-local block reference as custom inline content.
 * Trigger UX is command/palette-driven (not [[ or @) to avoid conflicts.
 */
export function createBlockReferenceInlineContentSpec(): InlineContentSpec<{
  type: typeof BLOCK_REFERENCE_TYPE;
  propSchema: {
    blockId: { default: string };
  };
  content: "none";
}> {
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
        const span = document.createElement("span");
        span.className = "oe-block-reference";
        span.dataset.blockId = inlineContent.props.blockId;
        span.setAttribute("contenteditable", "false");
        span.textContent = `→ ${inlineContent.props.blockId || "…"}`;
        return { dom: span };
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
