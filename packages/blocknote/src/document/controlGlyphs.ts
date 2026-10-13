/** Fixed local control geometry. Never accept markup or icon paths from document data. */
export const DOCUMENT_GRIP_DOTS = [[6, 4], [18, 4], [6, 12], [18, 12], [6, 20], [18, 20]] as const;
export function createDocumentGripIcon(document: Document): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "24"); svg.setAttribute("height", "24");
  // Decorative descendants must not replace the owning grip as the pointer target.
  svg.setAttribute("pointer-events", "none");
  svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false"); svg.setAttribute("data-oe-control-icon", "grip");
  for (const [cx, cy] of DOCUMENT_GRIP_DOTS) {
    const dot = document.createElementNS(svg.namespaceURI, "circle");
    dot.setAttribute("cx", String(cx)); dot.setAttribute("cy", String(cy)); dot.setAttribute("r", "2"); dot.setAttribute("fill", "currentColor"); svg.append(dot);
  }
  return svg;
}
