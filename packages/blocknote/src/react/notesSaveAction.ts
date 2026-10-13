import type { NotesCommandOutcome, NotesScope, NotesTarget } from "../notes/contracts.js";

/** Presentation lifecycle for a toolbar click or Ctrl/Cmd+S only. Never a save override. */
export type NotesSaveActionContext = Readonly<{
  source: "toolbar" | "shortcut";
  keyboard: boolean;
  trigger: HTMLElement;
  workspace: HTMLElement;
  statusTarget: HTMLElement;
  identity: Readonly<{ scope: Readonly<NotesScope>; target: Readonly<NotesTarget>; revision: string; contentRevision: string; sessionId: string }>;
  signal: AbortSignal;
}>;
export type NotesSaveActionResult = Readonly<{
  outcome: NotesCommandOutcome | undefined;
  /** Recheck immediately before presenting a completion. False after any newer operation/input/route. */
  isCurrent(): boolean;
}>;
/** Called synchronously before explicit save; optional completion runs after the controller settles.
 * Use signal to release listeners on supersession/unmount. Exceptions never change persistence.
 * A committed result has passed the controller's canonical receipt checks; isCurrent additionally
 * checks the originating operation and live editor state. Hosts still own focus/gesture guards.
 */
export type NotesSaveActionHandler = (context: NotesSaveActionContext) => void | ((result: NotesSaveActionResult) => void);
