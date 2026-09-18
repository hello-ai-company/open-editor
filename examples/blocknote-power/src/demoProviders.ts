import type {
  BacklinkProvider,
  DatabaseFilter,
  DatabasePropertyDefinition,
  DatabasePropertySort,
  DatabaseProvider,
  DatabaseRowsPage,
  EditorPageLink,
  JsonValue,
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

type DemoRow = {
  rowKey: string;
  sortOrder: number;
  deletedAt: string | null;
  row: Record<string, JsonValue>;
};

const TASKS_SCHEMA = {
  title: "text",
  status: "status",
  score: "number",
  done: "boolean",
  start: "date",
  due: "date",
  link: "url",
  formulaPreview: "formula"
};

const TASKS_DEFINITIONS: readonly DatabasePropertyDefinition[] = [
  { id: "title", name: "Title", type: "text" },
  {
    id: "status",
    name: "Status",
    type: "status",
    options: [
      { value: "todo", label: "To do" },
      { value: "doing", label: "Doing" },
      { value: "done", label: "Done" }
    ]
  },
  { id: "score", name: "Score", type: "number" },
  { id: "done", name: "Done", type: "boolean" },
  { id: "start", name: "Start date", type: "date" },
  { id: "due", name: "Due date", type: "date" },
  { id: "link", name: "Link", type: "url" },
  {
    id: "formulaPreview",
    name: "Formula preview",
    type: "unknown",
    readOnly: true,
    rawType: "formula"
  }
];

function cellEmpty(value: JsonValue | undefined): boolean {
  return value === null || value === undefined || value === "";
}

function matchesFilter(
  row: DemoRow,
  filter: DatabaseFilter
): boolean {
  const raw = row.row[filter.propertyId];
  if (filter.operator === "isEmpty") return cellEmpty(raw);
  if (filter.operator === "isNotEmpty") return !cellEmpty(raw);

  if (filter.propertyType === "text" || filter.propertyType === "url") {
    const text = String(raw ?? "");
    if (filter.operator === "contains") {
      return text.toLowerCase().includes(filter.value.toLowerCase());
    }
    if (filter.operator === "equals") return text === filter.value;
    if (filter.operator === "notEquals") return text !== filter.value;
  }
  if (filter.propertyType === "number") {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) return false;
    if (filter.operator === "equals") return n === filter.value;
    if (filter.operator === "gt") return n > filter.value;
    if (filter.operator === "gte") return n >= filter.value;
    if (filter.operator === "lt") return n < filter.value;
    if (filter.operator === "lte") return n <= filter.value;
  }
  if (filter.propertyType === "boolean") {
    const b = raw === true || raw === "true" || raw === 1;
    return filter.operator === "is" ? b === filter.value : false;
  }
  if (filter.propertyType === "date") {
    const d = String(raw ?? "");
    if (filter.operator === "on") return d === filter.value;
    if (filter.operator === "before") return d !== "" && d < filter.value;
    if (filter.operator === "after") return d !== "" && d > filter.value;
  }
  if (filter.propertyType === "select" || filter.propertyType === "status") {
    const v = String(raw ?? "");
    if (filter.operator === "equals") return v === filter.value;
    if (filter.operator === "notEquals") return v !== filter.value;
  }
  return true;
}

function compareProperty(
  a: DemoRow,
  b: DemoRow,
  sort: DatabasePropertySort
): number {
  const av = a.row[sort.propertyId];
  const bv = b.row[sort.propertyId];
  let cmp = 0;
  if (typeof av === "number" && typeof bv === "number") {
    cmp = av - bv;
  } else if (typeof av === "boolean" && typeof bv === "boolean") {
    cmp = Number(av) - Number(bv);
  } else {
    cmp = String(av ?? "").localeCompare(String(bv ?? ""));
  }
  return sort.direction === "desc" ? -cmp : cmp;
}

/**
 * In-memory DatabaseProvider with typed metadata, filters, property sort,
 * pagination, trash, CRUD, and reorder (Phase 4F-3B demo).
 */
