import { createReactBlockSpec } from "@blocknote/react";
import {
  isEditorDocument,
  type EditorBlock,
  type EditorDocument,
  type JsonValue
} from "@hello-ai-company/editor-core";
import { useEffect, useState, type ReactElement } from "react";
import { headingLevelFromBlock } from "../index/textFromBlock.js";
import { PAGE_TRANSCLUSION_TYPE } from "./types.js";

export const MAX_PAGE_TRANSCLUSION_DEPTH = 3;
const MAX_PAGE_TRANSCLUSIONS = 16;
export const MAX_PAGE_TRANSCLUSION_CHARACTERS = 20_000;
export const MAX_PAGE_TRANSCLUSION_BLOCKS = 1_000;
const MAX_PAGE_TRANSCLUSION_TITLE_CHARACTERS = 256;
const MAX_TEXT_NODES = 50_000;
const TEXT_SEPARATOR = Symbol("text-separator");

export type PageTransclusionSource = {
  pageId: string;
  title: string;
  document: EditorDocument;
};

export type PageTransclusionRuntime = {
  /** Host callback must re-authorize every read and return only the current projection. */
  loadCurrentProjection?: (pageId: string) => Promise<PageTransclusionSource | null>;
  /** Include the containing page so direct self-references are caught immediately. */
  currentPageId?: string;
};

export type ProjectedBlock = {
  block: EditorBlock;
  text: string;
  children: ProjectedBlock[];
  transclusion?: PageTransclusionContent;
};

export type PageTransclusionContent = {
  pageId: string;
  title: string;
  status: "ready" | "missing" | "unavailable" | "cycle" | "depth-limit" | "size-limit";
  blocks: ProjectedBlock[];
  truncated?: boolean;
};

function readPageId(block: EditorBlock): string {
  const value = block.props?.pageId;
  return typeof value === "string" ? value.trim() : "";
}

function boundedTextFromBlock(block: EditorBlock, limit: number): { text: string; truncated: boolean } {
  const pending: Array<JsonValue | typeof TEXT_SEPARATOR> =
    block.content === undefined ? [] : [block.content];
  let text = "";
  let visited = 0;
  let truncated = false;
  while (pending.length > 0 && text.length < limit && visited < MAX_TEXT_NODES) {
    const value = pending.pop();
    if (value === undefined) continue;
    visited += 1;
    if (value === TEXT_SEPARATOR) {
      if (text.length < limit) text += " ";
    } else if (typeof value === "string") {
      const remaining = limit - text.length;
      text += value.slice(0, remaining);
      truncated ||= value.length > remaining;
    } else if (typeof value === "number" || typeof value === "boolean") {
      const stringValue = String(value);
      const remaining = limit - text.length;
      text += stringValue.slice(0, remaining);
      truncated ||= stringValue.length > remaining;
    } else if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i -= 1) pending.push(value[i]!);
    } else if (value !== null) {
      if (typeof value.text === "string") {
        const remaining = limit - text.length;
        text += value.text.slice(0, remaining);
        truncated ||= value.text.length > remaining;
      } else if (value.content !== undefined) {
        pending.push(value.content);
      } else {
        const values = Object.values(value);
        for (let i = values.length - 1; i >= 0; i -= 1) {
          pending.push(values[i]!);
          if (i > 0) pending.push(TEXT_SEPARATOR);
        }
      }
    }
  }
  truncated ||= pending.length > 0;
  if (text.trim()) return { text, truncated };
  for (const key of ["title", "name", "label", "caption", "text", "code"]) {
    const value = block.props?.[key];
    if (typeof value === "string" && value.trim()) {
      return { text: value.slice(0, limit), truncated: value.length > limit };
    }
  }
  return { text: "", truncated };
}

