import { createReactBlockSpec } from "@blocknote/react";
import type { PageId } from "@hello-ai-company/editor-core";
import { useSyncExternalStore, type ReactElement } from "react";
import { PAGE_CARD_TYPE } from "./types.js";

export type PageCardRuntime = {
  resolve?: (pageId: PageId) => {
    title: string;
    preview?: string;
    missing?: boolean;
  } | null;
  onOpen?: (pageId: PageId) => void;
  missingLabel?: string;
  untitledLabel?: string;
  subscribe?: (listener: () => void) => () => void;
};

export type PageCardDisplay = {
  title: string;
  preview?: string;
  missing: boolean;
};

/** Pure display resolve — used by render and isolation tests. */
export function resolvePageCardDisplay(
  runtime: PageCardRuntime,
  pageId: string,
  titleHint = ""
): PageCardDisplay {
  const resolved = runtime.resolve?.(pageId);
  const missing = !pageId || !resolved || Boolean(resolved.missing);
  if (missing) {
    return {
      title: runtime.missingLabel ?? "Missing page",
      missing: true
    };
  }
  return {
    title:
      resolved.title.trim() ||
      titleHint ||
      runtime.untitledLabel ||
      "Untitled",
    preview: resolved.preview,
    missing: false
  };
}

function PageCardView(props: {
  runtime: PageCardRuntime;
  block: { props: { pageId: string; titleHint: string } };
}): ReactElement {
  const { runtime, block } = props;
  const pageId = block.props.pageId;
  const subscribe = runtime.subscribe ?? ((_listener: () => void) => () => {});
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

  return (
    <button
      type="button"
      className={`oe-page-card${display.missing ? " oe-page-card--missing" : ""}`}
      data-oe-page-card={pageId}
      data-missing={display.missing ? "true" : "false"}
      aria-label={display.title}
      onClick={(event) => {
        event.preventDefault();
        if (!display.missing) runtime.onOpen?.(pageId);
      }}
    >
      <span className="oe-page-card__title">{display.title}</span>
      {display.preview ? (
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
