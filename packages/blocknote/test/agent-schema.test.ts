import { describe, expect, it } from "vitest";
import { describeOpenEditorAgentSchema } from "../src/features/agentSchema.js";
import { createOpenEditorBlockNoteSchema } from "../src/schema/createOpenEditorBlockNoteSchema.js";
import { createOpenEditorPowerFeatureRegistry } from "../src/features/registry.js";
describe("host agent schema inventory", () => {
  it("reports installed schema keys as JSON without spec implementations or inferring permissions", () => {
    const schema = createOpenEditorBlockNoteSchema(), registry = createOpenEditorPowerFeatureRegistry();
    const inventory = describeOpenEditorAgentSchema(schema, registry);
    expect(inventory.blockTypes).toContain("heading"); expect(inventory.inlineTypes).toContain("link"); expect(inventory.blockTypes).not.toContain("database");
    expect(JSON.parse(JSON.stringify(inventory))).toEqual(inventory); expect(inventory).not.toHaveProperty("operations");
    registry.register({ id: "host-only", commands: [{ id: "local-command", title: "Local", group: "navigation", surfaces: ["palette"], run: () => {} }] });
    expect(describeOpenEditorAgentSchema(schema, registry).commandIds).toEqual(["local-command"]); registry.unregister("host-only"); expect(describeOpenEditorAgentSchema(schema, registry).featureIds).toEqual([]);
  });
});
