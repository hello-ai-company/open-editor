import {
  isEditorDocument,
  isSupportedSchemaVersion,
  type EditorBlock,
  type EditorDocument
} from "@hello-ai-company/editor-core";

export type CanvasTemplate = "landing-page" | "report" | "presentation";
export type CanvasBreakpoint = "mobile" | "tablet" | "desktop";
export type ResponsiveValue<T> = {
  mobile: T;
  tablet?: T;
  desktop?: T;
};

export type CanvasBreakpoints = {
  /** Minimum viewport width for tablet overrides, in CSS pixels. */
  tablet: number;
  /** Minimum viewport width for desktop overrides, in CSS pixels. */
  desktop: number;
};

export const DEFAULT_CANVAS_BREAKPOINTS: Readonly<CanvasBreakpoints> = {
  tablet: 768,
  desktop: 1024
};

export type CanvasRect = {
  /** Percent of the containing frame, in the inclusive range 0..100. */
  x: number;
  y: number;
  width: number;
  height: number;
};

type NodeBase = { id: string };

export type CanvasStackNode = NodeBase & {
  type: "stack";
  direction: "vertical" | "horizontal";
  gap?: ResponsiveValue<number>;
  padding?: ResponsiveValue<number>;
  children: CanvasLayoutNode[];
};

export type CanvasGridNode = NodeBase & {
  type: "grid";
  /** Responsive column count, from 1 to 12. */
  columns: ResponsiveValue<number>;
  gap?: ResponsiveValue<number>;
  children: CanvasLayoutNode[];
};

export type CanvasColumnsNode = NodeBase & {
  type: "columns";
  gap?: ResponsiveValue<number>;
  /** Fixed column groups; 1 to 12. Each group contains normal layout nodes. */
  columns: CanvasLayoutNode[][];
};

export type CanvasBlockElementType =
  | "text"
  | "image"
  | "card"
  | "divider"
  | "button"
  | "chart"
  | "embed";

export type CanvasBlockElementRef = NodeBase & {
  type: CanvasBlockElementType;
  /** Stable ID of the semantic block rendered by this element. */
  blockId: string;
};

export type CanvasGroupElement = NodeBase & {
  type: "section" | "frame";
  /** Optional semantic anchor, normally the heading that starts the group. */
  blockId?: string;
  children: CanvasLayoutNode[];
};

export type CanvasAbsoluteOverlayNode = NodeBase & {
  type: "absolute";
  /** Positioned leaves only; container layout remains responsive by default. */
  items: Array<{
    element: CanvasBlockElementRef;
    rect: ResponsiveValue<CanvasRect>;
  }>;
};

export type CanvasLayoutNode =
  | CanvasStackNode
  | CanvasGridNode
  | CanvasColumnsNode
  | CanvasGroupElement
  | CanvasBlockElementRef
  | CanvasAbsoluteOverlayNode;

