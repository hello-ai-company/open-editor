import { createReactBlockSpec } from "@blocknote/react";
import type { PageId } from "@hello-ai-company/editor-core";
import type { ReactElement } from "react";
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

let sharedPageCardRuntime: PageCardRuntime = {};

export function getPageCardRuntime(): PageCardRuntime {
  return sharedPageCardRuntime;
}

export function setPageCardRuntime(runtime: PageCardRuntime): void {
  sharedPageCardRuntime = runtime;
}

export function bindPageCardRuntime(runtime: PageCardRuntime): PageCardRuntime {
  sharedPageCardRuntime = runtime;
  return sharedPageCardRuntime;
}

function PageCardRender(props: {
  block: { props: { pageId: string; titleHint: string } };
}): ReactElement {
  const runtime = getPageCardRuntime();
  const pageId = props.block.props.pageId;
  const resolved = runtime.resolve?.(pageId);
  const missing = !pageId || !resolved || resolved.missing;
  const title = missing
    ? (runtime.missingLabel ?? "Missing page")
    : resolved.title.trim() ||
      props.block.props.titleHint ||
      runtime.untitledLabel ||
      "Untitled";
  const preview = missing ? undefined : resolved.preview;

  return (
    <button
      type="button"
      className={`oe-page-card${missing ? " oe-page-card--missing" : ""}`}
      data-oe-page-card={pageId}
      data-missing={missing ? "true" : "false"}
      aria-label={title}
      onClick={(event) => {
        event.preventDefault();
        if (!missing) runtime.onOpen?.(pageId);
      }}
    >
      <span className="oe-page-card__title">{title}</span>
      {preview ? (
        <span className="oe-page-card__preview">{preview}</span>
      ) : null}
    </button>
  );
}

/**
 * Standalone block representing an existing page.
 * Persist identity (+ optional titleHint); live metadata comes from the host.
 */
export const createPageCardBlockSpec = createReactBlockSpec(
  {
    type: PAGE_CARD_TYPE,
    propSchema: {
      pageId: { default: "" as const },
      titleHint: { default: "" as const }
    },
    content: "none" as const
  },
  {
    render: (props): ReactElement => <PageCardRender block={props.block} />
  }
);
