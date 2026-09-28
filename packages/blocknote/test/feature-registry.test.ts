import { describe, expect, it } from "vitest";
import {
  composePowerFeatures,
  type OpenEditorPowerFeature
} from "../src/features/types.js";
import { createOpenEditorPowerFeatureRegistry } from "../src/features/registry.js";
import { createOpenEditorPowerPreset } from "../src/features/compose.js";
import { createBlockReferenceInlineContentSpec } from "../src/references/blockReference.js";

function feature(
  id: string,
  specs: Pick<OpenEditorPowerFeature, "blockSpecs" | "inlineContentSpecs" | "styleSpecs" | "commands"> = {}
): OpenEditorPowerFeature {
  return { id, ...specs };
}

describe("OpenEditor power feature registry", () => {
  it("registers, composes, and unregisters features by id", () => {
    const registry = createOpenEditorPowerFeatureRegistry([feature("first")]);
    registry.register(feature("second"));

    expect(registry.list().map(({ id }) => id)).toEqual(["first", "second"]);
    expect(registry.compose().featureIds).toEqual(["first", "second"]);
    expect(registry.unregister("first")).toBe(true);
    expect(registry.unregister("missing")).toBe(false);
    expect(registry.compose().featureIds).toEqual(["second"]);
  });

  it("rejects duplicate ids without partially registering", () => {
    const registry = createOpenEditorPowerFeatureRegistry([feature("feature")]);
    expect(() => registry.register(feature("feature"))).toThrow(/Duplicate OpenEditor feature id/);
    expect(registry.list()).toHaveLength(1);
  });

  it("snapshots registered descriptors and returns immutable lists", () => {
    const blockSpecs = { custom: { config: { propSchema: { title: "string" } } } };
    const descriptor = feature("stable", { blockSpecs } as never);
    const registry = createOpenEditorPowerFeatureRegistry([descriptor]);

    (descriptor as { id: string }).id = "mutated";
    (blockSpecs as Record<string, unknown>).later = {};

    expect(registry.list().map(({ id }) => id)).toEqual(["stable"]);
    expect(Object.keys(registry.compose().blockSpecs)).toEqual(["custom"]);
    expect(() => {
      (registry.list() as OpenEditorPowerFeature[]).push(feature("extra"));
    }).toThrow();
    expect(() => {
      (registry.list()[0] as { id: string }).id = "mutated-again";
    }).toThrow();
  });

  it.each([
    ["blockSpecs", "shared-block"],
    ["inlineContentSpecs", "shared-inline"],
    ["styleSpecs", "shared-style"]
  ] as const)("rejects colliding %s keys", (kind, key) => {
    const first = feature("first", { [kind]: { [key]: {} } } as never);
    const second = feature("second", { [kind]: { [key]: {} } } as never);
    const registry = createOpenEditorPowerFeatureRegistry([first]);

    expect(() => registry.register(second)).toThrow(/schema conflict/);
    expect(registry.list()).toHaveLength(1);
  });

  it("rejects command collisions during composition", () => {
    const command = { id: "duplicate", title: "Example", group: "basic", surfaces: ["slash"], run: () => {} } as never;
    expect(() => composePowerFeatures([
      feature("first", { commands: [command] }),
      feature("second", { commands: [command] })
    ])).toThrow(/Duplicate OpenEditor command id/);
  });

  it("rejects feature schema keys reserved by BlockNote or OpenEditor", () => {
    expect(() => createOpenEditorPowerPreset({
      features: [feature("override-paragraph", { blockSpecs: { paragraph: {} } })] as never
    })).toThrow(/block schema conflict.*paragraph/);
  });

  it("allows a host blockReference spec when OpenEditor references are disabled", () => {
    expect(() => createOpenEditorPowerPreset({
      includeBlockReference: false,
      schema: { inlineContentSpecs: { blockReference: createBlockReferenceInlineContentSpec() } }
    })).not.toThrow();
  });
});
