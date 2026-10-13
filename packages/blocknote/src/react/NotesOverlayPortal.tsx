import { useLayoutEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Fixed modal surface outside sticky/overflow contexts, bounded to the actual Notes owner. */
export function NotesOverlayPortal({ anchor, children, onDismiss }: { anchor: HTMLElement | null; children: ReactNode; onDismiss(): void }) {
  const measure = () => {
    const owner = anchor?.closest<HTMLElement>(".oe-notes-tabbed-workspace") ?? anchor?.closest<HTMLElement>(".oe-notes-workspace"), rect = owner?.getBoundingClientRect();
    // The layout viewport stays tall when a mobile keyboard opens. Portals must
    // use the visible viewport, including its offset during zoom or panning.
    const viewport = window.visualViewport;
    const vl = viewport?.offsetLeft ?? 0, vt = viewport?.offsetTop ?? 0;
    const vr = vl + (viewport?.width ?? window.innerWidth), vb = vt + (viewport?.height ?? window.innerHeight);
    const left = Math.max(vl, rect?.left ?? vl), top = Math.max(vt, rect?.top ?? vt);
    const width = Math.max(0, Math.min(vr, rect?.right ?? vr) - left), height = Math.max(0, Math.min(vb, rect?.bottom ?? vb) - top);
    const theme = anchor?.closest<HTMLElement>(".oe-notes-workspace") ?? owner;
    const styles = theme ? getComputedStyle(theme) : undefined, variables = Object.fromEntries(["--oe-notes-border", "--oe-notes-ink", "--oe-notes-muted", "--note-canvas", "--note-text", "--note-line", "--note-muted", "--note-accent", "--note-soft", "--note-rail"].map(key => [key, styles?.getPropertyValue(key) || ""]));
    return { left, top, width, height, visibility: width > 0 && height > 0 && !owner?.closest("[hidden]") ? "visible" : "hidden", ...variables } as CSSProperties;
  };
  const [bounds, setBounds] = useState(measure);
  useLayoutEffect(() => {
    let frame = 0;
    const update = () => { frame = 0; const next = measure(); setBounds(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next); };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const owner = anchor?.closest<HTMLElement>(".oe-notes-tabbed-workspace") ?? anchor?.closest<HTMLElement>(".oe-notes-workspace");
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    const viewport = window.visualViewport;
    update();
    if (owner) observer?.observe(owner);
    window.addEventListener("resize", schedule); window.addEventListener("scroll", schedule, true);
    viewport?.addEventListener("resize", schedule); viewport?.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(frame); observer?.disconnect();
      window.removeEventListener("resize", schedule); window.removeEventListener("scroll", schedule, true);
      viewport?.removeEventListener("resize", schedule); viewport?.removeEventListener("scroll", schedule);
    };
  }, [anchor]);
  return createPortal(<div className="oe-notes-overlay-layer" style={bounds}><div className="oe-notes-overlay-backdrop" aria-hidden="true" onClick={onDismiss} />{children}</div>, document.body);
}
