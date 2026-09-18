/**
 * Async page search with debounce + stale-query protection (Phase 4F-2C).
 * Prefer PageProvider.searchPages; fall back to listLinks client filter.
 */

import type {
  EditorPageLink,
  PageId,
  PageProvider,
  PageSearchOptions
} from "@hello-ai-company/editor-core";

export type PageSearchEngineOptions = {
  provider?: Pick<PageProvider, "searchPages" | "listLinks">;
  debounceMs?: number;
  defaultLimit?: number;
};

export type PageSearchRequest = {
  query: string;
  excludePageId?: PageId;
  limit?: number;
};

export type PageSearchEngine = {
  /** Debounced search; only the latest query's result is applied via onResult. */
  search: (
    request: PageSearchRequest,
    onResult: (pages: EditorPageLink[], meta: { query: string; generation: number }) => void,
    onError?: (error: Error, meta: { query: string; generation: number }) => void
  ) => void;
  /** Immediate search (no debounce) — used by tests and @ mention getItems. */
  searchNow: (request: PageSearchRequest) => Promise<EditorPageLink[]>;
  cancel: () => void;
  getGeneration: () => number;
};

function filterLinks(
  links: readonly EditorPageLink[],
  query: string,
  excludePageId?: PageId,
  limit = 40
): EditorPageLink[] {
  const q = query.trim().toLowerCase();
  return links
    .filter((page) => page.id !== excludePageId)
    .filter(
      (page) =>
        !q ||
        page.title.toLowerCase().includes(q) ||
        page.id.toLowerCase().includes(q)
    )
    .slice(0, limit);
}

export function createPageSearchEngine(
  options: PageSearchEngineOptions = {}
): PageSearchEngine {
  const debounceMs = options.debounceMs ?? 150;
  const defaultLimit = options.defaultLimit ?? 40;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function runSearch(
    request: PageSearchRequest
  ): Promise<EditorPageLink[]> {
    const limit = request.limit ?? defaultLimit;
    const searchOpts: PageSearchOptions = {
      excludePageId: request.excludePageId,
      limit
    };
    const provider = options.provider;
    if (provider?.searchPages) {
      return provider.searchPages(request.query, searchOpts);
    }
    if (provider?.listLinks) {
      const links = await provider.listLinks(request.excludePageId);
      return filterLinks(links, request.query, request.excludePageId, limit);
    }
    return [];
  }

  function cancel(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    generation += 1;
  }

  return {
    getGeneration: () => generation,
    cancel,
    async searchNow(request) {
      const gen = ++generation;
      const pages = await runSearch(request);
      if (gen !== generation) {
        // Caller should ignore; return empty to discourage misuse
        return pages;
      }
      return pages;
    },
    search(request, onResult, onError) {
      if (timer) clearTimeout(timer);
      const gen = ++generation;
      timer = setTimeout(() => {
        timer = null;
        void (async () => {
          try {
            const pages = await runSearch(request);
            if (gen !== generation) return;
            onResult(pages, { query: request.query, generation: gen });
          } catch (err) {
            if (gen !== generation) return;
            onError?.(
              err instanceof Error ? err : new Error(String(err)),
              { query: request.query, generation: gen }
            );
          }
        })();
      }, debounceMs);
    }
  };
}
