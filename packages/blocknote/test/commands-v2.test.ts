import { describe, expect, it } from "vitest";
import {
  createCommandRegistry,
  createDefaultPowerCommands
} from "../src/commands/registry.js";
import { filterAndRankCommands, scoreCommand } from "../src/commands/match.js";

const ctx = {
  editor: {
    insertBlocks: () => undefined,
    updateBlock: () => undefined,
    getTextCursorPosition: () => ({ block: { id: "b1", type: "paragraph" } }),
    transact: <T>(fn: () => T) => fn()
  }
};

describe("command matching V2", () => {
  it("ranks keyword and alias matches", () => {
    const commands = createDefaultPowerCommands();
    const callout = commands.find((c) => c.id === "block.insert.callout")!;
    const paragraph = commands.find((c) => c.id === "block.insert.paragraph")!;
    expect(scoreCommand(callout, { query: "注意" })).toBeGreaterThan(
      scoreCommand(paragraph, { query: "注意" })
    );
    expect(scoreCommand(callout, { query: "callout" })).toBeGreaterThan(0);
  });

  it("boosts recently used commands", () => {
    const commands = createDefaultPowerCommands();
    const ranked = filterAndRankCommands(commands, {
      query: "",
      recentIds: ["block.insert.status"]
    });
    expect(ranked[0]?.id).toBe("block.insert.status");
  });

  it("shares registry across slash and palette surfaces", () => {
    const registry = createCommandRegistry(createDefaultPowerCommands());
    const slash = registry.list("slash", ctx as never, "callout");
    const palette = registry.list("palette", ctx as never, "callout");
    expect(slash.some((c) => c.id === "block.insert.callout")).toBe(true);
    expect(palette.some((c) => c.id === "block.insert.callout")).toBe(true);
  });

  it("exposes disabled reasons on palette items", async () => {
    const registry = createCommandRegistry([
      {
        id: "x.disabled",
        title: "Disabled",
        group: "advanced",
        surfaces: ["palette"],
        isEnabled: () => ({ ok: false, reason: "Need plan" }),
        run: () => undefined
      }
    ]);
    const items = registry.toPaletteItems(ctx as never, "");
    expect(items[0]?.disabledReason).toBe("Need plan");
  });
});