export type CanvasThemeTokens = {
  fonts: {
    body: "sans" | "serif" | "mono";
    heading: "sans" | "serif" | "mono";
  };
  colors: {
    background: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    border: string;
  };
  typeScale: {
    body: number;
    heading: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  radius: number;
  shadow: "none" | "soft" | "strong";
  maxWidth: number;
};

export const CANVAS_THEME_PRESETS = {
  minimal: {
    fonts: { body: "sans", heading: "sans" },
    colors: {
      background: "#FFFFFF", surface: "#F9FAFB", text: "#1F2937",
      muted: "#6B7280", accent: "#2563EB", border: "#E5E7EB"
    },
    typeScale: { body: 1, heading: 1.5 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    radius: 8,
    shadow: "soft",
    maxWidth: 1120
  },
  editorial: {
    fonts: { body: "serif", heading: "serif" },
    colors: {
      background: "#FFFEFA", surface: "#F7F3EB", text: "#29251F",
      muted: "#756D62", accent: "#8A4B32", border: "#E5DED3"
    },
    typeScale: { body: 1.05, heading: 1.8 },
    spacing: { xs: 5, sm: 10, md: 18, lg: 28, xl: 40 },
    radius: 4,
    shadow: "none",
    maxWidth: 920
  },
  modern: {
    fonts: { body: "sans", heading: "sans" },
    colors: {
      background: "#F8FAFC", surface: "#FFFFFF", text: "#0F172A",
      muted: "#64748B", accent: "#4F46E5", border: "#CBD5E1"
    },
    typeScale: { body: 1, heading: 1.7 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 28, xl: 48 },
    radius: 16,
    shadow: "soft",
    maxWidth: 1200
  },
  premium: {
    fonts: { body: "serif", heading: "serif" },
    colors: {
      background: "#FCFAF7", surface: "#FFFFFF", text: "#26221F",
      muted: "#756B61", accent: "#A67C52", border: "#E8E0D6"
    },
    typeScale: { body: 1, heading: 1.85 },
    spacing: { xs: 4, sm: 10, md: 20, lg: 32, xl: 56 },
    radius: 10,
    shadow: "strong",
    maxWidth: 1160
  },
  playful: {
    fonts: { body: "sans", heading: "sans" },
    colors: {
      background: "#FFFDF7", surface: "#FFFFFF", text: "#29233D",
      muted: "#716A87", accent: "#E85D75", border: "#E9E2F3"
    },
    typeScale: { body: 1, heading: 1.65 },
    spacing: { xs: 5, sm: 10, md: 18, lg: 28, xl: 44 },
    radius: 20,
    shadow: "soft",
    maxWidth: 1160
  },
  technical: {
    fonts: { body: "mono", heading: "sans" },
    colors: {
      background: "#F8FAFC", surface: "#FFFFFF", text: "#172033",
      muted: "#64748B", accent: "#0F766E", border: "#CBD5E1"
    },
    typeScale: { body: 0.95, heading: 1.55 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 36 },
    radius: 6,
    shadow: "none",
    maxWidth: 1280
  }
} as const satisfies Record<string, CanvasThemeTokens>;

export type CanvasThemePresetName = keyof typeof CANVAS_THEME_PRESETS;
export type CanvasTheme = CanvasThemePresetName | CanvasThemeTokens;

export type CanvasLayoutSpec = {
  template: CanvasTemplate;
  breakpoints: CanvasBreakpoints;
  theme: CanvasTheme;
  root: CanvasLayoutNode;
};

export type CanvasLayoutValidationCode =
  | "INVALID_DOCUMENT"
  | "DUPLICATE_BLOCK_ID"
  | "INVALID_SPEC"
  | "INVALID_TEMPLATE"
  | "INVALID_BREAKPOINTS"
  | "INVALID_THEME"
  | "INVALID_NODE"
  | "DUPLICATE_LAYOUT_ID"
  | "MISSING_BLOCK_REFERENCE"
  | "OUT_OF_RANGE"
  | "LIMIT_EXCEEDED";

export type CanvasLayoutValidationIssue = {
  code: CanvasLayoutValidationCode;
  path: string;
  message: string;
};

export class CanvasLayoutValidationError extends Error {
  constructor(readonly issues: readonly CanvasLayoutValidationIssue[]) {
    super(issues.map(({ path, message }) => `${path}: ${message}`).join("; "));
    this.name = "CanvasLayoutValidationError";
  }
}

const MAX_LAYOUT_ID_LENGTH = 256;
// ponytail: fixed layout/document size ceilings; raise them if measured documents outgrow these limits.
const MAX_LAYOUT_NODES = 1000;
const MAX_DOCUMENT_BLOCKS = 10000;
const MAX_LAYOUT_DEPTH = 32;

type DocumentBlockScan = {
  blocks: EditorBlock[];
  ids: Set<string>;
  issues: CanvasLayoutValidationIssue[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function issue(
  code: CanvasLayoutValidationCode,
  path: string,
  message: string
): CanvasLayoutValidationIssue {
  return { code, path, message };
}

function scanDocument(document: unknown): DocumentBlockScan {
  const blocks: EditorBlock[] = [];
  const ids = new Set<string>();
  const issues: CanvasLayoutValidationIssue[] = [];
  if (!isRecord(document)
    || !isSupportedSchemaVersion(document.schemaVersion)
    || !Array.isArray(document.blocks)) {
    return { blocks, ids, issues: [issue("INVALID_DOCUMENT", "$document", "Expected a valid OpenEditor document.")] };
  }
  if (document.blocks.length > MAX_DOCUMENT_BLOCKS) {
    return { blocks, ids, issues: [issue("LIMIT_EXCEEDED", "$document.blocks", `Documents may contain at most ${MAX_DOCUMENT_BLOCKS} blocks for layout generation.`)] };
  }
  if (!isEditorDocument(document)) {
    return { blocks, ids, issues: [issue("INVALID_DOCUMENT", "$document", "Expected a valid OpenEditor document.")] };
  }

  const pending = document.blocks.map((block, index) => ({ block, path: `$document.blocks[${index}]` })).reverse();
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    if (blocks.length >= MAX_DOCUMENT_BLOCKS) {
      issues.push(issue("LIMIT_EXCEEDED", "$document.blocks", `Documents may contain at most ${MAX_DOCUMENT_BLOCKS} blocks for layout generation.`));
      break;
    }

    blocks.push(current.block);
    if (ids.has(current.block.id)) {
      issues.push(issue("DUPLICATE_BLOCK_ID", current.path, `Block id "${current.block.id}" is ambiguous.`));
    } else {
      ids.add(current.block.id);
    }
    const children = current.block.children ?? [];
    if (blocks.length + pending.length + children.length > MAX_DOCUMENT_BLOCKS) {
      issues.push(issue("LIMIT_EXCEEDED", "$document.blocks", `Documents may contain at most ${MAX_DOCUMENT_BLOCKS} blocks for layout generation.`));
      break;
    }
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child) pending.push({ block: child, path: `${current.path}.children[${index}]` });
    }
  }
  return { blocks, ids, issues };
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function boundedNumber(value: unknown, min: number, max: number): value is number {
  return finiteNumber(value) && value >= min && value <= max;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && boundedNumber(value, min, max);
}

function validateResponsive(
  value: unknown,
  path: string,
  validateValue: (entry: unknown, entryPath: string) => void,
  issues: CanvasLayoutValidationIssue[]
): void {
  if (!isRecord(value) || !Object.hasOwn(value, "mobile")) {
    issues.push(issue("INVALID_NODE", path, "Expected a responsive value with a mobile value."));
    return;
  }
  for (const key of Object.keys(value)) {
    if (key !== "mobile" && key !== "tablet" && key !== "desktop") {
      issues.push(issue("INVALID_NODE", `${path}.${key}`, "Unknown responsive breakpoint."));
    }
  }
  for (const breakpoint of ["mobile", "tablet", "desktop"] as const) {
    if (Object.hasOwn(value, breakpoint)) validateValue(value[breakpoint], `${path}.${breakpoint}`);
  }
}

function validateTheme(value: unknown, issues: CanvasLayoutValidationIssue[]): void {
  if (typeof value === "string") {
    if (!Object.hasOwn(CANVAS_THEME_PRESETS, value)) {
      issues.push(issue("INVALID_THEME", "$.theme", "Unknown theme preset."));
    }
    return;
  }
  if (!isRecord(value)) {
    issues.push(issue("INVALID_THEME", "$.theme", "Expected a theme preset or theme tokens."));
    return;
  }

  const path = "$.theme";
  const fonts = value.fonts;
  if (!isRecord(fonts) || !["sans", "serif", "mono"].includes(String(fonts.body)) || !["sans", "serif", "mono"].includes(String(fonts.heading))) {
    issues.push(issue("INVALID_THEME", `${path}.fonts`, "Font tokens must be sans, serif, or mono."));
  }
  const colors = value.colors;
  if (!isRecord(colors)) {
    issues.push(issue("INVALID_THEME", `${path}.colors`, "Expected color tokens."));
  } else {
    for (const token of ["background", "surface", "text", "muted", "accent", "border"] as const) {
      if (typeof colors[token] !== "string" || !/^#[\da-f]{6}$/i.test(colors[token])) {
        issues.push(issue("INVALID_THEME", `${path}.colors.${token}`, "Colors must use #RRGGBB hex values."));
      }
    }
  }

  const typeScale = value.typeScale;
  if (!isRecord(typeScale) || !boundedNumber(typeScale.body, 0.75, 1.5) || !boundedNumber(typeScale.heading, 1, 3)) {
    issues.push(issue("OUT_OF_RANGE", `${path}.typeScale`, "Body scale must be 0.75..1.5 and heading scale 1..3."));
  }
  const spacing = value.spacing;
  if (!isRecord(spacing)) {
    issues.push(issue("INVALID_THEME", `${path}.spacing`, "Expected spacing tokens."));
  } else {
    const values = [spacing.xs, spacing.sm, spacing.md, spacing.lg, spacing.xl];
    if (!values.every((entry) => boundedNumber(entry, 0, 256))) {
      issues.push(issue("OUT_OF_RANGE", `${path}.spacing`, "Spacing tokens must be 0..256 CSS pixels."));
    } else {
      const numericValues = values as number[];
      if (numericValues.some((entry, index) => index > 0 && entry < numericValues[index - 1]!)) {
        issues.push(issue("INVALID_THEME", `${path}.spacing`, "Spacing tokens must be nondecreasing from xs to xl."));
      }
    }
  }
  if (!boundedNumber(value.radius, 0, 32)) {
    issues.push(issue("OUT_OF_RANGE", `${path}.radius`, "Radius must be 0..32 CSS pixels."));
  }
  if (value.shadow !== "none" && value.shadow !== "soft" && value.shadow !== "strong") {
    issues.push(issue("INVALID_THEME", `${path}.shadow`, "Unknown shadow token."));
  }
  if (!isIntegerInRange(value.maxWidth, 320, 4096)) {
    issues.push(issue("OUT_OF_RANGE", `${path}.maxWidth`, "Maximum width must be an integer from 320 to 4096 CSS pixels."));
  }
}

function validateRect(value: unknown, path: string, issues: CanvasLayoutValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue("INVALID_NODE", path, "Expected a rectangle."));
    return;
  }
  for (const key of ["x", "y", "width", "height"] as const) {
    if (!boundedNumber(value[key], 0, 100)) {
      issues.push(issue("OUT_OF_RANGE", `${path}.${key}`, "Rectangle values must be 0..100 percent."));
    }
  }
  const x = value.x;
  const y = value.y;
  const width = value.width;
  const height = value.height;
  if (boundedNumber(x, 0, 100) && boundedNumber(width, 0, 100)) {
    if (width === 0 || x + width > 100) {
      issues.push(issue("OUT_OF_RANGE", path, "Rectangle width must be positive and remain inside its frame."));
    }
  }
  if (boundedNumber(y, 0, 100) && boundedNumber(height, 0, 100)) {
    if (height === 0 || y + height > 100) {
      issues.push(issue("OUT_OF_RANGE", path, "Rectangle height must be positive and remain inside its frame."));
    }
  }
}

