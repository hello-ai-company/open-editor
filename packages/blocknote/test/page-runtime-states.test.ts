/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { createPageRuntimeStore, createPageRuntimesFromStore, PageRuntimeAccessDeniedError } from "../src/workspace/pageRuntimeStore.js";
import { resolvePageCardDisplay } from "../src/workspace/pageCard.js";
import { resolveChildPageDisplay } from "../src/workspace/childPage.js";
import { createPageMentionDom } from "../src/workspace/pageMention.js";

describe("page metadata outcomes", () => {
  it("distinguishes an unbound provider from an explicit missing page, retaining stable hints", async () => {
    const unbound = createPageRuntimeStore(), missing = createPageRuntimeStore({ getPage: async () => null });
    expect((await unbound.load("p")).status).toBe("unavailable"); expect(unbound.getFetchCount()).toBe(0);
    await missing.load("p");
    for (const resolve of [resolvePageCardDisplay, resolveChildPageDisplay]) {
      expect(resolve({ store: unbound }, "p", "Stored title")).toMatchObject({ title: "Stored title", status: "unavailable", statusLabel: "Page information unavailable", missing: false });
      expect(resolve({ store: missing }, "p", "Stored title")).toMatchObject({ title: "Missing page", status: "missing", missing: true });
      expect(resolve({}, "p", "Stored title").status).toBe("unavailable");
      expect(resolve({}, "").status).toBe("empty");
    }
  });
  it("only an explicit typed host signal means restricted access; errors are not guessed from text", async () => {
    const denied = createPageRuntimeStore({ getPage: async () => { throw new PageRuntimeAccessDeniedError(); } });
    const failed = createPageRuntimeStore({ getPage: async () => { throw new Error("403 permission denied: private details"); } });
    await denied.load("p"); await failed.load("p");
    for (const resolve of [resolvePageCardDisplay, resolveChildPageDisplay]) {
      expect(resolve({ store: denied }, "p")).toMatchObject({ title: "Page access restricted", status: "forbidden", missing: false, error: false });
      expect(resolve({ store: failed }, "p")).toMatchObject({ title: "Unable to load page", status: "error", missing: false, error: true });
      expect(resolve({ resolve: () => { throw new PageRuntimeAccessDeniedError(); } }, "p").status).toBe("forbidden");
      expect(resolve({ resolve: () => { throw Error("offline"); } }, "p").status).toBe("error");
      expect(resolve({ resolve: () => ({ title: "", unavailable: true }) }, "p").title).toBe("Page information unavailable");
    }
  });
  it("does not retry an error during display reads, but a host retry can recover", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(Error("offline")).mockResolvedValue({ id: "p", title: "Recovered title" });
    const store = createPageRuntimeStore({ getPage: fetch }), runtime = createPageRuntimesFromStore(store);
    await store.load("p");
    for (let i = 0; i < 20; i++) expect(runtime.pageMentionRuntime.resolve("p")).toMatchObject({ error: true, missing: false });
    expect(fetch).toHaveBeenCalledTimes(1);
    await store.load("p"); expect(resolvePageCardDisplay(runtime.pageCardRuntime, "p")).toMatchObject({ status: "ready", title: "Recovered title" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("keeps localized failure labels from the store, with explicit runtime override", async () => {
    const store = createPageRuntimeStore({ unavailableLabel: "ページ情報に未接続" }); await store.load("p");
    expect(resolvePageCardDisplay({ store }, "p").title).toBe("ページ情報に未接続");
    expect(resolveChildPageDisplay({ store, unavailableLabel: "未接続" }, "p").title).toBe("未接続");
  });
  it("keeps blocked mentions inert and permits navigation only after successful metadata recovery", async () => {
    const store = createPageRuntimeStore({ getPage: async () => { throw new PageRuntimeAccessDeniedError(); } }), open = vi.fn();
    await store.load("p"); const runtime = createPageRuntimesFromStore(store, { onOpen: open });
    const span = createPageMentionDom("p", runtime.pageMentionRuntime);
    span.click(); span.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(span.dataset.missing).toBe("false"); expect(span.dataset.blocked).toBe("true"); expect(span.getAttribute("role")).toBe("note"); expect(open).not.toHaveBeenCalled();
    store.prime({ id: "p", title: "Known page" }); span.click(); expect(open).toHaveBeenCalledOnce(); expect(span.dataset.blocked).toBe("false");
  });
  it("does not expose stale failure or restricted outcomes after a newer metadata prime", async () => {
    let reject!: (reason: Error) => void;
    const store = createPageRuntimeStore({ getPage: () => new Promise((_resolve, fail) => { reject = fail; }) });
    const pending = store.load("p"); store.prime({ id: "p", title: "New title" }); reject(new PageRuntimeAccessDeniedError()); await pending;
    expect(store.get("p")).toMatchObject({ status: "ready", title: "New title" });
  });
});
