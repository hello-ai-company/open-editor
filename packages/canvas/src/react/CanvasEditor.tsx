import { createElement, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactElement } from "react";
import type { EditorBlock, EditorDocument } from "@hello-ai-company/editor-core";
import {
  CANVAS_THEME_PRESETS,
  validateCanvasLayoutSpec,
  type CanvasBreakpoint,
  type CanvasBlockElementRef,
  type CanvasLayoutNode,
  type CanvasLayoutSpec,
  type CanvasTheme,
  type CanvasThemeTokens
} from "../index.js";
import {
  findCanvasNode,
  flattenCanvasNodes,
  getCanvasGapNode,
  resolveResponsiveValue
} from "../layoutOperations.js";
import { CanvasInspector, type CanvasInspectorModel } from "./CanvasInspector.js";
import { findAbsoluteItem, nodeLabel, updateAbsoluteItemRect } from "./canvasEditorUtils.js";

export type CanvasAlignment = "left" | "center" | "right" | "stretch";

export type CanvasEditorViewState = {
  selectedNodeId: string | null;
  hiddenNodeIds: readonly string[];
  lockedNodeIds: readonly string[];
  alignmentByNodeId: Readonly<Record<string, CanvasAlignment>>;
  breakpoint: CanvasBreakpoint;
};

export type CanvasEditorProps = {
  document: EditorDocument;
  spec: CanvasLayoutSpec;
  /** Supply to persist selection, visibility, lock, alignment, and preview state in the host. */
  viewState?: Partial<CanvasEditorViewState>;
  onViewStateChange?: (state: CanvasEditorViewState) => void;
  /** When omitted, layout edits stay in this component's local state. */
  onLayoutChange?: (spec: CanvasLayoutSpec) => void;
  onThemeChange?: (theme: CanvasTheme, spec: CanvasLayoutSpec) => void;
  className?: string;
};

type LayerItem = { node: CanvasLayoutNode; depth: number };

const MAX_PREVIEW_TEXT = 4000;
const EMPTY_CANVAS_SPEC: CanvasLayoutSpec = {
  template: "report",
  breakpoints: { tablet: 768, desktop: 1024 },
  theme: "minimal",
  root: { id: "canvas:empty", type: "stack", direction: "vertical", children: [] }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractText(value: unknown): string {
  const parts: string[] = [];
  let remaining = MAX_PREVIEW_TEXT;
  function visit(current: unknown): void {
    if (remaining <= 0) return;
    if (typeof current === "string") {
      const text = current.slice(0, remaining);
      parts.push(text);
      remaining -= text.length;
      return;
    }
    if (Array.isArray(current)) {
      for (const entry of current) visit(entry);
      return;
    }
    if (!isRecord(current)) return;
    if (current.type === "pageMention" && isRecord(current.props) && typeof current.props.pageId === "string") {
      visit(`@${current.props.pageId}`);
      return;
    }
    if (current.type === "blockReference" && isRecord(current.props) && typeof current.props.blockId === "string") {
      visit(`→ ${current.props.blockId}`);
      return;
    }
    if (current.type === "databaseRelation" && isRecord(current.props) && typeof current.props.databaseId === "string" && typeof current.props.rowId === "string") {
      visit(`↗ ${current.props.databaseId}/${current.props.rowId}`);
      return;
    }
    if (typeof current.text === "string") {
      visit(current.text);
      if (Array.isArray(current.content)) visit(current.content);
      return;
    }
    if (Array.isArray(current.content)) visit(current.content);
    else if (Array.isArray(current.children)) visit(current.children);
    else if (typeof current.value === "string") visit(current.value);
  }
  visit(value);
  return parts.join("");
}

function flattenDocument(blocks: readonly EditorBlock[]): Map<string, EditorBlock> {
  const result = new Map<string, EditorBlock>();
  const pending = [...blocks].reverse();
  const visited = new WeakSet<object>();
  while (pending.length > 0 && result.size < 10000) {
    const block = pending.pop();
    if (!block) continue;
    if (visited.has(block)) continue;
    visited.add(block);
    result.set(block.id, block);
    const children = block.children ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child) pending.push(child);
    }
  }
  return result;
}

function collectReferences(root: CanvasLayoutNode): Set<string> {
  const references = new Set<string>();
  for (const node of flattenCanvasNodes(root)) {
    if ("blockId" in node && node.blockId) references.add(node.blockId);
  }
  return references;
}

