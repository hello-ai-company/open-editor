import { createBlockSpec } from "@blocknote/core";
import { ENVELOPE_ENCODING_VERSION, UNKNOWN_ENVELOPE_TYPE } from "../types.js";

export const unknownEnvelopePropSchema = {
  originalType: {
    default: "unknown" as const
  },
  propsJson: {
    default: "" as const
  },
  contentJson: {
    default: "" as const
  },
  encodingVersion: {
    default: ENVELOPE_ENCODING_VERSION
  }
} as const;

/**
 * Catch-all BlockNote block that carries unknown OpenEditor blocks losslessly.
 * Uses core createBlockSpec (no React) so Node adapter tests stay light.
 */
export const createUnknownEnvelopeBlockSpec = createBlockSpec(
  {
    type: UNKNOWN_ENVELOPE_TYPE,
    propSchema: unknownEnvelopePropSchema,
    content: "none" as const
  },
  {
    render() {
      const dom = document.createElement("div");
      dom.className = "oe-unknown-block";
      dom.setAttribute("data-oe-unknown-block", "true");
      dom.setAttribute("role", "note");
      const label = document.createElement("span");
      label.className = "oe-unknown-block__label";
      label.textContent = "Unsupported block";
      dom.appendChild(label);
      return { dom };
    },
    toExternalHTML(block) {
      const dom = document.createElement("div");
      dom.setAttribute("data-oe-unknown-block", block.props.originalType);
      dom.textContent = `Unsupported block: ${block.props.originalType}`;
      return { dom };
    }
  }
);
