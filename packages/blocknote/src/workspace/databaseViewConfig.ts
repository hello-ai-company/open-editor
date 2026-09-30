/** Host-owned saved presentation state for one database view. Rows never belong here. */
import type {
  DatabaseFilter,
  DatabasePropertySort,
  DatabaseQueryCapabilities,
  EditorDatabase
} from "@hello-ai-company/editor-core";
import {
  hostSupportsPropertyFilters,
  isIsoDateString,
  resolveDatabasePropertyDefinitions,
  sanitizeFiltersAgainstMetadata,
  sanitizePropertySortAgainstMetadata,
  type ResolvedPropertyDefinition
} from "./databaseProperty.js";
import { isDatabaseViewType, type DatabaseViewType } from "./types.js";

const MAX_ID_LENGTH = 256;
const MAX_QUERY_LENGTH = 500;
const MAX_FILTERS = 20;
const MAX_FILTER_VALUE_LENGTH = 500;

export type DatabaseViewConfig = {
  schemaVersion: 1;
  databaseId: string;
  viewId: string;
  viewType: DatabaseViewType;
  query: string;
  sortBy: "position" | "title";
  direction: "asc" | "desc";
  filters: readonly DatabaseFilter[];
  propertySort: DatabasePropertySort | null;
  board?: { groupPropertyId?: string | null };
  calendar?: { datePropertyId?: string | null; scale?: "month" | "week" };
  timeline?: { datePropertyId?: string | null };
  gantt?: { startPropertyId?: string | null; endPropertyId?: string | null };
  chart?: { metricPropertyId?: string | null };
  feed?: { datePropertyId?: string | null };
  dashboard?: {
    categoricalPropertyId?: string | null;
    numericPropertyId?: string | null;
    datePropertyId?: string | null;
  };
};

/** Persistence remains owned by the host. `load` is untrusted at runtime. */
export type DatabaseViewConfigProvider = {
  load?: (databaseId: string, viewId: string) => Promise<unknown | null>;
  save?: (config: DatabaseViewConfig) => Promise<void>;
  delete?: (databaseId: string, viewId: string) => Promise<void>;
  /** Discover saved views, including OpenEditor-created IDs absent from EditorDatabase.views. */
  list?: (databaseId: string) => Promise<readonly DatabaseViewConfigIdentity[]>;
};

export type DatabaseViewConfigIdentity = {
  databaseId: string;
  viewId: string;
  viewType: DatabaseViewType;
};

export type DatabaseViewConfigValidation = {
  config: DatabaseViewConfig;
  warnings: readonly string[];
  valid: boolean;
};

export type DatabaseViewConfigHydration = DatabaseViewConfigValidation & {
  /** True only when the host successfully reported that no config existed. */
  missing: boolean;
};

/** Validate a host-provided saved-view listing and discard foreign/duplicate identities. */
export function validateDatabaseViewConfigIdentities(
  value: unknown,
  databaseId: string
): DatabaseViewConfigIdentity[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: DatabaseViewConfigIdentity[] = [];
  for (const item of value) {
    if (
      !isRecord(item) || item.databaseId !== databaseId || !boundedId(item.viewId) ||
      typeof item.viewType !== "string" || !isDatabaseViewType(item.viewType)
    ) continue;
    if (seen.has(item.viewId)) continue;
    seen.add(item.viewId);
    out.push({ databaseId, viewId: item.viewId, viewType: item.viewType });
  }
  return out;
}

export async function listDatabaseViewConfigIdentities(
  provider: DatabaseViewConfigProvider | undefined,
  databaseId: string
): Promise<DatabaseViewConfigIdentity[]> {
  if (!provider?.list) return [];
  try {
    return validateDatabaseViewConfigIdentities(await provider.list(databaseId), databaseId);
  } catch {
    return [];
  }
}

