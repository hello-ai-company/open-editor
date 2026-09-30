import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "@blocknote/core",
      "@blocknote/react",
      "@blocknote/mantine",
      "@tiptap/pm",
      "prosemirror-state",
      "prosemirror-view"
    ]
  },
  server: { port: 5173 }
});
