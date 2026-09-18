import { createEditorDocument } from "@hello-ai-company/editor-core";

export const sampleDocument = createEditorDocument([
  {
    id: "h1",
    type: "heading",
    props: { level: 1 },
    content: [{ type: "text", text: "Document", styles: {} }]
  },
  {
    id: "h2a",
    type: "heading",
    props: { level: 2 },
    content: [{ type: "text", text: "Introduction", styles: {} }]
  },
  {
    id: "p1",
    type: "paragraph",
    content: [
      {
        type: "text",
        text: "Start writing. Use / for slash commands, ⌘K for commands, ⌘P to jump. Outline updates from incremental changes — not full-document serialize.",
        styles: {}
      }
    ]
  },
  {
    id: "h3a",
    type: "heading",
    props: { level: 3 },
    content: [{ type: "text", text: "Goals", styles: {} }]
  },
  {
    id: "p2",
    type: "paragraph",
    content: [
      {
        type: "text",
        text: "Keyboard-first power UX on BlockNote without XL packages.",
        styles: {}
      }
    ]
  },
  {
    id: "h2b",
    type: "heading",
    props: { level: 2 },
    content: [{ type: "text", text: "Architecture", styles: {} }]
  },
  {
    id: "c1",
    type: "callout",
    props: { variant: "info", title: "Portable" },
    content: [
      {
        type: "text",
        text: "Save as EditorDocument via editor-core when you choose — not per keystroke.",
        styles: {}
      }
    ]
  },
  {
    id: "h3b",
    type: "heading",
    props: { level: 3 },
    content: [{ type: "text", text: "Commands", styles: {} }]
  },
  {
    id: "s1",
    type: "status",
    props: { state: "doing", label: "Power UX" }
  }
]);
