import {
  BlockNoteSchema,
  type BlockSpecs,
  type InlineContentConfig,
  type InlineContentSpec,
  type InlineContentSpecs,
  type StyleSpecs
} from "@blocknote/core";
import { BlockNoteAdapterError } from "../adapter/errors.js";
import { UNKNOWN_ENVELOPE_TYPE } from "../types.js";
import { createCalloutBlockSpec } from "./callout.js";
import { createStatusBlockSpec } from "./status.js";
import { createUnknownEnvelopeBlockSpec } from "./unknownBlock.js";

const RESERVED_TYPES = new Set([UNKNOWN_ENVELOPE_TYPE, "callout", "status", "paragraph"]);

/** Additional inline content specs merged via BlockNoteSchema.extend (text/link already present). */
export type AdditionalInlineContentSpecs = Record<
  string,
  InlineContentSpec<InlineContentConfig>
>;

type SchemaFlags = {
  /** default true */
  includeUnknownEnvelope?: boolean;
  /** default true — ship Phase 4F-1 power blocks */
  includePowerBlocks?: boolean;
};

export type CreateOpenEditorBlockNoteSchemaOptions<
  BSpecs extends BlockSpecs = Record<string, never>,
  ISpecs extends AdditionalInlineContentSpecs = Record<string, never>,
  SSpecs extends StyleSpecs = Record<string, never>
> = SchemaFlags & {
  blockSpecs?: BSpecs;
  inlineContentSpecs?: ISpecs;
  styleSpecs?: SSpecs;
};

type HostSpecs<
  BSpecs extends BlockSpecs = Record<string, never>,
  ISpecs extends AdditionalInlineContentSpecs = Record<string, never>,
  SSpecs extends StyleSpecs = Record<string, never>
> = {
  blockSpecs?: BSpecs;
  inlineContentSpecs?: ISpecs;
  styleSpecs?: SSpecs;
};

type HostSpecOptions<
  BSpecs extends BlockSpecs,
  ISpecs extends AdditionalInlineContentSpecs,
  SSpecs extends StyleSpecs
