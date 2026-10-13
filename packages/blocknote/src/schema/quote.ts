import { createQuoteBlockSpec, defaultProps, parseDefaultProps, type BlockSpec } from "@blocknote/core";

/** Keep the installed native quote implementation, DOM wrapper, shortcuts and
 * input rules. Its default config lacks alignment even though native HTML export
 * already handles defaultProps. Compose the public spec without double-wrapping
 * its already-wrapped render/toExternalHTML implementation in createBlockSpec. */
type AlignedQuoteProps = ReturnType<typeof createQuoteBlockSpec>["config"]["propSchema"] & { textAlignment: typeof defaultProps.textAlignment };
export function createAlignedQuoteBlockSpec(): BlockSpec<"quote", AlignedQuoteProps, "inline"> {
  const upstream = createQuoteBlockSpec();
  const nativeRender = upstream.implementation.render, nativeExport = upstream.implementation.toExternalHTML;
  return {
    ...upstream,
    config: { ...upstream.config, propSchema: { ...upstream.config.propSchema, textAlignment: defaultProps.textAlignment } },
    implementation: {
      ...upstream.implementation,
      // BlockNoteEditor is invariant in its schema type. This public adapter
      // adds a prop but preserves the same editor and native rendering context.
      render(block, editor) { return nativeRender.call(this, block, editor as unknown as Parameters<typeof nativeRender>[1]); },
      toExternalHTML(block, editor, context) { return nativeExport?.call(this, block, editor as unknown as Parameters<NonNullable<typeof nativeExport>>[1], context); },
      parse(element: HTMLElement) {
        const parsed = upstream.implementation.parse?.(element);
        if (parsed === undefined) return undefined;
        return { ...parsed, textAlignment: parseDefaultProps(element).textAlignment ?? "left" };
      },
    },
  };
}
