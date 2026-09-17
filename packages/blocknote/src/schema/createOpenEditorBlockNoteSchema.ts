import {
  BlockNoteSchema,
  type BlockSpecs,
  type InlineContentSpecs,
  type StyleSpecs
} from "@blocknote/core";
import { BlockNoteAdapterError } from "../adapter/errors.js";
import { UNKNOWN_ENVELOPE_TYPE } from "../types.js";
import { createCalloutBlockSpec } from "./callout.js";
import { createStatusBlockSpec } from "./status.js";
import { createUnknownEnvelopeBlockSpec } from "./unknownBlock.js";

const RESERVED_TYPES = new Set([UNKNOWN_ENVELOPE_TYPE, "callout", "status", "paragraph"]);

type BaseOptions = {
  inlineContentSpecs?: InlineContentSpecs;
  styleSpecs?: StyleSpecs;
  /** default true */
  includeUnknownEnvelope?: boolean;
  /** default true — ship Phase 4F-1 power blocks */
  includePowerBlocks?: boolean;
};

export type CreateOpenEditorBlockNoteSchemaOptions<
  BSpecs extends BlockSpecs = Record<string, never>
> = BaseOptions & {
  blockSpecs?: BSpecs;
};

function assertNoReservedCollisions(extraKeys: readonly string[]): void {
  for (const key of extraKeys) {
    if (RESERVED_TYPES.has(key)) {
      throw new BlockNoteAdapterError(
        "SCHEMA_TYPE_COLLISION",
        `Cannot override reserved block type "${key}"`
      );
    }
  }
}

function createDefaultPowerSchema() {
  return BlockNoteSchema.create().extend({
    blockSpecs: {
      oeUnknownBlock: createUnknownEnvelopeBlockSpec(),
      callout: createCalloutBlockSpec(),
      status: createStatusBlockSpec()
    }
  });
}

function createPowerSchemaWithExtras<BSpecs extends BlockSpecs>(extra: BSpecs) {
  return BlockNoteSchema.create().extend({
    blockSpecs: {
      oeUnknownBlock: createUnknownEnvelopeBlockSpec(),
      callout: createCalloutBlockSpec(),
      status: createStatusBlockSpec(),
      ...extra
    }
  });
}

/** Default power schema — `typeof schema.Block` includes callout, status, oeUnknownBlock. */
export function createOpenEditorBlockNoteSchema(): ReturnType<typeof createDefaultPowerSchema>;

/**
 * Power schema + custom blockSpecs.
 * `typeof schema.Block` includes callout, status, oeUnknownBlock, and custom keys.
 */
export function createOpenEditorBlockNoteSchema<BSpecs extends BlockSpecs>(
  options: BaseOptions & {
    blockSpecs: BSpecs;
    includePowerBlocks?: true;
    includeUnknownEnvelope?: true;
  }
): ReturnType<typeof createPowerSchemaWithExtras<BSpecs>>;

/** Runtime-flag overload (looser typing when omitting power blocks). */
export function createOpenEditorBlockNoteSchema(
  options: CreateOpenEditorBlockNoteSchemaOptions
): ReturnType<typeof BlockNoteSchema.create> | ReturnType<typeof createDefaultPowerSchema>;

/**
 * Default BlockNote schema + OpenEditor unknown envelope + optional callout/status.
 * Never includes @blocknote/xl-* features.
 */
// Implementation signature is intentionally wide; overloads above provide precise caller types.
export function createOpenEditorBlockNoteSchema(
  options?: CreateOpenEditorBlockNoteSchemaOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const includeUnknownEnvelope = options?.includeUnknownEnvelope ?? true;
  const includePowerBlocks = options?.includePowerBlocks ?? true;
  const extraBlocks = options?.blockSpecs;

  if (extraBlocks) {
    assertNoReservedCollisions(Object.keys(extraBlocks));
  }

  if (includeUnknownEnvelope && includePowerBlocks) {
    if (!extraBlocks || Object.keys(extraBlocks).length === 0) {
      return createDefaultPowerSchema();
    }
    return createPowerSchemaWithExtras(extraBlocks);
  }

  const base = BlockNoteSchema.create();

  if (includeUnknownEnvelope && !includePowerBlocks) {
    return base.extend({
      blockSpecs: {
        oeUnknownBlock: createUnknownEnvelopeBlockSpec(),
        ...(extraBlocks ?? {})
      }
    });
  }

  if (!includeUnknownEnvelope && includePowerBlocks) {
    return base.extend({
      blockSpecs: {
        callout: createCalloutBlockSpec(),
        status: createStatusBlockSpec(),
        ...(extraBlocks ?? {})
      }
    });
  }

  if (!extraBlocks || Object.keys(extraBlocks).length === 0) {
    return base;
  }

  return base.extend({
    blockSpecs: extraBlocks
  });
}

export type OpenEditorBlockNoteSchema = ReturnType<typeof createDefaultPowerSchema>;

/** Alias used by Agent E / power preset. Always includes callout + status. */
export function createPowerSchema(): ReturnType<typeof createDefaultPowerSchema>;
export function createPowerSchema<BSpecs extends BlockSpecs>(
  options: BaseOptions & { blockSpecs: BSpecs }
): ReturnType<typeof createPowerSchemaWithExtras<BSpecs>>;
// Implementation signature is intentionally wide; overloads provide precise caller types.
export function createPowerSchema(options?: CreateOpenEditorBlockNoteSchemaOptions): any {
  return createOpenEditorBlockNoteSchema({
    ...options,
    includePowerBlocks: true,
    includeUnknownEnvelope: options?.includeUnknownEnvelope ?? true
  });
}

export type PowerEditorOptions<Schema extends OpenEditorBlockNoteSchema = OpenEditorBlockNoteSchema> = {
  schema?: Schema;
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
export function createPowerEditorOptions<
  Schema extends OpenEditorBlockNoteSchema = OpenEditorBlockNoteSchema
>(overrides?: PowerEditorOptions<Schema>) {
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
