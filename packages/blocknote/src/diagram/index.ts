/**
 * Optional Diagram feature — import from `@hello-ai-company/editor-blocknote/diagram`.
 * Peer: `@blocknote/diagram-block` (MPL-2.0). XL exporters unused.
 */
import { createReactDiagramBlockSpec } from "@blocknote/diagram-block";
import type { OpenEditorPowerFeature } from "../features/types.js";
import type { EditorCommand } from "../commands/registry.js";

function diagramCommands(): EditorCommand[] {
  return [
    {
      id: "block.insert.diagram",
      title: "Diagram",
      subtitle: "Mermaid diagram",
      group: "advanced",
      aliases: ["mermaid", "flowchart", "graph"],
      keywords: ["diagram", "chart"],
      surfaces: ["slash", "palette"],
      run: (ctx) => {
        const cursor = ctx.editor.getTextCursorPosition();
        ctx.editor.transact(() => {
          ctx.editor.insertBlocks([{ type: "diagram" }], cursor.block, "after");
        });
      }
    }
  ];
}

export function createDiagramPowerFeature(): OpenEditorPowerFeature<
  { diagram: ReturnType<typeof createReactDiagramBlockSpec> }
> {
  return {
    id: "diagram",
    blockSpecs: {
      diagram: createReactDiagramBlockSpec()
    },
    commands: diagramCommands()
  };
}

export { createReactDiagramBlockSpec };
