import { describe, expect, it } from "vitest";
import * as editorCore from "../src/index.js";
import indexSource from "../src/index.ts?raw";

const runtimeExports = [
  "EDITOR_DOCUMENT_SCHEMA_VERSION",
  "EditorDocumentSerializationError",
  "cloneEditorBlock",
  "cloneEditorBlocks",
  "createEditorDocument",
  "deserializeEditorDocument",
  "fromSerializedEditorDocument",
  "isEditorBlock",
  "isEditorDocument",
  "isJsonValue",
  "isSupportedSchemaVersion",
  "serializeEditorDocument",
  "toSerializedEditorDocument"
] as const;

const typeExports = [
  "AIEditAction",
  "AIEditRequest",
  "AIProvider",
  "AssetProvider",
  "AssetUploadScope",
  "CommentsProvider",
  "CreatedChildPage",
  "DatabaseListOptions",
  "DatabaseProvider",
  "DatabaseRowItem",
  "DatabaseRowsPage",
  "EditorAsset",
  "EditorAssetKind",
  "EditorBlock",
  "EditorBlockProps",
  "EditorComment",
  "EditorDocument",
  "EditorPageLink",
  "EditorProviders",
  "EditorUploadFile",
  "EditorVersionSnapshot",
  "ImageSearchProvider",
  "ImageSearchResult",
  "JsonValue",
  "NativeBridge",
  "NativeBridgeStats",
  "NativeHostRequest",
  "NativeHostResponse",
  "PageProvider",
  "SerializedEditorDocument",
  "VersionProvider"
] as const;

describe("editor-core public API", () => {
  it("exposes only the approved runtime surface", () => {
    expect(Object.keys(editorCore).sort()).toEqual([...runtimeExports].sort());
    expect(editorCore.EDITOR_DOCUMENT_SCHEMA_VERSION).toBe(1);
  });

  it("re-exports the approved type surface from index.ts", () => {
    for (const name of typeExports) {
      expect(indexSource).toMatch(new RegExp(`\\b${name}\\b`));
    }
    expect(indexSource).not.toMatch(/\bopenEmployees\b/);
    expect(indexSource).not.toMatch(/\bpersonal-ai\b/);
  });
});
