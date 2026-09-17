import { createEditorDocument } from "@hello-ai-company/editor-core";

export const sampleDocument = createEditorDocument([
  {
    id: "h1",
    type: "heading",
    props: { level: 1 },
    content: [{ type: "text", text: "OpenEditor power layer", styles: {} }]
  },
  {
    id: "p1",
    type: "paragraph",
    content: [
      {
        type: "text",
        text: "Type / for slash commands or press Mod+K for the palette. Callout and status are first-class power blocks.",
        styles: {}
      }
    ]
  },
  {
    id: "c1",
    type: "callout",
    props: { variant: "info", title: "Portable" },
    content: [
      {
        type: "text",
        text: "Save as EditorDocument via editor-core — not per keystroke.",
        styles: {}
      }
    ]
  },
  {
    id: "s1",
    type: "status",
    props: { state: "doing", label: "Foundation" }
  }
]);