const blockElementTypes = new Set<CanvasBlockElementType>([
  "text", "image", "card", "divider", "button", "chart", "embed"
]);

export function validateCanvasLayoutSpec(
  spec: unknown,
  document: unknown
): CanvasLayoutValidationIssue[] {
  const documentScan = scanDocument(document);
  if (documentScan.issues.length > 0) return documentScan.issues;

  const issues: CanvasLayoutValidationIssue[] = [];
  if (!isRecord(spec)) {
    return [issue("INVALID_SPEC", "$", "Expected a canvas layout spec object.")];
  }
  if (spec.template !== "landing-page" && spec.template !== "report" && spec.template !== "presentation") {
    issues.push(issue("INVALID_TEMPLATE", "$.template", "Unknown canvas template."));
  }

  const breakpoints = spec.breakpoints;
  if (!isRecord(breakpoints)
    || !isIntegerInRange(breakpoints.tablet, 1, 4096)
    || !isIntegerInRange(breakpoints.desktop, 1, 4096)
    || breakpoints.tablet >= breakpoints.desktop) {
    issues.push(issue("INVALID_BREAKPOINTS", "$.breakpoints", "Tablet and desktop widths must be increasing integers from 1 to 4096."));
  }
  validateTheme(spec.theme, issues);

  const usedLayoutIds = new Set<string>();
  let nodeCount = 0;

  function validateId(value: unknown, path: string): void {
    if (typeof value !== "string" || value.length === 0 || value.length > MAX_LAYOUT_ID_LENGTH) {
      issues.push(issue("INVALID_NODE", `${path}.id`, `Layout IDs must contain 1..${MAX_LAYOUT_ID_LENGTH} characters.`));
      return;
    }
    if (usedLayoutIds.has(value)) {
      issues.push(issue("DUPLICATE_LAYOUT_ID", `${path}.id`, `Layout id "${value}" is duplicated.`));
    } else {
      usedLayoutIds.add(value);
    }
  }

  function validateBlockReference(value: unknown, path: string): void {
    if (typeof value !== "string" || !documentScan.ids.has(value)) {
      issues.push(issue("MISSING_BLOCK_REFERENCE", path, "Block reference does not exist in the document."));
    }
  }

  function validateGap(value: unknown, path: string): void {
    validateResponsive(value, path, (entry, entryPath) => {
      if (!boundedNumber(entry, 0, 256)) {
        issues.push(issue("OUT_OF_RANGE", entryPath, "Spacing must be 0..256 CSS pixels."));
      }
    }, issues);
  }

  function validateNode(value: unknown, path: string, depth: number): void {
    if (!isRecord(value)) {
      issues.push(issue("INVALID_NODE", path, "Expected a layout node."));
      return;
    }
    if (depth > MAX_LAYOUT_DEPTH) {
      issues.push(issue("LIMIT_EXCEEDED", path, `Layout nesting may not exceed ${MAX_LAYOUT_DEPTH} levels.`));
      return;
    }
    nodeCount += 1;
    if (nodeCount > MAX_LAYOUT_NODES) {
      if (nodeCount === MAX_LAYOUT_NODES + 1) {
        issues.push(issue("LIMIT_EXCEEDED", path, `Layouts may contain at most ${MAX_LAYOUT_NODES} nodes.`));
      }
      return;
    }
    validateId(value.id, path);

    const validateChildren = (children: unknown, childPath: string): void => {
      if (!Array.isArray(children)) {
        issues.push(issue("INVALID_NODE", childPath, "Expected a child node array."));
        return;
      }
      children.forEach((child, index) => validateNode(child, `${childPath}[${index}]`, depth + 1));
    };

    if (typeof value.type !== "string") {
      issues.push(issue("INVALID_NODE", `${path}.type`, "Layout node type is required."));
      return;
    }
    if (blockElementTypes.has(value.type as CanvasBlockElementType)) {
      validateBlockReference(value.blockId, `${path}.blockId`);
      return;
    }
    switch (value.type) {
      case "section":
      case "frame":
        if (value.blockId !== undefined) validateBlockReference(value.blockId, `${path}.blockId`);
        validateChildren(value.children, `${path}.children`);
        return;
      case "stack":
        if (value.direction !== "vertical" && value.direction !== "horizontal") {
          issues.push(issue("INVALID_NODE", `${path}.direction`, "Stack direction must be vertical or horizontal."));
        }
        if (value.gap !== undefined) validateGap(value.gap, `${path}.gap`);
        if (value.padding !== undefined) validateGap(value.padding, `${path}.padding`);
        validateChildren(value.children, `${path}.children`);
        return;
      case "grid":
        validateResponsive(value.columns, `${path}.columns`, (entry, entryPath) => {
          if (!isIntegerInRange(entry, 1, 12)) {
            issues.push(issue("OUT_OF_RANGE", entryPath, "Grid columns must be an integer from 1 to 12."));
          }
        }, issues);
        if (value.gap !== undefined) validateGap(value.gap, `${path}.gap`);
        validateChildren(value.children, `${path}.children`);
        return;
      case "columns":
        if (!Array.isArray(value.columns) || value.columns.length < 1 || value.columns.length > 12) {
          issues.push(issue("OUT_OF_RANGE", `${path}.columns`, "Columns layout must contain 1..12 column groups."));
        } else {
          value.columns.forEach((column, index) => validateChildren(column, `${path}.columns[${index}]`));
        }
        if (value.gap !== undefined) validateGap(value.gap, `${path}.gap`);
        return;
      case "absolute":
        if (!Array.isArray(value.items)) {
          issues.push(issue("INVALID_NODE", `${path}.items`, "Expected positioned element items."));
          return;
        }
        value.items.forEach((item, index) => {
          const itemPath = `${path}.items[${index}]`;
          if (!isRecord(item) || !isRecord(item.element) || !blockElementTypes.has(item.element.type as CanvasBlockElementType)) {
            issues.push(issue("INVALID_NODE", `${itemPath}.element`, "Absolute overlay items must reference block elements."));
            return;
          }
          validateNode(item.element, `${itemPath}.element`, depth + 1);
          validateResponsive(item.rect, `${itemPath}.rect`, (rect, rectPath) => validateRect(rect, rectPath, issues), issues);
        });
        return;
      default:
        issues.push(issue("INVALID_NODE", `${path}.type`, `Unsupported layout node type "${value.type}".`));
    }
  }

  validateNode(spec.root, "$.root", 0);
  return issues;
}

