import { createElement, type ReactNode } from "react";
import { NOTES_LUCIDE_BY_ID } from "./notesLucideIcons.js";

// Immutable, reviewed geometry can be shared across mounts and sizes. The cache
// is bounded by the static catalog; no metadata or host-provided markup enters it.
const geometry = new Map<string, ReactNode>();

/** Canonical metadata remains a string. Unknown and existing emoji values remain readable. */
export function NotesPageIcon({ value, fallback = "▤", size = 20 }: { value?: string; fallback?: string; size?: number }) {
  const icon = value?.startsWith("lucide:") ? NOTES_LUCIDE_BY_ID.get(value.slice(7)) : undefined;
  if (!icon) return <span className="oe-notes-icon-text" aria-hidden="true">{value || fallback}</span>;
  let children = geometry.get(icon.id);
  if (!children) {
    children = icon.nodes.map(([tag, attributes], index) => createElement(tag, { ...attributes, key: index }));
    geometry.set(icon.id, children);
  }
  return <svg aria-hidden="true" data-page-icon={value} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
