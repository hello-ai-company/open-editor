import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export type NotesFloatingRect = { left: number; top: number; right: number; bottom: number };
type Position = { left: number; top: number; maxWidth: number; maxHeight: number; variables: CSSProperties };
const overlaps = (a: NotesFloatingRect, b: NotesFloatingRect) => a.left < b.right + 8 && a.right > b.left - 8 && a.top < b.bottom + 8 && a.bottom > b.top - 8;

/** Non-modal, owner-bound portal. It never changes layout, focus or the selection. */
export function NotesFloatingSurface({ ownerRef, placement = "corner", selectionRect, children, className = "", version }: {
  ownerRef: RefObject<HTMLElement | null>; placement?: "corner" | "selection" | "panel";
  selectionRect?(): NotesFloatingRect | undefined; children: ReactNode; className?: string; version?: unknown;
}) {
  const surface = useRef<HTMLDivElement>(null), [position, setPosition] = useState<Position>();
  // Selection actions belong to the writer column, not adjacent tool rails.
  const findOwner = () => {
    const anchor = ownerRef.current;
    return (placement === "selection" ? anchor?.closest<HTMLElement>(".oe-notes-document-cell") : undefined) ?? anchor?.closest<HTMLElement>(".oe-notes-workspace") ?? anchor;
  };
  useLayoutEffect(() => {
    let frame = 0, stopped = false;
    const measure = () => {
      frame = 0;
      const owner = findOwner();
      if (stopped || !owner || owner.closest("[hidden]")) { setPosition(undefined); return; }
      const viewport = window.visualViewport, vl = viewport?.offsetLeft ?? 0, vt = viewport?.offsetTop ?? 0;
      const vr = vl + (viewport?.width ?? window.innerWidth), vb = vt + (viewport?.height ?? window.innerHeight);
      const raw = owner.getBoundingClientRect();
      const bounds = raw.width > 0 ? { left: Math.max(vl, raw.left), top: Math.max(vt, raw.top), right: Math.min(vr, raw.right), bottom: Math.min(vb, raw.bottom) } : { left: vl, top: vt, right: vr, bottom: vb };
      if (bounds.right - bounds.left < 24 || bounds.bottom - bounds.top < 24) { setPosition(undefined); return; }
      const maxWidth = bounds.right - bounds.left - 24, maxHeight = bounds.bottom - bounds.top - 24;
      const size = surface.current?.getBoundingClientRect(), width = Math.min(maxWidth, size?.width || 280), height = Math.min(maxHeight, size?.height || 44);
      const range = selectionRect?.();
      let left = bounds.right - width - 12, top = bounds.bottom - height - 12;
      if (placement === "panel") top = bounds.top + 12;
      if (placement === "selection" && range) {
        left = Math.max(bounds.left + 12, Math.min(bounds.right - width - 12, range.left));
        top = range.bottom + 8;
        if (top + height > bounds.bottom - 12) top = range.top - height - 8;
        // Offscreen selections do not leave a toolbar over unrelated text.
        if (range.bottom < bounds.top || range.top > bounds.bottom || range.right < bounds.left || range.left > bounds.right) { setPosition(undefined); return; }
      } else {
        const selection = window.getSelection();
        const selected = range ?? (selection?.rangeCount && owner.contains(selection.anchorNode) ? selection.getRangeAt(0).getBoundingClientRect?.() : undefined);
        if (selected && overlaps({ left, top, right: left + width, bottom: top + height }, selected)) {
          left = bounds.left + 12;
          if (overlaps({ left, top, right: left + width, bottom: top + height }, selected)) top = bounds.top + 12;
        }
      }
      top = Math.max(bounds.top + 12, Math.min(bounds.bottom - height - 12, top));
      const theme = getComputedStyle(owner);
      const variables = Object.fromEntries(["--note-canvas", "--note-text", "--note-line", "--oe-notes-border", "--oe-notes-muted", "--note-muted", "--note-accent", "--note-soft", "--note-rail"].map(key => [key, theme.getPropertyValue(key)])) as CSSProperties;
      const next = { left, top, maxWidth, maxHeight, variables };
      setPosition(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    const owner = findOwner();
    if (owner) observer?.observe(owner);
    if (surface.current) observer?.observe(surface.current);
    document.addEventListener("selectionchange", schedule); window.addEventListener("scroll", schedule, true); window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule); window.visualViewport?.addEventListener("scroll", schedule);
    return () => { stopped = true; cancelAnimationFrame(frame); observer?.disconnect(); document.removeEventListener("selectionchange", schedule); window.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule); window.visualViewport?.removeEventListener("resize", schedule); window.visualViewport?.removeEventListener("scroll", schedule); };
  }, [ownerRef, placement, selectionRect, version]);
  return createPortal(<div ref={surface} className={`oe-notes-floating-surface ${className}`} style={{ position: "fixed", left: position?.left ?? 0, top: position?.top ?? 0, maxWidth: position?.maxWidth ?? 280, maxHeight: position?.maxHeight ?? 44, visibility: position ? "visible" : "hidden", ...position?.variables }}>{children}</div>, document.body);
}