export function createDefaultDatabaseViewConfig(input: {
  databaseId: string;
  viewId: string;
  viewType: DatabaseViewType;
}): DatabaseViewConfig {
  return {
    schemaVersion: 1,
    databaseId: input.databaseId,
    viewId: input.viewId,
    viewType: input.viewType,
    query: "",
    sortBy: "position",
    direction: "asc",
    filters: [],
    propertySort: null
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function boundedId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

function parseFilters(value: unknown): DatabaseFilter[] | null {
  if (!Array.isArray(value) || value.length > MAX_FILTERS) return null;
  const filters: DatabaseFilter[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || !boundedId(raw.propertyId)) return null;
    const { propertyId, propertyType, operator } = raw;
    const empty = operator === "isEmpty" || operator === "isNotEmpty";
    if (empty) {
      if (
        !["text", "number", "boolean", "date", "url", "select", "status"].includes(String(propertyType)) ||
        Object.hasOwn(raw, "value")
      ) return null;
      filters.push({ propertyId, propertyType: propertyType as DatabaseFilter["propertyType"], operator });
      continue;
    }
    if (typeof raw.value === "string" && raw.value.length <= MAX_FILTER_VALUE_LENGTH) {
      const stringType = propertyType === "text" || propertyType === "url" || propertyType === "select" || propertyType === "status";
      const stringOp = operator === "contains" || operator === "equals" || operator === "notEquals";
      const dateOp = operator === "on" || operator === "before" || operator === "after";
      if (stringType && stringOp) {
        filters.push({ propertyId, propertyType, operator, value: raw.value } as DatabaseFilter);
        continue;
      }
      if (propertyType === "date" && dateOp && isIsoDateString(raw.value)) {
        filters.push({ propertyId, propertyType, operator, value: raw.value } as DatabaseFilter);
        continue;
      }
    }
    if (propertyType === "number" && operator === "equals" && typeof raw.value === "number" && Number.isFinite(raw.value)) {
      filters.push({ propertyId, propertyType, operator, value: raw.value });
      continue;
    }
    if (propertyType === "number" && ["gt", "gte", "lt", "lte"].includes(String(operator)) && typeof raw.value === "number" && Number.isFinite(raw.value)) {
      filters.push({ propertyId, propertyType, operator: operator as "gt" | "gte" | "lt" | "lte", value: raw.value });
      continue;
    }
    if (propertyType === "boolean" && operator === "is" && typeof raw.value === "boolean") {
      filters.push({ propertyId, propertyType, operator, value: raw.value });
      continue;
    }
    return null;
  }
  return filters;
}

function propertyWithType(
  definitions: readonly ResolvedPropertyDefinition[],
  id: unknown,
  allowed: readonly string[]
): string | null | undefined {
  if (id === undefined) return undefined;
  if (id === null) return null;
  if (!boundedId(id)) return undefined;
  return definitions.some((def) => def.id === id && allowed.includes(def.type)) ? id : undefined;
}

function parsePropertyGroup(
  value: unknown,
  allowedKeys: readonly string[],
  definitions: readonly ResolvedPropertyDefinition[],
  propertyRules: Record<string, readonly string[]>
): Record<string, string | null> | null | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || Object.keys(value).some((key) => !allowedKeys.includes(key))) return null;
  const out: Record<string, string | null> = {};
  for (const key of allowedKeys) {
    if (!Object.hasOwn(value, key)) continue;
    const resolved = propertyWithType(definitions, value[key], propertyRules[key] ?? []);
    if (resolved === undefined) return null;
    out[key] = resolved;
  }
  return out;
}

const TOP_LEVEL_KEYS = new Set([
  "schemaVersion", "databaseId", "viewId", "viewType", "query", "sortBy",
  "direction", "filters", "propertySort", "board", "calendar", "timeline",
  "gantt", "chart", "feed", "dashboard"
]);

