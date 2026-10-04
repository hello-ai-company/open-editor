import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "examples/blocknote-power/test/canvas-publication.test.ts",
      "examples/blocknote-power/test/database-discovery.test.ts"
    ],
    environment: "node"
  }
});
