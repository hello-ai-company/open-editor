import type {
  BacklinkProvider,
  DatabaseProvider,
  DatabaseRowsPage,
  EditorPageLink,
  PageProvider
} from "@hello-ai-company/editor-core";

export type DemoPageStore = {
  pages: EditorPageLink[];
  provider: PageProvider;
  subscribe: (listener: () => void) => () => void;
  bump: () => void;
  rename: (pageId: string, title: string) => void;
  remove: (pageId: string) => EditorPageLink | null;
  restore: (page: EditorPageLink) => void;
};

export function createDemoPageStore(
  seed: EditorPageLink[],
  onOpen?: (pageId: string) => void
): DemoPageStore {
  const pages = [...seed];
  const listeners = new Set<() => void>();
  const bump = () => {
    for (const listener of listeners) listener();
  };
  const provider: PageProvider = {
    async listLinks(excludePageId) {
      return pages.filter((page) => page.id !== excludePageId);
    },
    async searchPages(query, options) {
      const q = query.trim().toLowerCase();
      return pages
        .filter((page) => page.id !== options?.excludePageId)
        .filter(
          (page) =>
            !q ||
            page.title.toLowerCase().includes(q) ||
            page.id.toLowerCase().includes(q)
        )
        .slice(0, options?.limit ?? 40);
    },
    async getPage(pageId) {
      return pages.find((page) => page.id === pageId) ?? null;
    },
    async createChildPage(options) {
      const created: EditorPageLink = {
        id: `child-${crypto.randomUUID?.() ?? String(Date.now())}`,
        title: options?.title ?? "Untitled",
        preview: options?.parentPageId
          ? `Child of ${options.parentPageId}`
          : "New child page"
      };
      pages.push(created);
      bump();
      return created;
    },
    openPage(pageId) {
      onOpen?.(pageId);
    }
  };
  return {
    pages,
    provider,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    bump,
    rename(pageId, title) {
      const page = pages.find((entry) => entry.id === pageId);
      if (!page) return;
      page.title = title;
      bump();
    },
    remove(pageId) {
      const index = pages.findIndex((entry) => entry.id === pageId);
      if (index < 0) return null;
      const [removed] = pages.splice(index, 1);
      bump();
      return removed ?? null;
    },
    restore(page) {
      if (pages.some((entry) => entry.id === page.id)) return;
      pages.push(page);
      bump();
    }
  };
}

export function createDemoDatabaseProvider(): DatabaseProvider {
  const rowsByDb = new Map<string, Array<Record<string, string>>>([
    [
      "tasks",
      [
        { title: "Outline power UX", status: "done" },
        { title: "Ship workspace primitives", status: "doing" },
        { title: "Wire Personal AI host", status: "todo" }
      ]
    ]
  ]);

  return {
    async getDatabase(databaseId) {
      if (!rowsByDb.has(databaseId)) return null;
      return {
        id: databaseId,
        title: databaseId === "tasks" ? "Tasks" : databaseId,
        views: [
          { id: "main-table", title: "Table", viewType: "table" },
          { id: "main-board", title: "Board", viewType: "board" }
        ]
      };
    },
    async listRows(databaseId, options): Promise<DatabaseRowsPage> {
      const list = rowsByDb.get(databaseId) ?? [];
      const items = list.map((row, index) => ({
        rowKey: `r${index}`,
        sortOrder: index,
        row
      }));
      return {
        databaseId,
        rows: list,
        items,
        schema: { title: "text", status: "select" },
        config: {},
        pagination: {
          limit: options?.limit ?? 50,
          nextCursor: null,
          hasMore: false,
          total: list.length
        }
      };
    }
  };
}

export function createDemoBacklinkProvider(
  targetPageId: string
): BacklinkProvider {
  return {
    async listBacklinks(query) {
      // Simulate latency so loading state is visible
      await new Promise((r) => setTimeout(r, 40));
      if (query.targetType !== "page" || query.targetId !== targetPageId) {
        return [];
      }
      return [
        {
          sourceDocumentId: "notes/specs",
          sourceTitle: "Specs",
          kind: "page-reference"
        },
        {
          sourceDocumentId: "notes/meeting",
          sourceTitle: "Meeting Notes",
          kind: "page-reference"
        }
      ];
    }
  };
}
