import {
  isEditorDocument,
  type EditorBlock,
  type EditorDocument
} from "@hello-ai-company/editor-core";
import {
  CANVAS_THEME_PRESETS,
  CanvasLayoutValidationError,
  validateCanvasLayoutSpec,
  type CanvasBlockElementRef,
  type CanvasLayoutNode,
  type CanvasLayoutSpec,
  type CanvasThemeTokens
} from "@hello-ai-company/editor-canvas";

export type OpenEditorSiteOptions = {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImageUrl?: string;
  siteName?: string;
  language?: string;
  /** Validated responsive Canvas layout; omitted for the legacy article layout. */
  canvasSpec?: CanvasLayoutSpec;
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

export type OpenEditorDocxOptions = {
  title?: string;
  author?: string;
};

type ExportNode = {
  type: PublicKnowledgeBlock["type"] | "divider" | "columnList" | "column";
  text: string;
  children: ExportNode[];
  id?: string;
  columnWidth?: number;
  level?: number;
  src?: string;
  alt?: string;
  caption?: string;
  title?: string;
  variant?: "info" | "warning" | "success" | "danger";
  state?: "todo" | "doing" | "done" | "blocked";
};

const SITE_CSS = `:root{color-scheme:light dark;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#292524;background:#fafaf9}*{box-sizing:border-box}body{margin:0}.oe-site{padding:clamp(1.25rem,5vw,4rem) 1rem}.oe-site__article{max-width:48rem;margin:0 auto}.oe-site__header{margin:0 0 2rem}.oe-site__title{font-size:clamp(2rem,6vw,3.25rem);line-height:1.1;overflow-wrap:anywhere}.oe-site__content{font-size:1.0625rem;line-height:1.7;overflow-wrap:anywhere}.oe-site__content img{display:block;max-width:100%;height:auto;margin:1rem auto;border-radius:.5rem}.oe-site__content pre{max-width:100%;overflow:auto;padding:1rem;border-radius:.5rem;background:#f5f5f4}.oe-site__content blockquote,.oe-site__callout{margin:1.25rem 0;padding:.25rem 1rem;border-left:3px solid #0f766e}.oe-site__callout-title{font-weight:650}.oe-site__content a{color:#0f766e;text-decoration-thickness:.08em;text-underline-offset:.15em}.oe-site__content figure{margin:1.5rem 0}.oe-site__content figcaption{font-size:.9rem;color:#57534e;text-align:center}.oe-site__content hr{border:0;border-top:1px solid #d6d3d1;margin:2rem 0}.oe-site__legacy-columns{display:grid;grid-template-columns:var(--oe-site-column-tracks);gap:1rem}.oe-site__article--canvas{max-width:none}.oe-site__article--canvas .oe-site__header{max-width:var(--oe-site-max-width);margin:0 auto 2rem}.oe-site__canvas{max-width:var(--oe-site-max-width);margin:0 auto;padding:clamp(1.25rem,4vw,3.5rem);border-radius:var(--oe-site-radius);background:var(--oe-site-background);color:var(--oe-site-text);font-family:var(--oe-site-body-font);font-size:calc(1rem * var(--oe-site-body-scale));box-shadow:var(--oe-site-shadow)}.oe-site__canvas h1,.oe-site__canvas h2,.oe-site__canvas h3,.oe-site__canvas h4,.oe-site__canvas h5,.oe-site__canvas h6{font-family:var(--oe-site-heading-font);line-height:1.2}.oe-site__canvas .oe-site__callout,.oe-site__canvas blockquote{border-color:var(--oe-site-accent)}.oe-site__canvas a{color:var(--oe-site-accent)}.oe-site__canvas img{max-width:100%}.oe-site__canvas .oe-site__layout-stack{display:flex;min-width:0}.oe-site__canvas .oe-site__layout-grid,.oe-site__canvas .oe-site__layout-columns{display:grid;min-width:0}.oe-site__canvas .oe-site__legacy-columns{grid-template-columns:var(--oe-site-column-tracks);gap:var(--oe-site-gap,1rem)}.oe-site__canvas .oe-site__column{min-width:0}.oe-site__canvas .oe-site__layout-group{min-width:0;padding:var(--oe-site-space-md);border:1px solid var(--oe-site-border);border-radius:calc(var(--oe-site-radius) * .8);background:var(--oe-site-surface)}.oe-site__canvas .oe-site__layout-group[data-kind=frame]{box-shadow:var(--oe-site-frame-shadow)}.oe-site__canvas .oe-site__card{min-width:0;padding:var(--oe-site-space-md);border:1px solid var(--oe-site-border);border-radius:var(--oe-site-radius);background:var(--oe-site-surface)}.oe-site__canvas .oe-site__button{display:inline-flex;align-items:center;min-height:2.5rem;padding:.5rem 1rem;border-radius:999px;background:var(--oe-site-accent);color:white;font-weight:650}.oe-site__canvas .oe-site__placeholder{padding:1rem;border:1px dashed var(--oe-site-border);border-radius:var(--oe-site-radius);background:var(--oe-site-surface);color:var(--oe-site-muted);text-align:center}.oe-site__canvas .oe-site__layout-absolute{position:relative;min-height:15rem}.oe-site__canvas .oe-site__absolute-item{position:absolute;overflow:hidden}.oe-site__canvas .oe-site__layout-divider{border:0;border-top:1px solid var(--oe-site-border);margin:var(--oe-site-space-md) 0}@media(max-width:640px){.oe-site__legacy-columns{grid-template-columns:1fr!important}}@media(prefers-reduced-motion:reduce){.oe-site__presentation-slide{transition:none!important}}@media(prefers-color-scheme:dark){:root{color:#fafaf9;background:#1c1917}.oe-site__content pre{background:#292524}.oe-site__content figcaption{color:#d6d3d1}.oe-site__content hr{border-color:#57534e}.oe-site__content a{color:#5eead4}}`;

const PRESENTATION_CSS = `.oe-presentation{--oe-presentation-bg:#171b18;--oe-presentation-ink:#f6f7f5;min-height:100vh;display:flex;flex-direction:column;background:var(--oe-presentation-bg);color:var(--oe-presentation-ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}.oe-presentation__header,.oe-presentation__controls{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:1rem clamp(1rem,3vw,2rem)}.oe-presentation__title{margin:0;font-size:1rem}.oe-presentation__stage{width:min(100% - 2rem,72rem);min-height:min(68vh,48rem);margin:auto;display:grid;place-items:center}.oe-presentation__slide{width:100%;max-height:72vh;overflow:auto;padding:clamp(1.25rem,6vw,5rem);border-radius:1rem;background:#fff;color:#202520;box-shadow:0 1rem 4rem #0004}.oe-presentation__slide h2,.oe-presentation__slide h3{font-size:clamp(2rem,6vw,4.5rem);line-height:1.08}.oe-presentation__slide p,.oe-presentation__slide li{font-size:clamp(1rem,2vw,1.5rem)}.oe-presentation__controls button{min-width:7rem;min-height:2.75rem;padding:.5rem .9rem;border:1px solid #758078;border-radius:.65rem;background:#262d28;color:inherit;font:inherit;cursor:pointer}.oe-presentation__controls button:focus-visible{outline:3px solid #a7f3c3;outline-offset:3px}.oe-presentation__controls button:disabled{opacity:.45;cursor:not-allowed}.oe-presentation__counter{min-width:6rem;text-align:center;font-variant-numeric:tabular-nums}.oe-presentation--active{position:fixed;z-index:2147483647;inset:0}.oe-presentation[hidden]{display:none}.oe-presentation__empty{margin:0;color:#667167}@media(max-width:600px){.oe-presentation__stage{width:100%;min-height:65vh;padding:.75rem}.oe-presentation__slide{max-height:68vh;padding:1.25rem;border-radius:.65rem}.oe-presentation__header,.oe-presentation__controls{padding:.75rem;gap:.5rem}.oe-presentation__controls button{min-width:5.5rem}}@media(prefers-reduced-motion:reduce){.oe-presentation__slide{scroll-behavior:auto;transition:none}}`;

const PRESENTATION_SCRIPT = `(()=>{const root=document.querySelector("[data-presentation]");if(!root)return;const slides=Array.from(root.querySelectorAll("[data-slide]"));const counter=root.querySelector("[data-counter]");const previous=root.querySelector("[data-previous]");const next=root.querySelector("[data-next]");const toggle=root.querySelector("[data-fullscreen]");let index=0;const show=(value)=>{index=Math.max(0,Math.min(slides.length-1,value));slides.forEach((slide,i)=>{slide.hidden=i!==index;slide.setAttribute("aria-hidden",String(i!==index));});counter.textContent=(index+1)+" / "+slides.length;previous.disabled=index===0;next.disabled=index===slides.length-1;};const exit=()=>{root.classList.remove("oe-presentation--active");toggle.textContent="Enter presentation";toggle.setAttribute("aria-label","Enter presentation mode");if(document.fullscreenElement===root&&document.exitFullscreen)document.exitFullscreen().catch(()=>{});};previous.addEventListener("click",()=>show(index-1));next.addEventListener("click",()=>show(index+1));toggle.addEventListener("click",async()=>{if(root.classList.contains("oe-presentation--active")){exit();return;}root.classList.add("oe-presentation--active");toggle.textContent="Exit presentation";toggle.setAttribute("aria-label","Exit presentation mode");root.focus();if(root.requestFullscreen){try{await root.requestFullscreen();}catch{}}});document.addEventListener("fullscreenchange",()=>{if(!document.fullscreenElement&&root.classList.contains("oe-presentation--active"))exit();});document.addEventListener("keydown",event=>{if(event.key==="Escape"){if(root.classList.contains("oe-presentation--active"))exit();return;}const target=event.target;if(target instanceof Element&&target.closest("a,input,textarea,select,[contenteditable=true]"))return;if(event.key==="ArrowRight"||event.key==="PageDown"){event.preventDefault();show(index+1);}else if(event.key==="ArrowLeft"||event.key==="PageUp"){event.preventDefault();show(index-1);}else if(event.key===" "){if(target instanceof Element&&target.closest("button"))return;event.preventDefault();show(index+1);}});show(0);})();`;

const PRESENTATION_BUTTON_CSS = `.oe-presentation__header button{min-height:2.75rem;padding:.5rem .9rem;border:1px solid #758078;border-radius:.65rem;background:#262d28;color:inherit;font:inherit;cursor:pointer}.oe-presentation__header button:focus-visible{outline:3px solid #a7f3c3;outline-offset:3px}`;

const PRINT_CSS = `@page{size:A4;margin:18mm}@media print{html,body{background:#fff!important;color:#111!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.oe-site{padding:0}.oe-site__article{max-width:none}.oe-site__article--canvas .oe-site__header{margin:0 0 12mm}.oe-site__canvas{max-width:none;box-shadow:none!important;border-radius:0;padding:0;background:#fff!important;color:#111!important}.oe-site__content{font-size:10.5pt;line-height:1.5}.oe-site__layout-group,.oe-site__card,figure,blockquote,pre{break-inside:avoid-page}.oe-site__legacy-columns{break-inside:avoid-page}.oe-site__content a{color:inherit;text-decoration:none}.oe-site__content img{max-width:100%;max-height:240mm;object-fit:contain}}`;

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
  const nodes = projectExportIR(document);
  const canvas = options.canvasSpec
    ? renderCanvasLayout(options.canvasSpec, document, nodes)
    : null;
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

  const articleClass = canvas ? "oe-site__article oe-site__article--canvas" : "oe-site__article";
  const articleStyle = canvas ? ` style="--oe-site-max-width:${canvas.maxWidth}px"` : "";
  const content = canvas?.html ?? renderNodes(nodes);
  return `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${metadata.join("")}<style>${SITE_CSS}${canvas?.css ?? ""}</style></head><body><main class="oe-site"><article class="${articleClass}"${articleStyle}><header class="oe-site__header"><h1 class="oe-site__title">${escapeHtml(title)}</h1></header><div class="oe-site__content">${content}</div></article></main></body></html>`;
}

