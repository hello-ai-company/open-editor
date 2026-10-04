import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactElement } from "react";
import type { EditorDatabase } from "@hello-ai-company/editor-core";
import { isDatabaseViewType, type DatabaseViewType } from "../workspace/types.js";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";

export type DatabaseViewPick = {
  databaseId: string;
  viewId: string;
  viewType: DatabaseViewType;
  titleHint: string;
};

export type DatabaseViewPickerProps = {
  open: boolean;
  databases: readonly EditorDatabase[];
  onPick: (selection: DatabaseViewPick | null) => void;
  title?: string;
  initialDatabaseId?: string;
  initialViewType?: DatabaseViewType;
  loading?: boolean;
  errorMessage?: string;
  saving?: boolean;
  selectionLocked?: boolean;
  onRetry?: () => void;
  retryLabel?: string;
  /** False when adding a new view to the already selected database. */
  allowExistingViews?: boolean;
  /** When set, keep the database fixed and omit its selector. */
  fixedDatabaseId?: string;
};

const VIEW_LABELS: Record<DatabaseViewType, string> = {
  table: "Table",
  board: "Board",
  calendar: "Calendar",
  list: "List",
  gallery: "Gallery",
  timeline: "Timeline",
  gantt: "Gantt",
  chart: "Chart",
  feed: "Feed",
  map: "Map",
  dashboard: "Dashboard"
};

const VIEW_PICKER_ORDER: readonly DatabaseViewType[] = [
  "table", "board", "calendar", "list", "gallery", "timeline", "gantt", "chart", "feed", "map", "dashboard"
];

const VIEW_DESCRIPTIONS: Record<DatabaseViewType, string> = {
  table: "Edit and compare structured rows.",
  board: "Group rows by a status or select property.",
  calendar: "Place dated rows on a month or week calendar.",
  list: "Read rows in a compact, scannable list.",
  gallery: "Browse rows as visual cards.",
  timeline: "Compare dated work along a timeline.",
  gantt: "See start and end dates as a schedule.",
  chart: "Summarize a numeric property visually.",
  feed: "Read dated rows as a chronological feed.",
  map: "Show host-resolved locations for rows.",
  dashboard: "Combine compact summaries of this database."
};

