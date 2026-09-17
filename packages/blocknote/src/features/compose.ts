import {
  createOpenEditorBlockNoteSchema,
  createPowerEditorOptions,
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
  createBlockReferenceInlineContentSpec
} from "../references/blockReference.js";
import {
  composePowerFeatures,
  type OpenEditorPowerFeature
} from "./types.js";

export type OpenEditorPowerPresetOptions = {
  features?: readonly OpenEditorPowerFeature[];
  /** Extra host schema — composed after features */
  schema?: CreateOpenEditorBlockNoteSchemaOptions;
  /** Extra commands beyond defaults + features */
  commands?: EditorCommand[];
  includeBlockActions?: boolean;
  includeBlockReference?: boolean;
  editor?: PowerEditorOptions;
};

export type OpenEditorPowerPreset = {
  // Intentionally widened — feature composition varies by enabled features.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any;
  registry: CommandRegistry;
  extensions: unknown[];
  featureIds: string[];
  editorOptions: (
    overrides?: PowerEditorOptions
  ) => ReturnType<typeof createPowerEditorOptions>;
};

/**
 * Ergonomic composition of power schema + optional features + commands.
 */
export function createOpenEditorPowerPreset(
  options?: OpenEditorPowerPresetOptions
): OpenEditorPowerPreset {
  const composed = composePowerFeatures(options?.features ?? []);
  const includeRef = options?.includeBlockReference ?? true;
  const includeActions = options?.includeBlockActions ?? true;

  const hostInline = {
    ...(includeRef
      ? { blockReference: createBlockReferenceInlineContentSpec() }
      : {}),
    ...composed.inlineContentSpecs,
    ...(options?.schema?.inlineContentSpecs ?? {})
  };

  const includePowerBlocks = options?.schema?.includePowerBlocks;
  const includeUnknownEnvelope = options?.schema?.includeUnknownEnvelope;

  const baseSchemaOptions = {
    blockSpecs: {
      ...composed.blockSpecs,
      ...(options?.schema?.blockSpecs ?? {})
    },
    inlineContentSpecs: hostInline,
    styleSpecs: {
      ...composed.styleSpecs,
      ...(options?.schema?.styleSpecs ?? {})
    }
  };

  // Branch on flags so overload resolution stays sound (no boolean→true mismatch).
  const schema =
    includePowerBlocks === false && includeUnknownEnvelope === false
      ? createOpenEditorBlockNoteSchema({
          ...baseSchemaOptions,
          includePowerBlocks: false,
          includeUnknownEnvelope: false
        })
      : includePowerBlocks === false
        ? createOpenEditorBlockNoteSchema({
            ...baseSchemaOptions,
            includePowerBlocks: false
          })
        : includeUnknownEnvelope === false
          ? createOpenEditorBlockNoteSchema({
              ...baseSchemaOptions,
              includeUnknownEnvelope: false
            })
          : createOpenEditorBlockNoteSchema(baseSchemaOptions);

  const commands: EditorCommand[] = [
    ...createDefaultPowerCommands(),
    ...(includeActions ? createBlockActionCommands() : []),
    ...composed.commands,
    ...(options?.commands ?? [])
  ];

  const registry = createCommandRegistry(commands);

  return {
    schema,
    registry,
    extensions: composed.extensions,
    featureIds: composed.featureIds,
    editorOptions(overrides) {
      return createPowerEditorOptions({
        schema: schema as never,
        ...options?.editor,
        ...overrides
      });
    }
  };
}
