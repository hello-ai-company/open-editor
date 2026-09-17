export type BlockNoteAdapterErrorCode =
  | "INVALID_EDITOR_DOCUMENT"
  | "INVALID_BLOCKNOTE_BLOCK"
  | "NON_JSON_VALUE"
  | "ENVELOPE_CORRUPT"
  | "MISSING_BLOCK_ID"
  | "SCHEMA_TYPE_COLLISION";

export class BlockNoteAdapterError extends Error {
  readonly code: BlockNoteAdapterErrorCode;
  readonly path?: string;

  constructor(code: BlockNoteAdapterErrorCode, message: string, path?: string) {
    super(path ? `${message} (at ${path})` : message);
    this.name = "BlockNoteAdapterError";
    this.code = code;
    this.path = path;
  }
}