/** Render a keyboard-accessible, static presentation player with no document-provided script. */
export function renderOpenEditorPresentation(
  document: EditorDocument,
  options: OpenEditorSiteOptions = {}
): string {
  const nodes = projectExportIR(document);
  const context = knowledgeFromNodes(nodes, options);
  const title = cleanText(options.title) || context.title;
  const slides = presentationSlides(nodes);
  const renderedSlides = slides.map((slide, index) =>
    `<section class="oe-presentation__slide" data-slide aria-label="Slide ${index + 1} of ${slides.length}" tabindex="-1"${index > 0 ? " hidden" : ""}>${slide.length ? renderNodes(slide) : "<p class=\"oe-presentation__empty\">No public content in this slide.</p>"}</section>`
  ).join("");
  return `<!doctype html><html lang="${escapeHtml(safeLanguage(options.language))}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — Presentation</title><style>${SITE_CSS}${PRESENTATION_CSS}${PRESENTATION_BUTTON_CSS}</style></head><body><main class="oe-presentation" data-presentation tabindex="-1"><header class="oe-presentation__header"><h1 class="oe-presentation__title">${escapeHtml(title)}</h1><button type="button" data-fullscreen aria-label="Enter presentation mode">Enter presentation</button></header><div class="oe-presentation__stage" data-stage>${renderedSlides}</div><nav class="oe-presentation__controls" aria-label="Presentation controls"><button type="button" data-previous aria-label="Previous slide">Previous</button><output class="oe-presentation__counter" data-counter aria-live="polite">1 / ${slides.length}</output><button type="button" data-next aria-label="Next slide">Next</button></nav></main><script>${PRESENTATION_SCRIPT}</script></body></html>`;
}

