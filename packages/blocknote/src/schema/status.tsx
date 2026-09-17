import { createReactBlockSpec } from "@blocknote/react";
import type { ReactElement } from "react";

export const statusStates = ["todo", "doing", "done", "blocked"] as const;
export type StatusState = (typeof statusStates)[number];

const stateLabels: Record<StatusState, string> = {
  todo: "To do",
  doing: "Doing",
  done: "Done",
  blocked: "Blocked"
};

function nextState(current: StatusState): StatusState {
  const index = statusStates.indexOf(current);
  return statusStates[(index + 1) % statusStates.length] ?? "todo";
}

export const createStatusBlockSpec = createReactBlockSpec(
  {
    type: "status" as const,
    propSchema: {
      state: {
        default: "todo" as const,
        values: [...statusStates]
      },
      label: {
        default: "" as const
      }
    },
    content: "none" as const
  },
  {
    render: (props): ReactElement => {
      const state = props.block.props.state as StatusState;
      const label = props.block.props.label || stateLabels[state];
      const editable = props.editor.isEditable;

      return (
        <button
          type="button"
          className={`oe-status oe-status--${state}`}
          data-oe-status={state}
          role="status"
          aria-label={`Status: ${label}`}
          disabled={!editable}
          onClick={() => {
            if (!editable) return;
            props.editor.updateBlock(props.block, {
              type: "status",
              props: { state: nextState(state) }
            });
          }}
        >
          <span className="oe-status__label">{label}</span>
        </button>
      );
    }
  }
);
