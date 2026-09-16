import { describe, expect, it } from "vitest";
import * as editorCore from "../src/index.js";
import indexSource from "../src/index.ts?raw";
import { loadPublicApiContract } from "./loadContracts.js";

const publicApi = loadPublicApiContract();
const runtimeExports = publicApi.runtimeExports;
const typeExports = publicApi.typeExports;

describe("editor-core public API", () => {
  it("exposes only the approved runtime surface", () => {
    expect(publicApi.packageName).toBe("@hello-ai-company/editor-core");
    expect(publicApi.version).toBe("0.0.0-phase3.e17b4b5");
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
