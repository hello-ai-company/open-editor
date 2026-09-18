/**
 * Map presentation transforms (Phase 4F-4E).
 * Host-owned locations via resolveMapLocation — no geocoding, no map SDK.
 */
import type { DatabaseRowItem } from "@hello-ai-company/editor-core";
import type {
  DatabaseMapLocation,
  DatabaseMapLocationRequest,
  DatabaseViewRuntime
} from "./databaseViewRuntime.js";
import { cloneDatabaseRowRecord } from "./databaseRowPresentation.js";

export type MapLocationStatus =
  | { kind: "located"; location: DatabaseMapLocation }
  | { kind: "no-location" }
  | { kind: "invalid-location" };

export type MapPinProjection = {
  /** Percent from left edge (0–100). */
  xPercent: number;
  /** Percent from top edge (0–100). */
  yPercent: number;
};

/**
 * Validate host-returned location.
 * Finite numbers only; latitude ∈ [-90, 90], longitude ∈ [-180, 180].
 * (0, 0) is valid. No Number()/parseFloat coercion. No clamping.
 */
export function validateMapLocation(
  value: unknown
): DatabaseMapLocation | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const latitude = rec.latitude;
  const longitude = rec.longitude;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;

  const out: DatabaseMapLocation = { latitude, longitude };
  if (typeof rec.label === "string") {
    out.label = rec.label;
  }
  if (typeof rec.address === "string") {
    out.address = rec.address;
  }
  return out;
}

/**
 * Equirectangular projection into a unit rectangle (percent).
 * No jitter / index offset — overlapping pins share the same point.
 */
export function projectEquirectangular(
  location: Pick<DatabaseMapLocation, "latitude" | "longitude">
): MapPinProjection {
  return {
    xPercent: ((location.longitude + 180) / 360) * 100,
    yPercent: ((90 - location.latitude) / 180) * 100
  };
}

/**
 * Host location resolver with fail-closed behavior.
 * Caller must pass a defensive row clone — never a RuntimeStore live reference.
 */
export function safeResolveMapLocation(
  runtime: Pick<DatabaseViewRuntime, "resolveMapLocation">,
  request: DatabaseMapLocationRequest
): MapLocationStatus {
  const resolver = runtime.resolveMapLocation;
  if (!resolver) {
    return { kind: "no-location" };
  }
  try {
    const raw = resolver(request);
    if (raw === null || raw === undefined) {
      return { kind: "no-location" };
    }
    const validated = validateMapLocation(raw);
    if (!validated) {
      return { kind: "invalid-location" };
    }
    return { kind: "located", location: validated };
  } catch {
    return { kind: "invalid-location" };
  }
}

export type MapRowPresentation = {
  item: DatabaseRowItem;
  status: MapLocationStatus;
  projection: MapPinProjection | null;
};

/**
 * Resolve locations for loaded rows only (provider order preserved).
 */
export function buildMapRowPresentations(input: {
  items: readonly DatabaseRowItem[];
  runtime: Pick<DatabaseViewRuntime, "resolveMapLocation">;
  databaseId: string;
  viewId: string;
}): MapRowPresentation[] {
  const { items, runtime, databaseId, viewId } = input;
  return items.map((item) => {
    const status = safeResolveMapLocation(runtime, {
      databaseId,
      rowKey: item.rowKey,
      row: cloneDatabaseRowRecord(item.row),
      viewId,
      viewType: "map"
    });
    const projection =
      status.kind === "located"
        ? projectEquirectangular(status.location)
        : null;
    return { item, status, projection };
  });
}