/** Validate a host-loaded config, dropping unsupported metadata-bound choices safely. */
export function validateDatabaseViewConfig(input: {
  value: unknown;
  databaseId: string;
  viewId: string;
  viewType: DatabaseViewType;
  database?: EditorDatabase | null;
}): DatabaseViewConfigValidation {
  const fallback = createDefaultDatabaseViewConfig(input);
  const warnings: string[] = [];
  const raw = input.value;
  if (
    !isRecord(raw) ||
    Object.keys(raw).some((key) => !TOP_LEVEL_KEYS.has(key)) ||
    raw.schemaVersion !== 1 ||
    raw.databaseId !== input.databaseId ||
    raw.viewId !== input.viewId ||
    typeof raw.viewType !== "string" || !isDatabaseViewType(raw.viewType) ||
    raw.viewType !== input.viewType ||
    (raw.query !== undefined && (typeof raw.query !== "string" || raw.query.length > MAX_QUERY_LENGTH)) ||
    (raw.sortBy !== undefined && raw.sortBy !== "position" && raw.sortBy !== "title") ||
    (raw.direction !== undefined && raw.direction !== "asc" && raw.direction !== "desc")
  ) {
    return { config: fallback, warnings: ["Saved database view config was invalid; defaults were used"], valid: false };
  }
  const definitions = resolveDatabasePropertyDefinitions({
    legacySchema: {},
    definitions: input.database?.propertyDefinitions
  });
  const caps: DatabaseQueryCapabilities | undefined = input.database?.queryCapabilities;
  let filters = parseFilters(raw.filters ?? []);
  if (!filters) {
    filters = [];
    warnings.push("Saved filters were invalid and were cleared");
  } else if (filters.length && !hostSupportsPropertyFilters(caps)) {
    filters = [];
    warnings.push("Saved filters were cleared because the host does not support them");
  } else if (filters.length) {
    const sanitized = sanitizeFiltersAgainstMetadata(filters, definitions, caps);
    if (sanitized.removed.length) warnings.push("Saved filters for unavailable properties were cleared");
    filters = [...sanitized.filters];
  }

  let propertySort: DatabasePropertySort | null = null;
  if (raw.propertySort !== null && raw.propertySort !== undefined) {
    if (
      isRecord(raw.propertySort) && boundedId(raw.propertySort.propertyId) &&
      (raw.propertySort.direction === "asc" || raw.propertySort.direction === "desc")
    ) {
      propertySort = sanitizePropertySortAgainstMetadata(
        { propertyId: raw.propertySort.propertyId, direction: raw.propertySort.direction },
        definitions,
        caps
      );
    }
    if (!propertySort) warnings.push("Saved property sort was invalid or unsupported and was cleared");
  }

  const config: DatabaseViewConfig = {
    schemaVersion: 1,
    databaseId: input.databaseId,
    viewId: input.viewId,
    viewType: input.viewType,
    query: (raw.query as string | undefined) ?? "",
    sortBy: raw.sortBy === "title" ? "title" : "position",
    direction: raw.direction === "desc" ? "desc" : "asc",
    filters,
    propertySort
  };

  const group = (key: string, fields: readonly string[], rules: Record<string, readonly string[]>) => {
    const result = parsePropertyGroup(raw[key], fields, definitions, rules);
    if (result === null) warnings.push(`Saved ${key} settings were invalid and were cleared`);
    else if (result !== undefined) (config as unknown as Record<string, unknown>)[key] = result;
  };
  group("board", ["groupPropertyId"], { groupPropertyId: ["select", "status"] });
  if (raw.calendar !== undefined) {
    if (!isRecord(raw.calendar) || Object.keys(raw.calendar).some((key) => !["datePropertyId", "scale"].includes(key))) {
      warnings.push("Saved calendar settings were invalid and were cleared");
    } else {
      const datePropertyId = propertyWithType(definitions, raw.calendar.datePropertyId, ["date"]);
      if (datePropertyId !== undefined || raw.calendar.datePropertyId === undefined) {
        config.calendar = { ...(datePropertyId === undefined ? {} : { datePropertyId }) };
      } else {
        warnings.push("Saved Calendar date property was unavailable and was cleared");
      }
      if (raw.calendar.scale === "month" || raw.calendar.scale === "week") {
        config.calendar = { ...config.calendar, scale: raw.calendar.scale };
      } else if (raw.calendar.scale !== undefined) {
        warnings.push("Saved Calendar scale was invalid and was reset");
      }
    }
  }
  group("timeline", ["datePropertyId"], { datePropertyId: ["date"] });
  group("gantt", ["startPropertyId", "endPropertyId"], { startPropertyId: ["date"], endPropertyId: ["date"] });
  group("chart", ["metricPropertyId"], { metricPropertyId: ["number", "select", "status"] });
  group("feed", ["datePropertyId"], { datePropertyId: ["date"] });
  group("dashboard", ["categoricalPropertyId", "numericPropertyId", "datePropertyId"], {
    categoricalPropertyId: ["select", "status"], numericPropertyId: ["number"], datePropertyId: ["date"]
  });

  return { config, warnings, valid: true };
}

