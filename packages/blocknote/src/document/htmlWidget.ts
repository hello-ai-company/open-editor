export const HTML_WIDGET_TYPE = "oeHtmlWidget" as const;
export type HtmlWidgetSource = { html: string; css: string; javascript: string };
export const MAX_WIDGET_SOURCE_CHARACTERS = 200_000;

export function parseHtmlWidgetSource(value: unknown): HtmlWidgetSource {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Widget source must be an object");
  const input = value as Record<string, unknown>;
  const result: HtmlWidgetSource = { html: "", css: "", javascript: "" };
  for (const key of ["html", "css", "javascript"] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string") throw new TypeError(`Widget ${key} must be a string data property`);
    result[key] = descriptor.value;
  }
  if (result.html.length + result.css.length + result.javascript.length > MAX_WIDGET_SOURCE_CHARACTERS) throw new TypeError("Widget source exceeds its preview budget; original source must be retained");
  return result;
}

const tags = new Set("div span p h1 h2 h3 h4 h5 h6 strong em b i u s small pre code blockquote ul ol li table thead tbody tfoot tr th td caption hr br button label section article header footer main aside figure figcaption a".split(" "));
const blocked = new Set("script style iframe object embed svg math template noscript textarea title xmp plaintext noembed noframes".split(" "));
function escape(value: string): string { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }

/** Conservative standalone tokenizer: no DOM parsing/resource loads, URLs or handlers. */
export function sanitizeWidgetMarkup(source: string): string {
  if (source.length > MAX_WIDGET_SOURCE_CHARACTERS) throw new TypeError("Widget HTML exceeds its preview budget");
  let output = "", index = 0;
  while (index < source.length) {
    if (source.startsWith("<!--", index)) { const end = source.indexOf("-->", index + 4); index = end < 0 ? source.length : end + 3; continue; }
    if (source[index] !== "<") { const end = source.indexOf("<", index); const stop = end < 0 ? source.length : end; output += escape(source.slice(index, stop)); index = stop; continue; }
    let end = index + 1, quote = "";
    for (; end < source.length; end++) {
      const ch = source[end]!;
      if (quote) { if (ch === quote) quote = ""; }
      else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === ">") break;
    }
    if (end === source.length) { output += escape(source.slice(index)); break; }
    const token = source.slice(index + 1, end), match = /^\s*(\/?)\s*([a-z][a-z0-9]*)\b/i.exec(token);
    index = end + 1;
    if (!match) continue;
    const name = match[2]!.toLowerCase(), closing = Boolean(match[1]);
    if (blocked.has(name) && !closing) {
      const close = new RegExp(`<\\/\\s*${name}\\s*>`, "ig"); close.lastIndex = index;
      const found = close.exec(source); index = found ? close.lastIndex : source.length; continue;
    }
    if (!tags.has(name)) continue;
    if (closing) { output += `</${name}>`; continue; }
    // No arbitrary attribute passes through, including URLs, style, event handlers and names.
    const attributes: string[] = [];
    const remainder = token.slice(match[0].length);
    const attr = /([^\s=/'">]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    for (const item of remainder.matchAll(attr)) {
      const key = item[1]!.toLowerCase(), value = item[2] ?? item[3] ?? item[4] ?? "";
      if ((key === "class" || key === "id") && /^[a-zA-Z0-9 _-]{1,128}$/.test(value)) attributes.push(`${key}="${escape(value)}"`);
      if ((name === "td" || name === "th") && (key === "colspan" || key === "rowspan") && /^[1-9][0-9]?$/.test(value)) attributes.push(`${key}="${value}"`);
    }
    output += `<${name}${attributes.length ? " " + attributes.join(" ") : ""}>`;
  }
  return output;
}

/** Preview retains JS as source data but never executes it or fetches external resources. */
export function createHtmlWidgetPreview(value: unknown): string {
  const source = parseHtmlWidgetSource(value);
  const css = source.css.replace(/</g, "\\3c ");
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{color-scheme:light}body{margin:16px;overflow-wrap:anywhere}button{pointer-events:none}${css}</style></head><body>${sanitizeWidgetMarkup(source.html)}</body></html>`;
}

export const HTML_WIDGET_PRESETS: ReadonlyArray<{ id: string; title: string; source: HtmlWidgetSource }> = [
  { id: "blank", title: "Blank", source: { html: "", css: "", javascript: "" } },
  { id: "note", title: "Note card", source: { html: '<article class="note"><h2>Idea</h2><p>Try it together.</p></article>', css: ".note{padding:24px;border:1px solid #b8c7ba;border-radius:12px;background:#f5f8f4}h2{margin-top:0}", javascript: "" } },
  { id: "comparison", title: "Comparison", source: { html: '<section class="comparison"><article><h2>Option A</h2><p>First idea</p></article><article><h2>Option B</h2><p>Second idea</p></article></section>', css: ".comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}article{padding:16px;background:#f4f6f2}@media(max-width:480px){.comparison{grid-template-columns:1fr}}", javascript: "" } }
];
