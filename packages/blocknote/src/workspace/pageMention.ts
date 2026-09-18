import {
  createInlineContentSpec,
  type InlineContentSpec
} from "@blocknote/core";
import type { EditorPageLink, PageId } from "@hello-ai-company/editor-core";
import { PAGE_MENTION_TYPE } from "./types.js";

export type PageMentionResolver = (pageId: PageId) => {
  title: string;
  missing?: boolean;
  loading?: boolean;
  error?: boolean;
} | null;

export type PageMentionRuntime = {
  resolve?: PageMentionResolver;
  onNavigate?: (pageId: PageId) => void;
  missingLabel?: string;
  untitledLabel?: string;
  subscribe?: (listener: () => void) => () => void;
};

export type PageMentionSpecOptions = {
  resolve?: PageMentionResolver;
  onNavigate?: (pageId: PageId) => void;
  missingLabel?: string;
  untitledLabel?: string;
  subscribe?: (listener: () => void) => () => void;
  runtime?: PageMentionRuntime;
};

const cleanupByDom = new WeakMap<HTMLElement, () => void>();

export function formatPageMentionLabel(
  pageId: string,
  resolver?: PageMentionResolver,
  missingLabel = "Missing page",
  untitledLabel = "Untitled"
): { label: string; missing: boolean; loading: boolean } {
  if (!pageId) return { label: missingLabel, missing: true, loading: false };
  const resolved = resolver?.(pageId);
  if (resolved?.loading) {
    return { label: untitledLabel, missing: false, loading: true };
  }
  if (!resolved || resolved.missing) {
    return { label: missingLabel, missing: true, loading: false };
  }
  const title = resolved.title.trim() || untitledLabel;
  return { label: title, missing: false, loading: false };
}

export function applyPageMentionLabel(
  span: HTMLSpanElement,
  pageId: string,
  runtime: PageMentionRuntime
): void {
  const { label, missing, loading } = formatPageMentionLabel(
    pageId,
    runtime.resolve,
    runtime.missingLabel ?? "Missing page",
    runtime.untitledLabel ?? "Untitled"
  );
  span.dataset.pageId = pageId;
  span.dataset.missing = missing ? "true" : "false";
  span.dataset.loading = loading ? "true" : "false";
  span.setAttribute("role", missing || loading ? "note" : "link");
  span.title = loading
    ? "Loading…"
    : missing
      ? (runtime.missingLabel ?? "Missing page")
      : label;
  span.textContent = loading ? "@…" : `@${label}`;
}

export function createPageMentionDom(
  pageId: string,
  runtime: PageMentionRuntime
): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "oe-page-mention";
  span.setAttribute("contenteditable", "false");
  span.tabIndex = 0;
  applyPageMentionLabel(span, pageId, runtime);

  const activate = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    if (
      span.dataset.missing === "true" ||
      span.dataset.loading === "true" ||
      !pageId
    ) {
      return;
    }
    runtime.onNavigate?.(pageId);
  };
  span.addEventListener("click", activate);
  span.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") activate(event);
  });

  if (runtime.subscribe) {
    const unsubscribe = runtime.subscribe(() => {
      applyPageMentionLabel(span, pageId, runtime);
    });
    cleanupByDom.set(span, unsubscribe);
  }
  return span;
}

function destroyPageMentionDom(dom: HTMLElement): void {
  const cleanup = cleanupByDom.get(dom);
  if (cleanup) {
    cleanup();
    cleanupByDom.delete(dom);
  }
}

export function createPageMentionInlineContentSpec(
  options?: PageMentionSpecOptions
): InlineContentSpec<{
  type: typeof PAGE_MENTION_TYPE;
  propSchema: { pageId: { default: string } };
  content: "none";
}> {
  const runtime: PageMentionRuntime = options?.runtime ?? {
    resolve: options?.resolve,
    onNavigate: options?.onNavigate,
    missingLabel: options?.missingLabel,
    untitledLabel: options?.untitledLabel,
    subscribe: options?.subscribe
  };
  if (options?.resolve) runtime.resolve = options.resolve;
  if (options?.onNavigate) runtime.onNavigate = options.onNavigate;
  if (options?.missingLabel) runtime.missingLabel = options.missingLabel;
  if (options?.untitledLabel) runtime.untitledLabel = options.untitledLabel;
  if (options?.subscribe) runtime.subscribe = options.subscribe;

  return createInlineContentSpec(
    {
      type: PAGE_MENTION_TYPE,
      propSchema: { pageId: { default: "" } },
      content: "none"
    },
    {
      render(inlineContent) {
        const dom = createPageMentionDom(inlineContent.props.pageId, runtime);
        return { dom, destroy: () => destroyPageMentionDom(dom) };
      },
      parse(element) {
        if (
          element.tagName === "SPAN" &&
          element.classList.contains("oe-page-mention")
        ) {
          return { pageId: element.getAttribute("data-page-id") ?? "" };
        }
        return undefined;
      }
    }
  );
}

export function createPageMentionResolverFromLinks(
  links: ReadonlyArray<EditorPageLink> | (() => ReadonlyArray<EditorPageLink>)
): PageMentionResolver {
  return (pageId) => {
    const list = typeof links === "function" ? links() : links;
    const hit = list.find((link) => link.id === pageId);
    if (!hit) return { title: "", missing: true };
    return { title: hit.title };
  };
}
