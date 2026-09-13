import {
  EDITOR_DOCUMENT_SCHEMA_VERSION,
  cloneEditorBlock,
  isEditorBlock,
  isSupportedSchemaVersion,
  type EditorBlock,
  type EditorDocument
} from "./model.js";

export class EditorDocumentSerializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditorDocumentSerializationError";
  }
}

export type SerializedEditorDocument = {
  schemaVersion: number;
  blocks: EditorBlock[];
};

export function serializeEditorDocument(document: EditorDocument): string {
  return JSON.stringify(toSerializedEditorDocument(document));
}

export function deserializeEditorDocument(payload: string): EditorDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new EditorDocumentSerializationError("Editor document JSON is not valid.");
  }
  return fromSerializedEditorDocument(parsed);
}

export function toSerializedEditorDocument(document: EditorDocument): SerializedEditorDocument {
  if (!isSupportedSchemaVersion(document.schemaVersion)) {
    throw new EditorDocumentSerializationError("Editor document schemaVersion must be the positive integer 1.");
  }
  if (!Array.isArray(document.blocks)) {
    throw new EditorDocumentSerializationError("Editor document blocks must be an array.");
  }
  return {
    schemaVersion: document.schemaVersion,
    blocks: document.blocks.map(normalizeEditorBlock)
  };
}

export function fromSerializedEditorDocument(payload: unknown): EditorDocument {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new EditorDocumentSerializationError("Editor document must be an object.");
  }
  const record = payload as Record<string, unknown>;
  const schemaVersion = record.schemaVersion === undefined ? EDITOR_DOCUMENT_SCHEMA_VERSION : record.schemaVersion;
  if (!isSupportedSchemaVersion(schemaVersion)) {
    throw new EditorDocumentSerializationError(
      typeof schemaVersion === "number"
        ? `Unsupported editor document schemaVersion ${schemaVersion}.`
        : "Editor document schemaVersion must be the positive integer 1."
    );
  }
  if (!Array.isArray(record.blocks)) {
    throw new EditorDocumentSerializationError("Editor document blocks must be an array.");
  }
  return {
    schemaVersion,
    blocks: record.blocks.map((block, index) => {
      if (!isEditorBlock(block)) {
        throw new EditorDocumentSerializationError(`Editor document block at index ${index} is invalid.`);
      }
      return normalizeEditorBlock(block);
    })
  };
}

function normalizeEditorBlock(block: EditorBlock): EditorBlock {
  const normalized = cloneEditorBlock(block);
  if (normalized.children?.length === 0) {
    delete normalized.children;
  }
  if (normalized.props && Object.keys(normalized.props).length === 0) {
    delete normalized.props;
  }
  return normalized;
}