function createViewId(): string {
  const id = globalThis.crypto?.randomUUID?.();
  return `view-${id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}

type PickerDatabase = {
  id: string;
  title: string;
  views: Array<{ id: string; title?: string; viewType?: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeDatabase(value: unknown): PickerDatabase | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" || !value.id.trim() || value.id.length > 256 ||
    typeof value.title !== "string" || !value.title.trim()
  ) return null;
  const views = Array.isArray(value.views) ? value.views.flatMap((view) => {
    if (!isRecord(view) || typeof view.id !== "string" || !view.id.trim() || view.id.length > 256) return [];
    return [{
      id: view.id,
      title: typeof view.title === "string" ? view.title.slice(0, 200) : undefined,
      viewType: typeof view.viewType === "string" ? view.viewType : undefined
    }];
  }) : [];
  return { id: value.id, title: value.title.slice(0, 200), views };
}

function displayTitle(value: unknown, fallback: string): string {
  const title = typeof value === "string" ? value.trim() : "";
  return (title ? title : fallback).slice(0, 200);
}

/** Host-metadata-only database/view picker. It never creates a database identity. */
export function DatabaseViewPicker(props: DatabaseViewPickerProps): ReactElement | null {
  const headingId = useId();
  const detailId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [databaseId, setDatabaseId] = useState("");
  const [viewChoice, setViewChoice] = useState("new");
  const [viewType, setViewType] = useState<DatabaseViewType>(props.initialViewType ?? "table");
  useDialogFocusTrap(props.open, dialogRef);

  const databases = useMemo(
    () => (props.databases as readonly unknown[]).flatMap((database) => {
      const sanitized = sanitizeDatabase(database);
      return sanitized ? [sanitized] : [];
    }),
    [props.databases]
  );
  const databaseKey = useMemo(() => databases.map(({ id }) => id).join("\0"), [databases]);
  useEffect(() => {
    if (!props.open) return;
    const preferredId = props.fixedDatabaseId ?? props.initialDatabaseId;
    const initialDatabase = databases.find(({ id }) => id === preferredId) ?? databases[0];
    setDatabaseId(initialDatabase?.id ?? "");
    setViewChoice("new");
    setViewType(props.initialViewType ?? "table");
  }, [props.open, props.fixedDatabaseId, props.initialDatabaseId, props.initialViewType, databaseKey]);

  const selectedDatabase = props.fixedDatabaseId
    ? databases.find(({ id }) => id === props.fixedDatabaseId)
    : databases.find(({ id }) => id === databaseId) ?? databases[0];
  const existingViews = props.allowExistingViews === false
    ? []
    : selectedDatabase?.views ?? [];
  const selectedExistingView = existingViews.find(({ id }) => id === viewChoice);
  const existingViewType = selectedExistingView && isDatabaseViewType(selectedExistingView.viewType ?? "")
    ? selectedExistingView.viewType as DatabaseViewType
    : null;
  const canInsert = Boolean(selectedDatabase?.id) && (viewChoice === "new" || Boolean(existingViewType));

  if (!props.open) return null;

  const close = () => props.onPick(null);
  const dismiss = () => {
    if (props.saving || props.selectionLocked) return;
    close();
  };
  const pick = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDatabase?.id || !canInsert) return;
    if (selectedExistingView && existingViewType) {
      props.onPick({
        databaseId: selectedDatabase.id,
        viewId: selectedExistingView.id,
        viewType: existingViewType,
        titleHint: displayTitle(selectedExistingView.title, selectedDatabase.title)
      });
      return;
    }
    props.onPick({
      databaseId: selectedDatabase.id,
      viewId: createViewId(),
      viewType,
      titleHint: displayTitle(`${selectedDatabase.title} · ${VIEW_LABELS[viewType]}`, "Database view")
    });
  };

  const isNewView = !selectedExistingView;
  const description = isNewView
    ? VIEW_DESCRIPTIONS[viewType]
    : existingViewType
      ? VIEW_DESCRIPTIONS[existingViewType]
      : "This saved view uses an unsupported view type.";

  return (
    <div
      className="oe-database-picker"
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        ref={dialogRef}
        className="oe-database-picker__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Escape") {
            event.preventDefault();
            dismiss();
          }
        }}
      >
        <h2 className="oe-database-picker__heading" id={headingId}>
          {props.title ?? "Insert database view"}
        </h2>
        {props.errorMessage ? (
          <p className="oe-database-picker__status" role="alert">{props.errorMessage}</p>
        ) : null}
        {props.saving ? (
          <p className="oe-database-picker__status" role="status">Registering view…</p>
        ) : null}
        <form className="oe-database-picker__form" onSubmit={pick}>
          {props.loading ? (
            <p className="oe-database-picker__status" role="status">Loading databases…</p>
          ) : !selectedDatabase ? (
            <p className="oe-database-picker__status" role="status">
              No databases are available from the host.
            </p>
          ) : (
            <>
            {props.fixedDatabaseId ? (
              <p className="oe-database-picker__database-name">{selectedDatabase.title}</p>
            ) : (
              <label className="oe-database-picker__field">
                <span>Database</span>
                <select
                  aria-label="Database"
                  value={selectedDatabase.id}
                  disabled={props.selectionLocked || props.saving}
                  onChange={(event) => {
                    setDatabaseId(event.target.value);
                    setViewChoice("new");
                    setViewType("table");
                  }}
                >
                  {databases.map((database) => (
                    <option key={database.id} value={database.id}>{database.title}</option>
                  ))}
                </select>
              </label>
            )}
            {props.allowExistingViews === false ? null : (
              <label className="oe-database-picker__field">
                <span>View</span>
                <select
                  aria-label="View"
                  value={viewChoice}
                  disabled={props.selectionLocked || props.saving}
                  onChange={(event) => setViewChoice(event.target.value)}
                >
                  {existingViews.map((view) => {
                    const supported = isDatabaseViewType(view.viewType ?? "");
                    return (
                      <option key={view.id} value={view.id} disabled={!supported}>
                        {view.title?.slice(0, 200) || (supported ? VIEW_LABELS[view.viewType as DatabaseViewType] : "Unsupported saved view")}
                      </option>
                    );
                  })}
                  <option value="new">Create a new view…</option>
                </select>
              </label>
            )}
            {isNewView ? (
              <label className="oe-database-picker__field">
                <span>View type</span>
                <select
                  aria-label="View type"
                  aria-describedby={detailId}
                  value={viewType}
                  disabled={props.selectionLocked || props.saving}
                  onChange={(event) => {
                    const selected = event.target.value;
                    if (isDatabaseViewType(selected)) setViewType(selected);
                  }}
                >
                  {VIEW_PICKER_ORDER.map((type) => (
                    <option key={type} value={type}>{VIEW_LABELS[type]}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <p className="oe-database-picker__description" id={detailId}>
              {description}
            </p>
            </>
          )}
          <div className="oe-database-picker__actions">
            <button type="button" disabled={props.saving} onClick={close}>Cancel</button>
            {props.onRetry ? (
              <button type="button" disabled={props.saving} onClick={props.onRetry}>
                {props.retryLabel ?? "Retry"}
              </button>
            ) : null}
            <button type="submit" disabled={props.loading || props.saving || props.selectionLocked || !canInsert}>Insert</button>
          </div>
        </form>
      </div>
    </div>
  );
}
