import type { OpenEditorPowerFeatureRegistry } from "./registry.js";

/** JSON only, no React components, extension functions, secrets or live editor state. */
export function describeOpenEditorAgentSchema(schema: { blockSchema: object; inlineContentSchema: object; styleSchema: object }, registry?: OpenEditorPowerFeatureRegistry) {
  const features = registry?.compose();
  return {
    featureIds: features?.featureIds ?? [],
    blockTypes: Object.keys(schema.blockSchema).sort(),
    inlineTypes: Object.keys(schema.inlineContentSchema).sort(),
    styleTypes: Object.keys(schema.styleSchema).sort(),
    commandIds: (features?.commands.map(c => c.id) ?? []).sort()
  };
}
