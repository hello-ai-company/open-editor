import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
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
