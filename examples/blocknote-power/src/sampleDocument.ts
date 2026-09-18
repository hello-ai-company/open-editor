import { createEditorDocument } from "@hello-ai-company/editor-core";

export const sampleDocument = createEditorDocument([
  {
    id: "h1",
    type: "heading",
    props: { level: 1 },
    content: [{ type: "text", text: "Workspace primitives", styles: {} }]
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
        text: "Discuss this with ",
        styles: {}
      },
      {
        type: "pageMention",
        props: { pageId: "architecture" }
      },
      {
        type: "text",
        text: ". Document stores references — hosts own pages and database rows.",
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
    id: "card1",
    type: "pageCard",
    props: {
      pageId: "architecture",
      titleHint: "Architecture"
    }
  },
  {
    id: "child1",
    type: "childPage",
    props: {
      pageId: "api-surface",
      titleHint: "API surface"
    }
  },
  {
    id: "h2c",
    type: "heading",
    props: { level: 2 },
    content: [{ type: "text", text: "Tasks (same database, three views)", styles: {} }]
  },
  {
    id: "db-table",
    type: "databaseView",
    props: {
      databaseId: "tasks",
      viewId: "main-table",
      viewType: "table",
      titleHint: "Tasks"
    }
  },
  {
    id: "db-board",
    type: "databaseView",
    props: {
      databaseId: "tasks",
      viewId: "main-board",
      viewType: "board",
      titleHint: "Tasks"
    }
  },
  {
    id: "db-calendar",
    type: "databaseView",
    props: {
      databaseId: "tasks",
      viewId: "main-calendar",
      viewType: "calendar",
      titleHint: "Tasks"
    }
  },
  {
    id: "c1",
    type: "callout",
    props: { variant: "info", title: "Portable" },
    content: [
      {
        type: "text",
        text: "databaseView props hold databaseId/viewId/viewType only — never the row array. Board grouping and Calendar cursor are ephemeral UI state.",
        styles: {}
      }
    ]
  },
  {
    id: "s1",
    type: "status",
    props: { state: "doing", label: "4F-4A" }
  }
]);
