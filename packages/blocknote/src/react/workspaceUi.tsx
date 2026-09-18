/**
 * Minimal React surfaces for workspace content primitives (Phase 4F-2B).
 * Hosts should style/customize; these prove the contracts.
 */
import type {
  BacklinkProvider,
  EditorPageLink,
  PageId
} from "@hello-ai-company/editor-core";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement
} from "react";
import type { RelationIndex } from "../workspace/relationIndex.js";

export type PageMentionPickerProps = {
  pages: readonly EditorPageLink[];
  open: boolean;
  excludeIds?: readonly string[];
  onPick: (page: EditorPageLink | null) => void;
  onQueryChange?: (query: string) => void;
  title?: string;
};

export function PageMentionPicker(
  props: PageMentionPickerProps
): ReactElement | null {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const exclude = new Set(props.excludeIds ?? []);
    return props.pages.filter((page) => {
      if (exclude.has(page.id)) return false;
      if (!q) return true;
      return (
        page.title.toLowerCase().includes(q) ||
        page.id.toLowerCase().includes(q)
      );
    });
  }, [props.excludeIds, props.pages, query]);

  if (!props.open) return null;

  return (
    <div
      className="oe-page-picker"
      role="dialog"
      aria-label={props.title ?? "Pick a page"}
    >
      <input
        className="oe-page-picker__input"
        value={query}
        placeholder="Search pages…"
        aria-label="Search pages"
        onChange={(event) => {
          setQuery(event.target.value);
          props.onQueryChange?.(event.target.value);
        }}
        autoFocus
      />
      <ul className="oe-page-picker__list" role="listbox">
        {filtered.map((page) => (
          <li key={page.id}>
            <button
              type="button"
              role="option"
              onClick={() => props.onPick(page)}
            >
              <span className="oe-page-picker__title">{page.title}</span>
              {page.preview ? (
                <span className="oe-page-picker__preview">{page.preview}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => props.onPick(null)}>
        Cancel
      </button>
    </div>
  );
}

export type BacklinksPanelProps = {
  targetPageId: PageId;
  provider?: BacklinkProvider;
  /** Local outgoing edges for contrast with host backlinks. */
  relationIndex?: RelationIndex;
  title?: string;
};

export function BacklinksPanel(props: BacklinksPanelProps): ReactElement {
  const [incoming, setIncoming] = useState<
    Array<{
      sourceDocumentId: string;
      sourceBlockId?: string;
      sourceTitle?: string;
      kind: string;
    }>
  >([]);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!props.relationIndex) return;
    return props.relationIndex.subscribe(() => {
      setRevision(props.relationIndex!.getRevision());
    });
  }, [props.relationIndex]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await props.provider?.listBacklinks?.({
        targetType: "page",
        targetId: props.targetPageId
      });
      if (!cancelled) setIncoming(list ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.provider, props.targetPageId]);

  const outgoing = useMemo(() => {
    void revision;
    return (
      props.relationIndex?.listOutgoingTo("page", props.targetPageId) ?? []
    );
  }, [props.relationIndex, props.targetPageId, revision]);

  return (
    <aside className="oe-backlinks" aria-label={props.title ?? "Relations"}>
      <h3 className="oe-backlinks__title">{props.title ?? "Relations"}</h3>
      <section>
        <h4>Outgoing (this document)</h4>
        {outgoing.length === 0 ? (
          <p className="oe-backlinks__empty">No outgoing page edges</p>
        ) : (
          <ul>
            {outgoing.map((edge) => (
              <li key={edge.edgeId ?? `${edge.kind}:${edge.targetId}`}>
                {edge.kind} → {edge.targetId}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h4>Incoming (host backlinks)</h4>
        {incoming.length === 0 ? (
          <p className="oe-backlinks__empty">No backlinks from host</p>
        ) : (
          <ul>
            {incoming.map((edge, index) => (
              <li key={`${edge.sourceDocumentId}:${index}`}>
                {edge.sourceTitle ?? edge.sourceDocumentId}
                {edge.kind ? ` (${edge.kind})` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="oe-backlinks__footnote">
        Editors own outgoing RelationIndex; hosts own workspace backlinks.
      </p>
    </aside>
  );
}

export type UsePageLinksOptions = {
  listLinks: () => Promise<EditorPageLink[]>;
  refreshToken?: number;
};

export function usePageLinks(options: UsePageLinksOptions): {
  pages: EditorPageLink[];
  reload: () => Promise<void>;
} {
  // Depend on stable primitive members — a fresh options object each render
  // must not recreate reload / re-fetch forever.
  const { listLinks, refreshToken } = options;
  const [pages, setPages] = useState<EditorPageLink[]>([]);
  const reload = useCallback(async () => {
    const next = await listLinks();
    setPages(next);
  }, [listLinks]);

  useEffect(() => {
    void reload();
  }, [reload, refreshToken]);

  return { pages, reload };
}