function layers(root: CanvasLayoutNode): LayerItem[] {
  const result: LayerItem[] = [];
  const pending: LayerItem[] = [{ node: root, depth: 0 }];
  const visited = new WeakSet<object>();
  while (pending.length > 0 && result.length < 1000) {
    const entry = pending.pop();
    if (!entry) continue;
    if (visited.has(entry.node)) continue;
    visited.add(entry.node);
    result.push(entry);
    let children: CanvasLayoutNode[] = [];
    const node = entry.node;
    if (node.type === "stack" || node.type === "grid" || node.type === "section" || node.type === "frame") {
      children = node.children;
    } else if (node.type === "columns") {
      children = node.columns.flat();
    } else if (node.type === "absolute") {
      children = node.items.map(({ element }) => element);
    }
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child) pending.push({ node: child, depth: entry.depth + 1 });
    }
  }
  return result;
}

function collectLockedNodes(root: CanvasLayoutNode, lockedIds: ReadonlySet<string>): Set<string> {
  const locked = new Set<string>();
  const pending: Array<{ node: CanvasLayoutNode; ancestorLocked: boolean }> = [{ node: root, ancestorLocked: false }];
  const visited = new WeakSet<object>();
  let count = 0;
  while (pending.length > 0 && count < 1000) {
    const entry = pending.pop();
    if (!entry || visited.has(entry.node)) continue;
    visited.add(entry.node);
    count += 1;
    const isLocked = entry.ancestorLocked || lockedIds.has(entry.node.id);
    if (isLocked) locked.add(entry.node.id);
    let children: CanvasLayoutNode[] = [];
    const node = entry.node;
    if (node.type === "stack" || node.type === "grid" || node.type === "section" || node.type === "frame") children = node.children;
    else if (node.type === "columns") children = node.columns.flat();
    else if (node.type === "absolute") children = node.items.map(({ element }) => element);
    for (const child of children) pending.push({ node: child, ancestorLocked: isLocked });
  }
  return locked;
}

function isContainer(node: CanvasLayoutNode): boolean {
  return node.type === "stack" || node.type === "grid" || node.type === "columns" || node.type === "section" || node.type === "frame";
}

function isBlockElement(node: CanvasLayoutNode): node is CanvasBlockElementRef {
  return ["text", "image", "card", "divider", "button", "chart", "embed"].includes(node.type);
}

function getThemeTokens(theme: CanvasTheme): CanvasThemeTokens {
  return typeof theme === "string" ? CANVAS_THEME_PRESETS[theme] : theme;
}

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)?.map((part) => parseInt(part, 16) / 255) ?? [0, 0, 0];
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function accentTextColor(accent: string): string {
  const background = luminance(accent);
  const dark = (background + 0.05) / (luminance("#111827") + 0.05);
  const light = 1.05 / (background + 0.05);
  return dark >= light ? "#111827" : "#FFFFFF";
}

function themeStyle(tokens: CanvasThemeTokens): CSSProperties {
  const fonts: Record<CanvasThemeTokens["fonts"]["body"], string> = {
    sans: "ui-sans-serif, system-ui, sans-serif",
    serif: "ui-serif, Georgia, serif",
    mono: "ui-monospace, SFMono-Regular, monospace"
  };
  return {
    "--oe-canvas-bg": tokens.colors.background,
    "--oe-canvas-surface": tokens.colors.surface,
    "--oe-canvas-text": tokens.colors.text,
    "--oe-canvas-muted": tokens.colors.muted,
    "--oe-canvas-accent": tokens.colors.accent,
    "--oe-canvas-accent-ink": accentTextColor(tokens.colors.accent),
    "--oe-canvas-border": tokens.colors.border,
    "--oe-canvas-radius": `${tokens.radius}px`,
    "--oe-canvas-max-width": `${tokens.maxWidth}px`,
    "--oe-canvas-body-font": fonts[tokens.fonts.body],
    "--oe-canvas-heading-font": fonts[tokens.fonts.heading],
    "--oe-canvas-body-scale": tokens.typeScale.body,
    "--oe-canvas-heading-scale": tokens.typeScale.heading,
    "--oe-canvas-space-xs": `${tokens.spacing.xs}px`,
    "--oe-canvas-space-sm": `${tokens.spacing.sm}px`,
    "--oe-canvas-space-md": `${tokens.spacing.md}px`,
    "--oe-canvas-space-lg": `${tokens.spacing.lg}px`,
    "--oe-canvas-space-xl": `${tokens.spacing.xl}px`
  } as CSSProperties;
}

