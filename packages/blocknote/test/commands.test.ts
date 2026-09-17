import { describe, expect, it } from "vitest";
import { createCommandRegistry, createDefaultPowerCommands } from "../src/commands/registry.js";

describe("command registry", () => {
  it("dedupes by id and drives slash + palette from one registry", () => {
    const registry = createCommandRegistry(createDefaultPowerCommands());
    const ctx = {
      editor: {
        insertBlocks: () => undefined,
        updateBlock: () => undefined,
        getTextCursorPosition: () => ({ block: { id: "b1", type: "paragraph" } }),
        transact: <T>(fn: () => T) => fn()
      }
    };

    const slash = registry.toSlashItems(ctx);
    const palette = registry.toPaletteItems(ctx);
    expect(slash.some((item) => item.commandId === "block.insert.callout")).toBe(true);
    expect(palette.some((item) => item.id === "block.insert.status")).toBe(true);
    expect(palette.some((item) => item.id === "document.copy-json")).toBe(true);
    expect(slash.some((item) => item.commandId === "document.copy-json")).toBe(false);
  });

  it("throws on duplicate command ids", () => {
    expect(() =>
      createCommandRegistry([
        {
          id: "x",
          title: "A",
          group: "basic",
          surfaces: ["slash"],
          run: () => undefined
        },
        {
          id: "x",
          title: "B",
          group: "basic",
          surfaces: ["slash"],
          run: () => undefined
        }
      ])
    ).toThrow(/Duplicate command id/);
  });

  it("hides media commands without file seam", () => {
    const registry = createCommandRegistry(createDefaultPowerCommands());
    const ctx = {
      editor: {
        insertBlocks: () => undefined,
        updateBlock: () => undefined,
        getTextCursorPosition: () => ({ block: { id: "b1" } }),
        transact: <T>(fn: () => T) => fn()
      }
    };
    expect(registry.list("slash", ctx).some((c) => c.id === "media.insert-image")).toBe(false);
  });
});
