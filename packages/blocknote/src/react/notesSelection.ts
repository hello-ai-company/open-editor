import type { NotesScope, NotesTarget } from "../notes/contracts.js";
/** Opaque range ticket issued by the live writer. Tickets never survive writer replacement. */
export type NotesTextSelection = { id: string; scope: NotesScope; target: NotesTarget; revision: string; contentRevision: string; blockId: string; text: string };
export type NotesSelectionAction = "improve" | "shorten" | "expand" | "rewrite";
export type NotesSelectionAIRequest = { requestId: string; scope: NotesScope; target: NotesTarget; revision: string; contentRevision: string; selection: { id: string; blockId: string; text: string }; action: NotesSelectionAction; instruction: string; signal: AbortSignal };
export type NotesSelectionAIResult = { requestId: string; scope: NotesScope; target: NotesTarget; revision: string; contentRevision: string; selectionId: string; text: string };
/** Explicit host service. The SDK never infers a model, permission, web access or billing consent. */
export type NotesSelectionAIService = { run(request: NotesSelectionAIRequest): Promise<NotesSelectionAIResult> };

/** Opens existing host review only; never generate, persist or apply a proposal here. */
export type NotesSelectionProposalRequest = {
  selection: NotesTextSelection;
  signal: AbortSignal;
  /** Check before using the forwarded source, including after asynchronous waits. */
  isCurrent(): boolean;
};
export type NotesSelectionProposalEntry = {
  open(request: NotesSelectionProposalRequest): void | Promise<void>;
};
