import { createReactBlockSpec } from "@blocknote/react";
import type { PageId } from "@hello-ai-company/editor-core";
import { useSyncExternalStore, type ReactElement } from "react";
import { CHILD_PAGE_TYPE } from "./types.js";

export type ChildPageRuntime = {
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

export type ChildPageDisplay = {
  title: string;
  preview?: string;
  missing: boolean;
};

export function resolveChildPageDisplay(
  runtime: ChildPageRuntime,
  pageId: string,
  titleHint = ""
): ChildPageDisplay {
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

function ChildPageView(props: {
  runtime: ChildPageRuntime;
  block: { props: { pageId: string; titleHint: string } };
}): ReactElement {
  const { runtime, block } = props;
  const pageId = block.props.pageId;
  const subscribe = runtime.subscribe ?? ((_listener: () => void) => () => {});
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

  return (
    <button
      type="button"
      className={`oe-child-page${display.missing ? " oe-child-page--missing" : ""}`}
      data-oe-child-page={pageId}
      data-missing={display.missing ? "true" : "false"}
      aria-label={`Child page: ${display.title}`}
      onClick={(event) => {
        event.preventDefault();
        if (!display.missing) runtime.onOpen?.(pageId);
      }}
    >
      <span className="oe-child-page__badge">Child</span>
      <span className="oe-child-page__title">{display.title}</span>
      {display.preview ? (
        <span className="oe-child-page__preview">{display.preview}</span>
      ) : null}
    </button>
  );
}

/**
 * Child-page attachment block. Runtime is captured by closure — never global.
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
