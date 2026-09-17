/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import {
  applyBlockReferenceLabel,
  bindBlockReferenceRuntimeToIndex,
  createBlockReferenceInlineContentSpec,
  createBlockReferenceResolverFromIndex,
  formatBlockReferenceLabel,
  BLOCK_REFERENCE_TYPE,
  createBlockReferenceDom,
  type BlockReferenceRuntime
} from "../src/references/blockReference.js";
import { createOpenEditorBlockNoteSchema } from "../src/schema/createOpenEditorBlockNoteSchema.js";
import { fromBlockNote, toBlockNoteForSchema } from "../src/index.js";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createDocumentIndex } from "../src/index/documentIndex.js";
import { createOpenEditorPowerPreset } from "../src/features/compose.js";
import {
  createCommandRegistry,
  createDefaultPowerCommands
} from "../src/commands/registry.js";

describe("block references", () => {
  it("registers blockReference inline content on schema", () => {
    const schema = createOpenEditorBlockNoteSchema({
      inlineContentSpecs: {
        blockReference: createBlockReferenceInlineContentSpec()
      }
    });
    expect(schema.inlineContentSchema).toHaveProperty(BLOCK_REFERENCE_TYPE);
  });

  it("omits blockReference from preset when includeBlockReference is false", () => {
    const withRef = createOpenEditorPowerPreset();
    const withoutRef = createOpenEditorPowerPreset({
      includeBlockReference: false
    });
    expect(withRef.schema.inlineContentSchema).toHaveProperty(
      BLOCK_REFERENCE_TYPE
    );
    expect(withoutRef.schema.inlineContentSchema).not.toHaveProperty(
      BLOCK_REFERENCE_TYPE
    );
  });

  it("formats missing and valid targets", () => {
    const missing = formatBlockReferenceLabel("x", () => null);
    expect(missing.missing).toBe(true);

    const ok = formatBlockReferenceLabel("a", (id) =>
      id === "a" ? { title: "Architecture" } : null
    );
    expect(ok.label).toBe("Architecture");
    expect(ok.missing).toBe(false);
  });

  it("resolves human-readable titles from DocumentIndex", () => {
    const index = createDocumentIndex();
    index.replaceFromBlocks([
      {
        id: "h1",
        type: "heading",
        props: { level: 1 } as never,
        content: [{ type: "text", text: "Architecture", styles: {} }]
      }
    ]);
    const resolve = createBlockReferenceResolverFromIndex(index);
    expect(resolve("h1")).toEqual({ title: "Architecture" });
    expect(resolve("missing")?.missing).toBe(true);
  });

  it("renders resolved label and wires click navigate", () => {
    const onNavigate = vi.fn();
    const runtime = {
      resolve: (id: string) =>
        id === "h1" ? { title: "Architecture" } : { title: "", missing: true },
      onNavigate
    };
    const dom = createBlockReferenceDom("h1", runtime);
    expect(dom.textContent).toBe("→ Architecture");
    expect(dom.dataset.missing).toBe("false");
    dom.click();
    expect(onNavigate).toHaveBeenCalledWith("h1");
  });

  it("live-updates label when target is renamed then deleted", () => {
    const index = createDocumentIndex();
    const initial = {
      id: "h1",
      type: "heading",
      props: { level: 1 } as never,
      content: [{ type: "text", text: "Architecture", styles: {} }]
    };
    index.replaceFromBlocks([initial]);

    const runtime: BlockReferenceRuntime = {};
    bindBlockReferenceRuntimeToIndex(runtime, index);

    const dom = createBlockReferenceDom("h1", runtime);
    expect(dom.textContent).toBe("→ Architecture");
    expect(dom.dataset.missing).toBe("false");

    const renamed = {
      id: "h1",
      type: "heading",
      props: { level: 1 } as never,
      content: [
        { type: "text", text: "System Architecture", styles: {} }
      ]
    };
    index.applyChanges([
      {
        type: "update",
        blockId: "h1",
        block: renamed,
        prevBlock: initial,
        source: "local"
      }
    ]);
    expect(dom.textContent).toBe("→ System Architecture");
    expect(dom.dataset.missing).toBe("false");

    index.applyChanges([
      {
        type: "delete",
        blockId: "h1",
        block: renamed,
        source: "local"
      }
    ]);
    expect(dom.textContent).toBe("→ Missing block");
    expect(dom.dataset.missing).toBe("true");
  });

  it("applyBlockReferenceLabel refreshes without recreating the node", () => {
    const titles = new Map([["h1", "Architecture"]]);
    const runtime: BlockReferenceRuntime = {
      resolve: (id) => {
        const title = titles.get(id);
        if (!title) return { title: "", missing: true };
        return { title };
      }
    };
    const dom = createBlockReferenceDom("h1", runtime);
    expect(dom.textContent).toBe("→ Architecture");
    titles.set("h1", "System Architecture");
    applyBlockReferenceLabel(dom, "h1", runtime);
    expect(dom.textContent).toBe("→ System Architecture");
  });

  it("round-trips a paragraph containing a reference through EditorDocument", () => {
    const schema = createOpenEditorBlockNoteSchema({
      inlineContentSpecs: {
        blockReference: createBlockReferenceInlineContentSpec()
      }
    });
    const doc = createEditorDocument([
      {
        id: "p1",
        type: "paragraph",
        content: [
          {
            type: "blockReference",
            props: { blockId: "target-1" }
          }
        ]
      }
    ]);
    const bn = toBlockNoteForSchema(doc, schema);
    const back = fromBlockNote(bn as never);
    const content = back.blocks[0]?.content;
    expect(JSON.stringify(content)).toContain("blockReference");
    expect(JSON.stringify(content)).toContain("target-1");
  });

  it("disables insert.reference without requestBlockPick even when index exists", async () => {
    const index = createDocumentIndex();
    index.replaceFromBlocks([
      {
        id: "h1",
        type: "heading",
        props: { level: 1 } as never,
        content: [{ type: "text", text: "Architecture", styles: {} }]
      }
    ]);
    const insertInlineContent = vi.fn();
    const registry = createCommandRegistry(createDefaultPowerCommands());
    const command = registry.get("block.insert.reference")!;
    const ctx = {
      editor: {
        insertBlocks: vi.fn(),
        updateBlock: () => undefined,
        getTextCursorPosition: () => ({
          block: { id: "current", type: "paragraph" }
        }),
        insertInlineContent,
        transact: <T>(fn: () => T) => fn()
      },
      documentIndex: index
    };
    const enabled = command.isEnabled?.(ctx as never);
    expect(enabled).toEqual({
      ok: false,
      reason: "Block picker not available"
    });
    await expect(registry.run("block.insert.reference", ctx as never)).rejects.toThrow(
      /Block picker not available/
    );
    expect(insertInlineContent).not.toHaveBeenCalled();
  });
});