/** Load+validate config and metadata before the caller starts the first row query. */
export async function loadDatabaseViewHydration(input: {
  provider?: DatabaseViewConfigProvider;
  databaseProvider?: { getDatabase?: (databaseId: string) => Promise<EditorDatabase | null> };
  databaseId: string;
  viewId: string;
  viewType: DatabaseViewType;
}): Promise<DatabaseViewConfigHydration> {
  const warnings: string[] = [];
  let raw: unknown | null = null;
  let loadFailed = false;
  try {
    raw = input.provider?.load
      ? await input.provider.load(input.databaseId, input.viewId)
      : null;
  } catch {
    loadFailed = true;
    warnings.push("Saved view could not be loaded; defaults were used");
  }
  if (raw === null || raw === undefined) {
    return {
      config: createDefaultDatabaseViewConfig(input),
      warnings,
      valid: warnings.length === 0,
      missing: !loadFailed
    };
  }
  let metadata: EditorDatabase | null = null;
  try {
    const loadedMetadata = input.databaseProvider?.getDatabase
      ? await input.databaseProvider.getDatabase(input.databaseId)
      : null;
    if (loadedMetadata?.id === input.databaseId) metadata = loadedMetadata;
    else if (loadedMetadata) warnings.push("Database metadata identity did not match; property settings were cleared");
  } catch {
    warnings.push("Database metadata unavailable; property settings were cleared");
  }
  const validated = validateDatabaseViewConfig({ ...input, value: raw, database: metadata });
  return { ...validated, warnings: [...warnings, ...validated.warnings], missing: false };
}

