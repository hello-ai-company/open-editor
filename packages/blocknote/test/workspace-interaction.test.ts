/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

// Enable React act() under Vitest/jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
import {
  createPageRuntimeStore,
  createPageRuntimesFromStore
} from "../src/workspace/pageRuntimeStore.js";
import { createPageSearchEngine } from "../src/workspace/pageSearch.js";
import { createCommandRegistry } from "../src/commands/registry.js";
import { createWorkspaceContentCommands } from "../src/workspace/commands.js";
import { CHILD_PAGE_TYPE } from "../src/workspace/types.js";
import { createPageMentionSuggestionGetItems } from "../src/react/pageMentionSuggestion.js";
import { PAGE_MENTION_TYPE } from "../src/workspace/types.js";
import { resolvePageCardDisplay } from "../src/workspace/pageCard.js";
import { resolveChildPageDisplay } from "../src/workspace/childPage.js";
import {
  applyWorkspacePickerKey,
  BacklinksPanel
} from "../src/react/workspaceUi.js";
import { createRelationIndex } from "../src/workspace/relationIndex.js";

describe("PageRuntimeStore", () => {
  it("dedupes concurrent getPage for the same id", async () => {
    let calls = 0;
    let resolveFetch!: (value: { id: string; title: string }) => void;
    const store = createPageRuntimeStore({
      getPage: () => {
        calls += 1;
        return new Promise((resolve) => {
          resolveFetch = resolve;
        });
      }
    });

    const a = store.load("architecture");
    const b = store.load("architecture");
    expect(calls).toBe(1);
    expect(store.get("architecture").status).toBe("loading");

    resolveFetch({ id: "architecture", title: "Architecture" });
    const [sa, sb] = await Promise.all([a, b]);
    expect(sa.status).toBe("ready");
    expect(sb.title).toBe("Architecture");
    expect(calls).toBe(1);
    expect(store.getFetchCount("architecture")).toBe(1);
  });

  it("isolates two store instances", async () => {
    const storeA = createPageRuntimeStore({
      getPage: async () => ({ id: "p", title: "A" })
    });
    const storeB = createPageRuntimeStore({
      getPage: async () => ({ id: "p", title: "B" })
    });
    await storeA.load("p");
    await storeB.load("p");
    expect(storeA.get("p").title).toBe("A");
    expect(storeB.get("p").title).toBe("B");
  });

  it("marks missing when provider returns null", async () => {
    const store = createPageRuntimeStore({
      getPage: async () => null
    });
    const snap = await store.load("gone");
    expect(snap.status).toBe("missing");
  });

  it("marks error when provider rejects", async () => {
    const store = createPageRuntimeStore({
      getPage: async () => {
        throw new Error("network");
      }
    });
    const snap = await store.load("x");
    expect(snap.status).toBe("error");
    expect(snap.errorMessage).toBe("network");
  });

  it("ignores stale responses after invalidate", async () => {
    let resolveFirst!: (value: { id: string; title: string }) => void;
    let call = 0;
    const store = createPageRuntimeStore({
      getPage: () => {
        call += 1;
        if (call === 1) {
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve({ id: "p", title: "Fresh" });
      }
    });

    const first = store.load("p");
    store.invalidate("p");
    const second = await store.load("p");
    expect(second.title).toBe("Fresh");
    resolveFirst({ id: "p", title: "Stale" });
    await first;
    expect(store.get("p").title).toBe("Fresh");
  });

  it("prime after rename updates subscribers without rewrite", async () => {
    const store = createPageRuntimeStore({
      getPage: async () => ({ id: "architecture", title: "Architecture" })
    });
    await store.load("architecture");
    const seen: string[] = [];
    store.subscribe(() => seen.push(store.get("architecture").title));
    store.prime({
      id: "architecture",
      title: "System Architecture"
    });
    expect(store.get("architecture").title).toBe("System Architecture");
    expect(seen.at(-1)).toBe("System Architecture");

    const runtimes = createPageRuntimesFromStore(store);
    expect(runtimes.pageCardRuntime.resolve?.("architecture")?.title).toBe(
      "System Architecture"
    );
  });

  it("invalidate then reload clears ready cache", async () => {
    const store = createPageRuntimeStore({
      getPage: async () => ({ id: "p", title: "V1" })
    });
    await store.load("p");
    expect(store.get("p").status).toBe("ready");
    store.invalidate("p");
    expect(store.get("p").status).toBe("idle");
    await store.load("p");
    expect(store.get("p").status).toBe("ready");
    expect(store.getFetchCount("p")).toBe(2);
  });
});

describe("PageCard / ChildPage store display", () => {
  it("shows loading then ready then missing then error", async () => {
    let resolveFetch!: (v: { id: string; title: string } | null) => void;
    let rejectFetch!: (e: Error) => void;
    const store = createPageRuntimeStore({
      getPage: () =>
        new Promise((resolve, reject) => {
          resolveFetch = resolve;
          rejectFetch = reject;
        })
    });
    const cardRuntime = { store };

    expect(resolvePageCardDisplay(cardRuntime, "p").loading).toBe(true);
    void store.load("p");
    expect(resolvePageCardDisplay(cardRuntime, "p").loading).toBe(true);

    resolveFetch({ id: "p", title: "Live" });
    await store.load("p");
    expect(resolvePageCardDisplay(cardRuntime, "p")).toMatchObject({
      title: "Live",
      missing: false,
      loading: false
    });
    expect(resolveChildPageDisplay(cardRuntime, "p").title).toBe("Live");

    store.invalidate("p");
    const missingPromise = store.load("p");
    resolveFetch(null);
    await missingPromise;
    expect(resolvePageCardDisplay(cardRuntime, "p").missing).toBe(true);

    store.invalidate("p");
    const errPromise = store.load("p");
    rejectFetch(new Error("boom"));
    await errPromise;
    expect(resolvePageCardDisplay(cardRuntime, "p").error).toBe(true);
    expect(resolveChildPageDisplay(cardRuntime, "p").error).toBe(true);
  });

  it("preserves runtime instance isolation across stores", () => {
    const storeA = createPageRuntimeStore();
    const storeB = createPageRuntimeStore();
    storeA.prime({ id: "p", title: "A" });
    storeB.prime({ id: "p", title: "B" });
    expect(resolvePageCardDisplay({ store: storeA }, "p").title).toBe("A");
    expect(resolvePageCardDisplay({ store: storeB }, "p").title).toBe("B");
    expect(resolveChildPageDisplay({ store: storeA }, "p").title).toBe("A");
  });
});

describe("PageSearchEngine", () => {
  it("suppresses stale results when a newer query wins", async () => {
    let resolveA!: (pages: { id: string; title: string }[]) => void;
    let resolveB!: (pages: { id: string; title: string }[]) => void;
    let n = 0;
    const engine = createPageSearchEngine({
      debounceMs: 0,
      provider: {
        searchPages: async () => {
          n += 1;
          if (n === 1) {
            return new Promise((resolve) => {
              resolveA = resolve;
            });
          }
          return new Promise((resolve) => {
            resolveB = resolve;
          });
        }
      }
    });

    const results: string[] = [];
    engine.search({ query: "a" }, (pages) => {
      results.push(pages.map((p) => p.title).join(","));
    });
    await new Promise((r) => setTimeout(r, 5));
    engine.search({ query: "arch" }, (pages) => {
      results.push(pages.map((p) => p.title).join(","));
    });
    await new Promise((r) => setTimeout(r, 5));
    resolveB([{ id: "1", title: "Architecture" }]);
    await new Promise((r) => setTimeout(r, 5));
    resolveA([{ id: "2", title: "Apple" }]);
    await new Promise((r) => setTimeout(r, 5));
    expect(results).toEqual(["Architecture"]);
  });

  it("falls back to listLinks when searchPages is absent", async () => {
    const engine = createPageSearchEngine({
      debounceMs: 0,
      provider: {
        listLinks: async () => [
          { id: "a", title: "Alpha" },
          { id: "b", title: "Beta" }
        ]
      }
    });
    const pages = await engine.searchNow({ query: "al" });
    expect(pages.map((p) => p.id)).toEqual(["a"]);
  });

  it("excludes current page id", async () => {
    const engine = createPageSearchEngine({
      debounceMs: 0,
      provider: {
        searchPages: async (_q, opts) => {
          const all = [
            { id: "demo", title: "Demo" },
            { id: "other", title: "Other" }
          ];
          return all.filter((p) => p.id !== opts?.excludePageId);
        }
      }
    });
    const pages = await engine.searchNow({
      query: "",
      excludePageId: "demo"
    });
    expect(pages.map((p) => p.id)).toEqual(["other"]);
  });

  it("surfaces provider search errors via onError", async () => {
    const engine = createPageSearchEngine({
      debounceMs: 0,
      provider: {
        searchPages: async () => {
          throw new Error("search down");
        }
      }
    });
    const errors: string[] = [];
    engine.search(
      { query: "x" },
      () => undefined,
      (err) => errors.push(err.message)
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(errors).toEqual(["search down"]);
  });

  it("returns empty results for no matches", async () => {
    const engine = createPageSearchEngine({
      debounceMs: 0,
      provider: {
        searchPages: async () => []
      }
    });
    const pages = await engine.searchNow({ query: "zzz" });
    expect(pages).toEqual([]);
  });
});

describe("WorkspacePagePicker keyboard", () => {
  it("ArrowDown / ArrowUp / Enter / Escape", () => {
    expect(
      applyWorkspacePickerKey("ArrowDown", { highlight: 0, resultsLength: 3 })
    ).toEqual({ highlight: 1, action: "none" });
    expect(
      applyWorkspacePickerKey("ArrowUp", { highlight: 1, resultsLength: 3 })
    ).toEqual({ highlight: 0, action: "none" });
    expect(
      applyWorkspacePickerKey("Enter", { highlight: 2, resultsLength: 3 })
    ).toEqual({ highlight: 2, action: "select" });
    expect(
      applyWorkspacePickerKey("Escape", { highlight: 1, resultsLength: 3 })
    ).toEqual({ highlight: 1, action: "cancel" });
  });
});

describe("child page creation command", () => {
  function editorMock(insertBlocks = vi.fn()) {
    return {
      insertBlocks,
      updateBlock: () => undefined,
      getTextCursorPosition: () => ({
        block: { id: "current", type: "paragraph" }
      }),
      transact: <T>(fn: () => T) => fn()
    };
  }

  it("inserts nothing when creation UI is cancelled", async () => {
    const insertBlocks = vi.fn();
    const createChildPage = vi.fn();
    const registry = createCommandRegistry(createWorkspaceContentCommands());
    await registry.run("page.create-child", {
      editor: editorMock(insertBlocks),
      documentId: "parent",
      providers: { pages: { createChildPage } },
      requestChildPageCreate: async () => null
    } as never);
    expect(createChildPage).not.toHaveBeenCalled();
    expect(insertBlocks).not.toHaveBeenCalled();
  });

  it("inserts nothing when provider throws", async () => {
    const insertBlocks = vi.fn();
    const registry = createCommandRegistry(createWorkspaceContentCommands());
    await registry.run("page.create-child", {
      editor: editorMock(insertBlocks),
      documentId: "parent",
      providers: {
        pages: {
          createChildPage: async () => {
            throw new Error("fail");
          }
        }
      }
    } as never);
    expect(insertBlocks).not.toHaveBeenCalled();
  });

  it("inserts nothing when provider returns void", async () => {
    const insertBlocks = vi.fn();
    const registry = createCommandRegistry(createWorkspaceContentCommands());
    await registry.run("page.create-child", {
      editor: editorMock(insertBlocks),
      documentId: "parent",
      providers: {
        pages: {
          createChildPage: async () => undefined
        }
      }
    } as never);
    expect(insertBlocks).not.toHaveBeenCalled();
  });

  it("uses title from requestChildPageCreate then host id", async () => {
    const insertBlocks = vi.fn();
    const createChildPage = vi.fn(async () => ({
      id: "child-1",
      title: "Specs"
    }));
    const registry = createCommandRegistry(createWorkspaceContentCommands());
    await registry.run("page.create-child", {
      editor: editorMock(insertBlocks),
      documentId: "parent",
      providers: { pages: { createChildPage } },
      requestChildPageCreate: async () => ({ title: "Specs" })
    } as never);
    expect(createChildPage).toHaveBeenCalledWith({
      parentPageId: "parent",
      title: "Specs"
    });
    expect(insertBlocks).toHaveBeenCalledWith(
      [
        {
          type: CHILD_PAGE_TYPE,
          props: { pageId: "child-1", titleHint: "Specs" }
        }
      ],
      { id: "current", type: "paragraph" },
      "after"
    );
  });
});

describe("@ page mention suggestion", () => {
  it("builds items that insert structured pageMention", async () => {
    const insertInlineContent = vi.fn();
    const getItems = createPageMentionSuggestionGetItems({
      getPages: () => [
        { id: "architecture", title: "Architecture", preview: "Design" }
      ],
      editor: {
        insertInlineContent,
        transact: <T>(fn: () => T) => fn()
      }
    });
    const items = await getItems("arch");
    expect(items).toHaveLength(1);
    items[0]!.onItemClick();
    expect(insertInlineContent).toHaveBeenCalledWith([
      { type: PAGE_MENTION_TYPE, props: { pageId: "architecture" } }
    ]);
  });
});

describe("BacklinksPanel", () => {
  it("shows loading then ready; ignores stale target responses", async () => {
    let resolveFirst!: (items: unknown[]) => void;
    let call = 0;
    const provider = {
      listBacklinks: () => {
        call += 1;
        if (call === 1) {
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve([
          {
            sourceDocumentId: "fresh",
            sourceTitle: "Fresh",
            kind: "page-reference" as const
          }
        ]);
      }
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        createElement(BacklinksPanel, {
          targetPageId: "architecture",
          provider
        })
      );
    });
    expect(host.textContent).toContain("Loading");

    await act(async () => {
      root.render(
        createElement(BacklinksPanel, {
          targetPageId: "roadmap",
          provider
        })
      );
    });

    await act(async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(host.textContent).toContain("Fresh");

    await act(async () => {
      resolveFirst([
        {
          sourceDocumentId: "stale",
          sourceTitle: "Stale",
          kind: "page-reference"
        }
      ]);
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(host.textContent).not.toContain("Stale");
    expect(host.textContent).toContain("Fresh");

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it("shows empty when provider returns []", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        createElement(BacklinksPanel, {
          targetPageId: "x",
          provider: { listBacklinks: async () => [] }
        })
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(host.textContent).toContain("No backlinks");
    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it("shows error state when provider rejects", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        createElement(BacklinksPanel, {
          targetPageId: "x",
          provider: {
            listBacklinks: async () => {
              throw new Error("backlink fail");
            }
          }
        })
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(host.textContent).toContain("backlink fail");
    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it("lists outgoing from RelationIndex", async () => {
    const relationIndex = createRelationIndex();
    relationIndex.replaceFromBlocks("demo", [
      {
        id: "b1",
        type: "pageCard",
        props: { pageId: "architecture", titleHint: "" },
        children: []
      }
    ] as never);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        createElement(BacklinksPanel, {
          targetPageId: "architecture",
          relationIndex,
          resolveOutgoingTitle: () => "Architecture Notes",
          provider: { listBacklinks: async () => [] }
        })
      );
    });
    expect(host.textContent).toContain("Architecture Notes");
    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});

describe("performance guardrails", () => {
  it("does not fetch on unrelated text — only load() triggers getPage", async () => {
    const getPage = vi.fn(async () => ({ id: "p", title: "P" }));
    const store = createPageRuntimeStore({ getPage });
    store.get("p");
    store.get("p");
    expect(getPage).not.toHaveBeenCalled();
    await store.load("p");
    await store.load("p");
    expect(getPage).toHaveBeenCalledTimes(1);
  });
});
