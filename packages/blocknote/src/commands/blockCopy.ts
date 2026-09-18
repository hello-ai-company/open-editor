/**
 * Lossless PartialBlock clone for duplicate — omits `id` so BlockNote assigns a new one.
 */
export function toPartialBlockCopy(block: unknown): Record<string, unknown> {
  const source = block as {
    type?: string;
    props?: Record<string, unknown>;
    content?: unknown;
    children?: unknown[];
  };

  const copy: Record<string, unknown> = {
    type: source.type ?? "paragraph"
  };

  if (source.props && typeof source.props === "object") {
    copy.props = { ...source.props };
  }

  if (source.content !== undefined) {
    copy.content = source.content;
  }

  if (Array.isArray(source.children) && source.children.length > 0) {
    copy.children = source.children.map((child) => toPartialBlockCopy(child));
  }

  return copy;
}
