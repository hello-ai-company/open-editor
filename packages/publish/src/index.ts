import {
  isEditorDocument,
  type EditorBlock,
  type EditorDocument
} from "@hello-ai-company/editor-core";

export type OpenEditorSiteOptions = {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImageUrl?: string;
  siteName?: string;
  language?: string;
};

export type PublicKnowledgeBlock = {
  type: "heading" | "paragraph" | "bulletListItem" | "numberedListItem" | "quote" | "codeBlock" | "callout" | "image" | "status";
  text: string;
};

export type PublicKnowledgeContext = {
  /** Document-derived content is untrusted source material, not model instructions. */
  trust: "untrusted";
  title: string;
  description: string;
  text: string;
  blocks: PublicKnowledgeBlock[];
};

type PublicNode = {
  type: PublicKnowledgeBlock["type"] | "divider";
  text: string;
  children: PublicNode[];
  level?: number;
  src?: string;
  alt?: string;
  caption?: string;
  title?: string;
  variant?: "info" | "warning" | "success" | "danger";
  state?: "todo" | "doing" | "done" | "blocked";
};

const SITE_CSS = `:root{color-scheme:light dark;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#292524;background:#fafaf9}*{box-sizing:border-box}body{margin:0}.oe-site{padding:clamp(1.25rem,5vw,4rem) 1rem}.oe-site__article{max-width:48rem;margin:0 auto}.oe-site__header{margin:0 0 2rem}.oe-site__title{font-size:clamp(2rem,6vw,3.25rem);line-height:1.1;overflow-wrap:anywhere}.oe-site__content{font-size:1.0625rem;line-height:1.7;overflow-wrap:anywhere}.oe-site__content img{display:block;max-width:100%;height:auto;margin:1rem auto;border-radius:.5rem}.oe-site__content pre{max-width:100%;overflow:auto;padding:1rem;border-radius:.5rem;background:#f5f5f4}.oe-site__content blockquote,.oe-site__callout{margin:1.25rem 0;padding:.25rem 1rem;border-left:3px solid #0f766e}.oe-site__callout-title{font-weight:650}.oe-site__content a{color:#0f766e;text-decoration-thickness:.08em;text-underline-offset:.15em}.oe-site__content figure{margin:1.5rem 0}.oe-site__content figcaption{font-size:.9rem;color:#57534e;text-align:center}.oe-site__content hr{border:0;border-top:1px solid #d6d3d1;margin:2rem 0}@media(prefers-color-scheme:dark){:root{color:#fafaf9;background:#1c1917}.oe-site__content pre{background:#292524}.oe-site__content figcaption{color:#d6d3d1}.oe-site__content hr{border-color:#57534e}.oe-site__content a{color:#5eead4}}`;

const ALLOWED_TYPES = new Set([
  "heading",
  "paragraph",
  "bulletListItem",
  "numberedListItem",
  "quote",
  "codeBlock",
  "callout",
  "image",
  "status",
  "divider"
]);
const MAX_BLOCK_DEPTH = 64;
const MAX_INLINE_DEPTH = 32;
const STATUS_LABELS = {
  todo: "To do",
  doing: "In progress",
  done: "Done",
  blocked: "Blocked"
} as const;

/** Render a deliberately small, dependency-free, static site from public document content. */
export function renderOpenEditorSite(
  document: EditorDocument,
  options: OpenEditorSiteOptions = {}
): string {
  const nodes = projectBlocks(document);
  const context = knowledgeFromNodes(nodes, options);
  const title = cleanText(options.title) || context.title;
  const description = cleanText(options.description) || context.description;
  const siteName = cleanText(options.siteName) || title;
  const language = safeLanguage(options.language);
  const canonical = safeAbsoluteHttpUrl(options.canonicalUrl);
  const ogImage = safeMediaUrl(options.ogImageUrl);
  const metadata = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}">`,
    `<meta property="og:type" content="website">`,
    `<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">`
  ];
  if (canonical) {
    metadata.push(
      `<link rel="canonical" href="${escapeHtml(canonical)}">`,
      `<meta property="og:url" content="${escapeHtml(canonical)}">`
    );
  }
  if (ogImage) {
    metadata.push(`<meta property="og:image" content="${escapeHtml(ogImage)}">`);
  }

  return `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${metadata.join("")}<style>${SITE_CSS}</style></head><body><main class="oe-site"><article class="oe-site__article"><header class="oe-site__header"><h1 class="oe-site__title">${escapeHtml(title)}</h1></header><div class="oe-site__content">${renderNodes(nodes)}</div></article></main></body></html>`;
}