type HeadingGroup = {
  heading?: EditorBlock;
  blocks: EditorBlock[];
};

function headingGroups(blocks: readonly EditorBlock[]): HeadingGroup[] {
  const groups: HeadingGroup[] = [];
  let current: HeadingGroup | undefined;
  for (const block of blocks) {
    if (block.type === "heading") {
      current = { heading: block, blocks: [] };
      groups.push(current);
    } else {
      if (!current) {
        current = { blocks: [] };
        groups.push(current);
      }
      current.blocks.push(block);
    }
  }
  return groups;
}

function elementTypeFor(block: EditorBlock): CanvasBlockElementType {
  const type = block.type.toLowerCase();
  if (type === "image" || type.endsWith("image")) return "image";
  if (type === "divider" || type === "horizontalrule") return "divider";
  if (type === "button") return "button";
  if (type === "chart" || type === "chartplaceholder") return "chart";
  if (["embed", "webembed", "video", "audio", "file"].includes(type)) return "embed";
  if (["paragraph", "text", "quote"].includes(type)) return "text";
  return "card";
}

function elementFor(block: EditorBlock): CanvasBlockElementRef {
  return {
    id: `element:${block.id}`,
    type: elementTypeFor(block),
    blockId: block.id
  };
}

function documentBlocksOrThrow(document: unknown): EditorBlock[] {
  const scan = scanDocument(document);
  if (scan.issues.length > 0) throw new CanvasLayoutValidationError(scan.issues);
  return scan.blocks;
}

