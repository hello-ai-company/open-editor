/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import {
  createBlockActionCommands,
  createBlockReferenceCommands,
  createCommandRegistry
} from "../src/commands/registry.js";
import { toPartialBlockCopy } from "../src/commands/blockCopy.js";

describe("block actions losslessness", () => {
  it("toPartialBlockCopy preserves type/props/content/children and drops id", () => {
    const copy = toPartialBlockCopy({
      id: "original",
      type: "callout",
      props: { variant: "warning", title: "Careful" },
      content: [{ type: "text", text: "body", styles: { bold: true } }],
      children: [
        {
          id: "child",
          type: "paragraph",
          content: [{ type: "text", text: "nested", styles: {} }]
        }
      ]
    });
    expect(copy).not.toHaveProperty("id");
    expect(copy.type).toBe("callout");
    expect(copy.props).toEqual({ variant: "warning", title: "Careful" });
    expect(copy.content).toEqual([
      { type: "text", text: "body", styles: { bold: true } }
    ]);
    expect(copy.children).toHaveLength(1);
    expect((copy.children as unknown[])[0]).not.toHaveProperty("id");
  });

  it("duplicate inserts a lossless PartialBlock copy", () => {
    const insertBlocks = vi.fn();
    const source = {
      id: "src",
      type: "callout",
      props: { variant: "info" },
      content: [{ type: "text", text: "hello", styles: {} }],
      children: []
    };
    const registry = createCommandRegistry(createBlockActionCommands());
    void registry.run("block.duplicate", {
      editor: {
        insertBlocks,
        updateBlock: () => undefined,
        getTextCursorPosition: () => ({ block: source }),
        transact: <T>(fn: () => T) => fn()
      }
    });
    expect(insertBlocks).toHaveBeenCalledTimes(1);
    const [blocks, reference, placement] = insertBlocks.mock.calls[0]!;
    expect(placement).toBe("after");
    expect(reference).toBe(source);
    expect(blocks[0]).toMatchObject({
      type: "callout",
      props: { variant: "info" },
      content: [{ type: "text", text: "hello", styles: {} }]
    });
    expect(blocks[0]).not.toHaveProperty("id");
  });

  it("move up/down use BlockNote moveBlocksUp/Down APIs", () => {
    const moveBlocksUp = vi.fn();
    const moveBlocksDown = vi.fn();
    const block = { id: "b1", type: "paragraph" };
    const registry = createCommandRegistry(createBlockActionCommands());
    const ctx = {
      editor: {
        insertBlocks: vi.fn(),
        updateBlock: () => undefined,
        removeBlocks: vi.fn(),
        getTextCursorPosition: () => ({ block }),
        moveBlocksUp,
        moveBlocksDown,
        transact: <T>(fn: () => T) => fn()
      }
    };
    void registry.run("block.move-up", ctx);
    void registry.run("block.move-down", ctx);
    expect(moveBlocksUp).toHaveBeenCalledWith(block);
    expect(moveBlocksDown).toHaveBeenCalledWith(block);
    expect(ctx.editor.insertBlocks).not.toHaveBeenCalled();
    expect(ctx.editor.removeBlocks).not.toHaveBeenCalled();
  });

  it("block reference picks a different target and uses insertInlineContent", async () => {
    const insertInlineContent = vi.fn();
    const requestBlockPick = vi.fn(async () => "target-heading");
    const registry = createCommandRegistry(createBlockReferenceCommands());
    await registry.run("block.insert.reference", {
      editor: {
        insertBlocks: vi.fn(),
        updateBlock: () => undefined,
        getTextCursorPosition: () => ({
          block: { id: "current", type: "paragraph" }
        }),
        insertInlineContent,
        transact: <T>(fn: () => T) => fn()
      },
      requestBlockPick
    });
    expect(requestBlockPick).toHaveBeenCalled();
    expect(insertInlineContent).toHaveBeenCalledWith([
      { type: "blockReference", props: { blockId: "target-heading" } }
    ]);
  });
});
