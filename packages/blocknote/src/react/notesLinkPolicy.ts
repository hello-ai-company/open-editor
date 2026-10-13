import type { NotesScope, NotesWorkspaceController } from "../notes/contracts.js";
import type { NotesInsertionHost } from "./NotesInsertDialog.js";

export type NotesLinkPolicy = { scope?: NotesScope; insertion?: NotesInsertionHost };
/** External links never include executable protocols or URL credentials. Internal links are explicit page identities. */
export function notesSafeInsertionLink(value: string): boolean {
  if (/^openeditor:\/\/page\/[^/?#\s]+$/.test(value)) return true;
  try { const url = new URL(value); return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol) && !url.username && !url.password && !/[\u0000-\u0020]/.test(value); } catch { return false; }
}
function hostAllows({ scope, insertion }: NotesLinkPolicy, href?: string): boolean {
  if (insertion?.pickerInsertKinds !== undefined || insertion?.isValidLink || insertion?.linkBlockTypes !== undefined || insertion?.allowLinkHardBreaks === false) {
    if (!scope || scope.actorId !== insertion.scope.actorId || scope.workspaceId !== insertion.scope.workspaceId) return false;
    if (insertion.pickerInsertKinds !== undefined && !insertion.pickerInsertKinds.includes("link")) return false;
  }
  try { return href === undefined || !insertion?.isValidLink || insertion.isValidLink(href); } catch { return false; }
}
/** Picker input always retains the SDK safe-link floor, with optional stricter host validation. */
export function notesInsertionLinkAllowed(policy: NotesLinkPolicy, href: string): boolean {
  return notesSafeInsertionLink(href) && hostAllows(policy, href);
}
/** Only install for hosts opting into link restrictions at writer creation. The
 * unrestricted editor's native links option remains untouched. Re-read the host
 * on every ingress so a retained native popover cannot bypass policy revocation. */
export function notesLinkValidator(read: () => NotesLinkPolicy, existing?: (href: string) => boolean): (href: string) => boolean {
  const initial = read().insertion;
  const boundScope = initial && (initial.pickerInsertKinds !== undefined || initial.isValidLink || initial.linkBlockTypes !== undefined || initial.allowLinkHardBreaks === false) ? { ...initial.scope } : undefined;
  return href => {
    const policy = read();
    if (boundScope && (!policy.insertion || policy.insertion.scope.actorId !== boundScope.actorId || policy.insertion.scope.workspaceId !== boundScope.workspaceId)) return false;
    if (!hostAllows(policy, href)) return false;
    try { return existing ? existing(href) : notesSafeInsertionLink(href) && !href.startsWith("openeditor:"); } catch { return false; }
  };
}
/** BlockNote's public create/edit APIs do not call links.isValidLink. Its native
 * link popover (including Mod-K) delegates to editLink, so fence these entry
 * points too. This does not rewrite the document or add a second save path. */
export function guardNotesLinkCommands<T extends {
  createLink?: (href: string, text?: string) => void;
  editLink?: (href: string, text: string, position?: number) => void;
  deleteLink?: (position?: number) => void;
}>(editor: T, allowed: (href: string) => boolean, available: () => boolean, labelAllowed: (text: string) => boolean = () => true): () => void {
  const create = editor.createLink, edit = editor.editLink, remove = editor.deleteLink;
  let active = true;
  const canEdit = () => active && available();
  const guardedCreate = (href: string, text?: string) => { if (canEdit() && allowed(href) && (text === undefined || text.length > 0 && labelAllowed(text))) create?.call(editor, href, text); };
  const guardedEdit = (href: string, text: string, position?: number) => { if (canEdit() && allowed(href) && text.length > 0 && labelAllowed(text)) edit?.call(editor, href, text, position); };
  const guardedDelete = (position?: number) => { if (canEdit()) remove?.call(editor, position); };
  if (create) editor.createLink = guardedCreate;
  if (edit) editor.editLink = guardedEdit;
  if (remove) editor.deleteLink = guardedDelete;
  return () => {
    active = false;
    if (editor.createLink === guardedCreate) editor.createLink = create;
    if (editor.editLink === guardedEdit) editor.editLink = edit;
    if (editor.deleteLink === guardedDelete) editor.deleteLink = remove;
  };
}

/** All selected blocks must belong to the host's lossless inline-link subset. */
export function notesLinkSelectionAllowed(insertion: NotesInsertionHost | undefined, blockTypes: readonly string[] | undefined, hasHardBreaks?: boolean): boolean {
  if (insertion?.allowLinkHardBreaks === false && hasHardBreaks !== false) return false;
  return insertion?.linkBlockTypes === undefined || !!blockTypes?.length && blockTypes.every(type => insertion.linkBlockTypes!.includes(type));
}
/** BlockNote represents hard breaks as newline text in its public block content. */
export function notesLinkBlocksHaveHardBreaks(blocks: readonly { content?: unknown }[]): boolean {
  const hasBreak = (content: unknown): boolean => {
    if (typeof content === "string") return /[\r\n]/.test(content);
    if (Array.isArray(content)) return content.some(hasBreak);
    if (!content || typeof content !== "object") return false;
    const node = content as { type?: string; text?: unknown; content?: unknown };
    return node.type === "text" ? hasBreak(node.text) : node.type === "link" ? hasBreak(node.content) : false;
  };
  return blocks.some(block => hasBreak(block.content));
}

/** BlockNote's Mod-K opener does not itself check IME or live host availability.
 * Scope capture to this focused editor, leaving form fields and other editors
 * untouched. Do not cancel the browser's composition commit. */
export function guardNotesLinkShortcut(root: HTMLElement, available: () => boolean): () => void {
  const keydown = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.key !== "k") return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !root.contains(target) || !root.contains(root.ownerDocument.activeElement)) return;
    if (target.closest("input,textarea,select") || target.closest("[contenteditable]") !== root) return;
    const composing = event.isComposing || event.keyCode === 229;
    if (!composing && available()) return;
    event.stopImmediatePropagation();
    if (!composing) event.preventDefault();
  };
  root.addEventListener("keydown", keydown, true);
  return () => { root.removeEventListener("keydown", keydown, true); };
}

