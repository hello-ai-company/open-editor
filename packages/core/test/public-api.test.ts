import { describe, expect, it } from "vitest";
import * as editorCore from "../src/index.js";
import indexSource from "../src/index.ts?raw";
import { collectTypeExportNames, diffTypeExports, typeExportsMatch } from "./collectTypeExports.js";
import { loadPublicApiContract } from "./loadContracts.js";

const publicApi = loadPublicApiContract();
const runtimeExports = publicApi.runtimeExports;
const typeExports = publicApi.typeExports;

describe("editor-core public API", () => {
  it("exposes only the approved runtime surface", () => {
    expect(publicApi.packageName).toBe("@hello-ai-company/editor-core");
    expect(publicApi.version).toBe("0.1.0");
    expect(Object.keys(editorCore).sort()).toEqual([...runtimeExports].sort());
    expect(editorCore.EDITOR_DOCUMENT_SCHEMA_VERSION).toBe(1);
  });

  it("re-exports exactly the approved type surface from index.ts", () => {
    const actual = collectTypeExportNames(indexSource, "index.ts").sort();
    const expected = [...typeExports].sort();
    const { missing, extra } = diffTypeExports(actual, expected);
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    expect(actual).toEqual(expected);
    expect(indexSource).not.toMatch(/\bopenEmployees\b/);
    expect(indexSource).not.toMatch(/\bpersonal-ai\b/);
  });

  it("fails type-export equality when a type is missing or extra", () => {
    const expected = ["EditorBlock", "JsonValue"];
    const missingActual = collectTypeExportNames(`export type { JsonValue } from "./model.js";`);
    const extraActual = collectTypeExportNames(
      `export type { EditorBlock, JsonValue, UnexpectedType } from "./model.js";`
    );
    expect(diffTypeExports(missingActual, expected)).toEqual({
      missing: ["EditorBlock"],
      extra: []
    });
    expect(diffTypeExports(extraActual, expected)).toEqual({
      missing: [],
      extra: ["UnexpectedType"]
    });
    expect(typeExportsMatch(missingActual, expected)).toBe(false);
    expect(typeExportsMatch(extraActual, expected)).toBe(false);
  });
});
