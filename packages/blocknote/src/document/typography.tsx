import { createStyleSpec } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import type { EditorCommand } from "../commands/registry.js";

const families: Record<string, string> = { sans: "system-ui, sans-serif", serif: "Georgia, serif", mono: "ui-monospace, monospace" };
const sizes: Record<string, string> = { small: "0.85em", large: "1.2em" };
function style(type: "fontFamily" | "fontSize", values: Record<string, string>) {
  return createStyleSpec({ type, propSchema: "string" }, {
    render: value => {
      const dom = document.createElement("span");
      // Unknown values stay in model/HTML data but cannot inject arbitrary CSS.
      dom.dataset[type] = value;
      if (Object.hasOwn(values, value)) dom.style[type] = values[value]!;
      return { dom, contentDOM: dom };
    },
    parse: element => element.dataset[type]
  });
}
export const createDocumentPageBreakBlockSpec = createReactBlockSpec({ type: "oePageBreak", propSchema: {}, content: "none" }, {
  render: () => <div className="oe-document-page-break" contentEditable={false} role="separator" aria-label="Print page break"><span>Page break</span></div>,
  toExternalHTML: () => <div style={{ breakAfter: "page", pageBreakAfter: "always" }} />
});

/** Optional, safe value sets. Unknown persisted values are inert and remain recoverable. */
export function createDocumentTypographyFeature() {
  const commands: EditorCommand[] = [];
  for (const [type, values] of Object.entries({ fontFamily: families, fontSize: sizes })) for (const value of Object.keys(values)) {
    commands.push({ id: `document-style-${type}-${value}`, title: `${type === "fontFamily" ? "Font" : "Text size"}: ${value}`, group: "document", surfaces: ["palette", "toolbar"],
      isEnabled: ({ editor }) => Boolean((editor as unknown as { addStyles?: unknown }).addStyles),
      run: ({ editor }) => (editor as unknown as { addStyles(styles: Record<string, string>): void }).addStyles({ [type]: value })
    });
  }
  commands.push({ id: "document-page-break", title: "Page break", group: "document", surfaces: ["slash", "palette"], run: ({ editor }) => { editor.insertBlocks([{ type: "oePageBreak" }], editor.getTextCursorPosition().block, "after"); } });
  return { id: "document-typography", blockSpecs: { oePageBreak: createDocumentPageBreakBlockSpec() }, styleSpecs: { fontFamily: style("fontFamily", families), fontSize: style("fontSize", sizes) }, commands };
}
