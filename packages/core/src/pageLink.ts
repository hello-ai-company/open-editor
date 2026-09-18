/**
 * Host-neutral page reference codec.
 *
 * Supports a portable `#page:<encoded-id>` token for hosts that need an
 * href-style representation. Not bound to browser hash navigation — hosts may
 * use the opaque page id directly.
 */

export const PAGE_HREF_PREFIX = "#page:" as const;

/** Encode a stable page id into a portable href-style token. */
export function encodePageHref(pageId: string): string {
  return `${PAGE_HREF_PREFIX}${encodeURIComponent(pageId)}`;
}

/**
 * Decode a page id from an href-style token.
 * Returns null for malformed / non-page hrefs.
 */
export function decodePageHref(href: string): string | null {
  if (typeof href !== "string" || !href.startsWith(PAGE_HREF_PREFIX)) {
    return null;
  }
  const encoded = href.slice(PAGE_HREF_PREFIX.length);
  if (!encoded) return null;
  try {
    const decoded = decodeURIComponent(encoded);
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

export function isPageHref(href: string): boolean {
  return decodePageHref(href) !== null;
}