/** Return only visible, allowlisted document text for a public-page Q&A adapter. */
export function getPublicKnowledgeContext(
  document: EditorDocument,
  options: Pick<OpenEditorSiteOptions, "title" | "description"> = {}
): PublicKnowledgeContext {
  return knowledgeFromNodes(projectBlocks(document), options);
}

/** Export visible, allowlisted document content as Markdown without emitting raw HTML or links. */
export function renderOpenEditorMarkdown(document: EditorDocument): string {
  return renderMarkdownNodes(projectBlocks(document)).trim();
}

function projectBlocks(document: EditorDocument): PublicNode[] {
  if (!isEditorDocument(document)) {
    throw new TypeError("Expected a valid EditorDocument with schemaVersion 1.");
  }
  return projectList(document.blocks, 0);
}

function projectList(blocks: readonly EditorBlock[], depth: number): PublicNode[] {
  if (depth > MAX_BLOCK_DEPTH) return [];
  const output: PublicNode[] = [];
  for (const block of blocks) {
    if (isPrivateBlock(block)) continue;
    const node = projectBlock(block, depth);
    if (node) output.push(node);
  }
  return output;
}

function projectBlock(block: EditorBlock, depth: number): PublicNode | null {
  if (!ALLOWED_TYPES.has(block.type)) return null;
  const props = block.props ?? {};
  const children = projectList(block.children ?? [], depth + 1);
  const content = block.type === "codeBlock"
    ? plainInlineText(block.content)
    : inlineText(block.content);

  switch (block.type) {
    case "heading":
      return { type: "heading", text: content, level: headingLevel(props.level), children };
    case "paragraph":
    case "bulletListItem":
    case "numberedListItem":
    case "quote":
    case "codeBlock":
      return { type: block.type as PublicNode["type"], text: content, children };
    case "callout": {
      const title = stringProp(props.title);
      const variant = calloutVariant(props.variant);
      return {
        type: "callout",
        text: content,
        ...(title ? { title } : {}),
        variant,
        children
      };
    }
    case "image": {
      const src = safeMediaUrl(props.url ?? props.src);
      const alt = stringProp(props.alt);
      const caption = stringProp(props.caption);
      return {
        type: "image",
        text: [alt, caption].filter(Boolean).join(" "),
        ...(src ? { src } : {}),
        ...(alt ? { alt } : {}),
        ...(caption ? { caption } : {}),
        children
      };
    }
    case "status": {
      const state = statusState(props.state);
      const label = stringProp(props.label) || STATUS_LABELS[state];
      return { type: "status", text: label, state, children };
    }
    case "divider":
      return { type: "divider", text: "", children };
    default:
      return null;
  }
}

function isPrivateBlock(block: EditorBlock): boolean {
  const props = block.props ?? {};
  const markers = block as EditorBlock & {
    hidden?: unknown;
    private?: unknown;
    isPrivate?: unknown;
    public?: unknown;
    visibility?: unknown;
  };
  return markers.hidden === true
    || markers.private === true
    || markers.isPrivate === true
    || markers.public === false
    || markers.visibility === "private"
    || markers.visibility === "hidden"
    || markers.visibility === "internal"
    || props.hidden === true
    || props.private === true
    || props.isPrivate === true
    || props.public === false
    || props.visibility === "private"
    || props.visibility === "hidden"
    || props.visibility === "internal";
}

