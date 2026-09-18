import { describe, expect, it, vi } from "vitest";
import type {
  DatabaseProvider,
  EditorPageLink,
  PageProvider
} from "../src/providers.js";

function createMemoryPageProvider(
  seed: EditorPageLink[]
): PageProvider & { pages: EditorPageLink[] } {
  const pages = [...seed];
  return {
    pages,
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
        .slice(0, options?.limit ?? 50);
    },
    async getPage(pageId) {
      return pages.find((page) => page.id === pageId) ?? null;
    },
    async createPage(options) {
      const created = {
        id: `page-${pages.length + 1}`,
        title: options?.title ?? "Untitled"
      };
      pages.push(created);
      return created;
    },
    async createChildPage(options) {
      const created = {
        id: `child-${pages.length + 1}`,
        title: options?.title ?? "Untitled",
        preview: options?.parentPageId
          ? `Child of ${options.parentPageId}`
          : undefined
      };
      pages.push(created);
      return created;
    },
    openPage: vi.fn()
  };
}

function createMemoryDatabaseProvider(): DatabaseProvider & {
  rows: Map<string, Array<Record<string, string>>>;
} {
  const rows = new Map<string, Array<Record<string, string>>>([
    [
      "tasks",
      [
        { title: "Ship 4F-2B", status: "doing" },
        { title: "Write docs", status: "todo" }
      ]
    ]
  ]);
  return {
    rows,
    async getDatabase(databaseId) {
      if (!rows.has(databaseId)) return null;
      return {
        id: databaseId,
        title: databaseId === "tasks" ? "Tasks" : databaseId,
        views: [
          { id: "main-table", viewType: "table" },
          { id: "main-board", viewType: "board" }
        ]
      };
    },
    async listRows(databaseId, options) {
      const list = rows.get(databaseId) ?? [];
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
    },
    async createRow(databaseId, row) {
      const list = rows.get(databaseId) ?? [];
      list.push(row as Record<string, string>);
      rows.set(databaseId, list);
      return row;
    }
  };
}

describe("memory page/database providers", () => {
  it("searches, resolves, navigates, and creates children outside the document", async () => {
    const pages = createMemoryPageProvider([
      { id: "arch", title: "Architecture", preview: "System notes" }
    ]);
    const child = await pages.createChildPage!({
      parentPageId: "arch",
      title: "API"
    });
    expect(child?.id).toBeTruthy();
    expect(pages.pages.some((page) => page.id === child?.id)).toBe(true);
    pages.openPage?.("arch");
    expect(pages.openPage).toHaveBeenCalledWith("arch");
  });

  it("keeps database mutations in the provider, not in document props", async () => {
    const database = createMemoryDatabaseProvider();
    const page = await database.listRows!("tasks");
    expect(page.items).toHaveLength(2);
    await database.createRow!("tasks", { title: "Review", status: "todo" });
    const again = await database.listRows!("tasks");
    expect(again.items).toHaveLength(3);
    // Document-shaped props stay reference-only
    const viewProps = {
      databaseId: "tasks",
      viewId: "main-table",
      viewType: "table"
    };
    expect(JSON.stringify(viewProps)).not.toContain("Ship 4F-2B");
    expect(await database.getDatabase!("tasks")).toEqual(
      expect.objectContaining({ id: "tasks", title: "Tasks" })
    );
  });
});
