import { describe, expect, it } from "vitest";
import { createDemoDatabaseProvider, createDemoDatabaseViewConfigProvider } from "../src/demoProviders";

describe("demo database discovery", () => {
  it("lists host-owned database identities and all eleven saved view types", async () => {
    const provider = createDemoDatabaseProvider();
    const databases = await provider.listDatabases();

    expect(databases.map(({ id }) => id)).toEqual(["tasks"]);
    expect(databases[0]?.views?.map(({ viewType }) => viewType)).toEqual([
      "table", "board", "calendar", "list", "gallery", "timeline",
      "gantt", "chart", "feed", "map", "dashboard"
    ]);
    expect(await provider.getDatabase?.("tasks")).toMatchObject({ id: "tasks", title: "Tasks" });
    expect(await provider.getDatabase?.("invented")).toBeNull();
  });

  it("persists presentation settings and rediscovers view identities without storing rows", async () => {
    const storageData = new Map<string, string>();
    const storage = {
      getItem: (key: string) => storageData.get(key) ?? null,
      setItem: (key: string, value: string) => { storageData.set(key, value); }
    };
    const host = createDemoDatabaseViewConfigProvider(storage);
    const config = {
      schemaVersion: 1 as const,
      databaseId: "tasks",
      viewId: "view-calendar",
      viewType: "calendar" as const,
      query: "",
      sortBy: "position" as const,
      direction: "asc" as const,
      filters: [],
      propertySort: null,
      calendar: { datePropertyId: "due", scale: "week" as const }
    };

    await host.save?.(config);
    const restartedHost = createDemoDatabaseViewConfigProvider(storage);
    expect(await restartedHost.load?.("tasks", "view-calendar")).toEqual(config);
    expect(await restartedHost.list?.("tasks")).toEqual([
      { databaseId: "tasks", viewId: "view-calendar", viewType: "calendar" }
    ]);
    expect(storageData.values().next().value).not.toContain("Outline power UX");
  });
});