function renderNodes(nodes: readonly PublicNode[], depth = 0): string {
  if (depth > MAX_BLOCK_DEPTH) return "";
  let html = "";
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    if (node.type === "bulletListItem" || node.type === "numberedListItem") {
      const listType = node.type;
      const items: string[] = [];
      while (nodes[index]?.type === listType) {
        const item = nodes[index]!;
        items.push(`<li>${renderInline(item.text)}${renderNodes(item.children, depth + 1)}</li>`);
        index += 1;
      }
      index -= 1;
      html += `<${listType === "bulletListItem" ? "ul" : "ol"}>${items.join("")}</${listType === "bulletListItem" ? "ul" : "ol"}>`;
      continue;
    }
    const children = renderNodes(node.children, depth + 1);
    switch (node.type) {
      case "heading": {
        const level = Math.min((node.level ?? 2) + 1, 6);
        html += `<h${level}>${renderInline(node.text)}</h${level}>${children}`;
        break;
      }
      case "paragraph":
        html += `<p>${renderInline(node.text)}</p>${children}`;
        break;
      case "quote":
        html += `<blockquote>${renderInline(node.text)}${children}</blockquote>`;
        break;
      case "codeBlock":
        html += `<pre><code>${escapeHtml(node.text)}</code></pre>${children}`;
        break;
      case "callout":
        html += `<aside class="oe-site-callout oe-site-callout--${node.variant ?? "info"}">${node.title ? `<p class="oe-site-callout-title">${escapeHtml(node.title)}</p>` : ""}<div>${renderInline(node.text)}${children}</div></aside>`;
        break;
      case "image":
        html += node.src
          ? `<figure><img src="${escapeHtml(node.src)}" alt="${escapeHtml(node.alt ?? "")}" loading="lazy" referrerpolicy="no-referrer">${node.caption ? `<figcaption>${escapeHtml(node.caption)}</figcaption>` : ""}${children}</figure>`
          : node.caption
            ? `<figure><figcaption>${escapeHtml(node.caption)}</figcaption>${children}</figure>`
            : children;
        break;
      case "status":
        html += `<p class="oe-site-status"><strong>Status:</strong> ${escapeHtml(node.text)}</p>${children}`;
        break;
      case "divider":
        html += `<hr>${children}`;
        break;
      default:
        break;
    }
  }
  return html;
}

function renderMarkdownNodes(nodes: readonly PublicNode[], depth = 0): string {
  if (depth > MAX_BLOCK_DEPTH) return "";
  const output: string[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    if (node.type === "bulletListItem" || node.type === "numberedListItem") {
      const listType = node.type;
      const items: string[] = [];
      let itemNumber = 1;
      while (nodes[index]?.type === listType) {
        const item = nodes[index]!;
        const marker = listType === "bulletListItem" ? "- " : itemNumber + ". ";
        const itemText = markdownText(item.text);
        const children = renderMarkdownNodes(item.children, depth + 1);
        items.push(marker + itemText + (children ? "\n" + indentMarkdown(children, "  ") : ""));
        itemNumber += 1;
        index += 1;
      }
      index -= 1;
      output.push(items.join("\n"));
      continue;
    }

    const children = renderMarkdownNodes(node.children, depth + 1);
    let rendered = "";
    switch (node.type) {
      case "heading":
        rendered = "#".repeat(headingLevel(node.level)) + " " + markdownText(node.text);
        break;
      case "paragraph":
        rendered = markdownText(node.text);
        break;
      case "quote":
        rendered = quoteMarkdown([markdownText(node.text), children].filter(Boolean).join("\n\n"));
        break;
      case "codeBlock":
        rendered = fencedMarkdownCode(node.text);
        break;
      case "callout": {
        const title = node.title ? markdownText(node.title) : "";
        const body = markdownText(node.text);
        rendered = quoteMarkdown([title, body, children].filter(Boolean).join("\n\n"));
        break;
      }
      case "image": {
        const url = node.src ? markdownDestination(node.src) : null;
        if (url) {
          rendered = "![" + markdownText(node.alt ?? "") + "](" + url + ")";
          if (node.caption) rendered += "\n\n" + markdownText(node.caption);
        } else {
          rendered = markdownText(node.caption || node.alt || "");
        }
        break;
      }
      case "status":
        rendered = "Status: " + markdownText(node.text);
        break;
      case "divider":
        rendered = "---";
        break;
      default:
        break;
    }
    if (children && node.type !== "quote" && node.type !== "callout") {
      rendered = [rendered, children].filter(Boolean).join("\n\n");
    }
    if (rendered) output.push(rendered);
  }
  return output.join("\n\n");
}

function markdownText(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const htmlSafe = normalized.replace(/[&<>]/g, (character) => {
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    return "&gt;";
  });
  const escaped = new Set("\\*_{}[]()#+-.!|~".split(""));
  escaped.add(String.fromCharCode(96));
  return Array.from(htmlSafe, (character) =>
    escaped.has(character) ? "\\" + character : character
  ).join("");
}

