import { createReactBlockSpec } from "@blocknote/react";
import type { PageId } from "@hello-ai-company/editor-core";
import { useEffect, useSyncExternalStore, type ReactElement } from "react";
import type { PageRuntimeStore } from "./pageRuntimeStore.js";
import { PAGE_CARD_TYPE } from "./types.js";

export type PageCardResolveResult = {
  title: string;
  preview?: string;
  imageUrl?: string;
  imageAlt?: string;
  missing?: boolean;
  loading?: boolean;
  error?: boolean;
};

export type PageCardRuntime = {
  /** Preferred: instance-scoped metadata store. */
  store?: PageRuntimeStore;
  resolve?: (pageId: PageId) => PageCardResolveResult | null;
  onOpen?: (pageId: PageId) => void;
  missingLabel?: string;
  untitledLabel?: string;
  subscribe?: (listener: () => void) => () => void;
};

export type PageCardDisplay = {
  title: string;
  preview?: string;
  imageUrl?: string;
  imageAlt?: string;
  missing: boolean;
  loading: boolean;
  error: boolean;
};

/** Pure display resolve — used by render and isolation tests. */
export function resolvePageCardDisplay(
  runtime: PageCardRuntime,
  pageId: string,
  titleHint = ""
): PageCardDisplay {
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

function PageCardView(props: {
  runtime: PageCardRuntime;
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
        resolvePageCardDisplay(runtime, pageId, block.props.titleHint)
      ),
    () =>
      JSON.stringify(
        resolvePageCardDisplay(runtime, pageId, block.props.titleHint)
      )
  );
  const display = JSON.parse(snapshot) as PageCardDisplay;
  const stateClass = display.loading
    ? " oe-page-card--loading"
    : display.error
      ? " oe-page-card--error"
      : display.missing
        ? " oe-page-card--missing"
        : "";

  return (
    <button
      type="button"
      className={`oe-page-card${stateClass}`}
      data-oe-page-card={pageId}
      data-missing={display.missing ? "true" : "false"}
      data-loading={display.loading ? "true" : "false"}
      data-error={display.error ? "true" : "false"}
      aria-label={
        display.loading
          ? "Loading page"
          : display.missing
            ? display.title
            : display.title
      }
      aria-busy={display.loading || undefined}
      disabled={display.loading}
      onClick={(event) => {
        event.preventDefault();
        if (!display.missing && !display.loading) runtime.onOpen?.(pageId);
      }}
    >
      {display.imageUrl ? (
        <img
          className="oe-page-card__image"
          src={display.imageUrl}
          alt={display.imageAlt ?? ""}
        />
      ) : null}
      <span className="oe-page-card__title">
        {display.loading ? "Loading…" : display.title}
      </span>
      {display.preview && !display.loading ? (
        <span className="oe-page-card__preview">{display.preview}</span>
      ) : null}
    </button>
  );
}

/**
 * Standalone block representing an existing page.
 * Runtime is captured by closure — never module-global.
 */
export function createPageCardBlockSpec(runtime: PageCardRuntime = {}) {
  return createReactBlockSpec(
    {
      type: PAGE_CARD_TYPE,
      propSchema: {
        pageId: { default: "" as const },
        titleHint: { default: "" as const }
      },
      content: "none" as const
    },
    {
      render: (props): ReactElement => (
        <PageCardView runtime={runtime} block={props.block} />
      )
    }
  )();
}
