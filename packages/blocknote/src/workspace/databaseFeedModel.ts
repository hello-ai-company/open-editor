/**
 * Feed date presentation helpers (Phase 4F-4D).
 * Date-only YYYY-MM-DD — no timezone / datetime / ranges.
 */
import type { DatabaseRowItem } from "@hello-ai-company/editor-core";
import {
  listCalendarDateProperties,
  resolveCalendarDateProperty
} from "./databaseCalendarModel.js";
import {
  classifyTimelineDate,
  parseCanonicalDateKey
} from "./databaseDateAxisModel.js";
import {
  buildDatabaseRowPresentation,
  type DatabaseRowPresentation
} from "./databaseRowPresentation.js";
import type { ResolvedPropertyDefinition } from "./databaseProperty.js";

export function listFeedDateProperties(
  definitions: readonly ResolvedPropertyDefinition[]
): ResolvedPropertyDefinition[] {
  return listCalendarDateProperties(definitions);
}

export function resolveFeedDateProperty(
  definitions: readonly ResolvedPropertyDefinition[],
  selectedPropertyId: string | null | undefined
): ResolvedPropertyDefinition | null {
  return resolveCalendarDateProperty(definitions, selectedPropertyId);
}

export type FeedDateMeta = {
  kind: "valid" | "missing" | "invalid";
  text: string;
};

export function formatFeedDateMeta(value: unknown): FeedDateMeta {
  const kind = classifyTimelineDate(value);
  if (kind === "missing") {
    return { kind, text: "No date" };
  }
  if (kind === "invalid") {
    return { kind, text: "Invalid date" };
  }
  const parsed = parseCanonicalDateKey(value);
  return {
    kind: "valid",
    text: parsed?.dateKey ?? "Invalid date"
  };
}

export function buildFeedItemPresentation(
  item: DatabaseRowItem,
  definitions: readonly ResolvedPropertyDefinition[],
  datePropertyId: string | null | undefined
): DatabaseRowPresentation {
  const exclude = new Set<string>();
  if (datePropertyId) {
    exclude.add(datePropertyId);
  }
  return buildDatabaseRowPresentation(item, definitions, {
    maxPreviewFields: 4,
    excludePropertyIds: exclude
  });
}
