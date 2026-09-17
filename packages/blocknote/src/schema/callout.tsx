import { createReactBlockSpec } from "@blocknote/react";
import type { ReactElement } from "react";

export const calloutVariants = ["info", "warning", "success", "danger"] as const;
export type CalloutVariant = (typeof calloutVariants)[number];

const variantLabels: Record<CalloutVariant, string> = {
  info: "Information callout",
  warning: "Warning callout",
  success: "Success callout",
  danger: "Danger callout"
};

export const createCalloutBlockSpec = createReactBlockSpec(
  {
    type: "callout" as const,
    propSchema: {
      variant: {
        default: "info" as const,
        values: [...calloutVariants]
      },
      title: {
        default: "" as const
      }
    },
    content: "inline" as const
  },
  {
    render: (props): ReactElement => {
      const variant = props.block.props.variant as CalloutVariant;
      const title = props.block.props.title;
      return (
        <aside
          className={`oe-callout oe-callout--${variant}`}
          data-oe-callout={variant}
          role="note"
          aria-label={variantLabels[variant] ?? "Callout"}
        >
          {title ? <div className="oe-callout__title">{title}</div> : null}
          <div className="oe-callout__body" ref={props.contentRef} />
        </aside>
      );
    }
  }
);
