import type { BlockSpecs, StyleSpecs } from "@blocknote/core";
import {
  createPowerEditorOptions,
  createPowerSchemaWithExtras,
  type AdditionalInlineContentSpecs,
  type CreateOpenEditorBlockNoteSchemaOptions,
  type PowerEditorOptions
} from "../schema/createOpenEditorBlockNoteSchema.js";
import {
  createBlockActionCommands,
  createCommandRegistry,
  createDefaultPowerCommands,
  type CommandRegistry,
  type EditorCommand
} from "../commands/registry.js";
import {
  createBlockReferenceInlineContentSpec,
  type BlockReferenceRuntime,
  type BlockReferenceSpecOptions
} from "../references/blockReference.js";
import {
  composePowerFeatures,
  type MergeFeatureBlockSpecs,
  type MergeFeatureInlineSpecs,
  type MergeFeatureStyleSpecs,
  type OpenEditorPowerFeature
} from "./types.js";

type RefInline = {
  blockReference: ReturnType<typeof createBlockReferenceInlineContentSpec>;
};

/**
 * Reference inline specs only when `includeBlockReference` is not `false`.
 * Keeps TypeScript schema aligned with runtime (4F-2 R2).
 */
export type ReferenceSpecs<IncludeRef extends boolean> =
  IncludeRef extends false ? {} : RefInline;

export type OpenEditorPowerPresetOptions<
  Features extends readonly OpenEditorPowerFeature<any, any, any>[] =
    readonly OpenEditorPowerFeature[],
  // IMPORTANT: default must NOT be Record<string, never> — intersecting that
  // index signature collapses concrete feature keys to `never`.
  HostB extends BlockSpecs = {},
  HostI extends AdditionalInlineContentSpecs = {},
  HostS extends StyleSpecs = {},
  IncludeRef extends boolean = true
> = {
  features?: Features;
  /**
   * Extra host schema specs composed after features.
   * Preset uses createPowerSchemaWithExtras for precise inference (power + unknown).
   */
  schema?: Pick<
    CreateOpenEditorBlockNoteSchemaOptions<HostB, HostI, HostS>,
    "blockSpecs" | "inlineContentSpecs" | "styleSpecs"
  >;
  commands?: EditorCommand[];
  includeBlockActions?: boolean;
  includeBlockReference?: IncludeRef;
  blockReference?: BlockReferenceSpecOptions;
  blockReferenceRuntime?: BlockReferenceRuntime;
  editor?: PowerEditorOptions;
};

export type OpenEditorPowerPreset<Schema = unknown> = {
  schema: Schema;
  registry: CommandRegistry;
  extensions: import("@blocknote/core").ExtensionFactoryInstance[];
  featureIds: string[];
  blockReferenceRuntime: BlockReferenceRuntime;
  editorOptions: (
    overrides?: PowerEditorOptions
  ) => ReturnType<typeof createPowerEditorOptions>;
};

/**
 * Ergonomic composition of power schema + optional features + commands.
 * Uses createPowerSchemaWithExtras (non-overloaded) so schema.Block stays precise.
 */
export function createOpenEditorPowerPreset<
  const Features extends readonly OpenEditorPowerFeature<any, any, any>[] = [],
  HostB extends BlockSpecs = {},
  HostI extends AdditionalInlineContentSpecs = {},
  HostS extends StyleSpecs = {},
  const IncludeRef extends boolean = true
>(
  options?: OpenEditorPowerPresetOptions<
    Features,
    HostB,
    HostI,
    HostS,
    IncludeRef
  >
) {
  type MergedB = MergeFeatureBlockSpecs<Features> & HostB;
  type MergedI = MergeFeatureInlineSpecs<Features> &
    HostI &
    ReferenceSpecs<IncludeRef>;
  type MergedS = MergeFeatureStyleSpecs<Features> & HostS;

  const composed = composePowerFeatures(
    (options?.features ?? []) as Features
  );
  const includeRef = (options?.includeBlockReference ?? true) as IncludeRef;
  const includeActions = options?.includeBlockActions ?? true;

  const blockReferenceRuntime: BlockReferenceRuntime =
    options?.blockReferenceRuntime ?? options?.blockReference?.runtime ?? {};

  if (options?.blockReference) {
    const br = options.blockReference;
    if (br.resolve) blockReferenceRuntime.resolve = br.resolve;
    if (br.onNavigate) blockReferenceRuntime.onNavigate = br.onNavigate;
    if (br.missingLabel) blockReferenceRuntime.missingLabel = br.missingLabel;
    if (br.untitledLabel) blockReferenceRuntime.untitledLabel = br.untitledLabel;
    if (br.subscribe) blockReferenceRuntime.subscribe = br.subscribe;
  }

  const refSpec = (
    includeRef
      ? {
          blockReference: createBlockReferenceInlineContentSpec({
            ...options?.blockReference,
            runtime: blockReferenceRuntime
          })
        }
      : {}
  ) as ReferenceSpecs<IncludeRef>;

  const blockSpecs = {
    ...composed.blockSpecs,
    ...(options?.schema?.blockSpecs ?? {})
  } as MergedB;

  const inlineContentSpecs = {
    ...refSpec,
    ...composed.inlineContentSpecs,
    ...(options?.schema?.inlineContentSpecs ?? {})
  } as MergedI;

  const styleSpecs = {
    ...composed.styleSpecs,
    ...(options?.schema?.styleSpecs ?? {})
  } as MergedS;

  const schema = createPowerSchemaWithExtras<MergedB, MergedI, MergedS>({
    blockSpecs,
    inlineContentSpecs,
    styleSpecs
  });

  const commands: EditorCommand[] = [
    ...createDefaultPowerCommands(),
    ...(includeActions ? createBlockActionCommands() : []),
    ...composed.commands,
    ...(options?.commands ?? [])
  ];

  const registry = createCommandRegistry(commands);
  const featureExtensions = composed.extensions;
  const hostExtensions = options?.editor?.extensions ?? [];

  return {
    schema,
    registry,
    extensions: [...featureExtensions, ...hostExtensions],
    featureIds: composed.featureIds,
    blockReferenceRuntime,
    editorOptions(overrides?: PowerEditorOptions) {
      const overrideExtensions = overrides?.extensions ?? [];
      return createPowerEditorOptions({
        schema: schema as never,
        ...options?.editor,
        ...overrides,
        extensions: [
          ...featureExtensions,
          ...hostExtensions,
          ...overrideExtensions
        ]
      });
    }
  } satisfies OpenEditorPowerPreset<typeof schema>;
}
