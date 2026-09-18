/**
 * DatabaseViewRuntime — BlockNote-layer host seam (Phase 4F-4A / 4F-4B).
 * Kept in a thin module so renderers can import without circular deps on databaseView.tsx.
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

/** Host presentation media for Gallery (never persisted). */
export type DatabaseRowMediaRequest = {
  databaseId: string;
  rowKey: string;
  row: Readonly<Record<string, JsonValue>>;
  viewId: string;
  viewType: "gallery";
};

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
   * Never serializes into EditorDocument / RuntimeStore.
   */
  resolveRowMedia?: (
    request: DatabaseRowMediaRequest
  ) => DatabaseRowMedia | null | undefined;
  /**
   * Optional per-runtime renderer overrides.
   * Never a module-global registry — each editor/preset owns its map.
   */
  renderers?: DatabaseViewRendererMap;
};
