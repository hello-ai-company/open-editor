import type { BlockSpecs, InlineContentSpec, InlineContentConfig, StyleSpecs } from "@blocknote/core";
import type { EditorCommand } from "../commands/registry.js";
import type { AdditionalInlineContentSpecs } from "../schema/createOpenEditorBlockNoteSchema.js";

/**
 * Thin optional-feature descriptor. Keep simple — not a plugin framework.
 */
export type OpenEditorPowerFeature = {
  id: string;
  blockSpecs?: BlockSpecs;
  inlineContentSpecs?: AdditionalInlineContentSpecs;
  styleSpecs?: StyleSpecs;
  commands?: EditorCommand[];
  /** BlockNote editor extensions (e.g. syntax highlighter). */
  extensions?: unknown[];
};

export type ComposedPowerFeatures = {
  blockSpecs: BlockSpecs;
  inlineContentSpecs: AdditionalInlineContentSpecs;
  styleSpecs: StyleSpecs;
  commands: EditorCommand[];
  extensions: unknown[];
  featureIds: string[];
};

export function composePowerFeatures(
  features: readonly OpenEditorPowerFeature[]
): ComposedPowerFeatures {
  const blockSpecs: BlockSpecs = {};
  const inlineContentSpecs: AdditionalInlineContentSpecs = {};
  const styleSpecs: StyleSpecs = {};
  const commands: EditorCommand[] = [];
  const extensions: unknown[] = [];
  const featureIds: string[] = [];

  for (const feature of features) {
    featureIds.push(feature.id);
    if (feature.blockSpecs) Object.assign(blockSpecs, feature.blockSpecs);
    if (feature.inlineContentSpecs) {
      Object.assign(inlineContentSpecs, feature.inlineContentSpecs);
    }
    if (feature.styleSpecs) Object.assign(styleSpecs, feature.styleSpecs);
    if (feature.commands) commands.push(...feature.commands);
    if (feature.extensions) extensions.push(...feature.extensions);
  }

  return {
    blockSpecs,
    inlineContentSpecs,
    styleSpecs,
    commands,
    extensions,
    featureIds
  };
}

/** Type helper — unused at runtime; documents inline content feature shape. */
export type FeatureInlineSpec = InlineContentSpec<InlineContentConfig>;
