import { BlockNoteSchema } from "@blocknote/core";
import { BlockNoteAdapterError } from "../adapter/errors.js";
import { UNKNOWN_ENVELOPE_TYPE } from "../types.js";
import { createCalloutBlockSpec } from "./callout.js";
import { createStatusBlockSpec } from "./status.js";
import { createUnknownEnvelopeBlockSpec } from "./unknownBlock.js";

export type CreateOpenEditorBlockNoteSchemaOptions = {
  /** Extra block specs merged via .extend */
  blockSpecs?: Record<string, unknown>;
  inlineContentSpecs?: Record<string, unknown>;
  styleSpecs?: Record<string, unknown>;
  /** default true */
  includeUnknownEnvelope?: boolean;
  /** default true — ship Phase 4F-1 power blocks */
  includePowerBlocks?: boolean;
};

const RESERVED_TYPES = new Set([UNKNOWN_ENVELOPE_TYPE, "callout", "status"]);

/**
 * Default BlockNote schema + OpenEditor unknown envelope + optional callout/status.
 * Never includes @blocknote/xl-* features.
 */
export function createOpenEditorBlockNoteSchema(
  options?: CreateOpenEditorBlockNoteSchemaOptions
) {
  const includeUnknownEnvelope = options?.includeUnknownEnvelope ?? true;
  const includePowerBlocks = options?.includePowerBlocks ?? true;
  const extra = options?.blockSpecs ?? {};

  for (const key of Object.keys(extra)) {
    if (RESERVED_TYPES.has(key) || key === "paragraph") {
      throw new BlockNoteAdapterError(
        "SCHEMA_TYPE_COLLISION",
        `Cannot override reserved block type "${key}"`
      );
    }
  }

  let schema = BlockNoteSchema.create();

  const powerSpecs: Record<string, ReturnType<typeof createUnknownEnvelopeBlockSpec>> = {};
  if (includeUnknownEnvelope) {
    powerSpecs[UNKNOWN_ENVELOPE_TYPE] = createUnknownEnvelopeBlockSpec();
  }
  if (includePowerBlocks) {
    Object.assign(powerSpecs, {
      callout: createCalloutBlockSpec(),
      status: createStatusBlockSpec()
    });
  }

  if (Object.keys(powerSpecs).length > 0 || Object.keys(extra).length > 0) {
    schema = schema.extend({
      blockSpecs: {
        ...powerSpecs,
        ...extra
      } as never,
      ...(options?.inlineContentSpecs
        ? { inlineContentSpecs: options.inlineContentSpecs as never }
        : {}),
      ...(options?.styleSpecs ? { styleSpecs: options.styleSpecs as never } : {})
    }) as typeof schema;
  }

  return schema;
}

export type OpenEditorBlockNoteSchema = ReturnType<typeof createOpenEditorBlockNoteSchema>;

/** Alias used by Agent E / power preset. */
export function createPowerSchema(
  options?: Omit<CreateOpenEditorBlockNoteSchemaOptions, "includePowerBlocks">
) {
  return createOpenEditorBlockNoteSchema({
    ...options,
    includePowerBlocks: true,
    includeUnknownEnvelope: options?.includeUnknownEnvelope ?? true
  });
}

export type PowerEditorOptions = {
  schema?: OpenEditorBlockNoteSchema;
  tables?: {
    splitCells?: boolean;
    cellBackgroundColor?: boolean;
    cellTextColor?: boolean;
    headers?: boolean;
  };
  uploadFile?: (file: File, blockId?: string) => Promise<string | Record<string, unknown>>;
  resolveFileUrl?: (url: string) => Promise<string>;
};

export const DEFAULT_POWER_TABLE_OPTIONS = {
  splitCells: true,
  cellBackgroundColor: true,
  cellTextColor: true,
  headers: true
} as const;

/**
 * Recommended BlockNoteEditor.create / useCreateBlockNote options for the power preset.
 */
export function createPowerEditorOptions(overrides?: PowerEditorOptions) {
  const schema = overrides?.schema ?? createPowerSchema();
  return {
    schema,
    tables: {
      ...DEFAULT_POWER_TABLE_OPTIONS,
      ...overrides?.tables
    },
    ...(overrides?.uploadFile ? { uploadFile: overrides.uploadFile } : {}),
    ...(overrides?.resolveFileUrl ? { resolveFileUrl: overrides.resolveFileUrl } : {})
  };
}
