import { useMemo, type ReactElement } from "react";
import type {
  CommandRegistry,
  EditorCommandContext
} from "../commands/registry.js";
import {
  createOpenEditorDictionary,
  type OpenEditorDictionary
} from "../dictionary.js";

export type BlockActionMenuProps = {
  registry: CommandRegistry;
  context: EditorCommandContext;
  dictionary?: Partial<OpenEditorDictionary>;
  onRan?: () => void;
};

const ACTION_IDS = [
  "block.duplicate",
  "block.delete",
  "block.move-up",
  "block.move-down",
  "block.copy-id",
  "block.copy-reference"
] as const;

/**
 * Compact block action list using the shared command registry.
 * Wire into BlockNote SideMenu / DragHandle custom items as needed.
 */
export function BlockActionMenu(props: BlockActionMenuProps): ReactElement {
  const dict = createOpenEditorDictionary(props.dictionary);
  const labels: Record<string, string> = {
    "block.duplicate": dict.duplicateBlock,
    "block.delete": dict.deleteBlock,
    "block.move-up": dict.moveBlockUp,
    "block.move-down": dict.moveBlockDown,
    "block.copy-id": dict.copyBlockId,
    "block.copy-reference": dict.copyBlockReference
  };

  const items = useMemo(() => {
    return ACTION_IDS.map((id) => props.registry.get(id)).filter(Boolean);
  }, [props.registry]);

  return (
    <div className="oe-block-actions" role="menu" aria-label="Block actions">
      {items.map((command) => {
        if (!command) return null;
        const enabled = command.isEnabled?.(props.context) ?? true;
        const disabledReason =
          enabled === true
            ? undefined
            : typeof enabled === "object"
              ? enabled.reason
              : "Unavailable";
        return (
          <button
            key={command.id}
            type="button"
            role="menuitem"
            className="oe-block-actions__item"
            disabled={Boolean(disabledReason)}
            title={disabledReason}
            onClick={() => {
              void (async () => {
                if (disabledReason) return;
                await props.registry.run(command.id, props.context);
                props.onRan?.();
              })();
            }}
          >
            {labels[command.id] ?? command.title}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Recommended formatting controls for the power preset.
 * Hosts compose these with BlockNote FormattingToolbar controllers.
 */
export const POWER_FORMATTING_ACTIONS = [
  "blockTypeSelect",
  "bold",
  "italic",
  "underline",
  "strike",
  "inlineCode",
  "link",
  "textColor",
  "backgroundColor"
] as const;

export type PowerFormattingAction = (typeof POWER_FORMATTING_ACTIONS)[number];