export function createDemoDatabaseProvider(): DatabaseProvider {
  let seq = 0;
  const nextKey = () => {
    seq += 1;
    return `task-${seq}`;
  };

  const seed: DemoRow[] = [
    {
      rowKey: nextKey(),
      sortOrder: 0,
      deletedAt: null,
      row: {
        title: "Outline power UX",
        status: "done",
        score: 9,
        done: true,
        start: "2026-08-28",
        due: "2026-09-01",
        link: "https://example.com/ux",
        formulaPreview: "score * 2"
      }
    },
    {
      rowKey: nextKey(),
      sortOrder: 1,
      deletedAt: null,
      row: {
        title: "Ship workspace primitives",
        status: "doing",
        score: 7,
        done: false,
        start: "2026-09-05",
        due: "2026-09-10",
        link: "",
        formulaPreview: "score * 2"
      }
    },
    {
      rowKey: nextKey(),
      sortOrder: 2,
      deletedAt: null,
      row: {
        title: "Wire Personal AI host",
        status: "todo",
        score: 4,
        done: false,
        start: "2026-09-15",
        due: "2026-09-20",
        link: "https://example.com/host",
        formulaPreview: "score * 2"
      }
    },
    {
      rowKey: nextKey(),
      sortOrder: 3,
      deletedAt: null,
      row: {
        title: "Database table engine",
        status: "doing",
        score: 8,
        done: false,
        start: "2026-09-08",
        due: "2026-09-12",
        link: "",
        formulaPreview: "score * 2"
      }
    },
    {
      rowKey: nextKey(),
      sortOrder: 4,
      deletedAt: null,
      row: {
        title: "Pagination smoke row",
        status: "todo",
        score: 2,
        done: false,
        start: "2026-09-20",
        due: "2026-09-25",
        link: "",
        formulaPreview: "score * 2"
      }
    },
    {
      rowKey: nextKey(),
      sortOrder: 5,
      deletedAt: null,
      row: {
        title: "Reorder smoke row",
        status: "todo",
        score: 3,
        done: false,
        start: "2026-09-25",
        due: "2026-09-30",
        link: "",
        formulaPreview: "score * 2"
      }
    },
    {
      rowKey: nextKey(),
      sortOrder: 6,
      deletedAt: null,
      row: {
        title: "Unassigned status card",
        status: "",
        score: 1,
        done: false,
        start: "2026-09-16",
        due: "2026-09-18",
        link: "",
        formulaPreview: "score * 2"
      }
    },
    {
      rowKey: nextKey(),
      sortOrder: 7,
      deletedAt: null,
      row: {
        title: "Legacy status value",
        status: "legacy-state",
        score: 1,
        done: false,
        start: "2026-09-01",
        due: "2026-09-05",
        link: "",
        formulaPreview: "score * 2"
      }
    },
    {
      rowKey: nextKey(),
      sortOrder: 8,
      deletedAt: null,
      row: {
        title: "Invalid date row",
        status: "todo",
        score: 0,
        done: false,
        start: "2026-09-18",
        due: "09/18/2026",
        link: "",
        formulaPreview: "score * 2"
      }
    },
    {
      rowKey: nextKey(),
      sortOrder: 9,
      deletedAt: null,
      row: {
        title: "No date row",
        status: "doing",
        score: 0,
        done: false,
        start: "",
        due: "",
        link: "",
        formulaPreview: "score * 2"
      }
    }
  ];

  const rowsByDb = new Map<string, DemoRow[]>([["tasks", seed]]);

  function rowsFor(databaseId: string): DemoRow[] {
    return rowsByDb.get(databaseId) ?? [];
  }

  function titleOf(row: DemoRow): string {
    return String(row.row.title ?? row.rowKey);
  }

  return {
    async getDatabase(databaseId) {
      if (!rowsByDb.has(databaseId)) return null;
      return {
        id: databaseId,
        title: databaseId === "tasks" ? "Tasks" : databaseId,
        propertyDefinitions: [...TASKS_DEFINITIONS],
        queryCapabilities: {
          propertyFilters: true,
          propertySort: true
        },
        views: [
          { id: "main-table", title: "Table", viewType: "table" },
          { id: "main-board", title: "Board", viewType: "board" },
          { id: "main-calendar", title: "Calendar", viewType: "calendar" },
          { id: "main-list", title: "List", viewType: "list" },
          { id: "main-gallery", title: "Gallery", viewType: "gallery" },
          { id: "main-timeline", title: "Timeline", viewType: "timeline" },
          { id: "main-gantt", title: "Gantt", viewType: "gantt" }
        ]
      };
    },

    async listRows(databaseId, options): Promise<DatabaseRowsPage> {
      const all = rowsFor(databaseId);
      const trashedOnly = Boolean(options?.trashedOnly);
      const includeTrashed = Boolean(options?.includeTrashed);
      let filtered = all.filter((row) => {
        if (trashedOnly) return row.deletedAt != null;
        if (includeTrashed) return true;
        return row.deletedAt == null;
      });

      const q = options?.query?.trim().toLowerCase();
      if (q) {
        filtered = filtered.filter(
          (row) =>
            titleOf(row).toLowerCase().includes(q) ||
            row.rowKey.toLowerCase().includes(q) ||
            String(row.row.status ?? "")
              .toLowerCase()
              .includes(q)
        );
      }

      // Host executes structured AND filters (not client-side on loaded page only).
      const filters = options?.filters ?? [];
      if (filters.length > 0) {
        filtered = filtered.filter((row) =>
          filters.every((filter) => matchesFilter(row, filter))
        );
      }

      if (options?.propertySort) {
        filtered = [...filtered].sort((a, b) =>
          compareProperty(a, b, options.propertySort!)
        );
      } else {
        const sortBy = options?.sortBy ?? "position";
        const direction = options?.direction ?? "asc";
        filtered = [...filtered].sort((a, b) => {
          let cmp = 0;
          if (sortBy === "title") {
            cmp = titleOf(a).localeCompare(titleOf(b));
          } else {
            cmp = a.sortOrder - b.sortOrder;
          }
          return direction === "desc" ? -cmp : cmp;
        });
      }

      const limit = options?.limit ?? 3;
      const start = options?.cursor
        ? Math.max(
            0,
            filtered.findIndex((row) => row.rowKey === options.cursor) + 1
          )
        : 0;
      const slice = filtered.slice(start, start + limit);
      const next =
        start + limit < filtered.length
          ? (slice[slice.length - 1]?.rowKey ?? null)
          : null;

      return {
        databaseId,
        rows: slice.map((row) => row.row),
        items: slice.map((row) => ({
          rowKey: row.rowKey,
          sortOrder: row.sortOrder,
          deletedAt: row.deletedAt,
          row: { ...row.row }
        })),
        schema: { ...TASKS_SCHEMA },
        config: {},
        pagination: {
          limit,
          nextCursor: next,
          hasMore: next !== null,
          total: filtered.length
        }
      };
    },

    async createRow(databaseId, row) {
      const list = rowsFor(databaseId);
      if (!rowsByDb.has(databaseId)) rowsByDb.set(databaseId, list);
      const created: DemoRow = {
        rowKey: nextKey(),
        sortOrder: list.reduce((max, r) => Math.max(max, r.sortOrder), -1) + 1,
        deletedAt: null,
        row: { ...row }
      };
      list.push(created);
      return { rowKey: created.rowKey };
    },

    async updateRow(databaseId, rowKey, row, sortOrder) {
      const hit = rowsFor(databaseId).find((entry) => entry.rowKey === rowKey);
      if (!hit) throw new Error("Row not found");
      hit.row = { ...row };
      if (typeof sortOrder === "number") hit.sortOrder = sortOrder;
      return { ok: true };
    },

    async deleteRow(databaseId, rowKey) {
      const hit = rowsFor(databaseId).find((entry) => entry.rowKey === rowKey);
      if (!hit) throw new Error("Row not found");
      hit.deletedAt = new Date().toISOString();
      return { ok: true };
    },

    async restoreRow(databaseId, rowKey) {
      const hit = rowsFor(databaseId).find((entry) => entry.rowKey === rowKey);
      if (!hit) throw new Error("Row not found");
      hit.deletedAt = null;
      return { ok: true };
    },

    async reorderRows(databaseId, rowKeys) {
      const list = rowsFor(databaseId);
      const byKey = new Map(list.map((row) => [row.rowKey, row]));
      rowKeys.forEach((key, index) => {
        const row = byKey.get(key);
        if (row) row.sortOrder = index;
      });
      return { ok: true };
    }
  };
}

export function createDemoBacklinkProvider(
  targetPageId: string
): BacklinkProvider {
  return {
    async listBacklinks(query) {
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
