import { expect, it } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { contextualQuietFixture } from "../src/contextualQuietFixture.js";
it("changes the synthetic suggestion with the actual heading, without evaluating instructions from body text", () => {
  const first = createEditorDocument([{ id: "h", type: "heading", content: "旅行計画" }]), second = createEditorDocument([{ id: "h", type: "heading", content: "採用計画" }]);
  const a = contextualQuietFixture(first, "run-a"), b = contextualQuietFixture(second, "run-b");
  expect(a.hypothesis).toContain("旅行計画"); expect(b.hypothesis).toContain("採用計画");
  expect(a.group.changes[0]!.block.content).not.toEqual(b.group.changes[0]!.block.content);
  expect(a.group.baseDocument).toEqual(first); expect(first.blocks).toHaveLength(1);
});
