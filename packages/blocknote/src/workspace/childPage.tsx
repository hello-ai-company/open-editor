import { createReactBlockSpec } from "@blocknote/react";
import type { PageId } from "@hello-ai-company/editor-core";
import type { ReactElement } from "react";
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

let sharedChildPageRuntime: ChildPageRuntime = {};

export function getChildPageRuntime(): ChildPageRuntime {
  return sharedChildPageRuntime;
}

export function bindChildPageRuntime(
  runtime: ChildPageRuntime
): ChildPageRuntime {
  sharedChildPageRuntime = runtime;
  return sharedChildPageRuntime;
}

function ChildPageRender(props: {
  block: { props: { pageId: string; titleHint: string } };
}): ReactElement {
  const runtime = getChildPageRuntime();
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
      className={`oe-child-page${missing ? " oe-child-page--missing" : ""}`}
      data-oe-child-page={pageId}
      data-missing={missing ? "true" : "false"}
      aria-label={`Child page: ${title}`}
      onClick={(event) => {
        event.preventDefault();
        if (!missing) runtime.onOpen?.(pageId);
      }}
    >
      <span className="oe-child-page__badge">Child</span>
      <span className="oe-child-page__title">{title}</span>
      {preview ? (
        <span className="oe-child-page__preview">{preview}</span>
      ) : null}
    </button>
  );
}

/**
 * Child-page attachment block. Creation is a host side-effect via PageProvider;
 * the document only stores the returned page id after successful creation.
 */
export const createChildPageBlockSpec = createReactBlockSpec(
  {
    type: CHILD_PAGE_TYPE,
    propSchema: {
      pageId: { default: "" as const },
      titleHint: { default: "" as const }
    },
    content: "none" as const
  },
  {
    render: (props): ReactElement => <ChildPageRender block={props.block} />
  }
);