export function createMagicLayoutSpec(
  document: EditorDocument,
  template: CanvasTemplate
): CanvasLayoutSpec {
  const blocks = documentBlocksOrThrow(document);
  const gaps: Record<CanvasTemplate, ResponsiveValue<number>> = {
    "landing-page": { mobile: 24, tablet: 40, desktop: 64 },
    report: { mobile: 16, tablet: 24, desktop: 32 },
    presentation: { mobile: 12, tablet: 20, desktop: 24 }
  };
  const themes: Record<CanvasTemplate, CanvasThemePresetName> = {
    "landing-page": "modern",
    report: "editorial",
    presentation: "technical"
  };
  const groupType = template === "presentation" ? "frame" : "section";
  const children: CanvasLayoutNode[] = [];

  for (const [index, group] of headingGroups(blocks).entries()) {
    const content = group.blocks.map(elementFor);
    if (!group.heading) {
      children.push(...content);
      continue;
    }
    children.push({
      id: `${groupType}:${group.heading.id}:${index}`,
      type: groupType,
      blockId: group.heading.id,
      children: content
    });
  }

  const spec: CanvasLayoutSpec = {
    template,
    breakpoints: { ...DEFAULT_CANVAS_BREAKPOINTS },
    theme: themes[template],
    root: {
      id: "canvas:root",
      type: "stack",
      direction: "vertical",
      gap: gaps[template],
      children
    }
  };
  const issues = validateCanvasLayoutSpec(spec, document);
  if (issues.length > 0) throw new CanvasLayoutValidationError(issues);
  return spec;
}

export type PresentationSlide = {
  /** Stable for the same semantic heading (or first pre-heading block). */
  id: string;
  headingBlockId?: string;
  /** Semantic block IDs in document order; content is never copied. */
  blockIds: string[];
};

export function createPresentationSlides(document: EditorDocument): PresentationSlide[] {
  const blocks = documentBlocksOrThrow(document);
  const groups = headingGroups(blocks);
  return groups.map((group, index) => {
    const blockIds = [
      ...(group.heading ? [group.heading.id] : []),
      ...group.blocks.map((block) => block.id)
    ];
    const basis = group.heading?.id ?? group.blocks[0]?.id ?? `empty-${index}`;
    return {
      id: group.heading ? `slide:heading:${basis}` : `slide:preface:${basis}`,
      ...(group.heading ? { headingBlockId: group.heading.id } : {}),
      blockIds
    };
  });
}

export {
  duplicateCanvasNode,
  findCanvasNode,
  flattenCanvasNodes,
  getCanvasGapNode,
  moveCanvasNode,
  reorderCanvasNode,
  resolveResponsiveValue,
  setCanvasNodeGap
} from "./layoutOperations.js";
