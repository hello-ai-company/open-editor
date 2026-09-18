/**
 * DatabaseViewRuntime — BlockNote-layer host seam (Phase 4F-4A).
 * Kept in a thin module so renderers can import without circular deps on databaseView.tsx.
 */
import type { DatabaseProvider } from "@hello-ai-company/editor-core";
import type { DatabaseRuntimeStore } from "./databaseRuntimeStore.js";
import type {
  DatabaseRowOpenRequest,
  DatabaseViewRendererMap
} from "./databaseViewRenderers.js";

export type DatabaseViewRuntime = {
  database?: DatabaseProvider;
  /** Preferred: instance-scoped interaction store. */
  store?: DatabaseRuntimeStore;
  getTitle?: (databaseId: string) => string | undefined;
  /** Optional host-neutral row-open callback. */
  onOpenRow?: (request: DatabaseRowOpenRequest) => void;
  /**
   * Optional per-runtime renderer overrides.
   * Never a module-global registry — each editor/preset owns its map.
   */
  renderers?: DatabaseViewRendererMap;
};