/** Return only visible, allowlisted document text for a public-page Q&A adapter. */
export function getPublicKnowledgeContext(
  document: EditorDocument,
  options: Pick<OpenEditorSiteOptions, "title" | "description"> = {}
): PublicKnowledgeContext {
  return knowledgeFromNodes(projectExportIR(document), options);
}

/** Export visible, allowlisted document content as Markdown without emitting raw HTML or links. */
export function renderOpenEditorMarkdown(document: EditorDocument): string {
  return renderMarkdownNodes(projectExportIR(document)).trim();
}

/** Build a clean-room DOCX from the same public Export IR used by HTML and Markdown. */
export async function renderOpenEditorDocx(
  document: EditorDocument,
  options: OpenEditorDocxOptions = {}
): Promise<Blob> {
  const nodes = projectExportIR(document);
  const context = knowledgeFromNodes(nodes, options);
  const title = cleanText(options.title) || context.title;
  const docx = await import("docx");
  const paragraphs: InstanceType<typeof docx.Paragraph>[] = [
    new docx.Paragraph({ text: title, heading: docx.HeadingLevel.TITLE })
  ];
  const headingLevels = [
    docx.HeadingLevel.HEADING_1,
    docx.HeadingLevel.HEADING_2,
    docx.HeadingLevel.HEADING_3,
    docx.HeadingLevel.HEADING_4,
    docx.HeadingLevel.HEADING_5,
    docx.HeadingLevel.HEADING_6
  ];

  function append(nodesToAppend: readonly ExportNode[], depth = 0): void {
    for (let index = 0; index < nodesToAppend.length; index += 1) {
      const node = nodesToAppend[index]!;
      if (node.type === "bulletListItem" || node.type === "numberedListItem") {
        const type = node.type;
        let number = 1;
        while (nodesToAppend[index]?.type === type) {
          const item = nodesToAppend[index]!;
          const marker = type === "bulletListItem" ? "• " : number + ". ";
          paragraphs.push(new docx.Paragraph({
            text: marker + item.text,
            indent: { left: Math.min(depth + 1, 8) * 360, hanging: 180 }
          }));
          append(item.children, depth + 1);
          number += 1;
          index += 1;
        }
        index -= 1;
        continue;
      }

      switch (node.type) {
        case "heading":
          paragraphs.push(new docx.Paragraph({
            text: node.text,
            heading: headingLevels[headingLevel(node.level) - 1]
          }));
          break;
        case "paragraph":
          paragraphs.push(new docx.Paragraph({ text: node.text }));
          break;
        case "quote":
          paragraphs.push(new docx.Paragraph({
            children: [new docx.TextRun({ text: node.text, italics: true })],
            indent: { left: 360 }
          }));
          break;
        case "codeBlock":
          paragraphs.push(new docx.Paragraph({
            children: [new docx.TextRun({ text: node.text, font: "Consolas" })]
          }));
          break;
        case "callout":
          paragraphs.push(new docx.Paragraph({
            children: [
              ...(node.title ? [new docx.TextRun({ text: node.title + " ", bold: true })] : []),
              new docx.TextRun({ text: node.text })
            ],
            indent: { left: 240 }
          }));
          break;
        case "image":
          paragraphs.push(new docx.Paragraph({
            text: "[Image" + (node.alt ? ": " + node.alt : "") + (node.caption ? " — " + node.caption : "") + "]"
          }));
          break;
        case "status":
          paragraphs.push(new docx.Paragraph({ text: "Status: " + node.text }));
          break;
        case "divider":
          paragraphs.push(new docx.Paragraph({ text: "————————————————" }));
          break;
        default:
          break;
      }
      append(node.children, depth);
    }
  }

  append(nodes);
  const result = new docx.Document({
    creator: cleanText(options.author) || "OpenEditor",
    title,
    sections: [{
      properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      children: paragraphs
    }]
  });
  return docx.Packer.toBlob(result);
}

