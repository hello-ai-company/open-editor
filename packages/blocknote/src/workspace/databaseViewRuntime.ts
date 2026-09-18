/**
 * DatabaseViewRuntime — BlockNote-layer host seam (Phase 4F-4A / 4F-4B / 4F-4D R1).
 * Kept in a thin module so renderers can import without circular deps on databaseView.tsx.
 *
 * Media seams (4F-4D R1):
 * - `resolveRowMedia` remains Gallery-only (`viewType: "gallery"`) for source compatibility
 * - `resolveFeedRowMedia` is the additive Feed seam (`viewType: "feed"`)
 * Do not widen `resolveRowMedia`'s parameter — callback parameter variance breaks legacy hosts.
 */
import type {
  DatabaseProvider,
  JsonValue
} from "@hello-ai-company/editor-core";
import type { DatabaseRuntimeStore } from "./databaseRuntimeStore.js";
import type {
  DatabaseRowOpenRequest,
  DatabaseViewRendererMap
} from "./databaseViewRenderers.js";

/** @deprecated Prefer literal `"gallery"` / `"feed"` on the dedicated request types. */
export type DatabaseRowMediaViewType = "gallery" | "feed";

/**
 * Gallery media request (Phase 4F-4B public contract — do not widen `viewType`).
 */
export type DatabaseRowMediaRequest = {
  databaseId: string;
  rowKey: string;
  row: Readonly<Record<string, JsonValue>>;
  viewId: string;
  viewType: "gallery";
};

/**
 * Feed media request (Phase 4F-4D additive — separate from Gallery contract).
 */
export type DatabaseFeedRowMediaRequest = {
  databaseId: string;
  rowKey: string;
  row: Readonly<Record<string, JsonValue>>;
  viewId: string;
  viewType: "feed";
};

export type DatabaseAnyRowMediaRequest =
  | DatabaseRowMediaRequest
  | DatabaseFeedRowMediaRequest;

export type DatabaseRowMedia = {
  src: string;
  alt?: string;
};

export type DatabaseViewRuntime = {
  database?: DatabaseProvider;
  /** Preferred: instance-scoped interaction store. */
  store?: DatabaseRuntimeStore;
  getTitle?: (databaseId: string) => string | undefined;
  /** Optional host-neutral row-open callback. */
  onOpenRow?: (request: DatabaseRowOpenRequest) => void;
  /**
   * Optional Gallery media resolver (presentation only).
   * Parameter remains `DatabaseRowMediaRequest` with `viewType: "gallery"` only.
   * Never serializes into EditorDocument / RuntimeStore.
   */
  resolveRowMedia?: (
    request: DatabaseRowMediaRequest
  ) => DatabaseRowMedia | null | undefined;
  /**
   * Optional Feed media resolver (presentation only).
   * Additive 4F-4D seam — does not widen `resolveRowMedia`.
   */
  resolveFeedRowMedia?: (
    request: DatabaseFeedRowMediaRequest
  ) => DatabaseRowMedia | null | undefined;
  /**
   * Optional per-runtime renderer overrides.
   * Never a module-global registry — each editor/preset owns its map.
   */
  renderers?: DatabaseViewRendererMap;
};
