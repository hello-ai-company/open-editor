import { ReferencePresentation } from "./referencePresentation.js";
import { createReactBlockSpec } from "@blocknote/react";
import { interactiveBlockMeta } from "../document/widgetInteraction.js";
import type { PageId } from "@hello-ai-company/editor-core";
import { useEffect, useSyncExternalStore, type ReactElement } from "react";
import { PageRuntimeAccessDeniedError, type PageRuntimeStore } from "./pageRuntimeStore.js";
import { PAGE_CARD_TYPE } from "./types.js";
import { isSafeMediaUrl } from "../security/safeUrl.js";

export type PageCardResolveResult = {
  title: string;
  preview?: string;
  imageUrl?: string;
  imageAlt?: string;
  missing?: boolean;
  loading?: boolean;
  error?: boolean;
  unavailable?: boolean;
  forbidden?: boolean;
};

export type PageCardRuntime = {
  /** Preferred: instance-scoped metadata store. */
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

export type PageCardDisplay = {
  title: string;
  preview?: string;
  imageUrl?: string;
  imageAlt?: string;
  missing: boolean;
  loading: boolean;
  error: boolean;
  /** Additive state; missing is reserved for an explicit missing result. */
  status?: "empty" | "loading" | "ready" | "missing" | "unavailable" | "forbidden" | "error";
  statusLabel?: string;
};

/** Pure display resolve — used by render and isolation tests. */
export function resolvePageCardDisplay(
  runtime: PageCardRuntime,
  pageId: string,
  titleHint = ""
): PageCardDisplay {
  type Status = NonNullable<PageCardDisplay["status"]>;
  const unavailable = (status: Exclude<Status, "ready">, storedLabel?: string): PageCardDisplay => {
    storedLabel = storedLabel?.trim() || undefined;
    const label = status === "missing" ? runtime.missingLabel ?? storedLabel ?? "Missing page"
      : status === "error" ? runtime.errorLabel ?? storedLabel ?? "Unable to load page"
      : status === "forbidden" ? runtime.forbiddenLabel ?? storedLabel ?? "Page access restricted"
      : status === "empty" ? runtime.emptyLabel ?? "No page selected"
      : status === "loading" ? "Loading page"
      : runtime.unavailableLabel ?? storedLabel ?? "Page information unavailable";
    return { title: status === "missing" ? label : titleHint || (status === "loading" ? runtime.untitledLabel ?? "Untitled" : label), missing: status === "missing", loading: status === "loading", error: status === "error", status, statusLabel: label };
  };
  if (!pageId) return unavailable("empty");
  let resolved: PageCardResolveResult | null;
  if (runtime.store) {
    const snap = runtime.store.get(pageId);
    if (snap.status !== "ready") return unavailable(snap.status === "idle" ? "loading" : snap.status, snap.title);
    resolved = snap;
  } else {
    if (!runtime.resolve) return unavailable("unavailable");
    try { resolved = runtime.resolve(pageId); }
    catch (reason) { return unavailable(reason instanceof PageRuntimeAccessDeniedError ? "forbidden" : "error"); }
    if (!resolved) return unavailable("missing");
    if (resolved.forbidden) return unavailable("forbidden", resolved.title);
    if (resolved.error) return unavailable("error", resolved.title);
    if (resolved.loading) return unavailable("loading");
    if (resolved.unavailable) return unavailable("unavailable", resolved.title);
    if (resolved.missing) return unavailable("missing", resolved.title || undefined);
  }
  return { title: resolved.title.trim() || titleHint || runtime.untitledLabel || "Untitled", preview: resolved.preview,
    imageUrl: isSafeMediaUrl(resolved.imageUrl) ? resolved.imageUrl.trim() : undefined, imageAlt: resolved.imageAlt,
    missing: false, loading: false, error: false, status: "ready" };
}

function PageCardView(props: {
  runtime: PageCardRuntime;
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

  const presentation = block.props.presentation ?? "modern";
  return (
    <section className="oe-reference-block" data-presentation={presentation}>
    <button
      type="button"
      className={`oe-page-card${stateClass}`}
      data-oe-page-card={pageId}
      data-missing={display.missing ? "true" : "false"}
      data-loading={display.loading ? "true" : "false"}
      data-error={display.error ? "true" : "false"}
      data-status={display.status}
      aria-label={display.statusLabel && display.statusLabel !== display.title ? `${display.title}: ${display.statusLabel}` : display.title}
      aria-busy={display.loading || undefined}
      disabled={display.status !== "ready" || !runtime.onOpen}
      onClick={(event) => {
        event.preventDefault();
        if (display.status === "ready") runtime.onOpen?.(pageId);
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
      {display.statusLabel && display.statusLabel !== display.title ? <span className="oe-page-card__status" role="status">{display.statusLabel}</span> : null}
      {display.preview && !display.loading ? (
        <span className="oe-page-card__preview">{display.preview}</span>
      ) : null}
    </button>
    <ReferencePresentation value={presentation} onChange={props.onPresentationChange} onHistory={props.onHistory} />
    </section>
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
        titleHint: { default: "" as const },
        presentation: { default: "modern" as const, values: ["modern", "simple"] as const }
      },
      content: "none" as const
    },
    {
      meta: interactiveBlockMeta,
      render: (props): ReactElement => (
        <PageCardView runtime={runtime} block={props.block} onPresentationChange={props.editor.isEditable ? value => {
          const live = props.editor.getBlock(props.block.id);
          if (!props.editor.isEditable || !live || live.type !== props.block.type || live.props.pageId !== props.block.props.pageId) throw new Error("Page reference changed");
          props.editor.updateBlock(props.block.id, { props: { presentation: value as typeof props.block.props.presentation } });
        } : undefined} onHistory={props.editor.isEditable ? redo => { if (props.editor.isEditable && !props.editor.prosemirrorView.composing) { if (redo) props.editor.redo(); else props.editor.undo(); } } : undefined} />
      )
    }
  )();
}