/** Immutable merge for intentional settings changes; identity is never patchable. */
export function patchDatabaseViewConfig(
  current: DatabaseViewConfig,
  patch: Partial<Omit<DatabaseViewConfig, "schemaVersion" | "databaseId" | "viewId" | "viewType">>
): DatabaseViewConfig {
  const next: DatabaseViewConfig = {
    schemaVersion: 1,
    databaseId: current.databaseId,
    viewId: current.viewId,
    viewType: current.viewType,
    query: typeof patch.query === "string" ? patch.query.slice(0, MAX_QUERY_LENGTH) : current.query.slice(0, MAX_QUERY_LENGTH),
    sortBy: patch.sortBy === "title" || patch.sortBy === "position" ? patch.sortBy : current.sortBy,
    direction: patch.direction === "desc" || patch.direction === "asc" ? patch.direction : current.direction,
    filters: patch.filters === undefined ? parseFilters(current.filters) ?? [] : parseFilters(patch.filters) ?? [],
    propertySort: current.propertySort && boundedId(current.propertySort.propertyId) &&
      (current.propertySort.direction === "asc" || current.propertySort.direction === "desc")
      ? { ...current.propertySort }
      : null
  };
  if (patch.propertySort !== undefined) {
    next.propertySort = patch.propertySort && boundedId(patch.propertySort.propertyId) &&
      (patch.propertySort.direction === "asc" || patch.propertySort.direction === "desc")
      ? { ...patch.propertySort }
      : null;
  }

  const mergePropertyGroup = (key: string, fields: readonly string[]) => {
    const base = (current as unknown as Record<string, unknown>)[key];
    const update = (patch as unknown as Record<string, unknown>)[key];
    if (!isRecord(base) && !isRecord(update)) return;
    const merged: Record<string, unknown> = {};
    for (const field of fields) {
      const source = isRecord(update) && Object.hasOwn(update, field) ? update : base;
      if (!isRecord(source) || !Object.hasOwn(source, field)) continue;
      const fieldValue = source[field];
      merged[field] = fieldValue === null || boundedId(fieldValue) ? fieldValue : null;
    }
    if (key === "calendar") {
      const scaleSource = isRecord(update) && Object.hasOwn(update, "scale") ? update : base;
      if (isRecord(scaleSource) && (scaleSource.scale === "month" || scaleSource.scale === "week")) {
        merged.scale = scaleSource.scale;
      }
    }
    (next as unknown as Record<string, unknown>)[key] = merged;
  };
  mergePropertyGroup("board", ["groupPropertyId"]);
  mergePropertyGroup("calendar", ["datePropertyId"]);
  mergePropertyGroup("timeline", ["datePropertyId"]);
  mergePropertyGroup("gantt", ["startPropertyId", "endPropertyId"]);
  mergePropertyGroup("chart", ["metricPropertyId"]);
  mergePropertyGroup("feed", ["datePropertyId"]);
  mergePropertyGroup("dashboard", ["categoricalPropertyId", "numericPropertyId", "datePropertyId"]);
  return next;
}

/** Serializes writes so an earlier slow save can never finish after a newer save. */
export function createDatabaseViewConfigWriter(
  provider: DatabaseViewConfigProvider | undefined,
  onError: (error: string | null) => void
): { save(config: DatabaseViewConfig): Promise<void>; retry(): Promise<void> } {
  let lastCoordinator: DatabaseViewConfigWriteCoordinator | null = null;
  const enqueue = (config: DatabaseViewConfig): Promise<void> => {
    if (!provider?.save) return Promise.resolve();
    const snapshot = structuredClone(config);
    const coordinator = getDatabaseViewConfigWriteCoordinator(provider, snapshot);
    lastCoordinator = coordinator;
    coordinator.latestConfig = snapshot;
    const revision = ++coordinator.latestRevision;
    const write = coordinator.tail.catch(() => undefined).then(() => provider.save!(snapshot));
    coordinator.tail = write.then(
      () => { if (revision === coordinator.latestRevision) onError(null); },
      (error: unknown) => {
        if (revision === coordinator.latestRevision) onError(error instanceof Error ? error.message : "Failed to save database view");
      }
    );
    return coordinator.tail;
  };
  return {
    save: enqueue,
    retry: () => lastCoordinator?.latestConfig ? enqueue(lastCoordinator.latestConfig) : Promise.resolve()
  };
}

type DatabaseViewConfigWriteCoordinator = {
  latestRevision: number;
  latestConfig: DatabaseViewConfig | null;
  tail: Promise<void>;
};

const configWriteCoordinators = new WeakMap<
  DatabaseViewConfigProvider,
  Map<string, DatabaseViewConfigWriteCoordinator>
>();

function getDatabaseViewConfigWriteCoordinator(
  provider: DatabaseViewConfigProvider,
  config: DatabaseViewConfig
): DatabaseViewConfigWriteCoordinator {
  let byIdentity = configWriteCoordinators.get(provider);
  if (!byIdentity) {
    byIdentity = new Map();
    configWriteCoordinators.set(provider, byIdentity);
  }
  const key = JSON.stringify([config.databaseId, config.viewId]);
  let coordinator = byIdentity.get(key);
  if (!coordinator) {
    coordinator = { latestRevision: 0, latestConfig: null, tail: Promise.resolve() };
    byIdentity.set(key, coordinator);
  }
  return coordinator;
}
