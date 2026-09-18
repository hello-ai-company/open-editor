import { createReactBlockSpec } from "@blocknote/react";
import type { PageId } from "@hello-ai-company/editor-core";
import { useEffect, useSyncExternalStore, type ReactElement } from "react";
import type { PageRuntimeStore } from "./pageRuntimeStore.js";
import type { PageCardResolveResult } from "./pageCard.js";
import { CHILD_PAGE_TYPE } from "./types.js";

export type ChildPageRuntime = {
  store?: PageRuntimeStore;
  resolve?: (pageId: PageId) => PageCardResolveResult | null;
  onOpen?: (pageId: PageId) => void;
  missingLabel?: string;
  untitledLabel?: string;
  subscribe?: (listener: () => void) => () => void;
};

export type ChildPageDisplay = {
  title: string;
  preview?: string;
  imageUrl?: string;
  imageAlt?: string;
  missing: boolean;
  loading: boolean;
  error: boolean;
};

export function resolveChildPageDisplay(
  runtime: ChildPageRuntime,
  pageId: string,
  titleHint = ""
): ChildPageDisplay {
  if (runtime.store && pageId) {
    const snap = runtime.store.get(pageId);
    if (snap.status === "loading" || snap.status === "idle") {
      return {
        title: titleHint || runtime.untitledLabel || "Untitled",
        loading: true,
        missing: false,
        error: false
      };
    }
    if (snap.status === "missing") {
      return {
        title: runtime.missingLabel ?? "Missing page",
        missing: true,
        loading: false,
        error: false
      };
    }
    if (snap.status === "error") {
      return {
        title: runtime.missingLabel ?? "Missing page",
        missing: true,
        loading: false,
        error: true
      };
    }
    return {
      title:
        snap.title.trim() ||
        titleHint ||
        runtime.untitledLabel ||
        "Untitled",
      preview: snap.preview,
      imageUrl: snap.imageUrl,
      imageAlt: snap.imageAlt,
      missing: false,
      loading: false,
      error: false
    };
  }

  const resolved = runtime.resolve?.(pageId);
  if (resolved?.loading) {
    return {
      title: titleHint || runtime.untitledLabel || "Untitled",
      loading: true,
      missing: false,
      error: false
    };
  }
  const missing = !pageId || !resolved || Boolean(resolved.missing);
  if (missing) {
    return {
      title: runtime.missingLabel ?? "Missing page",
      missing: true,
      loading: false,
      error: Boolean(resolved?.error)
    };
  }
  return {
    title:
      resolved.title.trim() ||
      titleHint ||
      runtime.untitledLabel ||
      "Untitled",
    preview: resolved.preview,
    imageUrl: resolved.imageUrl,
    imageAlt: resolved.imageAlt,
    missing: false,
    loading: false,
    error: false
  };
}

function ChildPageView(props: {
  runtime: ChildPageRuntime;
  block: { props: { pageId: string; titleHint: string } };
}): ReactElement {
  const { runtime, block } = props;
  const pageId = block.props.pageId;

  useEffect(() => {
    if (pageId && runtime.store) {
      void runtime.store.load(pageId);
    }
  }, [pageId, runtime.store]);

  const subscribe =
    runtime.store?.subscribe ??
    runtime.subscribe ??
    ((_listener: () => void) => () => {});
  const snapshot = useSyncExternalStore(
    subscribe,
    () =>
      JSON.stringify(
        resolveChildPageDisplay(runtime, pageId, block.props.titleHint)
      ),
    () =>
      JSON.stringify(
        resolveChildPageDisplay(runtime, pageId, block.props.titleHint)
      )
  );
  const display = JSON.parse(snapshot) as ChildPageDisplay;
  const stateClass = display.loading
    ? " oe-child-page--loading"
    : display.error
      ? " oe-child-page--error"
      : display.missing
        ? " oe-child-page--missing"
        : "";

  return (
    <button
      type="button"
      className={`oe-child-page${stateClass}`}
      data-oe-child-page={pageId}
      data-missing={display.missing ? "true" : "false"}
      data-loading={display.loading ? "true" : "false"}
      data-error={display.error ? "true" : "false"}
      aria-label={
        display.loading
          ? "Loading child page"
          : `Child page: ${display.title}`
      }
      aria-busy={display.loading || undefined}
      disabled={display.loading}
      onClick={(event) => {
        event.preventDefault();
        if (!display.missing && !display.loading) runtime.onOpen?.(pageId);
      }}
    >
      <span className="oe-child-page__badge">Child</span>
      {display.imageUrl ? (
        <img
          className="oe-child-page__image"
          src={display.imageUrl}
          alt={display.imageAlt ?? ""}
        />
      ) : null}
      <span className="oe-child-page__title">
        {display.loading ? "Loading…" : display.title}
      </span>
      {display.preview && !display.loading ? (
        <span className="oe-child-page__preview">{display.preview}</span>
      ) : null}
    </button>
  );
}

/**
 * Child-page attachment block. Runtime is captured by closure — never global.
 * Semantically distinct from pageCard (created as child of current page).
 */
export function createChildPageBlockSpec(runtime: ChildPageRuntime = {}) {
  return createReactBlockSpec(
    {
      type: CHILD_PAGE_TYPE,
      propSchema: {
        pageId: { default: "" as const },
        titleHint: { default: "" as const }
      },
      content: "none" as const
    },
    {
      render: (props): ReactElement => (
        <ChildPageView runtime={runtime} block={props.block} />
      )
    }
  )();
}