/** Return the same Site HTML with stable print CSS; the host/browser owns Save as PDF. */
export function renderOpenEditorPdfPrintHtml(
  document: EditorDocument,
  options: OpenEditorSiteOptions = {}
): string {
  return renderOpenEditorSite(document, options).replace("</style>", PRINT_CSS + "</style>");
}

function projectExportIR(document: EditorDocument): ExportNode[] {
  if (!isEditorDocument(document)) {
    throw new TypeError("Expected a valid EditorDocument with schemaVersion 1.");
  }
  return projectList(document.blocks, 0);
}

function projectList(blocks: readonly EditorBlock[], depth: number): ExportNode[] {
  if (depth > MAX_BLOCK_DEPTH) return [];
  const output: ExportNode[] = [];
  for (const block of blocks) {
    if (isPrivateBlock(block)) continue;
    const node = projectBlock(block, depth);
    if (node) output.push(node);
  }
  return output;
}

function projectBlock(block: EditorBlock, depth: number): ExportNode | null {
  const props = block.props ?? {};
  const children = projectList(block.children ?? [], depth + 1);
  const content = block.type === "codeBlock"
    ? plainInlineText(block.content)
    : inlineText(block.content);

  if (block.type === "columnList" || block.type === "column") {
    return {
      id: block.id,
      type: block.type,
      text: "",
      ...(block.type === "column" ? { columnWidth: safeColumnWidth(props.columnWidth ?? props.width) } : {}),
      children
    };
  }
  if (!ALLOWED_TYPES.has(block.type)) return null;

  switch (block.type) {
    case "heading":
      return { id: block.id, type: "heading", text: content, level: headingLevel(props.level), children };
    case "paragraph":
    case "bulletListItem":
    case "numberedListItem":
    case "quote":
    case "codeBlock":
      return { id: block.id, type: block.type as ExportNode["type"], text: content, children };
    case "callout": {
      const title = stringProp(props.title);
      const variant = calloutVariant(props.variant);
      return {
        id: block.id,
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
        id: block.id,
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
      return { id: block.id, type: "status", text: label, state, children };
    }
    case "divider":
      return { id: block.id, type: "divider", text: "", children };
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

function renderNodes(nodes: readonly ExportNode[], depth = 0, skipBlockIds: ReadonlySet<string> = new Set()): string {
  if (depth > MAX_BLOCK_DEPTH) return "";
  let html = "";
  const visibleNodes = skipBlockIds.size > 0
    ? nodes.filter((node) => !node.id || !skipBlockIds.has(node.id))
    : nodes;
  for (let index = 0; index < visibleNodes.length; index += 1) {
    const node = visibleNodes[index]!;
    if (node.type === "bulletListItem" || node.type === "numberedListItem") {
      const listType = node.type;
      const items: string[] = [];
      while (visibleNodes[index]?.type === listType) {
        const item = visibleNodes[index]!;
        items.push("<li>" + renderInline(item.text) + renderNodes(item.children, depth + 1, skipBlockIds) + "</li>");
        index += 1;
      }
      index -= 1;
      html += `<${listType === "bulletListItem" ? "ul" : "ol"}>${items.join("")}</${listType === "bulletListItem" ? "ul" : "ol"}>`;
      continue;
    }
    const children = renderNodes(node.children, depth + 1, skipBlockIds);
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
        html += `<aside class="oe-site__callout oe-site__callout--${node.variant ?? "info"}">${node.title ? `<p class="oe-site__callout-title">${escapeHtml(node.title)}</p>` : ""}<div>${renderInline(node.text)}${children}</div></aside>`;
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
      case "columnList": {
        const tracks = node.children.map((column) => "minmax(0," + safeColumnWidth(column.columnWidth) + "fr)").join(" ") || "minmax(0,1fr)";
        html += "<div class=\"oe-site__legacy-columns\" style=\"--oe-site-column-tracks:" + tracks + "\">" + children + "</div>";
        break;
      }
      case "column":
        html += "<div class=\"oe-site__column\">" + children + "</div>";
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

function presentationSlides(nodes: readonly ExportNode[]): ExportNode[][] {
  const slides: ExportNode[][] = [];
  let current: ExportNode[] | undefined;
  for (const node of nodes) {
    if (node.type === "heading") {
      current = [node];
      slides.push(current);
    } else if (current) {
      current.push(node);
    } else {
      current = [node];
      slides.push(current);
    }
  }
  return slides.length ? slides : [[]];
}

type ResponsiveDeclarations = {
  mobile: Record<string, string>;
  tablet?: Record<string, string>;
  desktop?: Record<string, string>;
};

function renderCanvasLayout(
  spec: CanvasLayoutSpec,
  document: EditorDocument,
  nodes: readonly ExportNode[]
): { html: string; css: string; maxWidth: number } {
  const issues = validateCanvasLayoutSpec(spec, document);
  const fatal = issues.filter(({ code }) => code !== "MISSING_BLOCK_REFERENCE");
  if (fatal.length > 0) throw new CanvasLayoutValidationError(fatal);
  const tokens: CanvasThemeTokens = typeof spec.theme === "string"
    ? CANVAS_THEME_PRESETS[spec.theme]
    : spec.theme;
  const publicBlocks = new Map<string, ExportNode>();
  const projected = [...nodes];
  while (projected.length > 0) {
    const block = projected.pop();
    if (!block) continue;
    if (block.id) publicBlocks.set(block.id, block);
    projected.push(...block.children);
  }
  const referencedBlockIds = collectCanvasBlockReferences(spec.root);
  const rules: string[] = [];
  let classId = 0;

  function cssClass(declarations: ResponsiveDeclarations): string {
    classId += 1;
    const name = "oe-site__layout-" + classId;
    const selector = ".oe-site__canvas ." + name;
    const cssDeclarations = (value: Record<string, string>): string =>
      Object.entries(value).map(([property, entry]) => property + ":" + entry).join(";");
    rules.push(selector + "{" + cssDeclarations(declarations.mobile) + "}");
    if (declarations.tablet) {
      rules.push("@media(min-width:" + spec.breakpoints.tablet + "px){" + selector + "{" + cssDeclarations(declarations.tablet) + "}}");
    }
    if (declarations.desktop) {
      rules.push("@media(min-width:" + spec.breakpoints.desktop + "px){" + selector + "{" + cssDeclarations(declarations.desktop) + "}}");
    }
    return name;
  }

  function renderBlock(blockId: string): string {
    const block = publicBlocks.get(blockId);
    if (!block) return '<div class="oe-site__placeholder" role="note">Content unavailable.</div>';
    const nestedRefs = new Set(referencedBlockIds);
    nestedRefs.delete(blockId);
    return renderNodes([block], 0, nestedRefs);
  }

  function renderElement(node: CanvasBlockElementRef): string {
    const block = publicBlocks.get(node.blockId);
    const content = renderBlock(node.blockId);
    if (node.type === "card") return '<article class="oe-site__card">' + content + "</article>";
    if (node.type === "button") return '<span class="oe-site__button">' + (block ? content : "Button") + "</span>";
    if (node.type === "divider") return block && block.text.trim() ? content : '<hr class="oe-site__layout-divider">';
    if (node.type === "image" && (block?.type !== "image" || !block.src)) {
      return '<div class="oe-site__placeholder" role="img" aria-label="Image preview">Image preview</div>';
    }
    if (node.type === "chart" || node.type === "embed") {
      return '<div class="oe-site__placeholder" role="img" aria-label="' + (node.type === "chart" ? "Chart" : "Embed") + ' preview">' + (node.type === "chart" ? "Chart" : "Embedded content") + " preview</div>";
    }
    return content;
  }

  function renderLayoutNode(node: CanvasLayoutNode, depth = 0): string {
    if (depth > 32) return "";
    if (node.type === "stack") {
      const cls = cssClass({
        mobile: {
          display: "flex",
          "flex-direction": "column",
          gap: (node.gap?.mobile ?? 0) + "px",
          padding: (node.padding?.mobile ?? 0) + "px"
        },
        tablet: {
          "flex-direction": node.direction === "horizontal" ? "row" : "column",
          gap: (node.gap?.tablet ?? node.gap?.mobile ?? 0) + "px",
          padding: (node.padding?.tablet ?? node.padding?.mobile ?? 0) + "px"
        },
        desktop: {
          "flex-direction": node.direction === "horizontal" ? "row" : "column",
          gap: (node.gap?.desktop ?? node.gap?.tablet ?? node.gap?.mobile ?? 0) + "px",
          padding: (node.padding?.desktop ?? node.padding?.tablet ?? node.padding?.mobile ?? 0) + "px"
        }
      });
      return '<div class="oe-site__layout-stack ' + cls + '">' + node.children.map((child) => renderLayoutNode(child, depth + 1)).join("") + "</div>";
    }
    if (node.type === "grid" || node.type === "columns") {
      const isGrid = node.type === "grid";
      const columns = isGrid ? node.columns : { mobile: 1, tablet: Math.min(2, node.columns.length), desktop: node.columns.length };
      const gap = node.gap;
      const cls = cssClass({
        mobile: {
          display: "grid",
          "grid-template-columns": "repeat(" + columns.mobile + ",minmax(0,1fr))",
          gap: (gap?.mobile ?? 0) + "px"
        },
        tablet: {
          "grid-template-columns": "repeat(" + (columns.tablet ?? columns.mobile) + ",minmax(0,1fr))",
          gap: (gap?.tablet ?? gap?.mobile ?? 0) + "px"
        },
        desktop: {
          "grid-template-columns": "repeat(" + (columns.desktop ?? columns.tablet ?? columns.mobile) + ",minmax(0,1fr))",
          gap: (gap?.desktop ?? gap?.tablet ?? gap?.mobile ?? 0) + "px"
        }
      });
      const children = isGrid
        ? node.children.map((child) => renderLayoutNode(child, depth + 1)).join("")
        : node.columns.map((column) => '<div class="oe-site__column">' + column.map((child) => renderLayoutNode(child, depth + 1)).join("") + "</div>").join("");
      return '<div class="oe-site__layout-' + (isGrid ? "grid" : "columns") + " " + cls + '">' + children + "</div>";
    }
    if (node.type === "section" || node.type === "frame") {
      const anchoredBlock = node.blockId ? publicBlocks.get(node.blockId) : undefined;
      const children = node.children.map((child) => renderLayoutNode(child, depth + 1)).join("");
      const childRefs = collectCanvasBlockReferencesFromNodes(node.children);
      const anchor = anchoredBlock && node.blockId && !childRefs.has(node.blockId)
        ? renderBlock(node.blockId)
        : "";
      return '<section class="oe-site__layout-group" data-kind="' + node.type + '">' + anchor + children + "</section>";
    }
    if (node.type === "absolute") {
      const cls = cssClass({ mobile: { position: "relative" } });
      const items = node.items.map(({ element, rect }) => {
        const value = rect.mobile;
        const itemClass = cssClass({
          mobile: {
            left: value.x + "%",
            top: value.y + "%",
            width: value.width + "%",
            height: value.height + "%"
          },
          tablet: rect.tablet ? {
            left: rect.tablet.x + "%",
            top: rect.tablet.y + "%",
            width: rect.tablet.width + "%",
            height: rect.tablet.height + "%"
          } : undefined,
          desktop: rect.desktop ? {
            left: rect.desktop.x + "%",
            top: rect.desktop.y + "%",
            width: rect.desktop.width + "%",
            height: rect.desktop.height + "%"
          } : undefined
        });
        return '<div class="oe-site__absolute-item ' + itemClass + '">' + renderElement(element) + "</div>";
      }).join("");
      return '<div class="oe-site__layout-absolute ' + cls + '">' + items + "</div>";
    }
    return isCanvasBlockElement(node)
      ? '<div class="oe-site__canvas-element">' + renderElement(node) + "</div>"
      : "";
  }

  const fontStacks = {
    sans: "system-ui,-apple-system,Segoe UI,sans-serif",
    serif: "Georgia,Times New Roman,serif",
    mono: "ui-monospace,SFMono-Regular,Consolas,monospace"
  } as const;
  const shadow = tokens.shadow === "strong"
    ? "0 12px 36px rgb(25 35 27 / 12%)"
    : tokens.shadow === "soft"
      ? "0 2px 12px rgb(25 35 27 / 5%)"
      : "none";
  const themeCss = ".oe-site__canvas{--oe-site-background:" + tokens.colors.background
    + ";--oe-site-surface:" + tokens.colors.surface
    + ";--oe-site-text:" + tokens.colors.text
    + ";--oe-site-muted:" + tokens.colors.muted
    + ";--oe-site-accent:" + tokens.colors.accent
    + ";--oe-site-border:" + tokens.colors.border
    + ";--oe-site-body-font:" + fontStacks[tokens.fonts.body]
    + ";--oe-site-heading-font:" + fontStacks[tokens.fonts.heading]
    + ";--oe-site-body-scale:" + tokens.typeScale.body
    + ";--oe-site-heading-scale:" + tokens.typeScale.heading
    + ";--oe-site-radius:" + tokens.radius + "px"
    + ";--oe-site-max-width:" + tokens.maxWidth + "px"
    + ";--oe-site-space-xs:" + tokens.spacing.xs + "px"
    + ";--oe-site-space-sm:" + tokens.spacing.sm + "px"
    + ";--oe-site-space-md:" + tokens.spacing.md + "px"
    + ";--oe-site-space-lg:" + tokens.spacing.lg + "px"
    + ";--oe-site-space-xl:" + tokens.spacing.xl + "px"
    + ";--oe-site-shadow:" + shadow
    + ";--oe-site-frame-shadow:" + (tokens.shadow === "strong" ? "0 5px 18px rgb(25 35 27 / 12%)" : tokens.shadow === "soft" ? "0 3px 12px rgb(25 35 27 / 7%)" : "none")
    + "}";
  return {
    html: '<div class="oe-site__canvas">' + renderLayoutNode(spec.root) + "</div>",
    css: themeCss + rules.join(""),
    maxWidth: tokens.maxWidth
  };
}

function collectCanvasBlockReferences(root: CanvasLayoutNode): Set<string> {
  const references = new Set<string>();
  const pending: CanvasLayoutNode[] = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node) continue;
    if ("blockId" in node && node.blockId) references.add(node.blockId);
    if (node.type === "absolute") {
      node.items.forEach(({ element }) => {
        references.add(element.blockId);
      });
    } else if (node.type === "columns") {
      node.columns.forEach((column) => pending.push(...column));
    } else if (node.type === "stack" || node.type === "grid" || node.type === "section" || node.type === "frame") {
      pending.push(...node.children);
    }
  }
  return references;
}

function isCanvasBlockElement(node: CanvasLayoutNode): node is CanvasBlockElementRef {
  return node.type === "text"
    || node.type === "image"
    || node.type === "card"
    || node.type === "divider"
    || node.type === "button"
    || node.type === "chart"
    || node.type === "embed";
}

function collectCanvasBlockReferencesFromNodes(nodes: readonly CanvasLayoutNode[]): Set<string> {
  const references = new Set<string>();
  for (const node of nodes) {
    for (const blockId of collectCanvasBlockReferences(node)) references.add(blockId);
  }
  return references;
}

function renderMarkdownNodes(nodes: readonly ExportNode[], depth = 0): string {
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
      case "columnList":
      case "column":
        rendered = "";
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
  if (/&(?:#(?:x[0-9a-f]+|\d+)|[a-z][a-z0-9]+);/i.test(value)) return null;
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
  nodes: readonly ExportNode[],
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

function flattenNodes(nodes: readonly ExportNode[]): ExportNode[] {
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

function calloutVariant(value: unknown): ExportNode["variant"] {
  return value === "warning" || value === "success" || value === "danger" ? value : "info";
}

function statusState(value: unknown): NonNullable<ExportNode["state"]> {
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

function safeColumnWidth(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.min(value, 1000)
    : 1;
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
