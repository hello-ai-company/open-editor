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
  createBlockReferenceCommands,
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
  createChildPageBlockSpec,
  createDatabaseRelationInlineContentSpec,
  createDatabaseViewBlockSpec,
  createPageCardBlockSpec,
  createPageMentionInlineContentSpec,
  createWorkspaceContentCommands,
  type ChildPageRuntime,
  type DatabaseViewRuntime,
  type PageCardRuntime,
  type PageMentionRuntime,
  type PageMentionSpecOptions
} from "../workspace/index.js";
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

type WorkspaceInline = {
  pageMention: ReturnType<typeof createPageMentionInlineContentSpec>;
  databaseRelation: ReturnType<typeof createDatabaseRelationInlineContentSpec>;
};

type WorkspaceBlocks = {
  pageCard: ReturnType<typeof createPageCardBlockSpec>;
  childPage: ReturnType<typeof createChildPageBlockSpec>;
  databaseView: ReturnType<typeof createDatabaseViewBlockSpec>;
};

/**
 * Reference inline specs only when `includeBlockReference` is not `false`.
 * Keeps TypeScript schema aligned with runtime (4F-2 R2).
 */
export type ReferenceSpecs<IncludeRef extends boolean> =
  IncludeRef extends false ? {} : RefInline;

/**
 * Workspace content specs when `includeWorkspaceContent` is not `false`.
 */
export type WorkspaceInlineSpecs<IncludeWorkspace extends boolean> =
  IncludeWorkspace extends false ? {} : WorkspaceInline;

export type WorkspaceBlockSpecs<IncludeWorkspace extends boolean> =
  IncludeWorkspace extends false ? {} : WorkspaceBlocks;

export type OpenEditorPowerPresetOptions<
  Features extends readonly OpenEditorPowerFeature<any, any, any>[] =
    readonly OpenEditorPowerFeature[],
  // IMPORTANT: default must NOT be Record<string, never> — intersecting that
  // index signature collapses concrete feature keys to `never`.
  HostB extends BlockSpecs = {},
  HostI extends AdditionalInlineContentSpecs = {},
  HostS extends StyleSpecs = {},
  IncludeRef extends boolean = true,
  IncludeWorkspace extends boolean = true
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
  /**
   * When false, pageMention / pageCard / childPage / databaseView /
   * databaseRelation are omitted from both schema and command registry
   * (schema ↔ commands must agree).
   */
  includeWorkspaceContent?: IncludeWorkspace;
  blockReference?: BlockReferenceSpecOptions;
  blockReferenceRuntime?: BlockReferenceRuntime;
  pageMention?: PageMentionSpecOptions;
  pageMentionRuntime?: PageMentionRuntime;
  pageCardRuntime?: PageCardRuntime;
  childPageRuntime?: ChildPageRuntime;
  databaseViewRuntime?: DatabaseViewRuntime;
  editor?: PowerEditorOptions;
};

export type OpenEditorPowerPreset<Schema = unknown> = {
  schema: Schema;
  registry: CommandRegistry;
  extensions: import("@blocknote/core").ExtensionFactoryInstance[];
  featureIds: string[];
  blockReferenceRuntime: BlockReferenceRuntime;
  pageMentionRuntime: PageMentionRuntime;
  pageCardRuntime: PageCardRuntime;
  childPageRuntime: ChildPageRuntime;
  databaseViewRuntime: DatabaseViewRuntime;
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
  const IncludeRef extends boolean = true,
  const IncludeWorkspace extends boolean = true
>(
  options?: OpenEditorPowerPresetOptions<
    Features,
    HostB,
    HostI,
    HostS,
    IncludeRef,
    IncludeWorkspace
  >
) {
  type MergedB = MergeFeatureBlockSpecs<Features> &
    HostB &
    WorkspaceBlockSpecs<IncludeWorkspace>;
  type MergedI = MergeFeatureInlineSpecs<Features> &
    HostI &
    ReferenceSpecs<IncludeRef> &
    WorkspaceInlineSpecs<IncludeWorkspace>;
  type MergedS = MergeFeatureStyleSpecs<Features> & HostS;

  const composed = composePowerFeatures(
    (options?.features ?? []) as Features
  );
  const includeRef = (options?.includeBlockReference ?? true) as IncludeRef;
  const includeWorkspace = (options?.includeWorkspaceContent ??
    true) as IncludeWorkspace;
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

  const pageMentionRuntime: PageMentionRuntime =
    options?.pageMentionRuntime ?? options?.pageMention?.runtime ?? {};
  if (options?.pageMention) {
    const pm = options.pageMention;
    if (pm.resolve) pageMentionRuntime.resolve = pm.resolve;
    if (pm.onNavigate) pageMentionRuntime.onNavigate = pm.onNavigate;
    if (pm.missingLabel) pageMentionRuntime.missingLabel = pm.missingLabel;
    if (pm.untitledLabel) pageMentionRuntime.untitledLabel = pm.untitledLabel;
    if (pm.subscribe) pageMentionRuntime.subscribe = pm.subscribe;
  }

  // Each preset captures its own runtime objects by closure — never module-global.
  const pageCardRuntime: PageCardRuntime = options?.pageCardRuntime ?? {};
  const childPageRuntime: ChildPageRuntime = options?.childPageRuntime ?? {};
  const databaseViewRuntime: DatabaseViewRuntime =
    options?.databaseViewRuntime ?? {};

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

  const workspaceInline = (
    includeWorkspace
      ? {
          pageMention: createPageMentionInlineContentSpec({
            ...options?.pageMention,
            runtime: pageMentionRuntime
          }),
          databaseRelation: createDatabaseRelationInlineContentSpec()
        }
      : {}
  ) as WorkspaceInlineSpecs<IncludeWorkspace>;

  const workspaceBlocks = (
    includeWorkspace
      ? {
          pageCard: createPageCardBlockSpec(pageCardRuntime),
          childPage: createChildPageBlockSpec(childPageRuntime),
          databaseView: createDatabaseViewBlockSpec(databaseViewRuntime)
        }
      : {}
  ) as WorkspaceBlockSpecs<IncludeWorkspace>;

  const blockSpecs = {
    ...composed.blockSpecs,
    ...workspaceBlocks,
    ...(options?.schema?.blockSpecs ?? {})
  } as MergedB;

  const inlineContentSpecs = {
    ...refSpec,
    ...workspaceInline,
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
    ...(includeRef ? createBlockReferenceCommands() : []),
    ...(includeWorkspace ? createWorkspaceContentCommands() : []),
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
    pageMentionRuntime,
    pageCardRuntime,
    childPageRuntime,
    databaseViewRuntime,
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
