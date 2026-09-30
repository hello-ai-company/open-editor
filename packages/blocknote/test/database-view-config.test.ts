import { describe, expect, it, vi } from "vitest";
import type { DatabaseProvider, DatabaseRowsPage, EditorDatabase } from "@hello-ai-company/editor-core";
import type { DatabaseViewType } from "../src/workspace/types.js";
import {
  createDatabaseViewConfigWriter,
  createDefaultDatabaseViewConfig,
  listDatabaseViewConfigIdentities,
  loadDatabaseViewHydration,
  patchDatabaseViewConfig,
  validateDatabaseViewConfig,
  type DatabaseViewConfigProvider,
  type DatabaseViewConfig
} from "../src/workspace/databaseViewConfig.js";
import {
  createDatabaseRuntimeStore,
  databaseViewInstanceKey
} from "../src/workspace/databaseRuntimeStore.js";

const metadata: EditorDatabase = {
  id: "db-1",
  title: "Work",
  propertyDefinitions: [
    { id: "status", name: "Status", type: "status", options: [{ value: "open" }, { value: "done" }] },
    { id: "due", name: "Due", type: "date" },
    { id: "amount", name: "Amount", type: "number" },
    { id: "kind", name: "Kind", type: "select", options: [{ value: "a" }] }
  ],
  queryCapabilities: { propertyFilters: true, propertySort: true }
};

function savedConfig(): DatabaseViewConfig {
  return {
    ...createDefaultDatabaseViewConfig({ databaseId: "db-1", viewId: "work", viewType: "calendar" }),
    query: "urgent",
    sortBy: "title",
    direction: "desc",
    filters: [{ propertyId: "status", propertyType: "status", operator: "equals", value: "done" }],
    propertySort: { propertyId: "due", direction: "asc" },
    calendar: { datePropertyId: "due", scale: "week" }
  };
}