/** Expand current page references into a bounded, read-only text projection. */
export async function loadPageTransclusion(
  pageId: string,
  runtime: PageTransclusionRuntime
): Promise<PageTransclusionContent> {
  const budget = { pages: 0, blocks: 0, characters: 0, truncated: false };
  const ancestors = new Set(runtime.currentPageId ? [runtime.currentPageId] : []);

  async function loadPage(
    targetId: string,
    path: ReadonlySet<string>,
    depth: number
  ): Promise<PageTransclusionContent> {
    const result = (status: PageTransclusionContent["status"]): PageTransclusionContent => ({
      pageId: targetId,
      title: status === "missing" ? "Page unavailable" : "Linked page",
      status,
      blocks: []
    });
    if (!targetId) return result("missing");
    if (path.has(targetId)) return result("cycle");
    if (depth >= MAX_PAGE_TRANSCLUSION_DEPTH) return result("depth-limit");
    if (budget.pages >= MAX_PAGE_TRANSCLUSIONS) return result("size-limit");
    if (!runtime.loadCurrentProjection) return result("unavailable");

    budget.pages += 1;
    let source: PageTransclusionSource | null;
    try {
      source = await runtime.loadCurrentProjection(targetId);
    } catch {
      return result("unavailable");
    }
    if (source === null) return result("missing");
    if (
      source.pageId !== targetId ||
      typeof source.title !== "string" ||
      !isEditorDocument(source.document)
    ) {
      return result("unavailable");
    }

    const nextPath = new Set(path);
    nextPath.add(targetId);
    const rawTitle = source.title.trim() || "Untitled";
    const titleRemaining = Math.max(0, MAX_PAGE_TRANSCLUSION_CHARACTERS - budget.characters);
    const title = rawTitle.slice(0, Math.min(MAX_PAGE_TRANSCLUSION_TITLE_CHARACTERS, titleRemaining));
    budget.characters += title.length;
    budget.truncated ||= title.length < rawTitle.length;
    const blocks = await projectBlocks(source.document.blocks, nextPath, depth);
    return {
      pageId: targetId,
      title,
      status: "ready",
      blocks,
      truncated: budget.truncated
    };
  }

  async function projectBlocks(
    blocks: readonly EditorBlock[],
    path: ReadonlySet<string>,
    depth: number
  ): Promise<ProjectedBlock[]> {
    const projected: ProjectedBlock[] = [];
    for (const block of blocks) {
      if (budget.blocks >= MAX_PAGE_TRANSCLUSION_BLOCKS) {
        budget.truncated = true;
        break;
      }
      if (budget.characters >= MAX_PAGE_TRANSCLUSION_CHARACTERS) {
        budget.truncated = true;
        break;
      }
      budget.blocks += 1;
      if (block.type === PAGE_TRANSCLUSION_TYPE) {
        const targetId = readPageId(block);
        projected.push({
          block,
          text: "",
          children: [],
          transclusion: await loadPage(targetId, path, depth + 1)
        });
      } else {
        const remaining = MAX_PAGE_TRANSCLUSION_CHARACTERS - budget.characters;
        const projection = boundedTextFromBlock(block, remaining);
        const text = projection.text;
        budget.characters += text.length;
        budget.truncated ||= projection.truncated;
        projected.push({
          block,
          text,
          children: block.children
            ? await projectBlocks(block.children, path, depth)
            : []
        });
      }
    }
    return projected;
  }

  return loadPage(pageId.trim(), ancestors, 0);
}

function renderProjectedBlocks(blocks: readonly ProjectedBlock[]): ReactElement[] {
  return blocks.map((item) => {
    if (item.transclusion) {
      const content = item.transclusion;
      return (
        <section className="oe-page-transclusion__nested" key={item.block.id}>
          <h4>{content.title}</h4>
          {content.status === "ready"
            ? <>{renderProjectedBlocks(content.blocks)}{content.truncated ? <p role="note">Projection truncated at the size limit.</p> : null}</>
            : <p role="note">{placeholderFor(content.status)}</p>}
        </section>
      );
    }
    const level = headingLevelFromBlock(item.block);
    const text = item.text ? <p>{item.text}</p> : null;
    const content = level ? <h3>{item.text || "Untitled heading"}</h3> : text;
    return (
      <div className="oe-page-transclusion__block" data-block-type={item.block.type} key={item.block.id}>
        {content}
        {item.children.length ? renderProjectedBlocks(item.children) : null}
      </div>
    );
  });
}

function placeholderFor(status: PageTransclusionContent["status"]): string {
  switch (status) {
    case "missing": return "Page unavailable";
    case "cycle": return "Circular reference omitted";
    case "depth-limit": return "Further linked content omitted";
    case "size-limit": return "Projection limit reached";
    case "unavailable": return "Content unavailable";
    case "ready": return "";
  }
}

function PageTransclusionView(props: {
  runtime: PageTransclusionRuntime;
  block: { props: { pageId: string } };
}): ReactElement {
  const [content, setContent] = useState<PageTransclusionContent | null>(null);
  const [refresh, setRefresh] = useState(0);
  const { pageId } = props.block.props;

  useEffect(() => {
    let active = true;
    setContent(null);
    void loadPageTransclusion(pageId, props.runtime).then((next) => {
      if (active) setContent(next);
    });
    return () => { active = false; };
  }, [pageId, props.runtime, refresh]);

  return (
    <section className="oe-page-transclusion" aria-label={`Embedded page: ${content?.title || "Linked page"}`}>
      <header className="oe-page-transclusion__header">
        <strong>{content?.title || "Linked page"}</strong>
        <button type="button" onClick={() => setRefresh((value) => value + 1)}>Refresh</button>
      </header>
      {content === null ? <p role="status">Loading linked content…</p> : content.status === "ready"
        ? <div className="oe-page-transclusion__content">{renderProjectedBlocks(content.blocks)}{content.truncated ? <p role="note">Projection truncated at the size limit.</p> : null}</div>
        : <p role="note">{placeholderFor(content.status)}</p>}
    </section>
  );
}

export function createPageTransclusionBlockSpec(runtime: PageTransclusionRuntime = {}) {
  return createReactBlockSpec(
    {
      type: PAGE_TRANSCLUSION_TYPE,
      propSchema: {
        pageId: { default: "" as const }
      },
      content: "none" as const
    },
    {
      render: (props): ReactElement => (
        <PageTransclusionView runtime={runtime} block={props.block} />
      )
    }
  )();
}
