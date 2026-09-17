import { describe, expect, it } from "vitest";
import type { ExtensionFactoryInstance } from "@blocknote/core";
import { createCodePowerFeature } from "../src/code/index.js";
import { createOpenEditorPowerPreset } from "../src/features/compose.js";

describe("feature extension composition", () => {
  it("includes code syntaxHighlighter in editorOptions().extensions", () => {
    const code = createCodePowerFeature();
    const preset = createOpenEditorPowerPreset({
      features: [code]
    });
    expect(preset.extensions.length).toBeGreaterThan(0);
    const options = preset.editorOptions();
    expect(options.extensions).toBeDefined();
    expect(options.extensions?.length).toBeGreaterThan(0);
    expect(options.extensions?.[0]).toBe(code.extensions?.[0]);
  });

  it("merges host override extensions after feature extensions", () => {
    const hostExt = ((() => ({
      key: "host-ext"
    })) as unknown) as ExtensionFactoryInstance;
    const code = createCodePowerFeature();
    const preset = createOpenEditorPowerPreset({
      features: [code],
      editor: { extensions: [hostExt] }
    });
    const options = preset.editorOptions();
    expect(options.extensions).toEqual([code.extensions?.[0], hostExt]);
  });
});
