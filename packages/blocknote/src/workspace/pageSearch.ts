/**
 * Async page search with debounce + stale-query protection (Phase 4F-2C / R1).
 * Prefer PageProvider.searchPages; fall back to listLinks client filter.
 *
 * Invariants:
 * - Host excludePageId is a hint; OpenEditor always re-filters locally.
 * - search() callbacks only fire for the latest generation.
 * - searchNow() uses latest-accepted semantics: a stale Promise resolves to
 *   the latest accepted pages (not the obsolete payload, not []).
 *   This is safe for BlockNote getItems() which may apply completions in
 *   Promise resolution order.
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

export type PageSearchResult = {
  pages: EditorPageLink[];
  generation: number;
  query: string;
  /** True when this response lost the race; `pages` are the latest accepted. */
  stale: boolean;
};

export type PageSearchEngine = {
  /** Debounced search; only the latest query's result is applied via onResult. */
  search: (
    request: PageSearchRequest,
    onResult: (
      pages: EditorPageLink[],
      meta: { query: string; generation: number }
    ) => void,
    onError?: (
      error: Error,
      meta: { query: string; generation: number }
    ) => void
  ) => void;
  /**
   * Immediate search (no debounce).
   * Stale in-flight requests resolve with `{ stale: true, pages: latestAccepted }`
   * so consumers that apply Promise results in arrival order never overwrite
   * newer suggestions with older payloads (or empty arrays).
   */
  searchNow: (request: PageSearchRequest) => Promise<PageSearchResult>;
  cancel: () => void;
  getGeneration: () => number;
  /** Latest non-stale accepted pages (for tests / adapters). */
  getLatestAccepted: () => readonly EditorPageLink[];
};

function enforceExclusionAndLimit(
  pages: readonly EditorPageLink[],
  excludePageId: PageId | undefined,
  limit: number
): EditorPageLink[] {
  return pages
    .filter((page) => page.id !== excludePageId)
    .slice(0, limit);
}

function filterLinks(
  links: readonly EditorPageLink[],
  query: string,
  excludePageId?: PageId,
  limit = 40
): EditorPageLink[] {
  const q = query.trim().toLowerCase();
  return enforceExclusionAndLimit(
    links.filter(
      (page) =>
        !q ||
        page.title.toLowerCase().includes(q) ||
        page.id.toLowerCase().includes(q)
    ),
    excludePageId,
    limit
  );
}

export function createPageSearchEngine(
  options: PageSearchEngineOptions = {}
): PageSearchEngine {
  const debounceMs = options.debounceMs ?? 150;
  const defaultLimit = options.defaultLimit ?? 40;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** Latest successfully accepted result for searchNow consumers. */
  let latestAccepted: EditorPageLink[] = [];

  async function runSearch(
    request: PageSearchRequest
  ): Promise<EditorPageLink[]> {
    const limit = request.limit ?? defaultLimit;
    const searchOpts: PageSearchOptions = {
      excludePageId: request.excludePageId,
      limit
    };
    const provider = options.provider;
    let pages: EditorPageLink[] = [];
    if (provider?.searchPages) {
      pages = await provider.searchPages(request.query, searchOpts);
    } else if (provider?.listLinks) {
      const links = await provider.listLinks(request.excludePageId);
      // filterLinks already enforces exclusion + limit
      return filterLinks(links, request.query, request.excludePageId, limit);
    }
    // Always re-filter: hosts may ignore excludePageId / over-return
    return enforceExclusionAndLimit(pages, request.excludePageId, limit);
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
    getLatestAccepted: () => latestAccepted,
    cancel,
    async searchNow(request) {
      const gen = ++generation;
      try {
        const pages = await runSearch(request);
        if (gen !== generation) {
          return {
            pages: latestAccepted,
            generation: gen,
            query: request.query,
            stale: true
          };
        }
        latestAccepted = pages;
        return {
          pages,
          generation: gen,
          query: request.query,
          stale: false
        };
      } catch (err) {
        if (gen !== generation) {
          return {
            pages: latestAccepted,
            generation: gen,
            query: request.query,
            stale: true
          };
        }
        throw err instanceof Error ? err : new Error(String(err));
      }
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
            latestAccepted = pages;
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
