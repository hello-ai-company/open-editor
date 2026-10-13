import { ReferencePresentation } from "./referencePresentation.js";
import { createReactBlockSpec } from "@blocknote/react";
import { interactiveBlockMeta } from "../document/widgetInteraction.js";
import type { PageId } from "@hello-ai-company/editor-core";
import { useEffect, useSyncExternalStore, type ReactElement } from "react";
import type { PageRuntimeStore } from "./pageRuntimeStore.js";
import { resolvePageCardDisplay, type PageCardResolveResult, type PageCardDisplay } from "./pageCard.js";
import { CHILD_PAGE_TYPE } from "./types.js";

export type ChildPageRuntime = {
  store?: PageRuntimeStore;
  resolve?: (pageId: PageId) => PageCardResolveResult | null;
  onOpen?: (pageId: PageId) => void;
  missingLabel?: string;
  untitledLabel?: string;
  unavailableLabel?: string;
  errorLabel?: string;
  forbiddenLabel?: string;
  emptyLabel?: string;
  subscribe?: (listener: () => void) => () => void;
};

export type ChildPageDisplay = PageCardDisplay;

export function resolveChildPageDisplay(runtime: ChildPageRuntime, pageId: string, titleHint = ""): ChildPageDisplay {
  return resolvePageCardDisplay(runtime, pageId, titleHint);
}

function ChildPageView(props: {
  runtime: ChildPageRuntime;
  block: { props: { pageId: string; titleHint: string; presentation?: string } };
  onPresentationChange?: (value: string) => void;
  onHistory?: (redo: boolean) => void;
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

  const presentation = block.props.presentation ?? "modern";
  return (
    <section className="oe-reference-block" data-presentation={presentation}>
    <button
      type="button"
      className={`oe-child-page${stateClass}`}
      data-oe-child-page={pageId}
      data-missing={display.missing ? "true" : "false"}
      data-loading={display.loading ? "true" : "false"}
      data-error={display.error ? "true" : "false"}
      data-status={display.status}
      aria-label={
        display.loading
          ? "Loading child page"
          : `Child page: ${display.title}${display.statusLabel && display.statusLabel !== display.title ? `: ${display.statusLabel}` : ""}`
      }
      aria-busy={display.loading || undefined}
      disabled={display.status !== "ready" || !runtime.onOpen}
      onClick={(event) => {
        event.preventDefault();
        if (display.status === "ready") runtime.onOpen?.(pageId);
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
      {display.statusLabel && display.statusLabel !== display.title ? <span className="oe-child-page__status" role="status">{display.statusLabel}</span> : null}
      {display.preview && !display.loading ? (
        <span className="oe-child-page__preview">{display.preview}</span>
      ) : null}
    </button>
    <ReferencePresentation value={presentation} child onChange={props.onPresentationChange} onHistory={props.onHistory} />
    </section>
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
        titleHint: { default: "" as const },
        presentation: { default: "modern" as const, values: ["modern", "simple", "link"] as const }
      },
      content: "none" as const
    },
    {
      meta: interactiveBlockMeta,
      render: (props): ReactElement => (
        <ChildPageView runtime={runtime} block={props.block} onPresentationChange={props.editor.isEditable ? value => {
          const live = props.editor.getBlock(props.block.id);
          if (!props.editor.isEditable || !live || live.type !== props.block.type || live.props.pageId !== props.block.props.pageId) throw new Error("Page reference changed");
          props.editor.updateBlock(props.block.id, { props: { presentation: value as typeof props.block.props.presentation } });
        } : undefined} onHistory={props.editor.isEditable ? redo => { if (props.editor.isEditable && !props.editor.prosemirrorView.composing) { if (redo) props.editor.redo(); else props.editor.undo(); } } : undefined} />
      )
    }
  )();
}