> = {
  blockSpecs?: BSpecs;
  inlineContentSpecs?: ISpecs;
  styleSpecs?: SSpecs;
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

/** callout + status + oeUnknownBlock + host specs */
function createPowerSchemaWithExtras<
  BSpecs extends BlockSpecs,
  ISpecs extends AdditionalInlineContentSpecs,
  SSpecs extends StyleSpecs
>(extras: HostSpecs<BSpecs, ISpecs, SSpecs>) {
  return BlockNoteSchema.create()
    .extend({
      blockSpecs: {
        oeUnknownBlock: createUnknownEnvelopeBlockSpec(),
        callout: createCalloutBlockSpec(),
        status: createStatusBlockSpec()
      }
    })
    .extend({
      blockSpecs: extras.blockSpecs,
      inlineContentSpecs: extras.inlineContentSpecs,
      styleSpecs: extras.styleSpecs
    });
}

/** callout + status + host specs — no oeUnknownBlock */
function createPowerSchemaWithoutUnknown<
  BSpecs extends BlockSpecs,
  ISpecs extends AdditionalInlineContentSpecs,
  SSpecs extends StyleSpecs
>(extras: HostSpecs<BSpecs, ISpecs, SSpecs>) {
  return BlockNoteSchema.create()
    .extend({
      blockSpecs: {
        callout: createCalloutBlockSpec(),
        status: createStatusBlockSpec()
      }
    })
    .extend({
      blockSpecs: extras.blockSpecs,
      inlineContentSpecs: extras.inlineContentSpecs,
      styleSpecs: extras.styleSpecs
    });
}

/** oeUnknownBlock + host specs — no callout/status */
function createUnknownEnvelopeSchemaWithExtras<
  BSpecs extends BlockSpecs,
  ISpecs extends AdditionalInlineContentSpecs,
  SSpecs extends StyleSpecs
>(extras: HostSpecs<BSpecs, ISpecs, SSpecs>) {
  return BlockNoteSchema.create()
    .extend({
      blockSpecs: {
        oeUnknownBlock: createUnknownEnvelopeBlockSpec()
      }
    })
    .extend({
      blockSpecs: extras.blockSpecs,
      inlineContentSpecs: extras.inlineContentSpecs,
      styleSpecs: extras.styleSpecs
    });
}

/** Host specs only (no power blocks, no unknown envelope) */
function createHostOnlySchemaWithExtras<
  BSpecs extends BlockSpecs,
  ISpecs extends AdditionalInlineContentSpecs,
  SSpecs extends StyleSpecs
>(extras: HostSpecs<BSpecs, ISpecs, SSpecs>) {
  return BlockNoteSchema.create().extend({
    blockSpecs: extras.blockSpecs,
    inlineContentSpecs: extras.inlineContentSpecs,
    styleSpecs: extras.styleSpecs
  });
}

function hasHostExtras(
  extras: HostSpecs<BlockSpecs, AdditionalInlineContentSpecs, StyleSpecs>
): boolean {
  return Boolean(
    (extras.blockSpecs && Object.keys(extras.blockSpecs).length > 0) ||
      (extras.inlineContentSpecs && Object.keys(extras.inlineContentSpecs).length > 0) ||
      (extras.styleSpecs && Object.keys(extras.styleSpecs).length > 0)
  );
}

/** Default power schema — `typeof schema.Block` includes callout, status, oeUnknownBlock. */
export function createOpenEditorBlockNoteSchema(): ReturnType<typeof createDefaultPowerSchema>;

/**
 * Power blocks on, unknown envelope off.
 * Typed without `oeUnknownBlock`.
 */
export function createOpenEditorBlockNoteSchema<
  BSpecs extends BlockSpecs = Record<string, never>,
  ISpecs extends AdditionalInlineContentSpecs = Record<string, never>,
  SSpecs extends StyleSpecs = Record<string, never>
>(
  options: HostSpecOptions<BSpecs, ISpecs, SSpecs> & {
    includeUnknownEnvelope: false;
    includePowerBlocks?: true;
  }
): ReturnType<typeof createPowerSchemaWithoutUnknown<BSpecs, ISpecs, SSpecs>>;

/**
 * Both power blocks and unknown envelope off — host extras only.
 * Listed before the power-off/unknown-on overload so both-false resolves here.
 */
export function createOpenEditorBlockNoteSchema<
  BSpecs extends BlockSpecs = Record<string, never>,
  ISpecs extends AdditionalInlineContentSpecs = Record<string, never>,
  SSpecs extends StyleSpecs = Record<string, never>
>(
  options: HostSpecOptions<BSpecs, ISpecs, SSpecs> & {
    includePowerBlocks: false;
    includeUnknownEnvelope: false;
  }
): ReturnType<typeof createHostOnlySchemaWithExtras<BSpecs, ISpecs, SSpecs>>;

/**
 * Unknown envelope on, power blocks off.
 * Typed with host inline/style/block extras; no callout/status.
 */
export function createOpenEditorBlockNoteSchema<
  BSpecs extends BlockSpecs = Record<string, never>,
  ISpecs extends AdditionalInlineContentSpecs = Record<string, never>,
  SSpecs extends StyleSpecs = Record<string, never>
>(
  options: HostSpecOptions<BSpecs, ISpecs, SSpecs> & {
    includePowerBlocks: false;
    includeUnknownEnvelope?: true;
  }
): ReturnType<typeof createUnknownEnvelopeSchemaWithExtras<BSpecs, ISpecs, SSpecs>>;

/**
 * Full power schema + custom blockSpecs / inlineContentSpecs / styleSpecs.
 * All provided specs are passed to BlockNoteSchema.extend.
 */
export function createOpenEditorBlockNoteSchema<
  BSpecs extends BlockSpecs = Record<string, never>,
  ISpecs extends AdditionalInlineContentSpecs = Record<string, never>,
  SSpecs extends StyleSpecs = Record<string, never>
>(
  options: HostSpecOptions<BSpecs, ISpecs, SSpecs> & {
    includePowerBlocks?: true;
    includeUnknownEnvelope?: true;
  }
): ReturnType<typeof createPowerSchemaWithExtras<BSpecs, ISpecs, SSpecs>>;

/**
 * Default BlockNote schema + OpenEditor unknown envelope + optional callout/status.
 * Never includes @blocknote/xl-* features.
 */
// Implementation signature is intentionally wide; overloads above provide precise caller types.
export function createOpenEditorBlockNoteSchema(
  options?: SchemaFlags & {
    blockSpecs?: BlockSpecs;
    inlineContentSpecs?: AdditionalInlineContentSpecs;
    styleSpecs?: StyleSpecs;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const includeUnknownEnvelope = options?.includeUnknownEnvelope ?? true;
  const includePowerBlocks = options?.includePowerBlocks ?? true;
  const extras: HostSpecs<BlockSpecs, AdditionalInlineContentSpecs, StyleSpecs> = {
    blockSpecs: options?.blockSpecs,
    inlineContentSpecs: options?.inlineContentSpecs,
    styleSpecs: options?.styleSpecs
  };

  if (extras.blockSpecs) {
    assertNoReservedCollisions(Object.keys(extras.blockSpecs));
  }

  if (includeUnknownEnvelope && includePowerBlocks) {
    if (!hasHostExtras(extras)) {
      return createDefaultPowerSchema();
    }
    return createPowerSchemaWithExtras(extras);
  }

  if (includeUnknownEnvelope && !includePowerBlocks) {
    return createUnknownEnvelopeSchemaWithExtras(extras);
  }

  if (!includeUnknownEnvelope && includePowerBlocks) {
    return createPowerSchemaWithoutUnknown(extras);
  }

  // neither power nor unknown
  if (!hasHostExtras(extras)) {
    return BlockNoteSchema.create();
  }
  return createHostOnlySchemaWithExtras(extras);
}

export type OpenEditorBlockNoteSchema = ReturnType<typeof createDefaultPowerSchema>;

/** Alias used by Agent E / power preset. Always includes callout + status. */
export function createPowerSchema(): ReturnType<typeof createDefaultPowerSchema>;

/**
 * Power blocks without unknown envelope — type excludes `oeUnknownBlock`.
 */
export function createPowerSchema<
  BSpecs extends BlockSpecs = Record<string, never>,
  ISpecs extends AdditionalInlineContentSpecs = Record<string, never>,
  SSpecs extends StyleSpecs = Record<string, never>
>(
  options: HostSpecOptions<BSpecs, ISpecs, SSpecs> & {
    includeUnknownEnvelope: false;
  }
): ReturnType<typeof createPowerSchemaWithoutUnknown<BSpecs, ISpecs, SSpecs>>;

/**
 * Full power schema (callout + status + oeUnknownBlock) + optional host specs.
 */
export function createPowerSchema<
  BSpecs extends BlockSpecs = Record<string, never>,
  ISpecs extends AdditionalInlineContentSpecs = Record<string, never>,
  SSpecs extends StyleSpecs = Record<string, never>
>(
  options: HostSpecOptions<BSpecs, ISpecs, SSpecs> & {
    includeUnknownEnvelope?: true;
  }
): ReturnType<typeof createPowerSchemaWithExtras<BSpecs, ISpecs, SSpecs>>;

// Implementation signature is intentionally wide; overloads provide precise caller types.
export function createPowerSchema(
  options?: SchemaFlags & {
    blockSpecs?: BlockSpecs;
    inlineContentSpecs?: AdditionalInlineContentSpecs;
    styleSpecs?: StyleSpecs;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const extras: HostSpecs<BlockSpecs, AdditionalInlineContentSpecs, StyleSpecs> = {
    blockSpecs: options?.blockSpecs,
    inlineContentSpecs: options?.inlineContentSpecs,
    styleSpecs: options?.styleSpecs
  };
  if (extras.blockSpecs) {
    assertNoReservedCollisions(Object.keys(extras.blockSpecs));
  }
  if (options?.includeUnknownEnvelope === false) {
    return createPowerSchemaWithoutUnknown(extras);
  }
  if (!hasHostExtras(extras)) {
    return createDefaultPowerSchema();
  }
  return createPowerSchemaWithExtras(extras);
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

// Re-export for callers who need the full InlineContentSpecs name from BlockNote.
export type { InlineContentSpecs, StyleSpecs };