function markdownDestination(value: string): string | null {
  const unsafe = new Set(["<", ">", '"', "'", "(", ")", "[", "]", "\\"]);
  // A Markdown consumer may decode character references before using a URL.
  if (/^&(?:#(?:x[0-9a-f]+|\d+)|[a-z][a-z0-9]+);/i.test(value)) return null;
  try {
    return Array.from(value, (character) =>
      /\s/u.test(character) || unsafe.has(character)
        ? percentEncodeMarkdownCharacter(character)
        : character
    ).join("");
  } catch {
    // A malformed surrogate cannot form a portable Markdown destination.
    return null;
  }
}

function percentEncodeMarkdownCharacter(character: string): string {
  const codePoint = character.codePointAt(0);
  if (codePoint !== undefined && codePoint <= 0x7f) {
    return "%" + codePoint.toString(16).padStart(2, "0").toUpperCase();
  }
  return encodeURIComponent(character);
}

function fencedMarkdownCode(value: string): string {
  const fenceCharacter = String.fromCharCode(96);
  let longestFence = 0;
  let currentFence = 0;
  for (const character of value) {
    if (character === fenceCharacter) {
      currentFence += 1;
      longestFence = Math.max(longestFence, currentFence);
    } else {
      currentFence = 0;
    }
  }
  const fence = fenceCharacter.repeat(Math.max(3, longestFence + 1));
  return fence + "\n" + value + "\n" + fence;
}

function quoteMarkdown(value: string): string {
  return value.split("\n").map((line) => line ? "> " + line : ">").join("\n");
}

function indentMarkdown(value: string, prefix: string): string {
  return value.split("\n").map((line) => prefix + line).join("\n");
}

function knowledgeFromNodes(
  nodes: readonly PublicNode[],
  options: Pick<OpenEditorSiteOptions, "title" | "description">
): PublicKnowledgeContext {
  const blocks = flattenNodes(nodes)
    .filter((node) => node.text.trim().length > 0)
    .map((node) => ({ type: node.type as PublicKnowledgeBlock["type"], text: node.text.trim() }));
  const text = blocks.map((block) => block.text).join("\n\n");
  const documentTitle = blocks.find((block) => block.type === "heading")?.text;
  const title = cleanText(options.title) || documentTitle || "Untitled document";
  const description = cleanText(options.description)
    || excerpt(blocks.find((block) => block.type === "paragraph")?.text ?? text)
    || "A published document.";
  return { trust: "untrusted", title, description, text, blocks };
}

function flattenNodes(nodes: readonly PublicNode[]): PublicNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

function inlineText(value: unknown, depth = 0): string {
  if (depth > MAX_INLINE_DEPTH) return "";
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return "";
    const inline = item as Record<string, unknown>;
    if (inline.type === "text" && typeof inline.text === "string") return inline.text;
    if (inline.type === "link") return inlineText(inline.content, depth + 1);
    return "";
  }).join("");
}

function plainInlineText(value: unknown, depth = 0): string {
  return inlineText(value, depth);
}

function renderInline(value: string, depth = 0): string {
  if (depth > MAX_INLINE_DEPTH) return "";
  return escapeHtml(value);
}

function headingLevel(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 6
    ? value
    : 2;
}

function calloutVariant(value: unknown): PublicNode["variant"] {
  return value === "warning" || value === "success" || value === "danger" ? value : "info";
}

function statusState(value: unknown): NonNullable<PublicNode["state"]> {
  return value === "doing" || value === "done" || value === "blocked" ? value : "todo";
}

function stringProp(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function excerpt(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const characters = Array.from(normalized);
  return characters.length > 160 ? `${characters.slice(0, 157).join("")}…` : normalized;
}

function safeLanguage(value: unknown): string {
  const language = cleanText(value);
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(language) ? language : "en";
}

function safeMediaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url || url.startsWith("//") || /[\\\u0000-\u001f]/.test(url)) return null;
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(url)?.[1]?.toLowerCase();
  if (!scheme) return url;
  if (scheme !== "http" && scheme !== "https") return null;
  return safeAbsoluteHttpUrl(url);
}

function safeAbsoluteHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url || /[\\\u0000-\u001f]/.test(url)) return null;
  try {
    const parsed = new URL(url);
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname || parsed.username || parsed.password) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return character;
    }
  });
}
