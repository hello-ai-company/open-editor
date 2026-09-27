import {
  composePowerFeatures,
  type ComposedPowerFeatures,
  type OpenEditorPowerFeature
} from "./types.js";

export type OpenEditorPowerFeatureRegistry = {
  list(): readonly OpenEditorPowerFeature[];
  register(feature: OpenEditorPowerFeature): void;
  unregister(id: string): boolean;
  compose(): ComposedPowerFeatures;
};

/** Instance-scoped registry for optional BlockNote features. */
export function createOpenEditorPowerFeatureRegistry(
  initial: readonly OpenEditorPowerFeature[] = []
): OpenEditorPowerFeatureRegistry {
  const features = new Map<string, OpenEditorPowerFeature>();
  for (const feature of initial) {
    register(feature);
  }

  function register(feature: OpenEditorPowerFeature): void {
    if (features.has(feature.id)) {
      throw new Error(`Duplicate OpenEditor feature id: ${feature.id}`);
    }
    const snapshot = snapshotFeature(feature);
    // Validate the complete candidate set before changing the registry.
    composePowerFeatures([...features.values(), snapshot]);
    features.set(snapshot.id, snapshot);
  }

  return {
    list: () => Object.freeze([...features.values()]),
    register,
    unregister: (id) => features.delete(id),
    compose: () => composePowerFeatures([...features.values()])
  };
}

function snapshotFeature(feature: OpenEditorPowerFeature): OpenEditorPowerFeature {
  const commands = feature.commands?.map((command) =>
    snapshotValue(command)
  ) as OpenEditorPowerFeature["commands"];
  return Object.freeze({
    ...feature,
    blockSpecs: feature.blockSpecs && snapshotValue(feature.blockSpecs),
    inlineContentSpecs: feature.inlineContentSpecs && snapshotValue(feature.inlineContentSpecs),
    styleSpecs: feature.styleSpecs && snapshotValue(feature.styleSpecs),
    commands: commands && Object.freeze(commands),
    extensions: feature.extensions && Object.freeze([...feature.extensions])
  }) as OpenEditorPowerFeature;
}

function snapshotValue<T>(value: T, copies = new WeakMap<object, object>()): T {
  if (!value || typeof value !== "object") return value;
  const source = value as object;
  const prototype = Object.getPrototypeOf(source);
  if (!Array.isArray(source) && prototype !== Object.prototype && prototype !== null) {
    return value;
  }
  const existing = copies.get(source);
  if (existing) return existing as T;
  const copy: object = Array.isArray(source)
    ? []
    : Object.create(prototype);
  copies.set(source, copy);
  if (Array.isArray(source)) {
    const target = copy as unknown[];
    for (const item of source) target.push(snapshotValue(item, copies));
  } else {
    for (const [key, item] of Object.entries(source)) {
      (copy as Record<string, unknown>)[key] = snapshotValue(item, copies);
    }
  }
  return Object.freeze(copy) as T;
}
