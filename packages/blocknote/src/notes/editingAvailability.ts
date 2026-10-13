import type { NotesWorkspaceState } from "./contracts.js";
/** Local body input can continue while its immutable document.save is pending.
 * This grants no transport, resource mutation, recovery or automatic-AI permission. */
export function notesDocumentEditingAvailable(state: NotesWorkspaceState): boolean {
  const snapshot = state.snapshot;
  if (!snapshot?.capabilities.includes("document.save")) return false;
  if (state.status === "ready") return true;
  const request = state.recovery?.request;
  return state.status === "saving" && request?.command.kind === "document.save" && JSON.stringify(request.scope) === JSON.stringify(snapshot.scope) && JSON.stringify(request.target) === JSON.stringify(snapshot.target) && request.expectedRevision === snapshot.revision && request.expectedContentRevision === snapshot.contentRevision;
}