function safeImageSource(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 4096) return undefined;
  try {
    const url = new URL(value);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function contentForBlock(block: EditorBlock, references: ReadonlySet<string>): ReactElement {
  const text = extractText(block.content) || extractText(block.props?.text);
  const type = block.type.toLowerCase();
  let main: ReactElement;
  if (type === "divider" || type === "horizontalrule") {
    main = <>{createElement("hr", { className: "oe-canvas__divider" })}{text ? <p>{text}</p> : null}</>;
  } else if (type === "image") {
    const src = safeImageSource(block.props?.url ?? block.props?.src);
    const alt = typeof block.props?.alt === "string" ? block.props.alt : text;
    main = src ? <figure className="oe-canvas__image"><img src={src} alt={alt} loading="lazy" decoding="async" />{text ? <figcaption>{text}</figcaption> : null}</figure> : <p className="oe-canvas__placeholder">{text || "Image unavailable"}</p>;
  } else if (type === "heading" || /^h[1-6]$/.test(type)) {
    const rawLevel = block.props?.level;
    const level = /^h[1-6]$/.test(type) ? Number(type.slice(1)) : typeof rawLevel === "number" && Number.isInteger(rawLevel) ? rawLevel : 2;
    const tag = `h${Math.min(6, Math.max(1, level))}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    main = createElement(tag, null, text);
  } else if (type === "quote" || type === "blockquote") {
    main = <blockquote>{text}</blockquote>;
  } else if (type === "code" || type === "codeblock") {
    main = <pre><code>{text}</code></pre>;
  } else if (type === "button") {
    main = <span className="oe-canvas__button-preview">{text || "Button"}</span>;
  } else if (type === "chart" || type === "chartplaceholder" || type === "embed" || type === "webembed" || type === "video" || type === "audio") {
    const label = typeof block.props?.title === "string" ? block.props.title : type === "chart" || type === "chartplaceholder" ? "Chart" : "Embed";
    main = <div className="oe-canvas__placeholder" role="img" aria-label={`${label} preview`}>{text || `${label} preview`}</div>;
  } else {
    main = <p>{text}</p>;
  }

  const unplacedChildren = (block.children ?? []).filter((child) => !references.has(child.id));
  return <>{main}{unplacedChildren.length > 0 ? <div className="oe-canvas__nested-content">{unplacedChildren.map((child) => <div className="oe-canvas__nested-block" key={child.id}>{contentForBlock(child, references)}</div>)}</div> : null}</>;
}

function renderBlockElement(
  node: CanvasBlockElementRef,
  blocks: ReadonlyMap<string, EditorBlock>,
  references: ReadonlySet<string>
): ReactElement {
  const block = blocks.get(node.blockId);
  if (!block) return <div className="oe-canvas__missing" role="note">Referenced content is unavailable.</div>;
  const content = contentForBlock(block, references);
  if (node.type === "card") return <article className="oe-canvas__card">{content}</article>;
  if (node.type === "image" && block.type.toLowerCase() !== "image") {
    const text = extractText(block.content);
    return <div className="oe-canvas__placeholder" role="img" aria-label="Image preview">{text || "Image preview"}</div>;
  }
  if (node.type === "divider") return <>{content}{extractText(block.content) ? null : <hr className="oe-canvas__divider" />}</>;
  if (node.type === "button" && block.type.toLowerCase() !== "button") return <span className="oe-canvas__button-preview">{extractText(block.content) || "Button"}</span>;
  if ((node.type === "chart" || node.type === "embed") && !["chart", "chartplaceholder", "embed", "webembed", "video", "audio"].includes(block.type.toLowerCase())) {
    return <div className="oe-canvas__placeholder" role="img" aria-label={`${node.type} preview`}>{extractText(block.content) || `${node.type} preview`}</div>;
  }
  return content;
}

function resolveAlignment(alignment: CanvasAlignment | undefined): CSSProperties {
  if (!alignment) return {};
  return {
    justifySelf: alignment === "stretch" ? "stretch" : alignment === "left" ? "start" : alignment === "right" ? "end" : "center",
    alignSelf: alignment === "stretch" ? "stretch" : alignment === "left" ? "flex-start" : alignment === "right" ? "flex-end" : "center",
    marginLeft: alignment === "center" || alignment === "right" ? "auto" : undefined,
    marginRight: alignment === "center" || alignment === "left" ? "auto" : undefined,
    textAlign: alignment === "left" || alignment === "right" ? alignment : "center"
  };
}

const CANVAS_CSS = `
.oe-canvas{--oe-canvas-ink:#202820;--oe-canvas-muted:#667167;--oe-canvas-line:#dce2dc;--oe-canvas-accent:#49765c;color:var(--oe-canvas-ink);font:14px/1.5 ui-sans-serif,system-ui,sans-serif}
.oe-canvas *{box-sizing:border-box}
.oe-canvas button,.oe-canvas select,.oe-canvas input{font:inherit}
.oe-canvas button,.oe-canvas select{color:inherit}
.oe-canvas button:focus-visible,.oe-canvas select:focus-visible,.oe-canvas input:focus-visible{outline:3px solid var(--oe-canvas-accent);outline-offset:2px}
.oe-canvas__header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:18px 20px;border:1px solid var(--oe-canvas-line);border-radius:14px 14px 0 0;background:#fbfcfa}
.oe-canvas__title{margin:0;font-size:20px;line-height:1.25;letter-spacing:-.02em}
.oe-canvas__subtitle{margin:5px 0 0;color:var(--oe-canvas-muted);font-size:13px}
.oe-canvas__preview-size,.oe-canvas__field{display:grid;gap:5px;color:var(--oe-canvas-muted);font-size:12px}
.oe-canvas__preview-size select,.oe-canvas__field input,.oe-canvas__field select{min-height:44px;border:1px solid var(--oe-canvas-line);border-radius:9px;background:#fff;padding:7px 10px;color:var(--oe-canvas-ink)}
.oe-canvas__workspace{display:grid;grid-template-columns:minmax(0,1fr) 292px;min-height:560px;border:1px solid var(--oe-canvas-line);border-top:0;border-radius:0 0 14px 14px;overflow:hidden;background:#f4f6f2}
.oe-canvas__stage{min-width:0;overflow:auto;padding:24px;background:#f4f6f2}
.oe-canvas__surface{width:100%;max-width:min(var(--oe-canvas-max-width),1120px);min-height:460px;margin:0 auto;padding:clamp(22px,4vw,60px);border-radius:var(--oe-canvas-radius);background:var(--oe-canvas-bg);color:var(--oe-canvas-text);font-family:var(--oe-canvas-body-font);font-size:calc(16px * var(--oe-canvas-body-scale));box-shadow:0 2px 12px rgb(25 35 27 / 5%)}
.oe-canvas__stage[data-breakpoint=mobile] .oe-canvas__surface{max-width:390px;padding:22px 18px;min-height:520px}
.oe-canvas__stage[data-breakpoint=tablet] .oe-canvas__surface{max-width:768px;padding:32px}
.oe-canvas__surface h1,.oe-canvas__surface h2,.oe-canvas__surface h3,.oe-canvas__surface h4,.oe-canvas__surface h5,.oe-canvas__surface h6{font-family:var(--oe-canvas-heading-font);font-size:calc(1em * var(--oe-canvas-heading-scale));line-height:1.2;margin:0 0 var(--oe-canvas-space-sm)}
.oe-canvas__surface p{margin:0 0 var(--oe-canvas-space-sm);white-space:pre-wrap;overflow-wrap:anywhere}
.oe-canvas__surface pre{white-space:pre-wrap;overflow-wrap:anywhere}
.oe-canvas__node{min-width:0;position:relative;border:1px solid transparent;border-radius:8px;cursor:pointer;transition:border-color .12s ease,background-color .12s ease}
.oe-canvas__node:hover:not([data-selected=true]){border-color:var(--oe-canvas-accent)}
.oe-canvas__node:focus-visible{outline:2px solid var(--oe-canvas-accent);outline-offset:2px;z-index:1}
.oe-canvas__node[data-selected=true]{border-color:var(--oe-canvas-accent);background:rgb(73 118 92 / 4%)}
.oe-canvas__absolute-item[draggable=true],.oe-canvas__absolute-item[draggable=true] .oe-canvas__node{cursor:grab}.oe-canvas__absolute-item[draggable=true]:active,.oe-canvas__absolute-item[draggable=true]:active .oe-canvas__node{cursor:grabbing}
.oe-canvas__node[data-hidden=true]{display:none}
.oe-canvas__node[data-locked=true]::after{content:"Locked";position:absolute;top:4px;right:6px;border-radius:5px;background:#edf0ec;color:#536057;padding:1px 6px;font:11px/1.5 ui-sans-serif,system-ui,sans-serif}
.oe-canvas__stack{display:flex;min-width:0}
.oe-canvas__grid,.oe-canvas__columns{display:grid;min-width:0}
.oe-canvas__column{display:flex;min-width:0;flex-direction:column;gap:var(--oe-canvas-space-sm)}
.oe-canvas__group{padding:var(--oe-canvas-space-md);border:1px solid var(--oe-canvas-border);border-radius:calc(var(--oe-canvas-radius) * .8);background:var(--oe-canvas-surface)}
.oe-canvas__group[data-kind=frame]{box-shadow:0 5px 18px rgb(25 35 27 / 8%)}
.oe-canvas__card{min-width:0;padding:var(--oe-canvas-space-md);border:1px solid var(--oe-canvas-border);border-radius:var(--oe-canvas-radius);background:var(--oe-canvas-surface)}
.oe-canvas__image{margin:0}.oe-canvas__image img{display:block;width:100%;height:auto;max-height:420px;object-fit:cover;border-radius:calc(var(--oe-canvas-radius) * .75)}.oe-canvas__image figcaption{margin-top:8px;color:var(--oe-canvas-muted);font-size:.9em}
.oe-canvas__divider{height:0;border:0;border-top:1px solid var(--oe-canvas-border);margin:var(--oe-canvas-space-md) 0}
.oe-canvas__button-preview{display:inline-flex;align-items:center;min-height:40px;border-radius:999px;background:var(--oe-canvas-accent);color:var(--oe-canvas-accent-ink);padding:8px 16px;font-weight:600}
.oe-canvas__placeholder{display:grid;min-height:100px;place-items:center;border:1px dashed var(--oe-canvas-border);border-radius:var(--oe-canvas-radius);background:var(--oe-canvas-surface);color:var(--oe-canvas-muted);padding:18px;text-align:center}
.oe-canvas__missing{border:1px dashed #a8793b;border-radius:8px;background:#fff9ed;color:#664616;padding:12px;font-size:13px}
.oe-canvas__nested-content{display:grid;gap:var(--oe-canvas-space-xs);margin-top:var(--oe-canvas-space-sm);padding-left:var(--oe-canvas-space-md);border-left:1px solid var(--oe-canvas-border)}
.oe-canvas__inspector{display:flex;min-width:0;flex-direction:column;gap:18px;padding:18px;border-left:1px solid var(--oe-canvas-line);background:#fff}
.oe-canvas__section{display:grid;gap:10px}.oe-canvas__section h3{margin:0;color:#29362c;font-size:13px;font-weight:650;letter-spacing:.01em}
.oe-canvas__selected{margin:0;color:var(--oe-canvas-muted);font-size:12px;overflow-wrap:anywhere}
.oe-canvas__actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.oe-canvas__actions button,.oe-canvas__alignments button{min-height:44px;border:1px solid var(--oe-canvas-line);border-radius:9px;background:#fff;padding:7px 9px;cursor:pointer}
.oe-canvas__actions button:hover:not(:disabled),.oe-canvas__alignments button:hover{background:#f5f7f4}
.oe-canvas__actions button:disabled{cursor:not-allowed;opacity:.48}
.oe-canvas__alignments{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.oe-canvas__alignments button[aria-pressed=true]{border-color:var(--oe-canvas-accent);background:#eff5f0;color:#294e35}
.oe-canvas__layers{display:grid;grid-template-columns:minmax(0,1fr);min-width:0;max-height:250px;gap:3px;overflow:auto;padding:0;margin:0;list-style:none}
.oe-canvas__layers li{min-width:0}
.oe-canvas__layers button{display:block;width:100%;min-height:44px;border:0;border-radius:7px;background:transparent;padding:6px 8px;text-align:left;color:#455149;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.oe-canvas__layers button:hover{background:#f4f6f2}.oe-canvas__layers button[aria-pressed=true]{background:#edf4ee;color:#234a31;font-weight:600}
.oe-canvas__notice{margin:0;border-radius:8px;background:#fff8e8;color:#664616;padding:10px;font-size:12px}
.oe-canvas__error{border:1px solid #d9b8b8;border-radius:10px;background:#fffafa;color:#6c2727;padding:14px}
@media(max-width:760px){.oe-canvas__header{align-items:flex-start;flex-direction:column}.oe-canvas__workspace{grid-template-columns:minmax(0,1fr)}.oe-canvas__stage{padding:14px}.oe-canvas__inspector{border-left:0;border-top:1px solid var(--oe-canvas-line)}.oe-canvas__layers{max-height:180px}}
@media(max-width:420px){.oe-canvas__actions{grid-template-columns:repeat(2,minmax(0,1fr))}.oe-canvas__surface{padding:20px 16px}}
@media(prefers-reduced-motion:reduce){.oe-canvas__node{transition:none}}
`;

function inferBreakpoint(spec: CanvasLayoutSpec): CanvasBreakpoint {
  if (!spec.breakpoints || !Number.isFinite(spec.breakpoints.tablet) || !Number.isFinite(spec.breakpoints.desktop)) return "mobile";
  if (typeof window === "undefined") return "mobile";
  if (window.innerWidth >= spec.breakpoints.desktop) return "desktop";
  if (window.innerWidth >= spec.breakpoints.tablet) return "tablet";
  return "mobile";
}

function defaultViewState(spec: CanvasLayoutSpec): CanvasEditorViewState {
  const root = isRecord(spec) ? spec.root : undefined;
  return {
    selectedNodeId: isRecord(root) && typeof root.id === "string" ? root.id : null,
    hiddenNodeIds: [],
    lockedNodeIds: [],
    alignmentByNodeId: {},
    breakpoint: "mobile"
  };
}

function normalizeViewState(
  view: Partial<CanvasEditorViewState> | undefined,
  fallback: CanvasEditorViewState
): CanvasEditorViewState {
  return {
    selectedNodeId: view?.selectedNodeId ?? fallback.selectedNodeId,
    hiddenNodeIds: view?.hiddenNodeIds ?? fallback.hiddenNodeIds,
    lockedNodeIds: view?.lockedNodeIds ?? fallback.lockedNodeIds,
    alignmentByNodeId: view?.alignmentByNodeId ?? fallback.alignmentByNodeId,
    breakpoint: view?.breakpoint ?? fallback.breakpoint
  };
}

export function CanvasEditor(props: CanvasEditorProps): ReactElement {
  const headingId = useId().replaceAll(":", "");
  const draggedNodeId = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [internalSpec, setInternalSpec] = useState(props.spec);
  const [internalView, setInternalView] = useState(() => defaultViewState(props.spec));
  const spec = props.onLayoutChange ? props.spec : internalSpec;
  const validationIssues = useMemo(
    () => validateCanvasLayoutSpec(spec, props.document),
    [spec, props.document]
  );
  const fatalIssues = validationIssues.filter(({ code }) => code !== "MISSING_BLOCK_REFERENCE");
  const renderSpec = fatalIssues.length === 0 ? spec : EMPTY_CANVAS_SPEC;
  const sourceBlocks = fatalIssues.length === 0 && isRecord(props.document) && Array.isArray(props.document.blocks) ? props.document.blocks as EditorBlock[] : [];
  const view = normalizeViewState(props.viewState, internalView);
  useEffect(() => {
    if (props.viewState?.breakpoint !== undefined || typeof window === "undefined") return;
    const syncBreakpoint = () => {
      const breakpoint = inferBreakpoint(renderSpec);
      setInternalView((current) => current.breakpoint === breakpoint ? current : { ...current, breakpoint });
    };
    syncBreakpoint();
    window.addEventListener("resize", syncBreakpoint);
    return () => window.removeEventListener("resize", syncBreakpoint);
  }, [props.viewState?.breakpoint, renderSpec.breakpoints]);
  useEffect(() => {
    if (!props.onLayoutChange) setInternalSpec(props.spec);
  }, [props.onLayoutChange, props.spec]);
  const blocks = useMemo(() => flattenDocument(sourceBlocks), [sourceBlocks]);
  const references = useMemo(() => collectReferences(renderSpec.root), [renderSpec.root]);
  const layerItems = useMemo(() => layers(renderSpec.root), [renderSpec.root]);
  const selectedId = findCanvasNode(renderSpec.root, view.selectedNodeId ?? "") ? view.selectedNodeId! : renderSpec.root.id;
  const selectedNode = findCanvasNode(renderSpec.root, selectedId) ?? renderSpec.root;
  const hidden = new Set(view.hiddenNodeIds);
  const locked = collectLockedNodes(renderSpec.root, new Set(view.lockedNodeIds));
  const directlyLocked = view.lockedNodeIds.includes(selectedNode.id);
  const isLocked = locked.has(selectedNode.id);
  const isRoot = selectedNode.id === renderSpec.root.id;
  const gapNode = getCanvasGapNode(renderSpec.root, selectedNode.id);
  const resolvedGap = gapNode ? resolveResponsiveValue(gapNode.gap, view.breakpoint) ?? 16 : 16;
  const absoluteItem = findAbsoluteItem(renderSpec.root, selectedNode.id);
  const absoluteRect = absoluteItem ? resolveResponsiveValue(absoluteItem.rect, view.breakpoint) ?? absoluteItem.rect.mobile : undefined;
  const theme = getThemeTokens(renderSpec.theme);
  const themeVars = themeStyle(theme);
  const selectedSubtreeIds = new Set(flattenCanvasNodes(selectedNode).map(({ id }) => id));
  const previewDestinationCandidates = layerItems.filter(({ node }) => {
    if (!isContainer(node)) return false;
    if (node.id === selectedNode.id) return false;
    return !selectedSubtreeIds.has(node.id) && !locked.has(node.id);
  });

  function updateView(patch: Partial<CanvasEditorViewState>): void {
    const next = { ...view, ...patch };
    if (!props.viewState) setInternalView(next);
    props.onViewStateChange?.(next);
  }

  function updateSpec(next: CanvasLayoutSpec, changedTheme = false): void {
    if (!props.onLayoutChange) setInternalSpec(next);
    props.onLayoutChange?.(next);
    if (changedTheme) props.onThemeChange?.(next.theme, next);
  }

  function handlePreviewKeyDown(nodeId: string, event: KeyboardEvent<HTMLElement>): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      updateView({ selectedNodeId: nodeId });
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    const preview = event.currentTarget.closest(".oe-canvas__surface");
    // ponytail: linear DOM scan follows preview order under the 1,000-node layout cap; index it only if key navigation measures slow.
    const visibleNodes = Array.from(preview?.querySelectorAll<HTMLElement>("[data-canvas-node-id]") ?? []);
    const index = visibleNodes.findIndex((entry) => entry.dataset.canvasNodeId === nodeId);
    if (index < 0 || visibleNodes.length < 2) return;
    event.preventDefault();
    event.stopPropagation();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const next = visibleNodes[(index + direction + visibleNodes.length) % visibleNodes.length]!;
    const nextId = next.dataset.canvasNodeId;
    if (!nextId) return;
    updateView({ selectedNodeId: nextId });
    next.focus();
  }

  function renderNode(node: CanvasLayoutNode, depth = 1): ReactElement | null {
    if (hidden.has(node.id)) return null;
    const selected = node.id === selectedId;
    const lockedNode = locked.has(node.id);
    const hasChildren = isContainer(node) || node.type === "absolute";
    const alignment = resolveAlignment(view.alignmentByNodeId[node.id]);
    const wrapperProps = {
      className: "oe-canvas__node",
      "data-canvas-node-id": node.id,
      "data-selected": selected ? "true" : "false",
      "data-locked": lockedNode ? "true" : "false",
      role: "treeitem",
      "aria-level": depth,
      "aria-label": `Select ${nodeLabel(node)}${lockedNode ? ", locked" : ""}`,
      "aria-selected": selected,
      "aria-expanded": hasChildren ? true : undefined,
      "aria-keyshortcuts": "Enter Space ArrowUp ArrowDown",
      tabIndex: selected ? 0 : -1,
      onClick: (event: MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        updateView({ selectedNodeId: node.id });
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => handlePreviewKeyDown(node.id, event),
      style: alignment
    };

    if (node.type === "stack") {
      const gap = resolveResponsiveValue(node.gap, view.breakpoint) ?? 0;
      const padding = resolveResponsiveValue(node.padding, view.breakpoint) ?? 0;
      const direction = node.direction === "horizontal" && view.breakpoint !== "mobile" ? "row" : "column";
      return <div key={node.id} {...wrapperProps} style={alignment}><div className="oe-canvas__stack" role="group" style={{ flexDirection: direction, gap, padding }}>{node.children.map((child) => renderNode(child, depth + 1))}</div></div>;
    }
    if (node.type === "grid") {
      const columns = resolveResponsiveValue(node.columns, view.breakpoint) ?? 1;
      const gap = resolveResponsiveValue(node.gap, view.breakpoint) ?? 0;
      return <div key={node.id} {...wrapperProps} style={alignment}><div className="oe-canvas__grid" role="group" style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`, gap }}>{node.children.map((child) => renderNode(child, depth + 1))}</div></div>;
    }
    if (node.type === "columns") {
      const columnCount = view.breakpoint === "mobile" ? 1 : view.breakpoint === "tablet" ? Math.min(2, node.columns.length) : node.columns.length;
      const gap = resolveResponsiveValue(node.gap, view.breakpoint) ?? 0;
      return <div key={node.id} {...wrapperProps} style={alignment}><div className="oe-canvas__columns" role="group" style={{ gridTemplateColumns: `repeat(${columnCount},minmax(0,1fr))`, gap }}>{node.columns.map((column, index) => <div className="oe-canvas__column" role="group" key={`column-${index}`}>{column.map((child) => renderNode(child, depth + 1))}</div>)}</div></div>;
    }
    if (node.type === "section" || node.type === "frame") {
      return <div key={node.id} {...wrapperProps} style={alignment}><div className="oe-canvas__group" role="group" data-kind={node.type} style={node.type === "frame" ? { boxShadow: "0 5px 18px rgb(25 35 27 / 8%)" } : undefined}>{node.children.map((child) => renderNode(child, depth + 1))}</div></div>;
    }
    if (node.type === "absolute") {
      return <div key={node.id} {...wrapperProps} style={alignment}><div className="oe-canvas__absolute" role="group" style={{ position: "relative", minHeight: 240 }} onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()} onDrop={(event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const id = draggedNodeId.current ?? event.dataTransfer.getData("text/plain");
        const item = findAbsoluteItem(renderSpec.root, id);
        if (!item || !id || locked.has(id)) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const rect = resolveResponsiveValue(item.rect, view.breakpoint) ?? item.rect.mobile;
        const next = updateAbsoluteItemRect(renderSpec, id, view.breakpoint, {
          ...rect,
          x: ((event.clientX - bounds.left) / bounds.width) * 100 - dragOffset.current.x,
          y: ((event.clientY - bounds.top) / bounds.height) * 100 - dragOffset.current.y
        });
        if (next) updateSpec(next);
      }}>{node.items.map(({ element, rect }) => {
        const activeRect = resolveResponsiveValue(rect, view.breakpoint) ?? rect.mobile;
        return <div className="oe-canvas__absolute-item" role="group" key={element.id} draggable={!locked.has(element.id)} onDragStart={(event: DragEvent<HTMLDivElement>) => {
          if (locked.has(element.id)) { event.preventDefault(); return; }
          draggedNodeId.current = element.id;
          const itemBounds = event.currentTarget.getBoundingClientRect();
          const parentBounds = event.currentTarget.parentElement?.getBoundingClientRect();
          dragOffset.current = parentBounds?.width && parentBounds.height
            ? { x: ((event.clientX - itemBounds.left) / parentBounds.width) * 100, y: ((event.clientY - itemBounds.top) / parentBounds.height) * 100 }
            : { x: 0, y: 0 };
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", element.id);
          updateView({ selectedNodeId: element.id });
        }} onDragEnd={() => { draggedNodeId.current = null; dragOffset.current = { x: 0, y: 0 }; }} style={{ position: "absolute", left: `${activeRect.x}%`, top: `${activeRect.y}%`, width: `${activeRect.width}%`, height: `${activeRect.height}%` }}>{renderNode(element, depth + 1)}</div>;
      })}</div></div>;
    }
    if (!isBlockElement(node)) return null;
    return <div key={node.id} {...wrapperProps} className={`${wrapperProps.className} oe-canvas__element`}>{renderBlockElement(node, blocks, references)}</div>;
  }

  if (fatalIssues.length > 0) {
    return <section className={"oe-canvas " + (props.className ?? "")} role="alert"><div className="oe-canvas__error"><strong>Canvas unavailable</strong><p>{fatalIssues[0]?.message ?? "The layout could not be rendered."}</p></div></section>;
  }

  const inspectorModel: CanvasInspectorModel = {
    issues: validationIssues,
    spec: renderSpec,
    view,
    selectedNode,
    selectedId,
    hidden,
    locked,
    directlyLocked,
    isLocked,
    isRoot,
    hiddenSelected: hidden.has(selectedNode.id),
    previewDestinationCandidates,
    resolvedGap,
    layerItems,
    ...(gapNode ? { gapNodeId: gapNode.id } : {}),
    ...(absoluteRect ? { absoluteRect } : {})
  };

  return <div className={"oe-canvas " + (props.className ?? "")}>
    <style>{CANVAS_CSS}</style>
    <header className="oe-canvas__header">
      <div><h2 className="oe-canvas__title">Canvas</h2><p className="oe-canvas__subtitle">Arrange the layout. Your document remains the source of content.</p></div>
      <label className="oe-canvas__preview-size">Preview size
        <select aria-label="Canvas preview size" value={view.breakpoint} onChange={(event) => updateView({ breakpoint: event.currentTarget.value as CanvasBreakpoint })}>
          <option value="mobile">Mobile</option><option value="tablet">Tablet</option><option value="desktop">Desktop</option>
        </select>
      </label>
    </header>
    <div className="oe-canvas__workspace">
      <section className="oe-canvas__stage" data-breakpoint={view.breakpoint} aria-label="Canvas preview">
        <div className="oe-canvas__surface" role="tree" aria-label="Canvas preview" style={{ ...themeVars, maxWidth: view.breakpoint === "mobile" ? "min(390px, 100%)" : undefined }} onClick={() => updateView({ selectedNodeId: renderSpec.root.id })}>
          {renderNode(renderSpec.root)}
        </div>
      </section>
      <CanvasInspector headingId={headingId} model={inspectorModel} onViewUpdate={updateView} onSpecUpdate={updateSpec} />
    </div>
  </div>;
}