describe("DatabaseViewConfig validation", () => {
  it("accepts bounded settings and verifies property types against host metadata", () => {
    const result = validateDatabaseViewConfig({
      value: savedConfig(),
      databaseId: "db-1",
      viewId: "work",
      viewType: "calendar",
      database: metadata
    });
    expect(result.valid).toBe(true);
    expect(result.config).toMatchObject({
      query: "urgent",
      filters: [{ propertyId: "status", value: "done" }],
      propertySort: { propertyId: "due", direction: "asc" },
      calendar: { datePropertyId: "due", scale: "week" }
    });
  });

  it("restores each renderer's property selectors only for eligible host fields", () => {
    const input = (viewType: DatabaseViewType) => ({
      ...createDefaultDatabaseViewConfig({ databaseId: "db-1", viewId: viewType, viewType }),
      board: { groupPropertyId: "status" },
      calendar: { datePropertyId: "due", scale: "week" as const },
      timeline: { datePropertyId: "due" },
      gantt: { startPropertyId: "due", endPropertyId: "due" },
      chart: { metricPropertyId: "amount" },
      feed: { datePropertyId: "due" },
      dashboard: { categoricalPropertyId: "kind", numericPropertyId: "amount", datePropertyId: "due" }
    });
    const types: DatabaseViewType[] = ["board", "calendar", "timeline", "gantt", "chart", "feed", "dashboard"];
    for (const viewType of types) {
      const result = validateDatabaseViewConfig({
        value: input(viewType),
        databaseId: "db-1",
        viewId: viewType,
        viewType,
        database: metadata
      });
      expect(result.valid).toBe(true);
      expect(result.config).toMatchObject({
        board: { groupPropertyId: "status" },
        calendar: { datePropertyId: "due", scale: "week" },
        timeline: { datePropertyId: "due" },
        gantt: { startPropertyId: "due", endPropertyId: "due" },
        chart: { metricPropertyId: "amount" },
        feed: { datePropertyId: "due" },
        dashboard: { categoricalPropertyId: "kind", numericPropertyId: "amount", datePropertyId: "due" }
      });
    }
  });

  it("rejects identity/schema pollution and clears invalid property-bound choices", () => {
    const polluted = { ...savedConfig(), rows: [{ rowKey: "private" }] };
    const invalid = validateDatabaseViewConfig({
      value: polluted,
      databaseId: "db-1",
      viewId: "work",
      viewType: "calendar",
      database: metadata
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.config.query).toBe("");
    expect(JSON.stringify(invalid.config)).not.toContain("private");

    const stale = validateDatabaseViewConfig({
      value: {
        ...savedConfig(),
        filters: [{ propertyId: "missing", propertyType: "status", operator: "equals", value: "gone" }],
        propertySort: { propertyId: "missing", direction: "asc" },
        calendar: { datePropertyId: "amount", scale: "year" }
      },
      databaseId: "db-1",
      viewId: "work",
      viewType: "calendar",
      database: metadata
    });
    expect(stale.config.filters).toEqual([]);
    expect(stale.config.propertySort).toBeNull();
    expect(stale.config.calendar).toBeUndefined();
    expect(stale.warnings.length).toBeGreaterThan(0);
  });

  it("clears impossible date filter values", () => {
    const result = validateDatabaseViewConfig({
      value: {
        ...savedConfig(),
        filters: [{ propertyId: "due", propertyType: "date", operator: "on", value: "2026-02-31" }]
      },
      databaseId: "db-1",
      viewId: "work",
      viewType: "calendar",
      database: metadata
    });
    expect(result.config.filters).toEqual([]);
    expect(result.warnings).toContain("Saved filters were invalid and were cleared");
  });

  it("validates config identities and de-duplicates saved view IDs", async () => {
    const provider = {
      list: async () => [
        { databaseId: "db-1", viewId: "work", viewType: "calendar" },
        { databaseId: "db-1", viewId: "work", viewType: "table" },
        { databaseId: "other", viewId: "secret", viewType: "table" },
        { databaseId: "db-1", viewId: "bad", viewType: "unknown" }
      ]
    } as unknown as DatabaseViewConfigProvider;
    await expect(listDatabaseViewConfigIdentities(provider, "db-1")).resolves.toEqual([
      { databaseId: "db-1", viewId: "work", viewType: "calendar" }
    ]);
  });

  it("creates a bounded whitelist patch without allowing identity or row data injection", () => {
    const current = savedConfig();
    const patch = patchDatabaseViewConfig(current, {
      query: "q".repeat(501),
      board: { groupPropertyId: "x".repeat(257) }
    });
    expect(patch.query).toHaveLength(500);
    expect(patch.board?.groupPropertyId).toBeNull();
    expect(patch).toMatchObject({
      schemaVersion: current.schemaVersion,
      databaseId: current.databaseId,
      viewId: current.viewId,
      viewType: current.viewType
    });
    expect(JSON.stringify(patch)).not.toContain("rows");
    const polluted = patchDatabaseViewConfig(current, {
      rows: [{ rowKey: "private" }],
      databaseId: "other-db"
    } as unknown as Parameters<typeof patchDatabaseViewConfig>[1]);
    expect(polluted.databaseId).toBe(current.databaseId);
    expect(JSON.stringify(polluted)).not.toContain("private");
  });
});

describe("DatabaseViewConfig hydration and persistence", () => {
  it("marks only a successful missing-config lookup as eligible for default registration", async () => {
    const input = {
      provider: { async load() { return null; } },
      databaseId: "db-1",
      viewId: "new-view",
      viewType: "board" as const
    };
    await expect(loadDatabaseViewHydration(input)).resolves.toMatchObject({
      missing: true,
      valid: true,
      config: { databaseId: "db-1", viewId: "new-view", viewType: "board" }
    });
    await expect(loadDatabaseViewHydration({
      ...input,
      provider: { async load() { throw new Error("host unavailable"); } }
    })).resolves.toMatchObject({ missing: false, valid: false });
  });

  it("loads config and metadata before the first listRows request, seeding query state atomically", async () => {
    const order: string[] = [];
    const config = savedConfig();
    const runtimeProvider = {
      async getDatabase() {
        order.push("metadata");
        return metadata;
      },
      async listRows(_databaseId: string, options?: { query?: string; filters?: readonly unknown[]; propertySort?: unknown }): Promise<DatabaseRowsPage> {
        order.push("rows");
        expect(options).toMatchObject({
          query: "urgent",
          sortBy: undefined,
          filters: config.filters,
          propertySort: config.propertySort
        });
        return {
          databaseId: "db-1",
          rows: [],
          items: [],
          schema: {},
          config: {},
          pagination: { limit: 20, nextCursor: null, hasMore: false, total: 0 }
        };
      }
    } satisfies DatabaseProvider;
    const loaded = await loadDatabaseViewHydration({
      provider: { async load() { order.push("config"); return config; } },
      databaseProvider: runtimeProvider,
      databaseId: "db-1",
      viewId: "work",
      viewType: "calendar"
    });
    expect(order).toEqual(["config", "metadata"]);

    const store = createDatabaseRuntimeStore({ provider: runtimeProvider });
    store.ensureView(databaseViewInstanceKey("block", "db-1", "work"), "db-1", {
      query: loaded.config.query,
      sortBy: loaded.config.sortBy,
      direction: loaded.config.direction,
      filters: loaded.config.filters,
      propertySort: loaded.config.propertySort
    });
    await vi.waitFor(() => expect(order).toContain("rows"));
    expect(order).toEqual(["config", "metadata", "metadata", "rows"]);
  });

  it("serializes saves so a slow older save cannot overwrite the latest config", async () => {
    let releaseFirst: (() => void) | undefined;
    let persisted = "";
    const seen: string[] = [];
    const provider = {
      save(config: DatabaseViewConfig) {
        seen.push(config.query);
        if (seen.length === 1) {
          return new Promise<void>((resolve) => {
            releaseFirst = () => { persisted = config.query; resolve(); };
          });
        }
        persisted = config.query;
        return Promise.resolve();
      }
    };
    const olderErrors: Array<string | null> = [];
    const latestErrors: Array<string | null> = [];
    const olderWriter = createDatabaseViewConfigWriter(provider, (error) => olderErrors.push(error));
    const latestWriter = createDatabaseViewConfigWriter(provider, (error) => latestErrors.push(error));
    const first = olderWriter.save({ ...savedConfig(), query: "older" });
    const second = latestWriter.save({ ...savedConfig(), query: "newer" });
    await vi.waitFor(() => expect(releaseFirst).toBeTypeOf("function"));
    expect(seen).toEqual(["older"]);
    releaseFirst?.();
    await Promise.all([first, second]);
    expect(seen).toEqual(["older", "newer"]);
    expect(persisted).toBe("newer");
    expect(olderErrors).toEqual([]);
    expect(latestErrors.at(-1)).toBeNull();
  });

  it("keeps local config usable after a save failure and retries the latest value", async () => {
    const errors: Array<string | null> = [];
    let calls = 0;
    const provider = {
      async save() {
        calls += 1;
        if (calls === 1) throw new Error("private provider detail");
      }
    };
    const writer = createDatabaseViewConfigWriter(provider, (error) => errors.push(error));
    const current = { ...savedConfig(), query: "still visible" };
    await writer.save(current);
    expect(errors).toEqual(["private provider detail"]);
    await writer.retry();
    expect(calls).toBe(2);
    expect(errors.at(-1)).toBeNull();
  });
});
