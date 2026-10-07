import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Source unit tests run before builds; isolated consumers check packed exports.
    alias: [
      { find: /^@hello-ai-company\/editor-ai$/, replacement: fileURLToPath(new URL("../../packages/ai/src/index.ts", import.meta.url)) },
      { find: /^@hello-ai-company\/editor-core$/, replacement: fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)) },
      { find: /^@hello-ai-company\/editor-canvas$/, replacement: fileURLToPath(new URL("../../packages/canvas/src/index.ts", import.meta.url)) }
    ]
  },
  test: {
    include: [
      "examples/blocknote-power/test/contextual-quiet-fixture.test.ts",
      "examples/blocknote-power/test/note-organization.test.ts",
      "examples/blocknote-power/test/canvas-publication.test.ts",
      "examples/blocknote-power/test/database-discovery.test.ts",
      "examples/blocknote-power/test/decorative-motion.test.ts",
      "examples/blocknote-power/test/document-store.test.ts",
      "examples/blocknote-power/test/personal-ai-contract.test.ts",
      "examples/blocknote-power/test/synthetic-ahead.test.ts"
    ],
    environment: "node"
  }
});
