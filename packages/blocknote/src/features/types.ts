import type {
  BlockSpecs,
  ExtensionFactoryInstance,
  InlineContentConfig,
  InlineContentSpec,
  StyleSpecs
} from "@blocknote/core";
import type { EditorCommand } from "../commands/registry.js";
import type { AdditionalInlineContentSpecs } from "../schema/createOpenEditorBlockNoteSchema.js";

/**
 * Thin optional-feature descriptor. Keep simple — not a plugin framework.
 * Generics preserve block/inline/style keys for preset schema inference.
 */
export type OpenEditorPowerFeature<
  // IMPORTANT: default must NOT be Record<string, never> — intersecting that
  // index signature collapses concrete feature keys to `never`.
  BSpecs extends BlockSpecs = {},
  ISpecs extends AdditionalInlineContentSpecs = {},
  SSpecs extends StyleSpecs = {}
> = {
  id: string;
  blockSpecs?: BSpecs;
  inlineContentSpecs?: ISpecs;
  styleSpecs?: SSpecs;
  commands?: EditorCommand[];
  /** BlockNote editor extensions (e.g. syntax highlighter). */
  extensions?: ExtensionFactoryInstance[];
};

export type ComposedPowerFeatures<
  BSpecs extends BlockSpecs = BlockSpecs,
  ISpecs extends AdditionalInlineContentSpecs = AdditionalInlineContentSpecs,
  SSpecs extends StyleSpecs = StyleSpecs
> = {
  blockSpecs: BSpecs;
  inlineContentSpecs: ISpecs;
  styleSpecs: SSpecs;
  commands: EditorCommand[];
  extensions: ExtensionFactoryInstance[];
  featureIds: string[];
};

type FeatureBlockSpecs<F> = F extends OpenEditorPowerFeature<infer B, any, any>
  ? B
  : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    {};
type FeatureInlineSpecs<F> = F extends OpenEditorPowerFeature<any, infer I, any>
  ? I
  : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    {};
type FeatureStyleSpecs<F> = F extends OpenEditorPowerFeature<any, any, infer S>
  ? S
  : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    {};

/**
 * Merge a const features tuple into combined BlockSpecs / Inline / Style maps.
 * Important: do NOT intersect with `Record<string, never>` — that index signature
 * collapses concrete keys to `never`.
 */
export type MergeFeatureBlockSpecs<Features extends readonly unknown[]> =
  Features extends readonly [infer Head, ...infer Tail]
    ? Tail extends readonly []
      ? FeatureBlockSpecs<Head>
      : FeatureBlockSpecs<Head> & MergeFeatureBlockSpecs<Tail>
    : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      {};

export type MergeFeatureInlineSpecs<Features extends readonly unknown[]> =
  Features extends readonly [infer Head, ...infer Tail]
    ? Tail extends readonly []
      ? FeatureInlineSpecs<Head>
      : FeatureInlineSpecs<Head> & MergeFeatureInlineSpecs<Tail>
    : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      {};

export type MergeFeatureStyleSpecs<Features extends readonly unknown[]> =
  Features extends readonly [infer Head, ...infer Tail]
    ? Tail extends readonly []
      ? FeatureStyleSpecs<Head>
      : FeatureStyleSpecs<Head> & MergeFeatureStyleSpecs<Tail>
    : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      {};

export function composePowerFeatures<
  const Features extends readonly OpenEditorPowerFeature<any, any, any>[]
>(
  features: Features
): ComposedPowerFeatures<
  MergeFeatureBlockSpecs<Features>,
  MergeFeatureInlineSpecs<Features>,
  MergeFeatureStyleSpecs<Features>
> {
  const blockSpecs = {} as MergeFeatureBlockSpecs<Features>;
  const inlineContentSpecs = {} as MergeFeatureInlineSpecs<Features>;
  const styleSpecs = {} as MergeFeatureStyleSpecs<Features>;
  const commands: EditorCommand[] = [];
  const extensions: ExtensionFactoryInstance[] = [];
  const featureIds: string[] = [];
  const blockKeys = new Map<string, string>();
  const inlineKeys = new Map<string, string>();
  const styleKeys = new Map<string, string>();
  const commandIds = new Map<string, string>();
  const featureIdSet = new Set<string>();

  for (const feature of features) {
    assertUnique(featureIdSet, feature.id, "feature id");
    featureIdSet.add(feature.id);
    assertKeysAvailable(blockKeys, feature.blockSpecs, feature.id, "block");
    assertKeysAvailable(inlineKeys, feature.inlineContentSpecs, feature.id, "inline content");
    assertKeysAvailable(styleKeys, feature.styleSpecs, feature.id, "style");
    for (const command of feature.commands ?? []) {
      assertUnique(commandIds, command.id, `command id in feature ${feature.id}`);
      commandIds.set(command.id, feature.id);
    }
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

function assertUnique<T>(seen: Map<string, T> | Set<string>, key: string, kind: string): void {
  if (!key.trim()) throw new Error(`OpenEditor ${kind} must not be empty`);
  if (seen.has(key)) throw new Error(`Duplicate OpenEditor ${kind}: ${key}`);
}

function assertKeysAvailable(
  seen: Map<string, string>,
  specs: object | undefined,
  featureId: string,
  kind: string
): void {
  for (const key of Object.keys(specs ?? {})) {
    const previous = seen.get(key);
    if (previous) {
      throw new Error(`OpenEditor ${kind} schema conflict for "${key}" between "${previous}" and "${featureId}"`);
    }
    seen.set(key, featureId);
  }
}

/** Type helper — unused at runtime; documents inline content feature shape. */
export type FeatureInlineSpec = InlineContentSpec<InlineContentConfig>;
