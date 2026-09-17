/**
 * Optional Code highlighting feature — import from `@hello-ai-company/editor-blocknote/code`.
 * Peer: `@blocknote/code-block` (MPL-2.0). Uses bundled Shiki langs/themes.
 */
import { syntaxHighlighter, codeBlockOptions } from "@blocknote/code-block";
import type { OpenEditorPowerFeature } from "../features/types.js";
import type { EditorCommand } from "../commands/registry.js";

function codeCommands(): EditorCommand[] {
  return [
    {
      id: "block.insert.code.highlighted",
      title: "Code block (highlighted)",
      subtitle: "Syntax-highlighted code",
      group: "advanced",
      aliases: ["shiki", "highlight"],
      keywords: ["code", "syntax", "language"],
      surfaces: ["slash", "palette"],
      run: (ctx) => {
        const cursor = ctx.editor.getTextCursorPosition();
        ctx.editor.transact(() => {
          ctx.editor.insertBlocks(
            [
              {
                type: "codeBlock",
                props: { language: codeBlockOptions.defaultLanguage }
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

export function createCodePowerFeature(): OpenEditorPowerFeature {
  return {
    id: "code",
    extensions: [syntaxHighlighter],
    commands: codeCommands()
  };
}

export { syntaxHighlighter, codeBlockOptions };