/** Native link fields are transient form input, not the document's IME surface.
 * Keep their composition local so a body-state rerender cannot discard the field.
 * A closed menu, blur or changed owner must never leave a retained guard behind. */
export function createNotesLinkInputComposition(root: () => HTMLElement | null, identity: () => string, changed: () => void = () => undefined) {
  let current: { input: Element; identity: string } | undefined;
  let observer: MutationObserver | undefined;
  const valid = () => !!current && current.input.isConnected && !!root()?.contains(current.input) && current.identity === identity();
  const clear = () => { observer?.disconnect(); observer = undefined; const wasActive = !!current; current = undefined; if (wasActive) changed(); };
  const accepts = (target: EventTarget | null): target is Element => target instanceof Element && !!root()?.contains(target) && target.matches(":is(.oe-notes-format-item[data-notes-native-item=createLinkButton],.bn-link-toolbar) > .bn-popover-content.bn-form-popover[role=dialog] :is(input,textarea)");
  return {
    accepts,
    start(target: EventTarget | null) {
      if (!accepts(target)) return false;
      observer?.disconnect(); current = { input: target, identity: identity() };
      observer = new MutationObserver(() => { if (!valid()) clear(); }); observer.observe(root()!, { childList: true, subtree: true });
      changed(); return true;
    },
    end(target: EventTarget | null) { if (!accepts(target)) return false; if (current?.input === target) clear(); return true; },
    blur(target: EventTarget | null) { if (current?.input === target) clear(); },
    clear,
    get composing() { return valid(); },
  };
}

/** Private, ephemeral Save interlock. Contains only live field readers, never
 * values, drafts or persistence state; only NotesWorkspace subscribes to it. */
type NativeLinkCompositionSignal = {
  getSnapshot(): boolean;
  getGeneration(): number;
  subscribe(listener: () => void): () => void;
  register(read: () => boolean): () => void;
  notify(): void;
};
const nativeLinkCompositionSignals = new WeakMap<NotesWorkspaceController, NativeLinkCompositionSignal>();
export function notesNativeLinkCompositionSignal(controller: NotesWorkspaceController): NativeLinkCompositionSignal {
  let signal = nativeLinkCompositionSignals.get(controller);
  if (!signal) {
    const readers = new Set<() => boolean>(), listeners = new Set<() => void>();
    let generation = 0;
    const notify = () => { generation++; for (const listener of listeners) listener(); };
    signal = {
      getSnapshot: () => [...readers].some(read => read()),
      getGeneration: () => generation,
      subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
      register(read) { readers.add(read); notify(); return () => { readers.delete(read); notify(); }; },
      notify,
    };
    nativeLinkCompositionSignals.set(controller, signal);
  }
  return signal;
}
