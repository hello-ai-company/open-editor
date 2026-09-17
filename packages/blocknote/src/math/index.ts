/**
 * Optional Math feature — import from `@hello-ai-company/editor-blocknote/math`.
 * Peer: `@blocknote/math-block` (MPL-2.0). XL exporter peers remain optional/unused.
 */
import {
  createReactMathBlockSpec,
  createReactInlineMathSpec
} from "@blocknote/math-block";
import type { OpenEditorPowerFeature } from "../features/types.js";
import type { EditorCommand } from "../commands/registry.js";

function mathCommands(): EditorCommand[] {
  return [
    {
      id: "block.insert.math",
      title: "Math block",
      subtitle: "LaTeX display math",
      group: "advanced",
      aliases: ["latex", "equation", "formula"],
      keywords: ["math", "tex", "katex"],
      surfaces: ["slash", "palette"],
      run: (ctx) => {
        const cursor = ctx.editor.getTextCursorPosition();
        ctx.editor.transact(() => {
          ctx.editor.insertBlocks([{ type: "mathBlock" }], cursor.block, "after");
        });
      }
    },
    {
      id: "inline.insert.math",
      title: "Inline math",
      group: "advanced",
      aliases: ["inline latex"],
      keywords: ["math", "inline"],
      surfaces: ["palette"],
      run: (ctx) => {
        const cursor = ctx.editor.getTextCursorPosition();
        ctx.editor.transact(() => {
          ctx.editor.insertBlocks(
            [
              {
                type: "paragraph",
                content: [{ type: "math", content: "E=mc^2" }]
              }
            ],
            cursor.block,
            "after"
          );
        });
      }
    }
  ];
}

export function createMathPowerFeature(): OpenEditorPowerFeature {
  return {
    id: "math",
    blockSpecs: {
      mathBlock: createReactMathBlockSpec()
    },
    inlineContentSpecs: {
      math: createReactInlineMathSpec()
    },
    commands: mathCommands()
  };
}

export { createReactMathBlockSpec, createReactInlineMathSpec };
