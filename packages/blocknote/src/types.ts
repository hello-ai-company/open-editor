export const UNKNOWN_ENVELOPE_TYPE = "oeUnknownBlock" as const;
export const ENVELOPE_ENCODING_VERSION = "1" as const;

export const POWER_BLOCK_TYPES = {
  callout: "callout",
  status: "status",
  unknownEnvelope: UNKNOWN_ENVELOPE_TYPE
} as const;

/** Structural BlockNote-like block for adapter ingress (plain JSON OK). */
export type BlockLike = {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: readonly BlockLike[];
};

export type FromBlockNoteOptions = {
  /** default true — unwrap oeUnknown / oeUnknownBlock envelopes */
  unwrapUnknownEnvelope?: boolean;
  /** default "oeUnknownBlock" */
  unknownEnvelopeType?: string;
};

export type ToBlockNoteOptions = {
  /** Set of BN schema block type names that are editable natively */
  knownBlockTypes: ReadonlySet<string> | readonly string[];
  /** default true — wrap non-known OE types into envelope */
  wrapUnknownAsEnvelope?: boolean;
  unknownEnvelopeType?: string;
  /**
   * default "preserve" — keep OE ids.
   * "regenerate-missing" only for broken/missing ids.
   */
  idPolicy?: "preserve" | "regenerate-missing";
};

export type OpenEditorPartialBlock = {
  id?: string;
  type: string;
  props?: Record<string, boolean | number | string>;
  content?: unknown;
  children?: OpenEditorPartialBlock[];
};
